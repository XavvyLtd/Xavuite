import { ok, created, err } from '../../core/response';
import type { Env, AppContext } from '../../types';

export async function handleResources(
  request: Request, env: Env, ctx: AppContext, subPath: string
): Promise<Response> {
  const pathOnly = subPath.split('?')[0];
  const [resource, id] = pathOnly.split('/').filter(Boolean);

  // GET /api/resources/capacity?weekStart=&weekEnd=
  if (resource === 'capacity' && request.method === 'GET') {
    const url = new URL(request.url);
    const weekStart = url.searchParams.get('weekStart') ?? getMonday(new Date(), -52);
    const weekEnd   = url.searchParams.get('weekEnd')   ?? getMonday(new Date(), 12);

    const rows = await env.DB.prepare(`
      SELECT
        e.id AS employee_id,
        eh.first_name||' '||eh.last_name AS employee_name,
        eh.department_id,
        d.name AS department_name,
        -- Logged hours from approved timesheets (actual time worked)
        COALESCE((
          SELECT SUM(te.hours_worked)
          FROM timesheets t
          JOIN timesheet_entries te ON te.timesheet_id=t.id
          WHERE t.employee_id=e.id AND t.tenant_id=e.tenant_id
            AND t.week_starting >= ? AND t.week_starting <= ?
            AND t.status='approved'
        ), 0) AS logged_hours,
        -- Booked hours from resource bookings (planned) - total and weekly average
        COALESCE((
          SELECT SUM(rb.hours) FROM resource_bookings rb
          WHERE rb.employee_id=e.id AND rb.tenant_id=e.tenant_id
            AND rb.week_starting >= ? AND rb.week_starting <= ?
        ), 0) AS allocated_hours,
        -- Weekly average booked hours
        ROUND(COALESCE((
          SELECT AVG(rb.hours) FROM resource_bookings rb
          WHERE rb.employee_id=e.id AND rb.tenant_id=e.tenant_id
            AND rb.week_starting >= ? AND rb.week_starting <= ?
        ), 0), 1) AS avg_weekly_booked,
        37.5 AS available_hours,
        ROUND(COALESCE((
          SELECT SUM(te2.hours_worked)
          FROM timesheets t2
          JOIN timesheet_entries te2 ON te2.timesheet_id=t2.id
          WHERE t2.employee_id=e.id AND t2.tenant_id=e.tenant_id
            AND t2.week_starting >= ? AND t2.week_starting <= ?
            AND t2.status='approved'
        ), 0) / (MAX(1, ROUND((julianday(?) - julianday(?)) / 7)) * 37.5) * 100, 1) AS utilisation_pct,
        GROUP_CONCAT(DISTINCT p.name) AS projects
      FROM employees e
      JOIN employee_history eh ON eh.employee_id=e.id AND eh.is_current=1
      LEFT JOIN departments d ON d.id=eh.department_id
      LEFT JOIN resource_bookings rb2 ON rb2.employee_id=e.id AND rb2.tenant_id=e.tenant_id
        AND rb2.week_starting >= ? AND rb2.week_starting <= ?
      LEFT JOIN pmo_projects p ON p.id=rb2.project_id
      WHERE e.tenant_id=? AND e.status='active'
      GROUP BY e.id
      ORDER BY utilisation_pct DESC
    `).bind(weekStart, weekEnd, weekStart, weekEnd, weekStart, weekEnd, weekStart, weekEnd, weekEnd, weekStart, weekStart, weekEnd, ctx.tenantId).all();
    return ok(rows.results);
  }

  // GET /api/resources/forecast?weeks=
  if (resource === 'forecast' && request.method === 'GET') {
    const url   = new URL(request.url);
    const weeks = parseInt(url.searchParams.get('weeks') ?? '8');
    const rows  = await env.DB.prepare(`
      SELECT
        rb.week_starting,
        COUNT(DISTINCT rb.employee_id) AS employees,
        SUM(rb.hours) AS total_booked,
        COUNT(DISTINCT rb.employee_id) * 37.5 AS total_available,
        ROUND(SUM(rb.hours) / (COUNT(DISTINCT rb.employee_id) * 37.5) * 100, 1) AS utilisation_pct
      FROM resource_bookings rb
      JOIN employees e ON e.id=rb.employee_id AND e.status='active'
      WHERE rb.tenant_id=? AND rb.week_starting >= date('now','weekday 1','-84 days')
        AND rb.week_starting <= date('now','weekday 1','+' || ? || ' weeks')
      GROUP BY rb.week_starting
      ORDER BY rb.week_starting
    `).bind(ctx.tenantId, weeks).all();
    return ok(rows.results);
  }

  // GET /api/resources/bench — employees with < 80% utilisation this week
  if (resource === 'bench' && request.method === 'GET') {
    const weekStart = getMonday(new Date());
    const rows = await env.DB.prepare(`
      SELECT
        e.id, eh.first_name||' '||eh.last_name AS name,
        d.name AS department,
        COALESCE(SUM(rb.hours), 0) AS booked_hours,
        37.5 - COALESCE(SUM(rb.hours), 0) AS bench_hours,
        ROUND(COALESCE(SUM(rb.hours), 0) / 37.5 * 100, 1) AS utilisation_pct
      FROM employees e
      JOIN employee_history eh ON eh.employee_id=e.id AND eh.is_current=1
      LEFT JOIN departments d ON d.id=eh.department_id
      LEFT JOIN resource_bookings rb ON rb.employee_id=e.id AND rb.tenant_id=e.tenant_id
        AND rb.week_starting=?
      WHERE e.tenant_id=? AND e.status='active'
      GROUP BY e.id
      HAVING utilisation_pct < 80
      ORDER BY utilisation_pct ASC
    `).bind(weekStart, ctx.tenantId).all();
    return ok(rows.results);
  }

  // POST /api/resources/bookings — create/update booking
  if (resource === 'bookings' && !id && request.method === 'POST') {
    const body = await request.json() as any;
    if (!body.employeeId || !body.weekStarting || body.hours === undefined) {
      return err('employeeId, weekStarting and hours are required');
    }
    const bookingId = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO resource_bookings (id,tenant_id,employee_id,project_id,booking_type,week_starting,hours,notes,created_by)
      VALUES (?,?,?,?,?,?,?,?,?)
      ON CONFLICT(tenant_id,employee_id,project_id,week_starting)
      DO UPDATE SET hours=excluded.hours, notes=excluded.notes
    `).bind(bookingId, ctx.tenantId, body.employeeId, body.projectId??null, body.bookingType??'project', body.weekStarting, body.hours, body.notes??null, ctx.userId).run();
    return created({ id:bookingId });
  }

  // GET /api/resources/bookings?weekStart=&employeeId=
  if (resource === 'bookings' && !id && request.method === 'GET') {
    const url = new URL(request.url);
    const weekStart  = url.searchParams.get('weekStart');
    const employeeId = url.searchParams.get('employeeId');
    let where = 'rb.tenant_id=?';
    const params: unknown[] = [ctx.tenantId];
    if (weekStart)  { where += ' AND rb.week_starting=?'; params.push(weekStart); }
    if (employeeId) { where += ' AND rb.employee_id=?';   params.push(employeeId); }

    const rows = await env.DB.prepare(`
      SELECT rb.*, p.name AS project_name, eh.first_name||' '||eh.last_name AS employee_name
      FROM resource_bookings rb
      LEFT JOIN pmo_projects p ON p.id=rb.project_id
      JOIN employees e ON e.id=rb.employee_id
      JOIN employee_history eh ON eh.employee_id=e.id AND eh.is_current=1
      WHERE ${where}
      ORDER BY rb.week_starting, rb.created_at
    `).bind(...params).all();
    return ok(rows.results);
  }

  return err('Not found', 404);
}

function getMonday(d: Date, weeksAhead = 0): string {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) + (weeksAhead * 7);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split('T')[0];
}

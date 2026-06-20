import { ok, created, err, notFound } from '../../core/response';
import { requirePermission } from '../../middleware/auth';
import { audit, auditFromRequest } from '../../middleware/audit';
import type { Env, AppContext } from '../../types';

export async function handleOvertime(
  request: Request, env: Env, ctx: AppContext, subPath: string
): Promise<Response> {
  const pathOnly = subPath.split('?')[0];
  const segments = pathOnly.split('/').filter(Boolean);
  const resource = segments[0];  // 'records' | 'approve' | 'convert' | 'country-rules' | 'summary'
  const id       = segments[1];
  const action   = segments[2];
  const method   = request.method;
  const url      = new URL(request.url);
  const tid      = ctx.tenantId;

  // ── OVERTIME RECORDS ─────────────────────────────────────────
  // GET /api/overtime/records
  if (resource === 'records' && !id && method === 'GET') {
    const empId  = url.searchParams.get('employeeId');
    const status = url.searchParams.get('status');
    const from   = url.searchParams.get('from') ?? new Date(Date.now() - 90*86400000).toISOString().split('T')[0];
    const to     = url.searchParams.get('to')   ?? new Date().toISOString().split('T')[0];

    let where = 'WHERE o.tenant_id=? AND o.date>=? AND o.date<=?';
    const params: any[] = [tid, from, to];
    if (empId)  { where += ' AND o.employee_id=?'; params.push(empId); }
    if (status) { where += ' AND o.status=?';      params.push(status); }

    const rows = await env.DB.prepare(`
      SELECT o.*,
             eh.first_name||' '||eh.last_name as employee_name,
             p.name as project_name
      FROM overtime_records o
      JOIN employees e ON e.id=o.employee_id
      JOIN employee_history eh ON eh.employee_id=e.id AND eh.is_current=1
      LEFT JOIN pmo_projects p ON p.id=o.project_id
      ${where}
      ORDER BY o.date DESC
    `).bind(...params).all();
    return ok(rows.results);
  }

  // POST /api/overtime/records — log overtime
  if (resource === 'records' && !id && method === 'POST') {
    const body: any = await request.json().catch(() => ({}));
    if (!body.date || !body.hours) return err('date and hours are required');

    // Resolve employee — use current user if not specified (employee logging own OT)
    let empId = body.employee_id;
    if (!empId) {
      const empRow = await env.DB.prepare(
        `SELECT id FROM employees WHERE user_id=? AND tenant_id=?`
      ).bind(ctx.userId, tid).first<{ id: string }>();
      if (!empRow) return err('Employee not found');
      empId = empRow.id;
    }

    const toilHours = body.toil_eligible !== false
      ? (body.hours * (body.rate_multiplier ?? 1.0))
      : null;

    const recId = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO overtime_records
        (id, tenant_id, employee_id, date, hours, rate_multiplier, toil_eligible, toil_hours, status, project_id, timesheet_id, notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      recId, tid, empId, body.date,
      body.hours, body.rate_multiplier ?? 1.0,
      body.toil_eligible !== false ? 1 : 0,
      toilHours,
      'pending',
      body.project_id ?? null,
      body.timesheet_id ?? null,
      body.notes ?? null,
    ).run();

    await audit(env, { ...auditFromRequest(request, ctx), action: 'create', resource: 'overtime', resourceId: recId });
    return created({ id: recId, toil_hours: toilHours });
  }

  // POST /api/overtime/records/:id/approve — manager approves overtime
  if (resource === 'records' && id && action === 'approve' && method === 'POST') {
    const denied = requirePermission(ctx, 'leave:approve:leave');
    if (denied) return denied;

    const body: any = await request.json().catch(() => ({}));
    const record = await env.DB.prepare(
      `SELECT * FROM overtime_records WHERE id=? AND tenant_id=?`
    ).bind(id, tid).first() as any;
    if (!record) return notFound('Overtime record not found');

    await env.DB.prepare(`
      UPDATE overtime_records SET status='approved', approved_by=?, approved_at=datetime('now'), updated_at=datetime('now')
      WHERE id=?
    `).bind(ctx.userId, id).run();

    return ok({ approved: true });
  }

  // POST /api/overtime/records/:id/convert — convert approved overtime to TOIL balance
  if (resource === 'records' && id && action === 'convert' && method === 'POST') {
    const denied = requirePermission(ctx, 'leave:approve:leave');
    if (denied) return denied;

    const record = await env.DB.prepare(
      `SELECT * FROM overtime_records WHERE id=? AND tenant_id=? AND status='approved' AND toil_eligible=1`
    ).bind(id, tid).first() as any;
    if (!record) return err('Record not found or not eligible for TOIL conversion');

    const toilDays = (record.toil_hours ?? record.hours) / 7.5; // 7.5h working day
    const year     = new Date(record.date).getFullYear();

    // Find TOIL leave type
    const toil = await env.DB.prepare(
      `SELECT id FROM leave_types WHERE tenant_id=? AND code='toil' LIMIT 1`
    ).bind(tid).first<{ id: string }>();
    if (!toil) return err('TOIL leave type not configured');

    // Upsert leave balance — add TOIL days
    await env.DB.prepare(`
      INSERT INTO leave_balances (id, tenant_id, employee_id, leave_type_id, year, entitlement, accrued)
      VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(tenant_id, employee_id, leave_type_id, year)
      DO UPDATE SET accrued = accrued + ?, updated_at=datetime('now')
    `).bind(
      crypto.randomUUID(), tid, record.employee_id, toil.id, year,
      toilDays, toilDays,   // initial values if new row
      toilDays,             // delta for existing row
    ).run();

    await env.DB.prepare(
      `UPDATE overtime_records SET status='converted_to_toil', updated_at=datetime('now') WHERE id=?`
    ).bind(id).run();

    await audit(env, { ...auditFromRequest(request, ctx), action: 'convert_toil', resource: 'overtime', resourceId: id });
    return ok({ converted: true, toil_days_added: toilDays });
  }

  // POST /api/overtime/records/:id/reject
  if (resource === 'records' && id && action === 'reject' && method === 'POST') {
    const denied = requirePermission(ctx, 'leave:approve:leave');
    if (denied) return denied;
    await env.DB.prepare(
      `UPDATE overtime_records SET status='rejected', approved_by=?, approved_at=datetime('now') WHERE id=? AND tenant_id=?`
    ).bind(ctx.userId, id, tid).run();
    return ok({ rejected: true });
  }

  // GET /api/overtime/summary/:employeeId — TOIL balance + overtime summary
  if (resource === 'summary' && id && method === 'GET') {
    const year = url.searchParams.get('year') ?? new Date().getFullYear().toString();

    const [records, toilBalance] = await Promise.all([
      env.DB.prepare(`
        SELECT status, SUM(hours) as hours, SUM(toil_hours) as toil_hours
        FROM overtime_records
        WHERE employee_id=? AND tenant_id=? AND strftime('%Y', date)=?
        GROUP BY status
      `).bind(id, tid, year).all(),
      env.DB.prepare(`
        SELECT lb.*, lt.name as leave_type_name
        FROM leave_balances lb
        JOIN leave_types lt ON lt.id=lb.leave_type_id
        WHERE lb.employee_id=? AND lb.tenant_id=? AND lt.code='toil' AND lb.year=?
      `).bind(id, tid, year).first(),
    ]);

    return ok({ overtime_by_status: records.results, toil_balance: toilBalance });
  }

  // ── COUNTRY LEAVE RULES ───────────────────────────────────────
  // GET /api/overtime/country-rules
  if (resource === 'country-rules' && method === 'GET') {
    const country = url.searchParams.get('country');
    let sql = `SELECT * FROM country_leave_rules WHERE tenant_id=?`;
    const params: any[] = [tid];
    if (country) { sql += ` AND country_code=?`; params.push(country); }
    sql += ` ORDER BY country_code, leave_code`;
    const rows = await env.DB.prepare(sql).bind(...params).all();
    return ok(rows.results);
  }

  // PUT /api/overtime/country-rules — upsert a country rule
  if (resource === 'country-rules' && method === 'PUT') {
    const denied = requirePermission(ctx, 'settings:manage:company');
    if (denied) return denied;
    const body: any = await request.json().catch(() => ({}));
    if (!body.country_code || !body.leave_code) return err('country_code and leave_code required');

    await env.DB.prepare(`
      INSERT INTO country_leave_rules (id, tenant_id, country_code, country_name, leave_code, statutory_days, paid, notes)
      VALUES (?,?,?,?,?,?,?,?)
      ON CONFLICT(tenant_id, country_code, leave_code)
      DO UPDATE SET statutory_days=excluded.statutory_days, paid=excluded.paid, notes=excluded.notes
    `).bind(
      crypto.randomUUID(), tid,
      body.country_code, body.country_name ?? body.country_code,
      body.leave_code, body.statutory_days ?? 0,
      body.paid !== false ? 1 : 0,
      body.notes ?? null,
    ).run();
    return ok({ saved: true });
  }

  // GET /api/overtime/country-rules/countries — list distinct countries
  if (resource === 'country-rules' && id === 'countries' && method === 'GET') {
    const rows = await env.DB.prepare(
      `SELECT DISTINCT country_code, country_name FROM country_leave_rules WHERE tenant_id=? ORDER BY country_name`
    ).bind(tid).all();
    return ok(rows.results);
  }

  return notFound();
}

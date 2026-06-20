import { ok, err, notFound } from '../../core/response';
import { requirePermission } from '../../middleware/auth';
import type { Env, AppContext } from '../../types';

export async function handleLeaveEnhancements(
  request: Request, env: Env, ctx: AppContext, subPath: string
): Promise<Response> {
  const [resource, id] = subPath.split('/').filter(Boolean);

  // GET /api/leave/types
  if (resource === 'types' && !id && request.method === 'GET') {
    const rows = await env.DB.prepare(`
      SELECT * FROM leave_types WHERE tenant_id = ? AND enabled = 1 ORDER BY name
    `).bind(ctx.tenantId).all();
    return ok(rows.results);
  }

  // GET /api/leave/policies
  if (resource === 'policies' && !id && request.method === 'GET') {
    const rows = await env.DB.prepare(`
      SELECT lp.*, lt.name as leave_type_name, lt.colour, lt.code
      FROM leave_policies lp
      JOIN leave_types lt ON lt.id = lp.leave_type_id
      WHERE lp.tenant_id = ? AND lp.enabled = 1
      ORDER BY lt.name
    `).bind(ctx.tenantId).all();
    return ok(rows.results);
  }

  // GET /api/leave/balances?employeeId=&year=
  if (resource === 'balances' && !id && request.method === 'GET') {
    const url = new URL(request.url);
    const employeeId = url.searchParams.get('employeeId');
    const year = url.searchParams.get('year') ?? new Date().getFullYear();

    let where = 'lb.tenant_id = ? AND lb.year = ?';
    const params: unknown[] = [ctx.tenantId, year];
    if (employeeId) { where += ' AND lb.employee_id = ?'; params.push(employeeId); }

    const rows = await env.DB.prepare(`
      SELECT lb.*,
             lt.name as leave_type_name, lt.colour, lt.code,
             eh.first_name || ' ' || eh.last_name AS employee_name,
             (lb.entitlement + lb.carried_forward + lb.adjusted - lb.taken - lb.pending) as remaining
      FROM leave_balances lb
      JOIN leave_types lt ON lt.id = lb.leave_type_id
      JOIN employee_history eh ON eh.employee_id = lb.employee_id AND eh.is_current = 1
      WHERE ${where}
      ORDER BY eh.last_name, lt.name
    `).bind(...params).all();
    return ok(rows.results);
  }

  // GET /api/leave/balances/:employeeId — all balances for one employee
  if (resource === 'balances' && id && request.method === 'GET') {
    const year = new URL(request.url).searchParams.get('year') ?? new Date().getFullYear();
    const rows = await env.DB.prepare(`
      SELECT lb.*, lt.name as leave_type_name, lt.colour, lt.code, lt.carry_forward, lt.max_days,
             (lb.entitlement + lb.carried_forward + lb.adjusted - lb.taken - lb.pending) as remaining
      FROM leave_balances lb
      JOIN leave_types lt ON lt.id = lb.leave_type_id
      WHERE lb.employee_id = ? AND lb.tenant_id = ? AND lb.year = ?
      ORDER BY lt.name
    `).bind(id, ctx.tenantId, year).all();
    return ok(rows.results);
  }

  // POST /api/leave/balances — set/upsert a single employee's leave balance
  if (resource === 'balances' && !id && request.method === 'POST') {
    const body = await request.json() as any;
    if (!body.employeeId || !body.leaveTypeId || !body.year) {
      return err('employeeId, leaveTypeId and year are required');
    }
    const balId = `${body.employeeId}-${body.leaveTypeId}-${body.year}`;
    await env.DB.prepare(`
      INSERT INTO leave_balances (id, tenant_id, employee_id, leave_type_id, year, entitlement, adjusted, adjustment_note, taken, pending, carried_forward)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0)
      ON CONFLICT(tenant_id, employee_id, leave_type_id, year) DO UPDATE SET
        entitlement=excluded.entitlement,
        adjusted=excluded.adjusted,
        adjustment_note=excluded.adjustment_note
    `).bind(balId, ctx.tenantId, body.employeeId, body.leaveTypeId, body.year,
            body.entitlement ?? 25, body.adjustment ?? 0, body.adjustmentNote ?? null).run();
    return ok({ id: balId, updated: true });
  }

  // POST /api/leave/balances/initialise — seed balances for all active employees
  if (resource === 'balances' && id === 'initialise' && request.method === 'POST') {
    const denied = requirePermission(ctx, 'leave:manage:leave_policy');
    if (denied) return denied;

    const year = new Date().getFullYear();

    // Get all active employees
    const employees = await env.DB.prepare(`
      SELECT e.id, eh.employment_type FROM employees e
      JOIN employee_history eh ON eh.employee_id = e.id AND eh.is_current = 1
      WHERE e.tenant_id = ? AND e.status = 'active'
    `).bind(ctx.tenantId).all() as any;

    // Get all policies
    const policies = await env.DB.prepare(`
      SELECT lp.*, lt.id as type_id FROM leave_policies lp
      JOIN leave_types lt ON lt.id = lp.leave_type_id
      WHERE lp.tenant_id = ? AND lp.enabled = 1
    `).bind(ctx.tenantId).all() as any;

    // Fallback: if no policies configured, use leave_types with sensible defaults
    let effectivePolicies: any[] = (policies as any).results ?? [];
    if (!effectivePolicies.length) {
      const defaultTypes = await env.DB.prepare(
        `SELECT id as type_id, code FROM leave_types WHERE tenant_id=? AND enabled=1`
      ).bind(ctx.tenantId).all() as any;
      const defaults: Record<string,number> = { annual:25, sick:10, maternity:52*5, paternity:10, compassionate:5, unpaid:0, toil:0 };
      effectivePolicies = (defaultTypes.results ?? []).map((lt: any) => ({
        type_id: lt.type_id, entitlement_days: defaults[lt.code] ?? 5, applies_to: 'all',
      }));
    }

    let created = 0;
    const stmts: any[] = [];
    for (const emp of (employees as any).results ?? []) {
      for (const policy of effectivePolicies) {
        if (policy.applies_to !== 'all' && policy.applies_value !== emp.employment_type) continue;
        stmts.push(env.DB.prepare(`
          INSERT OR IGNORE INTO leave_balances (id, tenant_id, employee_id, leave_type_id, year, entitlement, taken, pending, carried_forward, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, CURRENT_TIMESTAMP)
        `).bind(crypto.randomUUID(), ctx.tenantId, emp.id, policy.type_id, year, policy.entitlement_days));
        created++;
      }
    }

    if (stmts.length > 0) await env.DB.batch(stmts);
    return ok({ created, year });
  }

  // PATCH /api/leave/balances/:balanceId — manual adjustment
  if (resource === 'balances' && id && request.method === 'PATCH') {
    const denied = requirePermission(ctx, 'leave:manage:leave_policy');
    if (denied) return denied;

    const { adjustment, note } = await request.json() as any;
    await env.DB.prepare(`
      UPDATE leave_balances SET adjusted = adjusted + ?, adjustment_note = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND tenant_id = ?
    `).bind(Number(adjustment), note || null, id, ctx.tenantId).run();
    return ok({ id, adjusted: true });
  }

  // GET /api/leave/holidays?year=
  if (resource === 'holidays' && !id && request.method === 'GET') {
    const year = new URL(request.url).searchParams.get('year') ?? new Date().getFullYear();
    const rows = await env.DB.prepare(`
      SELECT * FROM public_holidays WHERE tenant_id = ? AND year = ? ORDER BY date
    `).bind(ctx.tenantId, year).all();
    return ok(rows.results);
  }

  // GET /api/leave/calendar?month=&year=
  if (resource === 'calendar' && !id && request.method === 'GET') {
    const url    = new URL(request.url);
    const year   = url.searchParams.get('year')  ?? new Date().getFullYear();
    const month  = url.searchParams.get('month') ?? (new Date().getMonth() + 1);

    const monthStr = String(month).padStart(2, '0');
    const startDate = `${year}-${monthStr}-01`;
    const endDate   = `${year}-${monthStr}-31`;

    const rows = await env.DB.prepare(`
      SELECT lr.*, eh.first_name || ' ' || eh.last_name AS employee_name
      FROM leave_requests lr
      JOIN employees e ON e.id = lr.employee_id
      JOIN employee_history eh ON eh.employee_id = e.id AND eh.is_current = 1
      WHERE lr.tenant_id = ?
        AND lr.status = 'approved'
        AND lr.start_date <= ? AND lr.end_date >= ?
      ORDER BY lr.start_date
    `).bind(ctx.tenantId, endDate, startDate).all();

    const holidays = await env.DB.prepare(`
      SELECT * FROM public_holidays WHERE tenant_id = ? AND date >= ? AND date <= ?
    `).bind(ctx.tenantId, startDate, endDate).all();

    return ok({ leaves: rows.results, holidays: holidays.results });
  }

  return err('Not found', 404);
}

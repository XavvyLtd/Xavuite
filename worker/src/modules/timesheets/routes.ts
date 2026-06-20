import { z } from 'zod';
import { ok, created, err, notFound } from '../../core/response';
import { requirePermission, hasPermission } from '../../middleware/auth';
import { audit, auditFromRequest } from '../../middleware/audit';
import { sendMail, timesheetReminderEmail } from '../../core/email';
import type { Env, AppContext } from '../../types';

const CreateTimesheetSchema = z.object({
  weekStarting: z.string().date(),
  projectId:    z.string().uuid().optional(),
  taskId:       z.string().uuid().optional(),
  entries: z.array(z.object({
    date:        z.string().date(),
    hoursWorked: z.number().min(0).max(24),
    description: z.string().max(500).optional(),
    billable:    z.boolean().default(false),
  })).min(1).max(7),
});

const BulkDecisionSchema = z.object({
  ids:      z.array(z.string().uuid()).min(1),
  decision: z.enum(['approved', 'rejected']),
  comment:  z.string().optional(),
});

export async function handleTimesheets(
  request: Request, env: Env, ctx: AppContext, subPath: string
): Promise<Response> {
  const segments = subPath.split('/').filter(Boolean);
  const id = segments[0];
  const action = segments[1];

  // GET /api/timesheets
  if (!id && request.method === 'GET') {
    const denied = requirePermission(ctx, 'timesheets:view:timesheet');
    if (denied) return denied;

    const url = new URL(request.url);
    const mine   = url.searchParams.get('mine') === 'true';
    const status = url.searchParams.get('status');
    const week   = url.searchParams.get('weekStarting');

    let where = 't.tenant_id = ?';
    const params: unknown[] = [ctx.tenantId];

    if (mine || !hasPermission(ctx, 'timesheets:approve:timesheet')) {
      where += ' AND t.employee_id = (SELECT id FROM employees WHERE user_id = ? AND tenant_id = ?)';
      params.push(ctx.userId, ctx.tenantId);
    }
    if (status) { where += ' AND t.status = ?'; params.push(status); }
    if (week)   { where += ' AND t.week_starting = ?'; params.push(week); }

    const rows = await env.DB.prepare(`
      SELECT t.*,
             eh.first_name || ' ' || eh.last_name AS employee_name,
             SUM(te.hours_worked) AS total_hours,
             SUM(CASE WHEN te.billable = 1 THEN te.hours_worked ELSE 0 END) AS billable_hours
      FROM timesheets t
      JOIN employees e ON e.id = t.employee_id
      JOIN employee_history eh ON eh.employee_id = e.id AND eh.is_current = 1
      LEFT JOIN timesheet_entries te ON te.timesheet_id = t.id
      WHERE ${where}
      GROUP BY t.id
      ORDER BY t.week_starting DESC, t.submitted_at DESC
      LIMIT 100
    `).bind(...params).all();

    return ok(rows.results);
  }

  // POST /api/timesheets
  if (!id && request.method === 'POST') {
    const denied = requirePermission(ctx, 'timesheets:create:timesheet');
    if (denied) return denied;

    const body = await request.json().catch(() => null);
    const parsed = CreateTimesheetSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.issues[0].message);

    const d = parsed.data;
    const employee = await env.DB.prepare(
      `SELECT id FROM employees WHERE user_id = ? AND tenant_id = ?`
    ).bind(ctx.userId, ctx.tenantId).first() as any;
    if (!employee) return err('Employee record not found', 404);

    // Check for duplicate
    const existing = await env.DB.prepare(
      `SELECT id FROM timesheets WHERE employee_id = ? AND week_starting = ? AND status != 'rejected'`
    ).bind(employee.id, d.weekStarting).first();
    if (existing) return err('Timesheet already submitted for this week', 409);

    const tsId = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO timesheets (id, tenant_id, employee_id, project_id, task_id, week_starting, status, submitted_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)
    `).bind(tsId, ctx.tenantId, employee.id, d.projectId ?? null, d.taskId ?? null, d.weekStarting).run();

    const entryStmts = d.entries.map(e =>
      env.DB.prepare(`
        INSERT INTO timesheet_entries (id, timesheet_id, tenant_id, date, hours_worked, description, billable)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(crypto.randomUUID(), tsId, ctx.tenantId, e.date, e.hoursWorked, e.description ?? null, e.billable ? 1 : 0)
    );
    await env.DB.batch(entryStmts);

    await audit(env, {
      ...auditFromRequest(request, ctx),
      action: 'create', resource: 'timesheet', resourceId: tsId,
    });

    return created({ id: tsId });
  }

  // GET /api/timesheets/:id
  if (id && !action && request.method === 'GET') {
    const denied = requirePermission(ctx, 'timesheets:view:timesheet');
    if (denied) return denied;

    const ts = await env.DB.prepare(
      `SELECT t.*, eh.first_name || ' ' || eh.last_name AS employee_name
       FROM timesheets t
       JOIN employees e ON e.id = t.employee_id
       JOIN employee_history eh ON eh.employee_id = e.id AND eh.is_current = 1
       WHERE t.id = ? AND t.tenant_id = ?`
    ).bind(id, ctx.tenantId).first();
    if (!ts) return notFound('Timesheet not found');

    const entries = await env.DB.prepare(
      `SELECT * FROM timesheet_entries WHERE timesheet_id = ? AND tenant_id = ? ORDER BY date`
    ).bind(id, ctx.tenantId).all();

    return ok({ ...ts, entries: entries.results });
  }

  // POST /api/timesheets/:id/decision
  if (id && action === 'decision' && request.method === 'POST') {
    const denied = requirePermission(ctx, 'timesheets:approve:timesheet');
    if (denied) return denied;

    const body = await request.json().catch(() => null);
    const parsed = z.object({
      decision: z.enum(['approved', 'rejected']),
      comment: z.string().optional(),
    }).safeParse(body);
    if (!parsed.success) return err(parsed.error.issues[0].message);

    const ts = await env.DB.prepare(
      `SELECT * FROM timesheets WHERE id = ? AND tenant_id = ?`
    ).bind(id, ctx.tenantId).first() as any;
    if (!ts) return notFound('Timesheet not found');
    if (ts.status !== 'pending') return err('Timesheet is not pending');

    const newStatus = parsed.data.decision === 'approved' ? 'approved' : 'rejected';
    await env.DB.prepare(
      `UPDATE timesheets SET status = ?, decided_by = ?, decided_at = CURRENT_TIMESTAMP, comment = ? WHERE id = ?`
    ).bind(newStatus, ctx.userId, parsed.data.comment ?? null, id).run();

    await audit(env, {
      ...auditFromRequest(request, ctx),
      action: parsed.data.decision === 'approved' ? 'approve' : 'reject',
      resource: 'timesheet', resourceId: id,
    });

    return ok({ id, status: newStatus });
  }

  // POST /api/timesheets/bulk-decision
  if (id === 'bulk-decision' && request.method === 'POST') {
    const denied = requirePermission(ctx, 'timesheets:approve:timesheet');
    if (denied) return denied;

    const body = await request.json().catch(() => null);
    const parsed = BulkDecisionSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.issues[0].message);

    const newStatus = parsed.data.decision === 'approved' ? 'approved' : 'rejected';
    const stmts = parsed.data.ids.map(tsId =>
      env.DB.prepare(
        `UPDATE timesheets SET status = ?, decided_by = ?, decided_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ? AND status = 'pending'`
      ).bind(newStatus, ctx.userId, tsId, ctx.tenantId)
    );
    await env.DB.batch(stmts);

    return ok({ updated: parsed.data.ids.length, status: newStatus });
  }

  return err('Not found', 404);
}

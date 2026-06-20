import { z } from 'zod';
import { ok, err, notFound } from '../../core/response';
import { audit, auditFromRequest } from '../../middleware/audit';
import type { Env, AppContext } from '../../types';

/**
 * Attendance module — daily clock in/out tracking.
 *
 * Distinct from the `timesheets` module: timesheets log hours worked per
 * project/task on a weekly cadence and go through an approval workflow.
 * Attendance is a simple self-service daily clock in/out with no approval
 * step — every record belongs to the employee who created it.
 *
 * Routes (all require an authenticated session — no special permission,
 * since every employee can clock themselves in/out; this mirrors how
 * `timesheets` lets `mine=true` bypass `timesheets:approve:timesheet`):
 *   GET  /api/attendance/today      → today's record for the current user, or null
 *   GET  /api/attendance/week       → last 7 days of records for the current user
 *   POST /api/attendance/clock-in   → { location? }
 *   POST /api/attendance/clock-out  → { location? }
 *
 * Response shape for a record (matches MobileShell.tsx and clock.tsx exactly):
 *   { id, date, clocked_in_at, clocked_out_at, duration_mins, location_in, location_out }
 */

const ClockActionSchema = z.object({
  location: z.string().max(100).optional(),
});

function todayDateStr(): string {
  return new Date().toISOString().split('T')[0];
}

async function getEmployeeId(env: Env, ctx: AppContext): Promise<string | null> {
  // AppContext may already carry employeeId (set by auth middleware for some
  // flows); fall back to a lookup if not, same pattern as timesheets/routes.ts.
  if (ctx.employeeId) return ctx.employeeId;
  const row = await env.DB.prepare(
    `SELECT id FROM employees WHERE user_id = ? AND tenant_id = ?`
  ).bind(ctx.userId, ctx.tenantId).first() as any;
  return row?.id ?? null;
}

export async function handleAttendance(
  request: Request, env: Env, ctx: AppContext, subPath: string
): Promise<Response> {
  const segments = subPath.split('/').filter(Boolean);
  const action = segments[0];

  // Ensure the table exists. Cheap no-op once created; avoids requiring a
  // separate migration step before this module can be deployed.
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS attendance_records (
      id              TEXT PRIMARY KEY,
      tenant_id       TEXT NOT NULL,
      employee_id     TEXT NOT NULL,
      date            TEXT NOT NULL,
      clocked_in_at   TEXT NOT NULL,
      clocked_out_at  TEXT,
      duration_mins   INTEGER,
      location_in     TEXT,
      location_out    TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(tenant_id, employee_id, date)
    )
  `).run();

  const employeeId = await getEmployeeId(env, ctx);
  if (!employeeId) return err('Employee record not found', 404);

  // GET /api/attendance/today
  if (action === 'today' && request.method === 'GET') {
    const record = await env.DB.prepare(
      `SELECT * FROM attendance_records WHERE tenant_id = ? AND employee_id = ? AND date = ?`
    ).bind(ctx.tenantId, employeeId, todayDateStr()).first();

    return ok(record ?? null);
  }

  // GET /api/attendance/week — last 7 calendar days, most recent first
  if (action === 'week' && request.method === 'GET') {
    const rows = await env.DB.prepare(`
      SELECT * FROM attendance_records
      WHERE tenant_id = ? AND employee_id = ? AND date >= date('now', '-6 days')
      ORDER BY date DESC
    `).bind(ctx.tenantId, employeeId).all();

    return ok(rows.results);
  }

  // POST /api/attendance/clock-in
  if (action === 'clock-in' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const parsed = ClockActionSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.issues[0].message);

    const date = todayDateStr();
    const existing = await env.DB.prepare(
      `SELECT id FROM attendance_records WHERE tenant_id = ? AND employee_id = ? AND date = ?`
    ).bind(ctx.tenantId, employeeId, date).first() as any;

    if (existing) return err('Already clocked in today', 409);

    const id = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO attendance_records (id, tenant_id, employee_id, date, clocked_in_at, location_in)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
    `).bind(id, ctx.tenantId, employeeId, date, parsed.data.location ?? null).run();

    await audit(env, {
      ...auditFromRequest(request, ctx),
      action: 'create', resource: 'attendance', resourceId: id,
      metadata: { type: 'clock-in', location: parsed.data.location },
    });

    const record = await env.DB.prepare(
      `SELECT * FROM attendance_records WHERE id = ?`
    ).bind(id).first();
    return ok(record);
  }

  // POST /api/attendance/clock-out
  if (action === 'clock-out' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const parsed = ClockActionSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.issues[0].message);

    const date = todayDateStr();
    const existing = await env.DB.prepare(
      `SELECT * FROM attendance_records WHERE tenant_id = ? AND employee_id = ? AND date = ?`
    ).bind(ctx.tenantId, employeeId, date).first() as any;

    if (!existing) return err('Not clocked in today', 409);
    if (existing.clocked_out_at) return err('Already clocked out today', 409);

    const durationMins = Math.round(
      (Date.now() - new Date(existing.clocked_in_at).getTime()) / 60000
    );

    await env.DB.prepare(`
      UPDATE attendance_records
      SET clocked_out_at = CURRENT_TIMESTAMP, duration_mins = ?, location_out = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(durationMins, parsed.data.location ?? null, existing.id).run();

    await audit(env, {
      ...auditFromRequest(request, ctx),
      action: 'update', resource: 'attendance', resourceId: existing.id,
      metadata: { type: 'clock-out', location: parsed.data.location, durationMins },
    });

    const record = await env.DB.prepare(
      `SELECT * FROM attendance_records WHERE id = ?`
    ).bind(existing.id).first();
    return ok(record);
  }

  return notFound();
}

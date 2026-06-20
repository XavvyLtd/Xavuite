import { z } from 'zod';
import { ok, created, err, notFound, forbidden } from '../../core/response';
import { requirePermission, hasPermission } from '../../middleware/auth';
import { audit, auditFromRequest } from '../../middleware/audit';
import { sendMail, leaveRequestEmail, leaveDecisionEmail } from '../../core/email';
import type { Env, AppContext } from '../../types';
import { startWorkflow } from '../../platform/workflow/engine';

const CreateLeaveSchema = z.object({
  leaveType:  z.enum(['annual','sick','maternity','paternity','unpaid','compassionate','other']),
  startDate:  z.string().date(),
  endDate:    z.string().date(),
  reason:     z.string().min(1).max(500),
  halfDay:    z.boolean().default(false),
});

const DecisionSchema = z.object({
  decision: z.enum(['approved', 'declined']),
  comment:  z.string().max(500).optional(),
});

function workingDays(start: string, end: string): number {
  const s = new Date(start), e = new Date(end);
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export async function handleLeave(
  request: Request, env: Env, ctx: AppContext, subPath: string
): Promise<Response> {
  const segments = subPath.split('/').filter(Boolean);
  const id = segments[0];
  const action = segments[1];

  // GET /api/leave
  if (!id && request.method === 'GET') {
    const denied = requirePermission(ctx, 'leave:view:leave_request');
    if (denied) return denied;

    const url = new URL(request.url);
    const status     = url.searchParams.get('status');
    const employeeId = url.searchParams.get('employeeId');
    const mine       = url.searchParams.get('mine') === 'true';

    let where = 'lr.tenant_id = ?';
    const params: unknown[] = [ctx.tenantId];

    // Non-managers only see their own requests
    if (mine || !hasPermission(ctx, 'leave:approve:leave_request')) {
      where += ' AND lr.employee_id = (SELECT id FROM employees WHERE user_id = ? AND tenant_id = ?)';
      params.push(ctx.userId, ctx.tenantId);
    } else if (employeeId) {
      where += ' AND lr.employee_id = ?';
      params.push(employeeId);
    }

    if (status) { where += ' AND lr.status = ?'; params.push(status); }

    const rows = await env.DB.prepare(`
      SELECT lr.*,
             eh.first_name || ' ' || eh.last_name AS employee_name,
             u.email AS employee_email
      FROM leave_requests lr
      JOIN employees e ON e.id = lr.employee_id
      JOIN employee_history eh ON eh.employee_id = e.id AND eh.is_current = 1
      JOIN users u ON u.id = e.user_id
      WHERE ${where}
      ORDER BY lr.created_at DESC
      LIMIT 100
    `).bind(...params).all();

    return ok(rows.results);
  }

  // POST /api/leave
  if (!id && request.method === 'POST') {
    const denied = requirePermission(ctx, 'leave:create:leave_request');
    if (denied) return denied;

    const body = await request.json().catch(() => null);
    const parsed = CreateLeaveSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.issues[0].message);

    const d = parsed.data;
    if (new Date(d.endDate) < new Date(d.startDate)) return err('End date must be after start date');

    const employee = await env.DB.prepare(
      `SELECT id FROM employees WHERE user_id = ? AND tenant_id = ?`
    ).bind(ctx.userId, ctx.tenantId).first() as any;
    if (!employee) return err('Employee record not found', 404);

    const days = workingDays(d.startDate, d.endDate);
    const leaveId = crypto.randomUUID();

    await env.DB.prepare(`
      INSERT INTO leave_requests (id, tenant_id, employee_id, leave_type, start_date, end_date, days, reason, half_day, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)
    `).bind(leaveId, ctx.tenantId, employee.id, d.leaveType, d.startDate, d.endDate, days, d.reason, d.halfDay ? 1 : 0).run();

    // Notify manager
    const manager = await env.DB.prepare(`
      SELECT eh.first_name || ' ' || eh.last_name AS name, u.email
      FROM reporting_hierarchy rh
      JOIN employees e ON e.id = rh.manager_id
      JOIN employee_history eh ON eh.employee_id = e.id AND eh.is_current = 1
      JOIN users u ON u.id = e.user_id
      WHERE rh.employee_id = ? AND rh.is_direct = 1
    `).bind(employee.id).first() as any;

    const empName = await env.DB.prepare(
      `SELECT eh.first_name || ' ' || eh.last_name AS name
       FROM employee_history eh WHERE eh.employee_id = ? AND eh.is_current = 1`
    ).bind(employee.id).first() as any;

    if (manager?.email) {
      await sendMail(env, {
        to: manager.email,
        subject: `Leave Request: ${empName?.name ?? 'Employee'} — ${d.leaveType} leave`,
        html: leaveRequestEmail({
          managerName:  manager.name,
          employeeName: empName?.name ?? 'Employee',
          leaveType:    d.leaveType,
          startDate:    d.startDate,
          endDate:      d.endDate,
          days,
          reason:       d.reason,
          approvalUrl:  `https://${env.TENANT_DOMAIN}/leave/${leaveId}`,
        }),
      });
    }

    // Start approval workflow
    await startWorkflow(env, {
      definitionKey: 'leave_approval',
      recordType:    'leave_request',
      recordId:      leaveId,
      submittedBy:   ctx.userId!,
      tenantId:      ctx.tenantId,
      recordData:    { days },
    });

    await audit(env, {
      ...auditFromRequest(request, ctx),
      action: 'create', resource: 'leave_request', resourceId: leaveId,
    });

    return created({ id: leaveId, days });
  }

  // GET /api/leave/:id
  if (id && !action && request.method === 'GET') {
    const denied = requirePermission(ctx, 'leave:view:leave_request');
    if (denied) return denied;

    const row = await env.DB.prepare(`
      SELECT lr.*,
             eh.first_name || ' ' || eh.last_name AS employee_name
      FROM leave_requests lr
      JOIN employees e ON e.id = lr.employee_id
      JOIN employee_history eh ON eh.employee_id = e.id AND eh.is_current = 1
      WHERE lr.id = ? AND lr.tenant_id = ?
    `).bind(id, ctx.tenantId).first();

    if (!row) return notFound('Leave request not found');
    return ok(row);
  }

  // POST /api/leave/:id/decision
  if (id && action === 'decision' && request.method === 'POST') {
    const denied = requirePermission(ctx, 'leave:approve:leave_request');
    if (denied) return denied;

    const body = await request.json().catch(() => null);
    const parsed = DecisionSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.issues[0].message);

    const { decision, comment } = parsed.data;

    const leave = await env.DB.prepare(
      `SELECT * FROM leave_requests WHERE id = ? AND tenant_id = ?`
    ).bind(id, ctx.tenantId).first() as any;
    if (!leave) return notFound('Leave request not found');
    if (leave.status !== 'pending') return err('Leave request is no longer pending');

    await env.DB.prepare(
      `UPDATE leave_requests SET status = ?, decided_by = ?, decided_at = CURRENT_TIMESTAMP, comment = ? WHERE id = ?`
    ).bind(decision === 'approved' ? 'approved' : 'declined', ctx.userId, comment ?? null, id).run();

    // Notify employee
    const empEmail = await env.DB.prepare(
      `SELECT u.email, eh.first_name || ' ' || eh.last_name AS name
       FROM employees e JOIN users u ON u.id = e.user_id
       JOIN employee_history eh ON eh.employee_id = e.id AND eh.is_current = 1
       WHERE e.id = ?`
    ).bind(leave.employee_id).first() as any;

    if (empEmail?.email) {
      await sendMail(env, {
        to: empEmail.email,
        subject: `Leave Request ${decision === 'approved' ? 'Approved' : 'Declined'}`,
        html: leaveDecisionEmail({
          employeeName: empEmail.name,
          decision,
          leaveType:    leave.leave_type,
          startDate:    leave.start_date,
          endDate:      leave.end_date,
          comment,
        }),
      });
    }

    await audit(env, {
      ...auditFromRequest(request, ctx),
      action: decision === 'approved' ? 'approve' : 'reject',
      resource: 'leave_request', resourceId: id,
    });

    return ok({ id, status: decision });
  }

  return err('Not found', 404);
}

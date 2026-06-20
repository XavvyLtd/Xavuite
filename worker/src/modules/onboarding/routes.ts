import { z } from 'zod';
import { ok, created, err, notFound } from '../../core/response';
import { audit, auditFromRequest } from '../../middleware/audit';
import type { Env, AppContext } from '../../types';

export async function handleOnboarding(
  request: Request, env: Env, ctx: AppContext, subPath: string
): Promise<Response> {
  const [id, resource, taskId, action] = subPath.split('/').filter(Boolean);

  // GET /api/onboarding — list all onboarding records
  if (!id && request.method === 'GET') {
    const rows = await env.DB.prepare(`
      SELECT eo.*,
             eh.first_name, eh.last_name,
             (SELECT COUNT(*) FROM onboarding_tasks ot WHERE ot.onboarding_id = eo.id) as task_count,
             (SELECT COUNT(*) FROM onboarding_tasks ot WHERE ot.onboarding_id = eo.id AND ot.status = 'completed') as completed_count
      FROM employee_onboarding eo
      JOIN employee_history eh ON eh.employee_id = eo.employee_id AND eh.is_current = 1
      WHERE eo.tenant_id = ?
      ORDER BY eo.created_at DESC
    `).bind(ctx.tenantId).all();

    // Calculate completion_pct for each
    const items = rows.results.map((r: any) => ({
      ...r,
      completion_pct: r.task_count > 0 ? Math.round(r.completed_count / r.task_count * 100) : 0,
    }));

    return ok(items);
  }

  // POST /api/onboarding — start onboarding for an employee
  if (!id && request.method === 'POST') {
    const body = await request.json().catch(() => null) as any;
    if (!body?.employeeId) return err('employeeId is required');

    const existing = await env.DB.prepare(
      `SELECT id FROM employee_onboarding WHERE employee_id = ? AND tenant_id = ? AND status != 'completed'`
    ).bind(body.employeeId, ctx.tenantId).first();
    if (existing) return err('Active onboarding already exists for this employee', 409);

    const onboardingId = crypto.randomUUID();

    await env.DB.prepare(`
      INSERT INTO employee_onboarding (id, tenant_id, employee_id, template_id, start_date, probation_end_date, status, created_by)
      VALUES (?, ?, ?, 'tmpl-default', ?, ?, 'in_progress', ?)
    `).bind(onboardingId, ctx.tenantId, body.employeeId, body.startDate, body.probationEndDate || null, ctx.userId).run();

    // Clone tasks from default template
    const templateTasks = await env.DB.prepare(`
      SELECT * FROM onboarding_template_tasks WHERE template_id = 'tmpl-default' AND tenant_id = ? ORDER BY task_order
    `).bind(ctx.tenantId).all() as any;

    if (templateTasks.results.length > 0) {
      const stmts = templateTasks.results.map((t: any) => {
        const dueDate = body.startDate
          ? new Date(new Date(body.startDate).getTime() + t.due_days * 86400000).toISOString().split('T')[0]
          : null;
        return env.DB.prepare(`
          INSERT INTO onboarding_tasks (id, onboarding_id, template_task_id, tenant_id, employee_id, category, title, description, owner, due_date, status, task_order)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
        `).bind(crypto.randomUUID(), onboardingId, t.id, ctx.tenantId, body.employeeId, t.category, t.title, t.description || null, t.owner, dueDate, t.task_order);
      });
      await env.DB.batch(stmts);
    }

    await audit(env, { ...auditFromRequest(request, ctx), action: 'create', resource: 'onboarding', resourceId: onboardingId });
    return created({ id: onboardingId });
  }

  // GET /api/onboarding/:id — detail with tasks
  if (id && !resource && request.method === 'GET') {
    const record = await env.DB.prepare(`
      SELECT eo.*, eh.first_name, eh.last_name
      FROM employee_onboarding eo
      JOIN employee_history eh ON eh.employee_id = eo.employee_id AND eh.is_current = 1
      WHERE eo.id = ? AND eo.tenant_id = ?
    `).bind(id, ctx.tenantId).first() as any;
    if (!record) return notFound('Onboarding record not found');

    const tasks = await env.DB.prepare(`
      SELECT ot.*,
             ae.first_name || ' ' || ae.last_name AS assigned_to_name,
             cb.email AS completed_by_email
      FROM onboarding_tasks ot
      LEFT JOIN employees ae ON ae.id = ot.assigned_to
      LEFT JOIN users cb ON cb.id = ot.completed_by
      WHERE ot.onboarding_id = ? AND ot.tenant_id = ?
      ORDER BY ot.task_order
    `).bind(id, ctx.tenantId).all();

    const taskList = tasks.results as any[];
    const total    = taskList.length;
    const done     = taskList.filter(t => t.status === 'completed').length;

    return ok({ ...record, tasks: taskList, task_count: total, completed_count: done, completion_pct: total > 0 ? Math.round(done / total * 100) : 0 });
  }

  // POST /api/onboarding/:id/tasks/:taskId/complete
  if (id && resource === 'tasks' && taskId && action === 'complete' && request.method === 'POST') {
    await env.DB.prepare(`
      UPDATE onboarding_tasks SET status = 'completed', completed_at = CURRENT_TIMESTAMP, completed_by = ? WHERE id = ? AND onboarding_id = ? AND tenant_id = ?
    `).bind(ctx.userId, taskId, id, ctx.tenantId).run();

    // Recalculate completion percentage
    const counts = await env.DB.prepare(`
      SELECT COUNT(*) as total, SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as done
      FROM onboarding_tasks WHERE onboarding_id = ? AND tenant_id = ?
    `).bind(id, ctx.tenantId).first() as any;

    const pct = counts.total > 0 ? Math.round(counts.done / counts.total * 100) : 0;
    const newStatus = pct === 100 ? 'completed' : 'in_progress';

    await env.DB.prepare(`
      UPDATE employee_onboarding SET completion_pct = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      ${pct === 100 ? ', completed_at = CURRENT_TIMESTAMP' : ''}
      WHERE id = ? AND tenant_id = ?
    `).bind(pct, newStatus, id, ctx.tenantId).run();

    return ok({ taskId, completed: true, overallPct: pct });
  }

  // PATCH /api/onboarding/:id/probation — update probation outcome
  if (id && resource === 'probation' && request.method === 'PATCH') {
    const { status, notes } = await request.json() as any;
    if (!['passed','extended','failed'].includes(status)) return err('Invalid probation status');
    await env.DB.prepare(`
      UPDATE employee_onboarding SET probation_status = ?, probation_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?
    `).bind(status, notes || null, id, ctx.tenantId).run();
    return ok({ id, probation_status: status });
  }

  return err('Not found', 404);
}

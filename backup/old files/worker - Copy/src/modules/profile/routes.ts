import { ok, created, err, notFound } from '../../core/response';
import { audit, auditFromRequest } from '../../middleware/audit';
import type { Env, AppContext } from '../../types';

// ── Employee profile routes ───────────────────────────────────────────────────
export async function handleEmployeeProfile(
  request: Request, env: Env, ctx: AppContext, subPath: string
): Promise<Response> {
  const parts = subPath.split('/').filter(Boolean);
  // /api/employees/:id/emergency-contacts
  // /api/employees/:id/compensation
  const [employeeId, resource] = parts;

  // Emergency contacts
  if (resource === 'emergency-contacts') {
    if (request.method === 'GET') {
      const rows = await env.DB.prepare(
        `SELECT id, employee_id, tenant_id, full_name AS name, relationship, phone_primary AS phone, phone_secondary, email, is_primary FROM employee_emergency_contacts WHERE employee_id=? AND tenant_id=? ORDER BY is_primary DESC`
      ).bind(employeeId, ctx.tenantId).all();
      return ok(rows.results);
    }
    if (request.method === 'POST') {
      const body = await request.json() as any;
      if (!body.name || !body.phone || !body.relationship) return err('Name, phone and relationship are required');
    const fullName = body.name ?? body.fullName ?? '';
      const id = crypto.randomUUID();
      if (body.is_primary) {
        await env.DB.prepare(`UPDATE employee_emergency_contacts SET is_primary=0 WHERE employee_id=? AND tenant_id=?`).bind(employeeId, ctx.tenantId).run();
      }
      await env.DB.prepare(`
        INSERT INTO employee_emergency_contacts (id,employee_id,tenant_id,full_name,relationship,phone_primary,email,is_primary)
        VALUES (?,?,?,?,?,?,?,?)
      `).bind(id, employeeId, ctx.tenantId, body.name, body.relationship, body.phone, body.email??null, body.is_primary?1:0).run();
      return created({ id });
    }
  }

  // Compensation history
  if (resource === 'compensation') {
    if (request.method === 'GET') {
      const rows = await env.DB.prepare(`
        SELECT ec.id, ec.employee_id, ec.tenant_id,
               ec.effective_from, ec.base_salary AS salary, ec.currency,
               ec.pay_frequency, ec.pay_type, ec.change_reason,
               ec.is_current, u.email as created_by_email
        FROM employee_compensation ec
        LEFT JOIN users u ON u.id=ec.changed_by
        WHERE ec.employee_id=? AND ec.tenant_id=?
        ORDER BY ec.effective_from DESC
      `).bind(employeeId, ctx.tenantId).all();
      return ok(rows.results);
    }
    if (request.method === 'POST') {
      const body = await request.json() as any;
      if (!body.salary || !body.effectiveFrom) return err('Salary and effective date required');

      // Calculate change_pct from previous salary
      const prev = await env.DB.prepare(`
        SELECT base_salary AS salary FROM employee_compensation WHERE employee_id=? AND tenant_id=? ORDER BY effective_from DESC LIMIT 1
      `).bind(employeeId, ctx.tenantId).first() as any;
      const changePct = prev?.salary ? Math.round(((body.salary - prev.salary) / prev.salary) * 100) : null;

      const id = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT INTO employee_compensation (id,employee_id,tenant_id,effective_from,base_salary,currency,pay_frequency,pay_type,change_reason,is_current,changed_by)
        VALUES (?,?,?,?,?,?,?,?,?,1,?)
      `).bind(id, employeeId, ctx.tenantId, body.effectiveFrom, body.salary, body.currency??'GBP', body.payFrequency??'annual', body.payType??'salary', body.changeReason??null, ctx.userId).run();
    // Mark previous as not current
    await env.DB.prepare(`UPDATE employee_compensation SET is_current=0, effective_to=? WHERE employee_id=? AND tenant_id=? AND id!=?`).bind(body.effectiveFrom, employeeId, ctx.tenantId, id).run();

      await audit(env, { ...auditFromRequest(request, ctx), action:'create', resource:'compensation', resourceId:id });
      return created({ id, changePct });
    }
  }

  return err('Not found', 404);
}

// ── Checklists routes ─────────────────────────────────────────────────────────
export async function handleChecklists(
  request: Request, env: Env, ctx: AppContext, subPath: string
): Promise<Response> {
  const [resource, id, action, taskId, actionVerb] = subPath.split('/').filter(Boolean);

  // GET /api/checklists/templates
  if (resource === 'templates' && !id && request.method === 'GET') {
    const rows = await env.DB.prepare(`
      SELECT t.*,
        (SELECT COUNT(*) FROM checklist_template_tasks WHERE template_id=t.id) as task_count
      FROM checklist_templates t
      WHERE t.tenant_id=? AND t.enabled=1 ORDER BY t.category, t.name
    `).bind(ctx.tenantId).all();
    return ok(rows.results);
  }

  // GET /api/checklists/runs
  if (resource === 'runs' && !id && request.method === 'GET') {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    let where = 'r.tenant_id=?';
    const params: unknown[] = [ctx.tenantId];
    if (status) { where += ' AND r.status=?'; params.push(status); }

    const rows = await env.DB.prepare(`
      SELECT r.*, t.name as template_name, t.category,
             eh.first_name||' '||eh.last_name as assigned_to_name
      FROM checklist_runs r
      JOIN checklist_templates t ON t.id=r.template_id
      LEFT JOIN employees e ON e.id=r.assigned_to
      LEFT JOIN employee_history eh ON eh.employee_id=e.id AND eh.is_current=1
      WHERE ${where}
      ORDER BY r.created_at DESC LIMIT 100
    `).bind(...params).all();
    return ok(rows.results);
  }

  // POST /api/checklists/runs — start a new checklist run
  if (resource === 'runs' && !id && request.method === 'POST') {
    const body = await request.json() as any;
    if (!body.templateId) return err('templateId is required');

    const template = await env.DB.prepare(
      `SELECT * FROM checklist_templates WHERE id=? AND tenant_id=?`
    ).bind(body.templateId, ctx.tenantId).first() as any;
    if (!template) return notFound('Template not found');

    const runId = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO checklist_runs (id,tenant_id,template_id,title,status,due_date,assigned_to,created_by)
      VALUES (?,?,?,?,  'in_progress',?,?,?)
    `).bind(runId, ctx.tenantId, body.templateId, body.title ?? template.name, body.dueDate??null, body.assignedTo??null, ctx.userId).run();

    // Clone tasks from template
    const tasks = await env.DB.prepare(
      `SELECT * FROM checklist_template_tasks WHERE template_id=? ORDER BY task_order`
    ).bind(body.templateId).all() as any;

    if (tasks.results.length > 0) {
      await env.DB.batch(tasks.results.map((t: any) =>
        env.DB.prepare(`INSERT INTO checklist_run_tasks (id,run_id,tenant_id,title,description,required,status,task_order) VALUES (?,?,?,?,?,?,'pending',?)`)
          .bind(crypto.randomUUID(), runId, ctx.tenantId, t.title, t.description??null, t.required, t.task_order)
      ));
    }

    await audit(env, { ...auditFromRequest(request, ctx), action:'create', resource:'checklist_run', resourceId:runId });
    return created({ id: runId });
  }

  // GET /api/checklists/runs/:id
  if (resource === 'runs' && id && !action && request.method === 'GET') {
    const run = await env.DB.prepare(`
      SELECT r.*, t.name as template_name, t.category
      FROM checklist_runs r JOIN checklist_templates t ON t.id=r.template_id
      WHERE r.id=? AND r.tenant_id=?
    `).bind(id, ctx.tenantId).first();
    if (!run) return notFound('Checklist run not found');

    const tasks = await env.DB.prepare(
      `SELECT * FROM checklist_run_tasks WHERE run_id=? ORDER BY task_order`
    ).bind(id).all();

    return ok({ ...run, tasks: tasks.results });
  }

  // POST /api/checklists/runs/:id/tasks/:taskId/complete
  if (resource === 'runs' && id && action === 'tasks' && taskId && actionVerb === 'complete' && request.method === 'POST') {
    const body = await request.json().catch(() => ({})) as any;
    await env.DB.prepare(`
      UPDATE checklist_run_tasks SET status='completed', completed_at=CURRENT_TIMESTAMP, completed_by=?, notes=? WHERE id=? AND run_id=? AND tenant_id=?
    `).bind(ctx.userId, body.notes??null, taskId, id, ctx.tenantId).run();

    // Recalculate completion
    const counts = await env.DB.prepare(`
      SELECT COUNT(*) as total, SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as done
      FROM checklist_run_tasks WHERE run_id=? AND tenant_id=?
    `).bind(id, ctx.tenantId).first() as any;

    const pct = counts.total > 0 ? Math.round(counts.done / counts.total * 100) : 0;
    const status = pct === 100 ? 'completed' : 'in_progress';

    await env.DB.prepare(`
      UPDATE checklist_runs SET completion_pct=?, status=?${pct===100?', completed_at=CURRENT_TIMESTAMP':''} WHERE id=? AND tenant_id=?
    `).bind(pct, status, id, ctx.tenantId).run();

    return ok({ taskId, completed: true, overallPct: pct });
  }

  // PATCH /api/checklists/runs/:id/tasks/:taskId — skip or mark N/A
  if (resource === 'runs' && id && action === 'tasks' && taskId && !actionVerb && request.method === 'PATCH') {
    const { status, notes } = await request.json() as any;
    await env.DB.prepare(`UPDATE checklist_run_tasks SET status=?, notes=? WHERE id=? AND run_id=? AND tenant_id=?`).bind(status, notes??null, taskId, id, ctx.tenantId).run();
    return ok({ taskId, status });
  }

  return err('Not found', 404);
}

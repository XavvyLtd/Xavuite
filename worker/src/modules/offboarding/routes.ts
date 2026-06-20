import { ok, created, err, notFound } from '../../core/response';
import { audit, auditFromRequest } from '../../middleware/audit';
import type { Env, AppContext } from '../../types';

const DEFAULT_TASKS = [
  { category:'hr',        title:'Acknowledge resignation / issue termination letter', owner:'hr',       due_days:0,  task_order:1 },
  { category:'hr',        title:'Conduct exit interview',                              owner:'hr',       due_days:-7, task_order:2 },
  { category:'hr',        title:'Calculate final pay & holiday balance',               owner:'hr',       due_days:-3, task_order:3 },
  { category:'hr',        title:'Update employee record & status',                     owner:'hr',       due_days:0,  task_order:4 },
  { category:'manager',   title:'Handover documentation completed',                    owner:'manager',  due_days:-5, task_order:5 },
  { category:'manager',   title:'Reassign open tasks and responsibilities',             owner:'manager',  due_days:-3, task_order:6 },
  { category:'it',        title:'Revoke system access and logins',                     owner:'it',       due_days:0,  task_order:7 },
  { category:'it',        title:'Retrieve laptop and equipment',                       owner:'it',       due_days:0,  task_order:8 },
  { category:'it',        title:'Disable email account (set auto-reply)',              owner:'it',       due_days:0,  task_order:9 },
  { category:'it',        title:'Remove from all systems, Slack, cloud services',      owner:'it',       due_days:0,  task_order:10 },
  { category:'finance',   title:'Process final payroll',                               owner:'finance',  due_days:0,  task_order:11 },
  { category:'finance',   title:'Issue P45',                                           owner:'finance',  due_days:3,  task_order:12 },
  { category:'facilities','title':'Collect access card / fob',                         owner:'hr',       due_days:0,  task_order:13 },
  { category:'legal',     title:'Confirm non-compete / NDA obligations',               owner:'hr',       due_days:0,  task_order:14 },
  { category:'hr',        title:'Archive employee file',                               owner:'hr',       due_days:3,  task_order:15 },
];

function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export async function handleOffboarding(
  request: Request, env: Env, ctx: AppContext, subPath: string
): Promise<Response> {
  const [id, resource, taskId, action] = subPath.split('/').filter(Boolean);

  // GET /api/offboarding
  if (!id && request.method === 'GET') {
    const rows = await env.DB.prepare(`
      SELECT o.*,
             eh.first_name||' '||eh.last_name AS employee_name,
             (SELECT COUNT(*) FROM offboarding_tasks t WHERE t.offboarding_id=o.id) AS task_count,
             (SELECT COUNT(*) FROM offboarding_tasks t WHERE t.offboarding_id=o.id AND t.status='completed') AS completed_count
      FROM offboarding_records o
      JOIN employee_history eh ON eh.employee_id=o.employee_id AND eh.is_current=1
      WHERE o.tenant_id=? ORDER BY o.created_at DESC
    `).bind(ctx.tenantId).all();
    return ok(rows.results);
  }

  // POST /api/offboarding — start offboarding
  if (!id && request.method === 'POST') {
    const body = await request.json() as any;
    if (!body.employeeId || !body.lastWorkingDay || !body.reason) {
      return err('employeeId, lastWorkingDay and reason are required');
    }

    const existing = await env.DB.prepare(
      `SELECT id FROM offboarding_records WHERE employee_id=? AND tenant_id=? AND status='in_progress'`
    ).bind(body.employeeId, ctx.tenantId).first();
    if (existing) return err('Active offboarding already exists for this employee', 409);

    const offId = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO offboarding_records (id,tenant_id,employee_id,reason,last_working_day,notice_given_date,status,notes,created_by)
      VALUES (?,?,?,?,?,?,  'in_progress',?,?)
    `).bind(offId, ctx.tenantId, body.employeeId, body.reason, body.lastWorkingDay, body.noticeGivenDate??null, body.notes??null, ctx.userId).run();

    // Create default tasks
    const stmts = DEFAULT_TASKS.map(t => {
      const dueDate = addDays(body.lastWorkingDay, t.due_days);
      return env.DB.prepare(`
        INSERT INTO offboarding_tasks (id,offboarding_id,tenant_id,category,title,description,owner,due_date,status,task_order)
        VALUES (?,?,?,?,?,NULL,?,?,'pending',?)
      `).bind(crypto.randomUUID(), offId, ctx.tenantId, t.category, t.title, t.owner, dueDate, t.task_order);
    });
    await env.DB.batch(stmts);

    // Mark employee as leaving
    await env.DB.prepare(
      `UPDATE employees SET status='leaving' WHERE id=? AND tenant_id=?`
    ).bind(body.employeeId, ctx.tenantId).run();

    await audit(env, { ...auditFromRequest(request, ctx), action:'create', resource:'offboarding', resourceId:offId });
    return created({ id: offId });
  }

  // GET /api/offboarding/:id
  if (id && !resource && request.method === 'GET') {
    const record = await env.DB.prepare(`
      SELECT o.*, eh.first_name||' '||eh.last_name AS employee_name, u.email AS employee_email
      FROM offboarding_records o
      JOIN employee_history eh ON eh.employee_id=o.employee_id AND eh.is_current=1
      JOIN employees e ON e.id=o.employee_id
      JOIN users u ON u.id=e.user_id
      WHERE o.id=? AND o.tenant_id=?
    `).bind(id, ctx.tenantId).first();
    if (!record) return notFound('Offboarding record not found');

    const tasks = await env.DB.prepare(`
      SELECT * FROM offboarding_tasks WHERE offboarding_id=? ORDER BY task_order
    `).bind(id).all();

    const total = (tasks.results as any[]).length;
    const done  = (tasks.results as any[]).filter((t:any) => t.status==='completed').length;
    const pct   = total > 0 ? Math.round(done/total*100) : 0;

    return ok({ ...record, tasks: tasks.results, completion_pct: pct });
  }

  // POST /api/offboarding/:id/tasks/:taskId/complete
  if (id && resource==='tasks' && taskId && action==='complete' && request.method==='POST') {
    await env.DB.prepare(`
      UPDATE offboarding_tasks SET status='completed', completed_at=CURRENT_TIMESTAMP, completed_by=?
      WHERE id=? AND offboarding_id=? AND tenant_id=?
    `).bind(ctx.userId, taskId, id, ctx.tenantId).run();

    // Recalculate
    const counts = await env.DB.prepare(`
      SELECT COUNT(*) as total, SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as done
      FROM offboarding_tasks WHERE offboarding_id=? AND tenant_id=?
    `).bind(id, ctx.tenantId).first() as any;

    const pct    = counts.total > 0 ? Math.round(counts.done/counts.total*100) : 0;
    const status = pct===100 ? 'completed' : 'in_progress';

    await env.DB.prepare(`
      UPDATE offboarding_records SET completion_pct=?, status=?${pct===100?', completed_at=CURRENT_TIMESTAMP':''} WHERE id=? AND tenant_id=?
    `).bind(pct, status, id, ctx.tenantId).run();

    if (pct===100) {
      // Mark employee as left
      const record = await env.DB.prepare(`SELECT employee_id FROM offboarding_records WHERE id=?`).bind(id).first() as any;
      if (record) {
        await env.DB.prepare(`UPDATE employees SET status='inactive' WHERE id=? AND tenant_id=?`).bind(record.employee_id, ctx.tenantId).run();
      }
    }

    return ok({ taskId, completed:true, overallPct:pct });
  }

  // PATCH /api/offboarding/:id/tasks/:taskId — skip/na
  if (id && resource==='tasks' && taskId && !action && request.method==='PATCH') {
    const { status } = await request.json() as any;
    await env.DB.prepare(`UPDATE offboarding_tasks SET status=? WHERE id=? AND offboarding_id=? AND tenant_id=?`).bind(status, taskId, id, ctx.tenantId).run();
    return ok({ taskId, status });
  }

  return err('Not found', 404);
}

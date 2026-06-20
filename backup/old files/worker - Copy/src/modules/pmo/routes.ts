// modules/pmo/routes.ts
// XavvySuite PMO — Projects, Tasks, Sprints, Allocations
// Replaces handlePMO in modules.ts

import { z }                          from 'zod';
import { ok, created, err, notFound } from '../../core/response';
import { requirePermission }          from '../../middleware/auth';
import { audit, auditFromRequest }    from '../../middleware/audit';
import type { Env, AppContext }       from '../../types';

// ── Schemas ───────────────────────────────────────────────────
const ProjectSchema = z.object({
  name:        z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  clientId:    z.string().optional(),           // FK → clients.id
  clientName:  z.string().optional(),           // fallback free-text
  projectType: z.enum(['iot','data_migration','platform','support','training','general']).default('general'),
  colour:      z.string().optional(),
  startDate:   z.string().date().optional(),
  endDate:     z.string().date().optional(),
  budget:      z.number().min(0).optional(),
  priority:    z.enum(['low','medium','high','critical']).default('medium'),
  status:      z.enum(['planning','active','on_hold','completed','cancelled']).default('planning'),
});

const TaskSchema = z.object({
  projectId:      z.string(),
  sprintId:       z.string().optional(),
  name:           z.string().min(1).max(200),
  description:    z.string().optional(),
  assigneeId:     z.string().optional(),
  priority:       z.enum(['low','medium','high','critical']).default('medium'),
  status:         z.enum(['backlog','todo','in_progress','review','done']).default('backlog'),
  estimatedHours: z.number().min(0).optional(),
  dueDate:        z.string().date().optional(),
  phase:          z.string().optional(),
  category:       z.string().optional(),
});

const AllocationSchema = z.object({
  employeeId:   z.string(),
  role:         z.string().optional(),
  allocation:   z.number().min(0).max(100).default(50),
  hoursPerWeek: z.number().min(0).max(40).optional(),
  startDate:    z.string().date().optional(),
  endDate:      z.string().date().optional(),
  notes:        z.string().optional(),
});

// ── Main handler ──────────────────────────────────────────────
export async function handlePMO(
  request: Request, env: Env, ctx: AppContext, subPath: string
): Promise<Response> {
  const segments              = subPath.split('/').filter(Boolean);
  const [resource, id, action] = segments;
  const method                = request.method;
  const url                   = new URL(request.url);

  // ── PROJECTS ─────────────────────────────────────────────────
  if (resource === 'projects') {

    // GET /api/pmo/projects
    if (!id && method === 'GET') {
      const clientId = url.searchParams.get('clientId');
      const status   = url.searchParams.get('status');
      const type     = url.searchParams.get('type');

      const where: string[] = ['p.tenant_id = ?'];
      const params: unknown[] = [ctx.tenantId];
      if (clientId) { where.push('p.client_id = ?');      params.push(clientId); }
      if (status)   { where.push('p.status = ?');         params.push(status); }
      if (type)     { where.push('p.project_type = ?');   params.push(type); }

      const rows = await env.DB.prepare(`
        SELECT p.*,
               c.company_name           AS client_company_name,
               COUNT(DISTINCT pt.id)    AS task_count,
               COUNT(DISTINCT pt.id) FILTER (WHERE pt.status != 'done') AS open_task_count,
               COUNT(DISTINCT pa.employee_id) AS team_size,
               ROUND(SUM(CASE WHEN pt.status='done' THEN pt.estimated_hours ELSE 0 END) * 100.0
                     / NULLIF(SUM(pt.estimated_hours),0), 0) AS completion_pct
        FROM pmo_projects p
        LEFT JOIN clients      c  ON c.id  = p.client_id
        LEFT JOIN pmo_tasks    pt ON pt.project_id = p.id
        LEFT JOIN pmo_allocations pa ON pa.project_id = p.id
        WHERE ${where.join(' AND ')}
        GROUP BY p.id
        ORDER BY
          CASE p.status WHEN 'active' THEN 0 WHEN 'planning' THEN 1 ELSE 2 END,
          p.created_at DESC
      `).bind(...params).all();
      return ok(rows.results);
    }

    // GET /api/pmo/projects/:id
    if (id && !action && method === 'GET') {
      const [project, tasks, allocations] = await Promise.all([
        env.DB.prepare(`
          SELECT p.*, c.company_name AS client_company_name, c.invoice_email AS client_email
          FROM pmo_projects p
          LEFT JOIN clients c ON c.id = p.client_id
          WHERE p.id = ? AND p.tenant_id = ?
        `).bind(id, ctx.tenantId).first(),

        env.DB.prepare(`
          SELECT t.*, eh.first_name||' '||eh.last_name AS assignee_name
          FROM pmo_tasks t
          LEFT JOIN employees e ON e.id = t.assignee_id
          LEFT JOIN employee_history eh ON eh.employee_id = e.id AND eh.is_current = 1
          WHERE t.project_id = ? AND t.tenant_id = ?
          ORDER BY t.phase, t.task_order ASC
        `).bind(id, ctx.tenantId).all(),

        env.DB.prepare(`
          SELECT pa.*, eh.first_name||' '||eh.last_name AS employee_name,
                 d.name AS department_name
          FROM pmo_allocations pa
          JOIN employees e ON e.id = pa.employee_id
          JOIN employee_history eh ON eh.employee_id = e.id AND eh.is_current = 1
          LEFT JOIN departments d ON d.id = eh.department_id
          WHERE pa.project_id = ? AND pa.tenant_id = ?
        `).bind(id, ctx.tenantId).all(),
      ]);
      if (!project) return notFound('Project not found');
      return ok({ ...project, tasks: tasks.results, allocations: allocations.results });
    }

    // POST /api/pmo/projects
    if (!id && method === 'POST') {
      const denied = requirePermission(ctx, 'pmo:create:project');
      if (denied) return denied;

      const body   = await request.json().catch(() => null);
      const parsed = ProjectSchema.safeParse(body);
      if (!parsed.success) return err(parsed.error.issues[0].message);

      const d      = parsed.data;
      const projId = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT INTO pmo_projects
          (id, tenant_id, name, description, client_id, client_name, project_type, colour,
           start_date, end_date, budget, priority, status, created_by, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
      `).bind(
        projId, ctx.tenantId,
        d.name, d.description ?? null,
        d.clientId   ?? null, d.clientName ?? null,
        d.projectType, d.colour ?? '#6366F1',
        d.startDate  ?? null, d.endDate ?? null,
        d.budget     ?? null, d.priority, d.status,
        ctx.userId
      ).run();

      await audit(env, { ...auditFromRequest(request, ctx), action: 'create', resource: 'project', resourceId: projId });
      return created({ id: projId });
    }

    // PUT /api/pmo/projects/:id
    if (id && !action && method === 'PUT') {
      const denied = requirePermission(ctx, 'pmo:edit:project');
      if (denied) return denied;

      const body   = await request.json().catch(() => null);
      const parsed = ProjectSchema.safeParse(body);
      if (!parsed.success) return err(parsed.error.issues[0].message);

      const d = parsed.data;
      await env.DB.prepare(`
        UPDATE pmo_projects SET
          name=?, description=?, client_id=?, client_name=?, project_type=?, colour=?,
          start_date=?, end_date=?, budget=?, priority=?, status=?
        WHERE id=? AND tenant_id=?
      `).bind(
        d.name, d.description ?? null, d.clientId ?? null, d.clientName ?? null,
        d.projectType, d.colour ?? '#6366F1',
        d.startDate ?? null, d.endDate ?? null, d.budget ?? null,
        d.priority, d.status, id, ctx.tenantId
      ).run();

      await audit(env, { ...auditFromRequest(request, ctx), action: 'update', resource: 'project', resourceId: id });
      return ok({ updated: true });
    }

    // GET /api/pmo/projects/:id/allocations
    if (id && action === 'allocations' && method === 'GET') {
      const rows = await env.DB.prepare(`
        SELECT pa.*,
               eh.first_name||' '||eh.last_name AS employee_name,
               eh.designation_id,
               des.title AS designation,
               d.name    AS department,
               -- Utilisation across ALL active projects this employee is on
               ROUND(COALESCE((
                 SELECT SUM(pa2.hours_per_week)
                 FROM pmo_allocations pa2
                 JOIN pmo_projects p2 ON p2.id = pa2.project_id
                 WHERE pa2.employee_id = pa.employee_id
                   AND pa2.tenant_id  = pa.tenant_id
                   AND p2.status IN ('active','planning')
               ),0) / 37.5 * 100, 0) AS total_utilisation_pct
        FROM pmo_allocations pa
        JOIN employees e ON e.id = pa.employee_id
        JOIN employee_history eh ON eh.employee_id = e.id AND eh.is_current = 1
        LEFT JOIN departments  d   ON d.id   = eh.department_id
        LEFT JOIN designations des ON des.id = eh.designation_id
        WHERE pa.project_id = ? AND pa.tenant_id = ?
        ORDER BY eh.first_name
      `).bind(id, ctx.tenantId).all();
      return ok(rows.results);
    }

    // POST /api/pmo/projects/:id/allocations
    if (id && action === 'allocations' && method === 'POST') {
      const denied = requirePermission(ctx, 'pmo:edit:project');
      if (denied) return denied;

      const body   = await request.json().catch(() => null);
      const parsed = AllocationSchema.safeParse(body);
      if (!parsed.success) return err(parsed.error.issues[0].message);

      const d   = parsed.data;
      const aid = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT INTO pmo_allocations
          (id, tenant_id, project_id, employee_id, role, allocation, hours_per_week, start_date, end_date, notes)
        VALUES (?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(project_id, employee_id) DO UPDATE SET
          role=excluded.role, allocation=excluded.allocation,
          hours_per_week=excluded.hours_per_week, notes=excluded.notes
      `).bind(
        aid, ctx.tenantId, id,
        d.employeeId, d.role ?? null,
        d.allocation, d.hoursPerWeek ?? (d.allocation / 100 * 37.5),
        d.startDate ?? null, d.endDate ?? null, d.notes ?? null
      ).run();
      return created({ id: aid });
    }

    // DELETE /api/pmo/projects/:projectId/allocations/:employeeId
    if (id && action === 'allocations' && segments[3] && method === 'DELETE') {
      const denied = requirePermission(ctx, 'pmo:edit:project');
      if (denied) return denied;
      await env.DB.prepare(
        `DELETE FROM pmo_allocations WHERE project_id=? AND employee_id=? AND tenant_id=?`
      ).bind(id, segments[3], ctx.tenantId).run();
      return ok({ deleted: true });
    }
  }

  // ── RESOURCE AVAILABILITY (for project create screen) ────────
  // GET /api/pmo/resources/available?startDate=&endDate=
  if (resource === 'resources' && id === 'available' && method === 'GET') {
    const startDate = url.searchParams.get('startDate') ?? new Date().toISOString().split('T')[0];
    const endDate   = url.searchParams.get('endDate')   ?? '';

    const rows = await env.DB.prepare(`
      SELECT
        e.id AS employee_id,
        eh.first_name||' '||eh.last_name AS employee_name,
        d.name    AS department,
        des.title AS designation,
        37.5      AS available_hours_per_week,
        -- Sum of hours_per_week across active/planning projects
        COALESCE((
          SELECT SUM(pa.hours_per_week)
          FROM pmo_allocations pa
          JOIN pmo_projects p ON p.id = pa.project_id
          WHERE pa.employee_id = e.id
            AND pa.tenant_id  = e.tenant_id
            AND p.status IN ('active','planning')
            AND (pa.end_date IS NULL OR pa.end_date >= ?)
        ), 0) AS booked_hours_per_week,
        -- Projects they're currently on
        COALESCE((
          SELECT GROUP_CONCAT(p2.name, ' | ')
          FROM pmo_allocations pa2
          JOIN pmo_projects p2 ON p2.id = pa2.project_id
          WHERE pa2.employee_id = e.id
            AND pa2.tenant_id  = e.tenant_id
            AND p2.status IN ('active','planning')
        ), '') AS current_projects
      FROM employees e
      JOIN employee_history eh ON eh.employee_id = e.id AND eh.is_current = 1
      LEFT JOIN departments  d   ON d.id   = eh.department_id
      LEFT JOIN designations des ON des.id = eh.designation_id
      WHERE e.tenant_id = ? AND e.status = 'active'
      ORDER BY booked_hours_per_week ASC, eh.first_name ASC
    `).bind(startDate, ctx.tenantId).all();

    // Calculate utilisation and available capacity
    const withCalc = (rows.results as any[]).map(r => ({
      ...r,
      utilisation_pct:        Math.round((r.booked_hours_per_week / 37.5) * 100),
      available_hours_per_week: Math.max(0, 37.5 - r.booked_hours_per_week),
      is_available:            r.booked_hours_per_week < 37.5,
    }));

    return ok(withCalc);
  }

  // ── TASKS ─────────────────────────────────────────────────────
  if (resource === 'tasks') {
    if (!id && method === 'GET') {
      const projectId  = url.searchParams.get('projectId');
      const clientId   = url.searchParams.get('clientId');
      const sprintId   = url.searchParams.get('sprintId');
      const assigneeId = url.searchParams.get('assigneeId');
      const status     = url.searchParams.get('status');

      const where: string[] = ['t.tenant_id = ?'];
      const params: unknown[] = [ctx.tenantId];
      if (projectId)  { where.push('t.project_id = ?');  params.push(projectId); }
      if (sprintId)   { where.push('t.sprint_id = ?');   params.push(sprintId); }
      if (assigneeId) { where.push('t.assignee_id = ?'); params.push(assigneeId); }
      if (status)     { where.push('t.status = ?');      params.push(status); }
      // Filter by client (via project join)
      if (clientId) {
        where.push('p.client_id = ?');
        params.push(clientId);
      }

      const rows = await env.DB.prepare(`
        SELECT t.*,
               eh.first_name||' '||eh.last_name AS assignee_name,
               p.name       AS project_name,
               p.colour     AS project_colour,
               c.company_name AS client_name
        FROM pmo_tasks t
        LEFT JOIN pmo_projects p ON p.id = t.project_id
        LEFT JOIN clients      c ON c.id = p.client_id
        LEFT JOIN employees    e ON e.id = t.assignee_id
        LEFT JOIN employee_history eh ON eh.employee_id = e.id AND eh.is_current = 1
        WHERE ${where.join(' AND ')}
        ORDER BY t.priority DESC, t.task_order ASC, t.due_date ASC
        LIMIT 500
      `).bind(...params).all();
      return ok(rows.results);
    }

    if (!id && method === 'POST') {
      const denied = requirePermission(ctx, 'pmo:create:task');
      if (denied) return denied;

      const body   = await request.json().catch(() => null);
      const parsed = TaskSchema.safeParse(body);
      if (!parsed.success) return err(parsed.error.issues[0].message);

      const d      = parsed.data;
      const taskId = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT INTO pmo_tasks
          (id, tenant_id, project_id, sprint_id, name, description, assignee_id,
           priority, status, estimated_hours, due_date, phase, task_category, created_by, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
      `).bind(
        taskId, ctx.tenantId, d.projectId, d.sprintId ?? null,
        d.name, d.description ?? null, d.assigneeId ?? null,
        d.priority, d.status, d.estimatedHours ?? 8, d.dueDate ?? null,
        d.phase ?? null, d.category ?? null, ctx.userId
      ).run();

      await audit(env, { ...auditFromRequest(request, ctx), action: 'create', resource: 'task', resourceId: taskId });
      return created({ id: taskId });
    }

    if (id && method === 'PATCH') {
      const denied = requirePermission(ctx, 'pmo:edit:task');
      if (denied) return denied;

      const body    = await request.json() as any;
      const allowed = ['status','assignee_id','priority','estimated_hours','name','description','due_date','phase'];
      const sets    = Object.keys(body).filter(k => allowed.includes(k)).map(k => `${k} = ?`);
      if (sets.length === 0) return err('No valid fields');

      await env.DB.prepare(
        `UPDATE pmo_tasks SET ${sets.join(', ')}, updated_at=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=?`
      ).bind(...sets.map(s => body[s.split(' = ?')[0]]), id, ctx.tenantId).run();

      return ok({ id });
    }

    if (id && method === 'DELETE') {
      const denied = requirePermission(ctx, 'pmo:manage:project');
      if (denied) return denied;
      await env.DB.prepare(`DELETE FROM pmo_tasks WHERE id=? AND tenant_id=?`).bind(id, ctx.tenantId).run();
      return ok({ deleted: true });
    }
  }

  // ── SPRINTS ───────────────────────────────────────────────────
  if (resource === 'sprints') {
    if (!id && method === 'GET') {
      const projectId = url.searchParams.get('projectId');
      const where     = projectId ? 'tenant_id=? AND project_id=?' : 'tenant_id=?';
      const params    = projectId ? [ctx.tenantId, projectId] : [ctx.tenantId];
      const rows = await env.DB.prepare(
        `SELECT * FROM pmo_sprints WHERE ${where} ORDER BY sprint_number DESC LIMIT 50`
      ).bind(...params).all();
      return ok(rows.results);
    }
  }


  // ── TEMPLATES ─────────────────────────────────────────────────
  // GET /api/pmo/templates — list all available templates
  if (resource === 'templates' && !id && method === 'GET') {
    const rows = await env.DB.prepare(`
      SELECT
        t.id, t.name, t.project_type, t.description, t.is_system, t.is_active,
        COUNT(DISTINCT ph.id)  AS phase_count,
        COUNT(DISTINCT tk.id)  AS task_count
      FROM project_templates t
      LEFT JOIN project_template_phases ph ON ph.template_id = t.id
      LEFT JOIN project_template_tasks  tk ON tk.template_id = t.id
      WHERE t.is_active = 1
        AND (t.tenant_id IS NULL OR t.tenant_id = ?)
      GROUP BY t.id
      ORDER BY t.is_system DESC, t.project_type, t.name
    `).bind(ctx.tenantId).all();
    return ok(rows.results);
  }

  // GET /api/pmo/templates/:id — get template with all phases + tasks
  if (resource === 'templates' && id && !action && method === 'GET') {
    const template = await env.DB.prepare(
      `SELECT * FROM project_templates WHERE id = ? AND (tenant_id IS NULL OR tenant_id = ?)`
    ).bind(id, ctx.tenantId).first();
    if (!template) return notFound('Template not found');

    const phases = await env.DB.prepare(`
      SELECT ph.*, COUNT(tk.id) AS task_count
      FROM project_template_phases ph
      LEFT JOIN project_template_tasks tk ON tk.phase_id = ph.id
      WHERE ph.template_id = ?
      GROUP BY ph.id
      ORDER BY ph.phase_order ASC
    `).bind(id).all();

    const tasks = await env.DB.prepare(
      `SELECT * FROM project_template_tasks WHERE template_id = ? ORDER BY phase_id, task_order ASC`
    ).bind(id).all();

    return ok({ ...template, phases: phases.results, tasks: tasks.results });
  }

  // ── SEED TASKS FROM TEMPLATE ──────────────────────────────────
  // POST /api/pmo/projects/:id/seed-tasks
  // Body: { templateId, startDate, endDate, allocations: [{employeeId, hoursPerWeek, allocation}] }
  // Smart backdating: auto-creates approved timesheets for all past weeks in completed/active sprints
  if (resource === 'projects' && id && action === 'seed-tasks' && method === 'POST') {
    const denied = requirePermission(ctx, 'pmo:create:task');
    if (denied) return denied;

    const body: any  = await request.json().catch(() => ({}));
    const { templateId, startDate, endDate, allocations = [] } = body;
    if (!templateId) return err('templateId is required');

    const proj = await env.DB.prepare(
      `SELECT id FROM pmo_projects WHERE id = ? AND tenant_id = ?`
    ).bind(id, ctx.tenantId).first();
    if (!proj) return notFound('Project not found');

    // ── Load template phases + tasks from DB ──────────────────
    const phases = await env.DB.prepare(
      `SELECT * FROM project_template_phases WHERE template_id = ? ORDER BY phase_order ASC`
    ).bind(templateId).all<{ id: string; phase_name: string; phase_order: number; duration_pct: number }>();
    if (!phases.results.length) return err('Template has no phases');

    const tasks = await env.DB.prepare(
      `SELECT * FROM project_template_tasks WHERE template_id = ? ORDER BY phase_id, task_order ASC`
    ).bind(templateId).all<{
      id: string; phase_id: string; name: string; description: string;
      priority: string; estimated_hours: number; category: string; task_order: number;
    }>();

    const tasksByPhase = new Map<string, typeof tasks.results>();
    for (const t of tasks.results) {
      if (!tasksByPhase.has(t.phase_id)) tasksByPhase.set(t.phase_id, []);
      tasksByPhase.get(t.phase_id)!.push(t);
    }

    // ── Date range ────────────────────────────────────────────
    const projStart  = startDate ? new Date(startDate) : new Date();
    const projEnd    = endDate   ? new Date(endDate)   : new Date(projStart.getTime() + 90 * 86400000);
    const totalMs    = Math.max(86400000, projEnd.getTime() - projStart.getTime());
    const today      = new Date();
    today.setHours(0, 0, 0, 0);

    // ── Weighted round-robin assignee pool ────────────────────
    const assigneePool: string[] = [];
    for (const a of allocations as any[]) {
      const slots = Math.max(1, Math.round((a.hoursPerWeek ?? 17.5) / 5));
      for (let i = 0; i < slots; i++) assigneePool.push(a.employeeId);
    }
    let assigneeIdx = 0;
    const nextAssignee = () => {
      if (!assigneePool.length) return null;
      const emp = assigneePool[assigneeIdx % assigneePool.length];
      assigneeIdx++;
      return emp;
    };

    // ── Get employee → employee record mapping ────────────────
    // Need employee.id (from employees table) for timesheet creation
    // allocations contain employeeId from employees table directly
    const empIds = (allocations as any[]).map((a: any) => a.employeeId);

    // ── Create sprints + tasks ────────────────────────────────
    const createdSprintIds: Array<{ sprintId: string; sprintStart: Date; sprintEnd: Date; phaseName: string; isCompleted: boolean }> = [];
    let phaseIdx = 0;

    for (const phase of phases.results) {
      const prevPct        = phases.results.slice(0, phaseIdx).reduce((s, p) => s + p.duration_pct, 0);
      const phaseStartMs   = totalMs * (prevPct / 100);
      const phaseDurMs     = totalMs * (phase.duration_pct / 100);
      const phaseStart     = new Date(projStart.getTime() + phaseStartMs);
      const phaseEnd       = new Date(phaseStart.getTime() + phaseDurMs);

      // Determine status: completed if end < today, active if spanning today, upcoming otherwise
      const sprintStatus   = phaseEnd < today ? 'completed' : phaseStart <= today ? 'active' : 'upcoming';

      const sprintId = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT OR IGNORE INTO pmo_sprints
          (id, tenant_id, project_id, sprint_number, sprint_name, status, start_date, end_date)
        VALUES (?,?,?,?,?,?,?,?)
      `).bind(
        sprintId, ctx.tenantId, id,
        // Use a high number based on timestamp to avoid UNIQUE(tenant_id, sprint_number) collision
        Math.floor(Date.now() / 1000) % 100000 + phaseIdx,
        phase.phase_name, sprintStatus,
        phaseStart.toISOString().split('T')[0],
        phaseEnd.toISOString().split('T')[0],
      ).run();

      createdSprintIds.push({
        sprintId, phaseStart, phaseEnd, phaseName: phase.phase_name,
        isCompleted: sprintStatus === 'completed' || sprintStatus === 'active',
      });

      // Create tasks for this phase
      const phaseTasks = tasksByPhase.get(phase.id) ?? [];
      for (let i = 0; i < phaseTasks.length; i++) {
        const tmpl       = phaseTasks[i];
        const taskId     = crypto.randomUUID();
        const duePct     = phaseTasks.length === 1 ? 1 : (i + 1) / phaseTasks.length;
        const dueDate    = new Date(phaseStart.getTime() + phaseDurMs * duePct);
        const assigneeId = nextAssignee();

        // Task status: done if due date passed, in_progress if first task of active phase, else todo
        let taskStatus = 'todo';
        if (dueDate < today)   taskStatus = 'done';
        else if (sprintStatus === 'active' && i === 0) taskStatus = 'in_progress';

        await env.DB.prepare(`
          INSERT INTO pmo_tasks
            (id, tenant_id, project_id, sprint_id, name, description, assignee_id,
             priority, status, estimated_hours, due_date, phase, task_category,
             task_order, created_by, created_at, updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
        `).bind(
          taskId, ctx.tenantId, id, sprintId,
          tmpl.name, tmpl.description ?? null, assigneeId,
          tmpl.priority ?? 'medium', taskStatus,
          tmpl.estimated_hours ?? 8,
          dueDate.toISOString().split('T')[0],
          phase.phase_name, tmpl.category ?? null,
          tmpl.task_order, ctx.userId
        ).run();
      }

      phaseIdx++;
    }

    // ── Auto-generate approved timesheets for backdated weeks ─
    // For each completed/active sprint, generate Mon–Fri timesheets
    // for each allocated resource, approved, with hours proportional to allocation
    let timesheetsCreated = 0;

    for (const sprint of createdSprintIds) {
      if (!sprint.isCompleted) continue;

      // Get all Monday starts within this sprint up to (but not exceeding) today
      const weeks: Date[] = [];
      const sprintEndCapped = sprint.phaseEnd < today ? sprint.phaseEnd : today;
      let weekCursor        = getMondayOf(sprint.phaseStart);

      while (weekCursor <= sprintEndCapped) {
        weeks.push(new Date(weekCursor));
        weekCursor = new Date(weekCursor.getTime() + 7 * 86400000);
      }

      // Get tasks in this sprint for assignment tracking
      const sprintTasks = await env.DB.prepare(
        `SELECT id, assignee_id FROM pmo_tasks WHERE sprint_id = ? AND tenant_id = ?`
      ).bind(sprint.sprintId, ctx.tenantId).all<{ id: string; assignee_id: string }>();

      // For each resource, create one timesheet per week
      for (const alloc of allocations as any[]) {
        const empId        = alloc.employeeId;
        const hoursPerWeek = alloc.hoursPerWeek ?? 17.5;
        // Distribute hours Mon–Fri proportionally (simple even split)
        const hoursPerDay  = Math.round((hoursPerWeek / 5) * 10) / 10;

        // Find the task this employee is assigned to in this sprint (for tagging entries)
        const myTask = sprintTasks.results.find(t => t.assignee_id === empId);

        for (const weekStart of weeks) {
          const weekStartStr = weekStart.toISOString().split('T')[0];

          // Skip if timesheet already exists for this employee + week
          const existing = await env.DB.prepare(
            `SELECT id FROM timesheets WHERE employee_id = ? AND week_starting = ?`
          ).bind(empId, weekStartStr).first();
          if (existing) continue;

          const tsId = crypto.randomUUID();
          await env.DB.prepare(`
            INSERT INTO timesheets
              (id, tenant_id, employee_id, week_starting, status, submitted_at, decided_at)
            VALUES (?,?,?,?,'approved',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
          `).bind(tsId, ctx.tenantId, empId, weekStartStr).run();

          // Create Mon–Fri entries
          for (let d = 0; d < 5; d++) {
            const entryDate = new Date(weekStart.getTime() + d * 86400000);
            // Don't create entries for future dates
            if (entryDate > today) continue;
            const entryId = crypto.randomUUID();
            await env.DB.prepare(`
              INSERT INTO timesheet_entries
                (id, timesheet_id, tenant_id, date, hours_worked, description, billable, project_id, task_id)
              VALUES (?,?,?,?,?,?,1,?,?)
            `).bind(
              entryId, tsId, ctx.tenantId,
              entryDate.toISOString().split('T')[0],
              hoursPerDay,
              sprint.phaseName,
              id,              // project_id
              myTask?.id ?? null
            ).run();
          }

          timesheetsCreated++;

          // Also write a resource_booking row for this week so the
          // Resources module shows correct utilisation
          await env.DB.prepare(`
            INSERT OR IGNORE INTO resource_bookings
              (id, tenant_id, employee_id, project_id, booking_type, week_starting, hours)
            VALUES (?,?,?,?,?,?,?)
          `).bind(
            crypto.randomUUID(), ctx.tenantId,
            empId, id, 'project',
            weekStartStr, hoursPerWeek
          ).run();
        }
      }
    }

    await audit(env, {
      ...auditFromRequest(request, ctx),
      action: 'seed', resource: 'project', resourceId: id,
    });

    return ok({
      tasks_created:       tasks.results.length,
      sprints_created:     phases.results.length,
      timesheets_created:  timesheetsCreated,
    });
  }


  // ── SPRINTS ───────────────────────────────────────────────────
  if (resource === 'sprints') {
    if (!id && method === 'GET') {
      const projectId = url.searchParams.get('projectId');
      const where     = projectId ? 'tenant_id=? AND project_id=?' : 'tenant_id=?';
      const params    = projectId ? [ctx.tenantId, projectId] : [ctx.tenantId];
      const rows = await env.DB.prepare(
        `SELECT * FROM pmo_sprints WHERE ${where} ORDER BY sprint_number DESC LIMIT 50`
      ).bind(...params).all();
      return ok(rows.results);
    }
  }

  // ── TASK COMMENTS ─────────────────────────────────────────────
  // GET /api/pmo/tasks/:id/comments
  if (resource === 'tasks' && id && action === 'comments' && method === 'GET') {
    const rows = await env.DB.prepare(`
      SELECT tc.*, u.email as user_email,
             COALESCE(eh.first_name||' '||eh.last_name, u.email) as user_name
      FROM task_comments tc
      JOIN users u ON u.id = tc.user_id
      LEFT JOIN employees e ON e.user_id = tc.user_id AND e.tenant_id = tc.tenant_id
      LEFT JOIN employee_history eh ON eh.employee_id = e.id AND eh.is_current = 1
      WHERE tc.task_id = ? AND tc.tenant_id = ?
      ORDER BY tc.created_at ASC
    `).bind(id, ctx.tenantId).all();
    return ok(rows.results);
  }

  // POST /api/pmo/tasks/:id/comments
  if (resource === 'tasks' && id && action === 'comments' && method === 'POST') {
    const body: any = await request.json().catch(() => ({}));
    if (!body.comment?.trim()) return err('Comment text is required');
    const commentId = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO task_comments (id, tenant_id, task_id, user_id, comment)
      VALUES (?, ?, ?, ?, ?)
    `).bind(commentId, ctx.tenantId, id, ctx.userId, body.comment.trim()).run();
    return created({ id: commentId });
  }

  // DELETE /api/pmo/tasks/:taskId/comments/:commentId
  if (resource === 'tasks' && id && action === 'comments' && segments[3] && method === 'DELETE') {
    await env.DB.prepare(
      `DELETE FROM task_comments WHERE id = ? AND task_id = ? AND tenant_id = ? AND (user_id = ? OR ?)`)
    .bind(segments[3], id, ctx.tenantId, ctx.userId, ctx.permissions?.includes('*:*:*') ? 1 : 0).run();
    return ok({ deleted: true });
  }

  // ── TASK ATTACHMENTS ───────────────────────────────────────────
  // GET /api/pmo/tasks/:id/attachments
  if (resource === 'tasks' && id && action === 'attachments' && method === 'GET') {
    const rows = await env.DB.prepare(`
      SELECT ta.*, COALESCE(eh.first_name||' '||eh.last_name, u.email) as uploaded_by_name
      FROM task_attachments ta
      JOIN users u ON u.id = ta.uploaded_by
      LEFT JOIN employees e ON e.user_id = ta.uploaded_by AND e.tenant_id = ta.tenant_id
      LEFT JOIN employee_history eh ON eh.employee_id = e.id AND eh.is_current = 1
      WHERE ta.task_id = ? AND ta.tenant_id = ?
      ORDER BY ta.created_at DESC
    `).bind(id, ctx.tenantId).all();
    return ok(rows.results);
  }

  // POST /api/pmo/tasks/:id/attachments — upload file
  if (resource === 'tasks' && id && action === 'attachments' && method === 'POST') {
    const formData = await request.formData().catch(() => null);
    if (!formData) return err('Form data required');
    const file = formData.get('file') as File | null;
    if (!file) return err('file is required');

    const key = `attachments/${ctx.tenantId}/tasks/${id}/${crypto.randomUUID()}-${file.name}`;
    const store = env.STORE ?? env.STORAGE;
    if (!store) return err('Storage not configured');

    await store.put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
    });

    const attId = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO task_attachments (id, tenant_id, task_id, uploaded_by, file_name, file_size, mime_type, storage_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(attId, ctx.tenantId, id, ctx.userId, file.name, file.size, file.type, key).run();

    return created({ id: attId, file_name: file.name });
  }

  // DELETE /api/pmo/tasks/:taskId/attachments/:attId
  if (resource === 'tasks' && id && action === 'attachments' && segments[3] && method === 'DELETE') {
    const att = await env.DB.prepare(
      `SELECT storage_key FROM task_attachments WHERE id = ? AND task_id = ? AND tenant_id = ?`
    ).bind(segments[3], id, ctx.tenantId).first<{ storage_key: string }>();
    if (att) {
      const store = env.STORE ?? env.STORAGE;
      if (store) await store.delete(att.storage_key);
      await env.DB.prepare(`DELETE FROM task_attachments WHERE id = ?`).bind(segments[3]).run();
    }
    return ok({ deleted: true });
  }

  return notFound();
}


// ── Helpers ───────────────────────────────────────────────────
function getMondayOf(date: Date): Date {
  const d   = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon...
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

import { z } from 'zod';
import { ok, created, err, notFound } from '../core/response';
import { requirePermission, hasPermission } from '../middleware/auth';
import { audit, auditFromRequest } from '../middleware/audit';
import { sendMail, complianceAlertEmail } from '../core/email';
import { uploadFile, getSignedDownloadUrl, storageKey } from '../core/storage';
import type { Env, AppContext } from '../types';
import { startWorkflow } from '../platform/workflow/engine';

// ════════════════════════════════════════════════════════════════════════════
// EXPENSES
// ════════════════════════════════════════════════════════════════════════════
const CreateExpenseSchema = z.object({
  category:    z.enum(['travel','accommodation','meals','equipment','training','software','other']),
  amount:      z.number().positive(),
  currency:    z.string().length(3).default('GBP'),
  description: z.string().min(1).max(500),
  expenseDate: z.string().date(),
  receiptKey:  z.string().optional(), // R2 key after upload
});

export async function handleExpenses(
  request: Request, env: Env, ctx: AppContext, subPath: string
): Promise<Response> {
  const [id, action] = subPath.split('/').filter(Boolean);

  if (!id && request.method === 'GET') {
    const denied = requirePermission(ctx, 'expenses:view:expense_claim');
    if (denied) return denied;

    const url = new URL(request.url);
    const mine = url.searchParams.get('mine') === 'true';
    const status = url.searchParams.get('status');

    let where = 'ec.tenant_id = ?';
    const params: unknown[] = [ctx.tenantId];

    if (mine || !hasPermission(ctx, 'expenses:approve:expense_claim')) {
      where += ' AND ec.employee_id = (SELECT id FROM employees WHERE user_id = ? AND tenant_id = ?)';
      params.push(ctx.userId, ctx.tenantId);
    }
    if (status) { where += ' AND ec.status = ?'; params.push(status); }

    const rows = await env.DB.prepare(`
      SELECT ec.*, eh.first_name || ' ' || eh.last_name AS employee_name
      FROM expense_claims ec
      JOIN employees e ON e.id = ec.employee_id
      JOIN employee_history eh ON eh.employee_id = e.id AND eh.is_current = 1
      WHERE ${where}
      ORDER BY ec.created_at DESC LIMIT 100
    `).bind(...params).all();
    return ok(rows.results);
  }

  if (!id && request.method === 'POST') {
    const denied = requirePermission(ctx, 'expenses:create:expense_claim');
    if (denied) return denied;

    const body = await request.json().catch(() => null);
    const parsed = CreateExpenseSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.issues[0].message);

    const d = parsed.data;
    const employee = await env.DB.prepare(
      `SELECT id FROM employees WHERE user_id = ? AND tenant_id = ?`
    ).bind(ctx.userId, ctx.tenantId).first() as any;
    if (!employee) return err('Employee not found', 404);

    const expId = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO expense_claims (id, tenant_id, employee_id, category, amount, currency, description, expense_date, receipt_key, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)
    `).bind(expId, ctx.tenantId, employee.id, d.category, d.amount, d.currency, d.description, d.expenseDate, d.receiptKey ?? null).run();

    await startWorkflow(env, {
      definitionKey: 'expense_approval',
      recordType:    'expense_claim',
      recordId:      expId,
      submittedBy:   ctx.userId!,
      tenantId:      ctx.tenantId,
      recordData:    { amount: d.amount },
    });

    await audit(env, { ...auditFromRequest(request, ctx), action: 'create', resource: 'expense_claim', resourceId: expId });
    return created({ id: expId });
  }

  if (id && action === 'decision' && request.method === 'POST') {
    const denied = requirePermission(ctx, 'expenses:approve:expense_claim');
    if (denied) return denied;

    const { decision, comment } = await request.json() as any;
    if (!['approved','rejected'].includes(decision)) return err('Invalid decision');

    await env.DB.prepare(
      `UPDATE expense_claims SET status = ?, decided_by = ?, decided_at = CURRENT_TIMESTAMP, comment = ? WHERE id = ? AND tenant_id = ?`
    ).bind(decision, ctx.userId, comment ?? null, id, ctx.tenantId).run();

    await audit(env, { ...auditFromRequest(request, ctx), action: decision === 'approved' ? 'approve' : 'reject', resource: 'expense_claim', resourceId: id });
    return ok({ id, status: decision });
  }

  return err('Not found', 404);
}

// ════════════════════════════════════════════════════════════════════════════
// COMPLIANCE / RIGHT TO WORK
// ════════════════════════════════════════════════════════════════════════════
const CreateRTWSchema = z.object({
  employeeId:  z.string().uuid(),
  checkType:   z.enum(['manual','share_code','external_service']),
  docType:     z.string().min(1),
  docReference:z.string().optional(),
  checkDate:   z.string().date(),
  expiryDate:  z.string().date().optional(),
  fileKey:     z.string().optional(),
});

export async function handleCompliance(
  request: Request, env: Env, ctx: AppContext, subPath: string
): Promise<Response> {
  const [id] = subPath.split('/').filter(Boolean);

  if (!id && request.method === 'GET') {
    const denied = requirePermission(ctx, 'compliance:view:rtw_check');
    if (denied) return denied;

    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const expiringSoonDays = parseInt(url.searchParams.get('expiringSoonDays') ?? '90');

    let where = 'rw.tenant_id = ?';
    const params: unknown[] = [ctx.tenantId];
    if (status === 'expiring') {
      where += ` AND rw.expiry_date IS NOT NULL AND rw.expiry_date <= date('now', '+${expiringSoonDays} days') AND rw.expiry_date > date('now')`;
    } else if (status === 'expired') {
      where += ` AND rw.expiry_date IS NOT NULL AND rw.expiry_date < date('now')`;
    } else if (status) {
      where += ' AND rw.status = ?'; params.push(status);
    }

    const rows = await env.DB.prepare(`
      SELECT rw.*, eh.first_name || ' ' || eh.last_name AS employee_name
      FROM employee_right_to_work rw
      JOIN employee_history eh ON eh.employee_id = rw.employee_id AND eh.is_current = 1
      WHERE ${where}
      ORDER BY rw.expiry_date ASC NULLS LAST
      LIMIT 200
    `).bind(...params).all();
    return ok(rows.results);
  }

  if (!id && request.method === 'POST') {
    const denied = requirePermission(ctx, 'compliance:create:rtw_check');
    if (denied) return denied;

    const body = await request.json().catch(() => null);
    const parsed = CreateRTWSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.issues[0].message);

    const d = parsed.data;
    const rtwId = crypto.randomUUID();
    const status = d.expiryDate && new Date(d.expiryDate) < new Date() ? 'expired' : 'valid';

    await env.DB.prepare(`
      INSERT INTO employee_right_to_work (id, tenant_id, employee_id, check_type, doc_type, doc_reference, check_date, expiry_date, r2_file_key, status, checked_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(rtwId, ctx.tenantId, d.employeeId, d.checkType, d.docType, d.docReference ?? null, d.checkDate, d.expiryDate ?? null, d.fileKey ?? null, status, ctx.userId).run();

    await audit(env, { ...auditFromRequest(request, ctx), action: 'create', resource: 'rtw_check', resourceId: rtwId });
    return created({ id: rtwId });
  }

  // GET /api/compliance/alerts — send email of expiring/expired items
  if (id === 'send-alerts' && request.method === 'POST') {
    const denied = requirePermission(ctx, 'compliance:manage:rtw_check');
    if (denied) return denied;

    const rows = await env.DB.prepare(`
      SELECT rw.doc_type, rw.expiry_date, rw.status, eh.first_name || ' ' || eh.last_name AS name
      FROM employee_right_to_work rw
      JOIN employee_history eh ON eh.employee_id = rw.employee_id AND eh.is_current = 1
      WHERE rw.tenant_id = ? AND (rw.status = 'expired' OR (rw.expiry_date <= date('now', '+90 days') AND rw.expiry_date > date('now')))
      ORDER BY rw.expiry_date ASC
    `).bind(ctx.tenantId).all() as any;

    if (rows.results.length > 0) {
      await sendMail(env, {
        to: env.EMAIL_HR,
        subject: 'Compliance Alert: RTW / Visa Items Require Attention',
        html: complianceAlertEmail({ items: rows.results.map((r: any) => ({ name: r.name, item: r.doc_type, status: r.status, expires: r.expiry_date ?? 'N/A' })) }),
      });
    }

    return ok({ alerted: rows.results.length });
  }

  return err('Not found', 404);
}

// ════════════════════════════════════════════════════════════════════════════
// DOCUMENTS
// ════════════════════════════════════════════════════════════════════════════
export async function handleDocuments(
  request: Request, env: Env, ctx: AppContext, subPath: string
): Promise<Response> {
  const [id, action] = subPath.split('/').filter(Boolean);

  if (!id && request.method === 'GET') {
    const denied = requirePermission(ctx, 'documents:view:document');
    if (denied) return denied;

    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    let where = 'd.tenant_id = ?';
    const params: unknown[] = [ctx.tenantId];
    if (category) { where += ' AND d.category = ?'; params.push(category); }

    const rows = await env.DB.prepare(`
      SELECT d.id, d.name, d.category, d.size_bytes, d.r2_key, d.access_level, d.created_at,
             u.email AS uploaded_by_email
      FROM documents d
      LEFT JOIN users u ON u.id = d.uploaded_by
      WHERE ${where}
      ORDER BY d.created_at DESC
      LIMIT 200
    `).bind(...params).all();
    return ok(rows.results);
  }

  if (!id && request.method === 'POST') {
    const denied = requirePermission(ctx, 'documents:create:document');
    if (denied) return denied;

    // Expects multipart form data: file + metadata
    const formData = await request.formData().catch(() => null);
    if (!formData) return err('Expected multipart form data');

    const file = formData.get('file') as File | null;
    const name = formData.get('name') as string ?? file?.name ?? 'untitled';
    const category = formData.get('category') as string ?? 'general';
    const accessLevel = formData.get('accessLevel') as string ?? 'all_staff';

    if (!file) return err('No file provided');

    const docId = crypto.randomUUID();
    const key = storageKey(ctx.tenantId, 'documents', docId, file.name);
    await uploadFile(env, key, await file.arrayBuffer(), file.type);

    await env.DB.prepare(`
      INSERT INTO documents (id, tenant_id, name, category, r2_key, size_bytes, content_type, access_level, uploaded_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(docId, ctx.tenantId, name, category, key, file.size, file.type, accessLevel, ctx.userId).run();

    await audit(env, { ...auditFromRequest(request, ctx), action: 'upload', resource: 'document', resourceId: docId });
    return created({ id: docId, key });
  }

  // GET /api/documents/expiring
  if (id === 'expiring' && request.method === 'GET') {
    const rows = await env.DB.prepare(`
      SELECT d.*, eh.first_name||' '||eh.last_name AS employee_name,
             CAST(julianday(d.expiry_date) - julianday('now') AS INTEGER) AS days_until_expiry
      FROM documents d
      LEFT JOIN employees e ON e.id = d.employee_id
      LEFT JOIN employee_history eh ON eh.employee_id = e.id AND eh.is_current = 1
      WHERE d.tenant_id = ? AND d.expiry_date IS NOT NULL
        AND d.expiry_date <= date('now', '+90 days')
      ORDER BY d.expiry_date ASC LIMIT 100
    `).bind(ctx.tenantId).all();
    return ok(rows.results);
  }

  // PATCH /api/documents/:id/expiry
  if (id && action === 'expiry' && request.method === 'PATCH') {
    const body = await request.json() as any;
    await env.DB.prepare(
      `UPDATE documents SET expiry_date=?, doc_type=? WHERE id=? AND tenant_id=?`
    ).bind(body.expiryDate??null, body.docType??null, id, ctx.tenantId).run();
    return ok({ updated: true });
  }

  // PATCH /api/documents/:id/employee — link doc to employee (for CV/photo)
  if (id && action === 'employee' && request.method === 'PATCH') {
    const body = await request.json() as any;
    await env.DB.prepare(
      `UPDATE documents SET employee_id=? WHERE id=? AND tenant_id=?`
    ).bind(body.employeeId, id, ctx.tenantId).run();
    return ok({ updated: true });
  }

  if (id && action === 'download' && request.method === 'GET') {
    const denied = requirePermission(ctx, 'documents:view:document');
    if (denied) return denied;

    const doc = await env.DB.prepare(
      `SELECT r2_key FROM documents WHERE id = ? AND tenant_id = ?`
    ).bind(id, ctx.tenantId).first() as any;
    if (!doc) return notFound('Document not found');

    const url = await getSignedDownloadUrl(env, doc.r2_key);
    if (!url) return notFound('File not found in storage');

    await audit(env, { ...auditFromRequest(request, ctx), action: 'download', resource: 'document', resourceId: id });
    return ok({ url });
  }

  return err('Not found', 404);
}

// ════════════════════════════════════════════════════════════════════════════
// ANNOUNCEMENTS
// ════════════════════════════════════════════════════════════════════════════
const CreateAnnouncementSchema = z.object({
  title:    z.string().min(1).max(200),
  body:     z.string().min(1),
  priority: z.enum(['high','medium','low']).default('medium'),
  audience: z.enum(['all_staff','managers','department','custom']).default('all_staff'),
  targetIds:z.array(z.string()).optional(),
  pinned:   z.boolean().default(false),
});

export async function handleAnnouncements(
  request: Request, env: Env, ctx: AppContext, subPath: string
): Promise<Response> {
  const [id] = subPath.split('/').filter(Boolean);

  if (!id && request.method === 'GET') {
    const rows = await env.DB.prepare(`
      SELECT a.*, u.email AS author_email,
             eh.first_name || ' ' || eh.last_name AS author_name
      FROM announcements a
      LEFT JOIN users u ON u.id = a.created_by
      LEFT JOIN employees e ON e.user_id = a.created_by
      LEFT JOIN employee_history eh ON eh.employee_id = e.id AND eh.is_current = 1
      WHERE a.tenant_id = ?
      ORDER BY a.pinned DESC, a.created_at DESC
      LIMIT 50
    `).bind(ctx.tenantId).all();
    return ok(rows.results);
  }

  if (!id && request.method === 'POST') {
    const denied = requirePermission(ctx, 'announcements:create:announcement');
    if (denied) return denied;

    const body = await request.json().catch(() => null);
    const parsed = CreateAnnouncementSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.issues[0].message);

    const d = parsed.data;
    const aId = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO announcements (id, tenant_id, title, body, priority, audience, target_ids, pinned, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(aId, ctx.tenantId, d.title, d.body, d.priority, d.audience, d.targetIds ? JSON.stringify(d.targetIds) : null, d.pinned ? 1 : 0, ctx.userId).run();

    return created({ id: aId });
  }

  return err('Not found', 404);
}

// ════════════════════════════════════════════════════════════════════════════
// PMO — Projects and Tasks
// ════════════════════════════════════════════════════════════════════════════
const CreateProjectSchema = z.object({
  name:      z.string().min(1).max(200),
  clientName:z.string().optional(),
  startDate: z.string().date().optional(),
  endDate:   z.string().date().optional(),
  budget:    z.number().positive().optional(),
  priority:  z.enum(['low','medium','high','critical']).default('medium'),
  status:    z.enum(['planning','active','on_hold','completed','cancelled']).default('planning'),
});

const CreateTaskSchema = z.object({
  projectId:      z.string().uuid(),
  sprintId:       z.string().uuid().optional(),
  name:           z.string().min(1).max(200),
  description:    z.string().optional(),
  assigneeId:     z.string().uuid().optional(),
  priority:       z.enum(['low','medium','high','critical']).default('medium'),
  status:         z.enum(['backlog','todo','in_progress','review','done']).default('backlog'),
  estimatedHours: z.number().positive().optional(),
  dueDate:        z.string().date().optional(),
  phase:          z.string().optional(),
  category:       z.string().optional(),
});

export async function handlePMO(
  request: Request, env: Env, ctx: AppContext, subPath: string
): Promise<Response> {
  const [resource, id, action] = subPath.split('/').filter(Boolean);

  // Projects
  if (resource === 'projects') {
    if (!id && request.method === 'GET') {
      const rows = await env.DB.prepare(
        `SELECT p.*, COUNT(DISTINCT pt.id) as task_count,
                COUNT(DISTINCT pa.employee_id) as team_size
         FROM pmo_projects p
         LEFT JOIN pmo_tasks pt ON pt.project_id = p.id
         LEFT JOIN pmo_allocations pa ON pa.project_id = p.id
         WHERE p.tenant_id = ?
         GROUP BY p.id ORDER BY p.created_at DESC`
      ).bind(ctx.tenantId).all();
      return ok(rows.results);
    }

    if (!id && request.method === 'POST') {
      const denied = requirePermission(ctx, 'pmo:create:project');
      if (denied) return denied;

      const body = await request.json().catch(() => null);
      const parsed = CreateProjectSchema.safeParse(body);
      if (!parsed.success) return err(parsed.error.issues[0].message);

      const d = parsed.data;
      const projId = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT INTO pmo_projects (id, tenant_id, name, client_name, start_date, end_date, budget, priority, status, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(projId, ctx.tenantId, d.name, d.clientName ?? null, d.startDate ?? null, d.endDate ?? null, d.budget ?? null, d.priority, d.status, ctx.userId).run();

      return created({ id: projId });
    }
  }

  // Tasks
  if (resource === 'tasks') {
    if (!id && request.method === 'GET') {
      const url = new URL(request.url);
      const projectId = url.searchParams.get('projectId');
      const sprintId  = url.searchParams.get('sprintId');
      const assigneeId = url.searchParams.get('assigneeId');

      let where = 't.tenant_id = ?';
      const params: unknown[] = [ctx.tenantId];
      if (projectId) { where += ' AND t.project_id = ?'; params.push(projectId); }
      if (sprintId)  { where += ' AND t.sprint_id = ?';  params.push(sprintId); }
      if (assigneeId){ where += ' AND t.assignee_id = ?'; params.push(assigneeId); }

      const rows = await env.DB.prepare(`
        SELECT t.*, eh.first_name || ' ' || eh.last_name AS assignee_name
        FROM pmo_tasks t
        LEFT JOIN employees e ON e.id = t.assignee_id
        LEFT JOIN employee_history eh ON eh.employee_id = e.id AND eh.is_current = 1
        WHERE ${where}
        ORDER BY t.priority DESC, t.task_order ASC
        LIMIT 500
      `).bind(...params).all();
      return ok(rows.results);
    }

    if (!id && request.method === 'POST') {
      const denied = requirePermission(ctx, 'pmo:create:task');
      if (denied) return denied;

      const body = await request.json().catch(() => null);
      const parsed = CreateTaskSchema.safeParse(body);
      if (!parsed.success) return err(parsed.error.issues[0].message);

      const d = parsed.data;
      const taskId = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(taskId, ctx.tenantId, d.projectId, d.sprintId ?? null, d.name, d.description ?? null, d.assigneeId ?? null, d.priority, d.status, d.estimatedHours ?? 8, d.dueDate ?? null, d.phase ?? null, d.category ?? null, ctx.userId).run();

      return created({ id: taskId });
    }

    if (id && request.method === 'PATCH') {
      const denied = requirePermission(ctx, 'pmo:edit:task');
      if (denied) return denied;

      const body = await request.json() as any;
      const allowed = ['status','assignee_id','priority','estimated_hours','name','description'];
      const sets = Object.keys(body).filter(k => allowed.includes(k)).map(k => `${k} = ?`);
      if (sets.length === 0) return err('No valid fields to update');

      await env.DB.prepare(
        `UPDATE pmo_tasks SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?`
      ).bind(...sets.map(s => body[s.split(' = ?')[0]]), id, ctx.tenantId).run();

      return ok({ id });
    }
  }

  // Sprints
  if (resource === 'sprints') {
    if (!id && request.method === 'GET') {
      const rows = await env.DB.prepare(
        `SELECT * FROM pmo_sprints WHERE tenant_id = ? ORDER BY sprint_number DESC LIMIT 20`
      ).bind(ctx.tenantId).all();
      return ok(rows.results);
    }
  }

  return err('Not found', 404);
}

// ════════════════════════════════════════════════════════════════════════════
// RECRUITMENT
// ════════════════════════════════════════════════════════════════════════════
const CreateJobSchema = z.object({
  title:       z.string().min(1).max(200),
  departmentId:z.string().uuid().optional(),
  location:    z.string().optional(),
  locationType:z.enum(['office','remote','hybrid']).default('office'),
  description: z.string().optional(),
  requirements:z.string().optional(),
  salaryMin:   z.number().positive().optional(),
  salaryMax:   z.number().positive().optional(),
  currency:    z.string().length(3).default('GBP'),
  closingDate: z.string().date().optional(),
});

export async function handleRecruitment(
  request: Request, env: Env, ctx: AppContext, subPath: string
): Promise<Response> {
  const [id, action] = subPath.split('/').filter(Boolean);

  if (!id && request.method === 'GET') {
    const rows = await env.DB.prepare(`
      SELECT j.*, d.name AS department_name,
             COUNT(a.id) AS applicant_count
      FROM job_postings j
      LEFT JOIN departments d ON d.id = j.department_id
      LEFT JOIN job_applications a ON a.job_id = j.id
      WHERE j.tenant_id = ?
      GROUP BY j.id
      ORDER BY j.created_at DESC
    `).bind(ctx.tenantId).all();
    return ok(rows.results);
  }

  if (!id && request.method === 'POST') {
    const denied = requirePermission(ctx, 'recruitment:create:job_posting');
    if (denied) return denied;

    const body = await request.json().catch(() => null);
    const parsed = CreateJobSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.issues[0].message);

    const d = parsed.data;
    const jobId = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO job_postings (id, tenant_id, title, department_id, location, location_type, description, requirements, salary_min, salary_max, currency, closing_date, status, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, CURRENT_TIMESTAMP)
    `).bind(jobId, ctx.tenantId, d.title, d.departmentId ?? null, d.location ?? null, d.locationType, d.description ?? null, d.requirements ?? null, d.salaryMin ?? null, d.salaryMax ?? null, d.currency, d.closingDate ?? null, ctx.userId).run();

    return created({ id: jobId });
  }

  return err('Not found', 404);
}

// ════════════════════════════════════════════════════════════════════════════
// ASSETS
// ════════════════════════════════════════════════════════════════════════════
const CreateAssetSchema = z.object({
  name:        z.string().min(1).max(200),
  category:    z.enum(['laptop','monitor','phone','tablet','peripheral','furniture','vehicle','other']),
  serialNumber:z.string().optional(),
  purchaseDate:z.string().date().optional(),
  purchaseValue:z.number().positive().optional(),
  assignedToId:z.string().uuid().optional(),
  location:    z.string().optional(),
  notes:       z.string().optional(),
});

export async function handleAssets(
  request: Request, env: Env, ctx: AppContext, subPath: string
): Promise<Response> {
  const [id, action] = subPath.split('/').filter(Boolean);

  if (!id && request.method === 'GET') {
    const url = new URL(request.url);
    const status   = url.searchParams.get('status');
    const category = url.searchParams.get('category');

    let where = 'a.tenant_id = ?';
    const params: unknown[] = [ctx.tenantId];
    if (status)   { where += ' AND a.status = ?';   params.push(status); }
    if (category) { where += ' AND a.category = ?'; params.push(category); }

    const rows = await env.DB.prepare(`
      SELECT a.*, eh.first_name || ' ' || eh.last_name AS assigned_to_name
      FROM assets a
      LEFT JOIN employees e ON e.id = a.assigned_to_id
      LEFT JOIN employee_history eh ON eh.employee_id = e.id AND eh.is_current = 1
      WHERE ${where}
      ORDER BY a.created_at DESC LIMIT 200
    `).bind(...params).all();
    return ok(rows.results);
  }

  if (!id && request.method === 'POST') {
    const denied = requirePermission(ctx, 'assets:create:asset');
    if (denied) return denied;

    const body = await request.json().catch(() => null);
    const parsed = CreateAssetSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.issues[0].message);

    const d = parsed.data;
    const assetId = crypto.randomUUID();
    const status  = d.assignedToId ? 'in_use' : 'available';

    await env.DB.prepare(`
      INSERT INTO assets (id, tenant_id, name, category, serial_number, purchase_date, purchase_value, assigned_to_id, location, status, notes, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(assetId, ctx.tenantId, d.name, d.category, d.serialNumber ?? null, d.purchaseDate ?? null, d.purchaseValue ?? null, d.assignedToId ?? null, d.location ?? null, status, d.notes ?? null, ctx.userId).run();

    return created({ id: assetId });
  }

  if (id && action === 'assign' && request.method === 'POST') {
    const denied = requirePermission(ctx, 'assets:edit:asset');
    if (denied) return denied;

    const { employeeId } = await request.json() as any;
    await env.DB.prepare(
      `UPDATE assets SET assigned_to_id = ?, status = 'in_use', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?`
    ).bind(employeeId, id, ctx.tenantId).run();

    await audit(env, { ...auditFromRequest(request, ctx), action: 'update', resource: 'asset', resourceId: id, metadata: { assignedTo: employeeId } });
    return ok({ id, status: 'in_use' });
  }

  return err('Not found', 404);
}

// ════════════════════════════════════════════════════════════════════════════
// TRAINING
// ════════════════════════════════════════════════════════════════════════════
export async function handleTraining(
  request: Request, env: Env, ctx: AppContext, subPath: string
): Promise<Response> {
  const [id, action] = subPath.split('/').filter(Boolean);

  if (!id && request.method === 'GET') {
    const rows = await env.DB.prepare(`
      SELECT tc.*, COUNT(ta.id) as assignment_count,
             SUM(CASE WHEN ta.status = 'completed' THEN 1 ELSE 0 END) as completed_count
      FROM training_courses tc
      LEFT JOIN training_assignments ta ON ta.course_id = tc.id
      WHERE tc.tenant_id = ?
      GROUP BY tc.id ORDER BY tc.created_at DESC
    `).bind(ctx.tenantId).all();
    return ok(rows.results);
  }

  if (id === 'assignments' && request.method === 'GET') {
    const url = new URL(request.url);
    const employeeId = url.searchParams.get('employeeId');

    let where = 'ta.tenant_id = ?';
    const params: unknown[] = [ctx.tenantId];
    if (employeeId) { where += ' AND ta.employee_id = ?'; params.push(employeeId); }

    const rows = await env.DB.prepare(`
      SELECT ta.*, tc.name AS course_name, tc.mandatory,
             eh.first_name || ' ' || eh.last_name AS employee_name
      FROM training_assignments ta
      JOIN training_courses tc ON tc.id = ta.course_id
      JOIN employee_history eh ON eh.employee_id = ta.employee_id AND eh.is_current = 1
      WHERE ${where}
      ORDER BY ta.due_date ASC NULLS LAST
    `).bind(...params).all();
    return ok(rows.results);
  }

  if (id && action === 'complete' && request.method === 'POST') {
    const { score } = await request.json() as any;
    await env.DB.prepare(
      `UPDATE training_assignments SET status = 'completed', completed_date = date('now'), score = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?`
    ).bind(score ?? null, id, ctx.tenantId).run();
    return ok({ id, status: 'completed' });
  }

  return err('Not found', 404);
}

import { z } from 'zod';
import { ok, created, noContent, err, notFound, forbidden } from '../../core/response';
import { requirePermission } from '../../middleware/auth';
import { audit, auditFromRequest } from '../../middleware/audit';
import type { Env, AppContext } from '../../types';

// ── Zod schemas ───────────────────────────────────────────────────────────────
export const CreateEmployeeSchema = z.object({
  firstName:       z.string().min(1),
  lastName:        z.string().min(1),
  preferredName:   z.string().optional(),
  email:           z.string().email(),
  departmentId:    z.string().optional().transform(v => v || undefined),
  designationId:   z.string().optional().transform(v => v || undefined),
  managerId:       z.string().optional().transform(v => v || undefined),
  orgUnitId:       z.string().optional().transform(v => v || undefined),
  dateOfBirth:     z.string().optional().transform(v => v || undefined),
  gender:          z.string().optional(),
  nationality:     z.string().optional(),
  startDate:       z.string().date(),
  employmentType:  z.enum(['full_time','part_time','contractor','intern','casual']),
  employmentBasis: z.enum(['permanent','fixed_term','zero_hours']).default('permanent'),
  contractType:    z.enum(['employed','self_employed','agency']).default('employed'),
  locationName:    z.string().optional(),
  locationType:    z.enum(['office','remote','hybrid']).default('office'),
  probationEndDate:z.string().optional().transform(v => v || undefined),
});

export const UpdateEmployeeSchema = CreateEmployeeSchema.partial().extend({
  changeReason: z.string().optional().default('correction'),
  photoUrl:     z.string().optional(),
});

// ── Service ───────────────────────────────────────────────────────────────────
async function rebuildClosureTable(db: D1Database, employeeId: string, managerId: string | null, tenantId: string) {
  // Remove old closure entries for this employee and all their direct reports
  await db.prepare(
    `DELETE FROM reporting_hierarchy WHERE employee_id = ? AND tenant_id = ?`
  ).bind(employeeId, tenantId).run();

  // Self-reference (depth 0)
  await db.prepare(
    `INSERT INTO reporting_hierarchy (employee_id, manager_id, depth, is_direct, tenant_id)
     VALUES (?, ?, 0, 0, ?)`
  ).bind(employeeId, employeeId, tenantId).run();

  if (!managerId) return;

  // Get all ancestors of the new manager
  const ancestors = await db.prepare(
    `SELECT manager_id, depth FROM reporting_hierarchy
     WHERE employee_id = ? AND tenant_id = ? AND depth >= 0
     ORDER BY depth`
  ).bind(managerId, tenantId).all();

  const stmts = (ancestors.results as { manager_id: string; depth: number }[]).map(a =>
    db.prepare(
      `INSERT INTO reporting_hierarchy (employee_id, manager_id, depth, is_direct, tenant_id)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(employeeId, a.manager_id, a.depth + 1, a.depth === 0 ? 1 : 0, tenantId)
  );
  if (stmts.length > 0) await db.batch(stmts);
}

// ── Routes ────────────────────────────────────────────────────────────────────
export async function handleEmployees(
  request: Request, env: Env, ctx: AppContext, subPath: string
): Promise<Response> {
  const segments = subPath.split('/').filter(Boolean);
  const id = segments[0];
  const action = segments[1];

  // GET /api/employees
  if (!id && request.method === 'GET') {
    const denied = requirePermission(ctx, 'hr:view:employee');
    if (denied) return denied;

    const url = new URL(request.url);
    const page     = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
    const limit    = Math.min(100, parseInt(url.searchParams.get('limit') ?? '25'));
    const search   = url.searchParams.get('search') ?? '';
    const deptId   = url.searchParams.get('departmentId');
    const status   = url.searchParams.get('status');
    const offset   = (page - 1) * limit;

    let where = 'e.tenant_id = ?';
    const params: unknown[] = [ctx.tenantId];

    if (search) {
      where += ` AND (eh.first_name || ' ' || eh.last_name LIKE ? OR u.email LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }
    if (deptId)  { where += ' AND eh.department_id = ?'; params.push(deptId); }
    if (status)  { where += ' AND e.status = ?'; params.push(status); }

    const countRow = await env.DB.prepare(
      `SELECT COUNT(*) as n FROM employees e
       JOIN employee_history eh ON eh.employee_id = e.id AND eh.is_current = 1
       JOIN users u ON u.id = e.user_id
       WHERE ${where}`
    ).bind(...params).first() as { n: number };

    const rows = await env.DB.prepare(
      `SELECT e.id, e.employee_number, e.status,
              eh.first_name, eh.last_name, eh.preferred_name,
              eh.employment_type, eh.work_location_type, eh.work_location,
              eh.department_id, eh.designation_id, eh.manager_id,
              eh.start_date, u.email
       FROM employees e
       JOIN employee_history eh ON eh.employee_id = e.id AND eh.is_current = 1
       JOIN users u ON u.id = e.user_id
       WHERE ${where}
       ORDER BY eh.last_name, eh.first_name
       LIMIT ? OFFSET ?`
    ).bind(...params, limit, offset).all();

    return ok({
      items: rows.results,
      meta: { total: countRow.n, page, limit, pages: Math.ceil(countRow.n / limit) },
    });
  }

  // POST /api/employees
  if (!id && request.method === 'POST') {
    const denied = requirePermission(ctx, 'hr:create:employee');
    if (denied) return denied;

    const body = await request.json().catch(() => null);
    const parsed = CreateEmployeeSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.issues[0].message);

    const d = parsed.data;
    const employeeId = crypto.randomUUID();
    const empNumber  = `EMP-${Date.now()}`;

    // Find existing user or create one for this employee
    let userId: string | null = null;
    const existingUser = await env.DB.prepare(
      'SELECT id FROM users WHERE email = ? AND tenant_id = ?'
    ).bind(d.email.toLowerCase(), ctx.tenantId).first() as any;

    if (existingUser) {
      userId = existingUser.id;
    } else {
      // Create a user account with invited status — they can set password later
      userId = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT INTO users (id, tenant_id, email, status, auth_provider, created_at)
        VALUES (?, ?, ?, 'invited', 'local', CURRENT_TIMESTAMP)
      `).bind(userId, ctx.tenantId, d.email.toLowerCase()).run();
    }

    await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO employees (id, tenant_id, user_id, employee_number, status, created_at, created_by)
        VALUES (?, ?, ?, ?, 'active', CURRENT_TIMESTAMP, ?)
      `).bind(employeeId, ctx.tenantId, userId, empNumber, ctx.userId),

      env.DB.prepare(`
        INSERT INTO employee_history (
          id, employee_id, tenant_id,
          first_name, last_name, preferred_name,
          date_of_birth, gender, nationality,
          department_id, designation_id, manager_id, org_unit_id,
          start_date, employment_type, employment_basis, contract_type,
          work_location_type, work_location,
          probation_status, probation_end_date,
          status, change_reason, changed_by,
          effective_from, is_current
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,1)
      `).bind(
        crypto.randomUUID(), employeeId, ctx.tenantId,
        d.firstName, d.lastName, d.preferredName ?? null,
        d.dateOfBirth ?? null, d.gender ?? null, d.nationality ?? null,
        d.departmentId ?? null, d.designationId ?? null, d.managerId ?? null, d.orgUnitId ?? null,
        d.startDate, d.employmentType, d.employmentBasis, d.contractType,
        d.locationType, d.locationName ?? null,
        'in_progress', d.probationEndDate ?? null,
        'active', 'new_hire', ctx.userId
      ),
    ]);

    if (d.managerId) {
      await rebuildClosureTable(env.DB, employeeId, d.managerId, ctx.tenantId);
    }

    await audit(env, {
      ...auditFromRequest(request, ctx),
      action: 'create', resource: 'employee', resourceId: employeeId,
    });

    return created({ id: employeeId });
  }

  // GET /api/employees/:id
  if (id && !action && request.method === 'GET') {
    const denied = requirePermission(ctx, 'hr:view:employee');
    if (denied) return denied;

    const row = await env.DB.prepare(`
      SELECT e.id, e.employee_number, e.status, e.created_at,
             eh.first_name, eh.last_name, eh.preferred_name, eh.middle_name,
             eh.date_of_birth, eh.gender, eh.pronouns, eh.nationality,
             eh.department_id, eh.designation_id, eh.manager_id, eh.org_unit_id,
             eh.start_date, eh.end_date, eh.employment_type, eh.employment_basis,
             eh.contract_type, eh.work_location_type, eh.work_location,
             eh.probation_status, eh.probation_end_date,
             e.user_id,
             u.email,
             d.name as department_name,
             des.title as designation_title,
             meh.first_name || ' ' || meh.last_name as manager_name
      FROM employees e
      JOIN employee_history eh ON eh.employee_id = e.id AND eh.is_current = 1
      JOIN users u ON u.id = e.user_id
      LEFT JOIN departments d ON d.id = eh.department_id
      LEFT JOIN designations des ON des.id = eh.designation_id
      LEFT JOIN employees mgr ON mgr.id = eh.manager_id
      LEFT JOIN employee_history meh ON meh.employee_id = mgr.id AND meh.is_current = 1
      WHERE e.id = ? AND e.tenant_id = ?
    `).bind(id, ctx.tenantId).first();

    if (!row) return notFound('Employee not found');
    return ok(row);
  }

  // GET /api/employees/:id/history
  if (id && action === 'history' && request.method === 'GET') {
    const denied = requirePermission(ctx, 'hr:view:employee');
    if (denied) return denied;

    const rows = await env.DB.prepare(`
      SELECT eh.*, u.email as changed_by_email
      FROM employee_history eh
      LEFT JOIN users u ON u.id = eh.changed_by
      WHERE eh.employee_id = ? AND eh.tenant_id = ?
      ORDER BY eh.effective_from DESC
    `).bind(id, ctx.tenantId).all();

    return ok(rows.results);
  }

  // PATCH /api/employees/:id
  if (id && !action && request.method === 'PATCH') {
    const denied = requirePermission(ctx, 'hr:edit:employee');
    if (denied) return denied;

    const body = await request.json().catch(() => null);
    const parsed = UpdateEmployeeSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.issues[0].message);

    const d = parsed.data;

    // Close out current history record
    await env.DB.prepare(
      `UPDATE employee_history SET is_current = 0, effective_to = CURRENT_TIMESTAMP
       WHERE employee_id = ? AND is_current = 1`
    ).bind(id).run();

    // Get previous values to build new row
    const prev = await env.DB.prepare(
      `SELECT * FROM employee_history WHERE employee_id = ? ORDER BY effective_to DESC LIMIT 1`
    ).bind(id).first() as any;

    if (!prev) return notFound('Employee history not found');

    await env.DB.prepare(`
      INSERT INTO employee_history (
        id, employee_id, tenant_id,
        first_name, last_name, preferred_name,
        date_of_birth, gender, nationality,
        department_id, designation_id, manager_id, org_unit_id,
        start_date, employment_type, employment_basis, contract_type,
        work_location_type, work_location,
        probation_status, probation_end_date,
        status, change_reason, changed_by,
        effective_from, is_current
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,1)
    `).bind(
      crypto.randomUUID(), id, ctx.tenantId,
      d.firstName       ?? prev.first_name,
      d.lastName        ?? prev.last_name,
      d.preferredName   ?? prev.preferred_name,
      d.dateOfBirth     ?? prev.date_of_birth,
      d.gender          ?? prev.gender,
      d.nationality     ?? prev.nationality,
      d.departmentId    ?? prev.department_id,
      d.designationId   ?? prev.designation_id,
      d.managerId       ?? prev.manager_id,
      d.orgUnitId       ?? prev.org_unit_id,
      prev.start_date,
      d.employmentType  ?? prev.employment_type,
      d.employmentBasis ?? prev.employment_basis,
      d.contractType    ?? prev.contract_type,
      d.locationType    ?? prev.work_location_type,
      d.locationName    ?? prev.work_location,
      prev.probation_status,
      d.probationEndDate ?? prev.probation_end_date,
      prev.status,
      d.changeReason,
      ctx.userId,
    ).run();

    if (d.managerId && d.managerId !== prev.manager_id) {
      await rebuildClosureTable(env.DB, id, d.managerId, ctx.tenantId);
    }

    await audit(env, {
      ...auditFromRequest(request, ctx),
      action: 'update', resource: 'employee', resourceId: id,
      changes: Object.fromEntries(
        Object.entries(d)
          .filter(([k]) => k !== 'changeReason')
          .map(([k, v]) => [k, { from: (prev as any)[k], to: v }])
      ),
    });

    return ok({ id, message: 'Employee updated' });
  }

  return err('Not found', 404);
}

// modules/roles/routes.ts
//
// Role assignment for employees. Reuses the existing roles, role_permissions,
// and user_roles tables — no schema changes. Gated on a new permission
// (hr:manage:roles) which flows automatically to role-hr-admin via the
// existing bulk module_key='hr' grant, and to super_admin via the wildcard,
// matching the access level the user confirmed (super_admin + hr_admin only).

import { ok, err }                  from '../../core/response';
import { requirePermission }        from '../../middleware/auth';
import { audit, auditFromRequest }  from '../../middleware/audit';
import type { Env, AppContext }     from '../../types';

export async function handleRoles(
  request: Request, env: Env, ctx: AppContext, subPath: string
): Promise<Response> {
  const method = request.method;

  // ── GET /api/roles — list all roles available in this tenant ────────────
  // Used to populate the "assign a role" dropdown. Available to anyone who
  // can manage roles; listing role names isn't itself sensitive.
  if (subPath === '' && method === 'GET') {
    const denied = requirePermission(ctx, 'hr:manage:roles');
    if (denied) return denied;

    const res = await env.DB.prepare(`
      SELECT id, name, description FROM roles WHERE tenant_id = ? ORDER BY name
    `).bind(ctx.tenantId).all();

    return ok({ roles: res.results ?? [] });
  }

  // ── GET /api/roles/employee/:employeeId — roles currently held by this employee ──
  // Takes an employees.id (consistent with every other employee-scoped
  // endpoint), and resolves to users.id internally — the frontend never
  // needs to know the distinction.
  if (subPath.startsWith('/employee/') && method === 'GET') {
    const denied = requirePermission(ctx, 'hr:manage:roles');
    if (denied) return denied;

    const employeeId = subPath.slice('/employee/'.length);
    const emp = await env.DB.prepare(
      `SELECT user_id FROM employees WHERE id = ? AND tenant_id = ?`
    ).bind(employeeId, ctx.tenantId).first() as any;
    if (!emp?.user_id) return err('Employee not found', 404);

    const res = await env.DB.prepare(`
      SELECT ur.id AS assignment_id, r.id AS role_id, r.name, r.description, ur.granted_at
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = ?
      ORDER BY r.name
    `).bind(emp.user_id).all();

    return ok({ roles: res.results ?? [] });
  }

  // ── POST /api/roles/employee/:employeeId — grant a role ──────────────────
  if (subPath.startsWith('/employee/') && method === 'POST') {
    const denied = requirePermission(ctx, 'hr:manage:roles');
    if (denied) return denied;

    const employeeId = subPath.slice('/employee/'.length);
    const body = await request.json().catch(() => null) as { roleId?: string } | null;
    if (!body?.roleId) return err('roleId is required', 400);

    const emp = await env.DB.prepare(
      `SELECT user_id FROM employees WHERE id = ? AND tenant_id = ?`
    ).bind(employeeId, ctx.tenantId).first() as any;
    if (!emp?.user_id) return err('Employee not found', 404);

    // Confirm the role actually belongs to this tenant — prevents granting
    // a role_id that happens to exist for a different tenant in a
    // multi-tenant deployment.
    const role = await env.DB.prepare(
      `SELECT id, name FROM roles WHERE id = ? AND tenant_id = ?`
    ).bind(body.roleId, ctx.tenantId).first() as any;
    if (!role) return err('Role not found', 404);

    const assignmentId = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT OR IGNORE INTO user_roles (id, user_id, role_id, scope_type, granted_by, granted_at)
      VALUES (?, ?, ?, 'tenant', ?, CURRENT_TIMESTAMP)
    `).bind(assignmentId, emp.user_id, body.roleId, ctx.userId).run();

    await audit(env, {
      ...auditFromRequest(request, ctx),
      action: 'grant', resource: 'user_role', resourceId: `${emp.user_id}:${body.roleId}`,
    });

    return ok({ granted: true, roleName: role.name });
  }

  // ── DELETE /api/roles/employee/:employeeId/:roleId — revoke a role ───────
  if (subPath.startsWith('/employee/') && method === 'DELETE') {
    const denied = requirePermission(ctx, 'hr:manage:roles');
    if (denied) return denied;

    const parts = subPath.slice('/employee/'.length).split('/');
    const employeeId = parts[0];
    const roleId = parts[1];
    if (!roleId) return err('roleId is required in path', 400);

    const emp = await env.DB.prepare(
      `SELECT user_id FROM employees WHERE id = ? AND tenant_id = ?`
    ).bind(employeeId, ctx.tenantId).first() as any;
    if (!emp?.user_id) return err('Employee not found', 404);

    // Guard rail: never allow revoking the LAST super_admin in the tenant —
    // a misclick here could otherwise lock everyone out of admin access
    // with no way back in except direct database access.
    const role = await env.DB.prepare(
      `SELECT name FROM roles WHERE id = ? AND tenant_id = ?`
    ).bind(roleId, ctx.tenantId).first() as any;

    if (role?.name === 'super_admin') {
      const superAdminCount = await env.DB.prepare(`
        SELECT COUNT(*) AS n FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE r.tenant_id = ? AND r.name = 'super_admin'
      `).bind(ctx.tenantId).first() as any;
      if ((superAdminCount?.n ?? 0) <= 1) {
        return err('Cannot remove the last super_admin in this tenant', 400);
      }
    }

    await env.DB.prepare(`
      DELETE FROM user_roles WHERE user_id = ? AND role_id = ?
    `).bind(emp.user_id, roleId).run();

    await audit(env, {
      ...auditFromRequest(request, ctx),
      action: 'revoke', resource: 'user_role', resourceId: `${emp.user_id}:${roleId}`,
    });

    return ok({ revoked: true });
  }

  return err('Not found', 404);
}

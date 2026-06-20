import { ok, err } from '../../core/response';
import { requirePermission } from '../../middleware/auth';
import { audit, auditFromRequest } from '../../middleware/audit';
import type { Env, AppContext } from '../../types';

export async function handleSettings(
  request: Request, env: Env, ctx: AppContext, subPath: string
): Promise<Response> {
  const [resource] = subPath.split('/').filter(Boolean);

  // GET /api/settings/branding
  if (resource === 'branding' && request.method === 'GET') {
    const branding = await env.DB.prepare(`
      SELECT * FROM tenant_branding WHERE tenant_id=?
    `).bind(ctx.tenantId).first();

    const settings = await env.DB.prepare(`
      SELECT key, value FROM tenant_settings WHERE tenant_id=?
    `).bind(ctx.tenantId).all() as any;

    const settingsMap: Record<string,string> = {};
    (settings.results ?? []).forEach((s: any) => { settingsMap[s.key] = s.value; });

    return ok({ branding, settings: settingsMap });
  }

  // PATCH /api/settings/branding
  if (resource === 'branding' && request.method === 'PATCH') {
    // Allow super_admin or hr admins
    const isSuperAdmin = ctx.permissions?.includes('*:*:*');
    if (!isSuperAdmin) {
      const denied = requirePermission(ctx, 'settings:manage:branding');
      if (denied) return denied;
    }

    const body = await request.json() as any;
    const allowed = ['company_name','primary_color','secondary_color','logo_url','favicon_url','login_html','email_template'];

    const sets = ['updated_at = CURRENT_TIMESTAMP'];
    const params: unknown[] = [];
    for (const [k, v] of Object.entries(body)) {
      if (allowed.includes(k)) { sets.push(`${k} = ?`); params.push(v); }
    }
    if (sets.length === 1) return err('No valid fields to update');

    await env.DB.prepare(`
      INSERT INTO tenant_branding (id, tenant_id, ${Object.keys(body).filter(k => allowed.includes(k)).join(', ')}, updated_at)
      VALUES (?, ?, ${Object.keys(body).filter(k => allowed.includes(k)).map(() => '?').join(', ')}, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET ${sets.join(', ')}
    `);

    // Simpler approach — just update
    await env.DB.prepare(
      `UPDATE tenant_branding SET ${sets.join(', ')} WHERE tenant_id=?`
    ).bind(...params, ctx.tenantId).run();

    await audit(env, { ...auditFromRequest(request, ctx), action:'update', resource:'tenant_branding', resourceId:ctx.tenantId });
    return ok({ updated: true });
  }

  // GET /api/settings/modules
  if (resource === 'modules' && request.method === 'GET') {
    const rows = await env.DB.prepare(`
      SELECT * FROM tenant_modules WHERE tenant_id=? ORDER BY module_key
    `).bind(ctx.tenantId).all();
    return ok(rows.results);
  }

  // PATCH /api/settings/modules/:moduleKey
  if (resource === 'modules' && request.method === 'PATCH') {
    // Allow super_admin or hr admins
    const isSuperAdmin = ctx.permissions?.includes('*:*:*');
    if (!isSuperAdmin) {
      const denied = requirePermission(ctx, 'settings:manage:branding');
      if (denied) return denied;
    }

    const url = new URL(request.url);
    const parts = subPath.split('/').filter(Boolean);
    const moduleKey = parts[1];
    if (!moduleKey) return err('Module key required');

    const { enabled } = await request.json() as any;
    await env.DB.prepare(
      `UPDATE tenant_modules SET enabled=? WHERE tenant_id=? AND module_key=?`
    ).bind(enabled ? 1 : 0, ctx.tenantId, moduleKey).run();
    return ok({ moduleKey, enabled });
  }

  // GET /api/settings/tenant
  if (resource === 'tenant' && request.method === 'GET') {
    const tenant = await env.DB.prepare(
      `SELECT id, name, subdomain, plan, status FROM tenants WHERE id=?`
    ).bind(ctx.tenantId).first();
    return ok(tenant);
  }

  // PATCH /api/settings/tenant
  if (resource === 'tenant' && request.method === 'PATCH') {
    // Allow super_admin or hr admins
    const isSuperAdmin = ctx.permissions?.includes('*:*:*');
    if (!isSuperAdmin) {
      const denied = requirePermission(ctx, 'settings:manage:branding');
      if (denied) return denied;
    }

    const body = await request.json() as any;
    const allowed = ['name'];
    const sets = [];
    const params: unknown[] = [];
    for (const [k, v] of Object.entries(body)) {
      if (allowed.includes(k)) { sets.push(`${k} = ?`); params.push(v); }
    }
    if (sets.length === 0) return err('No valid fields');
    await env.DB.prepare(`UPDATE tenants SET ${sets.join(', ')} WHERE id=?`).bind(...params, ctx.tenantId).run();
    return ok({ updated: true });
  }

  return err('Not found', 404);
}

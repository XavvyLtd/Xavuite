import { ok, err } from '../../core/response';
import { requirePermission } from '../../middleware/auth';
import { audit, auditFromRequest } from '../../middleware/audit';
import type { Env, AppContext } from '../../types';

// ── Helper: read all statutory keys into one object ──────────
const STATUTORY_KEYS = [
  'company_reg_number','vat_number','tax_reference',
  'reg_address_line1','reg_address_line2','reg_city','reg_county',
  'reg_postcode','reg_country','default_currency','default_tax_rate',
  'payment_terms_days','bank_name','bank_account_name','bank_account_number',
  'bank_sort_code','bank_iban','bank_bic','session_timeout_minutes',
];

async function getStatutory(env: Env, tenantId: string): Promise<Record<string, string>> {
  const rows = await env.DB.prepare(
    `SELECT key, value FROM tenant_settings WHERE tenant_id = ? AND key IN (${STATUTORY_KEYS.map(() => '?').join(',')})`
  ).bind(tenantId, ...STATUTORY_KEYS).all<{ key: string; value: string }>();

  const map: Record<string, string> = {};
  for (const row of rows.results) map[row.key] = row.value;
  return map;
}

async function setStatutoryKey(env: Env, tenantId: string, key: string, value: string) {
  await env.DB.prepare(`
    UPDATE tenant_settings SET value = ?, updated_at = CURRENT_TIMESTAMP
    WHERE tenant_id = ? AND key = ?
  `).bind(value ?? '', tenantId, key).run();
}

export async function handleSettings(
  request: Request, env: Env, ctx: AppContext, subPath: string
): Promise<Response> {
  const [resource] = subPath.split('/').filter(Boolean);

  // ── GET /api/settings/statutory ──────────────────────────────
  if (resource === 'statutory' && request.method === 'GET') {
    const data = await getStatutory(env, ctx.tenantId);
    return ok(data);
  }

  // ── PUT /api/settings/statutory ──────────────────────────────
  if (resource === 'statutory' && request.method === 'PUT') {
    const isSuperAdmin = ctx.permissions?.includes('*:*:*');
    if (!isSuperAdmin) { const denied = requirePermission(ctx, 'hr:manage:employee'); if (denied) return denied; }

    const body = await request.json() as Record<string, any>;

    // Update each known key that was sent
    for (const key of STATUTORY_KEYS) {
      if (key in body) {
        await setStatutoryKey(env, ctx.tenantId, key, String(body[key] ?? ''));
      }
    }

    // Bust KV cache for session timeout
    await env.KV.delete(`tenant_session_ttl:${ctx.tenantId}`);

    await audit(env, {
      ...auditFromRequest(request, ctx),
      action: 'update', resource: 'tenant_statutory', resourceId: ctx.tenantId,
    });
    return ok({ updated: true });
  }

  // ── GET /api/settings/branding ───────────────────────────────
  if (resource === 'branding' && request.method === 'GET') {
    const branding = await env.DB.prepare(
      `SELECT * FROM tenant_branding WHERE tenant_id=?`
    ).bind(ctx.tenantId).first();

    const settings = await env.DB.prepare(
      `SELECT key, value FROM tenant_settings WHERE tenant_id=?`
    ).bind(ctx.tenantId).all() as any;

    const settingsMap: Record<string, string> = {};
    (settings.results ?? []).forEach((s: any) => { settingsMap[s.key] = s.value; });

    return ok({ branding, settings: settingsMap });
  }

  // ── PATCH /api/settings/branding ─────────────────────────────
  if (resource === 'branding' && request.method === 'PATCH') {
    const isSuperAdmin = ctx.permissions?.includes('*:*:*');
    if (!isSuperAdmin) { const denied = requirePermission(ctx, 'hr:manage:employee'); if (denied) return denied; }

    const body = await request.json() as any;
    const allowed = ['company_name','primary_color','secondary_color','logo_url','favicon_url','login_html','email_template'];

    const sets = ['updated_at = CURRENT_TIMESTAMP'];
    const params: unknown[] = [];
    for (const [k, v] of Object.entries(body)) {
      if (allowed.includes(k)) { sets.push(`${k} = ?`); params.push(v); }
    }
    if (sets.length === 1) return err('No valid fields to update');

    await env.DB.prepare(
      `UPDATE tenant_branding SET ${sets.join(', ')} WHERE tenant_id=?`
    ).bind(...params, ctx.tenantId).run();

    await audit(env, { ...auditFromRequest(request, ctx), action: 'update', resource: 'tenant_branding', resourceId: ctx.tenantId });
    return ok({ updated: true });
  }

  // ── GET /api/settings/modules ─────────────────────────────────
  if (resource === 'modules' && request.method === 'GET') {
    const rows = await env.DB.prepare(
      `SELECT * FROM tenant_modules WHERE tenant_id=? ORDER BY module_key`
    ).bind(ctx.tenantId).all();
    return ok(rows.results);
  }

  // ── PATCH /api/settings/modules/:moduleKey ────────────────────
  if (resource === 'modules' && request.method === 'PATCH') {
    const isSuperAdmin = ctx.permissions?.includes('*:*:*');
    if (!isSuperAdmin) { const denied = requirePermission(ctx, 'hr:manage:employee'); if (denied) return denied; }

    const parts = subPath.split('/').filter(Boolean);
    const moduleKey = parts[1];
    if (!moduleKey) return err('Module key required');

    const { enabled } = await request.json() as any;
    await env.DB.prepare(
      `UPDATE tenant_modules SET enabled=? WHERE tenant_id=? AND module_key=?`
    ).bind(enabled ? 1 : 0, ctx.tenantId, moduleKey).run();
    return ok({ moduleKey, enabled });
  }

  // ── GET /api/settings/tenant ──────────────────────────────────
  if (resource === 'tenant' && request.method === 'GET') {
    const tenant = await env.DB.prepare(
      `SELECT id, name, subdomain, plan, status FROM tenants WHERE id=?`
    ).bind(ctx.tenantId).first();
    return ok(tenant);
  }

  // ── PATCH /api/settings/tenant ────────────────────────────────
  if (resource === 'tenant' && request.method === 'PATCH') {
    const isSuperAdmin = ctx.permissions?.includes('*:*:*');
    if (!isSuperAdmin) { const denied = requirePermission(ctx, 'hr:manage:employee'); if (denied) return denied; }

    const body = await request.json() as any;
    const allowed = ['name'];
    const sets: string[] = [];
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

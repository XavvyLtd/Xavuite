// modules/clients/routes.ts
// Follows the exact same pattern as employees/routes.ts, sos/routes.ts etc.

import { ok, created, err, notFound } from '../../core/response';
import { requirePermission }          from '../../middleware/auth';
import { audit, auditFromRequest }    from '../../middleware/audit';
import type { Env, AppContext }       from '../../types';

export async function handleClients(
  request: Request, env: Env, ctx: AppContext, subPath: string
): Promise<Response> {
  const method = request.method;
  const url    = new URL(request.url);

  // ── /api/clients/:id/contacts(/:contactId) ────────────────
  const contactsMatch = subPath.match(/^\/([^/]+)\/contacts(\/([^/]+))?$/);
  if (contactsMatch) {
    return handleContacts(request, env, ctx, contactsMatch[1], contactsMatch[3]);
  }

  const idMatch  = subPath.match(/^\/([^/]+)$/);
  const clientId = idMatch?.[1];

  // ── GET /api/clients ──────────────────────────────────────
  if (method === 'GET' && !clientId) {
    const denied = requirePermission(ctx, 'clients:view:client');
    if (denied) return denied;

    const page   = Math.max(1, parseInt(url.searchParams.get('page')   ?? '1'));
    const limit  = Math.min(100, parseInt(url.searchParams.get('limit') ?? '25'));
    const offset = (page - 1) * limit;
    const search = url.searchParams.get('search') ?? '';
    const active = url.searchParams.get('active') !== 'false';

    const where: string[] = ['c.tenant_id = ?'];
    const params: unknown[] = [ctx.tenantId];
    if (active) { where.push('c.is_active = 1'); }
    if (search) { where.push('(c.company_name LIKE ? OR c.trading_name LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
    const w = where.join(' AND ');

    const [rows, countRow] = await Promise.all([
      env.DB.prepare(`
        SELECT c.*,
          (SELECT COUNT(*) FROM pmo_projects p WHERE p.client_id = c.id AND p.tenant_id = c.tenant_id) AS project_count,
          (SELECT COUNT(*) FROM invoices i     WHERE i.client_id = c.id AND i.tenant_id = c.tenant_id AND i.status != 'void') AS invoice_count,
          lc.full_name AS primary_liaison_name,
          lc.email     AS primary_liaison_email,
          fc.full_name AS primary_finance_name,
          fc.email     AS primary_finance_email
        FROM clients c
        LEFT JOIN client_contacts lc ON lc.client_id = c.id AND lc.is_primary_liaison = 1
        LEFT JOIN client_contacts fc ON fc.client_id = c.id AND fc.is_primary_finance  = 1
        WHERE ${w}
        ORDER BY c.company_name ASC
        LIMIT ? OFFSET ?
      `).bind(...params, limit, offset).all(),
      env.DB.prepare(`SELECT COUNT(*) AS n FROM clients c WHERE ${w}`).bind(...params).first<{ n: number }>(),
    ]);

    return ok({ clients: rows.results, meta: { total: countRow?.n ?? 0, page, limit } });
  }

  // ── GET /api/clients/:id ──────────────────────────────────
  if (method === 'GET' && clientId) {
    const denied = requirePermission(ctx, 'clients:view:client');
    if (denied) return denied;

    const client = await env.DB.prepare(
      `SELECT * FROM clients WHERE id = ? AND tenant_id = ?`
    ).bind(clientId, ctx.tenantId).first();
    if (!client) return notFound('Client not found');

    const [contacts, projects] = await Promise.all([
      env.DB.prepare(
        `SELECT * FROM client_contacts WHERE client_id = ? AND tenant_id = ? ORDER BY is_primary_liaison DESC, is_primary_finance DESC, full_name ASC`
      ).bind(clientId, ctx.tenantId).all(),
      env.DB.prepare(
        `SELECT id, name, status, start_date, end_date, budget FROM pmo_projects WHERE client_id = ? AND tenant_id = ? ORDER BY start_date DESC`
      ).bind(clientId, ctx.tenantId).all(),
    ]);

    return ok({ ...client, contacts: contacts.results, projects: projects.results });
  }

  // ── POST /api/clients ─────────────────────────────────────
  if (method === 'POST' && !clientId) {
    const denied = requirePermission(ctx, 'clients:create:client');
    if (denied) return denied;

    const body: any = await request.json();
    if (!body.company_name?.trim()) return err('company_name is required');

    const id = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO clients (
        id, tenant_id, company_name, trading_name, industry, website,
        reg_address_line1, reg_address_line2, reg_city, reg_county, reg_postcode, reg_country,
        company_reg_number, vat_number, tax_reference,
        payment_terms_days, currency_code, invoice_email, invoice_cc, notes, is_active, created_by
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?)
    `).bind(
      id, ctx.tenantId,
      body.company_name,         body.trading_name       ?? null,
      body.industry              ?? null, body.website   ?? null,
      body.reg_address_line1     ?? null, body.reg_address_line2 ?? null,
      body.reg_city              ?? null, body.reg_county ?? null,
      body.reg_postcode          ?? null, body.reg_country ?? 'United Kingdom',
      body.company_reg_number    ?? null, body.vat_number ?? null,
      body.tax_reference         ?? null,
      body.payment_terms_days    ?? 30,   body.currency_code ?? 'GBP',
      body.invoice_email         ?? null, body.invoice_cc ?? null,
      body.notes                 ?? null, ctx.userId
    ).run();

    await audit(env, { ...auditFromRequest(request, ctx), action: 'create', resource: 'client', resourceId: id });
    return created({ id });
  }

  // ── PUT /api/clients/:id ──────────────────────────────────
  if (method === 'PUT' && clientId) {
    const denied = requirePermission(ctx, 'clients:edit:client');
    if (denied) return denied;

    const body: any = await request.json();
    const result = await env.DB.prepare(`
      UPDATE clients SET
        company_name = ?, trading_name = ?, industry = ?, website = ?,
        reg_address_line1 = ?, reg_address_line2 = ?, reg_city = ?, reg_county = ?,
        reg_postcode = ?, reg_country = ?,
        company_reg_number = ?, vat_number = ?, tax_reference = ?,
        payment_terms_days = ?, currency_code = ?,
        invoice_email = ?, invoice_cc = ?, notes = ?, is_active = ?,
        updated_at = datetime('now')
      WHERE id = ? AND tenant_id = ?
    `).bind(
      body.company_name,      body.trading_name       ?? null,
      body.industry           ?? null, body.website   ?? null,
      body.reg_address_line1  ?? null, body.reg_address_line2 ?? null,
      body.reg_city           ?? null, body.reg_county ?? null,
      body.reg_postcode       ?? null, body.reg_country ?? 'United Kingdom',
      body.company_reg_number ?? null, body.vat_number ?? null, body.tax_reference ?? null,
      body.payment_terms_days ?? 30,   body.currency_code ?? 'GBP',
      body.invoice_email      ?? null, body.invoice_cc ?? null,
      body.notes              ?? null, body.is_active !== false ? 1 : 0,
      clientId, ctx.tenantId
    ).run();

    await audit(env, { ...auditFromRequest(request, ctx), action: 'update', resource: 'client', resourceId: clientId });
    return ok({ updated: true });
  }

  // ── DELETE /api/clients/:id (soft-delete only — may have invoices) ─────────
  if (method === 'DELETE' && clientId) {
    const denied = requirePermission(ctx, 'clients:delete:client');
    if (denied) return denied;

    await env.DB.prepare(
      `UPDATE clients SET is_active = 0, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?`
    ).bind(clientId, ctx.tenantId).run();

    await audit(env, { ...auditFromRequest(request, ctx), action: 'delete', resource: 'client', resourceId: clientId });
    return ok({ deactivated: true });
  }

  return notFound();
}

// ── Contacts ──────────────────────────────────────────────────
async function handleContacts(
  request: Request, env: Env, ctx: AppContext,
  clientId: string, contactId?: string
): Promise<Response> {
  const method = request.method;

  if (method === 'GET') {
    const denied = requirePermission(ctx, 'clients:view:client');
    if (denied) return denied;
    const rows = await env.DB.prepare(
      `SELECT * FROM client_contacts WHERE client_id = ? AND tenant_id = ? ORDER BY is_primary_liaison DESC, is_primary_finance DESC, full_name ASC`
    ).bind(clientId, ctx.tenantId).all();
    return ok(rows.results);
  }

  if (method === 'POST') {
    const denied = requirePermission(ctx, 'clients:edit:client');
    if (denied) return denied;
    const body: any = await request.json();
    if (!body.full_name?.trim()) return err('full_name is required');
    const id = crypto.randomUUID();

    // Demote existing primary if this one is being set as primary
    if (body.is_primary_liaison) await env.DB.prepare(`UPDATE client_contacts SET is_primary_liaison = 0 WHERE client_id = ? AND tenant_id = ?`).bind(clientId, ctx.tenantId).run();
    if (body.is_primary_finance) await env.DB.prepare(`UPDATE client_contacts SET is_primary_finance  = 0 WHERE client_id = ? AND tenant_id = ?`).bind(clientId, ctx.tenantId).run();

    await env.DB.prepare(`
      INSERT INTO client_contacts (id, tenant_id, client_id, full_name, job_title, email, phone, whatsapp, contact_type, is_primary_liaison, is_primary_finance, notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      id, ctx.tenantId, clientId,
      body.full_name, body.job_title ?? null, body.email ?? null,
      body.phone ?? null, body.whatsapp ?? null, body.contact_type ?? 'liaison',
      body.is_primary_liaison ? 1 : 0, body.is_primary_finance ? 1 : 0, body.notes ?? null
    ).run();
    return created({ id });
  }

  if (method === 'PUT' && contactId) {
    const denied = requirePermission(ctx, 'clients:edit:client');
    if (denied) return denied;
    const body: any = await request.json();

    if (body.is_primary_liaison) await env.DB.prepare(`UPDATE client_contacts SET is_primary_liaison = 0 WHERE client_id = ? AND tenant_id = ?`).bind(clientId, ctx.tenantId).run();
    if (body.is_primary_finance) await env.DB.prepare(`UPDATE client_contacts SET is_primary_finance  = 0 WHERE client_id = ? AND tenant_id = ?`).bind(clientId, ctx.tenantId).run();

    await env.DB.prepare(`
      UPDATE client_contacts SET
        full_name = ?, job_title = ?, email = ?, phone = ?, whatsapp = ?,
        contact_type = ?, is_primary_liaison = ?, is_primary_finance = ?, notes = ?
      WHERE id = ? AND client_id = ? AND tenant_id = ?
    `).bind(
      body.full_name, body.job_title ?? null, body.email ?? null,
      body.phone ?? null, body.whatsapp ?? null, body.contact_type ?? 'liaison',
      body.is_primary_liaison ? 1 : 0, body.is_primary_finance ? 1 : 0, body.notes ?? null,
      contactId, clientId, ctx.tenantId
    ).run();
    return ok({ updated: true });
  }

  if (method === 'DELETE' && contactId) {
    const denied = requirePermission(ctx, 'clients:edit:client');
    if (denied) return denied;
    await env.DB.prepare(`DELETE FROM client_contacts WHERE id = ? AND client_id = ? AND tenant_id = ?`).bind(contactId, clientId, ctx.tenantId).run();
    return ok({ deleted: true });
  }

  return notFound();
}

// modules/clients/handler.ts
// XavvySuite — Clients module (company, contacts, statutory details)

import { requirePermission } from '../../core/rbac';
import { auditLog } from '../../core/audit';
import { json, err, paginate } from '../../core/utils';

export async function clientsHandler(
  req: Request, env: Env, ctx: ExecutionContext, subPath: string
): Promise<Response> {
  const { tenantId, userId } = ctx as any;
  const method = req.method;
  const url = new URL(req.url);

  // ── /api/clients/:id/contacts ─────────────────────────────
  const contactsMatch = subPath.match(/^\/([^/]+)\/contacts(\/([^/]+))?$/);
  if (contactsMatch) {
    const clientId = contactsMatch[1];
    const contactId = contactsMatch[3];
    return contactsHandler(req, env, ctx, { tenantId, userId, clientId, contactId });
  }

  // ── /api/clients/:id ──────────────────────────────────────
  const idMatch = subPath.match(/^\/([^/]+)$/);
  const clientId = idMatch?.[1];

  // ── GET /api/clients ──────────────────────────────────────
  if (method === 'GET' && !clientId) {
    await requirePermission(ctx, 'clients:view');
    const { limit, offset } = paginate(url);
    const search = url.searchParams.get('search') ?? '';
    const activeOnly = url.searchParams.get('active') !== 'false';

    const where: string[] = ['c.tenant_id = ?'];
    const params: any[] = [tenantId];
    if (activeOnly) { where.push('c.is_active = 1'); }
    if (search) {
      where.push('(c.company_name LIKE ? OR c.trading_name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    const whereStr = where.join(' AND ');

    const [rows, countRow] = await Promise.all([
      env.DB.prepare(`
        SELECT c.*,
          (SELECT COUNT(*) FROM pmo_projects p WHERE p.client_id = c.id AND p.tenant_id = c.tenant_id) AS project_count,
          (SELECT COUNT(*) FROM invoices i WHERE i.client_id = c.id AND i.tenant_id = c.tenant_id AND i.status NOT IN ('void')) AS invoice_count,
          lc.full_name AS primary_liaison_name, lc.email AS primary_liaison_email,
          fc.full_name AS primary_finance_name, fc.email AS primary_finance_email
        FROM clients c
        LEFT JOIN client_contacts lc ON lc.client_id = c.id AND lc.is_primary_liaison = 1
        LEFT JOIN client_contacts fc ON fc.client_id = c.id AND fc.is_primary_finance = 1
        WHERE ${whereStr}
        ORDER BY c.company_name ASC
        LIMIT ? OFFSET ?
      `).bind(...params, limit, offset).all(),
      env.DB.prepare(`SELECT COUNT(*) AS n FROM clients c WHERE ${whereStr}`).bind(...params).first<{ n: number }>(),
    ]);

    return json({ clients: rows.results, total: countRow?.n ?? 0, limit, offset });
  }

  // ── GET /api/clients/:id ──────────────────────────────────
  if (method === 'GET' && clientId) {
    await requirePermission(ctx, 'clients:view');
    const client = await env.DB.prepare(
      `SELECT * FROM clients WHERE id = ? AND tenant_id = ?`
    ).bind(clientId, tenantId).first();
    if (!client) return err('Client not found', 404);

    const contacts = await env.DB.prepare(
      `SELECT * FROM client_contacts WHERE client_id = ? AND tenant_id = ? ORDER BY is_primary_liaison DESC, is_primary_finance DESC, full_name ASC`
    ).bind(clientId, tenantId).all();

    const projects = await env.DB.prepare(
      `SELECT id, name, status, start_date, end_date, budget FROM pmo_projects WHERE client_id = ? AND tenant_id = ? ORDER BY start_date DESC`
    ).bind(clientId, tenantId).all();

    return json({ ...client, contacts: contacts.results, projects: projects.results });
  }

  // ── POST /api/clients ─────────────────────────────────────
  if (method === 'POST' && !clientId) {
    await requirePermission(ctx, 'clients:create');
    const body: any = await req.json();
    const id = crypto.randomUUID().replace(/-/g, '');
    await env.DB.prepare(`
      INSERT INTO clients (
        id, tenant_id, company_name, trading_name, industry, website,
        reg_address_line1, reg_address_line2, reg_city, reg_county, reg_postcode, reg_country,
        company_reg_number, vat_number, tax_reference,
        payment_terms_days, currency_code,
        invoice_email, invoice_cc, notes, is_active, created_by
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?)
    `).bind(
      id, tenantId,
      body.company_name, body.trading_name ?? null, body.industry ?? null, body.website ?? null,
      body.reg_address_line1 ?? null, body.reg_address_line2 ?? null,
      body.reg_city ?? null, body.reg_county ?? null, body.reg_postcode ?? null,
      body.reg_country ?? 'United Kingdom',
      body.company_reg_number ?? null, body.vat_number ?? null, body.tax_reference ?? null,
      body.payment_terms_days ?? 30, body.currency_code ?? 'GBP',
      body.invoice_email ?? null, body.invoice_cc ?? null, body.notes ?? null,
      userId
    ).run();

    await auditLog(env, tenantId, userId, 'clients', 'create', id, null, body);
    return json({ id }, 201);
  }

  // ── PUT /api/clients/:id ──────────────────────────────────
  if (method === 'PUT' && clientId) {
    await requirePermission(ctx, 'clients:edit');
    const body: any = await req.json();
    await env.DB.prepare(`
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
      body.company_name, body.trading_name ?? null, body.industry ?? null, body.website ?? null,
      body.reg_address_line1 ?? null, body.reg_address_line2 ?? null,
      body.reg_city ?? null, body.reg_county ?? null,
      body.reg_postcode ?? null, body.reg_country ?? 'United Kingdom',
      body.company_reg_number ?? null, body.vat_number ?? null, body.tax_reference ?? null,
      body.payment_terms_days ?? 30, body.currency_code ?? 'GBP',
      body.invoice_email ?? null, body.invoice_cc ?? null, body.notes ?? null,
      body.is_active ? 1 : 0,
      clientId, tenantId
    ).run();

    await auditLog(env, tenantId, userId, 'clients', 'update', clientId, null, body);
    return json({ ok: true });
  }

  // ── DELETE /api/clients/:id ───────────────────────────────
  if (method === 'DELETE' && clientId) {
    await requirePermission(ctx, 'clients:delete');
    // Soft-delete only — clients may have invoices
    await env.DB.prepare(
      `UPDATE clients SET is_active = 0, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?`
    ).bind(clientId, tenantId).run();
    await auditLog(env, tenantId, userId, 'clients', 'deactivate', clientId, null, null);
    return json({ ok: true });
  }

  return err('Not found', 404);
}

// ── Contacts sub-handler ──────────────────────────────────────
async function contactsHandler(
  req: Request, env: Env, ctx: ExecutionContext,
  { tenantId, userId, clientId, contactId }: any
): Promise<Response> {
  const method = req.method;

  if (method === 'GET') {
    await requirePermission(ctx, 'clients:view');
    const rows = await env.DB.prepare(
      `SELECT * FROM client_contacts WHERE client_id = ? AND tenant_id = ? ORDER BY is_primary_liaison DESC, is_primary_finance DESC, full_name ASC`
    ).bind(clientId, tenantId).all();
    return json(rows.results);
  }

  if (method === 'POST') {
    await requirePermission(ctx, 'clients:edit');
    const body: any = await req.json();
    const id = crypto.randomUUID().replace(/-/g, '');

    // If new primary liaison/finance, demote existing
    if (body.is_primary_liaison) {
      await env.DB.prepare(`UPDATE client_contacts SET is_primary_liaison = 0 WHERE client_id = ? AND tenant_id = ?`)
        .bind(clientId, tenantId).run();
    }
    if (body.is_primary_finance) {
      await env.DB.prepare(`UPDATE client_contacts SET is_primary_finance = 0 WHERE client_id = ? AND tenant_id = ?`)
        .bind(clientId, tenantId).run();
    }

    await env.DB.prepare(`
      INSERT INTO client_contacts (id, tenant_id, client_id, full_name, job_title, email, phone, whatsapp, contact_type, is_primary_liaison, is_primary_finance, notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      id, tenantId, clientId,
      body.full_name, body.job_title ?? null, body.email ?? null,
      body.phone ?? null, body.whatsapp ?? null,
      body.contact_type ?? 'liaison',
      body.is_primary_liaison ? 1 : 0,
      body.is_primary_finance ? 1 : 0,
      body.notes ?? null
    ).run();
    return json({ id }, 201);
  }

  if (method === 'PUT' && contactId) {
    await requirePermission(ctx, 'clients:edit');
    const body: any = await req.json();
    if (body.is_primary_liaison) {
      await env.DB.prepare(`UPDATE client_contacts SET is_primary_liaison = 0 WHERE client_id = ? AND tenant_id = ?`)
        .bind(clientId, tenantId).run();
    }
    if (body.is_primary_finance) {
      await env.DB.prepare(`UPDATE client_contacts SET is_primary_finance = 0 WHERE client_id = ? AND tenant_id = ?`)
        .bind(clientId, tenantId).run();
    }
    await env.DB.prepare(`
      UPDATE client_contacts SET
        full_name = ?, job_title = ?, email = ?, phone = ?, whatsapp = ?,
        contact_type = ?, is_primary_liaison = ?, is_primary_finance = ?, notes = ?
      WHERE id = ? AND client_id = ? AND tenant_id = ?
    `).bind(
      body.full_name, body.job_title ?? null, body.email ?? null,
      body.phone ?? null, body.whatsapp ?? null,
      body.contact_type ?? 'liaison',
      body.is_primary_liaison ? 1 : 0,
      body.is_primary_finance ? 1 : 0,
      body.notes ?? null,
      contactId, clientId, tenantId
    ).run();
    return json({ ok: true });
  }

  if (method === 'DELETE' && contactId) {
    await requirePermission(ctx, 'clients:edit');
    await env.DB.prepare(`DELETE FROM client_contacts WHERE id = ? AND client_id = ? AND tenant_id = ?`)
      .bind(contactId, clientId, tenantId).run();
    return json({ ok: true });
  }

  return err('Not found', 404);
}

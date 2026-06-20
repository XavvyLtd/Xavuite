// modules/invoicing/routes.ts

import { ok, created, err, notFound } from '../../core/response';
import { requirePermission }          from '../../middleware/auth';
import { audit, auditFromRequest }    from '../../middleware/audit';
import { sendMail }                   from '../../core/email';
import type { Env, AppContext }       from '../../types';

export async function handleInvoicing(
  request: Request, env: Env, ctx: AppContext, subPath: string
): Promise<Response> {
  const method = request.method;
  const url    = new URL(request.url);

  // ── Action sub-routes (check before id match) ─────────────
  const sendMatch   = subPath.match(/^\/([^/]+)\/send$/);
  if (sendMatch)   return handleSend(request, env, ctx, sendMatch[1]);

  const payMatch    = subPath.match(/^\/([^/]+)\/pay$/);
  if (payMatch)    return handlePay(request, env, ctx, payMatch[1]);

  const voidMatch   = subPath.match(/^\/([^/]+)\/void$/);
  if (voidMatch)   return handleVoid(request, env, ctx, voidMatch[1]);

  const eventsMatch = subPath.match(/^\/([^/]+)\/events$/);
  if (eventsMatch && method === 'GET') return handleEvents(env, ctx, eventsMatch[1]);

  const linesMatch  = subPath.match(/^\/([^/]+)\/lines(\/([^/]+))?$/);
  if (linesMatch)  return handleLines(request, env, ctx, linesMatch[1], linesMatch[3]);

  if (subPath === '/pull-timesheets' && method === 'POST') return handlePullTimesheets(request, env, ctx);

  const idMatch   = subPath.match(/^\/([^/]+)$/);
  const invoiceId = idMatch?.[1];

  // ── GET /api/invoices ─────────────────────────────────────
  if (method === 'GET' && !invoiceId) {
    const denied = requirePermission(ctx, 'invoicing:view:invoice');
    if (denied) return denied;

    const page   = Math.max(1, parseInt(url.searchParams.get('page')   ?? '1'));
    const limit  = Math.min(100, parseInt(url.searchParams.get('limit') ?? '25'));
    const offset = (page - 1) * limit;

    const where: string[] = ['i.tenant_id = ?'];
    const params: unknown[] = [ctx.tenantId];
    const status   = url.searchParams.get('status');
    const clientId = url.searchParams.get('client_id');
    const from     = url.searchParams.get('from');
    const to       = url.searchParams.get('to');
    if (status)   { where.push('i.status = ?');      params.push(status); }
    if (clientId) { where.push('i.client_id = ?');   params.push(clientId); }
    if (from)     { where.push('i.issue_date >= ?'); params.push(from); }
    if (to)       { where.push('i.issue_date <= ?'); params.push(to); }
    const w = where.join(' AND ');

    // Auto-flag overdue on every list request
    await env.DB.prepare(
      `UPDATE invoices SET status='overdue', updated_at=datetime('now') WHERE tenant_id=? AND status='sent' AND due_date < date('now')`
    ).bind(ctx.tenantId).run().catch(() => {});

    const [rows, countRow] = await Promise.all([
      env.DB.prepare(`
        SELECT i.*, c.company_name AS client_name, c.invoice_email AS client_email
        FROM invoices i
        JOIN clients c ON c.id = i.client_id
        WHERE ${w}
        ORDER BY i.issue_date DESC, i.created_at DESC
        LIMIT ? OFFSET ?
      `).bind(...params, limit, offset).all(),
      env.DB.prepare(`SELECT COUNT(*) AS n FROM invoices i WHERE ${w}`).bind(...params).first<{ n: number }>(),
    ]);

    return ok({ invoices: rows.results, meta: { total: countRow?.n ?? 0, page, limit } });
  }

  // ── GET /api/invoices/:id ─────────────────────────────────
  if (method === 'GET' && invoiceId) {
    const denied = requirePermission(ctx, 'invoicing:view:invoice');
    if (denied) return denied;

    const invoice = await env.DB.prepare(
      `SELECT * FROM invoices WHERE id = ? AND tenant_id = ?`
    ).bind(invoiceId, ctx.tenantId).first();
    if (!invoice) return notFound('Invoice not found');

    const [lines, client, tenantSettings] = await Promise.all([
      env.DB.prepare(`SELECT * FROM invoice_line_items WHERE invoice_id = ? ORDER BY sort_order ASC`).bind(invoiceId).all(),
      env.DB.prepare(`SELECT * FROM clients WHERE id = ? AND tenant_id = ?`).bind((invoice as any).client_id, ctx.tenantId).first(),
      env.DB.prepare(`SELECT key, value FROM tenant_settings WHERE tenant_id = ? AND key IN ('company_reg_number','vat_number','reg_address_line1','reg_city','reg_postcode','reg_country','bank_name','bank_account_name','bank_account_number','bank_sort_code','bank_iban')`)
        .bind(ctx.tenantId).all<{ key: string; value: string }>(),
    ]);

    const tenantInfo: Record<string, string> = {};
    for (const row of tenantSettings.results) tenantInfo[row.key] = row.value;

    return ok({ ...invoice, lines: lines.results, client, tenantInfo });
  }

  // ── POST /api/invoices ────────────────────────────────────
  if (method === 'POST' && !invoiceId) {
    const denied = requirePermission(ctx, 'invoicing:create:invoice');
    if (denied) return denied;

    const body: any = await request.json();
    if (!body.client_id) return err('client_id is required');

    // Generate invoice number INV-YYYY-NNNN
    const year = new Date().getFullYear();
    await env.DB.prepare(`
      INSERT INTO invoice_sequences (tenant_id, year, last_seq) VALUES (?, ?, 1)
      ON CONFLICT(tenant_id) DO UPDATE SET
        last_seq = CASE WHEN year = excluded.year THEN last_seq + 1 ELSE 1 END,
        year     = excluded.year
    `).bind(ctx.tenantId, year).run();

    const seqRow = await env.DB.prepare(
      `SELECT last_seq FROM invoice_sequences WHERE tenant_id = ?`
    ).bind(ctx.tenantId).first<{ last_seq: number }>();
    const invoiceNumber = `INV-${year}-${String(seqRow?.last_seq ?? 1).padStart(4, '0')}`;

    const client    = await env.DB.prepare(`SELECT currency_code, payment_terms_days FROM clients WHERE id = ? AND tenant_id = ?`).bind(body.client_id, ctx.tenantId).first<any>();
    const id        = crypto.randomUUID();
    const issueDate = body.issue_date ?? new Date().toISOString().split('T')[0];
    const termDays  = body.payment_terms_days ?? client?.payment_terms_days ?? 30;
    const dueDate   = body.due_date ?? offsetDate(issueDate, termDays);

    await env.DB.prepare(`
      INSERT INTO invoices (id, tenant_id, client_id, invoice_number, status,
        issue_date, due_date, subtotal, tax_rate, tax_amount, total,
        currency_code, notes_to_client, internal_notes, created_by)
      VALUES (?,?,?,?,'draft',?,?,0,?,0,0,?,?,?,?)
    `).bind(
      id, ctx.tenantId, body.client_id, invoiceNumber,
      issueDate, dueDate,
      body.tax_rate ?? 20,
      client?.currency_code ?? 'GBP',
      body.notes_to_client ?? null,
      body.internal_notes  ?? null,
      ctx.userId
    ).run();

    if (Array.isArray(body.lines) && body.lines.length > 0) {
      await upsertLines(env, id, ctx.tenantId, body.lines);
      await recalcTotals(env, id, ctx.tenantId);
    }

    await logEvent(env, id, ctx.tenantId, 'created', ctx.userId ?? '', ctx.userEmail);
    await audit(env, { ...auditFromRequest(request, ctx), action: 'create', resource: 'invoice', resourceId: id });
    return created({ id, invoice_number: invoiceNumber });
  }

  // ── PUT /api/invoices/:id ─────────────────────────────────
  if (method === 'PUT' && invoiceId) {
    const denied = requirePermission(ctx, 'invoicing:edit:invoice');
    if (denied) return denied;

    const existing = await env.DB.prepare(`SELECT status FROM invoices WHERE id = ? AND tenant_id = ?`).bind(invoiceId, ctx.tenantId).first<any>();
    if (!existing)                  return notFound('Invoice not found');
    if (existing.status === 'void') return err('Cannot edit a voided invoice', 400);

    const body: any = await request.json();
    await env.DB.prepare(`
      UPDATE invoices SET
        issue_date = ?, due_date = ?, tax_rate = ?,
        notes_to_client = ?, internal_notes = ?,
        updated_at = datetime('now')
      WHERE id = ? AND tenant_id = ?
    `).bind(
      body.issue_date, body.due_date, body.tax_rate ?? 20,
      body.notes_to_client ?? null, body.internal_notes ?? null,
      invoiceId, ctx.tenantId
    ).run();

    if (Array.isArray(body.lines)) {
      await env.DB.prepare(`DELETE FROM invoice_line_items WHERE invoice_id = ?`).bind(invoiceId).run();
      if (body.lines.length > 0) await upsertLines(env, invoiceId, ctx.tenantId, body.lines);
    }

    await recalcTotals(env, invoiceId, ctx.tenantId);
    await logEvent(env, invoiceId, ctx.tenantId, 'edited', ctx.userId ?? '', ctx.userEmail);
    return ok({ updated: true });
  }

  return notFound();
}

// ── Send ──────────────────────────────────────────────────────
async function handleSend(request: Request, env: Env, ctx: AppContext, invoiceId: string): Promise<Response> {
  const denied = requirePermission(ctx, 'invoicing:send:invoice');
  if (denied) return denied;

  // Fetch invoice + client + line items + tenant bank details in one go
  const invoice = await env.DB.prepare(`
    SELECT i.*, c.company_name, c.invoice_email, c.invoice_cc,
           c.reg_address_line1, c.reg_city, c.reg_postcode, c.reg_country,
           c.company_reg_number AS client_reg_number, c.vat_number AS client_vat
    FROM invoices i JOIN clients c ON c.id = i.client_id
    WHERE i.id = ? AND i.tenant_id = ?
  `).bind(invoiceId, ctx.tenantId).first<any>();
  if (!invoice)                  return notFound('Invoice not found');
  if (invoice.status === 'void') return err('Cannot send a voided invoice', 400);

  const [lines, tenantSettings] = await Promise.all([
    env.DB.prepare(`SELECT * FROM invoice_line_items WHERE invoice_id = ? ORDER BY sort_order`).bind(invoiceId).all(),
    env.DB.prepare(`SELECT key, value FROM tenant_settings WHERE tenant_id = ? AND key IN ('company_reg_number','vat_number','reg_address_line1','reg_city','reg_postcode','reg_country','bank_name','bank_account_name','bank_account_number','bank_sort_code','bank_iban','bank_bic')`).bind(ctx.tenantId).all<{ key: string; value: string }>(),
  ]);

  const ts: Record<string, string> = {};
  for (const r of tenantSettings.results) ts[r.key] = r.value;

  const body: any = await request.json().catch(() => ({}));
  const toEmail   = body.to ?? invoice.invoice_email;
  if (!toEmail) return err('No recipient email — add an invoice_email to the client record', 400);

  const fmtCcy = (n: number) => `${invoice.currency_code ?? 'GBP'} ${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Build line items rows
  const lineRows = (lines.results as any[]).map(l => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;">${l.description}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;">${Number(l.quantity)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;">${fmtCcy(l.unit_price)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;font-weight:600;">${fmtCcy(l.amount)}</td>
    </tr>`).join('');

  // Build bank details section
  const bankHtml = (ts.bank_name || ts.bank_account_number) ? `
    <div style="margin-top:24px;padding:16px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
      <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Payment details</p>
      ${ts.bank_name            ? `<p style="margin:2px 0;font-size:13px;"><strong>Bank:</strong> ${ts.bank_name}</p>` : ''}
      ${ts.bank_account_name    ? `<p style="margin:2px 0;font-size:13px;"><strong>Account name:</strong> ${ts.bank_account_name}</p>` : ''}
      ${ts.bank_account_number  ? `<p style="margin:2px 0;font-size:13px;"><strong>Account number:</strong> ${ts.bank_account_number}</p>` : ''}
      ${ts.bank_sort_code       ? `<p style="margin:2px 0;font-size:13px;"><strong>Sort code:</strong> ${ts.bank_sort_code}</p>` : ''}
      ${ts.bank_iban            ? `<p style="margin:2px 0;font-size:13px;"><strong>IBAN:</strong> ${ts.bank_iban}</p>` : ''}
      ${ts.bank_bic             ? `<p style="margin:2px 0;font-size:13px;"><strong>BIC/SWIFT:</strong> ${ts.bank_bic}</p>` : ''}
    </div>` : '';

  const tenantAddress = [ts.reg_address_line1, ts.reg_city, ts.reg_postcode, ts.reg_country].filter(Boolean).join(', ');
  const clientAddress = [invoice.reg_address_line1, invoice.reg_city, invoice.reg_postcode, invoice.reg_country].filter(Boolean).join(', ');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
<div style="max-width:680px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

  <!-- Header -->
  <div style="background:#0F172A;padding:28px 32px;display:flex;justify-content:space-between;align-items:flex-start;">
    <div>
      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:800;">${env.TENANT_NAME ?? 'Invoice'}</h1>
      ${tenantAddress ? `<p style="margin:4px 0 0;color:#94A3B8;font-size:12px;">${tenantAddress}</p>` : ''}
      ${ts.company_reg_number ? `<p style="margin:2px 0 0;color:#94A3B8;font-size:11px;">Co. Reg: ${ts.company_reg_number}</p>` : ''}
      ${ts.vat_number         ? `<p style="margin:2px 0 0;color:#94A3B8;font-size:11px;">VAT: ${ts.vat_number}</p>` : ''}
    </div>
    <div style="text-align:right;">
      <p style="margin:0;color:#6366F1;font-size:24px;font-weight:900;">${invoice.invoice_number}</p>
      <p style="margin:4px 0 0;color:#94A3B8;font-size:12px;">INVOICE</p>
    </div>
  </div>

  <!-- Bill to + dates -->
  <div style="padding:24px 32px;display:flex;justify-content:space-between;border-bottom:1px solid #e5e7eb;">
    <div>
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Bill to</p>
      <p style="margin:0;font-size:15px;font-weight:700;color:#111827;">${invoice.company_name}</p>
      ${clientAddress ? `<p style="margin:2px 0 0;font-size:12px;color:#6b7280;">${clientAddress}</p>` : ''}
      ${invoice.client_vat ? `<p style="margin:2px 0 0;font-size:12px;color:#6b7280;">VAT: ${invoice.client_vat}</p>` : ''}
    </div>
    <div style="text-align:right;">
      <p style="margin:0 0 4px;font-size:12px;color:#6b7280;">Issue date: <strong style="color:#111827;">${invoice.issue_date}</strong></p>
      <p style="margin:0 0 4px;font-size:12px;color:#6b7280;">Due date: <strong style="color:#dc2626;">${invoice.due_date}</strong></p>
      ${invoice.currency_code !== 'GBP' ? `<p style="margin:0;font-size:12px;color:#6b7280;">Currency: <strong>${invoice.currency_code}</strong></p>` : ''}
    </div>
  </div>

  <!-- Line items -->
  <div style="padding:0 32px;">
    <table style="width:100%;border-collapse:collapse;margin-top:0;">
      <thead>
        <tr style="background:#f9fafb;">
          <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #e5e7eb;">Description</th>
          <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #e5e7eb;">Qty</th>
          <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #e5e7eb;">Unit price</th>
          <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #e5e7eb;">Amount</th>
        </tr>
      </thead>
      <tbody>${lineRows}</tbody>
    </table>
  </div>

  <!-- Totals -->
  <div style="padding:16px 32px 0;display:flex;justify-content:flex-end;">
    <table style="width:240px;border-collapse:collapse;">
      <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;">Subtotal</td><td style="padding:4px 0;text-align:right;font-size:13px;">${fmtCcy(invoice.subtotal)}</td></tr>
      <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;">VAT (${invoice.tax_rate}%)</td><td style="padding:4px 0;text-align:right;font-size:13px;">${fmtCcy(invoice.tax_amount)}</td></tr>
      <tr style="border-top:2px solid #111827;">
        <td style="padding:8px 0 0;font-size:16px;font-weight:800;color:#111827;">Total due</td>
        <td style="padding:8px 0 0;text-align:right;font-size:16px;font-weight:800;color:#6366F1;">${fmtCcy(invoice.total)}</td>
      </tr>
    </table>
  </div>

  <!-- Notes + bank details -->
  <div style="padding:24px 32px 32px;">
    ${invoice.notes_to_client ? `<div style="margin-bottom:16px;padding:14px;background:#eff6ff;border-radius:8px;border-left:3px solid #6366F1;font-size:13px;color:#1e40af;">${invoice.notes_to_client}</div>` : ''}
    ${bankHtml}
    <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;text-align:center;">Please reference <strong>${invoice.invoice_number}</strong> with your payment. Thank you for your business.</p>
  </div>

</div>
</body></html>`;

  await sendMail(env, {
    to:      toEmail,
    subject: `Invoice ${invoice.invoice_number} from ${env.TENANT_NAME} — ${fmtCcy(invoice.total)} due ${invoice.due_date}`,
    html,
  });

  await env.DB.prepare(
    `UPDATE invoices SET status='sent', sent_at=datetime('now'), updated_at=datetime('now') WHERE id=? AND tenant_id=?`
  ).bind(invoiceId, ctx.tenantId).run();

  await logEvent(env, invoiceId, ctx.tenantId, 'sent', ctx.userId ?? '', ctx.userEmail, `Sent to ${toEmail}`);
  await audit(env, { ...auditFromRequest(request, ctx), action: 'update', resource: 'invoice', resourceId: invoiceId });
  return ok({ sent: true });
}

// ── Mark paid ─────────────────────────────────────────────────
async function handlePay(request: Request, env: Env, ctx: AppContext, invoiceId: string): Promise<Response> {
  const denied = requirePermission(ctx, 'invoicing:edit:invoice');
  if (denied) return denied;
  const body: any = await request.json().catch(() => ({}));
  const paidAt = body.paid_at ?? new Date().toISOString().split('T')[0];
  await env.DB.prepare(
    `UPDATE invoices SET status='paid', paid_at=?, updated_at=datetime('now') WHERE id=? AND tenant_id=?`
  ).bind(paidAt, invoiceId, ctx.tenantId).run();
  await logEvent(env, invoiceId, ctx.tenantId, 'paid', ctx.userId ?? '', ctx.userEmail, body.note ?? null);
  return ok({ paid: true });
}

// ── Void ──────────────────────────────────────────────────────
async function handleVoid(request: Request, env: Env, ctx: AppContext, invoiceId: string): Promise<Response> {
  const denied = requirePermission(ctx, 'invoicing:void:invoice');
  if (denied) return denied;
  const body: any = await request.json().catch(() => ({}));
  await env.DB.prepare(
    `UPDATE invoices SET status='void', updated_at=datetime('now') WHERE id=? AND tenant_id=?`
  ).bind(invoiceId, ctx.tenantId).run();
  await logEvent(env, invoiceId, ctx.tenantId, 'voided', ctx.userId ?? '', ctx.userEmail, body.reason ?? null);
  return ok({ voided: true });
}

// ── Events ────────────────────────────────────────────────────
async function handleEvents(env: Env, ctx: AppContext, invoiceId: string): Promise<Response> {
  const denied = requirePermission(ctx, 'invoicing:view:invoice');
  if (denied) return denied;
  const rows = await env.DB.prepare(
    `SELECT * FROM invoice_events WHERE invoice_id = ? AND tenant_id = ? ORDER BY created_at DESC`
  ).bind(invoiceId, ctx.tenantId).all();
  return ok(rows.results);
}

// ── Line items ────────────────────────────────────────────────
async function handleLines(
  request: Request, env: Env, ctx: AppContext, invoiceId: string, lineId?: string
): Promise<Response> {
  const denied = requirePermission(ctx, 'invoicing:edit:invoice');
  if (denied) return denied;
  const method = request.method;

  if (method === 'POST') {
    const body: any = await request.json();
    const id    = crypto.randomUUID();
    const count = await env.DB.prepare(`SELECT COUNT(*) AS n FROM invoice_line_items WHERE invoice_id = ?`).bind(invoiceId).first<{ n: number }>();
    await env.DB.prepare(`
      INSERT INTO invoice_line_items (id, invoice_id, tenant_id, description, quantity, unit_price, amount, from_date, to_date, timesheet_ids, sort_order)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      id, invoiceId, ctx.tenantId, body.description ?? '',
      body.quantity ?? 1, body.unit_price ?? 0, (body.quantity ?? 1) * (body.unit_price ?? 0),
      body.from_date ?? null, body.to_date ?? null,
      body.timesheet_ids ? JSON.stringify(body.timesheet_ids) : null,
      count?.n ?? 0
    ).run();
    await recalcTotals(env, invoiceId, ctx.tenantId);
    return created({ id });
  }

  if (method === 'PUT' && lineId) {
    const body: any = await request.json();
    await env.DB.prepare(`
      UPDATE invoice_line_items SET description=?, quantity=?, unit_price=?, amount=?, sort_order=?
      WHERE id=? AND invoice_id=?
    `).bind(body.description, body.quantity, body.unit_price, body.quantity * body.unit_price, body.sort_order ?? 0, lineId, invoiceId).run();
    await recalcTotals(env, invoiceId, ctx.tenantId);
    return ok({ updated: true });
  }

  if (method === 'DELETE' && lineId) {
    await env.DB.prepare(`DELETE FROM invoice_line_items WHERE id=? AND invoice_id=?`).bind(lineId, invoiceId).run();
    await recalcTotals(env, invoiceId, ctx.tenantId);
    return ok({ deleted: true });
  }

  return notFound();
}

// ── Pull from approved timesheets ─────────────────────────────
async function handlePullTimesheets(request: Request, env: Env, ctx: AppContext): Promise<Response> {
  const denied = requirePermission(ctx, 'invoicing:create:invoice');
  if (denied) return denied;

  const body: any = await request.json();
  const { client_id, from_date, to_date, group_by = 'employee' } = body;
  if (!client_id || !from_date || !to_date) return err('client_id, from_date and to_date are required');

  const rows = await env.DB.prepare(`
    SELECT
      te.id AS entry_id, te.hours, te.date,
      eh.first_name || ' ' || eh.last_name AS employee_name,
      p.name AS project_name,
      COALESCE(CAST(eh.base_salary AS REAL) / (52.0 * 35.0), 0) AS hourly_rate
    FROM timesheet_entries te
    JOIN timesheets        t  ON t.id  = te.timesheet_id
    JOIN employees         e  ON e.id  = t.employee_id
    JOIN employee_history  eh ON eh.employee_id = e.id AND eh.is_current = 1
    LEFT JOIN pmo_tasks    tk ON tk.id = te.task_id
    LEFT JOIN pmo_projects p  ON p.id  = tk.project_id
    WHERE t.tenant_id = ?
      AND t.status    = 'approved'
      AND p.client_id = ?
      AND te.date BETWEEN ? AND ?
    ORDER BY employee_name, te.date
  `).bind(ctx.tenantId, client_id, from_date, to_date).all();

  const groups = new Map<string, any>();
  for (const row of rows.results as any[]) {
    const key      = group_by === 'project' ? (row.project_name ?? 'Unassigned') : row.employee_name;
    const existing = groups.get(key);
    if (existing) {
      existing.quantity += row.hours;
      existing.amount    = Math.round(existing.quantity * existing.unit_price * 100) / 100;
      existing.timesheet_ids.push(row.entry_id);
      if (row.date < existing.from_date) existing.from_date = row.date;
      if (row.date > existing.to_date)   existing.to_date   = row.date;
    } else {
      const rate = Math.round(row.hourly_rate * 100) / 100;
      groups.set(key, {
        description:   group_by === 'project'
          ? `${key} — professional services (${from_date} to ${to_date})`
          : `${row.employee_name} — ${from_date} to ${to_date}`,
        quantity:      row.hours,
        unit_price:    rate,
        amount:        Math.round(row.hours * rate * 100) / 100,
        from_date:     row.date,
        to_date:       row.date,
        timesheet_ids: [row.entry_id],
      });
    }
  }

  return ok({ proposed_lines: Array.from(groups.values()), total_entries: rows.results.length });
}

// ── Shared helpers ────────────────────────────────────────────
async function upsertLines(env: Env, invoiceId: string, tenantId: string, lines: any[]) {
  for (let i = 0; i < lines.length; i++) {
    const l  = lines[i];
    const id = l.id ?? crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO invoice_line_items (id, invoice_id, tenant_id, description, quantity, unit_price, amount, from_date, to_date, timesheet_ids, sort_order)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      id, invoiceId, tenantId,
      l.description ?? '', l.quantity ?? 0, l.unit_price ?? 0,
      (l.quantity ?? 0) * (l.unit_price ?? 0),
      l.from_date ?? null, l.to_date ?? null,
      l.timesheet_ids ? JSON.stringify(l.timesheet_ids) : null,
      i
    ).run();
  }
}

async function recalcTotals(env: Env, invoiceId: string, tenantId: string) {
  const t   = await env.DB.prepare(`SELECT COALESCE(SUM(amount),0) AS sub FROM invoice_line_items WHERE invoice_id=?`).bind(invoiceId).first<{ sub: number }>();
  const inv = await env.DB.prepare(`SELECT tax_rate FROM invoices WHERE id=?`).bind(invoiceId).first<any>();
  const sub = t?.sub ?? 0;
  const tax = sub * ((inv?.tax_rate ?? 20) / 100);
  await env.DB.prepare(`UPDATE invoices SET subtotal=?, tax_amount=?, total=?, updated_at=datetime('now') WHERE id=? AND tenant_id=?`)
    .bind(Math.round(sub*100)/100, Math.round(tax*100)/100, Math.round((sub+tax)*100)/100, invoiceId, tenantId).run();
}

async function logEvent(env: Env, invoiceId: string, tenantId: string, type: string, userId: string, actorName?: string, note?: string | null) {
  await env.DB.prepare(`
    INSERT INTO invoice_events (id, invoice_id, tenant_id, event_type, actor_id, actor_name, note)
    VALUES (?,?,?,?,?,?,?)
  `).bind(crypto.randomUUID(), invoiceId, tenantId, type, userId, actorName ?? null, note ?? null).run().catch(() => {});
}

function offsetDate(from: string, days: number): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

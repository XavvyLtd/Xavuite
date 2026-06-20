// modules/invoicing/handler.ts
// XavvySuite — Invoicing module

import { requirePermission } from '../../core/rbac';
import { auditLog } from '../../core/audit';
import { json, err, paginate } from '../../core/utils';
import { sendEmail } from '../../core/email';

export async function invoicingHandler(
  req: Request, env: Env, ctx: ExecutionContext, subPath: string
): Promise<Response> {
  const { tenantId, userId } = ctx as any;
  const method = req.method;
  const url = new URL(req.url);

  // ── /api/invoices/:id/send ────────────────────────────────
  const sendMatch = subPath.match(/^\/([^/]+)\/send$/);
  if (sendMatch) return sendInvoice(req, env, ctx, sendMatch[1]);

  // ── /api/invoices/:id/pay ─────────────────────────────────
  const payMatch = subPath.match(/^\/([^/]+)\/pay$/);
  if (payMatch) return markPaid(req, env, ctx, payMatch[1]);

  // ── /api/invoices/:id/void ────────────────────────────────
  const voidMatch = subPath.match(/^\/([^/]+)\/void$/);
  if (voidMatch) return voidInvoice(req, env, ctx, voidMatch[1]);

  // ── /api/invoices/pull-timesheets ─────────────────────────
  if (subPath === '/pull-timesheets' && method === 'POST') {
    return pullTimesheets(req, env, ctx);
  }

  // ── /api/invoices/:id/lines ───────────────────────────────
  const linesMatch = subPath.match(/^\/([^/]+)\/lines(\/([^/]+))?$/);
  if (linesMatch) return linesHandler(req, env, ctx, linesMatch[1], linesMatch[3]);

  // ── /api/invoices/:id/events ──────────────────────────────
  const eventsMatch = subPath.match(/^\/([^/]+)\/events$/);
  if (eventsMatch && method === 'GET') {
    await requirePermission(ctx, 'invoicing:view');
    const rows = await env.DB.prepare(
      `SELECT * FROM invoice_events WHERE invoice_id = ? AND tenant_id = ? ORDER BY created_at DESC`
    ).bind(eventsMatch[1], tenantId).all();
    return json(rows.results);
  }

  const idMatch = subPath.match(/^\/([^/]+)$/);
  const invoiceId = idMatch?.[1];

  // ── GET /api/invoices ─────────────────────────────────────
  if (method === 'GET' && !invoiceId) {
    await requirePermission(ctx, 'invoicing:view');
    const { limit, offset } = paginate(url);
    const status = url.searchParams.get('status') ?? '';
    const clientId = url.searchParams.get('client_id') ?? '';
    const from = url.searchParams.get('from') ?? '';
    const to = url.searchParams.get('to') ?? '';

    const where: string[] = ['i.tenant_id = ?'];
    const params: any[] = [tenantId];
    if (status) { where.push('i.status = ?'); params.push(status); }
    if (clientId) { where.push('i.client_id = ?'); params.push(clientId); }
    if (from) { where.push('i.issue_date >= ?'); params.push(from); }
    if (to) { where.push('i.issue_date <= ?'); params.push(to); }
    const whereStr = where.join(' AND ');

    const [rows, countRow] = await Promise.all([
      env.DB.prepare(`
        SELECT i.*, c.company_name AS client_name, c.invoice_email AS client_email
        FROM invoices i
        JOIN clients c ON c.id = i.client_id
        WHERE ${whereStr}
        ORDER BY i.issue_date DESC, i.invoice_number DESC
        LIMIT ? OFFSET ?
      `).bind(...params, limit, offset).all(),
      env.DB.prepare(`SELECT COUNT(*) AS n FROM invoices i WHERE ${whereStr}`).bind(...params).first<{ n: number }>(),
    ]);

    // Auto-flag overdue
    await env.DB.prepare(`
      UPDATE invoices SET status = 'overdue'
      WHERE tenant_id = ? AND status = 'sent' AND due_date < date('now')
    `).bind(tenantId).run();

    return json({ invoices: rows.results, total: countRow?.n ?? 0, limit, offset });
  }

  // ── GET /api/invoices/:id ─────────────────────────────────
  if (method === 'GET' && invoiceId) {
    await requirePermission(ctx, 'invoicing:view');
    const [invoice, lines, client] = await Promise.all([
      env.DB.prepare(`SELECT * FROM invoices WHERE id = ? AND tenant_id = ?`).bind(invoiceId, tenantId).first(),
      env.DB.prepare(`SELECT * FROM invoice_line_items WHERE invoice_id = ? ORDER BY sort_order ASC`).bind(invoiceId).all(),
      env.DB.prepare(`
        SELECT c.*, ts.company_reg_number AS ts_reg, ts.vat_number AS ts_vat,
          ts.reg_address_line1, ts.reg_address_line2, ts.reg_city, ts.reg_county,
          ts.reg_postcode, ts.reg_country, ts.bank_name, ts.bank_account_name,
          ts.bank_account_number, ts.bank_sort_code, ts.bank_iban, ts.bank_bic,
          ts.company_name AS tenant_company_name
        FROM invoices i
        JOIN clients c ON c.id = i.client_id
        JOIN tenant_settings ts ON ts.tenant_id = i.tenant_id
        WHERE i.id = ?
      `).bind(invoiceId).first(),
    ]);
    if (!invoice) return err('Invoice not found', 404);
    return json({ ...invoice, lines: lines.results, client });
  }

  // ── POST /api/invoices ────────────────────────────────────
  if (method === 'POST' && !invoiceId) {
    await requirePermission(ctx, 'invoicing:create');
    const body: any = await req.json();

    // Generate invoice number: INV-YYYY-NNNN
    const year = new Date().getFullYear();
    const seqRow = await env.DB.prepare(
      `INSERT INTO invoice_sequences (tenant_id, year, last_seq) VALUES (?, ?, 1)
       ON CONFLICT(tenant_id) DO UPDATE SET
         last_seq = CASE WHEN year = excluded.year THEN last_seq + 1 ELSE 1 END,
         year = excluded.year
       RETURNING last_seq`
    ).bind(tenantId, year).first<{ last_seq: number }>();
    const seq = seqRow?.last_seq ?? 1;
    const invoiceNumber = `INV-${year}-${String(seq).padStart(4, '0')}`;

    // Get client default currency & terms
    const client = await env.DB.prepare(
      `SELECT currency_code, payment_terms_days FROM clients WHERE id = ? AND tenant_id = ?`
    ).bind(body.client_id, tenantId).first<any>();

    const id = crypto.randomUUID().replace(/-/g, '');
    const issueDate = body.issue_date ?? new Date().toISOString().split('T')[0];
    const termsDays = body.payment_terms_days ?? client?.payment_terms_days ?? 30;
    const dueDate = body.due_date ?? offsetDate(issueDate, termsDays);

    await env.DB.prepare(`
      INSERT INTO invoices (id, tenant_id, client_id, invoice_number, status, issue_date, due_date,
        subtotal, tax_rate, tax_amount, total, currency_code, notes_to_client, internal_notes, created_by)
      VALUES (?,?,?,?,'draft',?,?,0,?,0,0,?,?,?,?)
    `).bind(
      id, tenantId, body.client_id, invoiceNumber, issueDate, dueDate,
      body.tax_rate ?? 20, client?.currency_code ?? 'GBP',
      body.notes_to_client ?? null, body.internal_notes ?? null, userId
    ).run();

    // Insert line items if provided
    if (Array.isArray(body.lines) && body.lines.length > 0) {
      await upsertLines(env, id, tenantId, body.lines);
      await recalcTotals(env, id, tenantId);
    }

    await logEvent(env, id, tenantId, 'created', userId);
    await auditLog(env, tenantId, userId, 'invoices', 'create', id, null, { invoiceNumber });
    return json({ id, invoice_number: invoiceNumber }, 201);
  }

  // ── PUT /api/invoices/:id ─────────────────────────────────
  if (method === 'PUT' && invoiceId) {
    await requirePermission(ctx, 'invoicing:edit');
    const body: any = await req.json();

    const existing = await env.DB.prepare(
      `SELECT status FROM invoices WHERE id = ? AND tenant_id = ?`
    ).bind(invoiceId, tenantId).first<any>();
    if (!existing) return err('Invoice not found', 404);
    if (existing.status === 'void') return err('Cannot edit a voided invoice', 400);

    await env.DB.prepare(`
      UPDATE invoices SET
        issue_date = ?, due_date = ?, tax_rate = ?,
        notes_to_client = ?, internal_notes = ?,
        updated_at = datetime('now')
      WHERE id = ? AND tenant_id = ?
    `).bind(
      body.issue_date, body.due_date, body.tax_rate ?? 20,
      body.notes_to_client ?? null, body.internal_notes ?? null,
      invoiceId, tenantId
    ).run();

    if (Array.isArray(body.lines)) {
      // Replace all lines
      await env.DB.prepare(`DELETE FROM invoice_line_items WHERE invoice_id = ?`).bind(invoiceId).run();
      if (body.lines.length > 0) await upsertLines(env, invoiceId, tenantId, body.lines);
    }

    await recalcTotals(env, invoiceId, tenantId);
    await logEvent(env, invoiceId, tenantId, 'edited', userId);
    return json({ ok: true });
  }

  return err('Not found', 404);
}

// ── Send invoice ──────────────────────────────────────────────
async function sendInvoice(req: Request, env: Env, ctx: ExecutionContext, invoiceId: string): Promise<Response> {
  const { tenantId, userId } = ctx as any;
  await requirePermission(ctx, 'invoicing:send');

  const body: any = await req.json();
  const invoice = await env.DB.prepare(
    `SELECT i.*, c.company_name, c.invoice_email FROM invoices i JOIN clients c ON c.id = i.client_id WHERE i.id = ? AND i.tenant_id = ?`
  ).bind(invoiceId, tenantId).first<any>();
  if (!invoice) return err('Invoice not found', 404);
  if (invoice.status === 'void') return err('Cannot send a voided invoice', 400);

  const toEmail = body.to ?? invoice.invoice_email;
  if (!toEmail) return err('No recipient email address', 400);

  await sendEmail(env, {
    to: toEmail,
    cc: body.cc ?? invoice.invoice_cc ?? undefined,
    subject: body.subject ?? `Invoice ${invoice.invoice_number} from ${invoice.tenant_company_name ?? 'XavvySuite'}`,
    html: body.html_body ?? defaultEmailBody(invoice),
  });

  await env.DB.prepare(
    `UPDATE invoices SET status = 'sent', sent_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND tenant_id = ?`
  ).bind(invoiceId, tenantId).run();

  await logEvent(env, invoiceId, tenantId, 'sent', userId, `Sent to ${toEmail}`);
  return json({ ok: true });
}

// ── Mark paid ─────────────────────────────────────────────────
async function markPaid(req: Request, env: Env, ctx: ExecutionContext, invoiceId: string): Promise<Response> {
  const { tenantId, userId } = ctx as any;
  await requirePermission(ctx, 'invoicing:edit');
  const body: any = await req.json().catch(() => ({}));
  const paidAt = body.paid_at ?? new Date().toISOString().split('T')[0];

  await env.DB.prepare(
    `UPDATE invoices SET status = 'paid', paid_at = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?`
  ).bind(paidAt, invoiceId, tenantId).run();

  await logEvent(env, invoiceId, tenantId, 'paid', userId, body.note ?? null);
  return json({ ok: true });
}

// ── Void invoice ──────────────────────────────────────────────
async function voidInvoice(req: Request, env: Env, ctx: ExecutionContext, invoiceId: string): Promise<Response> {
  const { tenantId, userId } = ctx as any;
  await requirePermission(ctx, 'invoicing:void');
  const body: any = await req.json().catch(() => ({}));

  await env.DB.prepare(
    `UPDATE invoices SET status = 'void', updated_at = datetime('now') WHERE id = ? AND tenant_id = ?`
  ).bind(invoiceId, tenantId).run();

  await logEvent(env, invoiceId, tenantId, 'voided', userId, body.reason ?? null);
  return json({ ok: true });
}

// ── Pull timesheets → proposed line items ─────────────────────
async function pullTimesheets(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const { tenantId } = ctx as any;
  await requirePermission(ctx, 'invoicing:create');
  const body: any = await req.json();
  const { client_id, from_date, to_date, group_by = 'employee' } = body;

  // Get approved timesheet entries for this client's projects in the date range
  const rows = await env.DB.prepare(`
    SELECT
      te.id AS entry_id,
      te.hours,
      te.date,
      te.notes AS entry_notes,
      t.week_start,
      e.full_name AS employee_name,
      p.name AS project_name,
      tk.title AS task_title,
      COALESCE(eh.hourly_rate, 0) AS hourly_rate
    FROM timesheet_entries te
    JOIN timesheets t ON t.id = te.timesheet_id
    JOIN employees e ON e.id = t.employee_id
    LEFT JOIN pmo_tasks tk ON tk.id = te.task_id
    LEFT JOIN pmo_projects p ON p.id = tk.project_id
    LEFT JOIN employee_history eh ON eh.employee_id = e.id AND eh.is_current = 1
    WHERE t.tenant_id = ?
      AND t.status = 'approved'
      AND p.client_id = ?
      AND te.date BETWEEN ? AND ?
    ORDER BY e.full_name, te.date
  `).bind(tenantId, client_id, from_date, to_date).all();

  // Group into proposed line items
  type LineItem = {
    description: string;
    quantity: number;
    unit_price: number;
    amount: number;
    from_date: string;
    to_date: string;
    timesheet_ids: string[];
  };

  const groups = new Map<string, LineItem>();
  for (const row of rows.results as any[]) {
    const key = group_by === 'project' ? row.project_name : row.employee_name;
    const existing = groups.get(key);
    if (existing) {
      existing.quantity += row.hours;
      existing.amount = existing.quantity * existing.unit_price;
      existing.timesheet_ids.push(row.entry_id);
      if (row.date < existing.from_date) existing.from_date = row.date;
      if (row.date > existing.to_date) existing.to_date = row.date;
    } else {
      groups.set(key, {
        description: group_by === 'project'
          ? `${row.project_name} — professional services`
          : `${row.employee_name} — ${from_date} to ${to_date}`,
        quantity: row.hours,
        unit_price: row.hourly_rate,
        amount: row.hours * row.hourly_rate,
        from_date: row.date,
        to_date: row.date,
        timesheet_ids: [row.entry_id],
      });
    }
  }

  return json({ proposed_lines: Array.from(groups.values()), total_entries: rows.results.length });
}

// ── Line items sub-handler ────────────────────────────────────
async function linesHandler(
  req: Request, env: Env, ctx: ExecutionContext, invoiceId: string, lineId?: string
): Promise<Response> {
  const { tenantId } = ctx as any;
  await requirePermission(ctx, 'invoicing:edit');
  const method = req.method;

  if (method === 'POST') {
    const body: any = await req.json();
    const id = crypto.randomUUID().replace(/-/g, '');
    const count = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM invoice_line_items WHERE invoice_id = ?`
    ).bind(invoiceId).first<{ n: number }>();

    await env.DB.prepare(`
      INSERT INTO invoice_line_items (id, invoice_id, tenant_id, description, quantity, unit_price, amount, from_date, to_date, timesheet_ids, sort_order)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      id, invoiceId, tenantId,
      body.description, body.quantity, body.unit_price, body.quantity * body.unit_price,
      body.from_date ?? null, body.to_date ?? null,
      body.timesheet_ids ? JSON.stringify(body.timesheet_ids) : null,
      (count?.n ?? 0)
    ).run();

    await recalcTotals(env, invoiceId, tenantId);
    return json({ id }, 201);
  }

  if (method === 'PUT' && lineId) {
    const body: any = await req.json();
    await env.DB.prepare(`
      UPDATE invoice_line_items SET description = ?, quantity = ?, unit_price = ?, amount = ?, sort_order = ?
      WHERE id = ? AND invoice_id = ?
    `).bind(body.description, body.quantity, body.unit_price, body.quantity * body.unit_price, body.sort_order ?? 0, lineId, invoiceId).run();
    await recalcTotals(env, invoiceId, tenantId);
    return json({ ok: true });
  }

  if (method === 'DELETE' && lineId) {
    await env.DB.prepare(`DELETE FROM invoice_line_items WHERE id = ? AND invoice_id = ?`).bind(lineId, invoiceId).run();
    await recalcTotals(env, invoiceId, tenantId);
    return json({ ok: true });
  }

  return err('Not found', 404);
}

// ── Helpers ───────────────────────────────────────────────────
async function upsertLines(env: Env, invoiceId: string, tenantId: string, lines: any[]) {
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const id = l.id ?? crypto.randomUUID().replace(/-/g, '');
    const amount = (l.quantity ?? 0) * (l.unit_price ?? 0);
    await env.DB.prepare(`
      INSERT INTO invoice_line_items (id, invoice_id, tenant_id, description, quantity, unit_price, amount, from_date, to_date, timesheet_ids, sort_order)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      id, invoiceId, tenantId, l.description ?? '', l.quantity ?? 0, l.unit_price ?? 0, amount,
      l.from_date ?? null, l.to_date ?? null,
      l.timesheet_ids ? JSON.stringify(l.timesheet_ids) : null, i
    ).run();
  }
}

async function recalcTotals(env: Env, invoiceId: string, tenantId: string) {
  const totals = await env.DB.prepare(
    `SELECT COALESCE(SUM(amount),0) AS subtotal FROM invoice_line_items WHERE invoice_id = ?`
  ).bind(invoiceId).first<{ subtotal: number }>();
  const subtotal = totals?.subtotal ?? 0;

  const inv = await env.DB.prepare(`SELECT tax_rate FROM invoices WHERE id = ?`).bind(invoiceId).first<any>();
  const taxRate = inv?.tax_rate ?? 20;
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  await env.DB.prepare(`
    UPDATE invoices SET subtotal = ?, tax_amount = ?, total = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?
  `).bind(subtotal, taxAmount, total, invoiceId, tenantId).run();
}

async function logEvent(env: Env, invoiceId: string, tenantId: string, type: string, userId: string, note?: string | null) {
  const id = crypto.randomUUID().replace(/-/g, '');
  await env.DB.prepare(`
    INSERT INTO invoice_events (id, invoice_id, tenant_id, event_type, actor_id, note)
    VALUES (?,?,?,?,?,?)
  `).bind(id, invoiceId, tenantId, type, userId, note ?? null).run();
}

function offsetDate(from: string, days: number): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function defaultEmailBody(invoice: any): string {
  return `<p>Dear ${invoice.company_name},</p>
<p>Please find enclosed invoice <strong>${invoice.invoice_number}</strong> for the amount of <strong>${invoice.currency_code} ${invoice.total?.toFixed(2)}</strong>, due by ${invoice.due_date}.</p>
<p>If you have any queries, please do not hesitate to contact us.</p>
<p>Kind regards</p>`;
}

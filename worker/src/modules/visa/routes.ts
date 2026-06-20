import { z } from 'zod';
import { ok, created, err, notFound } from '../../core/response';
import { audit, auditFromRequest } from '../../middleware/audit';
import type { Env, AppContext } from '../../types';

const VisaSchema = z.object({
  employeeId:           z.string(),
  visaType:             z.string().min(1),
  visaNumber:           z.string().optional(),
  countryOfIssue:       z.string().default('GBR'),
  issueDate:            z.string().optional(),
  expiryDate:           z.string().optional(),
  sponsorshipRequired:  z.boolean().default(false),
  sponsorLicenceNumber: z.string().optional(),
  cosNumber:            z.string().optional(),
  cosExpiry:            z.string().optional(),
  cosSocCode:           z.string().optional(),
  workRestrictions:     z.array(z.string()).default([]),
  notes:                z.string().optional(),
});

export async function handleVisas(
  request: Request, env: Env, ctx: AppContext, subPath: string
): Promise<Response> {
  const [id, action] = subPath.split('/').filter(Boolean);

  // GET /api/visas
  if (!id && request.method === 'GET') {
    const url = new URL(request.url);
    const status     = url.searchParams.get('status');
    const expiring   = url.searchParams.get('expiring') === 'true';
    const employeeId = url.searchParams.get('employeeId');

    let where = 'v.tenant_id = ?';
    const params: unknown[] = [ctx.tenantId];
    if (status)     { where += ' AND v.status = ?';       params.push(status); }
    if (employeeId) { where += ' AND v.employee_id = ?';  params.push(employeeId); }
    if (expiring)   { where += ` AND v.expiry_date IS NOT NULL AND v.expiry_date <= date('now','+90 days') AND v.expiry_date >= date('now') AND v.status = 'active'`; }

    const rows = await env.DB.prepare(`
      SELECT v.*,
             eh.first_name || ' ' || eh.last_name AS employee_name,
             u.email AS employee_email,
             CAST((julianday(v.expiry_date) - julianday('now')) AS INTEGER) AS days_remaining
      FROM employee_visas v
      JOIN employees e ON e.id = v.employee_id
      JOIN employee_history eh ON eh.employee_id = e.id AND eh.is_current = 1
      JOIN users u ON u.id = e.user_id
      WHERE ${where}
      ORDER BY v.expiry_date ASC NULLS LAST
      LIMIT 200
    `).bind(...params).all();
    return ok(rows.results);
  }

  // POST /api/visas
  if (!id && request.method === 'POST') {
    const body = await request.json().catch(() => null);
    const parsed = VisaSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.issues[0].message);
    const d = parsed.data;
    const visaId = crypto.randomUUID();

    await env.DB.prepare(`
      INSERT INTO employee_visas (
        id, tenant_id, employee_id, visa_type, visa_number, country_of_issue,
        issue_date, expiry_date, status, sponsorship_required,
        sponsor_licence_number, cos_number, cos_expiry, cos_soc_code,
        work_restrictions, notes, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(
      visaId, ctx.tenantId, d.employeeId, d.visaType, d.visaNumber ?? null,
      d.countryOfIssue, d.issueDate ?? null, d.expiryDate ?? null,
      d.sponsorshipRequired ? 1 : 0,
      d.sponsorLicenceNumber ?? null, d.cosNumber ?? null,
      d.cosExpiry ?? null, d.cosSocCode ?? null,
      JSON.stringify(d.workRestrictions), d.notes ?? null, ctx.userId
    ).run();

    await audit(env, { ...auditFromRequest(request, ctx), action: 'create', resource: 'visa', resourceId: visaId });
    return created({ id: visaId });
  }

  // GET /api/visas/:id
  if (id && !action && request.method === 'GET') {
    const visa = await env.DB.prepare(`
      SELECT v.*,
             eh.first_name || ' ' || eh.last_name AS employee_name,
             u.email AS employee_email,
             CAST((julianday(v.expiry_date) - julianday('now')) AS INTEGER) AS days_remaining
      FROM employee_visas v
      JOIN employees e ON e.id = v.employee_id
      JOIN employee_history eh ON eh.employee_id = e.id AND eh.is_current = 1
      JOIN users u ON u.id = e.user_id
      WHERE v.id = ? AND v.tenant_id = ?
    `).bind(id, ctx.tenantId).first();
    if (!visa) return notFound('Visa not found');

    const renewals = await env.DB.prepare(
      `SELECT * FROM visa_renewals WHERE visa_id = ? ORDER BY renewed_at DESC`
    ).bind(id).all();

    return ok({ ...visa, renewals: renewals.results });
  }

  // PATCH /api/visas/:id
  if (id && !action && request.method === 'PATCH') {
    const body = await request.json() as any;
    const allowed = ['visa_number','expiry_date','issue_date','status','cos_number','cos_expiry','notes','sponsor_licence_number'];
    const sets = ['updated_at = CURRENT_TIMESTAMP'];
    const params: unknown[] = [];
    for (const [k, v] of Object.entries(body)) {
      if (allowed.includes(k)) { sets.push(`${k} = ?`); params.push(v); }
    }
    if (sets.length === 1) return err('No valid fields to update');
    await env.DB.prepare(
      `UPDATE employee_visas SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`
    ).bind(...params, id, ctx.tenantId).run();
    return ok({ id, updated: true });
  }

  // POST /api/visas/:id/renew
  if (id && action === 'renew' && request.method === 'POST') {
    const { newExpiry, notes } = await request.json() as any;
    if (!newExpiry) return err('newExpiry is required');

    const visa = await env.DB.prepare(
      `SELECT expiry_date FROM employee_visas WHERE id = ? AND tenant_id = ?`
    ).bind(id, ctx.tenantId).first() as any;
    if (!visa) return notFound('Visa not found');

    await env.DB.batch([
      env.DB.prepare(`UPDATE employee_visas SET expiry_date=?, status='active', alert_90_day_sent=0, alert_60_day_sent=0, alert_30_day_sent=0, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
        .bind(newExpiry, id),
      env.DB.prepare(`INSERT INTO visa_renewals (id,visa_id,tenant_id,previous_expiry,new_expiry,renewed_by,notes) VALUES (?,?,?,?,?,?,?)`)
        .bind(crypto.randomUUID(), id, ctx.tenantId, visa.expiry_date, newExpiry, ctx.userId, notes ?? null),
    ]);

    await audit(env, { ...auditFromRequest(request, ctx), action: 'update', resource: 'visa', resourceId: id, metadata: { action: 'renew', newExpiry } });
    return ok({ id, renewed: true, newExpiry });
  }

  // GET /api/visas/dashboard — summary stats
  if (id === 'dashboard' && request.method === 'GET') {
    const [total, expiring90, expiring30, expired, sponsored] = await Promise.all([
      env.DB.prepare(`SELECT COUNT(*) as n FROM employee_visas WHERE tenant_id=? AND status='active'`).bind(ctx.tenantId).first() as any,
      env.DB.prepare(`SELECT COUNT(*) as n FROM employee_visas WHERE tenant_id=? AND status='active' AND expiry_date <= date('now','+90 days') AND expiry_date >= date('now')`).bind(ctx.tenantId).first() as any,
      env.DB.prepare(`SELECT COUNT(*) as n FROM employee_visas WHERE tenant_id=? AND status='active' AND expiry_date <= date('now','+30 days') AND expiry_date >= date('now')`).bind(ctx.tenantId).first() as any,
      env.DB.prepare(`SELECT COUNT(*) as n FROM employee_visas WHERE tenant_id=? AND status='expired'`).bind(ctx.tenantId).first() as any,
      env.DB.prepare(`SELECT COUNT(*) as n FROM employee_visas WHERE tenant_id=? AND sponsorship_required=1 AND status='active'`).bind(ctx.tenantId).first() as any,
    ]);
    return ok({
      total:       total?.n ?? 0,
      expiring90:  expiring90?.n ?? 0,
      expiring30:  expiring30?.n ?? 0,
      expired:     expired?.n ?? 0,
      sponsored:   sponsored?.n ?? 0,
    });
  }

  return err('Not found', 404);
}

import { ok, created, err, notFound } from '../../core/response';
import { requirePermission, hasPermission } from '../../middleware/auth';
import { audit, auditFromRequest } from '../../middleware/audit';
import type { Env, AppContext } from '../../types';

export async function handleGDPR(
  request: Request, env: Env, ctx: AppContext, subPath: string
): Promise<Response> {
  const pathOnly = subPath.split('?')[0];
  const [resource, id, action] = pathOnly.split('/').filter(Boolean);
  const method = request.method;
  const url    = new URL(request.url);
  const tid    = ctx.tenantId;

  // ── COOKIE CONSENT (public — no auth required) ───────────────
  // POST /api/gdpr/consent
  if (resource === 'consent' && !id && method === 'POST') {
    const body: any = await request.json().catch(() => ({}));
    const sessionId = body.sessionId ?? crypto.randomUUID();

    await env.DB.prepare(`
      INSERT INTO cookie_consents
        (id, session_id, tenant_id, user_id, necessary, functional, analytics, marketing, ip_address, user_agent)
      VALUES (?,?,?,?,1,?,?,?,?,?)
      ON CONFLICT(id) DO NOTHING
    `).bind(
      crypto.randomUUID(), sessionId,
      tid || null, ctx.userId || null,
      body.functional ? 1 : 0,
      body.analytics  ? 1 : 0,
      body.marketing  ? 1 : 0,
      request.headers.get('CF-Connecting-IP') ?? null,
      request.headers.get('User-Agent')?.slice(0, 200) ?? null,
    ).run();

    return ok({ sessionId, recorded: true });
  }

  // PUT /api/gdpr/consent/:sessionId — update / withdraw consent
  if (resource === 'consent' && id && method === 'PUT') {
    const body: any = await request.json().catch(() => ({}));
    if (body.withdraw) {
      await env.DB.prepare(
        `UPDATE cookie_consents SET withdrawn_at = datetime('now'), updated_at = datetime('now')
         WHERE session_id = ?`
      ).bind(id).run();
      return ok({ withdrawn: true });
    }
    await env.DB.prepare(`
      UPDATE cookie_consents
      SET functional = ?, analytics = ?, marketing = ?, updated_at = datetime('now')
      WHERE session_id = ?
    `).bind(body.functional ? 1 : 0, body.analytics ? 1 : 0, body.marketing ? 1 : 0, id).run();
    return ok({ updated: true });
  }

  // GET /api/gdpr/consent/:sessionId — check existing consent
  if (resource === 'consent' && id && method === 'GET') {
    const row = await env.DB.prepare(
      `SELECT * FROM cookie_consents WHERE session_id = ? ORDER BY consented_at DESC LIMIT 1`
    ).bind(id).first();
    return ok(row ?? null);
  }

  // ── GDPR CONFIG ─────────────────────────────────────────────
  // GET /api/gdpr/config
  if (resource === 'config' && !id && method === 'GET') {
    const config = await env.DB.prepare(
      `SELECT * FROM gdpr_config WHERE tenant_id = ?`
    ).bind(tid).first();
    return ok(config ?? null);
  }

  // PUT /api/gdpr/config — update DPO, retention periods, lawful basis
  if (resource === 'config' && !id && method === 'PUT') {
    const denied = requirePermission(ctx, 'settings:manage:company');
    if (denied) return denied;
    const body: any = await request.json().catch(() => ({}));

    await env.DB.prepare(`
      INSERT INTO gdpr_config (id, tenant_id, dpo_name, dpo_email, dpo_phone, company_reg, ico_number,
        privacy_policy_url, retention_employee_data, retention_audit_logs, retention_timesheets,
        retention_expenses, retention_leave_records, lawful_basis_hr, lawful_basis_payroll,
        last_reviewed_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))
      ON CONFLICT(tenant_id) DO UPDATE SET
        dpo_name              = excluded.dpo_name,
        dpo_email             = excluded.dpo_email,
        dpo_phone             = excluded.dpo_phone,
        company_reg           = excluded.company_reg,
        ico_number            = excluded.ico_number,
        privacy_policy_url    = excluded.privacy_policy_url,
        retention_employee_data = excluded.retention_employee_data,
        retention_audit_logs  = excluded.retention_audit_logs,
        retention_timesheets  = excluded.retention_timesheets,
        retention_expenses    = excluded.retention_expenses,
        retention_leave_records = excluded.retention_leave_records,
        lawful_basis_hr       = excluded.lawful_basis_hr,
        lawful_basis_payroll  = excluded.lawful_basis_payroll,
        last_reviewed_at      = datetime('now'),
        updated_at            = datetime('now')
    `).bind(
      crypto.randomUUID(), tid,
      body.dpo_name ?? null, body.dpo_email ?? null, body.dpo_phone ?? null,
      body.company_reg ?? null, body.ico_number ?? null, body.privacy_policy_url ?? null,
      body.retention_employee_data ?? 2555, body.retention_audit_logs ?? 365,
      body.retention_timesheets ?? 2555, body.retention_expenses ?? 2555,
      body.retention_leave_records ?? 1825,
      body.lawful_basis_hr ?? 'contract', body.lawful_basis_payroll ?? 'legal_obligation',
    ).run();

    return ok({ updated: true });
  }

  // ── DATA SUBJECT ACCESS REQUESTS ────────────────────────────
  // GET /api/gdpr/requests
  if (resource === 'requests' && !id && method === 'GET') {
    const denied = requirePermission(ctx, 'hr:manage:employee');
    if (denied) return denied;
    const status = url.searchParams.get('status');
    const where  = status ? 'WHERE d.tenant_id=? AND d.status=?' : 'WHERE d.tenant_id=?';
    const params = status ? [tid, status] : [tid];
    const rows = await env.DB.prepare(`
      SELECT d.*,
             eh.first_name||' '||eh.last_name as employee_name
      FROM data_subject_requests d
      LEFT JOIN employees e ON e.id = d.employee_id
      LEFT JOIN employee_history eh ON eh.employee_id = e.id AND eh.is_current = 1
      ${where}
      ORDER BY d.created_at DESC
    `).bind(...params).all();
    return ok(rows.results);
  }

  // POST /api/gdpr/requests — raise a new DSAR
  if (resource === 'requests' && !id && method === 'POST') {
    const body: any = await request.json().catch(() => ({}));
    if (!body.request_type) return err('request_type is required');

    const reqId   = crypto.randomUUID();
    // Due date = 30 calendar days (UK GDPR Art.12)
    const dueDate = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

    await env.DB.prepare(`
      INSERT INTO data_subject_requests
        (id, tenant_id, employee_id, requested_by, request_type, description, due_date)
      VALUES (?,?,?,?,?,?,?)
    `).bind(
      reqId, tid,
      body.employee_id ?? null,
      body.requested_by ?? ctx.userEmail,
      body.request_type,
      body.description ?? null,
      dueDate,
    ).run();

    await audit(env, { ...auditFromRequest(request, ctx), action: 'create', resource: 'dsar', resourceId: reqId });
    return created({ id: reqId, due_date: dueDate });
  }

  // PATCH /api/gdpr/requests/:id — update status/response
  if (resource === 'requests' && id && method === 'PATCH') {
    const denied = requirePermission(ctx, 'hr:manage:employee');
    if (denied) return denied;
    const body: any = await request.json().catch(() => ({}));

    const updates: string[] = ['updated_at = datetime(\'now\')'];
    const params: any[]     = [];
    if (body.status)         { updates.push('status = ?');         params.push(body.status); }
    if (body.response_notes) { updates.push('response_notes = ?'); params.push(body.response_notes); }
    if (body.status === 'completed') {
      updates.push('completed_at = datetime(\'now\')');
    }
    params.push(id, tid);

    await env.DB.prepare(
      `UPDATE data_subject_requests SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`
    ).bind(...params).run();

    await audit(env, { ...auditFromRequest(request, ctx), action: 'update', resource: 'dsar', resourceId: id });
    return ok({ updated: true });
  }

  // POST /api/gdpr/requests/:id/export — generate data export for SAR
  if (resource === 'requests' && id && action === 'export' && method === 'POST') {
    const denied = requirePermission(ctx, 'hr:manage:employee');
    if (denied) return denied;

    const req = await env.DB.prepare(
      `SELECT * FROM data_subject_requests WHERE id = ? AND tenant_id = ?`
    ).bind(id, tid).first() as any;
    if (!req) return notFound('Request not found');

    const empId = req.employee_id;
    if (!empId) return err('No employee linked to this request');

    // Gather all data about this employee
    const [employee, history, leave, timesheets, expenses, compensation] = await Promise.all([
      env.DB.prepare(`SELECT e.*, u.email FROM employees e JOIN users u ON u.id=e.user_id WHERE e.id=? AND e.tenant_id=?`).bind(empId, tid).first(),
      env.DB.prepare(`SELECT * FROM employee_history WHERE employee_id=? ORDER BY effective_date DESC`).bind(empId).all(),
      env.DB.prepare(`SELECT * FROM leave_requests WHERE employee_id=? AND tenant_id=?`).bind(empId, tid).all(),
      env.DB.prepare(`SELECT * FROM timesheets WHERE employee_id=? AND tenant_id=?`).bind(empId, tid).all(),
      env.DB.prepare(`SELECT * FROM expenses WHERE employee_id=? AND tenant_id=?`).bind(empId, tid).all(),
      env.DB.prepare(`SELECT * FROM employee_compensation WHERE employee_id=? AND tenant_id=?`).bind(empId, tid).all(),
    ]);

    const export_data = {
      generated_at:      new Date().toISOString(),
      request_id:        id,
      request_type:      req.request_type,
      subject:           employee,
      employment_history: history.results,
      leave_requests:    leave.results,
      timesheets:        timesheets.results,
      expenses:          expenses.results,
      compensation:      compensation.results,
    };

    // Mark request as completed
    await env.DB.prepare(
      `UPDATE data_subject_requests SET status='completed', completed_at=datetime('now') WHERE id=?`
    ).bind(id).run();

    return new Response(JSON.stringify(export_data, null, 2), {
      headers: {
        'Content-Type':        'application/json',
        'Content-Disposition': `attachment; filename="SAR-${empId}-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  }

  // ── DATA BREACHES ─────────────────────────────────────────────
  // GET /api/gdpr/breaches
  if (resource === 'breaches' && !id && method === 'GET') {
    const denied = requirePermission(ctx, 'settings:manage:security');
    if (denied) return denied;
    const rows = await env.DB.prepare(
      `SELECT * FROM data_breaches WHERE tenant_id=? ORDER BY discovered_at DESC`
    ).bind(tid).all();
    return ok(rows.results);
  }

  // POST /api/gdpr/breaches
  if (resource === 'breaches' && !id && method === 'POST') {
    const denied = requirePermission(ctx, 'settings:manage:security');
    if (denied) return denied;
    const body: any = await request.json().catch(() => ({}));
    if (!body.description || !body.discovered_at) return err('description and discovered_at are required');

    const breachId = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO data_breaches
        (id, tenant_id, discovered_at, description, data_types, individuals_affected, risk_level, created_by)
      VALUES (?,?,?,?,?,?,?,?)
    `).bind(
      breachId, tid, body.discovered_at, body.description,
      body.data_types ? JSON.stringify(body.data_types) : null,
      body.individuals_affected ?? null,
      body.risk_level ?? 'low',
      ctx.userId,
    ).run();

    await audit(env, { ...auditFromRequest(request, ctx), action: 'create', resource: 'data_breach', resourceId: breachId });
    return created({ id: breachId });
  }

  // PATCH /api/gdpr/breaches/:id
  if (resource === 'breaches' && id && method === 'PATCH') {
    const denied = requirePermission(ctx, 'settings:manage:security');
    if (denied) return denied;
    const body: any = await request.json().catch(() => ({}));
    await env.DB.prepare(`
      UPDATE data_breaches SET
        status = COALESCE(?, status),
        reported_to_ico = COALESCE(?, reported_to_ico),
        ico_reference = COALESCE(?, ico_reference),
        remediation = COALESCE(?, remediation),
        updated_at = datetime('now')
      WHERE id = ? AND tenant_id = ?
    `).bind(
      body.status ?? null, body.reported_to_ico ?? null,
      body.ico_reference ?? null, body.remediation ?? null,
      id, tid
    ).run();
    return ok({ updated: true });
  }

  // ── DATA RETENTION — run cleanup ──────────────────────────────
  // POST /api/gdpr/retention/run — purge data past retention period
  if (resource === 'retention' && id === 'run' && method === 'POST') {
    if (!hasPermission(ctx, '*:*:*')) return err('Super admin only', 403);

    const config = await env.DB.prepare(
      `SELECT * FROM gdpr_config WHERE tenant_id = ?`
    ).bind(tid).first() as any;
    if (!config) return err('GDPR config not found');

    const results: Record<string, number> = {};

    // Purge old audit logs
    const auditCutoff = new Date(Date.now() - (config.retention_audit_logs ?? 365) * 86400000).toISOString();
    const auditDel = await env.DB.prepare(
      `DELETE FROM audit_log WHERE tenant_id = ? AND created_at < ?`
    ).bind(tid, auditCutoff).run();
    results.audit_logs_purged = auditDel.meta?.changes ?? 0;

    // Note: employee data, timesheets, expenses are NOT auto-deleted
    // — flagged for manual review to avoid accidental loss
    results.note = 'Employee records flagged only — manual deletion required for employee data';

    await audit(env, { ...auditFromRequest(request, ctx), action: 'retention_run', resource: 'gdpr', resourceId: tid });
    return ok({ ran_at: new Date().toISOString(), ...results });
  }

  return notFound();
}

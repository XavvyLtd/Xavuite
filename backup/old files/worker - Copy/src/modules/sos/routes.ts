import { ok, created, err, notFound } from '../../core/response';
import { audit, auditFromRequest } from '../../middleware/audit';
import { sendMail } from '../../core/email';
import type { Env, AppContext } from '../../types';

export async function handleSOS(
  request: Request, env: Env, ctx: AppContext, subPath: string
): Promise<Response> {
  const [id, action] = subPath.split('/').filter(Boolean);

  // GET /api/sos — list alerts
  if (!id && request.method === 'GET') {
    const url = new URL(request.url);
    const status = url.searchParams.get('status') ?? 'active';
    const rows = await env.DB.prepare(`
      SELECT a.*,
             u.email AS raised_by_email,
             (SELECT COUNT(*) FROM sos_acknowledgements WHERE alert_id=a.id) AS ack_count
      FROM sos_alerts a
      LEFT JOIN users u ON u.id=a.raised_by
      WHERE a.tenant_id=? AND (? = 'all' OR a.status=?)
      ORDER BY a.raised_at DESC LIMIT 50
    `).bind(ctx.tenantId, status, status).all();
    return ok(rows.results);
  }

  // POST /api/sos — raise alert
  if (!id && request.method === 'POST') {
    const body = await request.json() as any;
    if (!body.title || !body.message) return err('title and message are required');

    const alertId = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO sos_alerts (id,tenant_id,title,message,severity,alert_type,status,audience,location,action_required,raised_by,raised_at)
      VALUES (?,?,?,?,?,?,  'active',?,?,?,?,CURRENT_TIMESTAMP)
    `).bind(alertId, ctx.tenantId, body.title, body.message, body.severity??'high', body.alertType??'general', body.audience??'all_staff', body.location??null, body.actionRequired??null, ctx.userId).run();

    // Broadcast email to HR and all users
    const recipients = await env.DB.prepare(`
      SELECT u.email FROM users u WHERE u.tenant_id=? AND u.status='active' LIMIT 200
    `).bind(ctx.tenantId).all() as any;

    const SEVERITY_COLORS: Record<string,string> = { critical:'#7F1D1D', high:'#EF4444', medium:'#F59E0B', low:'#6366F1' };
    const color = SEVERITY_COLORS[body.severity??'high'] ?? '#EF4444';
    const severity = (body.severity??'high').toUpperCase();

    for (const rec of (recipients.results ?? []).slice(0, 50)) {
      await sendMail(env, {
        to: rec.email,
        subject: `🚨 ${severity} ALERT: ${body.title}`,
        html: `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden">
  <div style="background:${color};padding:20px 24px">
    <h2 style="color:#fff;margin:0">🚨 ${severity} ALERT: ${body.title}</h2>
    <p style="color:#fff;opacity:0.8;margin:4px 0 0;font-size:12px">${env.TENANT_NAME} · Emergency Notification</p>
  </div>
  <div style="padding:24px">
    <p style="font-size:16px;color:#1a1a2e;margin-bottom:16px">${body.message}</p>
    ${body.location ? `<p><strong>Location:</strong> ${body.location}</p>` : ''}
    ${body.actionRequired ? `<div style="background:#FEF3C7;border:1px solid #F59E0B;border-radius:8px;padding:12px;margin-top:16px"><strong>Action Required:</strong> ${body.actionRequired}</div>` : ''}
    <p style="color:#666;font-size:12px;margin-top:24px">This is an automated emergency notification from ${env.TENANT_NAME}.</p>
  </div>
</div></body></html>`,
      }).catch(() => {}); // Don't fail if one email fails
    }

    // Log escalations
    if (recipients.results?.length > 0) {
      const stmts = (recipients.results as any[]).slice(0, 20).map((r: any) =>
        env.DB.prepare(`INSERT INTO sos_escalations (id,alert_id,tenant_id,notified_at,channel) VALUES (?,?,?,CURRENT_TIMESTAMP,'email')`)
          .bind(crypto.randomUUID(), alertId, ctx.tenantId)
      );
      await env.DB.batch(stmts);
    }

    await audit(env, { ...auditFromRequest(request, ctx), action:'create', resource:'sos_alert', resourceId:alertId });
    return created({ id:alertId, notified: recipients.results?.length ?? 0 });
  }

  // GET /api/sos/:id
  if (id && !action && request.method === 'GET') {
    const alert = await env.DB.prepare(`
      SELECT a.*, u.email AS raised_by_email
      FROM sos_alerts a LEFT JOIN users u ON u.id=a.raised_by
      WHERE a.id=? AND a.tenant_id=?
    `).bind(id, ctx.tenantId).first();
    if (!alert) return notFound('Alert not found');

    const acks = await env.DB.prepare(`
      SELECT sa.*, u.email FROM sos_acknowledgements sa LEFT JOIN users u ON u.id=sa.user_id
      WHERE sa.alert_id=? ORDER BY sa.acknowledged_at DESC
    `).bind(id).all();

    return ok({ ...alert, acknowledgements: acks.results });
  }

  // POST /api/sos/:id/resolve
  if (id && action==='resolve' && request.method==='POST') {
    const { note } = await request.json() as any;
    await env.DB.prepare(`
      UPDATE sos_alerts SET status='resolved', resolved_at=CURRENT_TIMESTAMP, resolved_by=?, resolution_note=? WHERE id=? AND tenant_id=?
    `).bind(ctx.userId, note??null, id, ctx.tenantId).run();
    await audit(env, { ...auditFromRequest(request, ctx), action:'update', resource:'sos_alert', resourceId:id, metadata:{ action:'resolve' } });
    return ok({ id, status:'resolved' });
  }

  // POST /api/sos/:id/acknowledge
  if (id && action==='acknowledge' && request.method==='POST') {
    const { status } = await request.json() as any;
    await env.DB.prepare(`
      INSERT OR REPLACE INTO sos_acknowledgements (id,alert_id,tenant_id,user_id,acknowledged_at,status)
      VALUES (?,?,?,?,CURRENT_TIMESTAMP,?)
    `).bind(crypto.randomUUID(), id, ctx.tenantId, ctx.userId, status??'safe').run();
    return ok({ id, acknowledged:true });
  }

  return err('Not found', 404);
}

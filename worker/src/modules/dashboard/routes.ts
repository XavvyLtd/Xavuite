import { ok } from '../../core/response';
import type { Env, AppContext } from '../../types';

export async function handleDashboard(
  request: Request, env: Env, ctx: AppContext, subPath: string
): Promise<Response> {
  const [resource] = subPath.split('/').filter(Boolean);

  // GET /api/dashboard — main live metrics
  if (!resource && request.method === 'GET') {
    const tid = ctx.tenantId;
    const [
      employees, onLeave, pendingLeave, pendingTimesheets,
      pendingExpenses, openJobs, activeProjects,
      expiringRTW, expiringVisas, overdueOnboarding,
      recentActivity,
    ] = await Promise.all([
      env.DB.prepare(`SELECT COUNT(*) as n FROM employees e
       WHERE e.tenant_id=? AND e.status='active'`).bind(tid).first() as any,
      env.DB.prepare(`SELECT COUNT(*) as n FROM leave_requests WHERE tenant_id=? AND status='approved' AND start_date<=date('now') AND end_date>=date('now')`).bind(tid).first() as any,
      env.DB.prepare(`SELECT COUNT(*) as n FROM leave_requests WHERE tenant_id=? AND status='pending'`).bind(tid).first() as any,
      env.DB.prepare(`SELECT COUNT(*) as n FROM timesheets WHERE tenant_id=? AND status='pending'`).bind(tid).first() as any,
      env.DB.prepare(`SELECT COUNT(*) as n FROM expense_claims WHERE tenant_id=? AND status='pending'`).bind(tid).first() as any,
      env.DB.prepare(`SELECT COUNT(*) as n FROM job_requisitions WHERE tenant_id=? AND status IN ('open','approved')`).bind(tid).first() as any,
      env.DB.prepare(`SELECT COUNT(*) as n FROM pmo_projects WHERE tenant_id=? AND status='active'`).bind(tid).first() as any,
      env.DB.prepare(`SELECT COUNT(*) as n FROM employee_right_to_work WHERE tenant_id=? AND (status='expired' OR (expiry_date IS NOT NULL AND expiry_date<=date('now','+90 days') AND expiry_date>=date('now')))`).bind(tid).first() as any,
      env.DB.prepare(`SELECT COUNT(*) as n FROM employee_visas WHERE tenant_id=? AND status='active' AND expiry_date IS NOT NULL AND expiry_date<=date('now','+90 days') AND expiry_date>=date('now')`).bind(tid).first() as any,
      env.DB.prepare(`SELECT COUNT(*) as n FROM employee_onboarding WHERE tenant_id=? AND status IN ('in_progress','overdue')`).bind(tid).first() as any,
      env.DB.prepare(`
        SELECT al.action, al.resource, al.created_at, u.email as user_email
        FROM audit_log al LEFT JOIN users u ON u.id=al.user_id
        WHERE al.tenant_id=? ORDER BY al.created_at DESC LIMIT 8
      `).bind(tid).all() as any,
    ]);

    return ok({
      metrics: {
        activeEmployees:      employees?.n    ?? 0,
        onLeaveToday:         onLeave?.n      ?? 0,
        pendingLeave:         pendingLeave?.n ?? 0,
        pendingTimesheets:    pendingTimesheets?.n ?? 0,
        pendingExpenses:      pendingExpenses?.n   ?? 0,
        openJobs:             openJobs?.n          ?? 0,
        activeProjects:       activeProjects?.n     ?? 0,
        expiringRTW:          expiringRTW?.n        ?? 0,
        expiringVisas:        expiringVisas?.n      ?? 0,
        overdueOnboarding:    overdueOnboarding?.n  ?? 0,
        totalPendingApprovals: (pendingLeave?.n ?? 0) + (pendingTimesheets?.n ?? 0) + (pendingExpenses?.n ?? 0),
      },
      recentActivity: recentActivity?.results ?? [],
    });
  }

  // GET /api/dashboard/notifications — in-app notification feed
  if (resource === 'notifications' && request.method === 'GET') {
    const tid = ctx.tenantId;
    const notifications: any[] = [];

    // Pending approvals
    const [leave, ts, exp] = await Promise.all([
      env.DB.prepare(`SELECT COUNT(*) as n FROM leave_requests WHERE tenant_id=? AND status='pending'`).bind(tid).first() as any,
      env.DB.prepare(`SELECT COUNT(*) as n FROM timesheets WHERE tenant_id=? AND status='pending'`).bind(tid).first() as any,
      env.DB.prepare(`SELECT COUNT(*) as n FROM expense_claims WHERE tenant_id=? AND status='pending'`).bind(tid).first() as any,
    ]);
    if (leave?.n > 0)  notifications.push({ id:'leave-pending',   type:'approval', icon:'🌴', title:`${leave.n} leave request${leave.n>1?'s':''} pending`,  link:'leave',     priority:'high',   created_at: new Date().toISOString() });
    if (ts?.n > 0)     notifications.push({ id:'ts-pending',      type:'approval', icon:'⏱',  title:`${ts.n} timesheet${ts.n>1?'s':''} pending approval`,  link:'timesheets', priority:'medium', created_at: new Date().toISOString() });
    if (exp?.n > 0)    notifications.push({ id:'exp-pending',     type:'approval', icon:'💳', title:`${exp.n} expense claim${exp.n>1?'s':''} awaiting review`, link:'expenses',   priority:'medium', created_at: new Date().toISOString() });

    // Compliance alerts
    const rtwExpired = await env.DB.prepare(`SELECT COUNT(*) as n FROM employee_right_to_work WHERE tenant_id=? AND status='expired'`).bind(tid).first() as any;
    if (rtwExpired?.n > 0) notifications.push({ id:'rtw-expired', type:'compliance', icon:'🚨', title:`${rtwExpired.n} RTW document${rtwExpired.n>1?'s':''} expired`, link:'compliance', priority:'urgent', created_at: new Date().toISOString() });

    const visaExp30 = await env.DB.prepare(`SELECT COUNT(*) as n FROM employee_visas WHERE tenant_id=? AND status='active' AND expiry_date<=date('now','+30 days') AND expiry_date>=date('now')`).bind(tid).first() as any;
    if (visaExp30?.n > 0) notifications.push({ id:'visa-expiring', type:'compliance', icon:'🛂', title:`${visaExp30.n} visa${visaExp30.n>1?'s':''} expiring within 30 days`, link:'visa', priority:'urgent', created_at: new Date().toISOString() });

    // Workflow escalations
    const escalated = await env.DB.prepare(`SELECT COUNT(*) as n FROM workflow_instances WHERE tenant_id=? AND status='escalated'`).bind(tid).first() as any;
    if (escalated?.n > 0) notifications.push({ id:'wf-escalated', type:'workflow', icon:'⚠️', title:`${escalated.n} workflow${escalated.n>1?'s':''} escalated — SLA breached`, link:'workflow', priority:'urgent', created_at: new Date().toISOString() });

    // Upcoming interviews
    const interviews = await env.DB.prepare(`
      SELECT COUNT(*) as n FROM interviews i
      JOIN job_applications a ON a.id=i.application_id
      WHERE i.tenant_id=? AND i.status='scheduled' AND i.scheduled_at>=datetime('now') AND i.scheduled_at<=datetime('now','+24 hours')
    `).bind(tid).first() as any;
    if (interviews?.n > 0) notifications.push({ id:'interviews-today', type:'recruitment', icon:'🎤', title:`${interviews.n} interview${interviews.n>1?'s':''} scheduled today`, link:'recruitment', priority:'medium', created_at: new Date().toISOString() });

    // Sort by priority
    const order = { urgent:0, high:1, medium:2, low:3 };
    notifications.sort((a,b) => (order[a.priority as keyof typeof order]??3) - (order[b.priority as keyof typeof order]??3));

    return ok(notifications);
  }

  // POST /api/dashboard/notifications/dismiss
  if (resource === 'notifications' && request.method === 'POST') {
    const body = await request.json().catch(() => ({})) as any;
    if (body.id && env.KV) {
      await env.KV.put(`dismissed:${ctx.userId}:${body.id}`, '1', { expirationTtl: 86400 * 30 });
    }
    return ok({ dismissed: true });
  }

  return ok({ metrics: {}, recentActivity: [] });
}

import { handleAuth }        from './modules/auth/routes';
import { handleEmployees }   from './modules/employees/routes';
import { handleLeave }       from './modules/leave/routes';
import { handleTimesheets }  from './modules/timesheets/routes';
import { handleScheduler, runScheduledJobs } from './modules/scheduler/routes';
import { handleWorkflows } from './modules/workflow/routes';
import { handleRecruitment }         from './modules/recruitment/routes';
import { handleOnboarding }          from './modules/onboarding/routes';
import { handleLeaveEnhancements }   from './modules/leave/enhancements';
import { handleVisas }               from './modules/visa/routes';
import { handleDashboard }           from './modules/dashboard/routes';
import { handleEmployeeProfile, handleChecklists } from './modules/profile/routes';
import { handleReporting }           from './modules/reporting/routes';
import { handleOffboarding }         from './modules/offboarding/routes';
import { handleSOS }                 from './modules/sos/routes';
import { handleResources }           from './modules/resources/routes';
import { handleSettings }            from './modules/settings/routes';
import { handleStorage }             from './modules/storage/routes';
import { handleMagicLink, handleMFA, handleOAuth, handleSAML, handleSSOConfig } from './platform/auth/sso';
import { resolveTenant, getPlanLimits, enforcePlan } from './platform/tenancy/resolver';
import { handleSignup }  from './modules/signup/routes';
import { handleBilling } from './modules/billing/routes';
import { processSLABreaches } from './platform/workflow/engine';
import {
  handleExpenses,
  handleCompliance,
  handleDocuments,
  handleAnnouncements,
  handleRecruitment,
  handleAssets,
  handleTraining,
} from './modules/modules';
// ── NEW: PMO, Clients & Invoicing ────────────────────────────────────────────
import { handlePMO } from './modules/pmo/routes';
import { handleClients }    from './modules/clients/routes';
import { handleInvoicing }  from './modules/invoicing/routes';
// ─────────────────────────────────────────────────────────────────────────────
import { authMiddleware }    from './middleware/auth';
import { withCors, handleOptions, ok, err } from './core/response';
import { resolveDownloadToken, streamFile } from './core/storage';
import { sendMail, complianceAlertEmail, timesheetReminderEmail } from './core/email';
import type { Env, AppContext } from './types';

// ── Route table ───────────────────────────────────────────────────────────────
const ROUTES: Array<{
  prefix: string;
  handler: (req: Request, env: Env, ctx: AppContext, sub: string) => Promise<Response>;
}> = [
  { prefix: '/api/employees',     handler: (req, env, ctx) => {
      const subPath = new URL(req.url).pathname.replace('/api/employees', '') || '/';
      const parts = subPath.split('/').filter(Boolean);
      // Sub-resource routes: /api/employees/:id/emergency-contacts|compensation|bank-details
      if (parts.length >= 2 && ['emergency-contacts','compensation','bank-details','leave-balances'].includes(parts[1])) {
        return handleEmployeeProfile(req, env, ctx, `/${parts[0]}/${parts[1]}`);
      }
      return handleEmployees(req, env, ctx, subPath);
    } },
  { prefix: '/api/leave/types',    handler: (req, env, ctx) => handleLeaveEnhancements(req, env, ctx, '/types') },
  { prefix: '/api/leave/policies', handler: (req, env, ctx) => handleLeaveEnhancements(req, env, ctx, '/policies') },
  { prefix: '/api/leave/balances', handler: (req, env, ctx) => handleLeaveEnhancements(req, env, ctx, new URL(req.url).pathname.replace('/api/leave','')) },
  { prefix: '/api/leave/holidays', handler: (req, env, ctx) => handleLeaveEnhancements(req, env, ctx, '/holidays') },
  { prefix: '/api/leave/calendar', handler: (req, env, ctx) => handleLeaveEnhancements(req, env, ctx, '/calendar') },
  { prefix: '/api/leave',         handler: handleLeave },
  { prefix: '/api/timesheets',    handler: handleTimesheets },
  { prefix: '/api/expenses',      handler: handleExpenses },
  { prefix: '/api/compliance',    handler: handleCompliance },
  { prefix: '/api/documents',     handler: handleDocuments },
  { prefix: '/api/announcements', handler: handleAnnouncements },
  { prefix: '/api/pmo',           handler: (req, env, ctx) => handlePMO(req, env, ctx, new URL(req.url).pathname.replace('/api/pmo','') || '/') },
  { prefix: '/api/recruitment',   handler: handleRecruitment },
  { prefix: '/api/assets',        handler: handleAssets },
  { prefix: '/api/training',      handler: handleTraining },
  { prefix: '/api/scheduler',     handler: handleScheduler },
  { prefix: '/api/workflows',     handler: handleWorkflows },
  { prefix: '/api/recruitment',   handler: (req, env, ctx) => handleRecruitment(req, env, ctx, new URL(req.url).pathname.replace('/api/recruitment','')) },
  { prefix: '/api/onboarding',     handler: (req, env, ctx) => handleOnboarding(req, env, ctx, new URL(req.url).pathname.replace('/api/onboarding','')) },
  { prefix: '/api/visas',          handler: (req, env, ctx) => handleVisas(req, env, ctx, new URL(req.url).pathname.replace('/api/visas','')) },
  { prefix: '/api/dashboard',       handler: (req, env, ctx) => handleDashboard(req, env, ctx, new URL(req.url).pathname.replace('/api/dashboard','')) },
  { prefix: '/api/checklists',      handler: (req, env, ctx) => handleChecklists(req, env, ctx, new URL(req.url).pathname.replace('/api/checklists','')) },
  { prefix: '/api/reporting',       handler: (req, env, ctx) => handleReporting(req, env, ctx, new URL(req.url).pathname.replace('/api/reporting','')) },
  { prefix: '/api/offboarding',     handler: (req, env, ctx) => handleOffboarding(req, env, ctx, new URL(req.url).pathname.replace('/api/offboarding','')) },
  { prefix: '/api/sos',             handler: (req, env, ctx) => handleSOS(req, env, ctx, new URL(req.url).pathname.replace('/api/sos','')) },
  { prefix: '/api/resources',       handler: (req, env, ctx) => handleResources(req, env, ctx, new URL(req.url).pathname.replace('/api/resources','')) },
  { prefix: '/api/storage',        handler: (req, env, ctx) => handleStorage(req, env, ctx, new URL(req.url).pathname.replace('/api/storage','')) },
  { prefix: '/api/settings',        handler: (req, env, ctx) => handleSettings(req, env, ctx, new URL(req.url).pathname.replace('/api/settings','')) },
  { prefix: '/api/billing',         handler: (req, env, ctx) => handleBilling(req, env, ctx, new URL(req.url).pathname.replace('/api/billing','')) },
  // ── NEW routes ──────────────────────────────────────────────────────────────
  { prefix: '/api/clients',         handler: (req, env, ctx) => handleClients(req, env, ctx, new URL(req.url).pathname.replace('/api/clients','') || '/') },
  { prefix: '/api/invoices',        handler: (req, env, ctx) => handleInvoicing(req, env, ctx, new URL(req.url).pathname.replace('/api/invoices','') || '/') },
  // ────────────────────────────────────────────────────────────────────────────
  { prefix: '/api/auth/magic-link',   handler: (req, env, ctx) => handleMagicLink(req, env, ctx, new URL(req.url).pathname.replace('/api/auth/magic-link','')) },
  { prefix: '/api/auth/mfa',          handler: (req, env, ctx) => handleMFA(req, env, ctx, new URL(req.url).pathname.replace('/api/auth/mfa','')) },
  { prefix: '/api/auth/entra',        handler: (req, env, ctx) => handleOAuth(req, env, ctx, new URL(req.url).pathname.replace('/api/auth/entra',''), 'entra') },
  { prefix: '/api/auth/google',       handler: (req, env, ctx) => handleOAuth(req, env, ctx, new URL(req.url).pathname.replace('/api/auth/google',''), 'google') },
  { prefix: '/api/auth/saml',         handler: (req, env, ctx) => handleSAML(req, env, ctx, new URL(req.url).pathname.replace('/api/auth/saml','')) },
  { prefix: '/api/auth/sso-config',   handler: (req, env, ctx) => handleSSOConfig(req, env, ctx, new URL(req.url).pathname.replace('/api/auth/sso-config','')) },
];

// ── Main fetch handler ────────────────────────────────────────────────────────
async function handleFetch(request: Request, env: Env): Promise<Response> {
  // CORS preflight
  if (request.method === 'OPTIONS') return handleOptions(request);

  const url = new URL(request.url);
  const path = url.pathname;

  // Health check (public)
  if (path === '/api/health') {
    return withCors(ok({
      status: 'ok',
      tenant: env.TENANT_NAME,
      mode: env.DEPLOYMENT_MODE,
      version: '1.0.0',
    }), request);
  }

  // Public logo endpoint — no auth required (img tags can't send auth headers)
  if (path.startsWith('/api/public/logo/')) {
    const logoTenantId = path.split('/').pop() ?? '';
    const branding = await env.DB.prepare(
      `SELECT logo_url, company_name FROM tenant_branding WHERE tenant_id=? LIMIT 1`
    ).bind(logoTenantId || env.TENANT_ID).first() as any;

    if (branding?.logo_url && env.STORE) {
      const key = branding.logo_url.replace('/api/storage/file/', '');
      const obj = await env.STORE.get(key);
      if (obj) {
        const headers = new Headers();
        obj.writeHttpMetadata(headers);
        headers.set('Cache-Control', 'public, max-age=86400');
        headers.set('Access-Control-Allow-Origin', '*');
        return new Response(obj.body, { headers });
      }
    }
    if (branding?.logo_url) {
      return Response.redirect(branding.logo_url, 302);
    }
    return new Response('Not found', { status: 404 });
  }

  // Tenant shell (public)
  if (path === '/api/tenant/shell') {
    const branding = await env.DB.prepare(
      `SELECT * FROM tenant_branding WHERE tenant_id = ? LIMIT 1`
    ).bind(env.TENANT_ID).first();

    const modules = await env.DB.prepare(
      `SELECT module_key, config FROM tenant_modules WHERE tenant_id = ? AND enabled = 1`
    ).bind(env.TENANT_ID).all();

    return withCors(ok({
      tenant:  { id: env.TENANT_ID, name: env.TENANT_NAME, domain: env.TENANT_DOMAIN },
      branding,
      modules: (modules.results as any[]).map(m => ({
        key: m.module_key,
        config: m.config ? JSON.parse(m.config) : {},
      })),
    }), request);
  }

  // Auth routes (public)
  if (path.startsWith('/api/auth/')) {
    const sub = path.slice('/api/auth'.length);
    const response = await handleAuth(request, env, sub);
    return withCors(response, request);
  }

  // Signup routes (public)
  if (path.startsWith('/api/signup')) {
    const tenantResolution = await resolveTenant(request, env);
    const tenantId = tenantResolution?.tenantId ?? '';
    const response = await handleSignup(request, env, path.replace('/api/signup', ''));
    return withCors(response, request);
  }

  // Billing webhook (public)
  if (path === '/api/billing/webhook') {
    const tenantResolution = await resolveTenant(request, env);
    const ctx2 = { tenantId: tenantResolution?.tenantId ?? '', userId: '', userEmail: '', roles: [], permissions: [] };
    const response = await handleBilling(request, env, ctx2, '/webhook');
    return withCors(response, request);
  }

  // File download via token (public but single-use)
  if (path.startsWith('/api/files/download/')) {
    const token = path.slice('/api/files/download/'.length);
    const key = await resolveDownloadToken(env, token);
    if (!key) return withCors(err('Invalid or expired download token', 404), request);
    const response = await streamFile(env, key);
    if (!response) return withCors(err('File not found', 404), request);
    return withCors(response, request);
  }

  // Protected routes — require auth
  const authResult = await authMiddleware(request, env);
  if (authResult instanceof Response) return withCors(authResult, request);
  const ctx = authResult.ctx;

  // GET /api/me
  if (path === '/api/me' && request.method === 'GET') {
    const user = await env.DB.prepare(
      `SELECT id, email, status, last_login, created_at FROM users WHERE id = ? AND tenant_id = ?`
    ).bind(ctx.userId, ctx.tenantId).first();

    const employee = await env.DB.prepare(
      `SELECT e.id, e.employee_number, e.status,
              eh.first_name, eh.last_name, eh.department_id, eh.designation_id
       FROM employees e
       JOIN employee_history eh ON eh.employee_id = e.id AND eh.is_current = 1
       WHERE e.user_id = ? AND e.tenant_id = ?`
    ).bind(ctx.userId, ctx.tenantId).first();

    return withCors(ok({ user, employee, roles: ctx.roles, permissions: ctx.permissions }), request);
  }

  // Departments
  if (path === '/api/departments' && request.method === 'GET') {
    const rows = await env.DB.prepare(
      `SELECT d.*, COUNT(DISTINCT e.id) as employee_count FROM departments d LEFT JOIN employee_history e ON e.department_id = d.id AND e.is_current = 1 WHERE d.tenant_id = ? GROUP BY d.id`
    ).bind(ctx.tenantId).all();
    return withCors(ok(rows.results), request);
  }

  // ── Roles API ──────────────────────────────────────────────────────────────
  // GET /api/roles — list all roles for this tenant
  if (path === '/api/roles' && request.method === 'GET') {
    const rows = await env.DB.prepare(
      `SELECT id, name, description, is_system FROM roles WHERE tenant_id = ? ORDER BY is_system DESC, name ASC`
    ).bind(ctx.tenantId).all();
    return withCors(ok(rows.results), request);
  }

  // GET /api/roles/user/:userId — get roles assigned to a user
  if (path.startsWith('/api/roles/user/') && request.method === 'GET') {
    const userId = path.slice('/api/roles/user/'.length);
    const rows = await env.DB.prepare(`
      SELECT r.id, r.name, r.description, r.is_system, ur.granted_at
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = ? AND r.tenant_id = ?
      ORDER BY r.name
    `).bind(userId, ctx.tenantId).all();
    return withCors(ok(rows.results), request);
  }

  // POST /api/roles/user/:userId — assign a role to a user
  if (path.startsWith('/api/roles/user/') && request.method === 'POST') {
    if (!ctx.permissions?.includes('*:*:*')) return withCors(err('Forbidden', 403), request);
    const userId = path.slice('/api/roles/user/'.length);
    const body = await request.json() as any;
    if (!body.roleId) return withCors(err('roleId is required'), request);
    await env.DB.prepare(`
      INSERT OR IGNORE INTO user_roles (user_id, role_id, scope_type, granted_by, granted_at)
      VALUES (?, ?, 'global', ?, datetime('now'))
    `).bind(userId, body.roleId, ctx.userId).run();
    return withCors(ok({ assigned: true }), request);
  }

  // DELETE /api/roles/user/:userId/:roleId — remove a role from a user
  if (path.match(/^\/api\/roles\/user\/[^/]+\/[^/]+$/) && request.method === 'DELETE') {
    if (!ctx.permissions?.includes('*:*:*')) return withCors(err('Forbidden', 403), request);
    const parts = path.split('/');
    const userId = parts[4];
    const roleId = parts[5];
    await env.DB.prepare(
      `DELETE FROM user_roles WHERE user_id = ? AND role_id = ?`
    ).bind(userId, roleId).run();
    return withCors(ok({ removed: true }), request);
  }

  // Audit log
  if (path === '/api/audit' && request.method === 'GET') {
    const url2 = new URL(request.url);
    const page = Math.max(1, parseInt(url2.searchParams.get('page') ?? '1'));
    const limit = Math.min(100, parseInt(url2.searchParams.get('limit') ?? '50'));
    const offset = (page - 1) * limit;

    const rows = await env.DB.prepare(
      `SELECT al.*, u.email FROM audit_log al LEFT JOIN users u ON u.id = al.user_id WHERE al.tenant_id = ? ORDER BY al.created_at DESC LIMIT ? OFFSET ?`
    ).bind(ctx.tenantId, limit, offset).all();
    const count = await env.DB.prepare(`SELECT COUNT(*) as n FROM audit_log WHERE tenant_id = ?`).bind(ctx.tenantId).first() as any;

    return withCors(ok({ items: rows.results, meta: { total: count.n, page, limit } }), request);
  }

  // Module dispatch
  for (const route of ROUTES) {
    if (path.startsWith(route.prefix)) {
      const sub = path.slice(route.prefix.length) || '/';
      const response = await route.handler(request, env, ctx, sub);
      return withCors(response, request);
    }
  }

  return withCors(err('Not found', 404), request);
}

// ── Cron handler ──────────────────────────────────────────────────────────────
async function handleCron(event: ScheduledEvent, env: Env): Promise<void> {
  const cron = event.cron;
  console.log('[cron] Triggered:', cron);

  await runScheduledJobs(env, cron);
  await processSLABreaches(env, env.TENANT_ID);

  try {
    if (cron === '0 6 * * 1') {
      const expiring = await env.DB.prepare(`
        SELECT rw.doc_type, rw.expiry_date, rw.status, eh.first_name || ' ' || eh.last_name AS name
        FROM employee_right_to_work rw
        JOIN employee_history eh ON eh.employee_id = rw.employee_id AND eh.is_current = 1
        WHERE rw.tenant_id = ? AND (rw.status = 'expired' OR (rw.expiry_date <= date('now', '+90 days') AND rw.expiry_date > date('now')))
      `).bind(env.TENANT_ID).all() as any;

      if (expiring.results.length > 0) {
        await sendMail(env, {
          to: env.EMAIL_HR,
          subject: 'Weekly Compliance Alert: RTW and Visa Status Report',
          html: complianceAlertEmail({ items: expiring.results }),
        });
      }
    }

    if (cron === '0 17 * * 5') {
      const today = new Date().toISOString().split('T')[0];
      const activeSprint = await env.DB.prepare(
        `SELECT * FROM pmo_sprints WHERE tenant_id = ? AND start_date <= ? AND end_date >= ? ORDER BY sprint_number DESC LIMIT 1`
      ).bind(env.TENANT_ID, today, today).first() as any;

      if (activeSprint) {
        await env.DB.batch([
          env.DB.prepare(
            `UPDATE pmo_tasks SET status = 'done', updated_at = CURRENT_TIMESTAMP WHERE sprint_id != ? AND status = 'in_progress' AND tenant_id = ?`
          ).bind(activeSprint.id, env.TENANT_ID),
          env.DB.prepare(
            `UPDATE pmo_tasks SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP WHERE sprint_id = ? AND status = 'todo' AND tenant_id = ?`
          ).bind(activeSprint.id, env.TENANT_ID),
        ]);
      }
    }

    if (cron === '0 9 26 * *') {
      const employees = await env.DB.prepare(`
        SELECT u.email, eh.first_name AS name
        FROM employees e
        JOIN users u ON u.id = e.user_id
        JOIN employee_history eh ON eh.employee_id = e.id AND eh.is_current = 1
        WHERE e.tenant_id = ? AND e.status = 'active'
      `).bind(env.TENANT_ID).all() as any;

      const weekEnding = new Date();
      weekEnding.setDate(weekEnding.getDate() + (5 - weekEnding.getDay()));
      const weekEndStr = weekEnding.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

      for (const emp of employees.results) {
        await sendMail(env, {
          to: emp.email,
          subject: 'Timesheet Submission Reminder',
          html: timesheetReminderEmail({ name: emp.name, weekEnding: weekEndStr }),
        });
      }
    }

    // Auto-flag overdue invoices daily
    if (cron === '0 8 * * *' || cron === '0 9 * * *') {
      await env.DB.prepare(`
        UPDATE invoices SET status = 'overdue', updated_at = datetime('now')
        WHERE status = 'sent' AND due_date < date('now')
      `).run();
    }
  } catch (err) {
    console.error('[cron] Error:', err);
  }
}

// ── Worker export ─────────────────────────────────────────────────────────────
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await handleFetch(request, env);
    } catch (error) {
      const err = error as any;
      const errMsg  = err?.message ?? String(err);
      const errStack= err?.stack ?? '';
      console.error('[worker] Unhandled error:', errMsg, '\n', errStack);

      const isLocal = env.DEPLOYMENT_MODE === 'local' || !env.EMAIL_FROM;
      if (!isLocal) {
        try {
          await fetch('https://api.mailchannels.net/tx/v1/send', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              personalizations: [{ to: [{ email: 'support@xavvy.uk', name: 'XavvySuite Support' }] }],
              from: { email: env.EMAIL_FROM, name: env.TENANT_NAME ?? 'XavvySuite' },
              subject: `[ERROR] ${errMsg.slice(0, 80)}`,
              content: [{ type: 'text/plain', value: [`Error: ${errMsg}`, `URL: ${request.url}`, `Method: ${request.method}`, `Time: ${new Date().toISOString()}`, `Tenant: ${env.TENANT_ID ?? 'unknown'}`, '', 'Stack:', errStack].join('\n') }],
            }),
          });
        } catch (emailErr) {
          console.error('[worker] Failed to send error email:', emailErr);
        }
      }

      return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
    }
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleCron(event, env));
  },
};

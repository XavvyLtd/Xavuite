import { handleAuth }        from './modules/auth/routes';
import { handleEmployees }   from './modules/employees/routes';
import { handleLeave }       from './modules/leave/routes';
import { handleTimesheets }  from './modules/timesheets/routes';
import { handleAttendance }  from './modules/attendance/routes';
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
import { handleRoles }               from './modules/roles/routes';
import { handleFinance }              from './modules/finance/routes';
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
  handlePMO,
  handleRecruitment,
  handleAssets,
  handleTraining,
} from './modules/modules';
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
  { prefix: '/api/attendance',    handler: (req, env, ctx) => handleAttendance(req, env, ctx, new URL(req.url).pathname.replace('/api/attendance', '')) },
  { prefix: '/api/expenses',      handler: handleExpenses },
  { prefix: '/api/compliance',    handler: handleCompliance },
  { prefix: '/api/documents',     handler: handleDocuments },
  { prefix: '/api/announcements', handler: handleAnnouncements },
  { prefix: '/api/pmo',           handler: handlePMO },
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
  { prefix: '/api/roles',           handler: (req, env, ctx) => handleRoles(req, env, ctx, new URL(req.url).pathname.replace('/api/roles','')) },
  { prefix: '/api/finance',         handler: (req, env, ctx) => handleFinance(req, env, ctx, new URL(req.url).pathname.replace('/api/finance','')) },
  { prefix: '/api/billing',         handler: (req, env, ctx) => handleBilling(req, env, ctx, new URL(req.url).pathname.replace('/api/billing','')) },
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
      // Serve from R2 if it's an R2 key
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
    // Return the URL as redirect if external
    if (branding?.logo_url) {
      return Response.redirect(branding.logo_url, 302);
    }
    return new Response('Not found', { status: 404 });
  }

  // Tenant shell (public — used by frontend to load modules + branding)
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

  // Signup routes (public — no token needed)
  if (path.startsWith('/api/signup')) {
    const tenantResolution = await resolveTenant(request, env);
    const tenantId = tenantResolution?.tenantId ?? '';
    const response = await handleSignup(request, env, path.replace('/api/signup', ''));
    return withCors(response, request);
  }

  // Billing webhook (public — Stripe calls without user token)
  if (path === '/api/billing/webhook') {
    const tenantResolution = await resolveTenant(request, env);
    const ctx2 = { tenantId: tenantResolution?.tenantId ?? '', userId: '', userEmail: '', roles: [], permissions: [] };
    const response = await handleBilling(request, env, ctx2, '/webhook');
    return withCors(response, request);
  }

  // File download via token (public but single-use token)
  if (path.startsWith('/api/files/download/')) {
    const token = path.slice('/api/files/download/'.length);
    const key = await resolveDownloadToken(env, token);
    if (!key) return withCors(err('Invalid or expired download token', 404), request);
    const response = await streamFile(env, key);
    if (!response) return withCors(err('File not found', 404), request);
    return withCors(response, request);
  }

    // New block - access without login
    if (path === "/api/tenant/resolve" && request.method === "GET") {
    const email = url.searchParams.get("email");

    if (!email) {
      return withCors(err('Email ID required', 404), request);
    }

    const domain = email.split("@").pop()?.trim().toLowerCase();

    const tenant = await env.DB.prepare(`
      SELECT
        t.id,
        t.name,
        t.subdomain,
        t.plan,
        td.domain
      FROM tenant_domains td
      INNER JOIN tenants t
        ON t.id = td.tenant_id
      WHERE LOWER(td.domain) = LOWER(?)
        AND t.status = 'active'
      LIMIT 1
    `)
    .bind(domain)
    .first();

    if (!tenant) {
      return withCors(err('Tenant not found', 404), request);
    }

    return withCors(ok({
      tenant
    }), request);
  }

  // end of new block

  
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

  // Register/update a push notification token for the current user (mobile app)
  if (path === '/api/notifications/push-token' && request.method === 'POST') {
    const body = await request.json().catch(() => null) as { token?: string; platform?: string } | null;
    const token    = body?.token?.trim();
    const platform = (body?.platform ?? 'android').toLowerCase();

    if (!token) return withCors(err('Push token is required', 400), request);
    if (!['android', 'ios'].includes(platform)) {
      return withCors(err('platform must be "android" or "ios"', 400), request);
    }

    // Ensure the table exists — safe to run on every call, D1 no-ops if present.
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS push_tokens (
        id          TEXT PRIMARY KEY,
        tenant_id   TEXT NOT NULL,
        user_id     TEXT NOT NULL,
        token       TEXT NOT NULL,
        platform    TEXT NOT NULL DEFAULT 'android',
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(tenant_id, token)
      )
    `).run();

    // Upsert: same user can have multiple device tokens, but the same
    // token should never be duplicated for a tenant (re-registering on
    // app reopen just refreshes updated_at / platform / user_id).
    const existing = await env.DB.prepare(
      `SELECT id FROM push_tokens WHERE tenant_id = ? AND token = ? LIMIT 1`
    ).bind(ctx.tenantId, token).first() as any;

    if (existing) {
      await env.DB.prepare(
        `UPDATE push_tokens SET user_id = ?, platform = ?, updated_at = datetime('now') WHERE id = ?`
      ).bind(ctx.userId, platform, existing.id).run();
    } else {
      await env.DB.prepare(
        `INSERT INTO push_tokens (id, tenant_id, user_id, token, platform) VALUES (?, ?, ?, ?, ?)`
      ).bind(crypto.randomUUID(), ctx.tenantId, ctx.userId, token, platform).run();
    }

    return withCors(ok({ registered: true }), request);
  }

  // Remove a push token (e.g. on logout / notifications disabled)
  if (path === '/api/notifications/push-token' && request.method === 'DELETE') {
    const body = await request.json().catch(() => null) as { token?: string } | null;
    const token = body?.token?.trim();
    if (!token) return withCors(err('Push token is required', 400), request);

    await env.DB.prepare(
      `DELETE FROM push_tokens WHERE tenant_id = ? AND user_id = ? AND token = ?`
    ).bind(ctx.tenantId, ctx.userId, token).run();

    return withCors(ok({ removed: true }), request);
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

  // Dispatch to DB-driven scheduler first — runs any job matching this cron expr
  await runScheduledJobs(env, cron);

  // Process SLA breaches on every cron run
  await processSLABreaches(env, env.TENANT_ID);

  try {
    // wrangler.toml fires a single '*/30 * * * *' cron now (consolidated from
    // three separate crons to stay under the free-plan limit), so event.cron
    // is ALWAYS '*/30 * * * *' here — it can never equal '0 6 * * 1' etc.
    // These checks must use the actual current time instead of matching the
    // old per-schedule cron strings, or the branches below can never fire.
    const now = new Date();
    const utcDay    = now.getUTCDay();     // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
    const utcHour   = now.getUTCHours();
    const utcDate   = now.getUTCDate();    // 1-31
    const utcMinute = now.getUTCMinutes(); // tolerance window, see checks below

    // Monday 6am UTC: weekly compliance check (was '0 6 * * 1')
    if (utcDay === 1 && utcHour === 6 && utcMinute < 5) {
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

    // Friday 5pm UTC: sprint closeout + activate next sprint tasks (was '0 17 * * 5')
    if (utcDay === 5 && utcHour === 17 && utcMinute < 5) {
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

    // 26th monthly: timesheet reminder
    // 26th of the month, 9am UTC: timesheet submission reminder (was '0 9 26 * *')
    if (utcDate === 26 && utcHour === 9 && utcMinute < 5) {
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

      // Send error email — works in production via MailChannels
      // Locally: set MAILCHANNELS_DEV=true in wrangler.toml to test
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
              content: [{
                type: 'text/plain',
                value: [
                  `Error: ${errMsg}`,
                  `URL: ${request.url}`,
                  `Method: ${request.method}`,
                  `Time: ${new Date().toISOString()}`,
                  `Tenant: ${env.TENANT_ID ?? 'unknown'}`,
                  '',
                  'Stack:',
                  errStack,
                ].join('\n'),
              }],
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

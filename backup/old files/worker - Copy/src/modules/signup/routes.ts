/**
 * modules/signup/routes.ts
 * Public tenant onboarding: check availability, register, seed.
 */

import { ok, created, err } from '../../core/response';
// hashPassword inline — sha256 format compatible with auth/routes.ts
async function hashPassword(plain: string): Promise<string> {
  const salt   = crypto.randomUUID().replace(/-/g,'').slice(0,16);
  const data   = new TextEncoder().encode(salt + plain);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const hash   = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2,'0')).join('');
  return `sha256:${salt}:${hash}`;
}
import type { Env } from '../../types';

const RESERVED_SUBDOMAINS = new Set([
  'www', 'app', 'api', 'admin', 'mail', 'smtp', 'ftp', 'dev', 'staging',
  'status', 'billing', 'support', 'help', 'docs', 'blog', 'marketing',
]);

const VALID_SUBDOMAIN = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;

export async function handleSignup(
  request: Request, env: Env, subPath: string
): Promise<Response> {
  const [action] = subPath.split('/').filter(Boolean);

  // GET /api/signup/check?subdomain=
  if (action === 'check' && request.method === 'GET') {
    const url = new URL(request.url);
    const sub = url.searchParams.get('subdomain')?.toLowerCase().trim();
    if (!sub) return err('subdomain is required');

    if (!VALID_SUBDOMAIN.test(sub)) {
      return ok({ available: false, reason: 'Subdomain must be 3–32 lowercase letters, numbers, or hyphens' });
    }
    if (RESERVED_SUBDOMAINS.has(sub)) {
      return ok({ available: false, reason: 'This subdomain is reserved' });
    }

    const existing = await env.DB.prepare(`SELECT id FROM tenants WHERE subdomain=?`).bind(sub).first();
    return ok({ available: !existing, subdomain: sub });
  }

  // POST /api/signup/register
  if (action === 'register' && request.method === 'POST') {
    const body = await request.json() as any;
    const { companyName, subdomain, adminEmail, adminPassword, plan = 'trial' } = body;

    // Validate
    if (!companyName || !subdomain || !adminEmail || !adminPassword) {
      return err('companyName, subdomain, adminEmail and adminPassword are required');
    }
    if (adminPassword.length < 8) return err('Password must be at least 8 characters');
    if (!VALID_SUBDOMAIN.test(subdomain.toLowerCase())) return err('Invalid subdomain format');
    if (RESERVED_SUBDOMAINS.has(subdomain.toLowerCase())) return err('This subdomain is reserved');

    // Check subdomain availability
    const existing = await env.DB.prepare(`SELECT id FROM tenants WHERE subdomain=?`).bind(subdomain.toLowerCase()).first();
    if (existing) return err('This subdomain is already taken');

    // Check email not already registered
    const existingEmail = await env.DB.prepare(`SELECT id FROM users WHERE email=?`).bind(adminEmail.toLowerCase()).first();
    if (existingEmail) return err('An account with this email already exists');

    const tenantId = `tenant-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const userId   = `usr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const trialEnd = new Date(Date.now() + 14 * 86400000).toISOString(); // 14-day trial

    // Hash password
    const pwHash = await hashPassword(adminPassword);

    // ── Create tenant ─────────────────────────────────────────────────────────
    await env.DB.prepare(`
      INSERT INTO tenants (id, name, subdomain, plan, status, created_at)
      VALUES (?, ?, ?, 'starter', 'active', CURRENT_TIMESTAMP)
    `).bind(tenantId, companyName, subdomain.toLowerCase()).run();

    // ── Create admin user ─────────────────────────────────────────────────────
    await env.DB.prepare(`
      INSERT INTO users (id, tenant_id, email, password_hash, status, auth_provider, created_at)
      VALUES (?, ?, ?, ?, 'active', 'local', CURRENT_TIMESTAMP)
    `).bind(userId, tenantId, adminEmail.toLowerCase(), pwHash).run();

    // ── Assign super_admin role ───────────────────────────────────────────────
    await env.DB.prepare(`
      INSERT OR IGNORE INTO user_roles (id, user_id, role_id, scope_type, granted_by, granted_at)
      SELECT ?, ?, id, 'tenant', NULL, CURRENT_TIMESTAMP FROM roles WHERE name='super_admin' LIMIT 1
    `).bind(crypto.randomUUID(), userId).run();

    // ── Seed essential config (org unit, departments, roles) ─────────────────
    const unitId = `unit-${tenantId}`;
    await env.DB.batch([
      env.DB.prepare(`INSERT OR IGNORE INTO organizational_units (id,tenant_id,name,type,parent_id) VALUES (?,?,'Company','company',NULL)`).bind(unitId, tenantId),
      env.DB.prepare(`INSERT OR IGNORE INTO departments (id,tenant_id,name,unit_id) VALUES (?,?,'Administration',?)`).bind(`dept-admin-${tenantId}`, tenantId, unitId),
      env.DB.prepare(`INSERT OR IGNORE INTO departments (id,tenant_id,name,unit_id) VALUES (?,?,'HR',?)`).bind(`dept-hr-${tenantId}`, tenantId, unitId),
      env.DB.prepare(`INSERT OR IGNORE INTO departments (id,tenant_id,name,unit_id) VALUES (?,?,'Engineering',?)`).bind(`dept-eng-${tenantId}`, tenantId, unitId),
      env.DB.prepare(`INSERT OR IGNORE INTO tenant_branding (id,tenant_id,company_name,primary_color,secondary_color) VALUES (?,?,?,'#6366F1','#14B8A6')`).bind(`brand-${tenantId}`, tenantId, companyName),
      env.DB.prepare(`INSERT OR IGNORE INTO tenant_settings (id,tenant_id,key,value) VALUES (?,?,'timezone','Europe/London')`).bind(crypto.randomUUID(), tenantId),
      env.DB.prepare(`INSERT OR IGNORE INTO tenant_settings (id,tenant_id,key,value) VALUES (?,?,'currency','GBP')`).bind(crypto.randomUUID(), tenantId),
    ]);

    // ── Enable starter modules ────────────────────────────────────────────────
    const starterModules = ['dashboard','hr','leave','timesheets','expenses','compliance','documents','training','announcements','orgchart','reporting'];
    const modStmts = starterModules.map((key, i) =>
      env.DB.prepare(`INSERT OR IGNORE INTO tenant_modules (id,tenant_id,module_key,enabled) VALUES (?,?,?,1)`)
        .bind(`mod-${tenantId}-${i}`, tenantId, key)
    );
    await env.DB.batch(modStmts);

    // ── Create trial subscription ─────────────────────────────────────────────
    await env.DB.prepare(`
      INSERT INTO subscriptions (id,tenant_id,plan,status,trial_ends_at,seat_count)
      VALUES (?,?,'starter','trialing',?,5)
    `).bind(crypto.randomUUID(), tenantId, trialEnd).run();

    // ── Leave types ───────────────────────────────────────────────────────────
    await env.DB.batch([
      env.DB.prepare(`INSERT OR IGNORE INTO leave_types (id,tenant_id,name,code,colour,paid,requires_approval,carry_forward,enabled,created_at) VALUES (?,?,'Annual Leave','annual','#6366F1',1,1,1,1,CURRENT_TIMESTAMP)`).bind(crypto.randomUUID(), tenantId),
      env.DB.prepare(`INSERT OR IGNORE INTO leave_types (id,tenant_id,name,code,colour,paid,requires_approval,carry_forward,enabled,created_at) VALUES (?,?,'Sick Leave','sick','#EF4444',1,0,0,1,CURRENT_TIMESTAMP)`).bind(crypto.randomUUID(), tenantId),
    ]);

    // ── Onboarding checklist record ───────────────────────────────────────────
    await env.DB.prepare(`
      INSERT INTO tenant_onboarding (id,tenant_id,step,completed_steps) VALUES (?,?,'profile','[]')
    `).bind(crypto.randomUUID(), tenantId).run();

    return created({
      tenantId,
      subdomain: subdomain.toLowerCase(),
      adminEmail: adminEmail.toLowerCase(),
      trialEndsAt: trialEnd,
      redirectUrl: `https://${subdomain.toLowerCase()}.${env.TENANT_DOMAIN ?? 'xavvysuite.com'}`,
    });
  }

  // GET /api/signup/onboarding — get onboarding progress
  if (action === 'onboarding' && request.method === 'GET') {
    const url = new URL(request.url);
    const tenantId = url.searchParams.get('tenantId');
    if (!tenantId) return err('tenantId required');

    const progress = await env.DB.prepare(`SELECT * FROM tenant_onboarding WHERE tenant_id=?`).bind(tenantId).first();
    const sub      = await env.DB.prepare(`SELECT plan, status, trial_ends_at, seat_count FROM subscriptions WHERE tenant_id=?`).bind(tenantId).first();
    const empCount = await env.DB.prepare(`SELECT COUNT(*) as n FROM employees WHERE tenant_id=? AND status='active'`).bind(tenantId).first() as any;

    return ok({ ...progress, subscription: sub, employeeCount: empCount?.n ?? 0 });
  }

  // PATCH /api/signup/onboarding — advance onboarding step
  if (action === 'onboarding' && request.method === 'PATCH') {
    const body = await request.json() as any;
    const { tenantId, step, completedStep } = body;
    if (!tenantId) return err('tenantId required');

    const current = await env.DB.prepare(`SELECT * FROM tenant_onboarding WHERE tenant_id=?`).bind(tenantId).first() as any;
    const done: string[] = JSON.parse(current?.completed_steps ?? '[]');
    if (completedStep && !done.includes(completedStep)) done.push(completedStep);

    await env.DB.prepare(`
      UPDATE tenant_onboarding SET step=?, completed_steps=?, updated_at=CURRENT_TIMESTAMP WHERE tenant_id=?
    `).bind(step, JSON.stringify(done), tenantId).run();

    return ok({ step, completedSteps: done });
  }

  return err('Not found', 404);
}

/**
 * platform/tenancy/resolver.ts
 * Resolves tenant from hostname subdomain.
 * e.g. xavvy.xavvysuite.com → xavvy-tenant-001
 */

import type { Env, AppContext } from '../../types';

const ROOT_DOMAINS = ['xavvysuite.com', 'app.xavvy.uk', 'localhost', '127.0.0.1'];

export async function resolveTenant(
  request: Request,
  env: Env
): Promise<{ tenantId: string; subdomain: string } | null> {
  const host = request.headers.get('host') ?? '';
  const url  = new URL(request.url);

  // 1. Explicit tenant header (internal / dev)
  const headerTenant = request.headers.get('x-tenant-id');
  if (headerTenant) {
    return { tenantId: headerTenant, subdomain: '' };
  }

  // 2. Query param (dev / testing)
  const qpTenant = url.searchParams.get('_tenant');
  if (qpTenant) {
    const t = await env.DB.prepare(`SELECT id FROM tenants WHERE id=? OR subdomain=? LIMIT 1`).bind(qpTenant, qpTenant).first() as any;
    if (t) return { tenantId: t.id, subdomain: qpTenant };
  }

  // 3. Subdomain extraction
  const hostname = host.split(':')[0]; // strip port
  const isRootDomain = ROOT_DOMAINS.some(rd => hostname === rd || hostname.endsWith('.' + rd));

  if (isRootDomain) {
    // Extract subdomain: xavvy.xavvysuite.com → xavvy
    const parts = hostname.split('.');
    if (parts.length >= 3) {
      const subdomain = parts[0];
      if (subdomain && subdomain !== 'www' && subdomain !== 'app') {
        const t = await env.DB.prepare(`SELECT id FROM tenants WHERE subdomain=? AND status='active' LIMIT 1`).bind(subdomain).first() as any;
        if (t) return { tenantId: t.id, subdomain };
      }
    }
  }

  // 4. Custom domain mapping (tenant has custom_domain set)
  if (!isRootDomain && hostname !== 'localhost') {
    const t = await env.DB.prepare(`SELECT id, subdomain FROM tenants WHERE custom_domain=? AND status='active' LIMIT 1`).bind(hostname).first() as any;
    if (t) return { tenantId: t.id, subdomain: t.subdomain };
  }

  // 5. Fallback: if there's only one tenant (single-tenant deploy), use it
  const defaultTenant = await env.DB.prepare(`SELECT id, subdomain FROM tenants WHERE status='active' ORDER BY created_at ASC LIMIT 1`).first() as any;
  if (defaultTenant) return { tenantId: defaultTenant.id, subdomain: defaultTenant.subdomain };

  return null;
}

// ── Plan enforcement middleware ───────────────────────────────────────────────
export interface PlanLimits {
  max_employees:     number;
  max_modules:       number;
  max_storage_gb:    number;
  max_api_calls_day: number;
  features:          string[];
}

const PLAN_CACHE: Map<string, { limits: PlanLimits; ts: number }> = new Map();
const PLAN_CACHE_TTL = 5 * 60 * 1000; // 5 min

export async function getPlanLimits(env: Env, tenantId: string): Promise<PlanLimits> {
  const cached = PLAN_CACHE.get(tenantId);
  if (cached && Date.now() - cached.ts < PLAN_CACHE_TTL) return cached.limits;

  const sub = await env.DB.prepare(`
    SELECT s.plan, pl.max_employees, pl.max_modules, pl.max_storage_gb,
           pl.max_api_calls_day, pl.features
    FROM subscriptions s
    JOIN plan_limits pl ON pl.plan = s.plan
    WHERE s.tenant_id = ? AND s.status IN ('active','trialing')
    LIMIT 1
  `).bind(tenantId).first() as any;

  const limits: PlanLimits = sub
    ? { ...sub, features: JSON.parse(sub.features ?? '[]') }
    : { max_employees: 5, max_modules: 5, max_storage_gb: 0.5, max_api_calls_day: 500, features: ['hr', 'leave', 'timesheets'] };

  PLAN_CACHE.set(tenantId, { limits, ts: Date.now() });
  return limits;
}

export function canAccessModule(features: string[], moduleKey: string): boolean {
  if (features.includes('*')) return true;
  return features.includes(moduleKey);
}

export async function enforcePlan(
  env: Env, tenantId: string, moduleKey: string
): Promise<{ allowed: boolean; reason?: string }> {
  const limits = await getPlanLimits(env, tenantId);
  if (canAccessModule(limits.features, moduleKey)) return { allowed: true };
  return {
    allowed: false,
    reason: `Module '${moduleKey}' is not available on your current plan. Please upgrade to access this feature.`,
  };
}

// ── Check employee count against plan limit ───────────────────────────────────
export async function checkEmployeeLimit(
  env: Env, tenantId: string
): Promise<{ allowed: boolean; current: number; max: number }> {
  const limits  = await getPlanLimits(env, tenantId);
  if (limits.max_employees === -1) return { allowed: true, current: 0, max: -1 };

  const count = await env.DB.prepare(
    `SELECT COUNT(*) as n FROM employees WHERE tenant_id=? AND status='active'`
  ).bind(tenantId).first() as any;

  const current = count?.n ?? 0;
  return { allowed: current < limits.max_employees, current, max: limits.max_employees };
}

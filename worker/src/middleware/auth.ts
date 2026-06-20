import { verifyAccessToken, extractBearerToken } from '../core/jwt';
import { unauthorized } from '../core/response';
import type { Env, AppContext } from '../types';

export type AuthedRequest = Request & { ctx: AppContext };

export async function authMiddleware(
  request: Request,
  env: Env
): Promise<{ ctx: AppContext } | Response> {
  const token = extractBearerToken(request);
  if (!token) return unauthorized('No token provided');

  const payload = await verifyAccessToken(token, env);
  if (!payload) return unauthorized('Invalid or expired token');

  if (env.DEPLOYMENT_MODE === 'dedicated' && payload.tid !== env.TENANT_ID) {
    return unauthorized('Tenant mismatch');
  }

  return {
    ctx: {
      tenantId:    payload.tid,
      userId:      payload.sub,
      userEmail:   payload.email,
      roles:       payload.roles,
      permissions: payload.perms,
      employeeId:  payload.eid,
    } as AppContext,
  };
}

// ── Permission helpers ────────────────────────────────────────────────────────
// Wildcard '*:*:*' grants everything — must be checked before specific perms

export function hasPermission(ctx: AppContext, permission: string): boolean {
  if (!ctx.permissions) return false;
  if (ctx.permissions.includes('*:*:*')) return true;
  return ctx.permissions.includes(permission);
}

export function requirePermission(ctx: AppContext, permission: string): Response | null {
  if (hasPermission(ctx, permission)) return null;
  return Response.json(
    { ok: false, error: `Missing permission: ${permission}`, code: 'FORBIDDEN' },
    { status: 403 }
  );
}

export function isSuperAdmin(ctx: AppContext): boolean {
  return ctx.permissions?.includes('*:*:*') ?? false;
}
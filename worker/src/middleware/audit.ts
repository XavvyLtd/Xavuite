import type { Env, AppContext } from '../types';

export type AuditAction =
  | 'create' | 'update' | 'delete' | 'view'
  | 'approve' | 'reject' | 'login' | 'logout'
  | 'upload' | 'download';

export interface AuditEvent {
  tenantId:   string;
  userId:     string;
  userEmail:  string;
  action:     AuditAction;
  resource:   string;
  resourceId: string;
  changes?:   Record<string, { from: unknown; to: unknown }>;
  metadata?:  Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export async function audit(env: Env, event: AuditEvent): Promise<void> {
  try {
    await env.DB.prepare(`
      INSERT INTO audit_log (
        id, tenant_id, user_id, user_email,
        action, resource, resource_id,
        changes, metadata, ip_address, user_agent,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      crypto.randomUUID(),
      event.tenantId,
      event.userId,
      event.userEmail,
      event.action,
      event.resource,
      event.resourceId,
      event.changes    ? JSON.stringify(event.changes)  : null,
      event.metadata   ? JSON.stringify(event.metadata) : null,
      event.ipAddress  ?? null,
      event.userAgent  ?? null,
    ).run();
  } catch (err) {
    // Audit failures must never crash the main request
    console.error('[audit] Failed to write event:', err);
  }
}

export function auditFromRequest(request: Request, ctx: AppContext): Omit<AuditEvent, 'action' | 'resource' | 'resourceId'> {
  return {
    tenantId:  ctx.tenantId,
    userId:    ctx.userId!,
    userEmail: ctx.userEmail!,
    ipAddress: request.headers.get('CF-Connecting-IP') ?? undefined,
    userAgent: request.headers.get('User-Agent') ?? undefined,
  };
}

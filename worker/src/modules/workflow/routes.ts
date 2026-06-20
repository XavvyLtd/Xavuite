import { z } from 'zod';
import { ok, created, err, notFound } from '../../core/response';
import { requirePermission } from '../../middleware/auth';
import { audit, auditFromRequest } from '../../middleware/audit';
import {
  startWorkflow, takeWorkflowAction,
  getWorkflowState, getPendingApprovalsForUser,
} from '../../platform/workflow/engine';
import type { Env, AppContext } from '../../types';

const ActionSchema = z.object({
  action:     z.enum(['approved','rejected','delegated','withdrawn']),
  comment:    z.string().max(1000).optional(),
  delegateTo: z.string().uuid().optional(),
});

export async function handleWorkflows(
  request: Request, env: Env, ctx: AppContext, subPath: string
): Promise<Response> {
  const [resource, id, action] = subPath.split('/').filter(Boolean);

  // GET /api/workflows/definitions — list all workflow definitions
  if (resource === 'definitions' && !id && request.method === 'GET') {
    const rows = await env.DB.prepare(`
      SELECT wd.*,
        (SELECT COUNT(*) FROM workflow_steps WHERE definition_id = wd.id) as step_count,
        (SELECT COUNT(*) FROM workflow_instances WHERE definition_id = wd.id AND status IN ('pending','in_progress')) as active_count
      FROM workflow_definitions wd
      WHERE wd.tenant_id = ?
      ORDER BY wd.module, wd.name
    `).bind(ctx.tenantId).all();
    return ok(rows.results);
  }

  // GET /api/workflows/definitions/:id/steps
  if (resource === 'definitions' && id && action === 'steps' && request.method === 'GET') {
    const steps = await env.DB.prepare(`
      SELECT * FROM workflow_steps WHERE definition_id = ? AND tenant_id = ? ORDER BY step_order
    `).bind(id, ctx.tenantId).all();
    return ok(steps.results);
  }

  // GET /api/workflows/pending — items pending MY approval
  if (resource === 'pending' && !id && request.method === 'GET') {
    const items = await getPendingApprovalsForUser(
      env.DB, ctx.userId!, ctx.tenantId, ctx.roles ?? []
    );
    return ok(items);
  }

  // GET /api/workflows/instances — all active instances
  if (resource === 'instances' && !id && request.method === 'GET') {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const module = url.searchParams.get('module');

    let where = 'wi.tenant_id = ?';
    const params: unknown[] = [ctx.tenantId];
    if (status) { where += ' AND wi.status = ?';   params.push(status); }
    if (module) { where += ' AND wd.module = ?';   params.push(module); }

    const rows = await env.DB.prepare(`
      SELECT wi.*, wd.name as workflow_name, wd.module,
             ws.name as current_step_name, ws.sla_hours,
             u.email as submitted_by_email
      FROM workflow_instances wi
      JOIN workflow_definitions wd ON wd.id = wi.definition_id
      LEFT JOIN workflow_steps ws ON ws.definition_id = wi.definition_id AND ws.step_order = wi.current_step
      LEFT JOIN users u ON u.id = wi.submitted_by
      WHERE ${where}
      ORDER BY wi.submitted_at DESC
      LIMIT 100
    `).bind(...params).all();
    return ok(rows.results);
  }

  // GET /api/workflows/instances/:id — single instance with full action history
  if (resource === 'instances' && id && !action && request.method === 'GET') {
    const instance = await env.DB.prepare(`
      SELECT wi.*, wd.name as workflow_name, wd.module
      FROM workflow_instances wi
      JOIN workflow_definitions wd ON wd.id = wi.definition_id
      WHERE wi.id = ? AND wi.tenant_id = ?
    `).bind(id, ctx.tenantId).first();
    if (!instance) return notFound('Workflow instance not found');

    const actions = await env.DB.prepare(`
      SELECT wa.*, ws.name as step_name
      FROM workflow_actions wa
      LEFT JOIN workflow_steps ws ON ws.id = wa.step_id
      WHERE wa.instance_id = ? AND wa.tenant_id = ?
      ORDER BY wa.created_at ASC
    `).bind(id, ctx.tenantId).all();

    const steps = await env.DB.prepare(`
      SELECT ws.*,
        CASE WHEN ws.step_order < wi.current_step THEN 'completed'
             WHEN ws.step_order = wi.current_step THEN 'active'
             ELSE 'pending' END as step_status
      FROM workflow_steps ws
      JOIN workflow_instances wi ON wi.id = ?
      WHERE ws.definition_id = wi.definition_id
      ORDER BY ws.step_order
    `).bind(id).all();

    return ok({ ...instance, actions: actions.results, steps: steps.results });
  }

  // GET /api/workflows/record/:type/:recordId — workflow state for a specific record
  if (resource === 'record' && id && action && request.method === 'GET') {
    const state = await getWorkflowState(env.DB, id, action);
    return ok(state);
  }

  // POST /api/workflows/instances/:id/action — approve, reject, delegate, withdraw
  if (resource === 'instances' && id && action === 'action' && request.method === 'POST') {
    const body = await request.json().catch(() => null);
    const parsed = ActionSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.issues[0].message);

    const result = await takeWorkflowAction(env, {
      instanceId:  id,
      actorId:     ctx.userId!,
      actorEmail:  ctx.userEmail!,
      action:      parsed.data.action,
      comment:     parsed.data.comment,
      delegateTo:  parsed.data.delegateTo,
      tenantId:    ctx.tenantId,
      ipAddress:   request.headers.get('CF-Connecting-IP') ?? undefined,
    });

    await audit(env, {
      ...auditFromRequest(request, ctx),
      action:     parsed.data.action === 'approved' ? 'approve' : parsed.data.action === 'rejected' ? 'reject' : 'update',
      resource:   'workflow_instance',
      resourceId: id,
      metadata:   { action: parsed.data.action, comment: parsed.data.comment },
    });

    return ok(result);
  }

  // PATCH /api/workflows/definitions/:id — update workflow (enable/disable, name)
  if (resource === 'definitions' && id && !action && request.method === 'PATCH') {
    const denied = requirePermission(ctx, 'hr:manage:employee');
    if (denied) return denied;

    const body = await request.json() as any;
    if (body.enabled !== undefined) {
      await env.DB.prepare(
        `UPDATE workflow_definitions SET enabled=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=?`
      ).bind(body.enabled ? 1 : 0, id, ctx.tenantId).run();
    }
    return ok({ id, updated: true });
  }

  return err('Not found', 404);
}

function ok<T>(data: T) { return Response.json({ ok: true, data }, { status: 200 }); }
function created<T>(data: T) { return Response.json({ ok: true, data }, { status: 201 }); }
function err(message: string, status = 400) { return Response.json({ ok: false, error: message }, { status }); }
function notFound(msg: string) { return err(msg, 404); }

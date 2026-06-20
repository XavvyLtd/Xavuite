/**
 * platform/workflow/engine.ts
 *
 * Core workflow engine.
 * Handles: create instance, advance step, evaluate conditions,
 *          resolve outcome, SLA checking, notification dispatch.
 */

import { sendMail } from '../../core/email';
import type { Env } from '../../types';

export type WorkflowAction = 'approved' | 'rejected' | 'delegated' | 'withdrawn' | 'auto_approved';
export type WorkflowStatus = 'pending' | 'in_progress' | 'approved' | 'rejected' | 'withdrawn' | 'escalated';

export interface StartWorkflowOptions {
  definitionKey: string;
  recordType:    string;
  recordId:      string;
  submittedBy:   string;
  tenantId:      string;
  recordData?:   Record<string, unknown>; // for condition evaluation
}

export interface TakeActionOptions {
  instanceId:   string;
  actorId:      string;
  actorEmail:   string;
  action:       WorkflowAction;
  comment?:     string;
  delegateTo?:  string;
  tenantId:     string;
  ipAddress?:   string;
}

// ── Condition evaluator ───────────────────────────────────────────────────────
function evaluateCondition(condition: string | null, recordData: Record<string, unknown>): boolean {
  if (!condition) return true;
  try {
    const cond = JSON.parse(condition) as { field: string; operator: string; value: unknown };
    const val  = recordData[cond.field];
    switch (cond.operator) {
      case '>':  return Number(val) >  Number(cond.value);
      case '>=': return Number(val) >= Number(cond.value);
      case '<':  return Number(val) <  Number(cond.value);
      case '<=': return Number(val) <= Number(cond.value);
      case '==': return val == cond.value;
      case '!=': return val != cond.value;
      default:   return true;
    }
  } catch { return true; }
}

// ── Get the next applicable step ─────────────────────────────────────────────
async function getNextStep(
  db: D1Database,
  definitionId: string,
  fromStepOrder: number,
  recordData: Record<string, unknown>
): Promise<any | null> {
  const steps = await db.prepare(`
    SELECT * FROM workflow_steps
    WHERE definition_id = ? AND step_order > ?
    ORDER BY step_order ASC
  `).bind(definitionId, fromStepOrder).all() as any;

  for (const step of steps.results) {
    if (evaluateCondition(step.condition, recordData)) {
      return step;
    }
  }
  return null; // no more applicable steps
}

// ── Resolve approver email for a step ────────────────────────────────────────
async function resolveApproverEmail(
  db: D1Database,
  step: any,
  submittedBy: string,
  tenantId: string,
  env: Env
): Promise<string> {
  switch (step.approver_type) {
    case 'manager': {
      // Find the submitter's employee record and their manager
      const emp = await db.prepare(`
        SELECT e.id FROM employees e WHERE e.user_id = ? AND e.tenant_id = ?
      `).bind(submittedBy, tenantId).first() as any;

      if (emp) {
        const manager = await db.prepare(`
          SELECT u.email FROM reporting_hierarchy rh
          JOIN employees me ON me.id = rh.manager_id
          JOIN users u ON u.id = me.user_id
          WHERE rh.employee_id = ? AND rh.is_direct = 1
        `).bind(emp.id).first() as any;
        if (manager?.email) return manager.email;
      }
      // Fallback to HR
      return env.EMAIL_HR;
    }
    case 'role': {
      // Find a user with this role in the tenant
      const user = await db.prepare(`
        SELECT u.email FROM users u
        JOIN user_roles ur ON ur.user_id = u.id
        JOIN roles r ON r.id = ur.role_id
        WHERE r.name = ? AND u.tenant_id = ? AND u.status = 'active'
        LIMIT 1
      `).bind(step.approver_role, tenantId).first() as any;
      return user?.email ?? env.EMAIL_HR;
    }
    case 'user': {
      const user = await db.prepare(
        `SELECT email FROM users WHERE id = ?`
      ).bind(step.approver_user_id).first() as any;
      return user?.email ?? env.EMAIL_HR;
    }
    default:
      return env.EMAIL_HR;
  }
}

// ── Send workflow notification email ─────────────────────────────────────────
async function notifyApprover(
  env: Env,
  to: string,
  instanceId: string,
  stepName: string,
  recordType: string,
  recordId: string,
  submitterName: string
): Promise<void> {
  const platformUrl = `https://${env.TENANT_DOMAIN}`;
  const moduleMap: Record<string, string> = {
    leave_request:  'leave',
    timesheet:      'timesheets',
    expense_claim:  'expenses',
    job_posting:    'recruitment',
    asset:          'assets',
  };
  const module = moduleMap[recordType] ?? 'dashboard';

  await sendMail(env, {
    to,
    subject: `Action Required: ${stepName} — ${submitterName}`,
    html: `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden">
  <div style="background:#0F2A4A;padding:20px 24px">
    <h2 style="color:#fff;margin:0">${stepName}</h2>
    <p style="color:#94A3B8;margin:4px 0 0;font-size:12px">${env.TENANT_NAME} · Action Required</p>
  </div>
  <div style="padding:24px">
    <p>Hi,</p>
    <p><strong>${submitterName}</strong> has submitted a <strong>${recordType.replace(/_/g,' ')}</strong> that requires your approval.</p>
    <p><strong>Step:</strong> ${stepName}</p>
    <a href="${platformUrl}/${module}" style="display:inline-block;background:#6366F1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:16px">
      Review &amp; Approve →
    </a>
    <p style="color:#999;font-size:12px;margin-top:24px">
      You are receiving this because you are the designated approver for this step.
    </p>
  </div>
</div></body></html>`,
  });
}

async function notifyOutcome(
  env: Env,
  to: string,
  outcome: string,
  recordType: string,
  comment?: string
): Promise<void> {
  const approved = outcome === 'approved';
  await sendMail(env, {
    to,
    subject: `Your ${recordType.replace(/_/g,' ')} has been ${outcome}`,
    html: `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden">
  <div style="background:${approved ? '#065F46' : '#7F1D1D'};padding:20px 24px">
    <h2 style="color:#fff;margin:0">${approved ? '✅' : '❌'} ${outcome.charAt(0).toUpperCase() + outcome.slice(1)}</h2>
  </div>
  <div style="padding:24px">
    <p>Your <strong>${recordType.replace(/_/g,' ')}</strong> has been <strong>${outcome}</strong>.</p>
    ${comment ? `<p style="color:#666;font-style:italic">Comment: ${comment}</p>` : ''}
    <a href="https://${env.TENANT_DOMAIN}" style="display:inline-block;background:#6366F1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:16px">
      View in ${env.TENANT_NAME} →
    </a>
  </div>
</div></body></html>`,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Start a workflow instance for a submitted record.
 * Call this when a leave request, timesheet, expense etc. is submitted.
 */
export async function startWorkflow(
  env: Env,
  opts: StartWorkflowOptions
): Promise<{ instanceId: string; stepName: string }> {
  const { definitionKey, recordType, recordId, submittedBy, tenantId, recordData = {} } = opts;

  // Get definition
  const def = await env.DB.prepare(`
    SELECT * FROM workflow_definitions WHERE key = ? AND tenant_id = ? AND enabled = 1
  `).bind(definitionKey, tenantId).first() as any;

  if (!def) {
    // No workflow defined — auto-approve
    return { instanceId: '', stepName: 'auto' };
  }

  // Get first applicable step
  const firstStep = await getNextStep(env.DB, def.id, 0, recordData);
  if (!firstStep) {
    // No steps applicable — auto-approve immediately
    await env.DB.prepare(`
      UPDATE ${def.target_table} SET ${def.target_status_field} = ? WHERE id = ?
    `).bind(def.approved_value, recordId).run();
    return { instanceId: '', stepName: 'auto_approved' };
  }

  // Calculate SLA deadline
  const slaDeadline = firstStep.sla_hours
    ? new Date(Date.now() + firstStep.sla_hours * 3600000).toISOString()
    : null;

  // Create instance
  const instanceId = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO workflow_instances (
      id, tenant_id, definition_id, definition_key,
      record_type, record_id, status, current_step,
      submitted_by, submitted_at, sla_deadline
    ) VALUES (?, ?, ?, ?, ?, ?, 'in_progress', ?, ?, CURRENT_TIMESTAMP, ?)
  `).bind(
    instanceId, tenantId, def.id, definitionKey,
    recordType, recordId, firstStep.step_order,
    submittedBy, slaDeadline
  ).run();

  // Get submitter name for notification
  const submitter = await env.DB.prepare(`
    SELECT eh.first_name || ' ' || eh.last_name AS name
    FROM employees e
    JOIN employee_history eh ON eh.employee_id = e.id AND eh.is_current = 1
    WHERE e.user_id = ? AND e.tenant_id = ?
  `).bind(submittedBy, tenantId).first() as any;

  const submitterName = submitter?.name ?? 'An employee';

  // Notify approver
  const approverEmail = await resolveApproverEmail(env.DB, firstStep, submittedBy, tenantId, env);
  await notifyApprover(env, approverEmail, instanceId, firstStep.name, recordType, recordId, submitterName);

  // Log notification
  await env.DB.prepare(`
    INSERT INTO workflow_notifications (id, instance_id, tenant_id, recipient_email, notification_type)
    VALUES (?, ?, ?, ?, 'pending_approval')
  `).bind(crypto.randomUUID(), instanceId, tenantId, approverEmail).run();

  return { instanceId, stepName: firstStep.name };
}

/**
 * Take an action on an active workflow step.
 * Call this from approve/reject handlers.
 */
export async function takeWorkflowAction(
  env: Env,
  opts: TakeActionOptions
): Promise<{ status: WorkflowStatus; nextStep?: string }> {
  const { instanceId, actorId, actorEmail, action, comment, delegateTo, tenantId, ipAddress } = opts;

  // Get instance + definition
  const instance = await env.DB.prepare(`
    SELECT wi.*, wd.target_table, wd.target_status_field,
           wd.approved_value, wd.rejected_value, wd.id as def_id
    FROM workflow_instances wi
    JOIN workflow_definitions wd ON wd.id = wi.definition_id
    WHERE wi.id = ? AND wi.tenant_id = ?
  `).bind(instanceId, tenantId).first() as any;

  if (!instance) throw new Error('Workflow instance not found');
  if (!['pending', 'in_progress', 'escalated'].includes(instance.status)) {
    throw new Error(`Workflow is already ${instance.status}`);
  }

  // Get current step
  const currentStep = await env.DB.prepare(`
    SELECT * FROM workflow_steps WHERE definition_id = ? AND step_order = ?
  `).bind(instance.def_id, instance.current_step).first() as any;

  // Record the action
  await env.DB.prepare(`
    INSERT INTO workflow_actions (
      id, instance_id, tenant_id, step_id, step_order,
      actor_id, actor_email, action, comment, delegated_to, ip_address
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(), instanceId, tenantId,
    currentStep?.id ?? null, instance.current_step,
    actorId, actorEmail, action, comment ?? null, delegateTo ?? null, ipAddress ?? null
  ).run();

  // Handle delegation
  if (action === 'delegated' && delegateTo) {
    const delegateUser = await env.DB.prepare(
      `SELECT email FROM users WHERE id = ?`
    ).bind(delegateTo).first() as any;
    if (delegateUser?.email) {
      const submitter = await env.DB.prepare(`
        SELECT u.email FROM users u WHERE u.id = ?
      `).bind(instance.submitted_by).first() as any;
      await notifyApprover(env, delegateUser.email, instanceId, currentStep?.name ?? 'Approval', instance.record_type, instance.record_id, submitter?.email ?? 'Employee');
    }
    return { status: 'in_progress' };
  }

  // Handle withdrawal
  if (action === 'withdrawn') {
    await env.DB.batch([
      env.DB.prepare(`UPDATE workflow_instances SET status='withdrawn', decided_at=CURRENT_TIMESTAMP, outcome='withdrawn' WHERE id=?`).bind(instanceId),
      env.DB.prepare(`UPDATE ${instance.target_table} SET ${instance.target_status_field}='cancelled' WHERE id=?`).bind(instance.record_id),
    ]);
    return { status: 'withdrawn' };
  }

  // Handle rejection — end immediately
  if (action === 'rejected') {
    await env.DB.batch([
      env.DB.prepare(`UPDATE workflow_instances SET status='rejected', decided_at=CURRENT_TIMESTAMP, decided_by=?, outcome='rejected', outcome_comment=? WHERE id=?`)
        .bind(actorId, comment ?? null, instanceId),
      env.DB.prepare(`UPDATE ${instance.target_table} SET ${instance.target_status_field}=? WHERE id=?`)
        .bind(instance.rejected_value, instance.record_id),
    ]);

    // Notify submitter
    const submitterEmail = await env.DB.prepare(`SELECT email FROM users WHERE id=?`).bind(instance.submitted_by).first() as any;
    if (submitterEmail?.email) {
      await notifyOutcome(env, submitterEmail.email, 'rejected', instance.record_type, comment);
    }

    return { status: 'rejected' };
  }

  // Handle approval — check for next step
  if (action === 'approved' || action === 'auto_approved') {
    // Get record data for condition evaluation on next step
    const record = await env.DB.prepare(
      `SELECT * FROM ${instance.target_table} WHERE id=?`
    ).bind(instance.record_id).first() as any;

    const nextStep = await getNextStep(env.DB, instance.def_id, instance.current_step, record ?? {});

    if (nextStep) {
      // Advance to next step
      const nextSla = nextStep.sla_hours
        ? new Date(Date.now() + nextStep.sla_hours * 3600000).toISOString()
        : null;

      await env.DB.prepare(`
        UPDATE workflow_instances SET current_step=?, sla_deadline=?, status='in_progress' WHERE id=?
      `).bind(nextStep.step_order, nextSla, instanceId).run();

      // Notify next approver
      const nextApproverEmail = await resolveApproverEmail(env.DB, nextStep, instance.submitted_by, tenantId, env);
      const submitter = await env.DB.prepare(`
        SELECT eh.first_name || ' ' || eh.last_name AS name FROM employees e
        JOIN employee_history eh ON eh.employee_id = e.id AND eh.is_current = 1
        WHERE e.user_id = ? AND e.tenant_id = ?
      `).bind(instance.submitted_by, tenantId).first() as any;

      await notifyApprover(env, nextApproverEmail, instanceId, nextStep.name, instance.record_type, instance.record_id, submitter?.name ?? 'Employee');

      return { status: 'in_progress', nextStep: nextStep.name };
    }

    // No more steps — fully approved
    await env.DB.batch([
      env.DB.prepare(`UPDATE workflow_instances SET status='approved', decided_at=CURRENT_TIMESTAMP, decided_by=?, outcome='approved', outcome_comment=? WHERE id=?`)
        .bind(actorId, comment ?? null, instanceId),
      env.DB.prepare(`UPDATE ${instance.target_table} SET ${instance.target_status_field}=? WHERE id=?`)
        .bind(instance.approved_value, instance.record_id),
    ]);

    // Notify submitter
    const submitterEmail = await env.DB.prepare(`SELECT email FROM users WHERE id=?`).bind(instance.submitted_by).first() as any;
    if (submitterEmail?.email) {
      await notifyOutcome(env, submitterEmail.email, 'approved', instance.record_type, comment);
    }

    return { status: 'approved' };
  }

  return { status: instance.status };
}

/**
 * Get the current workflow state for a business record.
 */
export async function getWorkflowState(
  db: D1Database,
  recordType: string,
  recordId: string
): Promise<any | null> {
  return db.prepare(`
    SELECT wi.*, wd.name as definition_name,
           ws.name as current_step_name, ws.approver_type, ws.approver_role, ws.sla_hours,
           (SELECT COUNT(*) FROM workflow_actions WHERE instance_id = wi.id) as action_count
    FROM workflow_instances wi
    JOIN workflow_definitions wd ON wd.id = wi.definition_id
    LEFT JOIN workflow_steps ws ON ws.definition_id = wi.definition_id AND ws.step_order = wi.current_step
    WHERE wi.record_type = ? AND wi.record_id = ?
  `).bind(recordType, recordId).first();
}

/**
 * Get all pending approvals for a user (items they need to action).
 */
export async function getPendingApprovalsForUser(
  db: D1Database,
  userId: string,
  tenantId: string,
  roles: string[]
): Promise<any[]> {
  const isSuperAdmin = roles.includes('super_admin');
  const isManager    = roles.includes('manager') || roles.includes('hr_admin');

  if (!isSuperAdmin && !isManager) return [];

  const rows = await db.prepare(`
    SELECT wi.id, wi.record_type, wi.record_id, wi.current_step,
           wi.submitted_at, wi.sla_deadline,
           ws.name as step_name, ws.approver_type, ws.approver_role,
           wd.name as workflow_name, wd.module
    FROM workflow_instances wi
    JOIN workflow_definitions wd ON wd.id = wi.definition_id
    JOIN workflow_steps ws ON ws.definition_id = wi.definition_id AND ws.step_order = wi.current_step
    WHERE wi.tenant_id = ? AND wi.status IN ('pending','in_progress','escalated')
    ORDER BY wi.sla_deadline ASC NULLS LAST
    LIMIT 100
  `).bind(tenantId).all();

  return rows.results ?? [];
}

/**
 * SLA checker — called from cron. Auto-approves or escalates overdue steps.
 */
export async function processSLABreaches(env: Env, tenantId: string): Promise<void> {
  const overdue = await env.DB.prepare(`
    SELECT wi.*, ws.auto_approve_after_sla, ws.escalate_to_role, ws.name as step_name
    FROM workflow_instances wi
    JOIN workflow_steps ws ON ws.definition_id = wi.definition_id AND ws.step_order = wi.current_step
    WHERE wi.tenant_id = ? AND wi.status IN ('pending','in_progress')
      AND wi.sla_deadline IS NOT NULL AND wi.sla_deadline < datetime('now')
  `).bind(tenantId).all() as any;

  for (const instance of overdue.results) {
    if (instance.auto_approve_after_sla) {
      await takeWorkflowAction(env, {
        instanceId:  instance.id,
        actorId:     'system',
        actorEmail:  'system@xavvysuite.com',
        action:      'auto_approved',
        comment:     `Auto-approved: SLA of ${instance.sla_hours}h exceeded`,
        tenantId,
      });
    } else {
      // Escalate
      await env.DB.prepare(`
        UPDATE workflow_instances SET status='escalated', escalated_at=CURRENT_TIMESTAMP WHERE id=?
      `).bind(instance.id).run();

      await sendMail(env, {
        to: env.EMAIL_HR,
        subject: `Workflow Escalation: ${instance.step_name} — SLA Breached`,
        html: `<p>The workflow step <strong>${instance.step_name}</strong> has exceeded its SLA and requires immediate attention.</p>
               <p><a href="https://${env.TENANT_DOMAIN}/${instance.module}">Review in ${env.TENANT_NAME} →</a></p>`,
      });
    }
  }
}

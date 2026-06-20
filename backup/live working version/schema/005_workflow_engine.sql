-- ============================================================
-- XavvySuite — Workflow Engine Schema
-- 005_workflow_engine.sql
-- ============================================================

PRAGMA foreign_keys = OFF;

-- ── Workflow definitions (templates) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflow_definitions (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  key           TEXT NOT NULL,           -- e.g. 'leave_approval'
  name          TEXT NOT NULL,
  description   TEXT,
  module        TEXT NOT NULL,           -- leave | timesheets | expenses | recruitment | assets
  enabled       INTEGER NOT NULL DEFAULT 1,
  -- Outcome propagation
  target_table  TEXT NOT NULL,           -- leave_requests | timesheets | expense_claims etc.
  target_status_field TEXT NOT NULL DEFAULT 'status',
  approved_value  TEXT NOT NULL DEFAULT 'approved',
  rejected_value  TEXT NOT NULL DEFAULT 'rejected',
  -- Config
  allow_delegate  INTEGER NOT NULL DEFAULT 1,
  allow_withdraw  INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at    TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  UNIQUE (tenant_id, key)
);

-- ── Workflow steps (ordered stages within a definition) ───────────────────────
CREATE TABLE IF NOT EXISTS workflow_steps (
  id              TEXT PRIMARY KEY,
  definition_id   TEXT NOT NULL REFERENCES workflow_definitions(id),
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  step_order      INTEGER NOT NULL,       -- 1, 2, 3...
  name            TEXT NOT NULL,          -- e.g. 'Line Manager Approval'
  step_type       TEXT NOT NULL DEFAULT 'approval'
    CHECK (step_type IN ('approval','notification','auto','parallel')),
  -- Who approves
  approver_type   TEXT NOT NULL DEFAULT 'role'
    CHECK (approver_type IN ('role','user','manager','department_head','custom')),
  approver_role   TEXT,                   -- role name e.g. 'manager'
  approver_user_id TEXT REFERENCES users(id),
  -- Conditions (JSON) — step only activates if condition met
  -- e.g. {"field": "days", "operator": ">", "value": 10}
  condition       TEXT,
  -- SLA
  sla_hours       INTEGER DEFAULT 48,     -- hours before escalation
  escalate_to_role TEXT,                  -- role to escalate to after SLA
  auto_approve_after_sla INTEGER DEFAULT 0,
  -- Parallel steps
  parallel_group  TEXT,                   -- steps with same group run in parallel
  UNIQUE (definition_id, step_order)
);

-- ── Workflow instances (one per business record submission) ───────────────────
CREATE TABLE IF NOT EXISTS workflow_instances (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  definition_id   TEXT NOT NULL REFERENCES workflow_definitions(id),
  definition_key  TEXT NOT NULL,          -- denormalised for fast lookup
  -- Business record link
  record_type     TEXT NOT NULL,          -- 'leave_request' | 'timesheet' | 'expense_claim' etc.
  record_id       TEXT NOT NULL,
  -- State
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','approved','rejected','withdrawn','escalated')),
  current_step    INTEGER NOT NULL DEFAULT 1,
  -- Submitter
  submitted_by    TEXT NOT NULL REFERENCES users(id),
  submitted_at    TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  -- Outcome
  decided_at      TEXT,
  decided_by      TEXT REFERENCES users(id),
  outcome         TEXT,                   -- approved | rejected | withdrawn
  outcome_comment TEXT,
  -- SLA
  sla_deadline    TEXT,                   -- ISO datetime of current step SLA
  escalated_at    TEXT,
  UNIQUE (record_type, record_id)         -- one active workflow per record
);

CREATE INDEX IF NOT EXISTS idx_wf_instances_tenant  ON workflow_instances(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_wf_instances_record  ON workflow_instances(record_type, record_id);
CREATE INDEX IF NOT EXISTS idx_wf_instances_step    ON workflow_instances(tenant_id, current_step, status);

-- ── Workflow actions (each approve/reject/delegate/comment) ───────────────────
CREATE TABLE IF NOT EXISTS workflow_actions (
  id            TEXT PRIMARY KEY,
  instance_id   TEXT NOT NULL REFERENCES workflow_instances(id),
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  step_id       TEXT REFERENCES workflow_steps(id),
  step_order    INTEGER NOT NULL,
  -- Actor
  actor_id      TEXT NOT NULL REFERENCES users(id),
  actor_email   TEXT NOT NULL,
  -- Action
  action        TEXT NOT NULL
    CHECK (action IN ('approved','rejected','delegated','escalated','commented','withdrawn','auto_approved')),
  comment       TEXT,
  delegated_to  TEXT REFERENCES users(id),
  -- Metadata
  ip_address    TEXT,
  created_at    TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_wf_actions_instance ON workflow_actions(instance_id, created_at DESC);

-- ── Workflow notifications sent ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflow_notifications (
  id            TEXT PRIMARY KEY,
  instance_id   TEXT NOT NULL REFERENCES workflow_instances(id),
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  recipient_id  TEXT REFERENCES users(id),
  recipient_email TEXT NOT NULL,
  notification_type TEXT NOT NULL,       -- pending_approval | approved | rejected | escalated | reminder
  sent_at       TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  channel       TEXT NOT NULL DEFAULT 'email'
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SEED: Pre-built workflow definitions for Xavvy
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Leave Approval ─────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO workflow_definitions (
  id, tenant_id, key, name, description, module,
  target_table, approved_value, rejected_value, enabled
) VALUES (
  'wf-leave-approval', 'xavvy-tenant-001',
  'leave_approval', 'Leave Approval', 'Standard leave request approval workflow', 'leave',
  'leave_requests', 'approved', 'declined', 1
);

INSERT OR IGNORE INTO workflow_steps (id, definition_id, tenant_id, step_order, name, step_type, approver_type, approver_role, sla_hours, escalate_to_role, condition)
VALUES
  ('wfs-leave-01', 'wf-leave-approval', 'xavvy-tenant-001', 1,
   'Line Manager Approval', 'approval', 'manager', 'manager', 48, 'hr_admin', NULL),
  ('wfs-leave-02', 'wf-leave-approval', 'xavvy-tenant-001', 2,
   'HR Review (10+ days)', 'approval', 'role', 'hr_admin', 24, 'super_admin',
   '{"field":"days","operator":">=","value":10}');

-- ── Timesheet Approval ────────────────────────────────────────────────────────
INSERT OR IGNORE INTO workflow_definitions (
  id, tenant_id, key, name, description, module,
  target_table, approved_value, rejected_value, enabled
) VALUES (
  'wf-timesheet-approval', 'xavvy-tenant-001',
  'timesheet_approval', 'Timesheet Approval', 'Weekly timesheet approval workflow', 'timesheets',
  'timesheets', 'approved', 'rejected', 1
);

INSERT OR IGNORE INTO workflow_steps (id, definition_id, tenant_id, step_order, name, step_type, approver_type, approver_role, sla_hours, auto_approve_after_sla)
VALUES
  ('wfs-ts-01', 'wf-timesheet-approval', 'xavvy-tenant-001', 1,
   'Manager Approval', 'approval', 'manager', 'manager', 72, 1);

-- ── Expense Approval ──────────────────────────────────────────────────────────
INSERT OR IGNORE INTO workflow_definitions (
  id, tenant_id, key, name, description, module,
  target_table, approved_value, rejected_value, enabled
) VALUES (
  'wf-expense-approval', 'xavvy-tenant-001',
  'expense_approval', 'Expense Approval', 'Expense claim approval with finance escalation for large amounts', 'expenses',
  'expense_claims', 'approved', 'rejected', 1
);

INSERT OR IGNORE INTO workflow_steps (id, definition_id, tenant_id, step_order, name, step_type, approver_type, approver_role, sla_hours, escalate_to_role, condition)
VALUES
  ('wfs-exp-01', 'wf-expense-approval', 'xavvy-tenant-001', 1,
   'Line Manager Approval', 'approval', 'manager', 'manager', 48, 'finance_admin', NULL),
  ('wfs-exp-02', 'wf-expense-approval', 'xavvy-tenant-001', 2,
   'Finance Approval (£500+)', 'approval', 'role', 'finance_admin', 48, 'super_admin',
   '{"field":"amount","operator":">=","value":500}');

-- ── Recruitment Approval ──────────────────────────────────────────────────────
INSERT OR IGNORE INTO workflow_definitions (
  id, tenant_id, key, name, description, module,
  target_table, approved_value, rejected_value, enabled
) VALUES (
  'wf-recruitment-approval', 'xavvy-tenant-001',
  'recruitment_approval', 'Vacancy Approval', 'New vacancy approval before job posting goes live', 'recruitment',
  'job_postings', 'open', 'closed', 1
);

INSERT OR IGNORE INTO workflow_steps (id, definition_id, tenant_id, step_order, name, step_type, approver_type, approver_role, sla_hours)
VALUES
  ('wfs-rec-01', 'wf-recruitment-approval', 'xavvy-tenant-001', 1,
   'HR Review', 'approval', 'role', 'hr_admin', 24),
  ('wfs-rec-02', 'wf-recruitment-approval', 'xavvy-tenant-001', 2,
   'Department Head Approval', 'approval', 'department_head', 'manager', 48),
  ('wfs-rec-03', 'wf-recruitment-approval', 'xavvy-tenant-001', 3,
   'Finance Sign-off', 'approval', 'role', 'finance_admin', 48);

-- ── Asset Request Approval ────────────────────────────────────────────────────
INSERT OR IGNORE INTO workflow_definitions (
  id, tenant_id, key, name, description, module,
  target_table, approved_value, rejected_value, enabled
) VALUES (
  'wf-asset-approval', 'xavvy-tenant-001',
  'asset_approval', 'Asset Request Approval', 'Employee asset request approval workflow', 'assets',
  'assets', 'in_use', 'available', 1
);

INSERT OR IGNORE INTO workflow_steps (id, definition_id, tenant_id, step_order, name, step_type, approver_type, approver_role, sla_hours)
VALUES
  ('wfs-ast-01', 'wf-asset-approval', 'xavvy-tenant-001', 1,
   'IT Manager Approval', 'approval', 'role', 'manager', 48);

PRAGMA foreign_keys = ON;

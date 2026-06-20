-- ============================================================
-- XavvySuite — Onboarding Module Schema
-- 008_onboarding.sql
-- ============================================================

PRAGMA foreign_keys = OFF;

-- ── Onboarding Templates ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS onboarding_templates (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id),
  name        TEXT NOT NULL,
  description TEXT,
  role_type   TEXT DEFAULT 'all',
  enabled     INTEGER DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- ── Template Tasks (master list for a template) ───────────────────────────────
CREATE TABLE IF NOT EXISTS onboarding_template_tasks (
  id           TEXT PRIMARY KEY,
  template_id  TEXT NOT NULL REFERENCES onboarding_templates(id),
  tenant_id    TEXT NOT NULL REFERENCES tenants(id),
  category     TEXT NOT NULL  -- it_setup | hr_docs | equipment | access | training | introduction | legal
    CHECK (category IN ('it_setup','hr_docs','equipment','access','training','introduction','legal','other')),
  title        TEXT NOT NULL,
  description  TEXT,
  owner        TEXT NOT NULL DEFAULT 'hr'  -- hr | it | manager | employee | finance
    CHECK (owner IN ('hr','it','manager','employee','finance','legal')),
  due_days     INTEGER DEFAULT 1,   -- days after start date
  required     INTEGER DEFAULT 1,
  task_order   INTEGER DEFAULT 0
);

-- ── Employee Onboarding (instance per new hire) ───────────────────────────────
CREATE TABLE IF NOT EXISTS employee_onboarding (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  employee_id     TEXT NOT NULL REFERENCES employees(id),
  template_id     TEXT REFERENCES onboarding_templates(id),
  start_date      TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('pending','in_progress','completed','overdue')),
  probation_end_date TEXT,
  probation_status   TEXT DEFAULT 'in_progress'
    CHECK (probation_status IN ('in_progress','passed','extended','failed')),
  probation_notes    TEXT,
  completion_pct     INTEGER DEFAULT 0,
  completed_at       TEXT,
  created_by         TEXT REFERENCES users(id),
  created_at         TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- ── Onboarding Tasks (assigned tasks per employee) ────────────────────────────
CREATE TABLE IF NOT EXISTS onboarding_tasks (
  id              TEXT PRIMARY KEY,
  onboarding_id   TEXT NOT NULL REFERENCES employee_onboarding(id),
  template_task_id TEXT REFERENCES onboarding_template_tasks(id),
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  employee_id     TEXT NOT NULL REFERENCES employees(id),
  category        TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  owner           TEXT NOT NULL DEFAULT 'hr',
  assigned_to     TEXT REFERENCES employees(id),
  due_date        TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','completed','skipped','blocked')),
  completed_at    TEXT,
  completed_by    TEXT REFERENCES users(id),
  notes           TEXT,
  task_order      INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_onboarding_employee ON employee_onboarding(tenant_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_tasks    ON onboarding_tasks(onboarding_id, status);

-- ── Seed default onboarding template ─────────────────────────────────────────
INSERT OR IGNORE INTO onboarding_templates (id, tenant_id, name, description, role_type, enabled)
VALUES ('tmpl-default', 'xavvy-tenant-001', 'Standard Onboarding', 'Default onboarding checklist for all new starters', 'all', 1);

INSERT OR IGNORE INTO onboarding_template_tasks (id, template_id, tenant_id, category, title, owner, due_days, required, task_order) VALUES
  -- Day 1 — HR & Legal
  ('otask-001', 'tmpl-default', 'xavvy-tenant-001', 'legal',        'Sign employment contract',          'hr',       1, 1, 1),
  ('otask-002', 'tmpl-default', 'xavvy-tenant-001', 'hr_docs',      'Complete RTW check',                'hr',       1, 1, 2),
  ('otask-003', 'tmpl-default', 'xavvy-tenant-001', 'hr_docs',      'Submit bank details',               'employee', 1, 1, 3),
  ('otask-004', 'tmpl-default', 'xavvy-tenant-001', 'hr_docs',      'Complete P45/P46 form',             'employee', 1, 1, 4),
  -- Day 1 — IT Setup
  ('otask-005', 'tmpl-default', 'xavvy-tenant-001', 'it_setup',     'Issue laptop and accessories',      'it',       1, 1, 5),
  ('otask-006', 'tmpl-default', 'xavvy-tenant-001', 'it_setup',     'Create company email account',      'it',       1, 1, 6),
  ('otask-007', 'tmpl-default', 'xavvy-tenant-001', 'access',       'Set up system access and logins',   'it',       1, 1, 7),
  ('otask-008', 'tmpl-default', 'xavvy-tenant-001', 'access',       'Issue office access card',          'hr',       1, 0, 8),
  -- Week 1 — Introduction
  ('otask-009', 'tmpl-default', 'xavvy-tenant-001', 'introduction', 'Meet the team — introductions',     'manager',  5, 1, 9),
  ('otask-010', 'tmpl-default', 'xavvy-tenant-001', 'introduction', '1:1 with line manager',             'manager',  5, 1, 10),
  ('otask-011', 'tmpl-default', 'xavvy-tenant-001', 'introduction', 'Office/site tour',                  'hr',       5, 0, 11),
  -- Week 1 — Training
  ('otask-012', 'tmpl-default', 'xavvy-tenant-001', 'training',     'Complete GDPR awareness training',  'employee', 7, 1, 12),
  ('otask-013', 'tmpl-default', 'xavvy-tenant-001', 'training',     'Complete health & safety induction','employee', 7, 1, 13),
  ('otask-014', 'tmpl-default', 'xavvy-tenant-001', 'hr_docs',      'Read and acknowledge employee handbook','employee',7,1,14),
  -- Month 1
  ('otask-015', 'tmpl-default', 'xavvy-tenant-001', 'training',     'Complete role-specific training',   'manager',  30, 1, 15),
  ('otask-016', 'tmpl-default', 'xavvy-tenant-001', 'introduction', '30-day review with manager',        'manager',  30, 1, 16),
  -- Probation
  ('otask-017', 'tmpl-default', 'xavvy-tenant-001', 'hr_docs',      'Schedule probation review meeting', 'manager',  80, 1, 17),
  ('otask-018', 'tmpl-default', 'xavvy-tenant-001', 'hr_docs',      'Complete probation review form',    'hr',       90, 1, 18);

PRAGMA foreign_keys = ON;

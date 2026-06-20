-- ============================================================
-- XavvySuite — Production Schema (Complete Merge)
-- Generated: 2026-06-16
-- Tables: 99  |  27 files merged
-- Sequence: all CREATE TABLE before ALTER TABLE and FK refs
-- 020_clear_projects.sql EXCLUDED (data wipe — run manually)
-- Deploy:
--   wrangler d1 execute xavvysuite-fresh-db --remote --file=xavvysuite_production.sql
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- 001_core
-- ════════════════════════════════════════════════════════════
-- ============================================================
-- XavvySuite — Core Schema
-- 001_core.sql
-- Run: wrangler d1 execute xavvysuite-fresh-db --file=schema/001_core.sql --remote
-- ============================================================

-- ── TENANTS ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
  id          TEXT PRIMARY KEY,
  subdomain   TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','trial')),
  plan        TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter','business','enterprise','self_hosted')),
  created_at  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE IF NOT EXISTS tenant_settings (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id),
  key         TEXT NOT NULL,
  value       TEXT,
  updated_at  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  UNIQUE (tenant_id, key)
);

CREATE TABLE IF NOT EXISTS tenant_modules (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id),
  module_key  TEXT NOT NULL,
  enabled     INTEGER NOT NULL DEFAULT 0,
  config      TEXT,
  UNIQUE (tenant_id, module_key)
);

CREATE TABLE IF NOT EXISTS tenant_branding (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL UNIQUE REFERENCES tenants(id),
  logo_url        TEXT,
  favicon_url     TEXT,
  company_name    TEXT,
  primary_color   TEXT DEFAULT '#6366F1',
  secondary_color TEXT DEFAULT '#14B8A6',
  login_html      TEXT,
  email_template  TEXT,
  updated_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE IF NOT EXISTS tenant_domains (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id),
  domain      TEXT NOT NULL UNIQUE,
  is_primary  INTEGER NOT NULL DEFAULT 0,
  tls_status  TEXT NOT NULL DEFAULT 'pending' CHECK (tls_status IN ('pending','active','failed')),
  verified_at TEXT
);

-- ── USERS & RBAC ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  email           TEXT NOT NULL,
  password_hash   TEXT,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','invited','suspended')),
  auth_provider   TEXT NOT NULL DEFAULT 'local',
  provider_id     TEXT,
  mfa_enabled     INTEGER NOT NULL DEFAULT 0,
  mfa_secret      TEXT,
  last_login      TEXT,
  created_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  UNIQUE (tenant_id, email)
);

CREATE TABLE IF NOT EXISTS roles (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id),
  name        TEXT NOT NULL,
  description TEXT,
  is_system   INTEGER NOT NULL DEFAULT 0,
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS permissions (
  id          TEXT PRIMARY KEY,
  module_key  TEXT NOT NULL,
  action      TEXT NOT NULL,
  resource    TEXT NOT NULL,
  description TEXT,
  UNIQUE (module_key, action, resource)
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       TEXT NOT NULL REFERENCES roles(id),
  permission_id TEXT NOT NULL REFERENCES permissions(id),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_roles (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  role_id    TEXT NOT NULL REFERENCES roles(id),
  scope_type TEXT NOT NULL DEFAULT 'tenant' CHECK (scope_type IN ('tenant','org_unit','department')),
  scope_id   TEXT,
  granted_by TEXT REFERENCES users(id),
  granted_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_roles_unique
  ON user_roles(user_id, role_id, scope_type, COALESCE(scope_id, ''));

-- ── ORGANISATION ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizational_units (
  id        TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  parent_id TEXT REFERENCES organizational_units(id),
  name      TEXT NOT NULL,
  type      TEXT NOT NULL DEFAULT 'office' CHECK (type IN ('company','region','division','business_unit','office')),
  code      TEXT
);

CREATE TABLE IF NOT EXISTS departments (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id),
  unit_id     TEXT REFERENCES organizational_units(id),
  name        TEXT NOT NULL,
  manager_id  TEXT,  -- FK to employees added after employees table
  cost_center TEXT
);

CREATE TABLE IF NOT EXISTS designations (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  title         TEXT NOT NULL,
  grade         TEXT,
  department_id TEXT REFERENCES departments(id)
);

-- ── EMPLOYEES (temporal model) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employees (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  user_id         TEXT UNIQUE REFERENCES users(id),
  employee_number TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','on_leave','terminated','suspended')),
  created_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  created_by      TEXT REFERENCES users(id),
  UNIQUE (tenant_id, employee_number)
);

CREATE TABLE IF NOT EXISTS employee_history (
  id                TEXT PRIMARY KEY,
  employee_id       TEXT NOT NULL REFERENCES employees(id),
  tenant_id         TEXT NOT NULL REFERENCES tenants(id),
  -- Identity
  first_name        TEXT NOT NULL,
  last_name         TEXT NOT NULL,
  preferred_name    TEXT,
  middle_name       TEXT,
  date_of_birth     TEXT,
  gender            TEXT,
  pronouns          TEXT,
  nationality       TEXT,
  ethnicity         TEXT,
  -- Employment
  department_id     TEXT REFERENCES departments(id),
  designation_id    TEXT REFERENCES designations(id),
  manager_id        TEXT REFERENCES employees(id),
  org_unit_id       TEXT REFERENCES organizational_units(id),
  start_date        TEXT,
  end_date          TEXT,
  employment_type   TEXT NOT NULL DEFAULT 'full_time' CHECK (employment_type IN ('full_time','part_time','contractor','intern','casual')),
  employment_basis  TEXT NOT NULL DEFAULT 'permanent' CHECK (employment_basis IN ('permanent','fixed_term','zero_hours')),
  contract_type     TEXT NOT NULL DEFAULT 'employed' CHECK (contract_type IN ('employed','self_employed','agency')),
  work_location_type TEXT DEFAULT 'office' CHECK (work_location_type IN ('office','remote','hybrid')),
  work_location     TEXT,
  probation_status  TEXT DEFAULT 'in_progress' CHECK (probation_status IN ('in_progress','passed','extended','waived','not_applicable')),
  probation_end_date TEXT,
  status            TEXT NOT NULL DEFAULT 'active',
  -- Versioning
  change_reason     TEXT,
  changed_by        TEXT REFERENCES users(id),
  effective_from    TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  effective_to      TEXT,
  is_current        INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_employee_history_current ON employee_history(employee_id, is_current);
CREATE INDEX IF NOT EXISTS idx_employee_history_tenant  ON employee_history(tenant_id, is_current);

CREATE TABLE IF NOT EXISTS employee_contact_info (
  id              TEXT PRIMARY KEY,
  employee_id     TEXT NOT NULL UNIQUE REFERENCES employees(id),
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  work_email      TEXT,
  personal_email  TEXT,
  work_phone      TEXT,
  personal_phone  TEXT,
  address_line_1  TEXT,
  address_line_2  TEXT,
  city            TEXT,
  state_province  TEXT,
  postcode        TEXT,
  country         TEXT DEFAULT 'GB',
  updated_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_by      TEXT REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS employee_compensation (
  id              TEXT PRIMARY KEY,
  employee_id     TEXT NOT NULL REFERENCES employees(id),
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  pay_type        TEXT NOT NULL DEFAULT 'salary' CHECK (pay_type IN ('salary','hourly','daily_rate','commission')),
  base_salary     REAL NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'GBP',
  pay_frequency   TEXT NOT NULL DEFAULT 'monthly' CHECK (pay_frequency IN ('monthly','fortnightly','weekly')),
  hours_per_week  REAL DEFAULT 37.5,
  overtime_eligible INTEGER DEFAULT 0,
  effective_from  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  effective_to    TEXT,
  is_current      INTEGER NOT NULL DEFAULT 1,
  change_reason   TEXT,
  approved_by     TEXT REFERENCES users(id),
  changed_by      TEXT REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS employee_identity_docs (
  id                  TEXT PRIMARY KEY,
  employee_id         TEXT NOT NULL REFERENCES employees(id),
  tenant_id           TEXT NOT NULL REFERENCES tenants(id),
  doc_type            TEXT NOT NULL,
  doc_number          TEXT,
  issuing_country     TEXT,
  issue_date          TEXT,
  expiry_date         TEXT,
  r2_file_key         TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending','verified','rejected','expired')),
  verified_by         TEXT REFERENCES users(id),
  verified_at         TEXT,
  is_current          INTEGER NOT NULL DEFAULT 1,
  created_at          TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_identity_docs_expiry ON employee_identity_docs(tenant_id, expiry_date);

CREATE TABLE IF NOT EXISTS employee_bank_details (
  id                      TEXT PRIMARY KEY,
  employee_id             TEXT NOT NULL REFERENCES employees(id),
  tenant_id               TEXT NOT NULL REFERENCES tenants(id),
  account_name            TEXT,
  account_number_encrypted TEXT,
  sort_code_encrypted     TEXT,
  iban_encrypted          TEXT,
  swift_bic               TEXT,
  bank_name               TEXT,
  currency                TEXT DEFAULT 'GBP',
  is_primary              INTEGER DEFAULT 1,
  effective_from          TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  is_current              INTEGER NOT NULL DEFAULT 1,
  changed_by              TEXT REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS employee_emergency_contacts (
  id              TEXT PRIMARY KEY,
  employee_id     TEXT NOT NULL REFERENCES employees(id),
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  full_name       TEXT NOT NULL,
  relationship    TEXT,
  phone_primary   TEXT,
  phone_secondary TEXT,
  email           TEXT,
  is_primary      INTEGER NOT NULL DEFAULT 0,
  updated_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE IF NOT EXISTS employee_right_to_work (
  id            TEXT PRIMARY KEY,
  employee_id   TEXT NOT NULL REFERENCES employees(id),
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('valid','invalid','expired','pending','pending_renewal')),
  check_type    TEXT NOT NULL DEFAULT 'manual' CHECK (check_type IN ('manual','share_code','external_service')),
  check_date    TEXT NOT NULL,
  expiry_date   TEXT,
  doc_type      TEXT,
  doc_reference TEXT,
  r2_file_key   TEXT,
  checked_by    TEXT REFERENCES users(id),
  created_at    TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_rtw_expiry ON employee_right_to_work(tenant_id, expiry_date);

CREATE TABLE IF NOT EXISTS reporting_hierarchy (
  employee_id TEXT NOT NULL REFERENCES employees(id),
  manager_id  TEXT NOT NULL REFERENCES employees(id),
  depth       INTEGER NOT NULL DEFAULT 0,
  is_direct   INTEGER NOT NULL DEFAULT 0,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id),
  PRIMARY KEY (employee_id, manager_id)
);

CREATE INDEX IF NOT EXISTS idx_rh_manager ON reporting_hierarchy(manager_id, tenant_id);

-- ── LEAVE ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leave_requests (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id),
  employee_id TEXT NOT NULL REFERENCES employees(id),
  leave_type  TEXT NOT NULL CHECK (leave_type IN ('annual','sick','maternity','paternity','unpaid','compassionate','other')),
  start_date  TEXT NOT NULL,
  end_date    TEXT NOT NULL,
  days        REAL NOT NULL,
  reason      TEXT,
  half_day    INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined','cancelled')),
  decided_by  TEXT REFERENCES users(id),
  decided_at  TEXT,
  comment     TEXT,
  created_at  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_leave_employee ON leave_requests(tenant_id, employee_id, status);

-- ── TIMESHEETS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS timesheets (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  employee_id   TEXT NOT NULL REFERENCES employees(id),
  project_id    TEXT,
  task_id       TEXT,
  week_starting TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  comment       TEXT,
  decided_by    TEXT REFERENCES users(id),
  decided_at    TEXT,
  submitted_at  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  UNIQUE (employee_id, week_starting)
);

CREATE TABLE IF NOT EXISTS timesheet_entries (
  id           TEXT PRIMARY KEY,
  timesheet_id TEXT NOT NULL REFERENCES timesheets(id),
  tenant_id    TEXT NOT NULL REFERENCES tenants(id),
  date         TEXT NOT NULL,
  hours_worked REAL NOT NULL CHECK (hours_worked >= 0 AND hours_worked <= 24),
  description  TEXT,
  billable     INTEGER NOT NULL DEFAULT 0
);

-- ── EXPENSES ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expense_claims (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL REFERENCES tenants(id),
  employee_id  TEXT NOT NULL REFERENCES employees(id),
  category     TEXT NOT NULL CHECK (category IN ('travel','accommodation','meals','equipment','training','software','other')),
  amount       REAL NOT NULL,
  currency     TEXT NOT NULL DEFAULT 'GBP',
  description  TEXT NOT NULL,
  expense_date TEXT NOT NULL,
  receipt_key  TEXT,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  decided_by   TEXT REFERENCES users(id),
  decided_at   TEXT,
  comment      TEXT,
  created_at   TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- ── PMO ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pmo_projects (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id),
  name        TEXT NOT NULL,
  client_name TEXT,
  start_date  TEXT,
  end_date    TEXT,
  budget      REAL,
  spent       REAL DEFAULT 0,
  priority    TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  status      TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning','active','on_hold','completed','cancelled')),
  created_by  TEXT REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE IF NOT EXISTS pmo_sprints (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL REFERENCES tenants(id),
  project_id     TEXT REFERENCES pmo_projects(id),
  sprint_number  INTEGER NOT NULL,
  sprint_name    TEXT NOT NULL,
  start_date     TEXT NOT NULL,
  end_date       TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','active','completed')),
  UNIQUE (tenant_id, sprint_number)
);

CREATE TABLE IF NOT EXISTS pmo_tasks (
  id               TEXT PRIMARY KEY,
  tenant_id        TEXT NOT NULL REFERENCES tenants(id),
  project_id       TEXT REFERENCES pmo_projects(id),
  sprint_id        TEXT REFERENCES pmo_sprints(id),
  name             TEXT NOT NULL,
  description      TEXT,
  assignee_id      TEXT REFERENCES employees(id),
  priority         TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  status           TEXT NOT NULL DEFAULT 'backlog' CHECK (status IN ('backlog','todo','in_progress','review','done')),
  estimated_hours  INTEGER DEFAULT 8,
  allocated_hours  INTEGER DEFAULT 0,
  phase            TEXT,
  task_category    TEXT,
  task_order       INTEGER DEFAULT 0,
  due_date         TEXT,
  created_by       TEXT REFERENCES users(id),
  created_at       TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at       TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE IF NOT EXISTS pmo_allocations (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id),
  project_id  TEXT NOT NULL REFERENCES pmo_projects(id),
  employee_id TEXT NOT NULL REFERENCES employees(id),
  role        TEXT,
  allocation  REAL DEFAULT 100,
  start_date  TEXT,
  end_date    TEXT,
  UNIQUE (project_id, employee_id)
);

-- ── DOCUMENTS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  name          TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'general',
  r2_key        TEXT NOT NULL,
  size_bytes    INTEGER,
  content_type  TEXT,
  access_level  TEXT NOT NULL DEFAULT 'all_staff',
  uploaded_by   TEXT REFERENCES users(id),
  created_at    TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- ── ANNOUNCEMENTS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS announcements (
  id         TEXT PRIMARY KEY,
  tenant_id  TEXT NOT NULL REFERENCES tenants(id),
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  priority   TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high','medium','low')),
  audience   TEXT NOT NULL DEFAULT 'all_staff',
  target_ids TEXT,
  pinned     INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- ── RECRUITMENT ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_postings (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  title         TEXT NOT NULL,
  department_id TEXT REFERENCES departments(id),
  location      TEXT,
  location_type TEXT DEFAULT 'office',
  description   TEXT,
  requirements  TEXT,
  salary_min    REAL,
  salary_max    REAL,
  currency      TEXT DEFAULT 'GBP',
  closing_date  TEXT,
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','interviewing','filled','closed')),
  created_by    TEXT REFERENCES users(id),
  created_at    TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);


-- [SKIPPED: job_applications — richer definition in a later file]


-- ── ASSETS ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assets (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL REFERENCES tenants(id),
  name           TEXT NOT NULL,
  category       TEXT NOT NULL,
  serial_number  TEXT,
  purchase_date  TEXT,
  purchase_value REAL,
  assigned_to_id TEXT REFERENCES employees(id),
  location       TEXT,
  status         TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','in_use','maintenance','retired')),
  notes          TEXT,
  created_by     TEXT REFERENCES users(id),
  created_at     TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at     TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- ── TRAINING ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS training_courses (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id),
  name        TEXT NOT NULL,
  description TEXT,
  mandatory   INTEGER NOT NULL DEFAULT 0,
  duration_hours REAL,
  provider    TEXT,
  created_by  TEXT REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE IF NOT EXISTS training_assignments (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL REFERENCES tenants(id),
  course_id      TEXT NOT NULL REFERENCES training_courses(id),
  employee_id    TEXT NOT NULL REFERENCES employees(id),
  status         TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned','in_progress','completed','overdue')),
  due_date       TEXT,
  completed_date TEXT,
  score          REAL,
  progress       INTEGER DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at     TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  UNIQUE (course_id, employee_id)
);

-- ── AUDIT LOG ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id),
  user_id     TEXT,
  user_email  TEXT,
  action      TEXT NOT NULL,
  resource    TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  changes     TEXT,
  metadata    TEXT,
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant   ON audit_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_log(tenant_id, resource, resource_id);


-- ════════════════════════════════════════════════════════════
-- 002_seed
-- ════════════════════════════════════════════════════════════

-- ============================================================
-- XavvySuite — Xavvy Tenant #1 Seed
-- 002_seed_xavvy.sql
-- Run AFTER 001_core.sql
-- ============================================================


-- ── Tenant ────────────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO tenants (id, subdomain, name, status, plan)
VALUES ('xavvy-tenant-001', 'xavvy', 'Xavvy', 'active', 'enterprise');

-- ── Domain ────────────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO tenant_domains (id, tenant_id, domain, is_primary, tls_status, verified_at)
VALUES ('dom-xavvy-001', 'xavvy-tenant-001', 'app.xavvy.uk', 1, 'active', CURRENT_TIMESTAMP);

-- ── Branding ──────────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO tenant_branding (id, tenant_id, company_name, primary_color, secondary_color)
VALUES ('brand-xavvy-001', 'xavvy-tenant-001', 'Xavvy', '#6366F1', '#14B8A6');

-- ── Modules (all enabled) ─────────────────────────────────────────────────────
INSERT OR IGNORE INTO tenant_modules (id, tenant_id, module_key, enabled) VALUES
  ('mod-xavvy-01', 'xavvy-tenant-001', 'hr',            1),
  ('mod-xavvy-02', 'xavvy-tenant-001', 'leave',         1),
  ('mod-xavvy-03', 'xavvy-tenant-001', 'timesheets',    1),
  ('mod-xavvy-04', 'xavvy-tenant-001', 'expenses',      1),
  ('mod-xavvy-05', 'xavvy-tenant-001', 'compliance',    1),
  ('mod-xavvy-06', 'xavvy-tenant-001', 'pmo',           1),
  ('mod-xavvy-07', 'xavvy-tenant-001', 'recruitment',   1),
  ('mod-xavvy-08', 'xavvy-tenant-001', 'documents',     1),
  ('mod-xavvy-09', 'xavvy-tenant-001', 'assets',        1),
  ('mod-xavvy-10', 'xavvy-tenant-001', 'training',      1),
  ('mod-xavvy-11', 'xavvy-tenant-001', 'announcements', 1),
  ('mod-xavvy-12', 'xavvy-tenant-001', 'sos',           1),
  ('mod-xavvy-13', 'xavvy-tenant-001', 'checklists',    1),
  ('mod-xavvy-14', 'xavvy-tenant-001', 'reporting',     1);

-- ── Settings ──────────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO tenant_settings (id, tenant_id, key, value) VALUES
  ('set-xavvy-01', 'xavvy-tenant-001', 'timezone',            '"Europe/London"'),
  ('set-xavvy-02', 'xavvy-tenant-001', 'currency',            '"GBP"'),
  ('set-xavvy-03', 'xavvy-tenant-001', 'annual_leave_days',   '25'),
  ('set-xavvy-04', 'xavvy-tenant-001', 'work_week_hours',     '37.5'),
  ('set-xavvy-05', 'xavvy-tenant-001', 'fiscal_year_start',   '"04-01"'),
  ('set-xavvy-06', 'xavvy-tenant-001', 'probation_days',      '90'),
  ('set-xavvy-07', 'xavvy-tenant-001', 'rtw_alert_days',      '90');

-- ── Permissions ───────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO permissions (id, module_key, action, resource, description) VALUES
  -- HR
  ('perm-hr-01', 'hr', 'view',   'employee',     'View employee records'),
  ('perm-hr-02', 'hr', 'create', 'employee',     'Create new employees'),
  ('perm-hr-03', 'hr', 'edit',   'employee',     'Edit employee records'),
  ('perm-hr-04', 'hr', 'delete', 'employee',     'Delete employee records'),
  ('perm-hr-05', 'hr', 'manage', 'employee',     'Full HR management'),
  ('perm-hr-06', 'hr', 'view',   'compensation', 'View salary data'),
  ('perm-hr-07', 'hr', 'manage', 'compensation', 'Manage salary data'),
  -- Leave
  ('perm-lv-01', 'leave', 'view',    'leave_request', 'View leave requests'),
  ('perm-lv-02', 'leave', 'create',  'leave_request', 'Submit leave requests'),
  ('perm-lv-03', 'leave', 'approve', 'leave_request', 'Approve/decline leave'),
  ('perm-lv-04', 'leave', 'manage',  'leave_policy',  'Manage leave policies'),
  -- Timesheets
  ('perm-ts-01', 'timesheets', 'view',    'timesheet', 'View timesheets'),
  ('perm-ts-02', 'timesheets', 'create',  'timesheet', 'Submit timesheets'),
  ('perm-ts-03', 'timesheets', 'approve', 'timesheet', 'Approve timesheets'),
  ('perm-ts-04', 'timesheets', 'export',  'timesheet', 'Export timesheet data'),
  -- Expenses
  ('perm-ex-01', 'expenses', 'view',    'expense_claim', 'View expense claims'),
  ('perm-ex-02', 'expenses', 'create',  'expense_claim', 'Submit expenses'),
  ('perm-ex-03', 'expenses', 'approve', 'expense_claim', 'Approve expenses'),
  ('perm-ex-04', 'expenses', 'manage',  'expense_claim', 'Full expense management'),
  -- Compliance
  ('perm-co-01', 'compliance', 'view',   'rtw_check',  'View RTW checks'),
  ('perm-co-02', 'compliance', 'create', 'rtw_check',  'Create RTW checks'),
  ('perm-co-03', 'compliance', 'manage', 'rtw_check',  'Full compliance management'),
  ('perm-co-04', 'compliance', 'view',   'audit_log',  'View audit log'),
  -- PMO
  ('perm-pm-01', 'pmo', 'view',   'project', 'View projects'),
  ('perm-pm-02', 'pmo', 'create', 'project', 'Create projects'),
  ('perm-pm-03', 'pmo', 'edit',   'project', 'Edit projects'),
  ('perm-pm-04', 'pmo', 'manage', 'project', 'Full project management'),
  ('perm-pm-05', 'pmo', 'view',   'task',    'View tasks'),
  ('perm-pm-06', 'pmo', 'create', 'task',    'Create tasks'),
  ('perm-pm-07', 'pmo', 'edit',   'task',    'Edit tasks'),
  -- Recruitment
  ('perm-re-01', 'recruitment', 'view',   'job_posting', 'View job postings'),
  ('perm-re-02', 'recruitment', 'create', 'job_posting', 'Create job postings'),
  ('perm-re-03', 'recruitment', 'manage', 'job_posting', 'Full recruitment management'),
  -- Documents
  ('perm-do-01', 'documents', 'view',   'document', 'View documents'),
  ('perm-do-02', 'documents', 'create', 'document', 'Upload documents'),
  ('perm-do-03', 'documents', 'delete', 'document', 'Delete documents'),
  ('perm-do-04', 'documents', 'manage', 'document', 'Full document management'),
  -- Assets
  ('perm-as-01', 'assets', 'view',   'asset', 'View assets'),
  ('perm-as-02', 'assets', 'create', 'asset', 'Register assets'),
  ('perm-as-03', 'assets', 'edit',   'asset', 'Edit assets'),
  ('perm-as-04', 'assets', 'manage', 'asset', 'Full asset management'),
  -- Training
  ('perm-tr-01', 'training', 'view',   'course',     'View training'),
  ('perm-tr-02', 'training', 'create', 'course',     'Create courses'),
  ('perm-tr-03', 'training', 'record', 'completion', 'Record completions'),
  ('perm-tr-04', 'training', 'manage', 'course',     'Full training management'),
  -- Announcements
  ('perm-an-01', 'announcements', 'view',   'announcement', 'View announcements'),
  ('perm-an-02', 'announcements', 'create', 'announcement', 'Create announcements'),
  ('perm-an-03', 'announcements', 'manage', 'announcement', 'Full announcement management');

-- ── Roles ─────────────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO roles (id, tenant_id, name, description, is_system) VALUES
  ('role-super-admin',      'xavvy-tenant-001', 'super_admin',        'Full platform access',                         1),
  ('role-hr-admin',         'xavvy-tenant-001', 'hr_admin',           'HR, Leave, Recruitment, Compliance access',    1),
  ('role-manager',          'xavvy-tenant-001', 'manager',            'Team approval permissions',                    1),
  ('role-employee',         'xavvy-tenant-001', 'employee',           'Self-service access',                          1),
  ('role-compliance',       'xavvy-tenant-001', 'compliance_officer', 'Compliance and RTW management',                1),
  ('role-finance',          'xavvy-tenant-001', 'finance_admin',      'Expenses, timesheets and reporting',           1);

-- ── Admin user (inserted after roles so user_roles FK is valid) ──
INSERT OR IGNORE INTO users (id, tenant_id, email, password_hash, status, auth_provider, created_at)
VALUES (
  'usr-admin-001',
  'xavvy-tenant-001',
  'admin@xavvy.uk',
  'sha256:xavvy2025:b9d692c361dec52f5ac1fbd19de61752a7d5262d425d7568a17be0ecd4db5ea8',
  'active',
  'local',
  CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO user_roles (id, user_id, role_id, scope_type, granted_by, granted_at)
VALUES ('ur-admin-001', 'usr-admin-001', 'role-super-admin', 'tenant', NULL, CURRENT_TIMESTAMP);


-- ── Role → Permission assignments ─────────────────────────────────────────────
-- super_admin gets everything via wildcard check in code (is_system=1 + name=super_admin)

-- hr_admin
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) SELECT 'role-hr-admin', id FROM permissions WHERE module_key IN ('hr','leave','recruitment','compliance') OR (module_key = 'documents' AND action IN ('view','create','manage'));

-- manager
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) SELECT 'role-manager', id FROM permissions WHERE (module_key = 'hr'          AND action = 'view'    AND resource = 'employee') OR (module_key = 'leave'       AND action IN ('view','approve')) OR (module_key = 'timesheets'  AND action IN ('view','approve')) OR (module_key = 'expenses'    AND action IN ('view','approve')) OR (module_key = 'pmo'         AND action IN ('view','create','edit')) OR (module_key = 'documents'   AND action = 'view') OR (module_key = 'announcements' AND action = 'view');

-- employee (self-service)
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) SELECT 'role-employee', id FROM permissions WHERE (module_key = 'leave'       AND action IN ('view','create')) OR (module_key = 'timesheets'  AND action IN ('view','create')) OR (module_key = 'expenses'    AND action IN ('view','create')) OR (module_key = 'documents'   AND action = 'view') OR (module_key = 'announcements' AND action = 'view') OR (module_key = 'training'    AND action IN ('view','record')) OR (module_key = 'pmo'         AND action IN ('view','edit'));

-- compliance_officer
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) SELECT 'role-compliance', id FROM permissions WHERE module_key IN ('compliance') OR (module_key = 'hr' AND action = 'view' AND resource = 'employee') OR (module_key = 'compliance' AND action = 'view' AND resource = 'audit_log');

-- finance_admin
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) SELECT 'role-finance', id FROM permissions WHERE module_key IN ('expenses') OR (module_key = 'timesheets' AND action IN ('view','approve','export'));

-- ── Org structure ─────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO organizational_units (id, tenant_id, parent_id, name, type, code)
VALUES ('unit-xavvy-001', 'xavvy-tenant-001', NULL, 'Xavvy', 'company', 'XAVVY');

INSERT OR IGNORE INTO departments (id, tenant_id, unit_id, name) VALUES
  ('dept-eng',     'xavvy-tenant-001', 'unit-xavvy-001', 'Engineering'),
  ('dept-hr',      'xavvy-tenant-001', 'unit-xavvy-001', 'HR'),
  ('dept-finance', 'xavvy-tenant-001', 'unit-xavvy-001', 'Finance'),
  ('dept-ops',     'xavvy-tenant-001', 'unit-xavvy-001', 'Operations'),
  ('dept-exec',    'xavvy-tenant-001', 'unit-xavvy-001', 'Executive');

INSERT OR IGNORE INTO designations (id, tenant_id, title, grade) VALUES
  ('des-001', 'xavvy-tenant-001', 'Junior Engineer',     'L2'),
  ('des-002', 'xavvy-tenant-001', 'Software Engineer',   'L3'),
  ('des-003', 'xavvy-tenant-001', 'Senior Engineer',     'L4'),
  ('des-004', 'xavvy-tenant-001', 'Lead Engineer',       'L5'),
  ('des-005', 'xavvy-tenant-001', 'Engineering Manager', 'L6'),
  ('des-006', 'xavvy-tenant-001', 'CTO',                 'L8'),
  ('des-007', 'xavvy-tenant-001', 'HR Manager',          'L4'),
  ('des-008', 'xavvy-tenant-001', 'Finance Analyst',     'L3'),
  ('des-009', 'xavvy-tenant-001', 'Operations Manager',  'L5');


-- ════════════════════════════════════════════════════════════
-- 004_scheduler
-- ════════════════════════════════════════════════════════════
-- ============================================================
-- XavvySuite — Job Scheduler Schema
-- 004_job_scheduler.sql
-- Run: wrangler d1 execute xavvysuite-fresh-db --file=schema/004_job_scheduler.sql --local
-- ============================================================


-- ── Job definitions ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scheduled_jobs (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  key           TEXT NOT NULL,                   -- system key e.g. 'rtw_expiry_check'
  name          TEXT NOT NULL,                   -- display name
  description   TEXT,
  category      TEXT NOT NULL DEFAULT 'custom',  -- system | compliance | hr | custom
  enabled       INTEGER NOT NULL DEFAULT 1,
  -- Schedule
  schedule_type TEXT NOT NULL DEFAULT 'cron'     -- cron | interval | once
    CHECK (schedule_type IN ('cron','interval','once')),
  cron_expr     TEXT,                            -- e.g. '0 9 * * 1' (Mon 9am)
  interval_mins INTEGER,                         -- e.g. 60 for hourly
  run_at        TEXT,                            -- ISO datetime for 'once' jobs
  -- Email config
  email_enabled INTEGER NOT NULL DEFAULT 1,
  email_to      TEXT NOT NULL DEFAULT 'hr',      -- hr | staff | employee | custom
  email_to_custom TEXT,                          -- comma-separated emails for 'custom'
  email_subject TEXT NOT NULL,
  email_body    TEXT NOT NULL,                   -- HTML with {{placeholders}}
  -- Trigger config (JSON) — e.g. {"days_before": 90} for expiry jobs
  trigger_config TEXT,
  -- Metadata
  last_run_at   TEXT,
  last_run_status TEXT,                          -- success | error | skipped
  next_run_at   TEXT,
  run_count     INTEGER NOT NULL DEFAULT 0,
  created_by    TEXT REFERENCES users(id),
  created_at    TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at    TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  UNIQUE (tenant_id, key)
);

-- ── Job execution log ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_run_log (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id),
  job_id      TEXT NOT NULL REFERENCES scheduled_jobs(id),
  triggered_by TEXT NOT NULL DEFAULT 'scheduler', -- scheduler | manual | api
  status      TEXT NOT NULL,                      -- running | success | error | skipped
  started_at  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  finished_at TEXT,
  duration_ms INTEGER,
  emails_sent INTEGER DEFAULT 0,
  records_processed INTEGER DEFAULT 0,
  error_message TEXT,
  output      TEXT                                -- JSON summary of what ran
);

CREATE INDEX IF NOT EXISTS idx_job_run_log_job    ON job_run_log(job_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_run_log_tenant ON job_run_log(tenant_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_tenant ON scheduled_jobs(tenant_id, enabled);

-- ── Seed system jobs for Xavvy ─────────────────────────────────────────────────
INSERT OR IGNORE INTO scheduled_jobs (
  id, tenant_id, key, name, description, category, enabled,
  schedule_type, cron_expr,
  email_enabled, email_to, email_subject, email_body,
  trigger_config, created_at, updated_at
) VALUES

-- 1. RTW Expiry Check
(
  'job-rtw-expiry', 'xavvy-tenant-001',
  'rtw_expiry_check',
  'Right to Work — Expiry Check',
  'Emails HR when employee RTW documents expire or are expiring within the configured threshold.',
  'compliance', 1,
  'cron', '0 8 * * 1',
  1, 'hr',
  'RTW Alert: {{expired_count}} Expired, {{expiring_count}} Expiring Soon',
  '<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden">
  <div style="background:#0F2A4A;padding:20px 24px">
    <h2 style="color:#fff;margin:0">Right to Work — Weekly Status Report</h2>
    <p style="color:#94A3B8;margin:4px 0 0;font-size:12px">{{company_name}} · {{run_date}}</p>
  </div>
  <div style="padding:24px">
    <p>Hi HR Team,</p>
    <p>The weekly RTW check has completed. Here is a summary:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr style="background:#f4f4f4">
        <th style="padding:10px;text-align:left;border:1px solid #e0e0e0">Employee</th>
        <th style="padding:10px;text-align:left;border:1px solid #e0e0e0">Document</th>
        <th style="padding:10px;text-align:left;border:1px solid #e0e0e0">Status</th>
        <th style="padding:10px;text-align:left;border:1px solid #e0e0e0">Expiry Date</th>
        <th style="padding:10px;text-align:left;border:1px solid #e0e0e0">Days Remaining</th>
      </tr>
      {{rtw_rows}}
    </table>
    <p style="color:#666;font-size:13px">Please take action on expired or expiring documents as soon as possible.</p>
    <a href="{{platform_url}}/compliance" style="display:inline-block;background:#1D6FA4;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold">View in XavvySuite →</a>
  </div>
</div></body></html>',
  '{"days_before": 90}',
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),

-- 2. Visa Expiry Check
(
  'job-visa-expiry', 'xavvy-tenant-001',
  'visa_expiry_check',
  'Visa Expiry Alert',
  'Emails HR and the employee when their visa is expiring within the configured threshold.',
  'compliance', 1,
  'cron', '0 9 * * *',
  1, 'hr',
  'Visa Expiry Alert: {{employee_name}} — {{days_remaining}} days remaining',
  '<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden">
  <div style="background:#0F2A4A;padding:20px 24px">
    <h2 style="color:#fff;margin:0">Visa Expiry Alert</h2>
    <p style="color:#94A3B8;margin:4px 0 0;font-size:12px">{{company_name}} · {{run_date}}</p>
  </div>
  <div style="padding:24px">
    <p>Hi {{recipient_name}},</p>
    <p>This is an automated alert regarding the following visa record:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr><td style="padding:8px;border:1px solid #e0e0e0;color:#666">Employee</td><td style="padding:8px;border:1px solid #e0e0e0"><strong>{{employee_name}}</strong></td></tr>
      <tr style="background:#f9f9f9"><td style="padding:8px;border:1px solid #e0e0e0;color:#666">Document Type</td><td style="padding:8px;border:1px solid #e0e0e0">{{document_type}}</td></tr>
      <tr><td style="padding:8px;border:1px solid #e0e0e0;color:#666">Expiry Date</td><td style="padding:8px;border:1px solid #e0e0e0;color:#EF4444;font-weight:bold">{{expiry_date}}</td></tr>
      <tr style="background:#f9f9f9"><td style="padding:8px;border:1px solid #e0e0e0;color:#666">Days Remaining</td><td style="padding:8px;border:1px solid #e0e0e0;font-weight:bold">{{days_remaining}} days</td></tr>
    </table>
    <p style="color:#666;font-size:13px">Please arrange renewal immediately to avoid any compliance risk.</p>
    <a href="{{platform_url}}/compliance" style="display:inline-block;background:#1D6FA4;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold">View in XavvySuite →</a>
  </div>
</div></body></html>',
  '{"days_before": 90, "notify_employee": true}',
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),

-- 3. Timesheet Submission Reminder
(
  'job-timesheet-reminder', 'xavvy-tenant-001',
  'timesheet_submission_reminder',
  'Timesheet Submission Reminder',
  'Reminds employees who have not submitted their timesheet for the current week.',
  'hr', 1,
  'cron', '0 16 * * 5',
  1, 'staff',
  'Reminder: Please submit your timesheet for week ending {{week_ending}}',
  '<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden">
  <div style="background:#0F2A4A;padding:20px 24px">
    <h2 style="color:#fff;margin:0">Timesheet Reminder</h2>
    <p style="color:#94A3B8;margin:4px 0 0;font-size:12px">{{company_name}}</p>
  </div>
  <div style="padding:24px">
    <p>Hi {{employee_name}},</p>
    <p>This is a friendly reminder to submit your timesheet for the week ending <strong>{{week_ending}}</strong>.</p>
    <p>Your timesheet has not yet been submitted. Please log your hours before end of business today.</p>
    <a href="{{platform_url}}/timesheets" style="display:inline-block;background:#1D6FA4;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;margin-top:8px">Submit Timesheet →</a>
    <p style="color:#999;font-size:12px;margin-top:24px">If you have already submitted your timesheet, please ignore this message.</p>
  </div>
</div></body></html>',
  '{}',
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),

-- 4. Probation End Alert
(
  'job-probation-alert', 'xavvy-tenant-001',
  'probation_end_alert',
  'Probation Period Ending Alert',
  'Alerts HR and the line manager when an employee probation period is ending within 14 days.',
  'hr', 1,
  'cron', '0 9 * * 1',
  1, 'hr',
  'Probation Ending: {{employee_name}} — {{days_remaining}} days remaining',
  '<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden">
  <div style="background:#0F2A4A;padding:20px 24px">
    <h2 style="color:#fff;margin:0">Probation Period Ending</h2>
    <p style="color:#94A3B8;margin:4px 0 0;font-size:12px">{{company_name}} · {{run_date}}</p>
  </div>
  <div style="padding:24px">
    <p>Hi {{manager_name}},</p>
    <p><strong>{{employee_name}}</strong> probation period is ending in <strong>{{days_remaining}} days</strong> on <strong>{{probation_end_date}}</strong>.</p>
    <p>Please ensure you have:</p>
    <ul>
      <li>Completed the probation review meeting</li>
      <li>Documented feedback in the system</li>
      <li>Confirmed the outcome (pass / extend / terminate)</li>
    </ul>
    <a href="{{platform_url}}/hr" style="display:inline-block;background:#1D6FA4;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold">View Employee Record →</a>
  </div>
</div></body></html>',
  '{"days_before": 14}',
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),

-- 5. Leave Balance Monthly Report
(
  'job-leave-balance-report', 'xavvy-tenant-001',
  'leave_balance_report',
  'Monthly Leave Balance Report',
  'Sends HR a summary of outstanding leave balances and pending requests on the 1st of each month.',
  'hr', 1,
  'cron', '0 8 1 * *',
  1, 'hr',
  'Monthly Leave Balance Report — {{month_year}}',
  '<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden">
  <div style="background:#0F2A4A;padding:20px 24px">
    <h2 style="color:#fff;margin:0">Monthly Leave Report</h2>
    <p style="color:#94A3B8;margin:4px 0 0;font-size:12px">{{company_name}} · {{month_year}}</p>
  </div>
  <div style="padding:24px">
    <p>Hi HR Team,</p>
    <p>Here is the leave summary for <strong>{{month_year}}</strong>:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr style="background:#f4f4f4">
        <th style="padding:10px;text-align:left;border:1px solid #e0e0e0">Employee</th>
        <th style="padding:10px;text-align:left;border:1px solid #e0e0e0">Annual Entitlement</th>
        <th style="padding:10px;text-align:left;border:1px solid #e0e0e0">Days Taken</th>
        <th style="padding:10px;text-align:left;border:1px solid #e0e0e0">Days Remaining</th>
        <th style="padding:10px;text-align:left;border:1px solid #e0e0e0">Pending</th>
      </tr>
      {{leave_rows}}
    </table>
    <a href="{{platform_url}}/leave" style="display:inline-block;background:#1D6FA4;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold">View in XavvySuite →</a>
  </div>
</div></body></html>',
  '{}',
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),

-- 6. Pending Approvals Digest
(
  'job-pending-approvals', 'xavvy-tenant-001',
  'pending_approvals_digest',
  'Pending Approvals Digest',
  'Sends managers a daily digest of items awaiting their approval (leave, timesheets, expenses).',
  'hr', 1,
  'cron', '0 9 * * 1-5',
  1, 'hr',
  'You have {{total_pending}} items awaiting approval',
  '<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden">
  <div style="background:#0F2A4A;padding:20px 24px">
    <h2 style="color:#fff;margin:0">Pending Approvals</h2>
    <p style="color:#94A3B8;margin:4px 0 0;font-size:12px">{{company_name}} · {{run_date}}</p>
  </div>
  <div style="padding:24px">
    <p>Hi {{manager_name}},</p>
    <p>You have <strong>{{total_pending}} items</strong> awaiting your approval:</p>
    <ul>
      <li>🌴 Leave requests: <strong>{{leave_pending}}</strong></li>
      <li>⏱ Timesheets: <strong>{{timesheet_pending}}</strong></li>
      <li>💳 Expense claims: <strong>{{expense_pending}}</strong></li>
    </ul>
    <a href="{{platform_url}}/dashboard" style="display:inline-block;background:#1D6FA4;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold">Review Now →</a>
  </div>
</div></body></html>',
  '{"skip_if_none": true}',
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);


-- ════════════════════════════════════════════════════════════
-- 005_scheduler_mod
-- ════════════════════════════════════════════════════════════
-- Add scheduler to tenant modules
INSERT OR IGNORE INTO tenant_modules (id, tenant_id, module_key, enabled)
VALUES ('mod-xavvy-15', 'xavvy-tenant-001', 'scheduler', 1);


-- ════════════════════════════════════════════════════════════
-- 005_workflow
-- ════════════════════════════════════════════════════════════
-- ============================================================
-- XavvySuite — Workflow Engine Schema
-- 005_workflow_engine.sql
-- ============================================================


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


-- ════════════════════════════════════════════════════════════
-- 006_recruitment
-- ════════════════════════════════════════════════════════════
-- ============================================================
-- XavvySuite — Recruitment Module Schema
-- 006_recruitment.sql
-- ============================================================


-- ── Job Requisitions (internal approval before posting) ───────────────────────
CREATE TABLE IF NOT EXISTS job_requisitions (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  title           TEXT NOT NULL,
  department_id   TEXT REFERENCES departments(id),
  location        TEXT,
  location_type   TEXT DEFAULT 'hybrid' CHECK (location_type IN ('office','remote','hybrid')),
  employment_type TEXT DEFAULT 'full_time',
  headcount       INTEGER NOT NULL DEFAULT 1,
  reason          TEXT,           -- replacement | new_role | expansion
  justification   TEXT,
  salary_min      REAL,
  salary_max      REAL,
  currency        TEXT DEFAULT 'GBP',
  target_start    TEXT,
  status          TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','pending_approval','approved','rejected','filled','cancelled')),
  priority        TEXT DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  requested_by    TEXT REFERENCES users(id),
  approved_by     TEXT REFERENCES users(id),
  approved_at     TEXT,
  created_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- ── Job Postings (public-facing, linked to approved requisition) ──────────────
-- Extends existing job_postings table with requisition link
ALTER TABLE job_postings ADD COLUMN requisition_id TEXT REFERENCES job_requisitions(id);
ALTER TABLE job_postings ADD COLUMN hiring_manager_id TEXT REFERENCES employees(id);
ALTER TABLE job_postings ADD COLUMN interview_stages TEXT; -- JSON array of stage names
ALTER TABLE job_postings ADD COLUMN application_count INTEGER DEFAULT 0;
ALTER TABLE job_postings ADD COLUMN published_at TEXT;
ALTER TABLE job_postings ADD COLUMN filled_at TEXT;

-- ── Candidates ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS candidates (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  email           TEXT NOT NULL,
  phone           TEXT,
  location        TEXT,
  linkedin_url    TEXT,
  cv_r2_key       TEXT,
  source          TEXT DEFAULT 'direct'
    CHECK (source IN ('direct','linkedin','referral','agency','job_board','website','other')),
  referral_by     TEXT REFERENCES employees(id),
  tags            TEXT,           -- JSON array of skill tags
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','hired','rejected','withdrawn','blacklisted')),
  created_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  UNIQUE (tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_candidates_tenant  ON candidates(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_candidates_email   ON candidates(tenant_id, email);

-- ── Applications (candidate applied to a job posting) ────────────────────────
-- Replaces / extends existing job_applications table
DROP TABLE IF EXISTS job_applications;
CREATE TABLE IF NOT EXISTS job_applications (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  job_id          TEXT NOT NULL REFERENCES job_postings(id),
  candidate_id    TEXT NOT NULL REFERENCES candidates(id),
  -- Pipeline stage
  stage           TEXT NOT NULL DEFAULT 'applied'
    CHECK (stage IN ('applied','screening','phone_screen','interview','assessment','offer','hired','rejected','withdrawn')),
  stage_order     INTEGER NOT NULL DEFAULT 1,
  -- Scores
  cv_score        INTEGER,        -- 1-5 rating
  overall_score   INTEGER,        -- calculated from interview scores
  -- Rejection
  rejection_reason TEXT,
  rejected_by     TEXT REFERENCES users(id),
  rejected_at     TEXT,
  -- Hiring
  hired_at        TEXT,
  employee_id     TEXT REFERENCES employees(id),  -- set when converted to employee
  -- Meta
  applied_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  created_by      TEXT REFERENCES users(id),
  UNIQUE (job_id, candidate_id)
);

CREATE INDEX IF NOT EXISTS idx_applications_job   ON job_applications(tenant_id, job_id, stage);
CREATE INDEX IF NOT EXISTS idx_applications_cand  ON job_applications(tenant_id, candidate_id);

-- ── Interview Schedules ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS interviews (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  application_id  TEXT NOT NULL REFERENCES job_applications(id),
  stage_name      TEXT NOT NULL,  -- e.g. 'Phone Screen', 'Technical', 'Final'
  interview_type  TEXT NOT NULL DEFAULT 'video'
    CHECK (interview_type IN ('phone','video','in_person','technical','panel')),
  scheduled_at    TEXT NOT NULL,
  duration_mins   INTEGER DEFAULT 60,
  location        TEXT,           -- room or video link
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','completed','cancelled','no_show')),
  -- Outcome
  score           INTEGER,        -- 1-5
  feedback        TEXT,
  recommendation  TEXT CHECK (recommendation IN ('strong_yes','yes','maybe','no','strong_no')),
  created_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- ── Interview Interviewers ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS interview_interviewers (
  interview_id    TEXT NOT NULL REFERENCES interviews(id),
  employee_id     TEXT NOT NULL REFERENCES employees(id),
  role            TEXT DEFAULT 'interviewer', -- lead | interviewer | observer
  feedback_given  INTEGER DEFAULT 0,
  PRIMARY KEY (interview_id, employee_id)
);

-- ── Offers ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_offers (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  application_id  TEXT NOT NULL REFERENCES job_applications(id),
  candidate_id    TEXT NOT NULL REFERENCES candidates(id),
  job_id          TEXT NOT NULL REFERENCES job_postings(id),
  -- Offer details
  salary          REAL NOT NULL,
  currency        TEXT DEFAULT 'GBP',
  start_date      TEXT,
  contract_type   TEXT DEFAULT 'permanent',
  employment_type TEXT DEFAULT 'full_time',
  location        TEXT,
  benefits        TEXT,           -- JSON array
  offer_letter_r2_key TEXT,
  -- Status
  status          TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sent','accepted','declined','expired','withdrawn')),
  sent_at         TEXT,
  expires_at      TEXT,
  responded_at    TEXT,
  decline_reason  TEXT,
  -- Meta
  created_by      TEXT REFERENCES users(id),
  created_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- ── Application Stage History (audit trail of pipeline movement) ──────────────
CREATE TABLE IF NOT EXISTS application_stage_history (
  id              TEXT PRIMARY KEY,
  application_id  TEXT NOT NULL REFERENCES job_applications(id),
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  from_stage      TEXT,
  to_stage        TEXT NOT NULL,
  moved_by        TEXT REFERENCES users(id),
  note            TEXT,
  moved_at        TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- ── Seed interview stages for IoT Platform job ────────────────────────────────
UPDATE job_postings
SET interview_stages = '["CV Screen","Phone Screen","Technical Interview","Final Interview"]'
WHERE tenant_id = 'xavvy-tenant-001';


-- ════════════════════════════════════════════════════════════
-- 007_leave
-- ════════════════════════════════════════════════════════════
-- ============================================================
-- XavvySuite — Leave Enhancements Schema
-- 007_leave_enhancements.sql
-- ============================================================


-- ── Leave Types ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leave_types (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  name            TEXT NOT NULL,        -- Annual Leave, Sick, Maternity etc.
  code            TEXT NOT NULL,        -- annual, sick, maternity etc.
  colour          TEXT DEFAULT '#6366F1',
  paid            INTEGER DEFAULT 1,    -- is it paid?
  requires_approval INTEGER DEFAULT 1,
  max_days        REAL,                -- max per year (null = unlimited)
  carry_forward   INTEGER DEFAULT 0,   -- can unused days carry forward?
  carry_forward_max REAL DEFAULT 0,   -- max days to carry forward
  carry_forward_expiry_months INTEGER DEFAULT 3, -- months before carried days expire
  accrual_type    TEXT DEFAULT 'fixed' CHECK (accrual_type IN ('fixed','accrual')),
  accrual_days    REAL DEFAULT 0,      -- days accrued per month if accrual type
  half_day_allowed INTEGER DEFAULT 1,
  is_system       INTEGER DEFAULT 0,   -- seeded types
  enabled         INTEGER DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- ── Leave Policies (entitlement per role/grade) ───────────────────────────────
CREATE TABLE IF NOT EXISTS leave_policies (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  leave_type_id   TEXT NOT NULL REFERENCES leave_types(id),
  name            TEXT NOT NULL,
  entitlement_days REAL NOT NULL,
  applies_to      TEXT DEFAULT 'all'   -- all | employment_type | grade
    CHECK (applies_to IN ('all','employment_type','grade')),
  applies_value   TEXT,               -- full_time | L3 etc.
  effective_from  TEXT NOT NULL,
  effective_to    TEXT,
  enabled         INTEGER DEFAULT 1
);

-- ── Leave Balances (running balance per employee per leave type per year) ──────
CREATE TABLE IF NOT EXISTS leave_balances (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  employee_id     TEXT NOT NULL REFERENCES employees(id),
  leave_type_id   TEXT NOT NULL REFERENCES leave_types(id),
  year            INTEGER NOT NULL,
  entitlement     REAL NOT NULL DEFAULT 0,
  accrued         REAL NOT NULL DEFAULT 0,
  taken           REAL NOT NULL DEFAULT 0,
  pending         REAL NOT NULL DEFAULT 0,
  carried_forward REAL NOT NULL DEFAULT 0,
  adjusted        REAL NOT NULL DEFAULT 0, -- manual adjustments by HR
  adjustment_note TEXT,
  updated_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  UNIQUE (tenant_id, employee_id, leave_type_id, year)
);

-- ── Public Holidays ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public_holidays (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id),
  name        TEXT NOT NULL,
  date        TEXT NOT NULL,
  region      TEXT DEFAULT 'all',    -- all | england_wales | scotland | ni
  year        INTEGER NOT NULL,
  UNIQUE (tenant_id, date, region)
);

-- ── Seed leave types ──────────────────────────────────────────────────────────
INSERT OR IGNORE INTO leave_types (id, tenant_id, name, code, colour, paid, requires_approval, max_days, carry_forward, carry_forward_max, half_day_allowed, is_system, enabled)
VALUES
  ('lt-annual',       'xavvy-tenant-001', 'Annual Leave',       'annual',       '#6366F1', 1, 1, 28, 1, 5, 1, 1, 1),
  ('lt-sick',         'xavvy-tenant-001', 'Sick Leave',         'sick',         '#EF4444', 1, 0, NULL, 0, 0, 1, 1, 1),
  ('lt-maternity',    'xavvy-tenant-001', 'Maternity Leave',    'maternity',    '#14B8A6', 1, 1, 52, 0, 0, 0, 1, 1),
  ('lt-paternity',    'xavvy-tenant-001', 'Paternity Leave',    'paternity',    '#38BDF8', 1, 1, 10, 0, 0, 0, 1, 1),
  ('lt-compassionate','xavvy-tenant-001', 'Compassionate Leave','compassionate','#F59E0B', 1, 1, 5,  0, 0, 0, 1, 1),
  ('lt-unpaid',       'xavvy-tenant-001', 'Unpaid Leave',       'unpaid',       '#475569', 0, 1, NULL, 0, 0, 1, 1, 1),
  ('lt-toil',         'xavvy-tenant-001', 'TOIL',               'toil',         '#A855F7', 1, 1, NULL, 1, 10, 1, 1, 1);

-- ── Seed leave policies ───────────────────────────────────────────────────────
INSERT OR IGNORE INTO leave_policies (id, tenant_id, leave_type_id, name, entitlement_days, applies_to, effective_from, enabled)
VALUES
  ('lp-annual-ft', 'xavvy-tenant-001', 'lt-annual', 'Annual Leave — Full Time', 25, 'all', '2025-01-01', 1),
  ('lp-sick-all',  'xavvy-tenant-001', 'lt-sick',   'Sick Leave — All Staff',   10, 'all', '2025-01-01', 1);

-- ── Seed UK Public Holidays 2025 & 2026 ──────────────────────────────────────
INSERT OR IGNORE INTO public_holidays (id, tenant_id, name, date, region, year) VALUES
  ('ph-2025-01', 'xavvy-tenant-001', "New Year's Day",       '2025-01-01', 'all', 2025),
  ('ph-2025-02', 'xavvy-tenant-001', 'Good Friday',           '2025-04-18', 'all', 2025),
  ('ph-2025-03', 'xavvy-tenant-001', 'Easter Monday',         '2025-04-21', 'england_wales', 2025),
  ('ph-2025-04', 'xavvy-tenant-001', 'Early May Bank Holiday','2025-05-05', 'all', 2025),
  ('ph-2025-05', 'xavvy-tenant-001', 'Spring Bank Holiday',   '2025-05-26', 'all', 2025),
  ('ph-2025-06', 'xavvy-tenant-001', 'Summer Bank Holiday',   '2025-08-25', 'all', 2025),
  ('ph-2025-07', 'xavvy-tenant-001', 'Christmas Day',         '2025-12-25', 'all', 2025),
  ('ph-2025-08', 'xavvy-tenant-001', 'Boxing Day',            '2025-12-26', 'all', 2025),
  ('ph-2026-01', 'xavvy-tenant-001', "New Year's Day",        '2026-01-01', 'all', 2026),
  ('ph-2026-02', 'xavvy-tenant-001', 'Good Friday',            '2026-04-03', 'all', 2026),
  ('ph-2026-03', 'xavvy-tenant-001', 'Easter Monday',          '2026-04-06', 'england_wales', 2026),
  ('ph-2026-04', 'xavvy-tenant-001', 'Early May Bank Holiday', '2026-05-04', 'all', 2026),
  ('ph-2026-05', 'xavvy-tenant-001', 'Spring Bank Holiday',    '2026-05-25', 'all', 2026),
  ('ph-2026-06', 'xavvy-tenant-001', 'Summer Bank Holiday',    '2026-08-31', 'all', 2026),
  ('ph-2026-07', 'xavvy-tenant-001', 'Christmas Day',          '2026-12-25', 'all', 2026),
  ('ph-2026-08', 'xavvy-tenant-001', 'Boxing Day',             '2026-12-28', 'all', 2026);


-- ════════════════════════════════════════════════════════════
-- 008_onboarding
-- ════════════════════════════════════════════════════════════
-- ============================================================
-- XavvySuite — Onboarding Module Schema
-- 008_onboarding.sql
-- ============================================================


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


-- ════════════════════════════════════════════════════════════
-- 009_visa
-- ════════════════════════════════════════════════════════════
-- ============================================================
-- XavvySuite — Visa Management Schema
-- 009_visa_management.sql
-- ============================================================


CREATE TABLE IF NOT EXISTS employee_visas (
  id                      TEXT PRIMARY KEY,
  tenant_id               TEXT NOT NULL REFERENCES tenants(id),
  employee_id             TEXT NOT NULL REFERENCES employees(id),
  visa_type               TEXT NOT NULL,
  visa_number             TEXT,
  country_of_issue        TEXT NOT NULL DEFAULT 'GBR',
  issue_date              TEXT,
  expiry_date             TEXT,
  status                  TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','expired','cancelled','pending','renewal_in_progress')),
  -- Sponsorship
  sponsorship_required    INTEGER NOT NULL DEFAULT 0,
  sponsor_licence_number  TEXT,
  cos_number              TEXT,       -- Certificate of Sponsorship
  cos_expiry              TEXT,
  cos_soc_code            TEXT,       -- Standard Occupational Classification
  -- Conditions
  work_restrictions       TEXT,       -- JSON array of restrictions
  notes                   TEXT,
  -- Alerts
  alert_90_day_sent       INTEGER DEFAULT 0,
  alert_60_day_sent       INTEGER DEFAULT 0,
  alert_30_day_sent       INTEGER DEFAULT 0,
  -- Meta
  verified_by             TEXT REFERENCES users(id),
  verified_at             TEXT,
  document_r2_key         TEXT,
  created_by              TEXT REFERENCES users(id),
  created_at              TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at              TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_visas_tenant   ON employee_visas(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_visas_employee ON employee_visas(tenant_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_visas_expiry   ON employee_visas(tenant_id, expiry_date);

-- ── Visa renewal history ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS visa_renewals (
  id            TEXT PRIMARY KEY,
  visa_id       TEXT NOT NULL REFERENCES employee_visas(id),
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  previous_expiry TEXT,
  new_expiry    TEXT,
  renewed_by    TEXT REFERENCES users(id),
  notes         TEXT,
  renewed_at    TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- ── Seed visa types (reference) ───────────────────────────────────────────────
-- No actual rows needed — visa_type is a free text field with suggestions


-- ════════════════════════════════════════════════════════════
-- 010_profile
-- ════════════════════════════════════════════════════════════
-- ============================================================
-- XavvySuite — Employee Full Profile Schema
-- 010_employee_profile.sql
-- ============================================================


-- ── Emergency contacts ────────────────────────────────────────────────────────

-- [SKIPPED: employee_emergency_contacts — richer definition in a later file]


-- ── Bank / payment details (stored encrypted in production) ───────────────────

-- [SKIPPED: employee_bank_details — richer definition in a later file]


-- ── Compensation history ──────────────────────────────────────────────────────

-- [SKIPPED: employee_compensation — richer definition in a later file]


-- [SKIPPED: index on employee_compensation]


-- ════════════════════════════════════════════════════════════
-- 011_checklists
-- ════════════════════════════════════════════════════════════
-- ============================================================
-- XavvySuite — Checklists Module Schema
-- 011_checklists.sql
-- ============================================================


CREATE TABLE IF NOT EXISTS checklist_templates (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id),
  name        TEXT NOT NULL,
  description TEXT,
  category    TEXT NOT NULL DEFAULT 'operational'
    CHECK (category IN ('operational','site_audit','compliance','hr','it','custom')),
  enabled     INTEGER DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE IF NOT EXISTS checklist_template_tasks (
  id           TEXT PRIMARY KEY,
  template_id  TEXT NOT NULL REFERENCES checklist_templates(id),
  tenant_id    TEXT NOT NULL REFERENCES tenants(id),
  title        TEXT NOT NULL,
  description  TEXT,
  required     INTEGER DEFAULT 1,
  task_order   INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS checklist_runs (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL REFERENCES tenants(id),
  template_id    TEXT NOT NULL REFERENCES checklist_templates(id),
  title          TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress','completed','overdue','cancelled')),
  completion_pct INTEGER DEFAULT 0,
  due_date       TEXT,
  assigned_to    TEXT REFERENCES employees(id),
  completed_at   TEXT,
  created_by     TEXT REFERENCES users(id),
  created_at     TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE IF NOT EXISTS checklist_run_tasks (
  id           TEXT PRIMARY KEY,
  run_id       TEXT NOT NULL REFERENCES checklist_runs(id),
  tenant_id    TEXT NOT NULL REFERENCES tenants(id),
  title        TEXT NOT NULL,
  description  TEXT,
  required     INTEGER DEFAULT 1,
  status       TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','completed','skipped','na')),
  completed_at TEXT,
  completed_by TEXT REFERENCES users(id),
  notes        TEXT,
  task_order   INTEGER DEFAULT 0
);

-- Seed templates
INSERT OR IGNORE INTO checklist_templates (id, tenant_id, name, description, category) VALUES
  ('ct-daily-ops',  'xavvy-tenant-001', 'Daily Operations Check',    'Daily opening and closing tasks', 'operational'),
  ('ct-site-audit', 'xavvy-tenant-001', 'Monthly Site Audit',         'Health, safety and facilities audit', 'site_audit'),
  ('ct-new-starter','xavvy-tenant-001', 'IT New Starter Setup',       'IT equipment and access provisioning', 'it'),
  ('ct-compliance', 'xavvy-tenant-001', 'Quarterly Compliance Review','Regulatory and policy compliance check', 'compliance');

INSERT OR IGNORE INTO checklist_template_tasks (id, template_id, tenant_id, title, required, task_order) VALUES
  ('ctt-01','ct-daily-ops','xavvy-tenant-001','Check and respond to urgent emails',1,1),
  ('ctt-02','ct-daily-ops','xavvy-tenant-001','Review pending approvals',1,2),
  ('ctt-03','ct-daily-ops','xavvy-tenant-001','Check compliance alerts',1,3),
  ('ctt-04','ct-daily-ops','xavvy-tenant-001','Review team attendance',0,4),
  ('ctt-05','ct-site-audit','xavvy-tenant-001','Fire exit inspection',1,1),
  ('ctt-06','ct-site-audit','xavvy-tenant-001','First aid kit check',1,2),
  ('ctt-07','ct-site-audit','xavvy-tenant-001','CCTV system operational',1,3),
  ('ctt-08','ct-site-audit','xavvy-tenant-001','Clean desk policy compliance',0,4),
  ('ctt-09','ct-site-audit','xavvy-tenant-001','Visitor book up to date',1,5),
  ('ctt-10','ct-new-starter','xavvy-tenant-001','Order laptop and accessories',1,1),
  ('ctt-11','ct-new-starter','xavvy-tenant-001','Create email and system accounts',1,2),
  ('ctt-12','ct-new-starter','xavvy-tenant-001','Set up VPN access',1,3),
  ('ctt-13','ct-new-starter','xavvy-tenant-001','Issue access card / fob',0,4),
  ('ctt-14','ct-new-starter','xavvy-tenant-001','Configure MFA on all accounts',1,5),
  ('ctt-15','ct-compliance','xavvy-tenant-001','Review all RTW checks',1,1),
  ('ctt-16','ct-compliance','xavvy-tenant-001','Verify training completions',1,2),
  ('ctt-17','ct-compliance','xavvy-tenant-001','Check visa expiry dates',1,3),
  ('ctt-18','ct-compliance','xavvy-tenant-001','Review policy acknowledgements',1,4);


-- ════════════════════════════════════════════════════════════
-- 013_remaining
-- ════════════════════════════════════════════════════════════
-- ============================================================
-- XavvySuite — Offboarding, SOS, Resources, Doc Expiry
-- 013_remaining_features.sql
-- ============================================================


-- ── Offboarding ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS offboarding_records (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  employee_id     TEXT NOT NULL REFERENCES employees(id),
  reason          TEXT NOT NULL CHECK (reason IN ('resignation','redundancy','retirement','termination','end_of_contract','other')),
  last_working_day TEXT NOT NULL,
  notice_given_date TEXT,
  status          TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress','completed','cancelled')),
  completion_pct  INTEGER DEFAULT 0,
  notes           TEXT,
  created_by      TEXT REFERENCES users(id),
  created_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE IF NOT EXISTS offboarding_tasks (
  id              TEXT PRIMARY KEY,
  offboarding_id  TEXT NOT NULL REFERENCES offboarding_records(id),
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  category        TEXT NOT NULL CHECK (category IN ('hr','it','finance','legal','manager','facilities','other')),
  title           TEXT NOT NULL,
  description     TEXT,
  owner           TEXT NOT NULL DEFAULT 'hr',
  due_date        TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','completed','na')),
  completed_at    TEXT,
  completed_by    TEXT REFERENCES users(id),
  task_order      INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_offboarding_employee ON offboarding_records(tenant_id, employee_id);

-- ── SOS / Emergency Alerts ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sos_alerts (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  title           TEXT NOT NULL,
  message         TEXT NOT NULL,
  severity        TEXT NOT NULL DEFAULT 'high'
    CHECK (severity IN ('low','medium','high','critical')),
  alert_type      TEXT NOT NULL DEFAULT 'general'
    CHECK (alert_type IN ('general','fire','medical','security','weather','it_outage','other')),
  status          TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','resolved','cancelled')),
  audience        TEXT NOT NULL DEFAULT 'all_staff',
  location        TEXT,
  action_required TEXT,
  raised_by       TEXT REFERENCES users(id),
  raised_at       TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  resolved_at     TEXT,
  resolved_by     TEXT REFERENCES users(id),
  resolution_note TEXT
);

CREATE TABLE IF NOT EXISTS sos_escalations (
  id          TEXT PRIMARY KEY,
  alert_id    TEXT NOT NULL REFERENCES sos_alerts(id),
  tenant_id   TEXT NOT NULL REFERENCES tenants(id),
  escalated_to TEXT REFERENCES users(id),
  role        TEXT,
  notified_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  channel     TEXT DEFAULT 'email'
);

CREATE TABLE IF NOT EXISTS sos_acknowledgements (
  id          TEXT PRIMARY KEY,
  alert_id    TEXT NOT NULL REFERENCES sos_alerts(id),
  tenant_id   TEXT NOT NULL REFERENCES tenants(id),
  user_id     TEXT REFERENCES users(id),
  acknowledged_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  status      TEXT DEFAULT 'safe' CHECK (status IN ('safe','needs_help','unknown'))
);

CREATE INDEX IF NOT EXISTS idx_sos_tenant ON sos_alerts(tenant_id, status);

-- ── Resource Planning ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS resource_capacity (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  employee_id     TEXT NOT NULL REFERENCES employees(id),
  week_starting   TEXT NOT NULL,
  available_hours REAL NOT NULL DEFAULT 37.5,
  allocated_hours REAL NOT NULL DEFAULT 0,
  leave_hours     REAL NOT NULL DEFAULT 0,
  notes           TEXT,
  updated_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  UNIQUE (tenant_id, employee_id, week_starting)
);

CREATE TABLE IF NOT EXISTS resource_bookings (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  employee_id     TEXT NOT NULL REFERENCES employees(id),
  project_id      TEXT REFERENCES pmo_projects(id),
  booking_type    TEXT NOT NULL DEFAULT 'project'
    CHECK (booking_type IN ('project','leave','training','internal','bench','other')),
  week_starting   TEXT NOT NULL,
  hours           REAL NOT NULL DEFAULT 0,
  notes           TEXT,
  created_by      TEXT REFERENCES users(id),
  created_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  UNIQUE (tenant_id, employee_id, project_id, week_starting)
);

CREATE INDEX IF NOT EXISTS idx_resource_bookings ON resource_bookings(tenant_id, week_starting);
CREATE INDEX IF NOT EXISTS idx_resource_capacity  ON resource_capacity(tenant_id, week_starting);

-- ── Document expiry tracking (extend documents table) ────────────────────────
ALTER TABLE documents ADD COLUMN expiry_date TEXT;
ALTER TABLE documents ADD COLUMN expiry_alert_days INTEGER DEFAULT 30;
ALTER TABLE documents ADD COLUMN alert_sent INTEGER DEFAULT 0;
ALTER TABLE documents ADD COLUMN doc_type TEXT DEFAULT 'other';


-- ════════════════════════════════════════════════════════════
-- 014_sso
-- ════════════════════════════════════════════════════════════
-- ============================================================
-- XavvySuite — SSO & MFA Schema
-- 014_sso_mfa.sql
-- ============================================================


-- ── SSO Provider Config (per tenant) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sso_providers (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  provider        TEXT NOT NULL CHECK (provider IN ('entra','google','saml','oidc')),
  enabled         INTEGER NOT NULL DEFAULT 0,
  -- OIDC / OAuth2
  client_id       TEXT,
  client_secret   TEXT,           -- stored encrypted in production
  tenant_domain   TEXT,           -- e.g. mycompany.com or Azure tenant ID
  redirect_uri    TEXT,
  -- SAML
  saml_entity_id  TEXT,
  saml_sso_url    TEXT,
  saml_cert       TEXT,           -- IdP signing certificate
  saml_sp_cert    TEXT,           -- SP certificate
  -- Behaviour
  auto_provision  INTEGER DEFAULT 1,   -- auto-create user on first SSO login
  force_sso       INTEGER DEFAULT 0,   -- disable local login when SSO enabled
  default_role    TEXT DEFAULT 'role-employee',
  created_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  UNIQUE (tenant_id, provider)
);

-- ── MFA settings per user ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_mfa (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL UNIQUE REFERENCES users(id),
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  method          TEXT NOT NULL DEFAULT 'totp' CHECK (method IN ('totp','sms','email')),
  totp_secret     TEXT,           -- base32 encoded TOTP secret
  backup_codes    TEXT,           -- JSON array of hashed backup codes
  enabled         INTEGER NOT NULL DEFAULT 0,
  enrolled_at     TEXT,
  last_used_at    TEXT,
  created_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- ── Magic link tokens ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS magic_link_tokens (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id),
  user_id     TEXT NOT NULL REFERENCES users(id),
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TEXT NOT NULL,
  used        INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_magic_tokens ON magic_link_tokens(token_hash, expires_at);

-- ── SSO sessions (state param storage for OAuth flows) ────────────────────────
-- These are short-lived; KV is the primary store but DB as fallback
CREATE TABLE IF NOT EXISTS sso_states (
  state       TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL,
  provider    TEXT NOT NULL,
  redirect_to TEXT,
  created_at  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);


-- ════════════════════════════════════════════════════════════
-- 015_saas
-- ════════════════════════════════════════════════════════════
-- ============================================================
-- XavvySuite — SaaS Mode Schema
-- 015_saas.sql
-- ============================================================


-- ── Subscriptions (per tenant) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id                    TEXT PRIMARY KEY,
  tenant_id             TEXT NOT NULL UNIQUE REFERENCES tenants(id),
  plan                  TEXT NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free','starter','professional','enterprise')),
  status                TEXT NOT NULL DEFAULT 'trialing'
    CHECK (status IN ('trialing','active','past_due','cancelled','paused')),
  stripe_customer_id    TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id       TEXT,
  trial_ends_at         TEXT,
  current_period_start  TEXT,
  current_period_end    TEXT,
  cancel_at_period_end  INTEGER DEFAULT 0,
  seat_count            INTEGER DEFAULT 5,
  created_at            TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at            TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);

-- ── Plan limits (what each plan can do) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS plan_limits (
  plan              TEXT PRIMARY KEY,
  max_employees     INTEGER DEFAULT 10,
  max_modules       INTEGER DEFAULT 5,
  max_storage_gb    REAL DEFAULT 1.0,
  max_api_calls_day INTEGER DEFAULT 1000,
  features          TEXT DEFAULT '[]'  -- JSON array of feature flags
);

INSERT OR IGNORE INTO plan_limits (plan, max_employees, max_modules, max_storage_gb, max_api_calls_day, features) VALUES
  ('free',         5,   5,  0.5, 500,   '["hr","leave","timesheets"]'),
  ('starter',      25,  10, 2.0, 2000,  '["hr","leave","timesheets","expenses","compliance","documents","training","announcements","orgchart","reporting"]'),
  ('professional', 100, 20, 10.0,10000, '["hr","leave","timesheets","expenses","compliance","documents","training","announcements","orgchart","reporting","recruitment","onboarding","visa","workflow","scheduler","checklists","offboarding2","resources","sos","pmo"]'),
  ('enterprise',   -1,  -1, -1,  -1,   '["*"]');

-- ── Onboarding checklist (tracks tenant setup progress) ──────────────────────
CREATE TABLE IF NOT EXISTS tenant_onboarding (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL UNIQUE REFERENCES tenants(id),
  step        TEXT NOT NULL DEFAULT 'profile'
    CHECK (step IN ('profile','team','modules','branding','complete')),
  completed_steps TEXT DEFAULT '[]',  -- JSON array
  created_at  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- ── Billing events (webhook log) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS billing_events (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT REFERENCES tenants(id),
  event_type  TEXT NOT NULL,
  stripe_event_id TEXT UNIQUE,
  payload     TEXT,  -- JSON
  processed   INTEGER DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- ── Extend tenants table with subdomain uniqueness index ─────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_subdomain ON tenants(subdomain);


-- ════════════════════════════════════════════════════════════
-- 012_seed_adhoc
-- ════════════════════════════════════════════════════════════
-- ============================================================
-- XavvySuite — Consolidated Ad-Hoc Seed
-- 012_seed_adhoc.sql
-- Safe to run multiple times. D1 compatible.
-- Run AFTER all schema migrations (001–011).
-- Key: all created_by/changed_by/granted_by = NULL (nullable).
-- Admin role assigned via SELECT on email, not hardcoded UUID.
-- ============================================================

-- ── 1. Tenant settings ───────────────────────────────────────
INSERT OR IGNORE INTO tenant_settings (id, tenant_id, key, value)
VALUES
  ('ts-001','xavvy-tenant-001','timezone',           'Europe/London'),
  ('ts-002','xavvy-tenant-001','currency',            'GBP'),
  ('ts-003','xavvy-tenant-001','date_format',         'DD/MM/YYYY'),
  ('ts-004','xavvy-tenant-001','working_days',        '["Mon","Tue","Wed","Thu","Fri"]'),
  ('ts-005','xavvy-tenant-001','financial_year_start','04-01'),
  ('ts-006','xavvy-tenant-001','leave_year_start',    '01-01');

-- ── 2. Tenant branding ───────────────────────────────────────
INSERT OR IGNORE INTO tenant_branding (id, tenant_id, company_name, primary_color, secondary_color)
VALUES ('brand-xavvy-001','xavvy-tenant-001','Xavvy Ltd','#6366F1','#14B8A6');
UPDATE tenant_branding SET company_name='Xavvy Ltd', primary_color='#6366F1', secondary_color='#14B8A6'
WHERE tenant_id='xavvy-tenant-001';

-- ── 3. Admin role fix (no hardcoded UUID — uses email lookup) ─
DELETE FROM user_roles
WHERE user_id = (SELECT id FROM users WHERE email='admin@xavvy.uk' AND tenant_id='xavvy-tenant-001')
  AND role_id != 'role-super-admin';

INSERT OR IGNORE INTO user_roles (id, user_id, role_id, scope_type, granted_by, granted_at)
SELECT 'ur-admin-super', id, 'role-super-admin', 'tenant', NULL, CURRENT_TIMESTAMP
FROM users WHERE email='admin@xavvy.uk' AND tenant_id='xavvy-tenant-001';

-- ── 4. Admin employee record ──────────────────────────────────
INSERT OR IGNORE INTO employees (id, tenant_id, user_id, employee_number, status, created_at, created_by)
SELECT 'emp-nanjusha-001', tenant_id, id, 'EMP-0001', 'active', CURRENT_TIMESTAMP, NULL
FROM users WHERE email='admin@xavvy.uk' AND tenant_id='xavvy-tenant-001';

UPDATE employee_history SET is_current=0
WHERE employee_id='emp-nanjusha-001' AND tenant_id='xavvy-tenant-001';

-- employee_history seeded in 003_iot_project.sql

-- ── 5. IoT team users ─────────────────────────────────────────
INSERT OR IGNORE INTO users (id, tenant_id, email, password_hash, status, auth_provider, created_at)
VALUES
  ('usr-nanjusha-001','xavvy-tenant-001','nanjusha.vasireddy@xavvy.uk','sha256:xavvy2025:b9d692c361dec52f5ac1fbd19de61752a7d5262d425d7568a17be0ecd4db5ea8','active','local',CURRENT_TIMESTAMP),
  ('usr-priya-001',   'xavvy-tenant-001','priya.narsing@xavvy.uk',    'sha256:xavvy2025:b9d692c361dec52f5ac1fbd19de61752a7d5262d425d7568a17be0ecd4db5ea8','active','local',CURRENT_TIMESTAMP),
  ('usr-swathi-001',  'xavvy-tenant-001','swathi.m@xavvy.uk',         'sha256:xavvy2025:b9d692c361dec52f5ac1fbd19de61752a7d5262d425d7568a17be0ecd4db5ea8','active','local',CURRENT_TIMESTAMP),
  ('usr-zeba-001',    'xavvy-tenant-001','zeba.mansoor@xavvy.uk',     'sha256:xavvy2025:b9d692c361dec52f5ac1fbd19de61752a7d5262d425d7568a17be0ecd4db5ea8','active','local',CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO user_roles (id, user_id, role_id, scope_type, granted_by, granted_at)
VALUES
  ('ur-nanjusha-001','usr-nanjusha-001','role-employee','tenant',NULL,CURRENT_TIMESTAMP),
  ('ur-priya-001',   'usr-priya-001',   'role-employee','tenant',NULL,CURRENT_TIMESTAMP),
  ('ur-swathi-001',  'usr-swathi-001',  'role-employee','tenant',NULL,CURRENT_TIMESTAMP),
  ('ur-zeba-001',    'usr-zeba-001',    'role-employee','tenant',NULL,CURRENT_TIMESTAMP);

-- ── 6. Extra designations ────────────────────────────────────
INSERT OR IGNORE INTO designations (id, tenant_id, title, grade) VALUES
  ('des-analyst-prog','xavvy-tenant-001','Analyst Programmer',      'L3'),
  ('des-ba-bi',       'xavvy-tenant-001','IT Business Analyst (BI)','L3'),
  ('des-fullstack',   'xavvy-tenant-001','Developer (Full Stack)',  'L3'),
  ('des-db-prog',     'xavvy-tenant-001','Database Programmer',     'L3');

-- ── 7. IoT team employees ────────────────────────────────────
INSERT OR IGNORE INTO employees (id, tenant_id, user_id, employee_number, status, created_at, created_by)
VALUES
  ('emp-nanjusha-001','xavvy-tenant-001','usr-nanjusha-001','EMP-1001','active',CURRENT_TIMESTAMP,NULL),
  ('emp-priya-001',   'xavvy-tenant-001','usr-priya-001',   'EMP-1002','active',CURRENT_TIMESTAMP,NULL),
  ('emp-swathi-001',  'xavvy-tenant-001','usr-swathi-001',  'EMP-1003','active',CURRENT_TIMESTAMP,NULL),
  ('emp-zeba-001',    'xavvy-tenant-001','usr-zeba-001',    'EMP-1004','active',CURRENT_TIMESTAMP,NULL);

-- ── 8. Employee history ───────────────────────────────────────
-- Use REPLACE to overwrite any existing rows (avoids INSERT OR IGNORE skipping them)
INSERT OR REPLACE INTO employee_history (
  id, employee_id, tenant_id, first_name, last_name,
  department_id, designation_id, org_unit_id,
  start_date, employment_type, employment_basis, contract_type,
  work_location_type, work_location, probation_status, status,
  change_reason, changed_by, effective_from, is_current
) VALUES
  ('eh-nanjusha-001','emp-nanjusha-001','xavvy-tenant-001','Nanjusha','Vasireddy','dept-eng','des-analyst-prog','unit-xavvy-001','2025-01-06','full_time','permanent','employed','hybrid','London HQ','passed','active','new_hire',NULL,'2025-01-06',1),
  ('eh-priya-001',   'emp-priya-001',   'xavvy-tenant-001','Priya',   'Narsing',  'dept-eng','des-ba-bi',       'unit-xavvy-001','2025-01-06','full_time','permanent','employed','hybrid','London HQ','passed','active','new_hire',NULL,'2025-01-06',1),
  ('eh-swathi-001',  'emp-swathi-001',  'xavvy-tenant-001','Swathi',  'M',        'dept-eng','des-fullstack',   'unit-xavvy-001','2025-01-06','full_time','permanent','employed','remote','Remote',    'passed','active','new_hire',NULL,'2025-01-06',1),
  ('eh-zeba-001',    'emp-zeba-001',    'xavvy-tenant-001','Zeba',    'Mansoor',  'dept-eng','des-db-prog',     'unit-xavvy-001','2025-01-06','full_time','permanent','employed','hybrid','London HQ','passed','active','new_hire',NULL,'2025-01-06',1);

-- ── 9. Reporting hierarchy ───────────────────────────────────
DELETE FROM reporting_hierarchy
WHERE employee_id IN ('emp-nanjusha-001','emp-nanjusha-001','emp-priya-001','emp-swathi-001','emp-zeba-001')
  AND tenant_id='xavvy-tenant-001';

-- Self-references for IoT team (safe — these employees were just inserted)
INSERT OR IGNORE INTO reporting_hierarchy (employee_id, manager_id, depth, is_direct, tenant_id)
SELECT id, id, 0, 0, tenant_id FROM employees
WHERE id IN ('emp-nanjusha-001','emp-priya-001','emp-swathi-001','emp-zeba-001')
  AND tenant_id='xavvy-tenant-001';

-- Admin self-reference (only if admin employee exists)
INSERT OR IGNORE INTO reporting_hierarchy (employee_id, manager_id, depth, is_direct, tenant_id)
SELECT id, id, 0, 0, tenant_id FROM employees
WHERE id='emp-nanjusha-001' AND tenant_id='xavvy-tenant-001';

-- IoT team reports to admin (only if admin employee exists)
INSERT OR IGNORE INTO reporting_hierarchy (employee_id, manager_id, depth, is_direct, tenant_id)
SELECT m.id, a.id, 1, 1, m.tenant_id
FROM employees m
JOIN employees a ON a.id='emp-nanjusha-001' AND a.tenant_id='xavvy-tenant-001'
WHERE m.id IN ('emp-nanjusha-001','emp-priya-001','emp-swathi-001','emp-zeba-001')
  AND m.tenant_id='xavvy-tenant-001';

-- ── 10. Tenant modules — enable all ──────────────────────────
INSERT OR IGNORE INTO tenant_modules (id, tenant_id, module_key, enabled) VALUES
  ('mod-xavvy-01','xavvy-tenant-001','dashboard',    1),
  ('mod-xavvy-02','xavvy-tenant-001','hr',           1),
  ('mod-xavvy-03','xavvy-tenant-001','leave',        1),
  ('mod-xavvy-04','xavvy-tenant-001','timesheets',   1),
  ('mod-xavvy-05','xavvy-tenant-001','expenses',     1),
  ('mod-xavvy-06','xavvy-tenant-001','compliance',   1),
  ('mod-xavvy-07','xavvy-tenant-001','documents',    1),
  ('mod-xavvy-08','xavvy-tenant-001','assets',       1),
  ('mod-xavvy-09','xavvy-tenant-001','training',     1),
  ('mod-xavvy-10','xavvy-tenant-001','announcements',1),
  ('mod-xavvy-11','xavvy-tenant-001','pmo',          1),
  ('mod-xavvy-12','xavvy-tenant-001','audit',        1),
  ('mod-xavvy-13','xavvy-tenant-001','reporting',    1),
  ('mod-xavvy-14','xavvy-tenant-001','orgchart',     1),
  ('mod-xavvy-15','xavvy-tenant-001','scheduler',    1),
  ('mod-xavvy-16','xavvy-tenant-001','workflow',     1),
  ('mod-xavvy-17','xavvy-tenant-001','recruitment',  1),
  ('mod-xavvy-18','xavvy-tenant-001','onboarding',   1),
  ('mod-xavvy-19','xavvy-tenant-001','visa',         1),
  ('mod-xavvy-20','xavvy-tenant-001','leavebalances',1),
  ('mod-xavvy-21','xavvy-tenant-001','leavecalendar',1),
  ('mod-xavvy-22','xavvy-tenant-001','checklists',   1);

UPDATE tenant_modules SET enabled=1 WHERE tenant_id='xavvy-tenant-001';

-- ── 11. IoT project ──────────────────────────────────────────
INSERT OR IGNORE INTO pmo_projects (id, tenant_id, name, client_name, start_date, end_date, budget, spent, priority, status, created_by, created_at)
VALUES ('proj-iot-001','xavvy-tenant-001','IoT Platform','Xavvy Ltd','2025-01-06','2027-12-31',480000,0,'high','active',NULL,CURRENT_TIMESTAMP);

UPDATE pmo_projects SET name='IoT Platform', budget=480000, status='active'
WHERE id='proj-iot-001' AND tenant_id='xavvy-tenant-001';

INSERT OR IGNORE INTO pmo_sprints (id, tenant_id, project_id, sprint_number, sprint_name, start_date, end_date, status) VALUES
  ('spr-iot-01','xavvy-tenant-001','proj-iot-001',10,'Requirements & Discovery',   '2025-01-06','2025-04-30','completed'),
  ('spr-iot-02','xavvy-tenant-001','proj-iot-001',11,'Architecture & Design',       '2025-03-01','2025-07-31','completed'),
  ('spr-iot-03','xavvy-tenant-001','proj-iot-001',12,'Hardware / RTLS Integration', '2025-06-01','2025-12-31','active'),
  ('spr-iot-04','xavvy-tenant-001','proj-iot-001',13,'Backend Development',         '2025-08-01','2026-06-30','active'),
  ('spr-iot-05','xavvy-tenant-001','proj-iot-001',14,'Dashboard Development',       '2026-01-01','2026-09-30','upcoming'),
  ('spr-iot-06','xavvy-tenant-001','proj-iot-001',15,'Testing & QA',                '2026-07-01','2027-02-28','upcoming'),
  ('spr-iot-07','xavvy-tenant-001','proj-iot-001',16,'Pilot & Rollout',             '2027-01-01','2027-07-31','upcoming'),
  ('spr-iot-08','xavvy-tenant-001','proj-iot-001',17,'Support & Optimisation',      '2027-05-01','2027-12-31','upcoming');

INSERT OR IGNORE INTO pmo_allocations (id, tenant_id, project_id, employee_id, role, allocation, start_date, end_date) VALUES
  ('alloc-nanjusha','xavvy-tenant-001','proj-iot-001','emp-nanjusha-001','Analyst Programmer',       100,'2025-01-06','2027-12-31'),
  ('alloc-priya',   'xavvy-tenant-001','proj-iot-001','emp-priya-001',   'IT Business Analyst (BI)', 100,'2025-01-06','2027-12-31'),
  ('alloc-swathi',  'xavvy-tenant-001','proj-iot-001','emp-swathi-001',  'Developer (Full Stack)',   100,'2025-01-06','2027-12-31'),
  ('alloc-zeba',    'xavvy-tenant-001','proj-iot-001','emp-zeba-001',    'Database Programmer',      100,'2025-01-06','2027-12-31');

INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, assignee_id, priority, status, estimated_hours, phase, task_category, task_order, due_date, created_by, created_at, updated_at) VALUES
  ('task-iot-001','xavvy-tenant-001','proj-iot-001','spr-iot-01','Stakeholder interviews & workshops',          'emp-nanjusha-001','high',    'done',       40,'Requirements & Discovery','Analysis',    1,'2025-01-31',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-002','xavvy-tenant-001','proj-iot-001','spr-iot-01','BI requirements & KPI definition',            'emp-priya-001',   'high',    'done',       48,'Requirements & Discovery','Analysis',    2,'2025-02-14',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-003','xavvy-tenant-001','proj-iot-001','spr-iot-01','Technical feasibility & stack selection',     'emp-swathi-001',  'high',    'done',       32,'Requirements & Discovery','Analysis',    3,'2025-02-28',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-004','xavvy-tenant-001','proj-iot-001','spr-iot-01','Data model scoping & schema requirements',    'emp-zeba-001',    'high',    'done',       32,'Requirements & Discovery','Analysis',    4,'2025-03-14',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-005','xavvy-tenant-001','proj-iot-001','spr-iot-01','Business requirements document (BRD)',        'emp-nanjusha-001','critical','done',       24,'Requirements & Discovery','Documentation',5,'2025-04-30',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-006','xavvy-tenant-001','proj-iot-001','spr-iot-02','Solution architecture design',                'emp-nanjusha-001','critical','done',       56,'Architecture & Design',   'Architecture',1,'2025-04-30',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-007','xavvy-tenant-001','proj-iot-001','spr-iot-02','BI architecture & data warehouse design',     'emp-priya-001',   'high',    'done',       48,'Architecture & Design',   'Architecture',2,'2025-05-15',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-008','xavvy-tenant-001','proj-iot-001','spr-iot-02','Full-stack architecture & API design',        'emp-swathi-001',  'high',    'done',       64,'Architecture & Design',   'Architecture',3,'2025-06-15',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-009','xavvy-tenant-001','proj-iot-001','spr-iot-02','Database schema & ERD design',                'emp-zeba-001',    'high',    'done',       56,'Architecture & Design',   'Architecture',4,'2025-06-30',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-010','xavvy-tenant-001','proj-iot-001','spr-iot-02','Architecture sign-off & design review',       'emp-nanjusha-001','critical','done',       16,'Architecture & Design',   'Review',      5,'2025-07-31',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-011','xavvy-tenant-001','proj-iot-001','spr-iot-03','SEWIO anchor placement specification',        'emp-nanjusha-001','high',    'in_progress',48,'Hardware / RTLS Integration','Hardware', 1,'2025-07-31',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-012','xavvy-tenant-001','proj-iot-001','spr-iot-03','SEWIO API integration - tag & zone data',     'emp-swathi-001',  'critical','in_progress',120,'Hardware / RTLS Integration','Integration',2,'2025-10-31',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-013','xavvy-tenant-001','proj-iot-001','spr-iot-03','Time-series database for location telemetry', 'emp-zeba-001',    'high',    'in_progress',80,'Hardware / RTLS Integration','Database',  3,'2025-11-30',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-014','xavvy-tenant-001','proj-iot-001','spr-iot-03','Hardware integration testing',                'emp-nanjusha-001','high',    'todo',       40,'Hardware / RTLS Integration','Testing',   4,'2025-12-31',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-015','xavvy-tenant-001','proj-iot-001','spr-iot-04','REST API - asset tracking endpoints',         'emp-swathi-001',  'critical','in_progress',160,'Backend Development',    'Development',1,'2026-01-31',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-016','xavvy-tenant-001','proj-iot-001','spr-iot-04','Authentication, RBAC & multi-tenant support', 'emp-swathi-001',  'critical','todo',       80,'Backend Development',     'Development',2,'2025-11-30',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-017','xavvy-tenant-001','proj-iot-001','spr-iot-04','Database development - core schema',          'emp-zeba-001',    'critical','in_progress',200,'Backend Development',    'Database',   3,'2026-03-31',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-018','xavvy-tenant-001','proj-iot-001','spr-iot-04','BI data pipeline & ETL development',          'emp-priya-001',   'high',    'todo',       120,'Backend Development',    'BI/Data',    4,'2026-04-30',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-019','xavvy-tenant-001','proj-iot-001','spr-iot-04','Query optimisation & performance tuning',     'emp-zeba-001',    'high',    'todo',       80,'Backend Development',     'Database',   5,'2026-06-30',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-020','xavvy-tenant-001','proj-iot-001','spr-iot-05','Real-time location map dashboard',            'emp-swathi-001',  'critical','todo',       160,'Dashboard Development',  'Frontend',   1,'2026-05-31',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-021','xavvy-tenant-001','proj-iot-001','spr-iot-05','BI dashboards - utilisation & analytics',     'emp-priya-001',   'high',    'todo',       144,'Dashboard Development',  'BI',         2,'2026-07-31',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-022','xavvy-tenant-001','proj-iot-001','spr-iot-05','Alert & notification system',                 'emp-swathi-001',  'high',    'todo',       80,'Dashboard Development',   'Frontend',   3,'2026-08-31',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-023','xavvy-tenant-001','proj-iot-001','spr-iot-05','Dashboard DB views & aggregation queries',    'emp-zeba-001',    'high',    'todo',       80,'Dashboard Development',   'Database',   4,'2026-09-30',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-024','xavvy-tenant-001','proj-iot-001','spr-iot-06','UAT planning & test script authoring',        'emp-nanjusha-001','high',    'todo',       80,'Testing & QA',            'QA',         1,'2026-08-31',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-025','xavvy-tenant-001','proj-iot-001','spr-iot-06','Integration & end-to-end testing',            'emp-swathi-001',  'critical','todo',       160,'Testing & QA',           'QA',         2,'2026-11-30',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-026','xavvy-tenant-001','proj-iot-001','spr-iot-06','BI report & data accuracy validation',        'emp-priya-001',   'high',    'todo',       96,'Testing & QA',            'QA',         3,'2026-12-31',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-027','xavvy-tenant-001','proj-iot-001','spr-iot-06','Database load & integrity testing',           'emp-zeba-001',    'high',    'todo',       96,'Testing & QA',            'QA',         4,'2027-01-31',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-028','xavvy-tenant-001','proj-iot-001','spr-iot-06','UAT execution & defect resolution',           'emp-nanjusha-001','critical','todo',       80,'Testing & QA',            'QA',         5,'2027-02-28',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-029','xavvy-tenant-001','proj-iot-001','spr-iot-07','Pilot site deployment & configuration',       'emp-nanjusha-001','critical','todo',       80,'Pilot & Rollout',         'Deployment', 1,'2027-02-28',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-030','xavvy-tenant-001','proj-iot-001','spr-iot-07','User training & onboarding',                  'emp-nanjusha-001','high',    'todo',       64,'Pilot & Rollout',         'Training',   2,'2027-03-31',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-031','xavvy-tenant-001','proj-iot-001','spr-iot-07','Pilot data analysis & reporting',             'emp-priya-001',   'high',    'todo',       96,'Pilot & Rollout',         'Analysis',   3,'2027-04-30',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-032','xavvy-tenant-001','proj-iot-001','spr-iot-07','Production go-live & hypercare',              'emp-swathi-001',  'critical','todo',       80,'Pilot & Rollout',         'Deployment', 4,'2027-06-30',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-033','xavvy-tenant-001','proj-iot-001','spr-iot-07','Production DB migration & data verification', 'emp-zeba-001',    'critical','todo',       64,'Pilot & Rollout',         'Database',   5,'2027-05-31',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-034','xavvy-tenant-001','proj-iot-001','spr-iot-08','BAU support & issue management',              'emp-nanjusha-001','medium',  'todo',       200,'Support & Optimisation', 'Support',    1,'2027-12-31',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-035','xavvy-tenant-001','proj-iot-001','spr-iot-08','BI optimisation & new report development',    'emp-priya-001',   'medium',  'todo',       160,'Support & Optimisation', 'BI',         2,'2027-12-31',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-036','xavvy-tenant-001','proj-iot-001','spr-iot-08','Platform feature development',                'emp-swathi-001',  'medium',  'todo',       160,'Support & Optimisation', 'Development',3,'2027-12-31',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-037','xavvy-tenant-001','proj-iot-001','spr-iot-08','Database optimisation & archiving',           'emp-zeba-001',    'medium',  'todo',       120,'Support & Optimisation', 'Database',   4,'2027-12-31',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);

-- ── 12. Workflow definitions & steps ─────────────────────────
INSERT OR IGNORE INTO workflow_definitions (id, tenant_id, key, name, description, module, target_table, approved_value, rejected_value, enabled)
VALUES
  ('wf-leave-approval',      'xavvy-tenant-001','leave_approval',      'Leave Approval',     'Standard leave request approval',     'leave',      'leave_requests', 'approved','declined', 1),
  ('wf-timesheet-approval',  'xavvy-tenant-001','timesheet_approval',  'Timesheet Approval', 'Weekly timesheet approval',           'timesheets', 'timesheets',     'approved','rejected', 1),
  ('wf-expense-approval',    'xavvy-tenant-001','expense_approval',    'Expense Approval',   'Expense claim approval',              'expenses',   'expense_claims', 'approved','rejected', 1),
  ('wf-recruitment-approval','xavvy-tenant-001','recruitment_approval','Vacancy Approval',   'Vacancy approval before posting',     'recruitment','job_postings',   'open',    'closed',   1),
  ('wf-asset-approval',      'xavvy-tenant-001','asset_approval',      'Asset Request',      'Asset request approval',              'assets',     'assets',         'in_use',  'available',1);

UPDATE workflow_definitions SET enabled=1 WHERE tenant_id='xavvy-tenant-001';

INSERT OR IGNORE INTO workflow_steps (id, definition_id, tenant_id, step_order, name, step_type, approver_type, approver_role, sla_hours, escalate_to_role, auto_approve_after_sla, condition)
VALUES
  ('wfs-leave-01',  'wf-leave-approval',      'xavvy-tenant-001',1,'Line Manager Approval',   'approval','manager',         'manager',     48,'hr_admin',    NULL,NULL),
  ('wfs-leave-02',  'wf-leave-approval',      'xavvy-tenant-001',2,'HR Review (10+ days)',     'approval','role',            'hr_admin',    24,'super_admin', NULL,'{"field":"days","operator":">=","value":10}'),
  ('wfs-ts-01',     'wf-timesheet-approval',  'xavvy-tenant-001',1,'Manager Approval',         'approval','manager',         'manager',     72,NULL,          1,   NULL),
  ('wfs-exp-01',    'wf-expense-approval',    'xavvy-tenant-001',1,'Line Manager Approval',    'approval','manager',         'manager',     48,'finance_admin',NULL,NULL),
  ('wfs-exp-02',    'wf-expense-approval',    'xavvy-tenant-001',2,'Finance Approval (500+)',  'approval','role',            'finance_admin',48,'super_admin', NULL,'{"field":"amount","operator":">=","value":500}'),
  ('wfs-rec-01',    'wf-recruitment-approval','xavvy-tenant-001',1,'HR Review',                'approval','role',            'hr_admin',    24,NULL,          NULL,NULL),
  ('wfs-rec-02',    'wf-recruitment-approval','xavvy-tenant-001',2,'Department Head Approval', 'approval','department_head', 'manager',     48,NULL,          NULL,NULL),
  ('wfs-rec-03',    'wf-recruitment-approval','xavvy-tenant-001',3,'Finance Sign-off',         'approval','role',            'finance_admin',48,NULL,         NULL,NULL),
  ('wfs-ast-01',    'wf-asset-approval',      'xavvy-tenant-001',1,'IT Manager Approval',      'approval','role',            'manager',     48,NULL,          NULL,NULL);

-- ── 13. Scheduled jobs ───────────────────────────────────────
INSERT OR IGNORE INTO scheduled_jobs (id, tenant_id, key, name, category, enabled, schedule_type, cron_expr, email_enabled, email_to, email_subject, email_body, trigger_config, created_by, created_at, updated_at) VALUES
  ('job-rtw-check',   'xavvy-tenant-001','rtw_expiry_check',             'RTW Expiry Check',        'compliance',1,'cron','0 8 * * 1',  1,'hr',     'RTW Alert - {{expired_count}} Expired, {{expiring_count}} Expiring',   '<p>RTW check required. {{expired_count}} expired, {{expiring_count}} expiring within 90 days.</p><p><a href="{{platform_url}}/compliance">Review</a></p>',       '{"days_before":90}',             NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('job-visa-check',  'xavvy-tenant-001','visa_expiry_check',            'Visa Expiry Alert',       'compliance',1,'cron','0 9 * * *',  1,'hr',     '{{employee_name}} - {{document_type}} expiring in {{days_remaining}} days','<p>Dear HR,</p><p>{{employee_name}} has a {{document_type}} expiring on {{expiry_date}} ({{days_remaining}} days).</p><p><a href="{{platform_url}}/compliance">Review</a></p>','{"days_before":90,"notify_employee":true}',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('job-ts-reminder', 'xavvy-tenant-001','timesheet_submission_reminder','Timesheet Reminder',      'hr',        1,'cron','0 16 * * 5',1,'employee','Reminder: Submit Your Timesheet for Week Ending {{week_ending}}',      '<p>Hi {{employee_name}},</p><p>Please submit your timesheet for week ending {{week_ending}}.</p><p><a href="{{platform_url}}/timesheets">Submit Now</a></p>',         '{}',                             NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('job-probation',   'xavvy-tenant-001','probation_end_alert',          'Probation End Alert',     'hr',        1,'cron','0 9 * * 1',  1,'hr',     'Probation Review Required - {{employee_name}} ({{days_remaining}} days)','<p>Hi {{manager_name}},</p><p>{{employee_name}} probation ends on {{probation_end_date}} ({{days_remaining}} days).</p><p><a href="{{platform_url}}/hr">Review</a></p>', '{"days_before":14}',             NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('job-leave-report','xavvy-tenant-001','leave_balance_report',         'Leave Balance Report',    'hr',        1,'cron','0 8 1 * *',  1,'hr',     'Monthly Leave Balance Report - {{month_year}}',                         '<p>Leave balance summary for {{month_year}}.</p><p><a href="{{platform_url}}/leavebalances">View Balances</a></p>',                                                     '{}',                             NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('job-approvals',   'xavvy-tenant-001','pending_approvals_digest',     'Pending Approvals Digest','hr',        1,'cron','0 9 * * 1-5',1,'hr',     'Pending Approvals - {{total_pending}} items awaiting action',           '<p>You have {{total_pending}} pending approvals. Leave: {{leave_pending}} | Timesheets: {{timesheet_pending}} | Expenses: {{expense_pending}}</p><p><a href="{{platform_url}}/workflow">Review</a></p>','{"skip_if_none":true}',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);

UPDATE scheduled_jobs SET enabled=1 WHERE tenant_id='xavvy-tenant-001';

-- Automated weekly timesheet submission (every Monday 00:01)
-- Marks previous week tasks complete, submits 35hr timesheets, allocates new tasks
INSERT OR IGNORE INTO scheduled_jobs (id, tenant_id, key, name, category, enabled, schedule_type, cron_expr, email_enabled, email_to, email_subject, email_body, trigger_config, created_by, created_at, updated_at)
VALUES (
  'job-auto-ts','xavvy-tenant-001','auto_timesheet_submission','Automated Timesheet Submission','hr',1,'cron','1 0 * * 1',0,'hr',
  'Automated Timesheet Submitted for Week Ending {{week_ending}}',
  '<p>Timesheets have been automatically submitted for {{employee_count}} employees for week ending {{week_ending}}.</p>',
  '{"hours_per_week":35,"auto_complete_tasks":true,"auto_allocate_tasks":true}',
  NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

-- Leave balance auto-initialise (1 Jan each year)
INSERT OR IGNORE INTO scheduled_jobs (id, tenant_id, key, name, category, enabled, schedule_type, cron_expr, email_enabled, email_to, email_subject, email_body, trigger_config, created_by, created_at, updated_at)
VALUES (
  'job-leave-init','xavvy-tenant-001','leave_balance_init','Leave Balance Initialisation','hr',1,'cron','0 6 1 1 *',0,'hr',
  'Leave Balances Initialised for {{year}}',
  '<p>Leave balances have been automatically initialised for all active employees for {{year}}.</p>',
  '{"entitlements":{"annual":25,"sick":10,"toil":0}}',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

-- Timesheet missing detection (every Monday morning)
INSERT OR IGNORE INTO scheduled_jobs (id, tenant_id, key, name, category, enabled, schedule_type, cron_expr, email_enabled, email_to, email_subject, email_body, trigger_config, created_by, created_at, updated_at)
VALUES (
  'job-ts-missing','xavvy-tenant-001','timesheet_missing_alert','Missing Timesheet Alert','hr',1,'cron','0 9 * * 1',1,'manager',
  '{{count}} Missing Timesheets for Week Ending {{week_ending}}',
  '<p>Hi {{manager_name}},</p><p>{{count}} team member(s) have not submitted their timesheet for week ending {{week_ending}}:</p><ul>{{employee_list}}</ul><p><a href="{{platform_url}}/timesheets">View Timesheets</a></p>',
  '{"grace_hours":8}',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

-- ── 14. Leave types & policies ───────────────────────────────
INSERT OR IGNORE INTO leave_types (id, tenant_id, name, code, colour, paid, requires_approval, max_days, carry_forward, carry_forward_max, half_day_allowed, is_system, enabled, created_at)
VALUES
  ('lt-annual',       'xavvy-tenant-001','Annual Leave',       'annual',       '#6366F1',1,1,28,  1,5, 1,1,1,CURRENT_TIMESTAMP),
  ('lt-sick',         'xavvy-tenant-001','Sick Leave',         'sick',         '#EF4444',1,0,NULL, 0,0, 1,1,1,CURRENT_TIMESTAMP),
  ('lt-maternity',    'xavvy-tenant-001','Maternity Leave',    'maternity',    '#14B8A6',1,1,52,  0,0, 0,1,1,CURRENT_TIMESTAMP),
  ('lt-paternity',    'xavvy-tenant-001','Paternity Leave',    'paternity',    '#38BDF8',1,1,10,  0,0, 0,1,1,CURRENT_TIMESTAMP),
  ('lt-compassionate','xavvy-tenant-001','Compassionate Leave','compassionate','#F59E0B',1,1,5,   0,0, 0,1,1,CURRENT_TIMESTAMP),
  ('lt-unpaid',       'xavvy-tenant-001','Unpaid Leave',       'unpaid',       '#475569',0,1,NULL, 0,0, 1,1,1,CURRENT_TIMESTAMP),
  ('lt-toil',         'xavvy-tenant-001','TOIL',               'toil',         '#A855F7',1,1,NULL, 1,10,1,1,1,CURRENT_TIMESTAMP);

UPDATE leave_types SET enabled=1 WHERE tenant_id='xavvy-tenant-001';

INSERT OR IGNORE INTO leave_policies (id, tenant_id, leave_type_id, name, entitlement_days, applies_to, effective_from, enabled)
VALUES
  ('lp-annual-ft','xavvy-tenant-001','lt-annual','Annual Leave - Full Time',25,'all','2025-01-01',1),
  ('lp-sick-all', 'xavvy-tenant-001','lt-sick',  'Sick Leave - All Staff',  10,'all','2025-01-01',1);

UPDATE leave_policies SET enabled=1 WHERE tenant_id='xavvy-tenant-001';

-- ── 15. Checklist templates ───────────────────────────────────
INSERT OR IGNORE INTO checklist_templates (id, tenant_id, name, description, category, enabled, created_at)
VALUES
  ('ct-daily-ops',  'xavvy-tenant-001','Daily Operations Check',     'Daily opening and closing tasks',    'operational',1,CURRENT_TIMESTAMP),
  ('ct-site-audit', 'xavvy-tenant-001','Monthly Site Audit',          'Health, safety and facilities audit','site_audit', 1,CURRENT_TIMESTAMP),
  ('ct-new-starter','xavvy-tenant-001','IT New Starter Setup',        'IT equipment and access setup',      'it',         1,CURRENT_TIMESTAMP),
  ('ct-compliance', 'xavvy-tenant-001','Quarterly Compliance Review', 'Regulatory compliance check',        'compliance', 1,CURRENT_TIMESTAMP);

UPDATE checklist_templates SET enabled=1 WHERE tenant_id='xavvy-tenant-001';

-- ════════════════════════════════════════════════════════════
-- SHOWCASE SEED DATA — timesheets, leave, RTW, training
-- ════════════════════════════════════════════════════════════

-- Leave requests (approved)
INSERT OR IGNORE INTO leave_requests (id,tenant_id,employee_id,leave_type,start_date,end_date,days,reason,half_day,status,decided_at,comment,created_at)
VALUES
  ('lr-001','xavvy-tenant-001','emp-nanjusha-001','annual','2026-03-03','2026-03-07',5,'Annual holiday',0,'approved',CURRENT_TIMESTAMP,'Approved',CURRENT_TIMESTAMP),
  ('lr-002','xavvy-tenant-001','emp-priya-001','sick','2026-04-14','2026-04-15',2,'Unwell',0,'approved',CURRENT_TIMESTAMP,'Get well soon',CURRENT_TIMESTAMP),
  ('lr-003','xavvy-tenant-001','emp-swathi-001','annual','2026-06-01','2026-06-05',5,'Summer break',0,'approved',CURRENT_TIMESTAMP,'Approved',CURRENT_TIMESTAMP),
  ('lr-004','xavvy-tenant-001','emp-zeba-001','annual','2026-07-14','2026-07-18',5,'Summer holiday',0,'approved',CURRENT_TIMESTAMP,'Approved',CURRENT_TIMESTAMP),
  ('lr-005','xavvy-tenant-001','emp-nanjusha-001','annual','2026-12-24','2026-12-31',6,'Christmas',0,'approved',CURRENT_TIMESTAMP,'Approved',CURRENT_TIMESTAMP);

-- Leave balances (annual leave)
INSERT OR IGNORE INTO leave_balances (id,tenant_id,employee_id,leave_type_id,year,entitlement,taken,pending,carried_forward,updated_at)
VALUES
  ('lb-nan-annual-2026','xavvy-tenant-001','emp-nanjusha-001','lt-annual',2026,25,11,0,3,CURRENT_TIMESTAMP),
  ('lb-pri-annual-2026','xavvy-tenant-001','emp-priya-001',   'lt-annual',2026,25,2,0,3,CURRENT_TIMESTAMP),
  ('lb-swa-annual-2026','xavvy-tenant-001','emp-swathi-001',  'lt-annual',2026,25,5,0,3,CURRENT_TIMESTAMP),
  ('lb-zeb-annual-2026','xavvy-tenant-001','emp-zeba-001',    'lt-annual',2026,25,5,0,3,CURRENT_TIMESTAMP),
  ('lb-nan-sick-2026',  'xavvy-tenant-001','emp-nanjusha-001','lt-sick',  2026,10,0,0,0,CURRENT_TIMESTAMP),
  ('lb-pri-sick-2026',  'xavvy-tenant-001','emp-priya-001',   'lt-sick',  2026,10,2,0,0,CURRENT_TIMESTAMP),
  ('lb-swa-sick-2026',  'xavvy-tenant-001','emp-swathi-001',  'lt-sick',  2026,10,0,0,0,CURRENT_TIMESTAMP),
  ('lb-zeb-sick-2026',  'xavvy-tenant-001','emp-zeba-001',    'lt-sick',  2026,10,0,0,0,CURRENT_TIMESTAMP);

-- Timesheets (approved — 4 weeks for all 4 IoT team members)
INSERT OR IGNORE INTO timesheets (id,tenant_id,employee_id,project_id,week_starting,status,submitted_at)
VALUES
  ('ts-nan-w1','xavvy-tenant-001','emp-nanjusha-001','proj-iot-001','2026-06-01','approved',CURRENT_TIMESTAMP),
  ('ts-pri-w1','xavvy-tenant-001','emp-priya-001','proj-iot-001','2026-06-01','approved',CURRENT_TIMESTAMP),
  ('ts-swa-w1','xavvy-tenant-001','emp-swathi-001','proj-iot-001','2026-06-01','approved',CURRENT_TIMESTAMP),
  ('ts-zeb-w1','xavvy-tenant-001','emp-zeba-001','proj-iot-001','2026-06-01','approved',CURRENT_TIMESTAMP),
  ('ts-nan-w2','xavvy-tenant-001','emp-nanjusha-001','proj-iot-001','2026-05-25','approved',CURRENT_TIMESTAMP),
  ('ts-pri-w2','xavvy-tenant-001','emp-priya-001','proj-iot-001','2026-05-25','approved',CURRENT_TIMESTAMP),
  ('ts-swa-w2','xavvy-tenant-001','emp-swathi-001','proj-iot-001','2026-05-25','approved',CURRENT_TIMESTAMP),
  ('ts-zeb-w2','xavvy-tenant-001','emp-zeba-001','proj-iot-001','2026-05-25','approved',CURRENT_TIMESTAMP);

-- Timesheet entries (Mon-Fri, 7hrs/day = 35hrs/week)
INSERT OR IGNORE INTO timesheet_entries (id,timesheet_id,tenant_id,date,hours_worked,description,billable)
VALUES
  ('te-n1-m','ts-nan-w1','xavvy-tenant-001','2026-06-01',7,'SEWIO integration analysis',1),
  ('te-n1-t','ts-nan-w1','xavvy-tenant-001','2026-06-02',7,'Requirements documentation',1),
  ('te-n1-w','ts-nan-w1','xavvy-tenant-001','2026-06-03',7,'Stakeholder calls',1),
  ('te-n1-th','ts-nan-w1','xavvy-tenant-001','2026-06-04',7,'UAT planning',1),
  ('te-n1-f','ts-nan-w1','xavvy-tenant-001','2026-06-05',7,'Sprint review',1),
  ('te-p1-m','ts-pri-w1','xavvy-tenant-001','2026-06-01',7,'BI dashboard design',1),
  ('te-p1-t','ts-pri-w1','xavvy-tenant-001','2026-06-02',7,'Data pipeline work',1),
  ('te-p1-w','ts-pri-w1','xavvy-tenant-001','2026-06-03',7,'ETL development',1),
  ('te-p1-th','ts-pri-w1','xavvy-tenant-001','2026-06-04',7,'Report validation',1),
  ('te-p1-f','ts-pri-w1','xavvy-tenant-001','2026-06-05',7,'KPI review',1),
  ('te-s1-m','ts-swa-w1','xavvy-tenant-001','2026-06-01',7,'API endpoint development',1),
  ('te-s1-t','ts-swa-w1','xavvy-tenant-001','2026-06-02',7,'REST API testing',1),
  ('te-s1-w','ts-swa-w1','xavvy-tenant-001','2026-06-03',7,'Frontend dashboard',1),
  ('te-s1-th','ts-swa-w1','xavvy-tenant-001','2026-06-04',7,'Real-time map feature',1),
  ('te-s1-f','ts-swa-w1','xavvy-tenant-001','2026-06-05',7,'Code review',1),
  ('te-z1-m','ts-zeb-w1','xavvy-tenant-001','2026-06-01',7,'Database schema work',1),
  ('te-z1-t','ts-zeb-w1','xavvy-tenant-001','2026-06-02',7,'Query optimisation',1),
  ('te-z1-w','ts-zeb-w1','xavvy-tenant-001','2026-06-03',7,'Indexing & performance',1),
  ('te-z1-th','ts-zeb-w1','xavvy-tenant-001','2026-06-04',7,'Data migration scripts',1),
  ('te-z1-f','ts-zeb-w1','xavvy-tenant-001','2026-06-05',7,'DB testing',1),
  -- Week 2 entries
  ('te-n2-m','ts-nan-w2','xavvy-tenant-001','2026-05-25',7,'SEWIO integration analysis',1),
  ('te-n2-t','ts-nan-w2','xavvy-tenant-001','2026-05-26',7,'Requirements documentation',1),
  ('te-n2-w','ts-nan-w2','xavvy-tenant-001','2026-05-27',7,'Architecture review',1),
  ('te-n2-th','ts-nan-w2','xavvy-tenant-001','2026-05-28',7,'Client meeting',1),
  ('te-n2-f','ts-nan-w2','xavvy-tenant-001','2026-05-29',7,'Sprint planning',1),
  ('te-p2-m','ts-pri-w2','xavvy-tenant-001','2026-05-25',7,'BI reports',1),
  ('te-s2-m','ts-swa-w2','xavvy-tenant-001','2026-05-25',7,'API development',1),
  ('te-z2-m','ts-zeb-w2','xavvy-tenant-001','2026-05-25',7,'DB work',1);

-- RTW checks for all employees (so compliance report has data)
INSERT OR IGNORE INTO employee_right_to_work (id,employee_id,tenant_id,status,check_type,check_date,expiry_date,doc_type,doc_reference,checked_by,created_at)
VALUES
  ('rtw-nan','emp-nanjusha-001','xavvy-tenant-001','valid','manual','2025-01-06','2030-01-06','passport','P123456789','usr-nanjusha-001',CURRENT_TIMESTAMP),
  ('rtw-pri','emp-priya-001','xavvy-tenant-001','valid','manual','2025-01-06','2028-05-15','brp','BRP987654321','usr-priya-001',CURRENT_TIMESTAMP),
  ('rtw-swa','emp-swathi-001','xavvy-tenant-001','valid','manual','2025-01-06','2027-03-20','passport','P987654321','usr-swathi-001',CURRENT_TIMESTAMP),
  ('rtw-zeb','emp-zeba-001','xavvy-tenant-001','expiring','manual','2025-01-06','2026-09-15','brp','BRP123456789','usr-zeba-001',CURRENT_TIMESTAMP);

-- Training courses and assignments
INSERT OR IGNORE INTO training_courses (id,tenant_id,name,description,mandatory,duration_hours,provider,created_by,created_at)
VALUES
  ('tc-data-gdpr','xavvy-tenant-001','GDPR & Data Protection','Annual compliance training',1,2,'Internal','usr-nanjusha-001',CURRENT_TIMESTAMP),
  ('tc-fire-safety','xavvy-tenant-001','Fire Safety Awareness','H&S mandatory training',1,1,'Internal','usr-nanjusha-001',CURRENT_TIMESTAMP),
  ('tc-aws','xavvy-tenant-001','AWS Solutions Architect','Cloud architecture certification',0,40,'AWS','usr-nanjusha-001',CURRENT_TIMESTAMP),
  ('tc-agile','xavvy-tenant-001','Agile & Scrum','Project management methodology',0,8,'External','usr-nanjusha-001',CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO training_assignments (id,tenant_id,course_id,employee_id,status,due_date,completed_date,score,progress,created_at,updated_at)
VALUES
  ('ta-nan-gdpr','xavvy-tenant-001','tc-data-gdpr','emp-nanjusha-001','completed','2026-03-31','2026-02-14',95,100,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('ta-pri-gdpr','xavvy-tenant-001','tc-data-gdpr','emp-priya-001','completed','2026-03-31','2026-03-01',88,100,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('ta-swa-gdpr','xavvy-tenant-001','tc-data-gdpr','emp-swathi-001','completed','2026-03-31','2026-03-15',92,100,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('ta-zeb-gdpr','xavvy-tenant-001','tc-data-gdpr','emp-zeba-001','in_progress','2026-03-31',NULL,NULL,60,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('ta-nan-fire','xavvy-tenant-001','tc-fire-safety','emp-nanjusha-001','completed','2026-06-30','2026-04-10',100,100,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('ta-pri-fire','xavvy-tenant-001','tc-fire-safety','emp-priya-001','completed','2026-06-30','2026-04-12',100,100,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('ta-swa-fire','xavvy-tenant-001','tc-fire-safety','emp-swathi-001','not_started','2026-06-30',NULL,NULL,0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('ta-zeb-fire','xavvy-tenant-001','tc-fire-safety','emp-zeba-001','not_started','2026-06-30',NULL,NULL,0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('ta-nan-aws','xavvy-tenant-001','tc-aws','emp-nanjusha-001','in_progress','2026-09-30',NULL,NULL,35,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('ta-swa-aws','xavvy-tenant-001','tc-aws','emp-swathi-001','in_progress','2026-09-30',NULL,NULL,50,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);

-- Expense claims
INSERT OR IGNORE INTO expense_claims (id,tenant_id,employee_id,category,amount,currency,description,expense_date,status,created_at)
VALUES
  ('exp-001','xavvy-tenant-001','emp-nanjusha-001','travel',45.80,'GBP','Train to client meeting','2026-05-15','approved',CURRENT_TIMESTAMP),
  ('exp-002','xavvy-tenant-001','emp-priya-001','software',120.00,'GBP','Tableau license renewal','2026-05-20','approved',CURRENT_TIMESTAMP),
  ('exp-003','xavvy-tenant-001','emp-swathi-001','equipment',89.99,'GBP','Keyboard and mouse','2026-05-22','pending',CURRENT_TIMESTAMP),
  ('exp-004','xavvy-tenant-001','emp-zeba-001','travel',28.50,'GBP','Taxi to office','2026-06-01','pending',CURRENT_TIMESTAMP);

-- Resource bookings (for resource planning showcase)
INSERT OR IGNORE INTO resource_bookings (id,tenant_id,employee_id,project_id,booking_type,week_starting,hours,notes,created_by,created_at)
VALUES
  ('rb-nan-w1','xavvy-tenant-001','emp-nanjusha-001','proj-iot-001','project','2026-06-08',35,'SEWIO integration','usr-nanjusha-001',CURRENT_TIMESTAMP),
  ('rb-pri-w1','xavvy-tenant-001','emp-priya-001','proj-iot-001','project','2026-06-08',35,'BI pipeline','usr-priya-001',CURRENT_TIMESTAMP),
  ('rb-swa-w1','xavvy-tenant-001','emp-swathi-001','proj-iot-001','project','2026-06-08',30,'API development','usr-swathi-001',CURRENT_TIMESTAMP),
  ('rb-zeb-w1','xavvy-tenant-001','emp-zeba-001','proj-iot-001','project','2026-06-08',35,'DB work','usr-zeba-001',CURRENT_TIMESTAMP),
  ('rb-swa-int','xavvy-tenant-001','emp-swathi-001',NULL,'internal','2026-06-08',5,'Team meetings','usr-swathi-001',CURRENT_TIMESTAMP),
  ('rb-nan-w2','xavvy-tenant-001','emp-nanjusha-001','proj-iot-001','project','2026-06-15',35,'Analysis','usr-nanjusha-001',CURRENT_TIMESTAMP),
  ('rb-pri-w2','xavvy-tenant-001','emp-priya-001','proj-iot-001','project','2026-06-15',35,'BI reports','usr-priya-001',CURRENT_TIMESTAMP),
  ('rb-swa-w2','xavvy-tenant-001','emp-swathi-001','proj-iot-001','project','2026-06-15',35,'Frontend','usr-swathi-001',CURRENT_TIMESTAMP),
  ('rb-zeb-w2','xavvy-tenant-001','emp-zeba-001','proj-iot-001','project','2026-06-15',28,'DB optimisation','usr-zeba-001',CURRENT_TIMESTAMP);

-- ════════════════════════════════════════════════════════════
-- RECRUITMENT SHOWCASE DATA
-- ════════════════════════════════════════════════════════════

-- Job postings
INSERT OR IGNORE INTO job_postings (id,tenant_id,title,department_id,location,location_type,description,requirements,salary_min,salary_max,currency,closing_date,status,created_by,created_at)
VALUES
  ('jp-swe-001','xavvy-tenant-001','Senior Software Engineer','dept-eng','London, UK','hybrid','We are looking for a Senior Software Engineer to join our growing IoT platform team.','5+ years experience, Python/TypeScript, cloud platforms',60000,80000,'GBP','2026-08-31','open','usr-nanjusha-001',CURRENT_TIMESTAMP),
  ('jp-pm-001','xavvy-tenant-001','Product Manager','dept-eng','London, UK','hybrid','Experienced Product Manager to lead our IoT product roadmap.','3+ years product management, B2B SaaS experience',55000,70000,'GBP','2026-07-31','open','usr-nanjusha-001',CURRENT_TIMESTAMP),
  ('jp-da-001','xavvy-tenant-001','Data Analyst','dept-eng','Remote','remote','Data Analyst to help build our analytics and reporting capabilities.','SQL, Python, BI tools (Tableau/PowerBI)',40000,55000,'GBP','2026-09-30','open','usr-nanjusha-001',CURRENT_TIMESTAMP);

-- Candidates
INSERT OR IGNORE INTO candidates (id,tenant_id,first_name,last_name,email,phone,location,source,notes,status,created_at,updated_at)
VALUES
  ('cand-001','xavvy-tenant-001','James','Harrison','james.harrison@email.com','+44 7700 123456','London, UK','linkedin','Strong TypeScript background, ex-Meta','active',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('cand-002','xavvy-tenant-001','Sarah','Chen','sarah.chen@email.com','+44 7700 234567','Manchester, UK','referral','Referred by Nanjusha — excellent PM background','active',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('cand-003','xavvy-tenant-001','Rahul','Patel','rahul.patel@email.com','+44 7700 345678','Remote','job_board','5 years at Deloitte, strong analytics skills','active',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('cand-004','xavvy-tenant-001','Emma','Williams','emma.williams@email.com','+44 7700 456789','London, UK','linkedin','Junior profile but strong portfolio','active',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('cand-005','xavvy-tenant-001','David','Okonkwo','david.okonkwo@email.com','+44 7700 567890','London, UK','linkedin','Lead engineer at fintech startup','active',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);

-- job_applications skipped — schema varies between 001_core and 006_recruitment migrations
-- Add applications through the Recruitment UI after seeding


-- ════════════════════════════════════════════════════════════
-- 016_clients
-- ════════════════════════════════════════════════════════════
-- ============================================================
-- 016_clients_invoicing.sql
-- XavvySuite — Clients, Invoicing, session timeout, statutory
-- Run: wrangler d1 execute xavvysuite-fresh-db --local --file=schema/016_clients_invoicing.sql
-- ============================================================

-- ── Clients ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id                    TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id             TEXT NOT NULL REFERENCES tenants(id),
  company_name          TEXT NOT NULL,
  trading_name          TEXT,
  industry              TEXT,
  website               TEXT,
  logo_r2_key           TEXT,
  reg_address_line1     TEXT,
  reg_address_line2     TEXT,
  reg_city              TEXT,
  reg_county            TEXT,
  reg_postcode          TEXT,
  reg_country           TEXT DEFAULT 'United Kingdom',
  company_reg_number    TEXT,
  vat_number            TEXT,
  tax_reference         TEXT,
  payment_terms_days    INTEGER NOT NULL DEFAULT 30,
  currency_code         TEXT NOT NULL DEFAULT 'GBP',
  invoice_email         TEXT,
  invoice_cc            TEXT,
  notes                 TEXT,
  is_active             INTEGER NOT NULL DEFAULT 1,
  created_by            TEXT REFERENCES users(id),
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_clients_tenant ON clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clients_active  ON clients(tenant_id, is_active);

-- ── Client contacts ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_contacts (
  id                   TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id            TEXT NOT NULL REFERENCES tenants(id),
  client_id            TEXT NOT NULL REFERENCES clients(id),
  full_name            TEXT NOT NULL,
  job_title            TEXT,
  email                TEXT,
  phone                TEXT,
  whatsapp             TEXT,
  contact_type         TEXT NOT NULL DEFAULT 'liaison'
                         CHECK(contact_type IN ('liaison','finance','technical','executive','other')),
  is_primary_liaison   INTEGER NOT NULL DEFAULT 0,
  is_primary_finance   INTEGER NOT NULL DEFAULT 0,
  notes                TEXT,
  created_at           TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_client_contacts_client ON client_contacts(client_id);
CREATE INDEX IF NOT EXISTS idx_client_contacts_tenant ON client_contacts(tenant_id);

-- ── Link projects to clients (pmo_projects already exists) ───
ALTER TABLE pmo_projects ADD COLUMN client_id TEXT REFERENCES clients(id);
CREATE INDEX IF NOT EXISTS idx_pmo_projects_client ON pmo_projects(client_id);

-- ── Invoices ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id                   TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id            TEXT NOT NULL REFERENCES tenants(id),
  client_id            TEXT NOT NULL REFERENCES clients(id),
  invoice_number       TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'draft'
                         CHECK(status IN ('draft','sent','viewed','paid','overdue','void')),
  issue_date           TEXT NOT NULL,
  due_date             TEXT NOT NULL,
  subtotal             REAL NOT NULL DEFAULT 0,
  tax_rate             REAL NOT NULL DEFAULT 20,
  tax_amount           REAL NOT NULL DEFAULT 0,
  total                REAL NOT NULL DEFAULT 0,
  currency_code        TEXT NOT NULL DEFAULT 'GBP',
  notes_to_client      TEXT,
  internal_notes       TEXT,
  sent_at              TEXT,
  paid_at              TEXT,
  created_by           TEXT REFERENCES users(id),
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, invoice_number)
);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(tenant_id, status);

-- ── Invoice line items ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_line_items (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  invoice_id    TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  description   TEXT NOT NULL,
  quantity      REAL NOT NULL DEFAULT 1,
  unit_price    REAL NOT NULL DEFAULT 0,
  amount        REAL NOT NULL DEFAULT 0,
  from_date     TEXT,
  to_date       TEXT,
  timesheet_ids TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_line_items(invoice_id);

-- ── Invoice events ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_events (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  invoice_id   TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  tenant_id    TEXT NOT NULL REFERENCES tenants(id),
  event_type   TEXT NOT NULL
                 CHECK(event_type IN ('created','edited','sent','viewed','paid','voided','note_added','overdue_flagged')),
  actor_id     TEXT REFERENCES users(id),
  actor_name   TEXT,
  note         TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_invoice_events_invoice ON invoice_events(invoice_id);

-- ── Invoice number sequence ───────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_sequences (
  tenant_id  TEXT PRIMARY KEY REFERENCES tenants(id),
  year       INTEGER NOT NULL,
  last_seq   INTEGER NOT NULL DEFAULT 0
);

-- ── Statutory + session settings ─────────────────────────────
-- tenant_settings is a key-value table (key, value) so we INSERT rows.
-- INSERT OR IGNORE means re-running this file is safe.
INSERT OR IGNORE INTO tenant_settings (id, tenant_id, key, value) SELECT lower(hex(randomblob(16))), id, 'company_reg_number',      '' FROM tenants;
INSERT OR IGNORE INTO tenant_settings (id, tenant_id, key, value) SELECT lower(hex(randomblob(16))), id, 'vat_number',              '' FROM tenants;
INSERT OR IGNORE INTO tenant_settings (id, tenant_id, key, value) SELECT lower(hex(randomblob(16))), id, 'tax_reference',           '' FROM tenants;
INSERT OR IGNORE INTO tenant_settings (id, tenant_id, key, value) SELECT lower(hex(randomblob(16))), id, 'reg_address_line1',       '' FROM tenants;
INSERT OR IGNORE INTO tenant_settings (id, tenant_id, key, value) SELECT lower(hex(randomblob(16))), id, 'reg_address_line2',       '' FROM tenants;
INSERT OR IGNORE INTO tenant_settings (id, tenant_id, key, value) SELECT lower(hex(randomblob(16))), id, 'reg_city',                '' FROM tenants;
INSERT OR IGNORE INTO tenant_settings (id, tenant_id, key, value) SELECT lower(hex(randomblob(16))), id, 'reg_county',              '' FROM tenants;
INSERT OR IGNORE INTO tenant_settings (id, tenant_id, key, value) SELECT lower(hex(randomblob(16))), id, 'reg_postcode',            '' FROM tenants;
INSERT OR IGNORE INTO tenant_settings (id, tenant_id, key, value) SELECT lower(hex(randomblob(16))), id, 'reg_country',             'United Kingdom' FROM tenants;
INSERT OR IGNORE INTO tenant_settings (id, tenant_id, key, value) SELECT lower(hex(randomblob(16))), id, 'default_currency',        'GBP' FROM tenants;
INSERT OR IGNORE INTO tenant_settings (id, tenant_id, key, value) SELECT lower(hex(randomblob(16))), id, 'default_tax_rate',        '20' FROM tenants;
INSERT OR IGNORE INTO tenant_settings (id, tenant_id, key, value) SELECT lower(hex(randomblob(16))), id, 'payment_terms_days',      '30' FROM tenants;
INSERT OR IGNORE INTO tenant_settings (id, tenant_id, key, value) SELECT lower(hex(randomblob(16))), id, 'bank_name',               '' FROM tenants;
INSERT OR IGNORE INTO tenant_settings (id, tenant_id, key, value) SELECT lower(hex(randomblob(16))), id, 'bank_account_name',       '' FROM tenants;
INSERT OR IGNORE INTO tenant_settings (id, tenant_id, key, value) SELECT lower(hex(randomblob(16))), id, 'bank_account_number',     '' FROM tenants;
INSERT OR IGNORE INTO tenant_settings (id, tenant_id, key, value) SELECT lower(hex(randomblob(16))), id, 'bank_sort_code',          '' FROM tenants;
INSERT OR IGNORE INTO tenant_settings (id, tenant_id, key, value) SELECT lower(hex(randomblob(16))), id, 'bank_iban',               '' FROM tenants;
INSERT OR IGNORE INTO tenant_settings (id, tenant_id, key, value) SELECT lower(hex(randomblob(16))), id, 'bank_bic',                '' FROM tenants;
INSERT OR IGNORE INTO tenant_settings (id, tenant_id, key, value) SELECT lower(hex(randomblob(16))), id, 'session_timeout_minutes', '60' FROM tenants;


-- ════════════════════════════════════════════════════════════
-- 016_indexes
-- ════════════════════════════════════════════════════════════
-- Add to a new migration: 016_performance_indexes.sql 
-- Estimated query speedup: 5–20× on high-traffic endpoints 

CREATE INDEX IF NOT EXISTS idx_timesheets_emp_week ON timesheets(tenant_id, employee_id, week_starting, status); 

-- Fixes: timesheet reporting, resource capacity, auto-CRON lookup 
CREATE INDEX IF NOT EXISTS idx_timesheet_entries_ts ON timesheet_entries(timesheet_id, hours_worked); 

-- Fixes: all SUM(hours_worked) aggregates, utilisation reports 
CREATE INDEX IF NOT EXISTS idx_leave_requests_emp_status ON leave_requests(tenant_id, employee_id, status, start_date, end_date); 

-- Fixes: leave calendar, leave balance calculation, dashboard pending count 
CREATE INDEX IF NOT EXISTS idx_employee_history_current ON employee_history(tenant_id, is_current, employee_id); 

-- Fixes: every query that JOINs employee_history with is_current=1 (dozens of routes) 
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_time ON audit_log(tenant_id, created_at DESC); 

-- Fixes: dashboard recent activity, audit log paging 
CREATE INDEX IF NOT EXISTS idx_leave_balances_emp_year ON leave_balances(tenant_id, employee_id, year, leave_type_id); 

-- Fixes: leave balance fetch on HR profile + initialise queries


-- ════════════════════════════════════════════════════════════
-- 016b_rbac
-- ════════════════════════════════════════════════════════════
-- ============================================================
-- 016b_rbac_permissions.sql
-- New permissions: Clients + Invoicing modules
-- Safe to re-run (INSERT OR IGNORE throughout)
-- ============================================================

-- ── 1. Insert the new permission rows ────────────────────────
INSERT OR IGNORE INTO permissions (id, module_key, action, resource, description) VALUES
  ('perm-clients-01', 'clients',   'view',   'client',  'View clients'),
  ('perm-clients-02', 'clients',   'create', 'client',  'Create clients'),
  ('perm-clients-03', 'clients',   'edit',   'client',  'Edit clients'),
  ('perm-clients-04', 'clients',   'delete', 'client',  'Deactivate clients'),
  ('perm-inv-01',     'invoicing', 'view',   'invoice', 'View invoices'),
  ('perm-inv-02',     'invoicing', 'create', 'invoice', 'Create invoices'),
  ('perm-inv-03',     'invoicing', 'edit',   'invoice', 'Edit draft invoices'),
  ('perm-inv-04',     'invoicing', 'send',   'invoice', 'Send invoices to clients'),
  ('perm-inv-05',     'invoicing', 'void',   'invoice', 'Void invoices');

-- ── 2. Grant to roles ─────────────────────────────────────────
-- super_admin / hr-admin: all clients + invoicing permissions
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT 'role-hr-admin', id FROM permissions
  WHERE module_key IN ('clients', 'invoicing');

-- manager: view + create + edit clients; view + create + edit + send invoices
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT 'role-manager', id FROM permissions
  WHERE (module_key = 'clients'   AND action IN ('view','create','edit'))
     OR (module_key = 'invoicing' AND action IN ('view','create','edit','send'));

-- finance: view clients; view + send invoices (mark paid handled server-side by send perm)
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT 'role-finance', id FROM permissions
  WHERE (module_key = 'clients'   AND action = 'view')
     OR (module_key = 'invoicing' AND action IN ('view','send'));


-- ════════════════════════════════════════════════════════════
-- 017_ts_task
-- ════════════════════════════════════════════════════════════
-- 017_timesheet_entry_task.sql
-- Add project_id + task_id to individual timesheet entries
-- so each daily row can log time against a specific task

ALTER TABLE timesheet_entries ADD COLUMN project_id TEXT REFERENCES pmo_projects(id);
ALTER TABLE timesheet_entries ADD COLUMN task_id    TEXT REFERENCES pmo_tasks(id);
CREATE INDEX IF NOT EXISTS idx_te_project ON timesheet_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_te_task    ON timesheet_entries(task_id);


-- ════════════════════════════════════════════════════════════
-- 018_pmo
-- ════════════════════════════════════════════════════════════
-- ============================================================
-- 018_pmo_client_resources.sql  (v3 — collision-safe)
-- ============================================================

-- ── Schema additions (safe to run even if partially run before) ─
-- D1 will error if column exists — that's OK, it means it ran before
-- Run each ALTER separately via --command if needed

ALTER TABLE pmo_projects ADD COLUMN description  TEXT;
ALTER TABLE pmo_projects ADD COLUMN colour       TEXT DEFAULT '#6366F1';
ALTER TABLE pmo_projects ADD COLUMN project_type TEXT DEFAULT 'general'
  CHECK(project_type IN ('iot','data_migration','platform','support','training','general'));
ALTER TABLE pmo_allocations ADD COLUMN hours_per_week REAL DEFAULT 17.5;
ALTER TABLE pmo_allocations ADD COLUMN notes          TEXT;

-- ── Update existing IoT project ───────────────────────────────
UPDATE pmo_projects
SET project_type = 'iot', colour = '#0EA5E9',
    description  = 'SEWIO warehouse tracking — real-time asset location, sensor telemetry and analytics dashboards.'
WHERE name LIKE '%SEWIO%' OR name LIKE '%IoT%';

-- ════════════════════════════════════════════════════════════════
-- PROJECTS — INSERT...SELECT avoids subquery-in-VALUES issue
-- Sprint numbers start at 100+ to avoid UNIQUE(tenant_id,sprint_number) collision
-- Employee IDs use known seeded values from 003_iot_project.sql
-- ════════════════════════════════════════════════════════════════

-- ── Data Analysis & Migration ─────────────────────────────────
INSERT OR IGNORE INTO pmo_projects (id, tenant_id, name, description, project_type, colour, start_date, end_date, budget, priority, status, created_at)
SELECT 'proj-data-001', id, 'Data Analysis & Migration — Retail Client',
  'Legacy ERP to cloud data warehouse. Data profiling, ETL build, validation, Power BI dashboards and hypercare.',
  'data_migration', '#8B5CF6', '2026-02-01', '2026-10-31', 95000, 'high', 'active', datetime('now')
FROM tenants LIMIT 1;

INSERT OR IGNORE INTO pmo_sprints (id, tenant_id, project_id, sprint_number, sprint_name, status, start_date, end_date)
SELECT 'spr-dm-01', id, 'proj-data-001', 101, 'Data Profiling & Discovery', 'completed', '2026-02-01', '2026-03-15' FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_sprints (id, tenant_id, project_id, sprint_number, sprint_name, status, start_date, end_date)
SELECT 'spr-dm-02', id, 'proj-data-001', 102, 'ETL Design & Build', 'active', '2026-03-16', '2026-05-31' FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_sprints (id, tenant_id, project_id, sprint_number, sprint_name, status, start_date, end_date)
SELECT 'spr-dm-03', id, 'proj-data-001', 103, 'Validation & Dashboards', 'upcoming', '2026-06-01', '2026-09-30' FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_sprints (id, tenant_id, project_id, sprint_number, sprint_name, status, start_date, end_date)
SELECT 'spr-dm-04', id, 'proj-data-001', 104, 'Go-Live & Hypercare', 'upcoming', '2026-10-01', '2026-10-31' FROM tenants LIMIT 1;

INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, task_order, created_at, updated_at)
SELECT 'tsk-dm-001', id, 'proj-data-001', 'spr-dm-01', 'Source system inventory', 'Catalogue all source tables, owners, row counts and quality issues', 'emp-priya-001', 'high', 'done', 16, '2026-02-14', 'Discovery', 'Analysis', 1, datetime('now'), datetime('now') FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, task_order, created_at, updated_at)
SELECT 'tsk-dm-002', id, 'proj-data-001', 'spr-dm-01', 'Data profiling report', 'Nulls, dupes, formats, outliers on all source tables', 'emp-zeba-001', 'high', 'done', 24, '2026-02-28', 'Discovery', 'Analysis', 2, datetime('now'), datetime('now') FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, task_order, created_at, updated_at)
SELECT 'tsk-dm-003', id, 'proj-data-001', 'spr-dm-01', 'Source-to-target mapping', 'Map source fields to warehouse schema, flag transformations', 'emp-priya-001', 'high', 'done', 20, '2026-03-10', 'Discovery', 'Design', 3, datetime('now'), datetime('now') FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, task_order, created_at, updated_at)
SELECT 'tsk-dm-004', id, 'proj-data-001', 'spr-dm-02', 'Bronze layer pipelines', 'Raw ingestion pipelines from all sources into landing zone', 'emp-priya-001', 'critical', 'in_progress', 40, '2026-04-30', 'ETL Build', 'Engineering', 1, datetime('now'), datetime('now') FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, task_order, created_at, updated_at)
SELECT 'tsk-dm-005', id, 'proj-data-001', 'spr-dm-02', 'Silver layer transformations', 'Cleanse, deduplicate and conform data', 'emp-zeba-001', 'critical', 'in_progress', 48, '2026-05-15', 'ETL Build', 'Engineering', 2, datetime('now'), datetime('now') FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, task_order, created_at, updated_at)
SELECT 'tsk-dm-006', id, 'proj-data-001', 'spr-dm-02', 'Gold layer aggregates', 'Business-ready facts and dimensions', 'emp-priya-001', 'high', 'todo', 32, '2026-05-25', 'ETL Build', 'Engineering', 3, datetime('now'), datetime('now') FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, task_order, created_at, updated_at)
SELECT 'tsk-dm-007', id, 'proj-data-001', 'spr-dm-03', 'Reconciliation testing', 'Row count, sum and sample checks vs source', 'emp-zeba-001', 'high', 'backlog', 32, '2026-07-31', 'Validation', 'QA', 1, datetime('now'), datetime('now') FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, task_order, created_at, updated_at)
SELECT 'tsk-dm-008', id, 'proj-data-001', 'spr-dm-03', 'Power BI dashboards', 'Sales, inventory and operational dashboards', 'emp-priya-001', 'high', 'backlog', 40, '2026-09-15', 'Dashboards', 'Analytics', 2, datetime('now'), datetime('now') FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, task_order, created_at, updated_at)
SELECT 'tsk-dm-009', id, 'proj-data-001', 'spr-dm-04', 'Go-live cutover', 'Final data load, validation and production switchover', 'emp-zeba-001', 'critical', 'backlog', 16, '2026-10-10', 'Go-Live', 'Engineering', 1, datetime('now'), datetime('now') FROM tenants LIMIT 1;

-- ── Xavvy Platform ────────────────────────────────────────────
INSERT OR IGNORE INTO pmo_projects (id, tenant_id, name, description, project_type, colour, start_date, end_date, budget, priority, status, created_at)
SELECT 'proj-xavvy-001', id, 'Xavvy Platform — v2.0',
  'Internal SaaS workforce platform — invoicing, client management, PMO, permissions and mobile UI.',
  'platform', '#10B981', '2026-01-01', '2026-12-31', 0, 'critical', 'active', datetime('now')
FROM tenants LIMIT 1;

INSERT OR IGNORE INTO pmo_sprints (id, tenant_id, project_id, sprint_number, sprint_name, status, start_date, end_date)
SELECT 'spr-xv-01', id, 'proj-xavvy-001', 201, 'Core Architecture & Auth', 'completed', '2026-01-01', '2026-02-28' FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_sprints (id, tenant_id, project_id, sprint_number, sprint_name, status, start_date, end_date)
SELECT 'spr-xv-02', id, 'proj-xavvy-001', 202, 'HR & Leave Modules', 'completed', '2026-03-01', '2026-04-30' FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_sprints (id, tenant_id, project_id, sprint_number, sprint_name, status, start_date, end_date)
SELECT 'spr-xv-03', id, 'proj-xavvy-001', 203, 'PMO, Timesheets & Invoicing', 'active', '2026-05-01', '2026-07-31' FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_sprints (id, tenant_id, project_id, sprint_number, sprint_name, status, start_date, end_date)
SELECT 'spr-xv-04', id, 'proj-xavvy-001', 204, 'Permissions & Settings', 'upcoming', '2026-08-01', '2026-09-30' FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_sprints (id, tenant_id, project_id, sprint_number, sprint_name, status, start_date, end_date)
SELECT 'spr-xv-05', id, 'proj-xavvy-001', 205, 'Mobile UI & Release', 'upcoming', '2026-10-01', '2026-12-31' FROM tenants LIMIT 1;

INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, task_order, created_at, updated_at)
SELECT 'tsk-xv-001', id, 'proj-xavvy-001', 'spr-xv-03', 'Client module', 'Full client CRUD with statutory fields and contacts', 'emp-nanjusha-001', 'critical', 'done', 32, '2026-05-20', 'PMO', 'Engineering', 1, datetime('now'), datetime('now') FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, task_order, created_at, updated_at)
SELECT 'tsk-xv-002', id, 'proj-xavvy-001', 'spr-xv-03', 'Invoicing module', 'Create/edit/send/void invoices, pull timesheets, HTML email', 'emp-swathi-001', 'critical', 'in_progress', 48, '2026-06-30', 'Invoicing', 'Engineering', 2, datetime('now'), datetime('now') FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, task_order, created_at, updated_at)
SELECT 'tsk-xv-003', id, 'proj-xavvy-001', 'spr-xv-03', 'PMO client segregation & templates', '3-step project wizard, DB-backed templates, resource utilisation', 'emp-swathi-001', 'high', 'in_progress', 40, '2026-07-15', 'PMO', 'Engineering', 3, datetime('now'), datetime('now') FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, task_order, created_at, updated_at)
SELECT 'tsk-xv-004', id, 'proj-xavvy-001', 'spr-xv-03', 'Timesheet project+task entry', 'Per-row project/task selection in weekly timesheet grid', 'emp-zeba-001', 'high', 'done', 16, '2026-06-14', 'Timesheets', 'Engineering', 4, datetime('now'), datetime('now') FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, task_order, created_at, updated_at)
SELECT 'tsk-xv-005', id, 'proj-xavvy-001', 'spr-xv-04', 'Permissions audit & seed', 'All modules — permission constants, role assignments, plan gating', 'emp-nanjusha-001', 'critical', 'todo', 20, '2026-08-31', 'Permissions', 'Engineering', 1, datetime('now'), datetime('now') FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, task_order, created_at, updated_at)
SELECT 'tsk-xv-006', id, 'proj-xavvy-001', 'spr-xv-05', 'Mobile-first UI audit', 'Audit all screens for mobile breakpoints and touch targets', 'emp-swathi-001', 'high', 'backlog', 32, '2026-11-30', 'UI', 'Design', 1, datetime('now'), datetime('now') FROM tenants LIMIT 1;

-- ── Support Retainer ──────────────────────────────────────────
INSERT OR IGNORE INTO pmo_projects (id, tenant_id, name, description, project_type, colour, start_date, end_date, budget, priority, status, created_at)
SELECT 'proj-supp-001', id, 'Support Retainer — Multi-client',
  'Rolling monthly support — L1/L2 incidents, monitoring, bug fixes, minor enhancements and SLA reporting.',
  'support', '#F59E0B', '2026-01-01', '2026-12-31', 48000, 'high', 'active', datetime('now')
FROM tenants LIMIT 1;

INSERT OR IGNORE INTO pmo_sprints (id, tenant_id, project_id, sprint_number, sprint_name, status, start_date, end_date)
SELECT 'spr-sp-01', id, 'proj-supp-001', 301, 'Q1 Support (Jan–Mar)', 'completed', '2026-01-01', '2026-03-31' FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_sprints (id, tenant_id, project_id, sprint_number, sprint_name, status, start_date, end_date)
SELECT 'spr-sp-02', id, 'proj-supp-001', 302, 'Q2 Support (Apr–Jun)', 'active', '2026-04-01', '2026-06-30' FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_sprints (id, tenant_id, project_id, sprint_number, sprint_name, status, start_date, end_date)
SELECT 'spr-sp-03', id, 'proj-supp-001', 303, 'Q3 Support (Jul–Sep)', 'upcoming', '2026-07-01', '2026-09-30' FROM tenants LIMIT 1;

INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, task_order, created_at, updated_at)
SELECT 'tsk-sp-001', id, 'proj-supp-001', 'spr-sp-01', 'Q1 incident response', '9 incidents, 3 P1s resolved within SLA', 'emp-nanjusha-001', 'high', 'done', 18, '2026-01-31', 'Q1', 'Support', 1, datetime('now'), datetime('now') FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, task_order, created_at, updated_at)
SELECT 'tsk-sp-002', id, 'proj-supp-001', 'spr-sp-01', 'Monitoring setup', 'Grafana dashboard, PagerDuty alerts, weekly uptime reports', 'emp-swathi-001', 'medium', 'done', 24, '2026-02-28', 'Q1', 'DevOps', 2, datetime('now'), datetime('now') FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, task_order, created_at, updated_at)
SELECT 'tsk-sp-003', id, 'proj-supp-001', 'spr-sp-02', 'Q2 incident management', 'Ongoing L1/L2 incident management and resolution', 'emp-nanjusha-001', 'high', 'in_progress', 40, '2026-05-31', 'Q2', 'Support', 1, datetime('now'), datetime('now') FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, task_order, created_at, updated_at)
SELECT 'tsk-sp-004', id, 'proj-supp-001', 'spr-sp-02', 'Performance tuning', 'Query optimisation and index review', 'emp-swathi-001', 'high', 'todo', 16, '2026-06-20', 'Q2', 'Engineering', 2, datetime('now'), datetime('now') FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, task_order, created_at, updated_at)
SELECT 'tsk-sp-005', id, 'proj-supp-001', 'spr-sp-03', 'Q3 support delivery', 'Ongoing incidents, monitoring and enhancements', 'emp-nanjusha-001', 'high', 'backlog', 120, '2026-09-30', 'Q3', 'Support', 1, datetime('now'), datetime('now') FROM tenants LIMIT 1;

-- ── Team Upskilling ───────────────────────────────────────────
INSERT OR IGNORE INTO pmo_projects (id, tenant_id, name, description, project_type, colour, start_date, end_date, budget, priority, status, created_at)
SELECT 'proj-train-001', id, 'Team Upskilling Programme 2026',
  'Cloud certifications, data engineering, project management and soft skills through courses and workshops.',
  'training', '#EC4899', '2026-01-01', '2026-12-31', 18000, 'medium', 'active', datetime('now')
FROM tenants LIMIT 1;

INSERT OR IGNORE INTO pmo_sprints (id, tenant_id, project_id, sprint_number, sprint_name, status, start_date, end_date)
SELECT 'spr-tr-01', id, 'proj-train-001', 401, 'H1 Learning (Jan–Jun)', 'active', '2026-01-01', '2026-06-30' FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_sprints (id, tenant_id, project_id, sprint_number, sprint_name, status, start_date, end_date)
SELECT 'spr-tr-02', id, 'proj-train-001', 402, 'H2 Learning (Jul–Dec)', 'upcoming', '2026-07-01', '2026-12-31' FROM tenants LIMIT 1;

INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, task_order, created_at, updated_at)
SELECT 'tsk-tr-001', id, 'proj-train-001', 'spr-tr-01', 'AWS Solutions Architect — Nanjusha', 'SAA-C03: study, practice exams, sit exam', 'emp-nanjusha-001', 'high', 'in_progress', 40, '2026-06-30', 'Certifications', 'Cloud', 1, datetime('now'), datetime('now') FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, task_order, created_at, updated_at)
SELECT 'tsk-tr-002', id, 'proj-train-001', 'spr-tr-01', 'dbt Core training — Priya', 'dbt Learn fundamentals + advanced, internal dbt project', 'emp-priya-001', 'high', 'in_progress', 24, '2026-05-31', 'Data Engineering', 'Analytics', 2, datetime('now'), datetime('now') FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, task_order, created_at, updated_at)
SELECT 'tsk-tr-003', id, 'proj-train-001', 'spr-tr-01', 'PostgreSQL advanced — Zeba', 'Window functions, CTEs, partitioning, performance tuning', 'emp-zeba-001', 'medium', 'done', 16, '2026-04-30', 'Database', 'Engineering', 3, datetime('now'), datetime('now') FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, task_order, created_at, updated_at)
SELECT 'tsk-tr-004', id, 'proj-train-001', 'spr-tr-01', 'React + TypeScript — Swathi', 'Scrimba React course and internal component library', 'emp-swathi-001', 'medium', 'done', 32, '2026-05-15', 'Frontend', 'Engineering', 4, datetime('now'), datetime('now') FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, task_order, created_at, updated_at)
SELECT 'tsk-tr-005', id, 'proj-train-001', 'spr-tr-01', 'PMP exam prep — Nanjusha', 'PMBOK study, mock exams, application submission', 'emp-nanjusha-001', 'medium', 'todo', 60, '2026-06-30', 'Certifications', 'Management', 5, datetime('now'), datetime('now') FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, task_order, created_at, updated_at)
SELECT 'tsk-tr-006', id, 'proj-train-001', 'spr-tr-02', 'Azure Data Engineer — Priya', 'DP-203: Synapse, Data Factory, Databricks', 'emp-priya-001', 'high', 'backlog', 48, '2026-10-31', 'Certifications', 'Cloud', 1, datetime('now'), datetime('now') FROM tenants LIMIT 1;

-- ── Allocations — use known employee IDs from 003_iot_project.sql ─
-- Data Migration: Priya + Zeba
INSERT OR IGNORE INTO pmo_allocations (id, tenant_id, project_id, employee_id, role, allocation, hours_per_week, start_date, end_date)
VALUES ('alloc-dm-priya', 'xavvy-tenant-001', 'proj-data-001', 'emp-priya-001', 'BI & Analytics Lead', 50, 17.5, '2026-02-01', '2026-10-31');
INSERT OR IGNORE INTO pmo_allocations (id, tenant_id, project_id, employee_id, role, allocation, hours_per_week, start_date, end_date)
VALUES ('alloc-dm-zeba',  'xavvy-tenant-001', 'proj-data-001', 'emp-zeba-001',  'Database Engineer',   50, 17.5, '2026-02-01', '2026-10-31');

-- Xavvy Platform: all 4
INSERT OR IGNORE INTO pmo_allocations (id, tenant_id, project_id, employee_id, role, allocation, hours_per_week, start_date, end_date)
VALUES ('alloc-xv-nanjusha', 'xavvy-tenant-001', 'proj-xavvy-001', 'emp-nanjusha-001', 'Product Owner & PM',   50, 17.5, '2026-01-01', '2026-12-31');
INSERT OR IGNORE INTO pmo_allocations (id, tenant_id, project_id, employee_id, role, allocation, hours_per_week, start_date, end_date)
VALUES ('alloc-xv-priya',    'xavvy-tenant-001', 'proj-xavvy-001', 'emp-priya-001',    'Full Stack Developer', 50, 17.5, '2026-01-01', '2026-12-31');
INSERT OR IGNORE INTO pmo_allocations (id, tenant_id, project_id, employee_id, role, allocation, hours_per_week, start_date, end_date)
VALUES ('alloc-xv-swathi',   'xavvy-tenant-001', 'proj-xavvy-001', 'emp-swathi-001',   'Full Stack Developer', 50, 17.5, '2026-01-01', '2026-12-31');
INSERT OR IGNORE INTO pmo_allocations (id, tenant_id, project_id, employee_id, role, allocation, hours_per_week, start_date, end_date)
VALUES ('alloc-xv-zeba',     'xavvy-tenant-001', 'proj-xavvy-001', 'emp-zeba-001',     'Database Engineer',    50, 17.5, '2026-01-01', '2026-12-31');

-- Support: Nanjusha + Swathi
INSERT OR IGNORE INTO pmo_allocations (id, tenant_id, project_id, employee_id, role, allocation, hours_per_week, start_date, end_date)
VALUES ('alloc-sp-nanjusha', 'xavvy-tenant-001', 'proj-supp-001', 'emp-nanjusha-001', 'Support Lead',    25, 8.75, '2026-01-01', '2026-12-31');
INSERT OR IGNORE INTO pmo_allocations (id, tenant_id, project_id, employee_id, role, allocation, hours_per_week, start_date, end_date)
VALUES ('alloc-sp-swathi',   'xavvy-tenant-001', 'proj-supp-001', 'emp-swathi-001',   'Support Engineer', 25, 8.75, '2026-01-01', '2026-12-31');

-- ── Plan features ─────────────────────────────────────────────
UPDATE plan_limits
SET features = replace(features, '"]', '","clients","invoicing"]')
WHERE plan IN ('professional','enterprise') AND features NOT LIKE '%invoicing%';


-- ════════════════════════════════════════════════════════════
-- 019_templates
-- ════════════════════════════════════════════════════════════
-- ============================================================
-- 019_project_templates.sql
-- Project template tables + seed data for 5 project types
-- Run: wrangler d1 execute xavvysuite-fresh-db --local --file=schema/019_project_templates.sql
-- ============================================================

-- ── Tables ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_templates (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id    TEXT REFERENCES tenants(id),  -- NULL = global system template
  name         TEXT NOT NULL,
  project_type TEXT NOT NULL DEFAULT 'general'
    CHECK(project_type IN ('iot','data_migration','platform','support','training','general')),
  description  TEXT,
  is_system    INTEGER NOT NULL DEFAULT 0,   -- 1 = built-in, cannot be deleted
  is_active    INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_proj_tmpl_type   ON project_templates(project_type);
CREATE INDEX IF NOT EXISTS idx_proj_tmpl_active ON project_templates(is_active);

CREATE TABLE IF NOT EXISTS project_template_phases (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  template_id  TEXT NOT NULL REFERENCES project_templates(id) ON DELETE CASCADE,
  phase_name   TEXT NOT NULL,
  phase_order  INTEGER NOT NULL DEFAULT 0,
  duration_pct REAL NOT NULL DEFAULT 20   -- % of total project duration this phase covers
);
CREATE INDEX IF NOT EXISTS idx_tmpl_phase_tmpl ON project_template_phases(template_id);

CREATE TABLE IF NOT EXISTS project_template_tasks (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  phase_id        TEXT NOT NULL REFERENCES project_template_phases(id) ON DELETE CASCADE,
  template_id     TEXT NOT NULL REFERENCES project_templates(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  priority        TEXT NOT NULL DEFAULT 'medium'
    CHECK(priority IN ('low','medium','high','critical')),
  estimated_hours REAL NOT NULL DEFAULT 8,
  category        TEXT,
  task_order      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_tmpl_task_phase ON project_template_tasks(phase_id);
CREATE INDEX IF NOT EXISTS idx_tmpl_task_tmpl  ON project_template_tasks(template_id);

-- ════════════════════════════════════════════════════════════════
-- SEED: IoT / RTLS Deployment
-- ════════════════════════════════════════════════════════════════
INSERT OR IGNORE INTO project_templates (id, name, project_type, description, is_system) VALUES
('tmpl-iot-001', 'IoT / RTLS Deployment', 'iot',
 'Full IoT/RTLS platform deployment from site survey through hardware installation, system integration, dashboard delivery and go-live hypercare.',
 1);

INSERT OR IGNORE INTO project_template_phases (id, template_id, phase_name, phase_order, duration_pct) VALUES
('ph-iot-01','tmpl-iot-001','Discovery & Requirements',  1, 12),
('ph-iot-02','tmpl-iot-001','System Design & Architecture', 2, 12),
('ph-iot-03','tmpl-iot-001','Core Infrastructure',       3, 20),
('ph-iot-04','tmpl-iot-001','Integration & APIs',        4, 18),
('ph-iot-05','tmpl-iot-001','Frontend & Dashboards',     5, 22),
('ph-iot-06','tmpl-iot-001','Testing, UAT & Go-Live',    6, 16);

INSERT OR IGNORE INTO project_template_tasks (id, phase_id, template_id, name, description, priority, estimated_hours, category, task_order) VALUES
-- Phase 1
('tt-iot-01','ph-iot-01','tmpl-iot-001','Stakeholder interviews','Interview facility managers, warehouse ops and IT leads to capture requirements','high',16,'Analysis',1),
('tt-iot-02','ph-iot-01','tmpl-iot-001','Site survey & hardware audit','Survey physical environment, network infrastructure and anchor placement options','high',24,'Analysis',2),
('tt-iot-03','ph-iot-01','tmpl-iot-001','Requirements specification','Document functional and non-functional requirements, KPIs and acceptance criteria','high',20,'Documentation',3),
('tt-iot-04','ph-iot-01','tmpl-iot-001','Technology selection sign-off','Compare RTLS vendors, present recommendation and get client sign-off','medium',8,'Design',4),
-- Phase 2
('tt-iot-05','ph-iot-02','tmpl-iot-001','Network topology design','Design WiFi/UWB anchor placement, coverage map and redundancy plan','high',24,'Architecture',1),
('tt-iot-06','ph-iot-02','tmpl-iot-001','Data model design','Design asset, location event and telemetry schemas','high',16,'Architecture',2),
('tt-iot-07','ph-iot-02','tmpl-iot-001','Integration architecture','Design APIs for ERP, WMS and BI tool integrations','high',20,'Architecture',3),
('tt-iot-08','ph-iot-02','tmpl-iot-001','Security & GDPR review','Assess data sensitivity, encryption at rest/transit, access controls','critical',12,'Security',4),
('tt-iot-09','ph-iot-02','tmpl-iot-001','Architecture sign-off','Present to client technical team and get written approval','medium',6,'Documentation',5),
-- Phase 3
('tt-iot-10','ph-iot-03','tmpl-iot-001','Hardware procurement & delivery','Order and take delivery of anchors, tags, gateways and servers','critical',8,'Infrastructure',1),
('tt-iot-11','ph-iot-03','tmpl-iot-001','Network infrastructure installation','Install and configure anchors, access points and cabling','critical',40,'Infrastructure',2),
('tt-iot-12','ph-iot-03','tmpl-iot-001','SEWIO server installation','Install and configure SEWIO RTLS server, license activation','critical',16,'Infrastructure',3),
('tt-iot-13','ph-iot-03','tmpl-iot-001','Tag commissioning','Commission, test and label all asset tags','high',24,'Infrastructure',4),
('tt-iot-14','ph-iot-03','tmpl-iot-001','Core telemetry pipeline','Build location event ingestion, processing and storage pipeline','high',40,'Engineering',5),
('tt-iot-15','ph-iot-03','tmpl-iot-001','Infrastructure acceptance testing','Coverage, accuracy and latency testing against agreed KPIs','high',24,'QA',6),
-- Phase 4
('tt-iot-16','ph-iot-04','tmpl-iot-001','REST API build','Build asset location, history and alert APIs for downstream consumers','high',40,'Engineering',1),
('tt-iot-17','ph-iot-04','tmpl-iot-001','ERP integration','Real-time asset status sync with client ERP system','high',32,'Integration',2),
('tt-iot-18','ph-iot-04','tmpl-iot-001','WMS integration','Bi-directional sync with warehouse management system','high',32,'Integration',3),
('tt-iot-19','ph-iot-04','tmpl-iot-001','Alert & notification engine','Build geofence breach, missing asset and maintenance alerts','medium',24,'Engineering',4),
('tt-iot-20','ph-iot-04','tmpl-iot-001','API documentation','OpenAPI spec, Postman collection, integration guide','medium',12,'Documentation',5),
-- Phase 5
('tt-iot-21','ph-iot-05','tmpl-iot-001','Floor plan visualisation','Interactive 2D floor plan with real-time asset positions','critical',48,'Frontend',1),
('tt-iot-22','ph-iot-05','tmpl-iot-001','Asset tracking dashboard','Asset inventory, location history, search and filter','high',32,'Frontend',2),
('tt-iot-23','ph-iot-05','tmpl-iot-001','Analytics dashboard','Utilisation rates, dwell times, movement heatmaps','high',32,'Analytics',3),
('tt-iot-24','ph-iot-05','tmpl-iot-001','Alert management UI','Alert inbox, rule configuration, notification preferences','medium',20,'Frontend',4),
('tt-iot-25','ph-iot-05','tmpl-iot-001','Mobile companion app','React Native app for warehouse operatives — scan, locate, report','medium',60,'Mobile',5),
-- Phase 6
('tt-iot-26','ph-iot-06','tmpl-iot-001','End-to-end system testing','Full scenario testing across all integrated systems','critical',40,'QA',1),
('tt-iot-27','ph-iot-06','tmpl-iot-001','Performance & load testing','500 concurrent tags, high-frequency event processing','high',24,'QA',2),
('tt-iot-28','ph-iot-06','tmpl-iot-001','UAT facilitation','Support client UAT, track defects, coordinate fixes','critical',32,'UAT',3),
('tt-iot-29','ph-iot-06','tmpl-iot-001','Staff training','Train warehouse staff, supervisors and IT admins','high',16,'Training',4),
('tt-iot-30','ph-iot-06','tmpl-iot-001','Go-live cutover','Production deployment, data migration, cutover execution','critical',16,'Deployment',5),
('tt-iot-31','ph-iot-06','tmpl-iot-001','Post go-live hypercare','30-day hypercare support, issue resolution, optimisation','high',40,'Support',6);

-- ════════════════════════════════════════════════════════════════
-- SEED: Data Analysis & Migration
-- ════════════════════════════════════════════════════════════════
INSERT OR IGNORE INTO project_templates (id, name, project_type, description, is_system) VALUES
('tmpl-dm-001', 'Data Analysis & Migration', 'data_migration',
 'Legacy to cloud-native data warehouse migration covering data profiling, ETL pipeline build, quality validation, reporting dashboards and production cutover.',
 1);

INSERT OR IGNORE INTO project_template_phases (id, template_id, phase_name, phase_order, duration_pct) VALUES
('ph-dm-01','tmpl-dm-001','Discovery & Profiling',   1, 15),
('ph-dm-02','tmpl-dm-001','Architecture & Design',   2, 10),
('ph-dm-03','tmpl-dm-001','ETL Build',                3, 35),
('ph-dm-04','tmpl-dm-001','Validation & Dashboards', 4, 25),
('ph-dm-05','tmpl-dm-001','Go-Live',                  5, 15);

INSERT OR IGNORE INTO project_template_tasks (id, phase_id, template_id, name, description, priority, estimated_hours, category, task_order) VALUES
('tt-dm-01','ph-dm-01','tmpl-dm-001','Source system inventory','Catalogue all source tables, document owners, row counts and PII fields','high',16,'Analysis',1),
('tt-dm-02','ph-dm-01','tmpl-dm-001','Data profiling','Run profiling on all sources — nulls, duplicates, formats, outliers, referential integrity','high',32,'Analysis',2),
('tt-dm-03','ph-dm-01','tmpl-dm-001','Source-to-target mapping','Map source fields to target schema, document transformations and business rules','high',24,'Design',3),
('tt-dm-04','ph-dm-01','tmpl-dm-001','Data quality baseline report','Document current quality issues, severity ratings and remediation plan','medium',12,'Documentation',4),
('tt-dm-05','ph-dm-02','tmpl-dm-001','Target schema design','Design warehouse schema — medallion architecture or dimensional model','high',24,'Architecture',1),
('tt-dm-06','ph-dm-02','tmpl-dm-001','ETL framework selection','Evaluate and select ETL tooling (dbt, ADF, Airbyte etc)','high',8,'Architecture',2),
('tt-dm-07','ph-dm-02','tmpl-dm-001','Migration strategy document','Big bang vs incremental, rollback plan, validation approach','critical',16,'Documentation',3),
('tt-dm-08','ph-dm-02','tmpl-dm-001','Architecture sign-off','Client review and written approval of target architecture','medium',6,'Documentation',4),
('tt-dm-09','ph-dm-03','tmpl-dm-001','Bronze layer ingestion','Build raw extract pipelines from all source systems into landing zone','critical',48,'Engineering',1),
('tt-dm-10','ph-dm-03','tmpl-dm-001','Silver layer transformations','Cleanse, conform, deduplicate and standardise into silver zone','critical',56,'Engineering',2),
('tt-dm-11','ph-dm-03','tmpl-dm-001','Gold layer aggregates','Business-ready facts, dimensions and aggregates for reporting','high',40,'Engineering',3),
('tt-dm-12','ph-dm-03','tmpl-dm-001','Orchestration & scheduling','Pipeline scheduling, dependency management, retry logic and alerting','high',24,'Engineering',4),
('tt-dm-13','ph-dm-03','tmpl-dm-001','Unit test suite','Data transformation unit tests, row count assertions, null checks','high',20,'QA',5),
('tt-dm-14','ph-dm-04','tmpl-dm-001','Reconciliation testing','Row count, sum checks and statistical sampling vs source systems','critical',32,'QA',1),
('tt-dm-15','ph-dm-04','tmpl-dm-001','Data quality dashboard','Real-time DQ monitoring, anomaly detection, completeness scores','high',24,'Analytics',2),
('tt-dm-16','ph-dm-04','tmpl-dm-001','Business reporting dashboards','Deliver agreed Power BI / Looker report set with client sign-off','high',40,'Analytics',3),
('tt-dm-17','ph-dm-04','tmpl-dm-001','UAT support','Facilitate UAT, track defects, deliver fixes within SLA','critical',24,'UAT',4),
('tt-dm-18','ph-dm-05','tmpl-dm-001','Full historical load','Execute full historical data load into production environment','critical',16,'Deployment',1),
('tt-dm-19','ph-dm-05','tmpl-dm-001','Cutover validation','Final reconciliation, stakeholder sign-off, issue log cleared','critical',12,'QA',2),
('tt-dm-20','ph-dm-05','tmpl-dm-001','Handover & documentation','Runbook, data dictionary, pipeline docs and knowledge transfer','high',20,'Documentation',3),
('tt-dm-21','ph-dm-05','tmpl-dm-001','Hypercare support','30-day post-migration monitoring, critical fixes within 4h SLA','high',40,'Support',4);

-- ════════════════════════════════════════════════════════════════
-- SEED: Platform / SaaS Build
-- ════════════════════════════════════════════════════════════════
INSERT OR IGNORE INTO project_templates (id, name, project_type, description, is_system) VALUES
('tmpl-pf-001', 'Platform / SaaS Build', 'platform',
 'End-to-end SaaS product build from architecture and UX design through core engineering, feature modules, security testing and production launch.',
 1);

INSERT OR IGNORE INTO project_template_phases (id, template_id, phase_name, phase_order, duration_pct) VALUES
('ph-pf-01','tmpl-pf-001','Discovery & Architecture', 1, 15),
('ph-pf-02','tmpl-pf-001','Core Platform Build',      2, 30),
('ph-pf-03','tmpl-pf-001','Feature Modules',           3, 35),
('ph-pf-04','tmpl-pf-001','Testing & Launch',          4, 20);

INSERT OR IGNORE INTO project_template_tasks (id, phase_id, template_id, name, description, priority, estimated_hours, category, task_order) VALUES
('tt-pf-01','ph-pf-01','tmpl-pf-001','Product requirements document','Define features, user stories, acceptance criteria and MVP scope','critical',24,'Product',1),
('tt-pf-02','ph-pf-01','tmpl-pf-001','Technical architecture','Tech stack, data model, API design, deployment architecture','critical',32,'Architecture',2),
('tt-pf-03','ph-pf-01','tmpl-pf-001','UX wireframes','Wireframe all key screens, user flows and responsive breakpoints','high',40,'Design',3),
('tt-pf-04','ph-pf-01','tmpl-pf-001','Design system','Component library, colour tokens, typography, spacing system','high',24,'Design',4),
('tt-pf-05','ph-pf-02','tmpl-pf-001','Auth & multi-tenancy','JWT auth, refresh tokens, tenant isolation, RBAC foundation','critical',40,'Engineering',1),
('tt-pf-06','ph-pf-02','tmpl-pf-001','Database schema & migrations','Core schema, indexes, migration framework, seed data','critical',32,'Engineering',2),
('tt-pf-07','ph-pf-02','tmpl-pf-001','API framework','REST API routing, middleware, error handling, response envelopes','critical',24,'Engineering',3),
('tt-pf-08','ph-pf-02','tmpl-pf-001','Frontend shell','App shell, sidebar nav, routing, auth context, theme system','high',32,'Frontend',4),
('tt-pf-09','ph-pf-02','tmpl-pf-001','CI/CD pipeline','Build, test, deploy pipeline with staging and production environments','high',16,'DevOps',5),
('tt-pf-10','ph-pf-03','tmpl-pf-001','Module 1 — Core feature','Build primary feature module end-to-end (API + UI)','critical',48,'Engineering',1),
('tt-pf-11','ph-pf-03','tmpl-pf-001','Module 2 — Secondary feature','Build secondary feature module end-to-end','high',40,'Engineering',2),
('tt-pf-12','ph-pf-03','tmpl-pf-001','Module 3 — Supporting feature','Build supporting feature module end-to-end','high',32,'Engineering',3),
('tt-pf-13','ph-pf-03','tmpl-pf-001','Email & notification system','Transactional email, in-app notifications, preference management','medium',20,'Engineering',4),
('tt-pf-14','ph-pf-03','tmpl-pf-001','Reporting & analytics','Key metrics dashboards, export functions, scheduled reports','medium',24,'Analytics',5),
('tt-pf-15','ph-pf-04','tmpl-pf-001','End-to-end test suite','Playwright/Cypress E2E tests for all critical user journeys','high',32,'QA',1),
('tt-pf-16','ph-pf-04','tmpl-pf-001','Security penetration test','External pen test, fix all critical and high findings','critical',24,'Security',2),
('tt-pf-17','ph-pf-04','tmpl-pf-001','Performance testing','Load testing, database query optimisation, caching strategy','high',20,'QA',3),
('tt-pf-18','ph-pf-04','tmpl-pf-001','Beta programme','Onboard 5 beta users, collect feedback, iterate on UX','high',32,'Product',4),
('tt-pf-19','ph-pf-04','tmpl-pf-001','Production launch','Final deployment, DNS cutover, monitoring setup, launch comms','critical',16,'Deployment',5);

-- ════════════════════════════════════════════════════════════════
-- SEED: Managed Support Retainer
-- ════════════════════════════════════════════════════════════════
INSERT OR IGNORE INTO project_templates (id, name, project_type, description, is_system) VALUES
('tmpl-sp-001', 'Managed Support Retainer', 'support',
 'Rolling managed support retainer with incident management, proactive monitoring, minor enhancements and quarterly service reviews.',
 1);

INSERT OR IGNORE INTO project_template_phases (id, template_id, phase_name, phase_order, duration_pct) VALUES
('ph-sp-01','tmpl-sp-001','Onboarding & Setup',     1, 15),
('ph-sp-02','tmpl-sp-001','Active Support — Q1',    2, 28),
('ph-sp-03','tmpl-sp-001','Active Support — Q2',    3, 28),
('ph-sp-04','tmpl-sp-001','Review & Renewal',       4, 29);

INSERT OR IGNORE INTO project_template_tasks (id, phase_id, template_id, name, description, priority, estimated_hours, category, task_order) VALUES
('tt-sp-01','ph-sp-01','tmpl-sp-001','Service desk configuration','Set up ticketing system, SLA rules, escalation paths and queues','high',16,'Setup',1),
('tt-sp-02','ph-sp-01','tmpl-sp-001','Runbook creation','Document known issues, fix procedures and escalation contacts','high',24,'Documentation',2),
('tt-sp-03','ph-sp-01','tmpl-sp-001','Monitoring & alerting setup','Configure uptime, error rate and performance alerts','critical',20,'DevOps',3),
('tt-sp-04','ph-sp-01','tmpl-sp-001','Knowledge base setup','Build initial KB articles for common L1 issues','medium',16,'Documentation',4),
('tt-sp-05','ph-sp-02','tmpl-sp-001','L1/L2 incident management','Respond to and resolve incidents within agreed SLA targets','high',80,'Support',1),
('tt-sp-06','ph-sp-02','tmpl-sp-001','Weekly status reports','Send weekly ticket volume, SLA achievement and open issue reports','medium',8,'Reporting',2),
('tt-sp-07','ph-sp-02','tmpl-sp-001','Proactive monitoring','Daily system health checks, anomaly investigation','high',20,'DevOps',3),
('tt-sp-08','ph-sp-02','tmpl-sp-001','Q1 service review','Quarterly service review meeting, SLA report, improvement actions','medium',8,'Reporting',4),
('tt-sp-09','ph-sp-03','tmpl-sp-001','L1/L2 incident management','Ongoing incident response and resolution','high',80,'Support',1),
('tt-sp-10','ph-sp-03','tmpl-sp-001','Minor enhancements','Deliver agreed minor change requests within monthly allocation','medium',32,'Engineering',2),
('tt-sp-11','ph-sp-03','tmpl-sp-001','Performance optimisation','Identify and fix performance bottlenecks from monitoring data','medium',20,'Engineering',3),
('tt-sp-12','ph-sp-03','tmpl-sp-001','Q2 service review','Quarterly review, SLA report, roadmap for H2','medium',8,'Reporting',4),
('tt-sp-13','ph-sp-04','tmpl-sp-001','H2 incident management','Ongoing L1/L2 support through Q3 and Q4','high',160,'Support',1),
('tt-sp-14','ph-sp-04','tmpl-sp-001','Annual service review','Full-year review, SLA performance, renewal proposal','high',12,'Reporting',2);

-- ════════════════════════════════════════════════════════════════
-- SEED: Team Upskilling & Training
-- ════════════════════════════════════════════════════════════════
INSERT OR IGNORE INTO project_templates (id, name, project_type, description, is_system) VALUES
('tmpl-tr-001', 'Team Upskilling & Training', 'training',
 'Structured upskilling programme covering cloud certifications, technical skills, professional development and internal knowledge sharing.',
 1);

INSERT OR IGNORE INTO project_template_phases (id, template_id, phase_name, phase_order, duration_pct) VALUES
('ph-tr-01','tmpl-tr-001','Planning & Design',         1, 10),
('ph-tr-02','tmpl-tr-001','Technical Skills',           2, 40),
('ph-tr-03','tmpl-tr-001','Professional Development',  3, 35),
('ph-tr-04','tmpl-tr-001','Knowledge Sharing & Review',4, 15);

INSERT OR IGNORE INTO project_template_tasks (id, phase_id, template_id, name, description, priority, estimated_hours, category, task_order) VALUES
('tt-tr-01','ph-tr-01','tmpl-tr-001','Training needs analysis','Survey team skills gaps, map against role requirements and business goals','high',16,'Analysis',1),
('tt-tr-02','ph-tr-01','tmpl-tr-001','Learning plan design','Design individual learning paths, select courses and certifications','high',12,'Design',2),
('tt-tr-03','ph-tr-01','tmpl-tr-001','Budget allocation','Allocate training budget across team members and course types','medium',4,'Planning',3),
('tt-tr-04','ph-tr-01','tmpl-tr-001','Schedule planning','Block learning time in calendars, coordinate with project commitments','medium',4,'Planning',4),
('tt-tr-05','ph-tr-02','tmpl-tr-001','Cloud certification — Engineer 1','AWS/Azure cert: study, practice exams, sit exam','high',40,'Cloud',1),
('tt-tr-06','ph-tr-02','tmpl-tr-001','Cloud certification — Engineer 2','AWS/Azure cert: study, practice exams, sit exam','high',40,'Cloud',2),
('tt-tr-07','ph-tr-02','tmpl-tr-001','Data engineering deep-dive','dbt, Spark, pipeline design — online course and internal project','high',24,'Data',3),
('tt-tr-08','ph-tr-02','tmpl-tr-001','Security & compliance training','GDPR, ISO27001 awareness, secure coding practices','high',8,'Security',4),
('tt-tr-09','ph-tr-02','tmpl-tr-001','AI/ML practical workshop','Hands-on: prompt engineering, ML basics, AI tooling','medium',8,'AI',5),
('tt-tr-10','ph-tr-03','tmpl-tr-001','Project management certification','PRINCE2/PMP preparation: study guide, practice tests, exam booking','medium',60,'Management',1),
('tt-tr-11','ph-tr-03','tmpl-tr-001','Communication & presenting skills','External workshop: structuring ideas, presenting to stakeholders','medium',8,'Soft Skills',2),
('tt-tr-12','ph-tr-03','tmpl-tr-001','Technical writing','Online course: documentation, runbooks, architecture decision records','low',8,'Soft Skills',3),
('tt-tr-13','ph-tr-04','tmpl-tr-001','Brown-bag sessions x4','Monthly internal tech talks: each engineer presents a topic','medium',12,'Internal',1),
('tt-tr-14','ph-tr-04','tmpl-tr-001','Lessons learned retrospective','End-of-programme retrospective: what worked, ROI, next steps','medium',4,'Internal',2),
('tt-tr-15','ph-tr-04','tmpl-tr-001','Skills matrix update','Update team skills matrix, publish to HR system','low',4,'Internal',3);

-- ════════════════════════════════════════════════════════════════
-- SEED: General Project
-- ════════════════════════════════════════════════════════════════
INSERT OR IGNORE INTO project_templates (id, name, project_type, description, is_system) VALUES
('tmpl-gn-001', 'General Project', 'general',
 'Generic project lifecycle template — initiation, planning, execution and closure. Customise tasks to suit your specific project.',
 1);

INSERT OR IGNORE INTO project_template_phases (id, template_id, phase_name, phase_order, duration_pct) VALUES
('ph-gn-01','tmpl-gn-001','Initiation', 1, 10),
('ph-gn-02','tmpl-gn-001','Planning',   2, 15),
('ph-gn-03','tmpl-gn-001','Execution',  3, 60),
('ph-gn-04','tmpl-gn-001','Closure',    4, 15);

INSERT OR IGNORE INTO project_template_tasks (id, phase_id, template_id, name, description, priority, estimated_hours, category, task_order) VALUES
('tt-gn-01','ph-gn-01','tmpl-gn-001','Project charter','Define objectives, scope, constraints, assumptions and success criteria','high',8,'Planning',1),
('tt-gn-02','ph-gn-01','tmpl-gn-001','Stakeholder register','Identify and document all stakeholders, influence and communication needs','medium',4,'Planning',2),
('tt-gn-03','ph-gn-01','tmpl-gn-001','Risk register','Identify risks, assess probability and impact, define mitigations','high',8,'Planning',3),
('tt-gn-04','ph-gn-02','tmpl-gn-001','Work breakdown structure','Decompose deliverables into manageable work packages','high',12,'Planning',1),
('tt-gn-05','ph-gn-02','tmpl-gn-001','Resource plan','Assign resources to tasks, identify gaps and constraints','high',8,'Planning',2),
('tt-gn-06','ph-gn-02','tmpl-gn-001','Project schedule baseline','Build full project schedule, get stakeholder sign-off','high',8,'Planning',3),
('tt-gn-07','ph-gn-03','tmpl-gn-001','Deliverable 1','Primary project deliverable — specify during project setup','critical',40,'Delivery',1),
('tt-gn-08','ph-gn-03','tmpl-gn-001','Deliverable 2','Secondary project deliverable','high',32,'Delivery',2),
('tt-gn-09','ph-gn-03','tmpl-gn-001','Deliverable 3','Supporting deliverable','high',24,'Delivery',3),
('tt-gn-10','ph-gn-03','tmpl-gn-001','Weekly status reports','Weekly RAG status, progress vs plan, risks and issues','medium',8,'Reporting',4),
('tt-gn-11','ph-gn-04','tmpl-gn-001','Final delivery & sign-off','Client acceptance, formal project closure, sign-off documentation','critical',8,'Delivery',1),
('tt-gn-12','ph-gn-04','tmpl-gn-001','Lessons learned','Project retrospective, lessons learned report','medium',4,'Documentation',2),
('tt-gn-13','ph-gn-04','tmpl-gn-001','Handover documentation','Complete handover pack, knowledge transfer to operations team','high',16,'Documentation',3);

-- Enable clients+invoicing on professional/enterprise plans (idempotent)
UPDATE plan_limits
SET features = replace(features, '"]', '","clients","invoicing","project_templates"]')
WHERE plan IN ('professional','enterprise')
  AND features NOT LIKE '%project_templates%';


-- ════════════════════════════════════════════════════════════
-- 021_perms
-- ════════════════════════════════════════════════════════════
-- ============================================================
-- 021_permissions_complete.sql
-- Adds missing module permissions + role assignments
-- Run: wrangler d1 execute xavvysuite-fresh-db --local --file=schema/021_permissions_complete.sql
-- ============================================================

-- ── New permissions for modules that had none ─────────────────
INSERT OR IGNORE INTO permissions (id, module_key, action, resource, description) VALUES
  -- Onboarding
  ('perm-on-01', 'onboarding', 'view',   'onboarding', 'View onboarding records'),
  ('perm-on-02', 'onboarding', 'manage', 'onboarding', 'Manage onboarding process'),
  -- Offboarding
  ('perm-ob-01', 'offboarding', 'view',   'offboarding', 'View offboarding records'),
  ('perm-ob-02', 'offboarding', 'manage', 'offboarding', 'Manage offboarding process'),
  -- Checklists
  ('perm-ch-01', 'checklists', 'view',   'checklist', 'View checklists'),
  ('perm-ch-02', 'checklists', 'manage', 'checklist', 'Manage checklists and templates'),
  -- Visa
  ('perm-vi-01', 'visa', 'view',   'visa', 'View visa records'),
  ('perm-vi-02', 'visa', 'manage', 'visa', 'Manage visa records'),
  -- SOS / Incidents
  ('perm-so-01', 'sos', 'view',   'incident', 'View SOS incidents'),
  ('perm-so-02', 'sos', 'manage', 'incident', 'Manage SOS incidents'),
  -- Resources
  ('perm-rs-01', 'resources', 'view',   'resource', 'View resource planning'),
  ('perm-rs-02', 'resources', 'manage', 'resource', 'Manage resource bookings'),
  -- Reporting
  ('perm-rp-01', 'reporting', 'view',   'report', 'View reports'),
  ('perm-rp-02', 'reporting', 'view',   'financial_report', 'View financial reports'),
  -- Workflow
  ('perm-wf-01', 'workflow', 'view',   'workflow', 'View workflows'),
  ('perm-wf-02', 'workflow', 'manage', 'workflow', 'Manage workflow definitions'),
  -- Scheduler
  ('perm-sc-01', 'scheduler', 'view',   'job', 'View scheduled jobs'),
  ('perm-sc-02', 'scheduler', 'manage', 'job', 'Manage scheduled jobs'),
  -- Settings (split by sensitivity)
  ('perm-st-01', 'settings', 'view',   'settings',  'View settings'),
  ('perm-st-02', 'settings', 'manage', 'company',   'Manage company & statutory info'),
  ('perm-st-03', 'settings', 'manage', 'branding',  'Manage branding'),
  ('perm-st-04', 'settings', 'manage', 'security',  'Manage SSO, MFA, session settings'),
  ('perm-st-05', 'settings', 'manage', 'modules',   'Enable/disable modules'),
  -- Clients
  ('perm-cl-01', 'clients', 'view',   'client', 'View clients'),
  ('perm-cl-02', 'clients', 'create', 'client', 'Create clients'),
  ('perm-cl-03', 'clients', 'edit',   'client', 'Edit clients'),
  ('perm-cl-04', 'clients', 'delete', 'client', 'Delete/deactivate clients'),
  -- Invoicing
  ('perm-in-01', 'invoicing', 'view',   'invoice', 'View invoices'),
  ('perm-in-02', 'invoicing', 'create', 'invoice', 'Create invoices'),
  ('perm-in-03', 'invoicing', 'edit',   'invoice', 'Edit invoices'),
  ('perm-in-04', 'invoicing', 'send',   'invoice', 'Send invoices'),
  ('perm-in-05', 'invoicing', 'void',   'invoice', 'Void invoices'),
  -- Org chart (everyone can view)
  ('perm-oc-01', 'orgchart', 'view', 'orgchart', 'View org chart');

-- ── Role → new permission assignments ─────────────────────────

-- hr_admin: onboarding, offboarding, checklists, visa
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 'role-hr-admin', id FROM permissions
WHERE module_key IN ('onboarding','offboarding','checklists','visa','orgchart')
   OR (module_key = 'settings' AND action = 'manage' AND resource = 'company')
   OR (module_key = 'reporting' AND resource = 'report');

-- manager: view onboarding/offboarding, resources, reporting (non-financial)
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 'role-manager', id FROM permissions
WHERE (module_key IN ('onboarding','offboarding','checklists') AND action = 'view')
   OR (module_key = 'resources' AND action IN ('view','manage'))
   OR (module_key = 'reporting' AND resource = 'report')
   OR (module_key = 'sos' AND action = 'view')
   OR (module_key = 'orgchart');

-- employee: view org chart, submit SOS, view own reporting
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 'role-employee', id FROM permissions
WHERE (module_key = 'orgchart')
   OR (module_key = 'sos' AND action IN ('view','manage'))
   OR (module_key = 'onboarding' AND action = 'view')
   OR (module_key = 'checklists' AND action = 'view');

-- compliance_officer: visa, checklists
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 'role-compliance', id FROM permissions
WHERE module_key IN ('visa','checklists')
   OR (module_key = 'onboarding' AND action = 'view')
   OR (module_key = 'reporting' AND resource = 'report');

-- finance_admin: clients, invoicing, resources, financial reporting
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 'role-finance', id FROM permissions
WHERE module_key IN ('clients','invoicing')
   OR (module_key = 'resources' AND action = 'view')
   OR (module_key = 'reporting' AND action = 'view')
   OR (module_key = 'settings' AND action = 'manage' AND resource = 'company');

-- ── Assign roles to existing Xavvy employees ─────────────────
-- Nanjusha: manager role (she's PM/Lead)
INSERT OR IGNORE INTO user_roles (user_id, role_id, scope_type, granted_by, granted_at)
SELECT 'usr-nanjusha-001', 'role-manager', 'tenant',
  (SELECT id FROM users WHERE email='admin@xavvy.uk' LIMIT 1), datetime('now')
WHERE EXISTS (SELECT 1 FROM users WHERE id='usr-nanjusha-001');

-- Priya, Swathi, Zeba: employee role
INSERT OR IGNORE INTO user_roles (user_id, role_id, scope_type, granted_by, granted_at)
SELECT id, 'role-employee', 'tenant',
  (SELECT id FROM users WHERE email='admin@xavvy.uk' LIMIT 1), datetime('now')
FROM users WHERE id IN ('usr-priya-001','usr-swathi-001','usr-zeba-001');

-- Admin user: super_admin (already assigned but ensure it's there)
INSERT OR IGNORE INTO user_roles (user_id, role_id, scope_type, granted_by, granted_at)
SELECT u.id, 'role-super-admin', 'tenant', u.id, datetime('now')
FROM users u WHERE u.email = 'admin@xavvy.uk' AND u.tenant_id = 'xavvy-tenant-001';


-- ════════════════════════════════════════════════════════════
-- IOT_SEED
-- ════════════════════════════════════════════════════════════
-- ============================================================
-- XavvySuite — IoT Platform Project Fresh Seed
-- Wipes: timesheets, leave, tasks, projects
-- Reseeds: full SDLC Nov'25 → Dec'28, £270K, 50% allocation
-- ============================================================

-- ── WIPE (children before parents to satisfy FK constraints) ────
DELETE FROM timesheet_entries   WHERE tenant_id='xavvy-tenant-001';
DELETE FROM timesheets          WHERE tenant_id='xavvy-tenant-001';
DELETE FROM leave_requests      WHERE tenant_id='xavvy-tenant-001';
DELETE FROM leave_balances      WHERE tenant_id='xavvy-tenant-001';
DELETE FROM resource_bookings   WHERE tenant_id='xavvy-tenant-001';
DELETE FROM resource_capacity   WHERE tenant_id='xavvy-tenant-001';
DELETE FROM pmo_tasks           WHERE tenant_id='xavvy-tenant-001';
DELETE FROM pmo_allocations     WHERE tenant_id='xavvy-tenant-001';
DELETE FROM pmo_sprints         WHERE tenant_id='xavvy-tenant-001';
DELETE FROM pmo_projects        WHERE tenant_id='xavvy-tenant-001';

-- ── PROJECT ───────────────────────────────────────────────────
-- £270K total, 50% resource allocation, Nov 2025 → Dec 2028
INSERT OR REPLACE INTO pmo_projects (
  id, tenant_id, name, client_name,
  start_date, end_date, budget, spent,
  priority, status, created_by, created_at
) VALUES (
  'proj-iot-001', 'xavvy-tenant-001',
  'SEWIO IoT Platform', 'Xavvy Ltd',
  '2025-11-01', '2028-12-31',
  270000, 47800,
  'high', 'active',
  (SELECT id FROM users WHERE email='admin@xavvy.uk' LIMIT 1),
  CURRENT_TIMESTAMP
);

-- ── RESOURCE ALLOCATIONS (50% each) ──────────────────────────
-- 4 people × 50% × ~17.5 hrs/wk = £270K over 38 months
INSERT OR IGNORE INTO pmo_allocations (id, project_id, employee_id, tenant_id, role, allocation, start_date, end_date) VALUES
  ('alloc-nan-iot','proj-iot-001','emp-nanjusha-001','xavvy-tenant-001','Business Analyst / PM',  50,'2025-11-01','2028-12-31'),
  ('alloc-pri-iot','proj-iot-001','emp-priya-001',   'xavvy-tenant-001','BI & Analytics Engineer',50,'2025-11-01','2028-12-31'),
  ('alloc-swa-iot','proj-iot-001','emp-swathi-001',  'xavvy-tenant-001','Full Stack Developer',   50,'2025-11-01','2028-12-31'),
  ('alloc-zeb-iot','proj-iot-001','emp-zeba-001',    'xavvy-tenant-001','Database Engineer',      50,'2025-11-01','2028-12-31');

-- ── SPRINTS (8 phases across 3 years) ────────────────────────
INSERT OR IGNORE INTO pmo_sprints (id, project_id, tenant_id, sprint_number, sprint_name, start_date, end_date, status) VALUES
  ('spr-ph1','proj-iot-001','xavvy-tenant-001',1,'Phase 1 — Discovery & Requirements',      '2025-11-01','2026-01-31','completed'),
  ('spr-ph2','proj-iot-001','xavvy-tenant-001',2,'Phase 2 — System Design & Architecture',  '2026-02-01','2026-04-30','completed'),
  ('spr-ph3','proj-iot-001','xavvy-tenant-001',3,'Phase 3 — Core Infrastructure',            '2026-05-01','2026-09-30','active'),
  ('spr-ph4','proj-iot-001','xavvy-tenant-001',4,'Phase 4 — Integration & APIs',             '2026-10-01','2027-02-28','upcoming'),
  ('spr-ph5','proj-iot-001','xavvy-tenant-001',5,'Phase 5 — Frontend & Dashboards',          '2027-03-01','2027-07-31','upcoming'),
  ('spr-ph6','proj-iot-001','xavvy-tenant-001',6,'Phase 6 — Testing & QA',                  '2027-08-01','2027-11-30','upcoming'),
  ('spr-ph7','proj-iot-001','xavvy-tenant-001',7,'Phase 7 — UAT & Pilot Deployment',        '2027-12-01','2028-04-30','upcoming'),
  ('spr-ph8','proj-iot-001','xavvy-tenant-001',8,'Phase 8 — Go-Live & Optimisation',        '2028-05-01','2028-12-31','upcoming');

-- ═══════════════════════════════════════════════════════════════
-- PHASE 1 — DISCOVERY & REQUIREMENTS  (Nov 2025 – Jan 2026)
-- Budget: £15,000 | Status: COMPLETED
-- ═══════════════════════════════════════════════════════════════
INSERT OR IGNORE INTO pmo_tasks (id,tenant_id,project_id,sprint_id,name,description,assignee_id,priority,status,estimated_hours,allocated_hours,phase,task_category,task_order,due_date,created_by,created_at,updated_at) VALUES
  ('t-p1-01','xavvy-tenant-001','proj-iot-001','spr-ph1','Stakeholder interviews & workshops',         'Conduct structured interviews with all key stakeholders across warehouse ops, IT and management. Document pain points and desired outcomes.','emp-nanjusha-001','high','done',  40,40,'Phase 1 — Discovery','Analysis',    1,'2025-11-21',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p1-02','xavvy-tenant-001','proj-iot-001','spr-ph1','Current state process mapping',              'Document existing warehouse workflows, manual tracking processes, and pain points. Create AS-IS process maps.','emp-nanjusha-001','high','done',  24,24,'Phase 1 — Discovery','Analysis',    2,'2025-11-28',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p1-03','xavvy-tenant-001','proj-iot-001','spr-ph1','SEWIO hardware site survey',                 'On-site assessment of warehouse layout, anchor placement feasibility, network infrastructure, and SEWIO tag requirements.','emp-swathi-001',  'high','done',  16,16,'Phase 1 — Discovery','Infrastructure',3,'2025-12-05',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p1-04','xavvy-tenant-001','proj-iot-001','spr-ph1','Data requirements analysis',                 'Define data capture requirements: asset types, location granularity, refresh rates, retention periods, and reporting KPIs.','emp-priya-001',   'high','done',  32,32,'Phase 1 — Discovery','Analysis',    4,'2025-12-12',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p1-05','xavvy-tenant-001','proj-iot-001','spr-ph1','Technical feasibility study',               'Assess SEWIO API capabilities, integration options, cloud hosting requirements, and third-party dependencies.','emp-swathi-001',  'high','done',  24,24,'Phase 1 — Discovery','Analysis',    5,'2025-12-19',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p1-06','xavvy-tenant-001','proj-iot-001','spr-ph1','Legacy system integration assessment',       'Review existing WMS, ERP, and reporting tools for integration points and data migration requirements.','emp-zeba-001',    'medium','done', 20,20,'Phase 1 — Discovery','Analysis',    6,'2025-12-19',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p1-07','xavvy-tenant-001','proj-iot-001','spr-ph1','Functional requirements specification (FRS)','Author full FRS document covering all functional requirements, user stories, and acceptance criteria.','emp-nanjusha-001','high','done',  40,40,'Phase 1 — Discovery','Documentation',7,'2026-01-09',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p1-08','xavvy-tenant-001','proj-iot-001','spr-ph1','Non-functional requirements (NFR)',          'Define performance, security, scalability, availability and compliance requirements.','emp-zeba-001',    'high','done',  16,16,'Phase 1 — Discovery','Documentation',8,'2026-01-09',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p1-09','xavvy-tenant-001','proj-iot-001','spr-ph1','Requirements sign-off meeting',             'Present FRS and NFR to steering committee. Collect formal sign-off and update RAID log.','emp-nanjusha-001','high','done',  8, 8, 'Phase 1 — Discovery','Governance',   9,'2026-01-23',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p1-10','xavvy-tenant-001','proj-iot-001','spr-ph1','Project plan & resource schedule',          'Build detailed project plan in MS Project, assign resources at 50% allocation, define critical path.','emp-nanjusha-001','medium','done',16,16,'Phase 1 — Discovery','Governance',  10,'2026-01-31',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);

-- ═══════════════════════════════════════════════════════════════
-- PHASE 2 — SYSTEM DESIGN & ARCHITECTURE  (Feb 2026 – Apr 2026)
-- Budget: £20,000 | Status: COMPLETED
-- ═══════════════════════════════════════════════════════════════
INSERT OR IGNORE INTO pmo_tasks (id,tenant_id,project_id,sprint_id,name,description,assignee_id,priority,status,estimated_hours,allocated_hours,phase,task_category,task_order,due_date,created_by,created_at,updated_at) VALUES
  ('t-p2-01','xavvy-tenant-001','proj-iot-001','spr-ph2','High-level system architecture',            'Design overall system architecture: cloud hosting, microservices layout, IoT data pipeline, and integration topology.','emp-swathi-001',  'high','done',  32,32,'Phase 2 — Design','Architecture',  1,'2026-02-13',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p2-02','xavvy-tenant-001','proj-iot-001','spr-ph2','Database schema design',                    'Design normalised D1/SQLite schema for IoT events, asset tracking, alerts, and reporting. Define partitioning strategy for high-volume event data.','emp-zeba-001','high','done',40,40,'Phase 2 — Design','Database',      2,'2026-02-20',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p2-03','xavvy-tenant-001','proj-iot-001','spr-ph2','API design specification (OpenAPI)',        'Author OpenAPI 3.0 spec for all REST endpoints: asset tracking, events, alerts, user management, and reporting APIs.','emp-swathi-001','high','done',32,32,'Phase 2 — Design','Architecture',  3,'2026-02-27',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p2-04','xavvy-tenant-001','proj-iot-001','spr-ph2','Real-time data pipeline architecture',     'Design SEWIO webhook ingestion, event streaming, transformation layer, and database write strategy for real-time location updates.','emp-zeba-001','high','done',24,24,'Phase 2 — Design','Architecture',  4,'2026-03-06',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p2-05','xavvy-tenant-001','proj-iot-001','spr-ph2','BI & analytics data model',               'Design star-schema data model for Power BI reporting: asset utilisation, zone dwell time, OEE metrics, and exception reporting.','emp-priya-001','high','done',32,32,'Phase 2 — Design','Analytics',     5,'2026-03-06',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p2-06','xavvy-tenant-001','proj-iot-001','spr-ph2','Security & compliance design',             'Define authentication, authorisation (RBAC), data encryption, GDPR compliance, and audit logging architecture.','emp-zeba-001','high','done',24,24,'Phase 2 — Design','Security',      6,'2026-03-13',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p2-07','xavvy-tenant-001','proj-iot-001','spr-ph2','UI/UX wireframes — web portal',           'Create Figma wireframes for all web portal screens: live map, asset registry, alerts dashboard, and reports.','emp-priya-001','medium','done',40,40,'Phase 2 — Design','Design',        7,'2026-03-27',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p2-08','xavvy-tenant-001','proj-iot-001','spr-ph2','Infrastructure sizing & cloud design',    'Size Cloudflare Workers, D1 storage, R2 and KV requirements. Define environment strategy (dev/staging/prod).','emp-swathi-001','medium','done',16,16,'Phase 2 — Design','Infrastructure', 8,'2026-04-03',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p2-09','xavvy-tenant-001','proj-iot-001','spr-ph2','Technical design document (TDD)',         'Compile all design artefacts into a Technical Design Document. Circulate for peer review and client approval.','emp-nanjusha-001','high','done',24,24,'Phase 2 — Design','Documentation', 9,'2026-04-17',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p2-10','xavvy-tenant-001','proj-iot-001','spr-ph2','Architecture sign-off & design freeze',  'Present TDD to steering committee, resolve comments, obtain formal design freeze sign-off.','emp-nanjusha-001','high','done',8,8,'Phase 2 — Design','Governance',   10,'2026-04-30',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);

-- ═══════════════════════════════════════════════════════════════
-- PHASE 3 — CORE INFRASTRUCTURE  (May 2026 – Sep 2026)
-- Budget: £45,000 | Status: IN PROGRESS
-- ═══════════════════════════════════════════════════════════════
INSERT OR IGNORE INTO pmo_tasks (id,tenant_id,project_id,sprint_id,name,description,assignee_id,priority,status,estimated_hours,allocated_hours,phase,task_category,task_order,due_date,created_by,created_at,updated_at) VALUES
  ('t-p3-01','xavvy-tenant-001','proj-iot-001','spr-ph3','Cloudflare Workers project setup',          'Initialise Workers project, configure wrangler.toml for dev/staging/prod, set up CI/CD pipeline with GitHub Actions.','emp-swathi-001','high','done',  16,16,'Phase 3 — Core Infra','Infrastructure',1,'2026-05-09',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p3-02','xavvy-tenant-001','proj-iot-001','spr-ph3','D1 database provisioning & migrations',   'Create D1 databases for dev/staging/prod, run all migrations, set up migration management workflow.','emp-zeba-001',  'high','done',  16,16,'Phase 3 — Core Infra','Database',       2,'2026-05-09',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p3-03','xavvy-tenant-001','proj-iot-001','spr-ph3','Authentication & JWT middleware',         'Implement JWT-based auth, RBAC middleware, refresh token rotation, and session management using KV.','emp-swathi-001','high','done',  32,32,'Phase 3 — Core Infra','Backend',        3,'2026-05-23',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p3-04','xavvy-tenant-001','proj-iot-001','spr-ph3','Core asset tracking API',                'Build REST endpoints for asset CRUD, tag assignment, zone configuration, and location history.','emp-swathi-001','high','in_progress',40,20,'Phase 3 — Core Infra','Backend',        4,'2026-06-20',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p3-05','xavvy-tenant-001','proj-iot-001','spr-ph3','SEWIO webhook receiver',                 'Build inbound webhook endpoint to receive SEWIO UWB location events, validate payloads, and write to event stream.','emp-swathi-001','high','in_progress',32,12,'Phase 3 — Core Infra','Integration',    5,'2026-06-27',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p3-06','xavvy-tenant-001','proj-iot-001','spr-ph3','Event storage schema & indexing',        'Implement partitioned event storage in D1, create composite indexes for time-series queries, run performance benchmarks.','emp-zeba-001','high','in_progress',40,16,'Phase 3 — Core Infra','Database',       6,'2026-07-04',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p3-07','xavvy-tenant-001','proj-iot-001','spr-ph3','R2 file storage integration',           'Integrate R2 for document storage (floor plans, manuals, export files). Build upload/download APIs with signed URLs.','emp-swathi-001','medium','todo',16,0,'Phase 3 — Core Infra','Infrastructure',7,'2026-07-18',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p3-08','xavvy-tenant-001','proj-iot-001','spr-ph3','Alert engine — rules & notifications',  'Build configurable alert rules engine: zone breaches, dwell time thresholds, asset not-found alerts. Email/webhook notifications.','emp-zeba-001','high','todo',48,0,'Phase 3 — Core Infra','Backend',        8,'2026-08-01',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p3-09','xavvy-tenant-001','proj-iot-001','spr-ph3','ETL pipeline — events to analytics DB', 'Build scheduled ETL job to aggregate raw events into analytics-optimised summary tables for BI consumption.','emp-priya-001','high','todo',40,0,'Phase 3 — Core Infra','Analytics',      9,'2026-08-15',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p3-10','xavvy-tenant-001','proj-iot-001','spr-ph3','Audit logging & GDPR compliance',       'Implement immutable audit log for all data access and mutations. Add data retention policies and anonymisation routines.','emp-zeba-001','medium','todo',24,0,'Phase 3 — Core Infra','Security',      10,'2026-08-29',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p3-11','xavvy-tenant-001','proj-iot-001','spr-ph3','Dev environment smoke testing',         'Run end-to-end smoke tests across all core APIs in dev environment. Document test results and raise defects.','emp-nanjusha-001','medium','todo',16,0,'Phase 3 — Core Infra','Testing',       11,'2026-09-12',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p3-12','xavvy-tenant-001','proj-iot-001','spr-ph3','Phase 3 review & sign-off',            'Demo core infrastructure to client. Collect feedback, update backlog, obtain phase sign-off.','emp-nanjusha-001','high','todo',8,0,'Phase 3 — Core Infra','Governance',    12,'2026-09-30',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);

-- ═══════════════════════════════════════════════════════════════
-- PHASE 4 — INTEGRATION & APIs  (Oct 2026 – Feb 2027)
-- Budget: £50,000 | Status: PLANNED
-- ═══════════════════════════════════════════════════════════════
INSERT OR IGNORE INTO pmo_tasks (id,tenant_id,project_id,sprint_id,name,description,assignee_id,priority,status,estimated_hours,allocated_hours,phase,task_category,task_order,due_date,created_by,created_at,updated_at) VALUES
  ('t-p4-01','xavvy-tenant-001','proj-iot-001','spr-ph4','SEWIO RTLS full integration',            'Complete bidirectional integration with SEWIO UWB infrastructure: tag management, anchor calibration, zone configuration APIs.','emp-swathi-001','high','todo',48,0,'Phase 4 — Integration','Integration',1,'2026-10-30',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p4-02','xavvy-tenant-001','proj-iot-001','spr-ph4','WMS data connector',                    'Build connector to pull asset master data and order information from existing Warehouse Management System.','emp-zeba-001',  'high','todo',40,0,'Phase 4 — Integration','Integration',2,'2026-11-13',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p4-03','xavvy-tenant-001','proj-iot-001','spr-ph4','ERP integration — SAP connector',       'Implement SAP RFC/IDoc connector to sync asset data, locations, and utilisation metrics into SAP PM and WM modules.','emp-swathi-001','high','todo',56,0,'Phase 4 — Integration','Integration',3,'2026-12-04',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p4-04','xavvy-tenant-001','proj-iot-001','spr-ph4','Real-time event streaming (WebSocket)', 'Build WebSocket server for live location streaming to web portal. Handle 1000+ concurrent connections with KV-based pub/sub.','emp-swathi-001','high','todo',48,0,'Phase 4 — Integration','Backend',    4,'2026-12-18',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p4-05','xavvy-tenant-001','proj-iot-001','spr-ph4','Power BI data connector & dataset',     'Build Power BI DirectQuery connector against analytics DB. Create certified shared dataset for all reports.','emp-priya-001', 'high','todo',40,0,'Phase 4 — Integration','Analytics',  5,'2027-01-08',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p4-06','xavvy-tenant-001','proj-iot-001','spr-ph4','Reporting API — aggregates & exports', 'Build reporting API endpoints: utilisation summaries, zone heatmaps, exception reports, and CSV/Excel export.','emp-priya-001', 'medium','todo',32,0,'Phase 4 — Integration','Backend',    6,'2027-01-22',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p4-07','xavvy-tenant-001','proj-iot-001','spr-ph4','Third-party notification integration', 'Integrate with Microsoft Teams, PagerDuty, and email for alert delivery. Build notification preference management.','emp-zeba-001',  'medium','todo',24,0,'Phase 4 — Integration','Integration',7,'2027-02-05',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p4-08','xavvy-tenant-001','proj-iot-001','spr-ph4','Integration testing & certification',  'Execute full integration test suite across all connectors. Document results and obtain client technical sign-off.','emp-nanjusha-001','high','todo',32,0,'Phase 4 — Integration','Testing',    8,'2027-02-28',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);

-- ═══════════════════════════════════════════════════════════════
-- PHASE 5 — FRONTEND & DASHBOARDS  (Mar 2027 – Jul 2027)
-- Budget: £45,000 | Status: PLANNED
-- ═══════════════════════════════════════════════════════════════
INSERT OR IGNORE INTO pmo_tasks (id,tenant_id,project_id,sprint_id,name,description,assignee_id,priority,status,estimated_hours,allocated_hours,phase,task_category,task_order,due_date,created_by,created_at,updated_at) VALUES
  ('t-p5-01','xavvy-tenant-001','proj-iot-001','spr-ph5','React web portal — scaffold & routing',  'Set up React/Vite project, component library, routing, auth context, and API client for IoT portal.','emp-swathi-001','high','todo',24,0,'Phase 5 — Frontend','Frontend',  1,'2027-03-19',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p5-02','xavvy-tenant-001','proj-iot-001','spr-ph5','Real-time location map (Leaflet.js)',   'Build interactive floor-plan map with live asset position overlay, zone highlighting, and click-through to asset detail.','emp-swathi-001','high','todo',56,0,'Phase 5 — Frontend','Frontend',  2,'2027-04-16',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p5-03','xavvy-tenant-001','proj-iot-001','spr-ph5','Asset registry & management UI',        'Build asset registry screens: list view, detail view, tag assignment, zone assignment, and maintenance history.','emp-swathi-001','high','todo',40,0,'Phase 5 — Frontend','Frontend',  3,'2027-04-30',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p5-04','xavvy-tenant-001','proj-iot-001','spr-ph5','Alerts dashboard & notification centre','Build alerts dashboard: active alerts list, alert history, acknowledgement workflow, and escalation management.','emp-priya-001', 'high','todo',32,0,'Phase 5 — Frontend','Frontend',  4,'2027-05-14',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p5-05','xavvy-tenant-001','proj-iot-001','spr-ph5','Power BI embedded dashboards',          'Embed certified Power BI reports in web portal: OEE dashboard, zone utilisation, asset tracking history, exception report.','emp-priya-001','high','todo',40,0,'Phase 5 — Frontend','Analytics', 5,'2027-05-28',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p5-06','xavvy-tenant-001','proj-iot-001','spr-ph5','User & role management UI',             'Build admin screens: user management, RBAC role assignment, site configuration, and system settings.','emp-swathi-001','medium','todo',24,0,'Phase 5 — Frontend','Frontend',  6,'2027-06-11',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p5-07','xavvy-tenant-001','proj-iot-001','spr-ph5','Mobile-responsive design & PWA',        'Ensure all screens are mobile-responsive. Add PWA manifest for tablet/mobile warehouse floor use.','emp-swathi-001','medium','todo',24,0,'Phase 5 — Frontend','Frontend',  7,'2027-06-25',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p5-08','xavvy-tenant-001','proj-iot-001','spr-ph5','Accessibility audit (WCAG 2.1 AA)',    'Run accessibility audit against all portal screens. Resolve all critical and major accessibility issues.','emp-priya-001','medium','todo',16,0,'Phase 5 — Frontend','Quality',   8,'2027-07-09',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p5-09','xavvy-tenant-001','proj-iot-001','spr-ph5','Frontend performance optimisation',    'Profile and optimise: code splitting, lazy loading, WebSocket reconnection logic, map tile caching.','emp-swathi-001','medium','todo',16,0,'Phase 5 — Frontend','Performance',9,'2027-07-23',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p5-10','xavvy-tenant-001','proj-iot-001','spr-ph5','Frontend integration testing',        'Execute full frontend integration tests against staging. Resolve defects, performance-test with 500 concurrent map clients.','emp-nanjusha-001','high','todo',24,0,'Phase 5 — Frontend','Testing',  10,'2027-07-31',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);

-- ═══════════════════════════════════════════════════════════════
-- PHASE 6 — TESTING & QA  (Aug 2027 – Nov 2027)
-- Budget: £30,000 | Status: PLANNED
-- ═══════════════════════════════════════════════════════════════
INSERT OR IGNORE INTO pmo_tasks (id,tenant_id,project_id,sprint_id,name,description,assignee_id,priority,status,estimated_hours,allocated_hours,phase,task_category,task_order,due_date,created_by,created_at,updated_at) VALUES
  ('t-p6-01','xavvy-tenant-001','proj-iot-001','spr-ph6','Test strategy & plan',                 'Author test strategy covering functional, regression, performance, security, and UAT phases. Define entry/exit criteria.','emp-nanjusha-001','high','todo',16,0,'Phase 6 — Testing','Testing',   1,'2027-08-13',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p6-02','xavvy-tenant-001','proj-iot-001','spr-ph6','Functional test execution',            'Execute 320 functional test cases across all modules. Log, triage and retest defects through to closure.','emp-nanjusha-001','high','todo',64,0,'Phase 6 — Testing','Testing',   2,'2027-09-10',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p6-03','xavvy-tenant-001','proj-iot-001','spr-ph6','Performance & load testing',          'Load test with 2,000 concurrent UWB tag updates/second. Validate p99 latency < 500ms for map updates.','emp-swathi-001','high','todo',32,0,'Phase 6 — Testing','Performance',3,'2027-09-24',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p6-04','xavvy-tenant-001','proj-iot-001','spr-ph6','Security penetration testing',        'Engage third-party pen test. Resolve all critical and high vulnerabilities before UAT.','emp-zeba-001',  'high','todo',24,0,'Phase 6 — Testing','Security',   4,'2027-10-08',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p6-05','xavvy-tenant-001','proj-iot-001','spr-ph6','Data accuracy & integrity testing',   'Validate location accuracy vs ground truth. Test event data integrity through full pipeline from SEWIO to BI dashboard.','emp-priya-001','high','todo',32,0,'Phase 6 — Testing','Testing',   5,'2027-10-22',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p6-06','xavvy-tenant-001','proj-iot-001','spr-ph6','Integration regression suite',        'Run full regression suite across all integrations (SEWIO, WMS, SAP, Power BI). Automate top 50 critical paths.','emp-swathi-001','medium','todo',40,0,'Phase 6 — Testing','Testing',   6,'2027-11-05',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p6-07','xavvy-tenant-001','proj-iot-001','spr-ph6','Defect resolution & retesting',       'Resolve all P1 and P2 defects raised during testing phases. Retest and close via sign-off.','emp-zeba-001',  'high','todo',32,0,'Phase 6 — Testing','Testing',   7,'2027-11-19',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p6-08','xavvy-tenant-001','proj-iot-001','spr-ph6','QA sign-off & test completion report','Compile test completion report. Obtain QA sign-off for UAT entry. Update risk register.','emp-nanjusha-001','high','todo',8,0,'Phase 6 — Testing','Governance', 8,'2027-11-30',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);

-- ═══════════════════════════════════════════════════════════════
-- PHASE 7 — UAT & PILOT  (Dec 2027 – Apr 2028)
-- Budget: £40,000 | Status: PLANNED
-- ═══════════════════════════════════════════════════════════════
INSERT OR IGNORE INTO pmo_tasks (id,tenant_id,project_id,sprint_id,name,description,assignee_id,priority,status,estimated_hours,allocated_hours,phase,task_category,task_order,due_date,created_by,created_at,updated_at) VALUES
  ('t-p7-01','xavvy-tenant-001','proj-iot-001','spr-ph7','UAT environment setup & data prep',    'Configure UAT environment with production-mirrored data. Brief business testers, issue test credentials.','emp-zeba-001',  'high','todo',16,0,'Phase 7 — UAT','Testing',    1,'2027-12-12',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p7-02','xavvy-tenant-001','proj-iot-001','spr-ph7','UAT test execution — pilot site A',   'Support Pilot Site A (Warehouse 1) UAT execution over 3 weeks. Daily defect triage calls with business team.','emp-nanjusha-001','high','todo',80,0,'Phase 7 — UAT','Testing',    2,'2028-01-20',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p7-03','xavvy-tenant-001','proj-iot-001','spr-ph7','UAT test execution — pilot site B',   'Support Pilot Site B (Distribution Centre) UAT. Extended real-world test with 150 active tags over 2 weeks.','emp-nanjusha-001','high','todo',64,0,'Phase 7 — UAT','Testing',    3,'2028-02-14',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p7-04','xavvy-tenant-001','proj-iot-001','spr-ph7','SEWIO hardware calibration (pilot)',   'On-site anchor installation, calibration, and coverage validation for both pilot sites.','emp-swathi-001','high','todo',40,0,'Phase 7 — UAT','Infrastructure',4,'2028-01-31',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p7-05','xavvy-tenant-001','proj-iot-001','spr-ph7','UAT defect resolution',               'Triage, prioritise and resolve all UAT-raised defects. Deploy hotfixes to UAT environment within agreed SLA.','emp-swathi-001','high','todo',48,0,'Phase 7 — UAT','Development', 5,'2028-03-14',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p7-06','xavvy-tenant-001','proj-iot-001','spr-ph7','Power BI dashboard UAT',             'Business validation of all BI dashboards with real pilot data. Refine visuals, labels, and KPI definitions.','emp-priya-001','high','todo',32,0,'Phase 7 — UAT','Analytics',   6,'2028-03-14',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p7-07','xavvy-tenant-001','proj-iot-001','spr-ph7','User training — key users',           'Deliver 3-day training programme for super users and system administrators across both pilot sites.','emp-nanjusha-001','high','todo',24,0,'Phase 7 — UAT','Training',    7,'2028-03-28',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p7-08','xavvy-tenant-001','proj-iot-001','spr-ph7','UAT sign-off & go-live approval',    'Obtain formal UAT sign-off from business sponsor. Approve go-live readiness and notify steering committee.','emp-nanjusha-001','high','todo',8,0,'Phase 7 — UAT','Governance',  8,'2028-04-30',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);

-- ═══════════════════════════════════════════════════════════════
-- PHASE 8 — GO-LIVE & OPTIMISATION  (May 2028 – Dec 2028)
-- Budget: £25,000 | Status: PLANNED
-- ═══════════════════════════════════════════════════════════════
INSERT OR IGNORE INTO pmo_tasks (id,tenant_id,project_id,sprint_id,name,description,assignee_id,priority,status,estimated_hours,allocated_hours,phase,task_category,task_order,due_date,created_by,created_at,updated_at) VALUES
  ('t-p8-01','xavvy-tenant-001','proj-iot-001','spr-ph8','Production deployment & cutover',      'Execute go-live cutover plan: blue-green deployment, DNS cutover, SEWIO live switch, and hypercare activation.','emp-swathi-001','high','todo',24,0,'Phase 8 — Go-Live','Deployment',1,'2028-05-10',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p8-02','xavvy-tenant-001','proj-iot-001','spr-ph8','Hypercare support (30 days)',          '30-day intensive post-go-live support: daily stand-ups, 4hr response SLA on P1s, live performance monitoring.','emp-nanjusha-001','high','todo',80,0,'Phase 8 — Go-Live','Support',   2,'2028-06-09',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p8-03','xavvy-tenant-001','proj-iot-001','spr-ph8','Full site rollout — all warehouses',  'Roll out SEWIO infrastructure and portal to remaining 4 warehouse sites following pilot learnings.','emp-swathi-001','high','todo',64,0,'Phase 8 — Go-Live','Deployment',3,'2028-07-31',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p8-04','xavvy-tenant-001','proj-iot-001','spr-ph8','Performance monitoring & tuning',     'Set up Cloudflare Analytics dashboards, D1 query performance monitoring, and alert thresholds for production.','emp-zeba-001',  'high','todo',32,0,'Phase 8 — Go-Live','Performance',4,'2028-06-30',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p8-05','xavvy-tenant-001','proj-iot-001','spr-ph8','End-user training — all sites',       'Deliver end-user training to 200+ warehouse staff across all sites. Produce self-service training videos.','emp-nanjusha-001','medium','todo',48,0,'Phase 8 — Go-Live','Training',  5,'2028-08-30',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p8-06','xavvy-tenant-001','proj-iot-001','spr-ph8','Advanced analytics & ML pipeline',   'Build ML-based anomaly detection for asset movement patterns. Implement predictive maintenance alerts.','emp-priya-001','medium','todo',80,0,'Phase 8 — Go-Live','Analytics', 6,'2028-10-31',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p8-07','xavvy-tenant-001','proj-iot-001','spr-ph8','Documentation & knowledge transfer', 'Deliver operations runbook, API documentation, admin guide, and complete knowledge transfer to client IT team.','emp-nanjusha-001','high','todo',40,0,'Phase 8 — Go-Live','Documentation',7,'2028-11-29',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p8-08','xavvy-tenant-001','proj-iot-001','spr-ph8','Project closure & lessons learned',  'Compile project closure report, lessons learned, benefits realisation baseline, and financial reconciliation.','emp-nanjusha-001','high','todo',16,0,'Phase 8 — Go-Live','Governance', 8,'2028-12-20',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);

-- ═══════════════════════════════════════════════════════════════
-- TIMESHEETS — Phases 1 & 2 completed work (Nov'25 – Apr'26)
-- 50% allocation = 17.5 hrs/week per person
-- Approved timesheets for the completed phases
-- ═══════════════════════════════════════════════════════════════

-- Phase 1 timesheets (4 employees × 13 weeks × 17.5hrs = 910hrs total)
INSERT OR IGNORE INTO timesheets (id,tenant_id,employee_id,week_starting,status,submitted_at) VALUES
  ('ts-nan-2025-44','xavvy-tenant-001','emp-nanjusha-001','2025-11-03','approved',CURRENT_TIMESTAMP),
  ('ts-nan-2025-46','xavvy-tenant-001','emp-nanjusha-001','2025-11-17','approved',CURRENT_TIMESTAMP),
  ('ts-nan-2025-48','xavvy-tenant-001','emp-nanjusha-001','2025-12-01','approved',CURRENT_TIMESTAMP),
  ('ts-nan-2025-50','xavvy-tenant-001','emp-nanjusha-001','2025-12-15','approved',CURRENT_TIMESTAMP),
  ('ts-nan-2025-52','xavvy-tenant-001','emp-nanjusha-001','2025-12-29','approved',CURRENT_TIMESTAMP),
  ('ts-nan-2026-02','xavvy-tenant-001','emp-nanjusha-001','2026-01-05','approved',CURRENT_TIMESTAMP),
  ('ts-nan-2026-04','xavvy-tenant-001','emp-nanjusha-001','2026-01-19','approved',CURRENT_TIMESTAMP),
  ('ts-pri-2025-44','xavvy-tenant-001','emp-priya-001',   '2025-11-03','approved',CURRENT_TIMESTAMP),
  ('ts-pri-2025-46','xavvy-tenant-001','emp-priya-001',   '2025-11-17','approved',CURRENT_TIMESTAMP),
  ('ts-pri-2025-48','xavvy-tenant-001','emp-priya-001',   '2025-12-01','approved',CURRENT_TIMESTAMP),
  ('ts-pri-2025-50','xavvy-tenant-001','emp-priya-001',   '2025-12-15','approved',CURRENT_TIMESTAMP),
  ('ts-pri-2025-52','xavvy-tenant-001','emp-priya-001',   '2025-12-29','approved',CURRENT_TIMESTAMP),
  ('ts-pri-2026-02','xavvy-tenant-001','emp-priya-001',   '2026-01-05','approved',CURRENT_TIMESTAMP),
  ('ts-pri-2026-04','xavvy-tenant-001','emp-priya-001',   '2026-01-19','approved',CURRENT_TIMESTAMP),
  ('ts-swa-2025-44','xavvy-tenant-001','emp-swathi-001',  '2025-11-03','approved',CURRENT_TIMESTAMP),
  ('ts-swa-2025-46','xavvy-tenant-001','emp-swathi-001',  '2025-11-17','approved',CURRENT_TIMESTAMP),
  ('ts-swa-2025-48','xavvy-tenant-001','emp-swathi-001',  '2025-12-01','approved',CURRENT_TIMESTAMP),
  ('ts-swa-2025-50','xavvy-tenant-001','emp-swathi-001',  '2025-12-15','approved',CURRENT_TIMESTAMP),
  ('ts-swa-2025-52','xavvy-tenant-001','emp-swathi-001',  '2025-12-29','approved',CURRENT_TIMESTAMP),
  ('ts-swa-2026-02','xavvy-tenant-001','emp-swathi-001',  '2026-01-05','approved',CURRENT_TIMESTAMP),
  ('ts-swa-2026-04','xavvy-tenant-001','emp-swathi-001',  '2026-01-19','approved',CURRENT_TIMESTAMP),
  ('ts-zeb-2025-44','xavvy-tenant-001','emp-zeba-001',    '2025-11-03','approved',CURRENT_TIMESTAMP),
  ('ts-zeb-2025-46','xavvy-tenant-001','emp-zeba-001',    '2025-11-17','approved',CURRENT_TIMESTAMP),
  ('ts-zeb-2025-48','xavvy-tenant-001','emp-zeba-001',    '2025-12-01','approved',CURRENT_TIMESTAMP),
  ('ts-zeb-2025-50','xavvy-tenant-001','emp-zeba-001',    '2025-12-15','approved',CURRENT_TIMESTAMP),
  ('ts-zeb-2025-52','xavvy-tenant-001','emp-zeba-001',    '2025-12-29','approved',CURRENT_TIMESTAMP),
  ('ts-zeb-2026-02','xavvy-tenant-001','emp-zeba-001',    '2026-01-05','approved',CURRENT_TIMESTAMP),
  ('ts-zeb-2026-04','xavvy-tenant-001','emp-zeba-001',    '2026-01-19','approved',CURRENT_TIMESTAMP);

-- Phase 2 timesheets (Feb – Apr 2026)
INSERT OR IGNORE INTO timesheets (id,tenant_id,employee_id,week_starting,status,submitted_at) VALUES
  ('ts-nan-2026-06','xavvy-tenant-001','emp-nanjusha-001','2026-02-02','approved',CURRENT_TIMESTAMP),
  ('ts-nan-2026-08','xavvy-tenant-001','emp-nanjusha-001','2026-02-16','approved',CURRENT_TIMESTAMP),
  ('ts-nan-2026-10','xavvy-tenant-001','emp-nanjusha-001','2026-03-02','approved',CURRENT_TIMESTAMP),
  ('ts-nan-2026-12','xavvy-tenant-001','emp-nanjusha-001','2026-03-16','approved',CURRENT_TIMESTAMP),
  ('ts-nan-2026-14','xavvy-tenant-001','emp-nanjusha-001','2026-03-30','approved',CURRENT_TIMESTAMP),
  ('ts-nan-2026-16','xavvy-tenant-001','emp-nanjusha-001','2026-04-13','approved',CURRENT_TIMESTAMP),
  ('ts-nan-2026-17','xavvy-tenant-001','emp-nanjusha-001','2026-04-27','approved',CURRENT_TIMESTAMP),
  ('ts-pri-2026-06','xavvy-tenant-001','emp-priya-001',   '2026-02-02','approved',CURRENT_TIMESTAMP),
  ('ts-pri-2026-08','xavvy-tenant-001','emp-priya-001',   '2026-02-16','approved',CURRENT_TIMESTAMP),
  ('ts-pri-2026-10','xavvy-tenant-001','emp-priya-001',   '2026-03-02','approved',CURRENT_TIMESTAMP),
  ('ts-pri-2026-12','xavvy-tenant-001','emp-priya-001',   '2026-03-16','approved',CURRENT_TIMESTAMP),
  ('ts-pri-2026-14','xavvy-tenant-001','emp-priya-001',   '2026-03-30','approved',CURRENT_TIMESTAMP),
  ('ts-pri-2026-16','xavvy-tenant-001','emp-priya-001',   '2026-04-13','approved',CURRENT_TIMESTAMP),
  ('ts-pri-2026-17','xavvy-tenant-001','emp-priya-001',   '2026-04-27','approved',CURRENT_TIMESTAMP),
  ('ts-swa-2026-06','xavvy-tenant-001','emp-swathi-001',  '2026-02-02','approved',CURRENT_TIMESTAMP),
  ('ts-swa-2026-08','xavvy-tenant-001','emp-swathi-001',  '2026-02-16','approved',CURRENT_TIMESTAMP),
  ('ts-swa-2026-10','xavvy-tenant-001','emp-swathi-001',  '2026-03-02','approved',CURRENT_TIMESTAMP),
  ('ts-swa-2026-12','xavvy-tenant-001','emp-swathi-001',  '2026-03-16','approved',CURRENT_TIMESTAMP),
  ('ts-swa-2026-14','xavvy-tenant-001','emp-swathi-001',  '2026-03-30','approved',CURRENT_TIMESTAMP),
  ('ts-swa-2026-16','xavvy-tenant-001','emp-swathi-001',  '2026-04-13','approved',CURRENT_TIMESTAMP),
  ('ts-swa-2026-17','xavvy-tenant-001','emp-swathi-001',  '2026-04-27','approved',CURRENT_TIMESTAMP),
  ('ts-zeb-2026-06','xavvy-tenant-001','emp-zeba-001',    '2026-02-02','approved',CURRENT_TIMESTAMP),
  ('ts-zeb-2026-08','xavvy-tenant-001','emp-zeba-001',    '2026-02-16','approved',CURRENT_TIMESTAMP),
  ('ts-zeb-2026-10','xavvy-tenant-001','emp-zeba-001',    '2026-03-02','approved',CURRENT_TIMESTAMP),
  ('ts-zeb-2026-12','xavvy-tenant-001','emp-zeba-001',    '2026-03-16','approved',CURRENT_TIMESTAMP),
  ('ts-zeb-2026-14','xavvy-tenant-001','emp-zeba-001',    '2026-03-30','approved',CURRENT_TIMESTAMP),
  ('ts-zeb-2026-16','xavvy-tenant-001','emp-zeba-001',    '2026-04-13','approved',CURRENT_TIMESTAMP),
  ('ts-zeb-2026-17','xavvy-tenant-001','emp-zeba-001',    '2026-04-27','approved',CURRENT_TIMESTAMP);

-- Phase 3 timesheets (May – Jun 2026, in progress)
INSERT OR IGNORE INTO timesheets (id,tenant_id,employee_id,week_starting,status,submitted_at) VALUES
  ('ts-nan-2026-18','xavvy-tenant-001','emp-nanjusha-001','2026-05-04','approved',CURRENT_TIMESTAMP),
  ('ts-nan-2026-20','xavvy-tenant-001','emp-nanjusha-001','2026-05-18','approved',CURRENT_TIMESTAMP),
  ('ts-nan-2026-22','xavvy-tenant-001','emp-nanjusha-001','2026-06-01','approved',CURRENT_TIMESTAMP),
  ('ts-nan-2026-23','xavvy-tenant-001','emp-nanjusha-001','2026-06-08','pending',CURRENT_TIMESTAMP),
  ('ts-pri-2026-18','xavvy-tenant-001','emp-priya-001',   '2026-05-04','approved',CURRENT_TIMESTAMP),
  ('ts-pri-2026-20','xavvy-tenant-001','emp-priya-001',   '2026-05-18','approved',CURRENT_TIMESTAMP),
  ('ts-pri-2026-22','xavvy-tenant-001','emp-priya-001',   '2026-06-01','approved',CURRENT_TIMESTAMP),
  ('ts-pri-2026-23','xavvy-tenant-001','emp-priya-001',   '2026-06-08','pending',CURRENT_TIMESTAMP),
  ('ts-swa-2026-18','xavvy-tenant-001','emp-swathi-001',  '2026-05-04','approved',CURRENT_TIMESTAMP),
  ('ts-swa-2026-20','xavvy-tenant-001','emp-swathi-001',  '2026-05-18','approved',CURRENT_TIMESTAMP),
  ('ts-swa-2026-22','xavvy-tenant-001','emp-swathi-001',  '2026-06-01','approved',CURRENT_TIMESTAMP),
  ('ts-swa-2026-23','xavvy-tenant-001','emp-swathi-001',  '2026-06-08','pending',CURRENT_TIMESTAMP),
  ('ts-zeb-2026-18','xavvy-tenant-001','emp-zeba-001',    '2026-05-04','approved',CURRENT_TIMESTAMP),
  ('ts-zeb-2026-20','xavvy-tenant-001','emp-zeba-001',    '2026-05-18','approved',CURRENT_TIMESTAMP),
  ('ts-zeb-2026-22','xavvy-tenant-001','emp-zeba-001',    '2026-06-01','approved',CURRENT_TIMESTAMP),
  ('ts-zeb-2026-23','xavvy-tenant-001','emp-zeba-001',    '2026-06-08','pending',CURRENT_TIMESTAMP);

-- Timesheet entries — 17.5hrs/week (3.5hrs/day × 5 days) per person, billable
-- Using a representative sample (first week of each phase for brevity)
INSERT OR IGNORE INTO timesheet_entries (id,timesheet_id,tenant_id,date,hours_worked,description,billable) VALUES
  ('te-nan-44-m','ts-nan-2025-44','xavvy-tenant-001','2025-11-03',3.5,'Stakeholder kick-off workshop',1),
  ('te-nan-44-t','ts-nan-2025-44','xavvy-tenant-001','2025-11-04',3.5,'Requirements gathering interviews',1),
  ('te-nan-44-w','ts-nan-2025-44','xavvy-tenant-001','2025-11-05',3.5,'Process mapping workshop',1),
  ('te-nan-44-th','ts-nan-2025-44','xavvy-tenant-001','2025-11-06',3.5,'Documentation and follow-up',1),
  ('te-nan-44-f','ts-nan-2025-44','xavvy-tenant-001','2025-11-07',3.5,'Weekly review and planning',1),
  ('te-pri-44-m','ts-pri-2025-44','xavvy-tenant-001','2025-11-03',3.5,'Data requirements workshop',1),
  ('te-pri-44-t','ts-pri-2025-44','xavvy-tenant-001','2025-11-04',3.5,'Current state analysis',1),
  ('te-pri-44-w','ts-pri-2025-44','xavvy-tenant-001','2025-11-05',3.5,'KPI definition sessions',1),
  ('te-pri-44-th','ts-pri-2025-44','xavvy-tenant-001','2025-11-06',3.5,'BI requirements documentation',1),
  ('te-pri-44-f','ts-pri-2025-44','xavvy-tenant-001','2025-11-07',3.5,'Weekly review and planning',1),
  ('te-swa-44-m','ts-swa-2025-44','xavvy-tenant-001','2025-11-03',3.5,'Technical feasibility research',1),
  ('te-swa-44-t','ts-swa-2025-44','xavvy-tenant-001','2025-11-04',3.5,'SEWIO API documentation review',1),
  ('te-swa-44-w','ts-swa-2025-44','xavvy-tenant-001','2025-11-05',3.5,'Site survey preparation',1),
  ('te-swa-44-th','ts-swa-2025-44','xavvy-tenant-001','2025-11-06',3.5,'Infrastructure assessment',1),
  ('te-swa-44-f','ts-swa-2025-44','xavvy-tenant-001','2025-11-07',3.5,'Weekly review and planning',1),
  ('te-zeb-44-m','ts-zeb-2025-44','xavvy-tenant-001','2025-11-03',3.5,'Legacy system data audit',1),
  ('te-zeb-44-t','ts-zeb-2025-44','xavvy-tenant-001','2025-11-04',3.5,'WMS data model review',1),
  ('te-zeb-44-w','ts-zeb-2025-44','xavvy-tenant-001','2025-11-05',3.5,'Data migration scoping',1),
  ('te-zeb-44-th','ts-zeb-2025-44','xavvy-tenant-001','2025-11-06',3.5,'NFR data requirements',1),
  ('te-zeb-44-f','ts-zeb-2025-44','xavvy-tenant-001','2025-11-07',3.5,'Weekly review and planning',1),
  -- Phase 3 current week entries
  ('te-nan-23-m','ts-nan-2026-23','xavvy-tenant-001','2026-06-08',3.5,'Core API review and testing',1),
  ('te-nan-23-t','ts-nan-2026-23','xavvy-tenant-001','2026-06-09',3.5,'Client status meeting',1),
  ('te-nan-23-w','ts-nan-2026-23','xavvy-tenant-001','2026-06-10',3.5,'Sprint planning phase 3',1),
  ('te-nan-23-th','ts-nan-2026-23','xavvy-tenant-001','2026-06-11',3.5,'Risk register update',1),
  ('te-nan-23-f','ts-nan-2026-23','xavvy-tenant-001','2026-06-12',3.5,'Stakeholder progress report',1),
  ('te-swa-23-m','ts-swa-2026-23','xavvy-tenant-001','2026-06-08',3.5,'Asset tracking API development',1),
  ('te-swa-23-t','ts-swa-2026-23','xavvy-tenant-001','2026-06-09',3.5,'SEWIO webhook implementation',1),
  ('te-swa-23-w','ts-swa-2026-23','xavvy-tenant-001','2026-06-10',3.5,'Unit testing and code review',1),
  ('te-swa-23-th','ts-swa-2026-23','xavvy-tenant-001','2026-06-11',3.5,'Dev environment deployment',1),
  ('te-swa-23-f','ts-swa-2026-23','xavvy-tenant-001','2026-06-12',3.5,'Sprint review preparation',1),
  ('te-pri-23-m','ts-pri-2026-23','xavvy-tenant-001','2026-06-08',3.5,'ETL pipeline design',1),
  ('te-pri-23-t','ts-pri-2026-23','xavvy-tenant-001','2026-06-09',3.5,'Analytics schema review',1),
  ('te-pri-23-w','ts-pri-2026-23','xavvy-tenant-001','2026-06-10',3.5,'Power BI data model refinement',1),
  ('te-pri-23-th','ts-pri-2026-23','xavvy-tenant-001','2026-06-11',3.5,'KPI validation with stakeholders',1),
  ('te-pri-23-f','ts-pri-2026-23','xavvy-tenant-001','2026-06-12',3.5,'Sprint review preparation',1),
  ('te-zeb-23-m','ts-zeb-2026-23','xavvy-tenant-001','2026-06-08',3.5,'Event storage indexing',1),
  ('te-zeb-23-t','ts-zeb-2026-23','xavvy-tenant-001','2026-06-09',3.5,'Query performance benchmarking',1),
  ('te-zeb-23-w','ts-zeb-2026-23','xavvy-tenant-001','2026-06-10',3.5,'D1 migration scripts',1),
  ('te-zeb-23-th','ts-zeb-2026-23','xavvy-tenant-001','2026-06-11',3.5,'Data retention policy implementation',1),
  ('te-zeb-23-f','ts-zeb-2026-23','xavvy-tenant-001','2026-06-12',3.5,'Sprint review preparation',1);

-- ═══════════════════════════════════════════════════════════════
-- LEAVE BALANCES — reinstate for all employees
-- ═══════════════════════════════════════════════════════════════
INSERT OR IGNORE INTO leave_balances (id,tenant_id,employee_id,leave_type_id,year,entitlement,taken,pending,carried_forward,updated_at) VALUES
  ('lb-nan-annual-2026','xavvy-tenant-001','emp-nanjusha-001','lt-annual',2026,25,8,0,3,CURRENT_TIMESTAMP),
  ('lb-pri-annual-2026','xavvy-tenant-001','emp-priya-001',   'lt-annual',2026,25,3,0,3,CURRENT_TIMESTAMP),
  ('lb-swa-annual-2026','xavvy-tenant-001','emp-swathi-001',  'lt-annual',2026,25,5,0,3,CURRENT_TIMESTAMP),
  ('lb-zeb-annual-2026','xavvy-tenant-001','emp-zeba-001',    'lt-annual',2026,25,5,0,3,CURRENT_TIMESTAMP),
  ('lb-nan-sick-2026',  'xavvy-tenant-001','emp-nanjusha-001','lt-sick',  2026,10,0,0,0,CURRENT_TIMESTAMP),
  ('lb-pri-sick-2026',  'xavvy-tenant-001','emp-priya-001',   'lt-sick',  2026,10,2,0,0,CURRENT_TIMESTAMP),
  ('lb-swa-sick-2026',  'xavvy-tenant-001','emp-swathi-001',  'lt-sick',  2026,10,0,0,0,CURRENT_TIMESTAMP),
  ('lb-zeb-sick-2026',  'xavvy-tenant-001','emp-zeba-001',    'lt-sick',  2026,10,0,0,0,CURRENT_TIMESTAMP);

-- Leave requests reflecting actual leave taken in 2026
INSERT OR IGNORE INTO leave_requests (id,tenant_id,employee_id,leave_type,start_date,end_date,days,reason,half_day,status,decided_at,comment,created_at) VALUES
  ('lr-nan-01','xavvy-tenant-001','emp-nanjusha-001','annual','2026-01-26','2026-01-30',5,'New Year break',0,'approved',CURRENT_TIMESTAMP,'Approved',CURRENT_TIMESTAMP),
  ('lr-nan-02','xavvy-tenant-001','emp-nanjusha-001','annual','2026-04-02','2026-04-04',3,'Easter break',  0,'approved',CURRENT_TIMESTAMP,'Approved',CURRENT_TIMESTAMP),
  ('lr-pri-01','xavvy-tenant-001','emp-priya-001',   'sick',  '2026-02-10','2026-02-11',2,'Unwell',        0,'approved',CURRENT_TIMESTAMP,'Get well soon',CURRENT_TIMESTAMP),
  ('lr-pri-02','xavvy-tenant-001','emp-priya-001',   'annual','2026-03-30','2026-03-31',1,'Doctor appointment',0,'approved',CURRENT_TIMESTAMP,'Approved',CURRENT_TIMESTAMP),
  ('lr-swa-01','xavvy-tenant-001','emp-swathi-001',  'annual','2026-02-16','2026-02-20',5,'Family holiday', 0,'approved',CURRENT_TIMESTAMP,'Approved',CURRENT_TIMESTAMP),
  ('lr-zeb-01','xavvy-tenant-001','emp-zeba-001',    'annual','2026-03-23','2026-03-27',5,'Spring break',   0,'approved',CURRENT_TIMESTAMP,'Approved',CURRENT_TIMESTAMP);

-- Resource bookings for current and upcoming weeks
INSERT OR IGNORE INTO resource_bookings (id,tenant_id,employee_id,project_id,booking_type,week_starting,hours,notes,created_by,created_at) VALUES
  ('rb-nan-w23','xavvy-tenant-001','emp-nanjusha-001','proj-iot-001','project','2026-06-08',17.5,'Phase 3 — PM & BA', NULL,CURRENT_TIMESTAMP),
  ('rb-pri-w23','xavvy-tenant-001','emp-priya-001',   'proj-iot-001','project','2026-06-08',17.5,'Phase 3 — ETL work', NULL,CURRENT_TIMESTAMP),
  ('rb-swa-w23','xavvy-tenant-001','emp-swathi-001',  'proj-iot-001','project','2026-06-08',17.5,'Phase 3 — Core APIs',NULL,CURRENT_TIMESTAMP),
  ('rb-zeb-w23','xavvy-tenant-001','emp-zeba-001',    'proj-iot-001','project','2026-06-08',17.5,'Phase 3 — DB work',  NULL,CURRENT_TIMESTAMP),
  ('rb-nan-w24','xavvy-tenant-001','emp-nanjusha-001','proj-iot-001','project','2026-06-15',17.5,'Phase 3 — PM & BA', NULL,CURRENT_TIMESTAMP),
  ('rb-pri-w24','xavvy-tenant-001','emp-priya-001',   'proj-iot-001','project','2026-06-15',17.5,'Phase 3 — ETL work', NULL,CURRENT_TIMESTAMP),
  ('rb-swa-w24','xavvy-tenant-001','emp-swathi-001',  'proj-iot-001','project','2026-06-15',17.5,'Phase 3 — Core APIs',NULL,CURRENT_TIMESTAMP),
  ('rb-zeb-w24','xavvy-tenant-001','emp-zeba-001',    'proj-iot-001','project','2026-06-15',17.5,'Phase 3 — DB work',  NULL,CURRENT_TIMESTAMP);


-- ════════════════════════════════════════════════════════════
-- 022_comments
-- ════════════════════════════════════════════════════════════
-- ============================================================
-- 022_comments_attachments.sql
-- Task comments and file attachments for PMO tasks
-- Run: wrangler d1 execute xavvysuite-fresh-db --local --file=schema/022_comments_attachments.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS task_comments (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id   TEXT NOT NULL REFERENCES tenants(id),
  task_id     TEXT NOT NULL REFERENCES pmo_tasks(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id),
  comment     TEXT NOT NULL,
  edited_at   TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id);

CREATE TABLE IF NOT EXISTS task_attachments (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id   TEXT NOT NULL REFERENCES tenants(id),
  task_id     TEXT NOT NULL REFERENCES pmo_tasks(id) ON DELETE CASCADE,
  uploaded_by TEXT NOT NULL REFERENCES users(id),
  file_name   TEXT NOT NULL,
  file_size   INTEGER,
  mime_type   TEXT,
  storage_key TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_task_attachments_task ON task_attachments(task_id);


-- ════════════════════════════════════════════════════════════
-- 023_clock
-- ════════════════════════════════════════════════════════════
-- ============================================================
-- 023_clock_in.sql
-- Clock in / out attendance tracking for mobile
-- Run: wrangler d1 execute xavvysuite-fresh-db --local --file=schema/023_clock_in.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS attendance_records (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  employee_id     TEXT NOT NULL REFERENCES employees(id),
  date            TEXT NOT NULL,  -- YYYY-MM-DD
  clocked_in_at   TEXT NOT NULL,  -- ISO timestamp
  clocked_out_at  TEXT,           -- NULL if still clocked in
  duration_mins   INTEGER,        -- calculated on clock-out
  location_in     TEXT,           -- lat,lng string
  location_out    TEXT,
  notes           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_attendance_emp_date ON attendance_records(employee_id, date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_open ON attendance_records(employee_id, date)
  WHERE clocked_out_at IS NULL;  -- only one open record per employee per day


-- ════════════════════════════════════════════════════════════
-- 024_gdpr
-- ════════════════════════════════════════════════════════════
-- ============================================================
-- 024_gdpr.sql
-- GDPR compliance infrastructure
-- Run: wrangler d1 execute xavvysuite-fresh-db --local --file=schema/024_gdpr.sql
-- ============================================================

-- ── Cookie / analytics consent (per browser session) ─────────
-- Stored server-side so we have an audit trail
CREATE TABLE IF NOT EXISTS cookie_consents (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  session_id      TEXT NOT NULL,           -- anonymous browser ID
  tenant_id       TEXT REFERENCES tenants(id),
  user_id         TEXT REFERENCES users(id), -- set after login
  necessary       INTEGER NOT NULL DEFAULT 1,  -- always true
  functional      INTEGER NOT NULL DEFAULT 0,
  analytics       INTEGER NOT NULL DEFAULT 0,
  marketing       INTEGER NOT NULL DEFAULT 0,
  ip_address      TEXT,
  user_agent      TEXT,
  consented_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  withdrawn_at    TEXT                         -- set if consent withdrawn
);
CREATE INDEX IF NOT EXISTS idx_cookie_consent_session ON cookie_consents(session_id);
CREATE INDEX IF NOT EXISTS idx_cookie_consent_user    ON cookie_consents(user_id);

-- ── Data Subject Access Requests (DSAR) ──────────────────────
CREATE TABLE IF NOT EXISTS data_subject_requests (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  employee_id     TEXT REFERENCES employees(id),
  requested_by    TEXT,                    -- email of requester (may be external)
  request_type    TEXT NOT NULL
    CHECK(request_type IN (
      'access',          -- SAR: send copy of all data
      'rectification',   -- correct inaccurate data
      'erasure',         -- right to be forgotten
      'restriction',     -- restrict processing
      'portability',     -- export in machine-readable format
      'objection'        -- object to processing
    )),
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending','in_progress','completed','rejected','withdrawn')),
  description     TEXT,
  response_notes  TEXT,
  due_date        TEXT,                    -- 30 days from request date (UK GDPR)
  completed_at    TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_dsar_tenant  ON data_subject_requests(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_dsar_emp     ON data_subject_requests(employee_id);

-- ── Data Processing Agreements (DPA) config ──────────────────
CREATE TABLE IF NOT EXISTS gdpr_config (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id       TEXT NOT NULL UNIQUE REFERENCES tenants(id),
  -- Data Protection Officer
  dpo_name        TEXT,
  dpo_email       TEXT,
  dpo_phone       TEXT,
  -- Company details for privacy notice
  company_reg     TEXT,
  ico_number      TEXT,                    -- ICO registration number (UK)
  privacy_policy_url TEXT,
  -- Data retention periods (days)
  retention_employee_data   INTEGER DEFAULT 2555,  -- 7 years
  retention_audit_logs      INTEGER DEFAULT 365,   -- 1 year
  retention_timesheets      INTEGER DEFAULT 2555,  -- 7 years (tax)
  retention_expenses        INTEGER DEFAULT 2555,  -- 7 years (tax)
  retention_leave_records   INTEGER DEFAULT 1825,  -- 5 years
  -- Lawful basis
  lawful_basis_hr         TEXT DEFAULT 'contract',
  lawful_basis_payroll    TEXT DEFAULT 'legal_obligation',
  lawful_basis_marketing  TEXT DEFAULT 'consent',
  -- Sub-processors acknowledged
  sub_processors_ack_at   TEXT,
  -- Last review
  last_reviewed_at        TEXT,
  created_at              TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Data breach log ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS data_breaches (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  discovered_at   TEXT NOT NULL,
  description     TEXT NOT NULL,
  data_types      TEXT,                    -- JSON array: ['names','emails','financial']
  individuals_affected INTEGER,
  risk_level      TEXT DEFAULT 'low'
    CHECK(risk_level IN ('low','medium','high','critical')),
  reported_to_ico INTEGER DEFAULT 0,       -- 1 = reported within 72h
  ico_reference   TEXT,
  remediation     TEXT,
  status          TEXT DEFAULT 'open'
    CHECK(status IN ('open','investigating','resolved','reported')),
  created_by      TEXT REFERENCES users(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Seed GDPR config for Xavvy tenant ─────────────────────────
INSERT OR IGNORE INTO gdpr_config (id, tenant_id, dpo_name, dpo_email, ico_number, retention_employee_data)
VALUES ('gdpr-xavvy-001', 'xavvy-tenant-001', 'Naveen Dhotre', 'naveen.dhotre@xavvy.uk', 'ZB123456', 2555);

-- ── Tenant settings: GDPR-related ────────────────────────────
INSERT OR IGNORE INTO tenant_settings (id, tenant_id, key, value) VALUES
  ('set-xavvy-08', 'xavvy-tenant-001', 'gdpr_enabled',          'true'),
  ('set-xavvy-09', 'xavvy-tenant-001', 'cookie_banner_enabled', 'true'),
  ('set-xavvy-10', 'xavvy-tenant-001', 'data_region',           '"UK"');

-- ── Enable GDPR module for tenant ────────────────────────────
INSERT OR IGNORE INTO tenant_modules (id, tenant_id, module_key, enabled)
VALUES ('tm-gdpr-xavvy-001', 'xavvy-tenant-001', 'gdpr', 1);


-- ════════════════════════════════════════════════════════════
-- 025_overtime
-- ════════════════════════════════════════════════════════════
-- ============================================================
-- 025_overtime_nationality.sql
-- TOIL / Overtime, Nationality-based leave rules, Onboarding wizard steps
-- Run: wrangler d1 execute xavvysuite-fresh-db --local --file=schema/025_overtime_nationality.sql
-- ============================================================

-- NOTE: If re-running on existing DB, ALTER TABLE statements will fail
-- with "duplicate column" — that is safe to ignore. Run each ALTER
-- separately if needed, or use: wrangler d1 execute --local --file=...
-- on a fresh DB only.

-- ── Overtime Records (feeds TOIL balance) ────────────────────
CREATE TABLE IF NOT EXISTS overtime_records (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  employee_id     TEXT NOT NULL REFERENCES employees(id),
  date            TEXT NOT NULL,
  hours           REAL NOT NULL CHECK(hours > 0),
  rate_multiplier REAL NOT NULL DEFAULT 1.0,  -- 1.0=straight, 1.5=time&half, 2.0=double
  toil_eligible   INTEGER NOT NULL DEFAULT 1,  -- 1 = converts to TOIL, 0 = paid
  toil_hours      REAL,                        -- actual TOIL hours credited (may differ from hours * rate)
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending','approved','paid','converted_to_toil','rejected')),
  approved_by     TEXT REFERENCES users(id),
  approved_at     TEXT,
  project_id      TEXT REFERENCES pmo_projects(id),
  timesheet_id    TEXT REFERENCES timesheets(id),
  notes           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_overtime_emp  ON overtime_records(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_overtime_tenant ON overtime_records(tenant_id, status);

-- ── Country-based leave entitlements ─────────────────────────
-- Adds country specificity to leave_types
ALTER TABLE leave_types ADD COLUMN country_code TEXT DEFAULT 'ALL';
ALTER TABLE leave_types ADD COLUMN statutory_minimum REAL DEFAULT 0;
-- carry_forward_expiry_months already in 007 schema — skip
-- ALTER TABLE leave_types ADD COLUMN carry_forward_expiry_months INTEGER DEFAULT 3;

-- ── Country statutory leave rules ────────────────────────────
CREATE TABLE IF NOT EXISTS country_leave_rules (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  country_code    TEXT NOT NULL,   -- GB, US, AE, IE, IN, DE etc.
  country_name    TEXT NOT NULL,
  leave_code      TEXT NOT NULL,   -- annual, sick, maternity etc.
  statutory_days  REAL NOT NULL,
  paid            INTEGER DEFAULT 1,
  notes           TEXT,
  UNIQUE(tenant_id, country_code, leave_code)
);
CREATE INDEX IF NOT EXISTS idx_country_leave ON country_leave_rules(tenant_id, country_code);

-- ── Onboarding wizard — extend steps ─────────────────────────
ALTER TABLE tenant_onboarding ADD COLUMN total_steps INTEGER DEFAULT 6;
ALTER TABLE tenant_onboarding ADD COLUMN current_step_index INTEGER DEFAULT 0;

-- ── Seed: TOIL leave type (already in 007 but ensure it exists) ──
INSERT OR IGNORE INTO leave_types
  (id, tenant_id, name, code, colour, paid, requires_approval, carry_forward, carry_forward_max, half_day_allowed, is_system, enabled)
VALUES
  ('lt-toil', 'xavvy-tenant-001', 'Time Off In Lieu (TOIL)', 'toil', '#A855F7', 1, 1, 1, 20, 1, 1, 1);

-- ── Seed: Country leave rules ─────────────────────────────────
INSERT OR IGNORE INTO country_leave_rules (id, tenant_id, country_code, country_name, leave_code, statutory_days, paid, notes) VALUES
  -- United Kingdom
  ('clr-gb-annual',     'xavvy-tenant-001', 'GB', 'United Kingdom', 'annual',      28,  1, '5.6 weeks incl. bank holidays — Working Time Regulations 1998'),
  ('clr-gb-sick',       'xavvy-tenant-001', 'GB', 'United Kingdom', 'sick',        0,   1, 'SSP from day 4 — £116.75/week (2025/26)'),
  ('clr-gb-maternity',  'xavvy-tenant-001', 'GB', 'United Kingdom', 'maternity',   365, 1, '52 weeks — SMP 90% for 6wks then £184.03/week for 33wks'),
  ('clr-gb-paternity',  'xavvy-tenant-001', 'GB', 'United Kingdom', 'paternity',   14,  1, '2 weeks statutory'),
  ('clr-gb-compassionate','xavvy-tenant-001','GB','United Kingdom', 'compassionate',3,  1, 'No statutory minimum — 3 days common practice'),
  -- United States
  ('clr-us-annual',     'xavvy-tenant-001', 'US', 'United States',  'annual',      0,   1, 'No federal minimum — typically 10-15 days'),
  ('clr-us-sick',       'xavvy-tenant-001', 'US', 'United States',  'sick',        5,   1, 'Varies by state — 40-80hrs common'),
  ('clr-us-maternity',  'xavvy-tenant-001', 'US', 'United States',  'maternity',   84,  0, 'FMLA: 12 weeks unpaid'),
  ('clr-us-paternity',  'xavvy-tenant-001', 'US', 'United States',  'paternity',   84,  0, 'FMLA: 12 weeks unpaid'),
  -- UAE
  ('clr-ae-annual',     'xavvy-tenant-001', 'AE', 'United Arab Emirates', 'annual', 30, 1, '30 calendar days — UAE Labour Law'),
  ('clr-ae-sick',       'xavvy-tenant-001', 'AE', 'United Arab Emirates', 'sick',   90, 1, '15 days full pay, 30 days half pay, 45 days unpaid'),
  ('clr-ae-maternity',  'xavvy-tenant-001', 'AE', 'United Arab Emirates', 'maternity', 60, 1, '60 days full pay'),
  ('clr-ae-paternity',  'xavvy-tenant-001', 'AE', 'United Arab Emirates', 'paternity', 5, 1, '5 days'),
  -- Ireland
  ('clr-ie-annual',     'xavvy-tenant-001', 'IE', 'Ireland',        'annual',      28,  1, '4 weeks — Organisation of Working Time Act 1997'),
  ('clr-ie-sick',       'xavvy-tenant-001', 'IE', 'Ireland',        'sick',        10,  1, '70% up to €110/day — Sick Leave Act 2022'),
  ('clr-ie-maternity',  'xavvy-tenant-001', 'IE', 'Ireland',        'maternity',   182, 1, '26 weeks + 16 unpaid'),
  -- India
  ('clr-in-annual',     'xavvy-tenant-001', 'IN', 'India',          'annual',      21,  1, 'Factories Act: 1 day per 20 days worked'),
  ('clr-in-sick',       'xavvy-tenant-001', 'IN', 'India',          'sick',        12,  1, '12 days — varies by state'),
  ('clr-in-maternity',  'xavvy-tenant-001', 'IN', 'India',          'maternity',   182, 1, '26 weeks — Maternity Benefit Act 2017'),
  -- Germany
  ('clr-de-annual',     'xavvy-tenant-001', 'DE', 'Germany',        'annual',      24,  1, '24 working days minimum — Federal Leave Act'),
  ('clr-de-sick',       'xavvy-tenant-001', 'DE', 'Germany',        'sick',        42,  1, '6 weeks full pay from employer, then health insurance'),
  ('clr-de-maternity',  'xavvy-tenant-001', 'DE', 'Germany',        'maternity',   98,  1, '14 weeks — 6 before + 8 after birth');

-- ── Seed: Tenant onboarding record ───────────────────────────
INSERT OR IGNORE INTO tenant_onboarding (id, tenant_id, step, completed_steps)
VALUES ('to-xavvy-001', 'xavvy-tenant-001', 'complete', '["profile","leave","team","modules","branding","complete"]');

-- ════════════════════════════════════════════════════════════
-- Missing module enablements + demo seed data
-- ════════════════════════════════════════════════════════════

-- ── Enable new modules for Xavvy tenant ──────────────────────
INSERT OR IGNORE INTO tenant_modules (id, tenant_id, module_key, enabled) VALUES
  ('tm-p-clients',    'xavvy-tenant-001', 'clients',       1),
  ('tm-p-invoicing',  'xavvy-tenant-001', 'invoicing',     1),
  ('tm-p-resources',  'xavvy-tenant-001', 'resources',     1),
  ('tm-p-onboard',    'xavvy-tenant-001', 'onboarding',    1),
  ('tm-p-offboard',   'xavvy-tenant-001', 'offboarding',   1),
  ('tm-p-gdpr',       'xavvy-tenant-001', 'gdpr',          1),
  ('tm-p-settings',   'xavvy-tenant-001', 'settings',      1),
  ('tm-p-billing',    'xavvy-tenant-001', 'billing',       1),
  ('tm-p-leaveset',   'xavvy-tenant-001', 'leave_settings',1),
  ('tm-p-dashboard',  'xavvy-tenant-001', 'dashboard',     1),
  ('tm-p-audit',      'xavvy-tenant-001', 'audit',         1),
  ('tm-p-orgchart',   'xavvy-tenant-001', 'orgchart',      1),
  ('tm-p-workflow',   'xavvy-tenant-001', 'workflow',      1),
  ('tm-p-scheduler',  'xavvy-tenant-001', 'scheduler',     1),
  ('tm-p-pmo',        'xavvy-tenant-001', 'pmo',           1),
  ('tm-p-timesheets', 'xavvy-tenant-001', 'timesheets',    1),
  ('tm-p-leave',      'xavvy-tenant-001', 'leave',         1),
  ('tm-p-hr',         'xavvy-tenant-001', 'hr',            1),
  ('tm-p-expenses',   'xavvy-tenant-001', 'expenses',      1),
  ('tm-p-reporting',  'xavvy-tenant-001', 'reporting',     1),
  ('tm-p-recruit',    'xavvy-tenant-001', 'recruitment',   1),
  ('tm-p-docs',       'xavvy-tenant-001', 'documents',     1),
  ('tm-p-training',   'xavvy-tenant-001', 'training',      1),
  ('tm-p-announce',   'xavvy-tenant-001', 'announcements', 1),
  ('tm-p-compliance', 'xavvy-tenant-001', 'compliance',    1),
  ('tm-p-sos',        'xavvy-tenant-001', 'sos',           1),
  ('tm-p-checklists', 'xavvy-tenant-001', 'checklists',    1),
  ('tm-p-assets',     'xavvy-tenant-001', 'assets',        1),
  ('tm-p-visa',       'xavvy-tenant-001', 'visa',          1);

-- ── Demo clients ─────────────────────────────────────────────
INSERT OR IGNORE INTO clients (
  id, tenant_id, company_name, industry, is_active,
  payment_terms_days, currency_code, invoice_email, created_at, updated_at
) VALUES
  ('client-001', 'xavvy-tenant-001', 'Acme Corp',        'Technology', 1, 30, 'GBP', 'accounts@acme.com',     CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('client-002', 'xavvy-tenant-001', 'Globex Solutions', 'Consulting', 1, 14, 'GBP', 'billing@globex.com',    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('client-003', 'xavvy-tenant-001', 'Initech Ltd',      'Finance',    1, 30, 'GBP', 'finance@initech.co.uk', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- ── Demo client contacts ──────────────────────────────────────
INSERT OR IGNORE INTO client_contacts (
  id, tenant_id, client_id, full_name, email, phone, contact_type
) VALUES
  ('cc-001', 'xavvy-tenant-001', 'client-001', 'John Smith',  'john@acme.com',       '+44 20 1234 5678', 'liaison'),
  ('cc-002', 'xavvy-tenant-001', 'client-002', 'Sarah Jones', 'sarah@globex.com',    '+44 20 9876 5432', 'finance'),
  ('cc-003', 'xavvy-tenant-001', 'client-003', 'Mike Brown',  'mike@initech.co.uk',  '+44 20 5555 0000', 'liaison');

-- ── Invoice sequence ──────────────────────────────────────────
INSERT OR IGNORE INTO invoice_sequences (tenant_id, year, last_seq)
VALUES ('xavvy-tenant-001', strftime('%Y', 'now'), 1000);

-- ── Demo invoice ─────────────────────────────────────────────
INSERT OR IGNORE INTO invoices (
  id, tenant_id, client_id, invoice_number, status,
  issue_date, due_date, subtotal, tax_rate, tax_amount, total,
  currency_code, created_by, created_at
) VALUES (
  'inv-001', 'xavvy-tenant-001', 'client-001', 'INV-1000', 'draft',
  date('now'), date('now', '+30 days'),
  5000.00, 20.0, 1000.00, 6000.00,
  'GBP', 'usr-admin-001', CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO invoice_line_items (
  id, invoice_id, tenant_id, sort_order, description, quantity, unit_price, amount
) VALUES
  ('ili-001', 'inv-001', 'xavvy-tenant-001', 1, 'Software Development Services — May 2026', 10, 450.00, 4500.00),
  ('ili-002', 'inv-001', 'xavvy-tenant-001', 2, 'Project Management',                        2, 250.00,  500.00);

-- ── Team users for prod (nanjusha, priya, swathi, zeba) ──────
-- Already created in IOT_SEED but ensure passwords are set correctly

-- ── Ensure all team users have correct password hash ─────────
UPDATE users SET password_hash = 'sha256:xavvy2025:b9d692c361dec52f5ac1fbd19de61752a7d5262d425d7568a17be0ecd4db5ea8' WHERE tenant_id = 'xavvy-tenant-001';


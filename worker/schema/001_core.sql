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

CREATE TABLE IF NOT EXISTS job_applications (
  id         TEXT PRIMARY KEY,
  tenant_id  TEXT NOT NULL REFERENCES tenants(id),
  job_id     TEXT NOT NULL REFERENCES job_postings(id),
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  phone      TEXT,
  cv_r2_key  TEXT,
  status     TEXT NOT NULL DEFAULT 'applied' CHECK (status IN ('applied','screening','interview','offer','hired','rejected')),
  notes      TEXT,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

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

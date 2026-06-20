-- ============================================================
-- XavvySuite — Offboarding, SOS, Resources, Doc Expiry
-- 013_remaining_features.sql
-- ============================================================

PRAGMA foreign_keys = OFF;

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

PRAGMA foreign_keys = ON;

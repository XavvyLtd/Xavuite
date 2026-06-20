-- ============================================================
-- XavvySuite — Visa Management Schema
-- 009_visa_management.sql
-- ============================================================

PRAGMA foreign_keys = OFF;

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

PRAGMA foreign_keys = ON;

-- ============================================================
-- XavvySuite — Employee Full Profile Schema
-- 010_employee_profile.sql
-- ============================================================

PRAGMA foreign_keys = OFF;

-- ── Emergency contacts ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employee_emergency_contacts (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL REFERENCES tenants(id),
  employee_id  TEXT NOT NULL REFERENCES employees(id),
  name         TEXT NOT NULL,
  relationship TEXT NOT NULL,
  phone        TEXT NOT NULL,
  email        TEXT,
  is_primary   INTEGER DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- ── Bank / payment details (stored encrypted in production) ───────────────────
CREATE TABLE IF NOT EXISTS employee_bank_details (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL REFERENCES tenants(id),
  employee_id    TEXT NOT NULL REFERENCES employees(id),
  account_name   TEXT NOT NULL,
  bank_name      TEXT NOT NULL,
  sort_code      TEXT NOT NULL,
  account_number TEXT NOT NULL,
  is_primary     INTEGER DEFAULT 1,
  created_at     TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- ── Compensation history ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employee_compensation (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL REFERENCES tenants(id),
  employee_id    TEXT NOT NULL REFERENCES employees(id),
  effective_from TEXT NOT NULL,
  salary         REAL NOT NULL,
  currency       TEXT NOT NULL DEFAULT 'GBP',
  pay_frequency  TEXT NOT NULL DEFAULT 'annual'
    CHECK (pay_frequency IN ('annual','monthly','weekly','daily','hourly')),
  change_reason  TEXT,
  change_pct     REAL,
  notes          TEXT,
  created_by     TEXT REFERENCES users(id),
  created_at     TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_compensation_employee ON employee_compensation(tenant_id, employee_id, effective_from DESC);

PRAGMA foreign_keys = ON;

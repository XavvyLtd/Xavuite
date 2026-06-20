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

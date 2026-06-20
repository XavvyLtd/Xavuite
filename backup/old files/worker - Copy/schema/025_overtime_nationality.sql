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

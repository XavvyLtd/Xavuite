-- ============================================================
-- XavvySuite — Leave Enhancements Schema
-- 007_leave_enhancements.sql
-- ============================================================

PRAGMA foreign_keys = OFF;

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

PRAGMA foreign_keys = ON;

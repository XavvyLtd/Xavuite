-- ════════════════════════════════════════════════════════════
-- payroll_runs_add_saved_action.sql
-- Adds 'saved' as a valid action alongside loaded/exported/emailed,
-- for the new "Save Adjustments" button. SQLite can't ALTER a CHECK
-- constraint directly, so this recreates the table with the wider
-- constraint and copies any existing rows across. Safe to run even
-- if payroll_runs is still empty.
-- ════════════════════════════════════════════════════════════

CREATE TABLE payroll_runs_new (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  year            INTEGER NOT NULL,
  month           INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  employee_count  INTEGER NOT NULL DEFAULT 0,
  total_gross     REAL NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'GBP',
  rows_snapshot   TEXT NOT NULL,
  action          TEXT NOT NULL CHECK (action IN ('loaded','exported','emailed','saved')),
  emailed_to      TEXT,
  run_by          TEXT REFERENCES users(id),
  run_at          TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

INSERT INTO payroll_runs_new
  SELECT id, tenant_id, year, month, employee_count, total_gross, currency,
         rows_snapshot, action, emailed_to, run_by, run_at
  FROM payroll_runs;

DROP TABLE payroll_runs;
ALTER TABLE payroll_runs_new RENAME TO payroll_runs;

CREATE INDEX IF NOT EXISTS idx_payroll_runs_period
  ON payroll_runs(tenant_id, year, month);

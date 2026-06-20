-- ════════════════════════════════════════════════════════════
-- payroll_runs_table_v2.sql
-- A payroll_runs table already existed on remote with a different,
-- incompatible schema (payroll_month/status/approved_by columns,
-- no year/month/action/rows_snapshot) from an earlier attempt.
-- Confirmed empty (0 rows) before dropping — safe to replace cleanly
-- rather than ALTER around it.
-- ════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS payroll_runs;

CREATE TABLE payroll_runs (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  year            INTEGER NOT NULL,
  month           INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  employee_count  INTEGER NOT NULL DEFAULT 0,
  total_gross     REAL NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'GBP',
  rows_snapshot   TEXT NOT NULL,                 -- JSON array of PayrollRow, as exported/emailed
  action          TEXT NOT NULL CHECK (action IN ('loaded','exported','emailed')),
  emailed_to      TEXT,                          -- NULL unless action='emailed'
  run_by          TEXT REFERENCES users(id),
  run_at          TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_payroll_runs_period
  ON payroll_runs(tenant_id, year, month);

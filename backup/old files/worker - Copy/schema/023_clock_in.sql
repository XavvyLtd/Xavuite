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

-- ════════════════════════════════════════════════════════════
-- employee_compensation_widen_frequency.sql
-- The Pay tab's frequency dropdown offers annual/monthly/weekly/
-- daily/hourly, but the original CHECK constraint only allowed
-- monthly/fortnightly/weekly — every "annual", "daily" or "hourly"
-- save was rejected with a 500. Widening the constraint to match
-- what the UI actually offers. SQLite can't ALTER a CHECK directly,
-- so this recreates the table and copies any existing rows across.
-- ════════════════════════════════════════════════════════════

CREATE TABLE employee_compensation_new (
  id                TEXT PRIMARY KEY,
  employee_id       TEXT NOT NULL REFERENCES employees(id),
  tenant_id         TEXT NOT NULL REFERENCES tenants(id),
  pay_type          TEXT NOT NULL DEFAULT 'salary' CHECK (pay_type IN ('salary','hourly','daily_rate','commission')),
  base_salary       REAL NOT NULL,
  currency          TEXT NOT NULL DEFAULT 'GBP',
  pay_frequency     TEXT NOT NULL DEFAULT 'monthly'
                      CHECK (pay_frequency IN ('annual','monthly','fortnightly','weekly','daily','hourly')),
  hours_per_week    REAL DEFAULT 37.5,
  overtime_eligible INTEGER DEFAULT 0,
  effective_from    TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  effective_to      TEXT,
  is_current        INTEGER NOT NULL DEFAULT 1,
  change_reason     TEXT,
  approved_by       TEXT REFERENCES users(id),
  changed_by        TEXT REFERENCES users(id)
);

INSERT INTO employee_compensation_new
  SELECT id, employee_id, tenant_id, pay_type, base_salary, currency, pay_frequency,
         hours_per_week, overtime_eligible, effective_from, effective_to, is_current,
         change_reason, approved_by, changed_by
  FROM employee_compensation;

DROP TABLE employee_compensation;
ALTER TABLE employee_compensation_new RENAME TO employee_compensation;

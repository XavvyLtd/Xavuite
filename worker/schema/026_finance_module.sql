CREATE TABLE IF NOT EXISTS payroll_runs (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    payroll_month TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Draft',
    email_to TEXT,
    total_employees INTEGER,
    total_gross_pay REAL,
    approved_by TEXT,
    approved_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payroll_run_lines (
    id TEXT PRIMARY KEY,
    payroll_run_id TEXT NOT NULL,
    employee_id TEXT NOT NULL,
    monthly_salary REAL,
    working_days INTEGER,
    worked_days INTEGER,
    paid_leave_days INTEGER DEFAULT 0,
    unpaid_leave_days INTEGER DEFAULT 0,
    public_holiday_days INTEGER DEFAULT 0,
    payroll_days INTEGER,
    gross_pay REAL,
    notes TEXT
);
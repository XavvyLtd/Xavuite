-- Add to a new migration: 016_performance_indexes.sql 
-- Estimated query speedup: 5–20× on high-traffic endpoints 

CREATE INDEX IF NOT EXISTS idx_timesheets_emp_week ON timesheets(tenant_id, employee_id, week_starting, status); 

-- Fixes: timesheet reporting, resource capacity, auto-CRON lookup 
CREATE INDEX IF NOT EXISTS idx_timesheet_entries_ts ON timesheet_entries(timesheet_id, hours_worked); 

-- Fixes: all SUM(hours_worked) aggregates, utilisation reports 
CREATE INDEX IF NOT EXISTS idx_leave_requests_emp_status ON leave_requests(tenant_id, employee_id, status, start_date, end_date); 

-- Fixes: leave calendar, leave balance calculation, dashboard pending count 
CREATE INDEX IF NOT EXISTS idx_employee_history_current ON employee_history(tenant_id, is_current, employee_id); 

-- Fixes: every query that JOINs employee_history with is_current=1 (dozens of routes) 
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_time ON audit_log(tenant_id, created_at DESC); 

-- Fixes: dashboard recent activity, audit log paging 
CREATE INDEX IF NOT EXISTS idx_leave_balances_emp_year ON leave_balances(tenant_id, employee_id, year, leave_type_id); 

-- Fixes: leave balance fetch on HR profile + initialise queries
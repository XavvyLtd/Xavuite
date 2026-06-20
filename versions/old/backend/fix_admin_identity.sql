-- ====================================================================
-- XAVVYHR: ROOT IDENTITY RECOVERY MAPPING
-- Re-establishes Admin primary key connections for tracking tables
-- ====================================================================

-- 1. Purge mismatched history paths to prevent constraint blocks
DELETE FROM history WHERE employee_id NOT IN (SELECT id FROM employees);

-- 2. Verify or insert the executive administrator master anchor node
INSERT OR REPLACE INTO employees (id, user_id, name, department, designation, joining_date, mobile, address, salary, start_date, status)
VALUES (1, 1, 'Xavvy Administrator', 'Executive', 'System Admin Master Node', '2026-01-01', '+44 7700 900077', 'HQ Operational Core', 120000.00, '2026-01-01', 'Active');
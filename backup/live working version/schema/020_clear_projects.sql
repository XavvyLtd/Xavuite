-- 020_clear_projects.sql
-- Delete in strict dependency order — no PRAGMA needed

-- Children of timesheets
DELETE FROM timesheet_entries;

-- Children of pmo_tasks / pmo_sprints / pmo_projects / pmo_allocations
DELETE FROM resource_bookings;

-- Timesheets themselves
DELETE FROM timesheets;

-- PMO child tables
DELETE FROM pmo_allocations;
DELETE FROM pmo_tasks;
DELETE FROM pmo_sprints;

-- PMO root
DELETE FROM pmo_projects;

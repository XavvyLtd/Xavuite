-- =====================================================
-- PMS TASK ENHANCEMENTS
-- =====================================================

ALTER TABLE pms_tasks
ADD COLUMN estimated_hours INTEGER DEFAULT 8;

ALTER TABLE pms_tasks
ADD COLUMN allocated_hours INTEGER DEFAULT 0;

ALTER TABLE pms_tasks
ADD COLUMN priority INTEGER DEFAULT 1;

ALTER TABLE pms_tasks
ADD COLUMN created_at TEXT;

ALTER TABLE pms_tasks
ADD COLUMN updated_at TEXT;

-- =====================================================
-- TIMESHEET TRACEABILITY
-- =====================================================

ALTER TABLE timesheets
ADD COLUMN task_id INTEGER;

ALTER TABLE timesheets
ADD COLUMN sprint_id INTEGER;

UPDATE pms_tasks
SET
  created_at = CURRENT_TIMESTAMP,
  updated_at = CURRENT_TIMESTAMP
WHERE created_at IS NULL;
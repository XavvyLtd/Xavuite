-- 017_timesheet_entry_task.sql
-- Add project_id + task_id to individual timesheet entries
-- so each daily row can log time against a specific task

ALTER TABLE timesheet_entries ADD COLUMN project_id TEXT REFERENCES pmo_projects(id);
ALTER TABLE timesheet_entries ADD COLUMN task_id    TEXT REFERENCES pmo_tasks(id);
CREATE INDEX IF NOT EXISTS idx_te_project ON timesheet_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_te_task    ON timesheet_entries(task_id);

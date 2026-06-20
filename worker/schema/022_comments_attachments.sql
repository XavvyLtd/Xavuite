-- ============================================================
-- 022_comments_attachments.sql
-- Task comments and file attachments for PMO tasks
-- Run: wrangler d1 execute xavvysuite-fresh-db --local --file=schema/022_comments_attachments.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS task_comments (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id   TEXT NOT NULL REFERENCES tenants(id),
  task_id     TEXT NOT NULL REFERENCES pmo_tasks(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id),
  comment     TEXT NOT NULL,
  edited_at   TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id);

CREATE TABLE IF NOT EXISTS task_attachments (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id   TEXT NOT NULL REFERENCES tenants(id),
  task_id     TEXT NOT NULL REFERENCES pmo_tasks(id) ON DELETE CASCADE,
  uploaded_by TEXT NOT NULL REFERENCES users(id),
  file_name   TEXT NOT NULL,
  file_size   INTEGER,
  mime_type   TEXT,
  storage_key TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_task_attachments_task ON task_attachments(task_id);

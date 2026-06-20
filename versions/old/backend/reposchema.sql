-- schema.sql
DROP TABLE IF EXISTS repo_files;
CREATE TABLE repo_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_key TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  is_active INTEGER DEFAULT 1,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed the system-wide static Company Workspace to ensure it initializes even with zero uploads
INSERT INTO repo_files (project_id, user_email, filename, file_key, version, is_active)
SELECT 'Company', 'admin@xavvy.uk', '.placeholder', 'system/placeholder', 1, 0
WHERE NOT EXISTS (SELECT 1 FROM repo_files WHERE project_id = 'Company');
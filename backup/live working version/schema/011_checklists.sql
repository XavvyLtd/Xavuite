-- ============================================================
-- XavvySuite — Checklists Module Schema
-- 011_checklists.sql
-- ============================================================

PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS checklist_templates (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id),
  name        TEXT NOT NULL,
  description TEXT,
  category    TEXT NOT NULL DEFAULT 'operational'
    CHECK (category IN ('operational','site_audit','compliance','hr','it','custom')),
  enabled     INTEGER DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE IF NOT EXISTS checklist_template_tasks (
  id           TEXT PRIMARY KEY,
  template_id  TEXT NOT NULL REFERENCES checklist_templates(id),
  tenant_id    TEXT NOT NULL REFERENCES tenants(id),
  title        TEXT NOT NULL,
  description  TEXT,
  required     INTEGER DEFAULT 1,
  task_order   INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS checklist_runs (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL REFERENCES tenants(id),
  template_id    TEXT NOT NULL REFERENCES checklist_templates(id),
  title          TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress','completed','overdue','cancelled')),
  completion_pct INTEGER DEFAULT 0,
  due_date       TEXT,
  assigned_to    TEXT REFERENCES employees(id),
  completed_at   TEXT,
  created_by     TEXT REFERENCES users(id),
  created_at     TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE IF NOT EXISTS checklist_run_tasks (
  id           TEXT PRIMARY KEY,
  run_id       TEXT NOT NULL REFERENCES checklist_runs(id),
  tenant_id    TEXT NOT NULL REFERENCES tenants(id),
  title        TEXT NOT NULL,
  description  TEXT,
  required     INTEGER DEFAULT 1,
  status       TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','completed','skipped','na')),
  completed_at TEXT,
  completed_by TEXT REFERENCES users(id),
  notes        TEXT,
  task_order   INTEGER DEFAULT 0
);

-- Seed templates
INSERT OR IGNORE INTO checklist_templates (id, tenant_id, name, description, category) VALUES
  ('ct-daily-ops',  'xavvy-tenant-001', 'Daily Operations Check',    'Daily opening and closing tasks', 'operational'),
  ('ct-site-audit', 'xavvy-tenant-001', 'Monthly Site Audit',         'Health, safety and facilities audit', 'site_audit'),
  ('ct-new-starter','xavvy-tenant-001', 'IT New Starter Setup',       'IT equipment and access provisioning', 'it'),
  ('ct-compliance', 'xavvy-tenant-001', 'Quarterly Compliance Review','Regulatory and policy compliance check', 'compliance');

INSERT OR IGNORE INTO checklist_template_tasks (id, template_id, tenant_id, title, required, task_order) VALUES
  ('ctt-01','ct-daily-ops','xavvy-tenant-001','Check and respond to urgent emails',1,1),
  ('ctt-02','ct-daily-ops','xavvy-tenant-001','Review pending approvals',1,2),
  ('ctt-03','ct-daily-ops','xavvy-tenant-001','Check compliance alerts',1,3),
  ('ctt-04','ct-daily-ops','xavvy-tenant-001','Review team attendance',0,4),
  ('ctt-05','ct-site-audit','xavvy-tenant-001','Fire exit inspection',1,1),
  ('ctt-06','ct-site-audit','xavvy-tenant-001','First aid kit check',1,2),
  ('ctt-07','ct-site-audit','xavvy-tenant-001','CCTV system operational',1,3),
  ('ctt-08','ct-site-audit','xavvy-tenant-001','Clean desk policy compliance',0,4),
  ('ctt-09','ct-site-audit','xavvy-tenant-001','Visitor book up to date',1,5),
  ('ctt-10','ct-new-starter','xavvy-tenant-001','Order laptop and accessories',1,1),
  ('ctt-11','ct-new-starter','xavvy-tenant-001','Create email and system accounts',1,2),
  ('ctt-12','ct-new-starter','xavvy-tenant-001','Set up VPN access',1,3),
  ('ctt-13','ct-new-starter','xavvy-tenant-001','Issue access card / fob',0,4),
  ('ctt-14','ct-new-starter','xavvy-tenant-001','Configure MFA on all accounts',1,5),
  ('ctt-15','ct-compliance','xavvy-tenant-001','Review all RTW checks',1,1),
  ('ctt-16','ct-compliance','xavvy-tenant-001','Verify training completions',1,2),
  ('ctt-17','ct-compliance','xavvy-tenant-001','Check visa expiry dates',1,3),
  ('ctt-18','ct-compliance','xavvy-tenant-001','Review policy acknowledgements',1,4);

PRAGMA foreign_keys = ON;

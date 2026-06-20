-- ============================================================
-- 018_pmo_client_resources.sql  (v3 — collision-safe)
-- ============================================================

-- ── Schema additions (safe to run even if partially run before) ─
-- D1 will error if column exists — that's OK, it means it ran before
-- Run each ALTER separately via --command if needed

ALTER TABLE pmo_projects ADD COLUMN description  TEXT;
ALTER TABLE pmo_projects ADD COLUMN colour       TEXT DEFAULT '#6366F1';
ALTER TABLE pmo_projects ADD COLUMN project_type TEXT DEFAULT 'general'
  CHECK(project_type IN ('iot','data_migration','platform','support','training','general'));
ALTER TABLE pmo_allocations ADD COLUMN hours_per_week REAL DEFAULT 17.5;
ALTER TABLE pmo_allocations ADD COLUMN notes          TEXT;

-- ── Update existing IoT project ───────────────────────────────
UPDATE pmo_projects
SET project_type = 'iot', colour = '#0EA5E9',
    description  = 'SEWIO warehouse tracking — real-time asset location, sensor telemetry and analytics dashboards.'
WHERE name LIKE '%SEWIO%' OR name LIKE '%IoT%';

-- ════════════════════════════════════════════════════════════════
-- PROJECTS — INSERT...SELECT avoids subquery-in-VALUES issue
-- Sprint numbers start at 100+ to avoid UNIQUE(tenant_id,sprint_number) collision
-- Employee IDs use known seeded values from 003_iot_project.sql
-- ════════════════════════════════════════════════════════════════

-- ── Data Analysis & Migration ─────────────────────────────────
INSERT OR IGNORE INTO pmo_projects (id, tenant_id, name, description, project_type, colour, start_date, end_date, budget, priority, status, created_at)
SELECT 'proj-data-001', id, 'Data Analysis & Migration — Retail Client',
  'Legacy ERP to cloud data warehouse. Data profiling, ETL build, validation, Power BI dashboards and hypercare.',
  'data_migration', '#8B5CF6', '2026-02-01', '2026-10-31', 95000, 'high', 'active', datetime('now')
FROM tenants LIMIT 1;

INSERT OR IGNORE INTO pmo_sprints (id, tenant_id, project_id, sprint_number, sprint_name, status, start_date, end_date)
SELECT 'spr-dm-01', id, 'proj-data-001', 101, 'Data Profiling & Discovery', 'completed', '2026-02-01', '2026-03-15' FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_sprints (id, tenant_id, project_id, sprint_number, sprint_name, status, start_date, end_date)
SELECT 'spr-dm-02', id, 'proj-data-001', 102, 'ETL Design & Build', 'active', '2026-03-16', '2026-05-31' FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_sprints (id, tenant_id, project_id, sprint_number, sprint_name, status, start_date, end_date)
SELECT 'spr-dm-03', id, 'proj-data-001', 103, 'Validation & Dashboards', 'upcoming', '2026-06-01', '2026-09-30' FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_sprints (id, tenant_id, project_id, sprint_number, sprint_name, status, start_date, end_date)
SELECT 'spr-dm-04', id, 'proj-data-001', 104, 'Go-Live & Hypercare', 'upcoming', '2026-10-01', '2026-10-31' FROM tenants LIMIT 1;

INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, task_order, created_at, updated_at)
SELECT 'tsk-dm-001', id, 'proj-data-001', 'spr-dm-01', 'Source system inventory', 'Catalogue all source tables, owners, row counts and quality issues', 'emp-priya-001', 'high', 'done', 16, '2026-02-14', 'Discovery', 'Analysis', 1, datetime('now'), datetime('now') FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, task_order, created_at, updated_at)
SELECT 'tsk-dm-002', id, 'proj-data-001', 'spr-dm-01', 'Data profiling report', 'Nulls, dupes, formats, outliers on all source tables', 'emp-zeba-001', 'high', 'done', 24, '2026-02-28', 'Discovery', 'Analysis', 2, datetime('now'), datetime('now') FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, task_order, created_at, updated_at)
SELECT 'tsk-dm-003', id, 'proj-data-001', 'spr-dm-01', 'Source-to-target mapping', 'Map source fields to warehouse schema, flag transformations', 'emp-priya-001', 'high', 'done', 20, '2026-03-10', 'Discovery', 'Design', 3, datetime('now'), datetime('now') FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, task_order, created_at, updated_at)
SELECT 'tsk-dm-004', id, 'proj-data-001', 'spr-dm-02', 'Bronze layer pipelines', 'Raw ingestion pipelines from all sources into landing zone', 'emp-priya-001', 'critical', 'in_progress', 40, '2026-04-30', 'ETL Build', 'Engineering', 1, datetime('now'), datetime('now') FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, task_order, created_at, updated_at)
SELECT 'tsk-dm-005', id, 'proj-data-001', 'spr-dm-02', 'Silver layer transformations', 'Cleanse, deduplicate and conform data', 'emp-zeba-001', 'critical', 'in_progress', 48, '2026-05-15', 'ETL Build', 'Engineering', 2, datetime('now'), datetime('now') FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, task_order, created_at, updated_at)
SELECT 'tsk-dm-006', id, 'proj-data-001', 'spr-dm-02', 'Gold layer aggregates', 'Business-ready facts and dimensions', 'emp-priya-001', 'high', 'todo', 32, '2026-05-25', 'ETL Build', 'Engineering', 3, datetime('now'), datetime('now') FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, task_order, created_at, updated_at)
SELECT 'tsk-dm-007', id, 'proj-data-001', 'spr-dm-03', 'Reconciliation testing', 'Row count, sum and sample checks vs source', 'emp-zeba-001', 'high', 'backlog', 32, '2026-07-31', 'Validation', 'QA', 1, datetime('now'), datetime('now') FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, task_order, created_at, updated_at)
SELECT 'tsk-dm-008', id, 'proj-data-001', 'spr-dm-03', 'Power BI dashboards', 'Sales, inventory and operational dashboards', 'emp-priya-001', 'high', 'backlog', 40, '2026-09-15', 'Dashboards', 'Analytics', 2, datetime('now'), datetime('now') FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, task_order, created_at, updated_at)
SELECT 'tsk-dm-009', id, 'proj-data-001', 'spr-dm-04', 'Go-live cutover', 'Final data load, validation and production switchover', 'emp-zeba-001', 'critical', 'backlog', 16, '2026-10-10', 'Go-Live', 'Engineering', 1, datetime('now'), datetime('now') FROM tenants LIMIT 1;

-- ── Xavvy Platform ────────────────────────────────────────────
INSERT OR IGNORE INTO pmo_projects (id, tenant_id, name, description, project_type, colour, start_date, end_date, budget, priority, status, created_at)
SELECT 'proj-xavvy-001', id, 'Xavvy Platform — v2.0',
  'Internal SaaS workforce platform — invoicing, client management, PMO, permissions and mobile UI.',
  'platform', '#10B981', '2026-01-01', '2026-12-31', 0, 'critical', 'active', datetime('now')
FROM tenants LIMIT 1;

INSERT OR IGNORE INTO pmo_sprints (id, tenant_id, project_id, sprint_number, sprint_name, status, start_date, end_date)
SELECT 'spr-xv-01', id, 'proj-xavvy-001', 201, 'Core Architecture & Auth', 'completed', '2026-01-01', '2026-02-28' FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_sprints (id, tenant_id, project_id, sprint_number, sprint_name, status, start_date, end_date)
SELECT 'spr-xv-02', id, 'proj-xavvy-001', 202, 'HR & Leave Modules', 'completed', '2026-03-01', '2026-04-30' FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_sprints (id, tenant_id, project_id, sprint_number, sprint_name, status, start_date, end_date)
SELECT 'spr-xv-03', id, 'proj-xavvy-001', 203, 'PMO, Timesheets & Invoicing', 'active', '2026-05-01', '2026-07-31' FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_sprints (id, tenant_id, project_id, sprint_number, sprint_name, status, start_date, end_date)
SELECT 'spr-xv-04', id, 'proj-xavvy-001', 204, 'Permissions & Settings', 'upcoming', '2026-08-01', '2026-09-30' FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_sprints (id, tenant_id, project_id, sprint_number, sprint_name, status, start_date, end_date)
SELECT 'spr-xv-05', id, 'proj-xavvy-001', 205, 'Mobile UI & Release', 'upcoming', '2026-10-01', '2026-12-31' FROM tenants LIMIT 1;

INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, task_order, created_at, updated_at)
SELECT 'tsk-xv-001', id, 'proj-xavvy-001', 'spr-xv-03', 'Client module', 'Full client CRUD with statutory fields and contacts', 'emp-nanjusha-001', 'critical', 'done', 32, '2026-05-20', 'PMO', 'Engineering', 1, datetime('now'), datetime('now') FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, task_order, created_at, updated_at)
SELECT 'tsk-xv-002', id, 'proj-xavvy-001', 'spr-xv-03', 'Invoicing module', 'Create/edit/send/void invoices, pull timesheets, HTML email', 'emp-swathi-001', 'critical', 'in_progress', 48, '2026-06-30', 'Invoicing', 'Engineering', 2, datetime('now'), datetime('now') FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, task_order, created_at, updated_at)
SELECT 'tsk-xv-003', id, 'proj-xavvy-001', 'spr-xv-03', 'PMO client segregation & templates', '3-step project wizard, DB-backed templates, resource utilisation', 'emp-swathi-001', 'high', 'in_progress', 40, '2026-07-15', 'PMO', 'Engineering', 3, datetime('now'), datetime('now') FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, task_order, created_at, updated_at)
SELECT 'tsk-xv-004', id, 'proj-xavvy-001', 'spr-xv-03', 'Timesheet project+task entry', 'Per-row project/task selection in weekly timesheet grid', 'emp-zeba-001', 'high', 'done', 16, '2026-06-14', 'Timesheets', 'Engineering', 4, datetime('now'), datetime('now') FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, task_order, created_at, updated_at)
SELECT 'tsk-xv-005', id, 'proj-xavvy-001', 'spr-xv-04', 'Permissions audit & seed', 'All modules — permission constants, role assignments, plan gating', 'emp-nanjusha-001', 'critical', 'todo', 20, '2026-08-31', 'Permissions', 'Engineering', 1, datetime('now'), datetime('now') FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, task_order, created_at, updated_at)
SELECT 'tsk-xv-006', id, 'proj-xavvy-001', 'spr-xv-05', 'Mobile-first UI audit', 'Audit all screens for mobile breakpoints and touch targets', 'emp-swathi-001', 'high', 'backlog', 32, '2026-11-30', 'UI', 'Design', 1, datetime('now'), datetime('now') FROM tenants LIMIT 1;

-- ── Support Retainer ──────────────────────────────────────────
INSERT OR IGNORE INTO pmo_projects (id, tenant_id, name, description, project_type, colour, start_date, end_date, budget, priority, status, created_at)
SELECT 'proj-supp-001', id, 'Support Retainer — Multi-client',
  'Rolling monthly support — L1/L2 incidents, monitoring, bug fixes, minor enhancements and SLA reporting.',
  'support', '#F59E0B', '2026-01-01', '2026-12-31', 48000, 'high', 'active', datetime('now')
FROM tenants LIMIT 1;

INSERT OR IGNORE INTO pmo_sprints (id, tenant_id, project_id, sprint_number, sprint_name, status, start_date, end_date)
SELECT 'spr-sp-01', id, 'proj-supp-001', 301, 'Q1 Support (Jan–Mar)', 'completed', '2026-01-01', '2026-03-31' FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_sprints (id, tenant_id, project_id, sprint_number, sprint_name, status, start_date, end_date)
SELECT 'spr-sp-02', id, 'proj-supp-001', 302, 'Q2 Support (Apr–Jun)', 'active', '2026-04-01', '2026-06-30' FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_sprints (id, tenant_id, project_id, sprint_number, sprint_name, status, start_date, end_date)
SELECT 'spr-sp-03', id, 'proj-supp-001', 303, 'Q3 Support (Jul–Sep)', 'upcoming', '2026-07-01', '2026-09-30' FROM tenants LIMIT 1;

INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, task_order, created_at, updated_at)
SELECT 'tsk-sp-001', id, 'proj-supp-001', 'spr-sp-01', 'Q1 incident response', '9 incidents, 3 P1s resolved within SLA', 'emp-nanjusha-001', 'high', 'done', 18, '2026-01-31', 'Q1', 'Support', 1, datetime('now'), datetime('now') FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, task_order, created_at, updated_at)
SELECT 'tsk-sp-002', id, 'proj-supp-001', 'spr-sp-01', 'Monitoring setup', 'Grafana dashboard, PagerDuty alerts, weekly uptime reports', 'emp-swathi-001', 'medium', 'done', 24, '2026-02-28', 'Q1', 'DevOps', 2, datetime('now'), datetime('now') FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, task_order, created_at, updated_at)
SELECT 'tsk-sp-003', id, 'proj-supp-001', 'spr-sp-02', 'Q2 incident management', 'Ongoing L1/L2 incident management and resolution', 'emp-nanjusha-001', 'high', 'in_progress', 40, '2026-05-31', 'Q2', 'Support', 1, datetime('now'), datetime('now') FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, task_order, created_at, updated_at)
SELECT 'tsk-sp-004', id, 'proj-supp-001', 'spr-sp-02', 'Performance tuning', 'Query optimisation and index review', 'emp-swathi-001', 'high', 'todo', 16, '2026-06-20', 'Q2', 'Engineering', 2, datetime('now'), datetime('now') FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, task_order, created_at, updated_at)
SELECT 'tsk-sp-005', id, 'proj-supp-001', 'spr-sp-03', 'Q3 support delivery', 'Ongoing incidents, monitoring and enhancements', 'emp-nanjusha-001', 'high', 'backlog', 120, '2026-09-30', 'Q3', 'Support', 1, datetime('now'), datetime('now') FROM tenants LIMIT 1;

-- ── Team Upskilling ───────────────────────────────────────────
INSERT OR IGNORE INTO pmo_projects (id, tenant_id, name, description, project_type, colour, start_date, end_date, budget, priority, status, created_at)
SELECT 'proj-train-001', id, 'Team Upskilling Programme 2026',
  'Cloud certifications, data engineering, project management and soft skills through courses and workshops.',
  'training', '#EC4899', '2026-01-01', '2026-12-31', 18000, 'medium', 'active', datetime('now')
FROM tenants LIMIT 1;

INSERT OR IGNORE INTO pmo_sprints (id, tenant_id, project_id, sprint_number, sprint_name, status, start_date, end_date)
SELECT 'spr-tr-01', id, 'proj-train-001', 401, 'H1 Learning (Jan–Jun)', 'active', '2026-01-01', '2026-06-30' FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_sprints (id, tenant_id, project_id, sprint_number, sprint_name, status, start_date, end_date)
SELECT 'spr-tr-02', id, 'proj-train-001', 402, 'H2 Learning (Jul–Dec)', 'upcoming', '2026-07-01', '2026-12-31' FROM tenants LIMIT 1;

INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, task_order, created_at, updated_at)
SELECT 'tsk-tr-001', id, 'proj-train-001', 'spr-tr-01', 'AWS Solutions Architect — Nanjusha', 'SAA-C03: study, practice exams, sit exam', 'emp-nanjusha-001', 'high', 'in_progress', 40, '2026-06-30', 'Certifications', 'Cloud', 1, datetime('now'), datetime('now') FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, task_order, created_at, updated_at)
SELECT 'tsk-tr-002', id, 'proj-train-001', 'spr-tr-01', 'dbt Core training — Priya', 'dbt Learn fundamentals + advanced, internal dbt project', 'emp-priya-001', 'high', 'in_progress', 24, '2026-05-31', 'Data Engineering', 'Analytics', 2, datetime('now'), datetime('now') FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, task_order, created_at, updated_at)
SELECT 'tsk-tr-003', id, 'proj-train-001', 'spr-tr-01', 'PostgreSQL advanced — Zeba', 'Window functions, CTEs, partitioning, performance tuning', 'emp-zeba-001', 'medium', 'done', 16, '2026-04-30', 'Database', 'Engineering', 3, datetime('now'), datetime('now') FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, task_order, created_at, updated_at)
SELECT 'tsk-tr-004', id, 'proj-train-001', 'spr-tr-01', 'React + TypeScript — Swathi', 'Scrimba React course and internal component library', 'emp-swathi-001', 'medium', 'done', 32, '2026-05-15', 'Frontend', 'Engineering', 4, datetime('now'), datetime('now') FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, task_order, created_at, updated_at)
SELECT 'tsk-tr-005', id, 'proj-train-001', 'spr-tr-01', 'PMP exam prep — Nanjusha', 'PMBOK study, mock exams, application submission', 'emp-nanjusha-001', 'medium', 'todo', 60, '2026-06-30', 'Certifications', 'Management', 5, datetime('now'), datetime('now') FROM tenants LIMIT 1;
INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, due_date, phase, task_category, task_order, created_at, updated_at)
SELECT 'tsk-tr-006', id, 'proj-train-001', 'spr-tr-02', 'Azure Data Engineer — Priya', 'DP-203: Synapse, Data Factory, Databricks', 'emp-priya-001', 'high', 'backlog', 48, '2026-10-31', 'Certifications', 'Cloud', 1, datetime('now'), datetime('now') FROM tenants LIMIT 1;

-- ── Allocations — use known employee IDs from 003_iot_project.sql ─
-- Data Migration: Priya + Zeba
INSERT OR IGNORE INTO pmo_allocations (id, tenant_id, project_id, employee_id, role, allocation, hours_per_week, start_date, end_date)
VALUES ('alloc-dm-priya', 'xavvy-tenant-001', 'proj-data-001', 'emp-priya-001', 'BI & Analytics Lead', 50, 17.5, '2026-02-01', '2026-10-31');
INSERT OR IGNORE INTO pmo_allocations (id, tenant_id, project_id, employee_id, role, allocation, hours_per_week, start_date, end_date)
VALUES ('alloc-dm-zeba',  'xavvy-tenant-001', 'proj-data-001', 'emp-zeba-001',  'Database Engineer',   50, 17.5, '2026-02-01', '2026-10-31');

-- Xavvy Platform: all 4
INSERT OR IGNORE INTO pmo_allocations (id, tenant_id, project_id, employee_id, role, allocation, hours_per_week, start_date, end_date)
VALUES ('alloc-xv-nanjusha', 'xavvy-tenant-001', 'proj-xavvy-001', 'emp-nanjusha-001', 'Product Owner & PM',   50, 17.5, '2026-01-01', '2026-12-31');
INSERT OR IGNORE INTO pmo_allocations (id, tenant_id, project_id, employee_id, role, allocation, hours_per_week, start_date, end_date)
VALUES ('alloc-xv-priya',    'xavvy-tenant-001', 'proj-xavvy-001', 'emp-priya-001',    'Full Stack Developer', 50, 17.5, '2026-01-01', '2026-12-31');
INSERT OR IGNORE INTO pmo_allocations (id, tenant_id, project_id, employee_id, role, allocation, hours_per_week, start_date, end_date)
VALUES ('alloc-xv-swathi',   'xavvy-tenant-001', 'proj-xavvy-001', 'emp-swathi-001',   'Full Stack Developer', 50, 17.5, '2026-01-01', '2026-12-31');
INSERT OR IGNORE INTO pmo_allocations (id, tenant_id, project_id, employee_id, role, allocation, hours_per_week, start_date, end_date)
VALUES ('alloc-xv-zeba',     'xavvy-tenant-001', 'proj-xavvy-001', 'emp-zeba-001',     'Database Engineer',    50, 17.5, '2026-01-01', '2026-12-31');

-- Support: Nanjusha + Swathi
INSERT OR IGNORE INTO pmo_allocations (id, tenant_id, project_id, employee_id, role, allocation, hours_per_week, start_date, end_date)
VALUES ('alloc-sp-nanjusha', 'xavvy-tenant-001', 'proj-supp-001', 'emp-nanjusha-001', 'Support Lead',    25, 8.75, '2026-01-01', '2026-12-31');
INSERT OR IGNORE INTO pmo_allocations (id, tenant_id, project_id, employee_id, role, allocation, hours_per_week, start_date, end_date)
VALUES ('alloc-sp-swathi',   'xavvy-tenant-001', 'proj-supp-001', 'emp-swathi-001',   'Support Engineer', 25, 8.75, '2026-01-01', '2026-12-31');

-- ── Plan features ─────────────────────────────────────────────
UPDATE plan_limits
SET features = replace(features, '"]', '","clients","invoicing"]')
WHERE plan IN ('professional','enterprise') AND features NOT LIKE '%invoicing%';

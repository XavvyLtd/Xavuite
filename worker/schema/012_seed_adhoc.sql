-- ============================================================
-- XavvySuite — Consolidated Ad-Hoc Seed
-- 012_seed_adhoc.sql
-- Safe to run multiple times. D1 compatible.
-- Run AFTER all schema migrations (001–011).
-- Key: all created_by/changed_by/granted_by = NULL (nullable).
-- Admin role assigned via SELECT on email, not hardcoded UUID.
-- ============================================================

-- ── 1. Tenant settings ───────────────────────────────────────
INSERT OR IGNORE INTO tenant_settings (id, tenant_id, key, value)
VALUES
  ('ts-001','xavvy-tenant-001','timezone',           'Europe/London'),
  ('ts-002','xavvy-tenant-001','currency',            'GBP'),
  ('ts-003','xavvy-tenant-001','date_format',         'DD/MM/YYYY'),
  ('ts-004','xavvy-tenant-001','working_days',        '["Mon","Tue","Wed","Thu","Fri"]'),
  ('ts-005','xavvy-tenant-001','financial_year_start','04-01'),
  ('ts-006','xavvy-tenant-001','leave_year_start',    '01-01');

-- ── 2. Tenant branding ───────────────────────────────────────
INSERT OR IGNORE INTO tenant_branding (id, tenant_id, company_name, primary_color, secondary_color)
VALUES ('brand-xavvy-001','xavvy-tenant-001','Xavvy Ltd','#6366F1','#14B8A6');
UPDATE tenant_branding SET company_name='Xavvy Ltd', primary_color='#6366F1', secondary_color='#14B8A6'
WHERE tenant_id='xavvy-tenant-001';

-- ── 3. Admin role fix (no hardcoded UUID — uses email lookup) ─
DELETE FROM user_roles
WHERE user_id = (SELECT id FROM users WHERE email='admin@xavvy.uk' AND tenant_id='xavvy-tenant-001')
  AND role_id != 'role-super-admin';

INSERT OR IGNORE INTO user_roles (id, user_id, role_id, scope_type, granted_by, granted_at)
SELECT 'ur-admin-super', id, 'role-super-admin', 'tenant', NULL, CURRENT_TIMESTAMP
FROM users WHERE email='admin@xavvy.uk' AND tenant_id='xavvy-tenant-001';

-- ── 4. Admin employee record ──────────────────────────────────
INSERT OR IGNORE INTO employees (id, tenant_id, user_id, employee_number, status, created_at, created_by)
SELECT 'emp-nanjusha-001', tenant_id, id, 'EMP-0001', 'active', CURRENT_TIMESTAMP, NULL
FROM users WHERE email='admin@xavvy.uk' AND tenant_id='xavvy-tenant-001';

UPDATE employee_history SET is_current=0
WHERE employee_id='emp-nanjusha-001' AND tenant_id='xavvy-tenant-001';

-- employee_history seeded in 003_iot_project.sql

-- ── 5. IoT team users ─────────────────────────────────────────
INSERT OR IGNORE INTO users (id, tenant_id, email, password_hash, status, auth_provider, created_at)
VALUES
  ('usr-nanjusha-001','xavvy-tenant-001','nanjusha.vasireddy@xavvy.uk','sha256:xavvy2025:placeholder','active','local',CURRENT_TIMESTAMP),
  ('usr-priya-001',   'xavvy-tenant-001','priya.narsing@xavvy.uk',    'sha256:xavvy2025:placeholder','active','local',CURRENT_TIMESTAMP),
  ('usr-swathi-001',  'xavvy-tenant-001','swathi.m@xavvy.uk',         'sha256:xavvy2025:placeholder','active','local',CURRENT_TIMESTAMP),
  ('usr-zeba-001',    'xavvy-tenant-001','zeba.mansoor@xavvy.uk',     'sha256:xavvy2025:placeholder','active','local',CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO user_roles (id, user_id, role_id, scope_type, granted_by, granted_at)
VALUES
  ('ur-nanjusha-001','usr-nanjusha-001','role-employee','tenant',NULL,CURRENT_TIMESTAMP),
  ('ur-priya-001',   'usr-priya-001',   'role-employee','tenant',NULL,CURRENT_TIMESTAMP),
  ('ur-swathi-001',  'usr-swathi-001',  'role-employee','tenant',NULL,CURRENT_TIMESTAMP),
  ('ur-zeba-001',    'usr-zeba-001',    'role-employee','tenant',NULL,CURRENT_TIMESTAMP);

-- ── 6. Extra designations ────────────────────────────────────
INSERT OR IGNORE INTO designations (id, tenant_id, title, grade) VALUES
  ('des-analyst-prog','xavvy-tenant-001','Analyst Programmer',      'L3'),
  ('des-ba-bi',       'xavvy-tenant-001','IT Business Analyst (BI)','L3'),
  ('des-fullstack',   'xavvy-tenant-001','Developer (Full Stack)',  'L3'),
  ('des-db-prog',     'xavvy-tenant-001','Database Programmer',     'L3');

-- ── 7. IoT team employees ────────────────────────────────────
INSERT OR IGNORE INTO employees (id, tenant_id, user_id, employee_number, status, created_at, created_by)
VALUES
  ('emp-nanjusha-001','xavvy-tenant-001','usr-nanjusha-001','EMP-1001','active',CURRENT_TIMESTAMP,NULL),
  ('emp-priya-001',   'xavvy-tenant-001','usr-priya-001',   'EMP-1002','active',CURRENT_TIMESTAMP,NULL),
  ('emp-swathi-001',  'xavvy-tenant-001','usr-swathi-001',  'EMP-1003','active',CURRENT_TIMESTAMP,NULL),
  ('emp-zeba-001',    'xavvy-tenant-001','usr-zeba-001',    'EMP-1004','active',CURRENT_TIMESTAMP,NULL);

-- ── 8. Employee history ───────────────────────────────────────
-- Use REPLACE to overwrite any existing rows (avoids INSERT OR IGNORE skipping them)
INSERT OR REPLACE INTO employee_history (
  id, employee_id, tenant_id, first_name, last_name,
  department_id, designation_id, org_unit_id,
  start_date, employment_type, employment_basis, contract_type,
  work_location_type, work_location, probation_status, status,
  change_reason, changed_by, effective_from, is_current
) VALUES
  ('eh-nanjusha-001','emp-nanjusha-001','xavvy-tenant-001','Nanjusha','Vasireddy','dept-eng','des-analyst-prog','unit-xavvy-001','2025-01-06','full_time','permanent','employed','hybrid','London HQ','passed','active','new_hire',NULL,'2025-01-06',1),
  ('eh-priya-001',   'emp-priya-001',   'xavvy-tenant-001','Priya',   'Narsing',  'dept-eng','des-ba-bi',       'unit-xavvy-001','2025-01-06','full_time','permanent','employed','hybrid','London HQ','passed','active','new_hire',NULL,'2025-01-06',1),
  ('eh-swathi-001',  'emp-swathi-001',  'xavvy-tenant-001','Swathi',  'M',        'dept-eng','des-fullstack',   'unit-xavvy-001','2025-01-06','full_time','permanent','employed','remote','Remote',    'passed','active','new_hire',NULL,'2025-01-06',1),
  ('eh-zeba-001',    'emp-zeba-001',    'xavvy-tenant-001','Zeba',    'Mansoor',  'dept-eng','des-db-prog',     'unit-xavvy-001','2025-01-06','full_time','permanent','employed','hybrid','London HQ','passed','active','new_hire',NULL,'2025-01-06',1);

-- ── 9. Reporting hierarchy ───────────────────────────────────
DELETE FROM reporting_hierarchy
WHERE employee_id IN ('emp-nanjusha-001','emp-nanjusha-001','emp-priya-001','emp-swathi-001','emp-zeba-001')
  AND tenant_id='xavvy-tenant-001';

-- Self-references for IoT team (safe — these employees were just inserted)
INSERT OR IGNORE INTO reporting_hierarchy (employee_id, manager_id, depth, is_direct, tenant_id)
SELECT id, id, 0, 0, tenant_id FROM employees
WHERE id IN ('emp-nanjusha-001','emp-priya-001','emp-swathi-001','emp-zeba-001')
  AND tenant_id='xavvy-tenant-001';

-- Admin self-reference (only if admin employee exists)
INSERT OR IGNORE INTO reporting_hierarchy (employee_id, manager_id, depth, is_direct, tenant_id)
SELECT id, id, 0, 0, tenant_id FROM employees
WHERE id='emp-nanjusha-001' AND tenant_id='xavvy-tenant-001';

-- IoT team reports to admin (only if admin employee exists)
INSERT OR IGNORE INTO reporting_hierarchy (employee_id, manager_id, depth, is_direct, tenant_id)
SELECT m.id, a.id, 1, 1, m.tenant_id
FROM employees m
JOIN employees a ON a.id='emp-nanjusha-001' AND a.tenant_id='xavvy-tenant-001'
WHERE m.id IN ('emp-nanjusha-001','emp-priya-001','emp-swathi-001','emp-zeba-001')
  AND m.tenant_id='xavvy-tenant-001';

-- ── 10. Tenant modules — enable all ──────────────────────────
INSERT OR IGNORE INTO tenant_modules (id, tenant_id, module_key, enabled) VALUES
  ('mod-xavvy-01','xavvy-tenant-001','dashboard',    1),
  ('mod-xavvy-02','xavvy-tenant-001','hr',           1),
  ('mod-xavvy-03','xavvy-tenant-001','leave',        1),
  ('mod-xavvy-04','xavvy-tenant-001','timesheets',   1),
  ('mod-xavvy-05','xavvy-tenant-001','expenses',     1),
  ('mod-xavvy-06','xavvy-tenant-001','compliance',   1),
  ('mod-xavvy-07','xavvy-tenant-001','documents',    1),
  ('mod-xavvy-08','xavvy-tenant-001','assets',       1),
  ('mod-xavvy-09','xavvy-tenant-001','training',     1),
  ('mod-xavvy-10','xavvy-tenant-001','announcements',1),
  ('mod-xavvy-11','xavvy-tenant-001','pmo',          1),
  ('mod-xavvy-12','xavvy-tenant-001','audit',        1),
  ('mod-xavvy-13','xavvy-tenant-001','reporting',    1),
  ('mod-xavvy-14','xavvy-tenant-001','orgchart',     1),
  ('mod-xavvy-15','xavvy-tenant-001','scheduler',    1),
  ('mod-xavvy-16','xavvy-tenant-001','workflow',     1),
  ('mod-xavvy-17','xavvy-tenant-001','recruitment',  1),
  ('mod-xavvy-18','xavvy-tenant-001','onboarding',   1),
  ('mod-xavvy-19','xavvy-tenant-001','visa',         1),
  ('mod-xavvy-20','xavvy-tenant-001','leavebalances',1),
  ('mod-xavvy-21','xavvy-tenant-001','leavecalendar',1),
  ('mod-xavvy-22','xavvy-tenant-001','checklists',   1);

UPDATE tenant_modules SET enabled=1 WHERE tenant_id='xavvy-tenant-001';

-- ── 11. IoT project ──────────────────────────────────────────
INSERT OR IGNORE INTO pmo_projects (id, tenant_id, name, client_name, start_date, end_date, budget, spent, priority, status, created_by, created_at)
VALUES ('proj-iot-001','xavvy-tenant-001','IoT Platform','Xavvy Ltd','2025-01-06','2027-12-31',480000,0,'high','active',NULL,CURRENT_TIMESTAMP);

UPDATE pmo_projects SET name='IoT Platform', budget=480000, status='active'
WHERE id='proj-iot-001' AND tenant_id='xavvy-tenant-001';

INSERT OR IGNORE INTO pmo_sprints (id, tenant_id, project_id, sprint_number, sprint_name, start_date, end_date, status) VALUES
  ('spr-iot-01','xavvy-tenant-001','proj-iot-001',10,'Requirements & Discovery',   '2025-01-06','2025-04-30','completed'),
  ('spr-iot-02','xavvy-tenant-001','proj-iot-001',11,'Architecture & Design',       '2025-03-01','2025-07-31','completed'),
  ('spr-iot-03','xavvy-tenant-001','proj-iot-001',12,'Hardware / RTLS Integration', '2025-06-01','2025-12-31','active'),
  ('spr-iot-04','xavvy-tenant-001','proj-iot-001',13,'Backend Development',         '2025-08-01','2026-06-30','active'),
  ('spr-iot-05','xavvy-tenant-001','proj-iot-001',14,'Dashboard Development',       '2026-01-01','2026-09-30','upcoming'),
  ('spr-iot-06','xavvy-tenant-001','proj-iot-001',15,'Testing & QA',                '2026-07-01','2027-02-28','upcoming'),
  ('spr-iot-07','xavvy-tenant-001','proj-iot-001',16,'Pilot & Rollout',             '2027-01-01','2027-07-31','upcoming'),
  ('spr-iot-08','xavvy-tenant-001','proj-iot-001',17,'Support & Optimisation',      '2027-05-01','2027-12-31','upcoming');

INSERT OR IGNORE INTO pmo_allocations (id, tenant_id, project_id, employee_id, role, allocation, start_date, end_date) VALUES
  ('alloc-nanjusha','xavvy-tenant-001','proj-iot-001','emp-nanjusha-001','Analyst Programmer',       100,'2025-01-06','2027-12-31'),
  ('alloc-priya',   'xavvy-tenant-001','proj-iot-001','emp-priya-001',   'IT Business Analyst (BI)', 100,'2025-01-06','2027-12-31'),
  ('alloc-swathi',  'xavvy-tenant-001','proj-iot-001','emp-swathi-001',  'Developer (Full Stack)',   100,'2025-01-06','2027-12-31'),
  ('alloc-zeba',    'xavvy-tenant-001','proj-iot-001','emp-zeba-001',    'Database Programmer',      100,'2025-01-06','2027-12-31');

INSERT OR IGNORE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, assignee_id, priority, status, estimated_hours, phase, task_category, task_order, due_date, created_by, created_at, updated_at) VALUES
  ('task-iot-001','xavvy-tenant-001','proj-iot-001','spr-iot-01','Stakeholder interviews & workshops',          'emp-nanjusha-001','high',    'done',       40,'Requirements & Discovery','Analysis',    1,'2025-01-31',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-002','xavvy-tenant-001','proj-iot-001','spr-iot-01','BI requirements & KPI definition',            'emp-priya-001',   'high',    'done',       48,'Requirements & Discovery','Analysis',    2,'2025-02-14',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-003','xavvy-tenant-001','proj-iot-001','spr-iot-01','Technical feasibility & stack selection',     'emp-swathi-001',  'high',    'done',       32,'Requirements & Discovery','Analysis',    3,'2025-02-28',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-004','xavvy-tenant-001','proj-iot-001','spr-iot-01','Data model scoping & schema requirements',    'emp-zeba-001',    'high',    'done',       32,'Requirements & Discovery','Analysis',    4,'2025-03-14',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-005','xavvy-tenant-001','proj-iot-001','spr-iot-01','Business requirements document (BRD)',        'emp-nanjusha-001','critical','done',       24,'Requirements & Discovery','Documentation',5,'2025-04-30',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-006','xavvy-tenant-001','proj-iot-001','spr-iot-02','Solution architecture design',                'emp-nanjusha-001','critical','done',       56,'Architecture & Design',   'Architecture',1,'2025-04-30',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-007','xavvy-tenant-001','proj-iot-001','spr-iot-02','BI architecture & data warehouse design',     'emp-priya-001',   'high',    'done',       48,'Architecture & Design',   'Architecture',2,'2025-05-15',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-008','xavvy-tenant-001','proj-iot-001','spr-iot-02','Full-stack architecture & API design',        'emp-swathi-001',  'high',    'done',       64,'Architecture & Design',   'Architecture',3,'2025-06-15',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-009','xavvy-tenant-001','proj-iot-001','spr-iot-02','Database schema & ERD design',                'emp-zeba-001',    'high',    'done',       56,'Architecture & Design',   'Architecture',4,'2025-06-30',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-010','xavvy-tenant-001','proj-iot-001','spr-iot-02','Architecture sign-off & design review',       'emp-nanjusha-001','critical','done',       16,'Architecture & Design',   'Review',      5,'2025-07-31',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-011','xavvy-tenant-001','proj-iot-001','spr-iot-03','SEWIO anchor placement specification',        'emp-nanjusha-001','high',    'in_progress',48,'Hardware / RTLS Integration','Hardware', 1,'2025-07-31',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-012','xavvy-tenant-001','proj-iot-001','spr-iot-03','SEWIO API integration - tag & zone data',     'emp-swathi-001',  'critical','in_progress',120,'Hardware / RTLS Integration','Integration',2,'2025-10-31',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-013','xavvy-tenant-001','proj-iot-001','spr-iot-03','Time-series database for location telemetry', 'emp-zeba-001',    'high',    'in_progress',80,'Hardware / RTLS Integration','Database',  3,'2025-11-30',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-014','xavvy-tenant-001','proj-iot-001','spr-iot-03','Hardware integration testing',                'emp-nanjusha-001','high',    'todo',       40,'Hardware / RTLS Integration','Testing',   4,'2025-12-31',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-015','xavvy-tenant-001','proj-iot-001','spr-iot-04','REST API - asset tracking endpoints',         'emp-swathi-001',  'critical','in_progress',160,'Backend Development',    'Development',1,'2026-01-31',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-016','xavvy-tenant-001','proj-iot-001','spr-iot-04','Authentication, RBAC & multi-tenant support', 'emp-swathi-001',  'critical','todo',       80,'Backend Development',     'Development',2,'2025-11-30',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-017','xavvy-tenant-001','proj-iot-001','spr-iot-04','Database development - core schema',          'emp-zeba-001',    'critical','in_progress',200,'Backend Development',    'Database',   3,'2026-03-31',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-018','xavvy-tenant-001','proj-iot-001','spr-iot-04','BI data pipeline & ETL development',          'emp-priya-001',   'high',    'todo',       120,'Backend Development',    'BI/Data',    4,'2026-04-30',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-019','xavvy-tenant-001','proj-iot-001','spr-iot-04','Query optimisation & performance tuning',     'emp-zeba-001',    'high',    'todo',       80,'Backend Development',     'Database',   5,'2026-06-30',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-020','xavvy-tenant-001','proj-iot-001','spr-iot-05','Real-time location map dashboard',            'emp-swathi-001',  'critical','todo',       160,'Dashboard Development',  'Frontend',   1,'2026-05-31',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-021','xavvy-tenant-001','proj-iot-001','spr-iot-05','BI dashboards - utilisation & analytics',     'emp-priya-001',   'high',    'todo',       144,'Dashboard Development',  'BI',         2,'2026-07-31',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-022','xavvy-tenant-001','proj-iot-001','spr-iot-05','Alert & notification system',                 'emp-swathi-001',  'high',    'todo',       80,'Dashboard Development',   'Frontend',   3,'2026-08-31',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-023','xavvy-tenant-001','proj-iot-001','spr-iot-05','Dashboard DB views & aggregation queries',    'emp-zeba-001',    'high',    'todo',       80,'Dashboard Development',   'Database',   4,'2026-09-30',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-024','xavvy-tenant-001','proj-iot-001','spr-iot-06','UAT planning & test script authoring',        'emp-nanjusha-001','high',    'todo',       80,'Testing & QA',            'QA',         1,'2026-08-31',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-025','xavvy-tenant-001','proj-iot-001','spr-iot-06','Integration & end-to-end testing',            'emp-swathi-001',  'critical','todo',       160,'Testing & QA',           'QA',         2,'2026-11-30',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-026','xavvy-tenant-001','proj-iot-001','spr-iot-06','BI report & data accuracy validation',        'emp-priya-001',   'high',    'todo',       96,'Testing & QA',            'QA',         3,'2026-12-31',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-027','xavvy-tenant-001','proj-iot-001','spr-iot-06','Database load & integrity testing',           'emp-zeba-001',    'high',    'todo',       96,'Testing & QA',            'QA',         4,'2027-01-31',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-028','xavvy-tenant-001','proj-iot-001','spr-iot-06','UAT execution & defect resolution',           'emp-nanjusha-001','critical','todo',       80,'Testing & QA',            'QA',         5,'2027-02-28',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-029','xavvy-tenant-001','proj-iot-001','spr-iot-07','Pilot site deployment & configuration',       'emp-nanjusha-001','critical','todo',       80,'Pilot & Rollout',         'Deployment', 1,'2027-02-28',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-030','xavvy-tenant-001','proj-iot-001','spr-iot-07','User training & onboarding',                  'emp-nanjusha-001','high',    'todo',       64,'Pilot & Rollout',         'Training',   2,'2027-03-31',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-031','xavvy-tenant-001','proj-iot-001','spr-iot-07','Pilot data analysis & reporting',             'emp-priya-001',   'high',    'todo',       96,'Pilot & Rollout',         'Analysis',   3,'2027-04-30',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-032','xavvy-tenant-001','proj-iot-001','spr-iot-07','Production go-live & hypercare',              'emp-swathi-001',  'critical','todo',       80,'Pilot & Rollout',         'Deployment', 4,'2027-06-30',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-033','xavvy-tenant-001','proj-iot-001','spr-iot-07','Production DB migration & data verification', 'emp-zeba-001',    'critical','todo',       64,'Pilot & Rollout',         'Database',   5,'2027-05-31',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-034','xavvy-tenant-001','proj-iot-001','spr-iot-08','BAU support & issue management',              'emp-nanjusha-001','medium',  'todo',       200,'Support & Optimisation', 'Support',    1,'2027-12-31',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-035','xavvy-tenant-001','proj-iot-001','spr-iot-08','BI optimisation & new report development',    'emp-priya-001',   'medium',  'todo',       160,'Support & Optimisation', 'BI',         2,'2027-12-31',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-036','xavvy-tenant-001','proj-iot-001','spr-iot-08','Platform feature development',                'emp-swathi-001',  'medium',  'todo',       160,'Support & Optimisation', 'Development',3,'2027-12-31',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-037','xavvy-tenant-001','proj-iot-001','spr-iot-08','Database optimisation & archiving',           'emp-zeba-001',    'medium',  'todo',       120,'Support & Optimisation', 'Database',   4,'2027-12-31',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);

-- ── 12. Workflow definitions & steps ─────────────────────────
INSERT OR IGNORE INTO workflow_definitions (id, tenant_id, key, name, description, module, target_table, approved_value, rejected_value, enabled)
VALUES
  ('wf-leave-approval',      'xavvy-tenant-001','leave_approval',      'Leave Approval',     'Standard leave request approval',     'leave',      'leave_requests', 'approved','declined', 1),
  ('wf-timesheet-approval',  'xavvy-tenant-001','timesheet_approval',  'Timesheet Approval', 'Weekly timesheet approval',           'timesheets', 'timesheets',     'approved','rejected', 1),
  ('wf-expense-approval',    'xavvy-tenant-001','expense_approval',    'Expense Approval',   'Expense claim approval',              'expenses',   'expense_claims', 'approved','rejected', 1),
  ('wf-recruitment-approval','xavvy-tenant-001','recruitment_approval','Vacancy Approval',   'Vacancy approval before posting',     'recruitment','job_postings',   'open',    'closed',   1),
  ('wf-asset-approval',      'xavvy-tenant-001','asset_approval',      'Asset Request',      'Asset request approval',              'assets',     'assets',         'in_use',  'available',1);

UPDATE workflow_definitions SET enabled=1 WHERE tenant_id='xavvy-tenant-001';

INSERT OR IGNORE INTO workflow_steps (id, definition_id, tenant_id, step_order, name, step_type, approver_type, approver_role, sla_hours, escalate_to_role, auto_approve_after_sla, condition)
VALUES
  ('wfs-leave-01',  'wf-leave-approval',      'xavvy-tenant-001',1,'Line Manager Approval',   'approval','manager',         'manager',     48,'hr_admin',    NULL,NULL),
  ('wfs-leave-02',  'wf-leave-approval',      'xavvy-tenant-001',2,'HR Review (10+ days)',     'approval','role',            'hr_admin',    24,'super_admin', NULL,'{"field":"days","operator":">=","value":10}'),
  ('wfs-ts-01',     'wf-timesheet-approval',  'xavvy-tenant-001',1,'Manager Approval',         'approval','manager',         'manager',     72,NULL,          1,   NULL),
  ('wfs-exp-01',    'wf-expense-approval',    'xavvy-tenant-001',1,'Line Manager Approval',    'approval','manager',         'manager',     48,'finance_admin',NULL,NULL),
  ('wfs-exp-02',    'wf-expense-approval',    'xavvy-tenant-001',2,'Finance Approval (500+)',  'approval','role',            'finance_admin',48,'super_admin', NULL,'{"field":"amount","operator":">=","value":500}'),
  ('wfs-rec-01',    'wf-recruitment-approval','xavvy-tenant-001',1,'HR Review',                'approval','role',            'hr_admin',    24,NULL,          NULL,NULL),
  ('wfs-rec-02',    'wf-recruitment-approval','xavvy-tenant-001',2,'Department Head Approval', 'approval','department_head', 'manager',     48,NULL,          NULL,NULL),
  ('wfs-rec-03',    'wf-recruitment-approval','xavvy-tenant-001',3,'Finance Sign-off',         'approval','role',            'finance_admin',48,NULL,         NULL,NULL),
  ('wfs-ast-01',    'wf-asset-approval',      'xavvy-tenant-001',1,'IT Manager Approval',      'approval','role',            'manager',     48,NULL,          NULL,NULL);

-- ── 13. Scheduled jobs ───────────────────────────────────────
INSERT OR IGNORE INTO scheduled_jobs (id, tenant_id, key, name, category, enabled, schedule_type, cron_expr, email_enabled, email_to, email_subject, email_body, trigger_config, created_by, created_at, updated_at) VALUES
  ('job-rtw-check',   'xavvy-tenant-001','rtw_expiry_check',             'RTW Expiry Check',        'compliance',1,'cron','0 8 * * 1',  1,'hr',     'RTW Alert - {{expired_count}} Expired, {{expiring_count}} Expiring',   '<p>RTW check required. {{expired_count}} expired, {{expiring_count}} expiring within 90 days.</p><p><a href="{{platform_url}}/compliance">Review</a></p>',       '{"days_before":90}',             NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('job-visa-check',  'xavvy-tenant-001','visa_expiry_check',            'Visa Expiry Alert',       'compliance',1,'cron','0 9 * * *',  1,'hr',     '{{employee_name}} - {{document_type}} expiring in {{days_remaining}} days','<p>Dear HR,</p><p>{{employee_name}} has a {{document_type}} expiring on {{expiry_date}} ({{days_remaining}} days).</p><p><a href="{{platform_url}}/compliance">Review</a></p>','{"days_before":90,"notify_employee":true}',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('job-ts-reminder', 'xavvy-tenant-001','timesheet_submission_reminder','Timesheet Reminder',      'hr',        1,'cron','0 16 * * 5',1,'employee','Reminder: Submit Your Timesheet for Week Ending {{week_ending}}',      '<p>Hi {{employee_name}},</p><p>Please submit your timesheet for week ending {{week_ending}}.</p><p><a href="{{platform_url}}/timesheets">Submit Now</a></p>',         '{}',                             NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('job-probation',   'xavvy-tenant-001','probation_end_alert',          'Probation End Alert',     'hr',        1,'cron','0 9 * * 1',  1,'hr',     'Probation Review Required - {{employee_name}} ({{days_remaining}} days)','<p>Hi {{manager_name}},</p><p>{{employee_name}} probation ends on {{probation_end_date}} ({{days_remaining}} days).</p><p><a href="{{platform_url}}/hr">Review</a></p>', '{"days_before":14}',             NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('job-leave-report','xavvy-tenant-001','leave_balance_report',         'Leave Balance Report',    'hr',        1,'cron','0 8 1 * *',  1,'hr',     'Monthly Leave Balance Report - {{month_year}}',                         '<p>Leave balance summary for {{month_year}}.</p><p><a href="{{platform_url}}/leavebalances">View Balances</a></p>',                                                     '{}',                             NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('job-approvals',   'xavvy-tenant-001','pending_approvals_digest',     'Pending Approvals Digest','hr',        1,'cron','0 9 * * 1-5',1,'hr',     'Pending Approvals - {{total_pending}} items awaiting action',           '<p>You have {{total_pending}} pending approvals. Leave: {{leave_pending}} | Timesheets: {{timesheet_pending}} | Expenses: {{expense_pending}}</p><p><a href="{{platform_url}}/workflow">Review</a></p>','{"skip_if_none":true}',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);

UPDATE scheduled_jobs SET enabled=1 WHERE tenant_id='xavvy-tenant-001';

-- Automated weekly timesheet submission (every Monday 00:01)
-- Marks previous week tasks complete, submits 35hr timesheets, allocates new tasks
INSERT OR IGNORE INTO scheduled_jobs (id, tenant_id, key, name, category, enabled, schedule_type, cron_expr, email_enabled, email_to, email_subject, email_body, trigger_config, created_by, created_at, updated_at)
VALUES (
  'job-auto-ts','xavvy-tenant-001','auto_timesheet_submission','Automated Timesheet Submission','hr',1,'cron','1 0 * * 1',0,'hr',
  'Automated Timesheet Submitted for Week Ending {{week_ending}}',
  '<p>Timesheets have been automatically submitted for {{employee_count}} employees for week ending {{week_ending}}.</p>',
  '{"hours_per_week":35,"auto_complete_tasks":true,"auto_allocate_tasks":true}',
  NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

-- Leave balance auto-initialise (1 Jan each year)
INSERT OR IGNORE INTO scheduled_jobs (id, tenant_id, key, name, category, enabled, schedule_type, cron_expr, email_enabled, email_to, email_subject, email_body, trigger_config, created_by, created_at, updated_at)
VALUES (
  'job-leave-init','xavvy-tenant-001','leave_balance_init','Leave Balance Initialisation','hr',1,'cron','0 6 1 1 *',0,'hr',
  'Leave Balances Initialised for {{year}}',
  '<p>Leave balances have been automatically initialised for all active employees for {{year}}.</p>',
  '{"entitlements":{"annual":25,"sick":10,"toil":0}}',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

-- Timesheet missing detection (every Monday morning)
INSERT OR IGNORE INTO scheduled_jobs (id, tenant_id, key, name, category, enabled, schedule_type, cron_expr, email_enabled, email_to, email_subject, email_body, trigger_config, created_by, created_at, updated_at)
VALUES (
  'job-ts-missing','xavvy-tenant-001','timesheet_missing_alert','Missing Timesheet Alert','hr',1,'cron','0 9 * * 1',1,'manager',
  '{{count}} Missing Timesheets for Week Ending {{week_ending}}',
  '<p>Hi {{manager_name}},</p><p>{{count}} team member(s) have not submitted their timesheet for week ending {{week_ending}}:</p><ul>{{employee_list}}</ul><p><a href="{{platform_url}}/timesheets">View Timesheets</a></p>',
  '{"grace_hours":8}',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
);

-- ── 14. Leave types & policies ───────────────────────────────
INSERT OR IGNORE INTO leave_types (id, tenant_id, name, code, colour, paid, requires_approval, max_days, carry_forward, carry_forward_max, half_day_allowed, is_system, enabled, created_at)
VALUES
  ('lt-annual',       'xavvy-tenant-001','Annual Leave',       'annual',       '#6366F1',1,1,28,  1,5, 1,1,1,CURRENT_TIMESTAMP),
  ('lt-sick',         'xavvy-tenant-001','Sick Leave',         'sick',         '#EF4444',1,0,NULL, 0,0, 1,1,1,CURRENT_TIMESTAMP),
  ('lt-maternity',    'xavvy-tenant-001','Maternity Leave',    'maternity',    '#14B8A6',1,1,52,  0,0, 0,1,1,CURRENT_TIMESTAMP),
  ('lt-paternity',    'xavvy-tenant-001','Paternity Leave',    'paternity',    '#38BDF8',1,1,10,  0,0, 0,1,1,CURRENT_TIMESTAMP),
  ('lt-compassionate','xavvy-tenant-001','Compassionate Leave','compassionate','#F59E0B',1,1,5,   0,0, 0,1,1,CURRENT_TIMESTAMP),
  ('lt-unpaid',       'xavvy-tenant-001','Unpaid Leave',       'unpaid',       '#475569',0,1,NULL, 0,0, 1,1,1,CURRENT_TIMESTAMP),
  ('lt-toil',         'xavvy-tenant-001','TOIL',               'toil',         '#A855F7',1,1,NULL, 1,10,1,1,1,CURRENT_TIMESTAMP);

UPDATE leave_types SET enabled=1 WHERE tenant_id='xavvy-tenant-001';

INSERT OR IGNORE INTO leave_policies (id, tenant_id, leave_type_id, name, entitlement_days, applies_to, effective_from, enabled)
VALUES
  ('lp-annual-ft','xavvy-tenant-001','lt-annual','Annual Leave - Full Time',25,'all','2025-01-01',1),
  ('lp-sick-all', 'xavvy-tenant-001','lt-sick',  'Sick Leave - All Staff',  10,'all','2025-01-01',1);

UPDATE leave_policies SET enabled=1 WHERE tenant_id='xavvy-tenant-001';

-- ── 15. Checklist templates ───────────────────────────────────
INSERT OR IGNORE INTO checklist_templates (id, tenant_id, name, description, category, enabled, created_at)
VALUES
  ('ct-daily-ops',  'xavvy-tenant-001','Daily Operations Check',     'Daily opening and closing tasks',    'operational',1,CURRENT_TIMESTAMP),
  ('ct-site-audit', 'xavvy-tenant-001','Monthly Site Audit',          'Health, safety and facilities audit','site_audit', 1,CURRENT_TIMESTAMP),
  ('ct-new-starter','xavvy-tenant-001','IT New Starter Setup',        'IT equipment and access setup',      'it',         1,CURRENT_TIMESTAMP),
  ('ct-compliance', 'xavvy-tenant-001','Quarterly Compliance Review', 'Regulatory compliance check',        'compliance', 1,CURRENT_TIMESTAMP);

UPDATE checklist_templates SET enabled=1 WHERE tenant_id='xavvy-tenant-001';

-- ════════════════════════════════════════════════════════════
-- SHOWCASE SEED DATA — timesheets, leave, RTW, training
-- ════════════════════════════════════════════════════════════

-- Leave requests (approved)
INSERT OR IGNORE INTO leave_requests (id,tenant_id,employee_id,leave_type,start_date,end_date,days,reason,half_day,status,decided_at,comment,created_at)
VALUES
  ('lr-001','xavvy-tenant-001','emp-nanjusha-001','annual','2026-03-03','2026-03-07',5,'Annual holiday',0,'approved',CURRENT_TIMESTAMP,'Approved',CURRENT_TIMESTAMP),
  ('lr-002','xavvy-tenant-001','emp-priya-001','sick','2026-04-14','2026-04-15',2,'Unwell',0,'approved',CURRENT_TIMESTAMP,'Get well soon',CURRENT_TIMESTAMP),
  ('lr-003','xavvy-tenant-001','emp-swathi-001','annual','2026-06-01','2026-06-05',5,'Summer break',0,'approved',CURRENT_TIMESTAMP,'Approved',CURRENT_TIMESTAMP),
  ('lr-004','xavvy-tenant-001','emp-zeba-001','annual','2026-07-14','2026-07-18',5,'Summer holiday',0,'approved',CURRENT_TIMESTAMP,'Approved',CURRENT_TIMESTAMP),
  ('lr-005','xavvy-tenant-001','emp-nanjusha-001','annual','2026-12-24','2026-12-31',6,'Christmas',0,'approved',CURRENT_TIMESTAMP,'Approved',CURRENT_TIMESTAMP);

-- Leave balances (annual leave)
INSERT OR IGNORE INTO leave_balances (id,tenant_id,employee_id,leave_type_id,year,entitlement,taken,pending,carried_forward,updated_at)
VALUES
  ('lb-nan-annual-2026','xavvy-tenant-001','emp-nanjusha-001','lt-annual',2026,25,11,0,3,CURRENT_TIMESTAMP),
  ('lb-pri-annual-2026','xavvy-tenant-001','emp-priya-001',   'lt-annual',2026,25,2,0,3,CURRENT_TIMESTAMP),
  ('lb-swa-annual-2026','xavvy-tenant-001','emp-swathi-001',  'lt-annual',2026,25,5,0,3,CURRENT_TIMESTAMP),
  ('lb-zeb-annual-2026','xavvy-tenant-001','emp-zeba-001',    'lt-annual',2026,25,5,0,3,CURRENT_TIMESTAMP),
  ('lb-nan-sick-2026',  'xavvy-tenant-001','emp-nanjusha-001','lt-sick',  2026,10,0,0,0,CURRENT_TIMESTAMP),
  ('lb-pri-sick-2026',  'xavvy-tenant-001','emp-priya-001',   'lt-sick',  2026,10,2,0,0,CURRENT_TIMESTAMP),
  ('lb-swa-sick-2026',  'xavvy-tenant-001','emp-swathi-001',  'lt-sick',  2026,10,0,0,0,CURRENT_TIMESTAMP),
  ('lb-zeb-sick-2026',  'xavvy-tenant-001','emp-zeba-001',    'lt-sick',  2026,10,0,0,0,CURRENT_TIMESTAMP);

-- Timesheets (approved — 4 weeks for all 4 IoT team members)
INSERT OR IGNORE INTO timesheets (id,tenant_id,employee_id,project_id,week_starting,status,submitted_at)
VALUES
  ('ts-nan-w1','xavvy-tenant-001','emp-nanjusha-001','proj-iot-001','2026-06-01','approved',CURRENT_TIMESTAMP),
  ('ts-pri-w1','xavvy-tenant-001','emp-priya-001','proj-iot-001','2026-06-01','approved',CURRENT_TIMESTAMP),
  ('ts-swa-w1','xavvy-tenant-001','emp-swathi-001','proj-iot-001','2026-06-01','approved',CURRENT_TIMESTAMP),
  ('ts-zeb-w1','xavvy-tenant-001','emp-zeba-001','proj-iot-001','2026-06-01','approved',CURRENT_TIMESTAMP),
  ('ts-nan-w2','xavvy-tenant-001','emp-nanjusha-001','proj-iot-001','2026-05-25','approved',CURRENT_TIMESTAMP),
  ('ts-pri-w2','xavvy-tenant-001','emp-priya-001','proj-iot-001','2026-05-25','approved',CURRENT_TIMESTAMP),
  ('ts-swa-w2','xavvy-tenant-001','emp-swathi-001','proj-iot-001','2026-05-25','approved',CURRENT_TIMESTAMP),
  ('ts-zeb-w2','xavvy-tenant-001','emp-zeba-001','proj-iot-001','2026-05-25','approved',CURRENT_TIMESTAMP);

-- Timesheet entries (Mon-Fri, 7hrs/day = 35hrs/week)
INSERT OR IGNORE INTO timesheet_entries (id,timesheet_id,tenant_id,date,hours_worked,description,billable)
VALUES
  ('te-n1-m','ts-nan-w1','xavvy-tenant-001','2026-06-01',7,'SEWIO integration analysis',1),
  ('te-n1-t','ts-nan-w1','xavvy-tenant-001','2026-06-02',7,'Requirements documentation',1),
  ('te-n1-w','ts-nan-w1','xavvy-tenant-001','2026-06-03',7,'Stakeholder calls',1),
  ('te-n1-th','ts-nan-w1','xavvy-tenant-001','2026-06-04',7,'UAT planning',1),
  ('te-n1-f','ts-nan-w1','xavvy-tenant-001','2026-06-05',7,'Sprint review',1),
  ('te-p1-m','ts-pri-w1','xavvy-tenant-001','2026-06-01',7,'BI dashboard design',1),
  ('te-p1-t','ts-pri-w1','xavvy-tenant-001','2026-06-02',7,'Data pipeline work',1),
  ('te-p1-w','ts-pri-w1','xavvy-tenant-001','2026-06-03',7,'ETL development',1),
  ('te-p1-th','ts-pri-w1','xavvy-tenant-001','2026-06-04',7,'Report validation',1),
  ('te-p1-f','ts-pri-w1','xavvy-tenant-001','2026-06-05',7,'KPI review',1),
  ('te-s1-m','ts-swa-w1','xavvy-tenant-001','2026-06-01',7,'API endpoint development',1),
  ('te-s1-t','ts-swa-w1','xavvy-tenant-001','2026-06-02',7,'REST API testing',1),
  ('te-s1-w','ts-swa-w1','xavvy-tenant-001','2026-06-03',7,'Frontend dashboard',1),
  ('te-s1-th','ts-swa-w1','xavvy-tenant-001','2026-06-04',7,'Real-time map feature',1),
  ('te-s1-f','ts-swa-w1','xavvy-tenant-001','2026-06-05',7,'Code review',1),
  ('te-z1-m','ts-zeb-w1','xavvy-tenant-001','2026-06-01',7,'Database schema work',1),
  ('te-z1-t','ts-zeb-w1','xavvy-tenant-001','2026-06-02',7,'Query optimisation',1),
  ('te-z1-w','ts-zeb-w1','xavvy-tenant-001','2026-06-03',7,'Indexing & performance',1),
  ('te-z1-th','ts-zeb-w1','xavvy-tenant-001','2026-06-04',7,'Data migration scripts',1),
  ('te-z1-f','ts-zeb-w1','xavvy-tenant-001','2026-06-05',7,'DB testing',1),
  -- Week 2 entries
  ('te-n2-m','ts-nan-w2','xavvy-tenant-001','2026-05-25',7,'SEWIO integration analysis',1),
  ('te-n2-t','ts-nan-w2','xavvy-tenant-001','2026-05-26',7,'Requirements documentation',1),
  ('te-n2-w','ts-nan-w2','xavvy-tenant-001','2026-05-27',7,'Architecture review',1),
  ('te-n2-th','ts-nan-w2','xavvy-tenant-001','2026-05-28',7,'Client meeting',1),
  ('te-n2-f','ts-nan-w2','xavvy-tenant-001','2026-05-29',7,'Sprint planning',1),
  ('te-p2-m','ts-pri-w2','xavvy-tenant-001','2026-05-25',7,'BI reports',1),
  ('te-s2-m','ts-swa-w2','xavvy-tenant-001','2026-05-25',7,'API development',1),
  ('te-z2-m','ts-zeb-w2','xavvy-tenant-001','2026-05-25',7,'DB work',1);

-- RTW checks for all employees (so compliance report has data)
INSERT OR IGNORE INTO employee_right_to_work (id,employee_id,tenant_id,status,check_type,check_date,expiry_date,doc_type,doc_reference,checked_by,created_at)
VALUES
  ('rtw-nan','emp-nanjusha-001','xavvy-tenant-001','valid','manual','2025-01-06','2030-01-06','passport','P123456789','usr-nanjusha-001',CURRENT_TIMESTAMP),
  ('rtw-pri','emp-priya-001','xavvy-tenant-001','valid','manual','2025-01-06','2028-05-15','brp','BRP987654321','usr-priya-001',CURRENT_TIMESTAMP),
  ('rtw-swa','emp-swathi-001','xavvy-tenant-001','valid','manual','2025-01-06','2027-03-20','passport','P987654321','usr-swathi-001',CURRENT_TIMESTAMP),
  ('rtw-zeb','emp-zeba-001','xavvy-tenant-001','expiring','manual','2025-01-06','2026-09-15','brp','BRP123456789','usr-zeba-001',CURRENT_TIMESTAMP);

-- Training courses and assignments
INSERT OR IGNORE INTO training_courses (id,tenant_id,name,description,mandatory,duration_hours,provider,created_by,created_at)
VALUES
  ('tc-data-gdpr','xavvy-tenant-001','GDPR & Data Protection','Annual compliance training',1,2,'Internal','usr-nanjusha-001',CURRENT_TIMESTAMP),
  ('tc-fire-safety','xavvy-tenant-001','Fire Safety Awareness','H&S mandatory training',1,1,'Internal','usr-nanjusha-001',CURRENT_TIMESTAMP),
  ('tc-aws','xavvy-tenant-001','AWS Solutions Architect','Cloud architecture certification',0,40,'AWS','usr-nanjusha-001',CURRENT_TIMESTAMP),
  ('tc-agile','xavvy-tenant-001','Agile & Scrum','Project management methodology',0,8,'External','usr-nanjusha-001',CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO training_assignments (id,tenant_id,course_id,employee_id,status,due_date,completed_date,score,progress,created_at,updated_at)
VALUES
  ('ta-nan-gdpr','xavvy-tenant-001','tc-data-gdpr','emp-nanjusha-001','completed','2026-03-31','2026-02-14',95,100,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('ta-pri-gdpr','xavvy-tenant-001','tc-data-gdpr','emp-priya-001','completed','2026-03-31','2026-03-01',88,100,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('ta-swa-gdpr','xavvy-tenant-001','tc-data-gdpr','emp-swathi-001','completed','2026-03-31','2026-03-15',92,100,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('ta-zeb-gdpr','xavvy-tenant-001','tc-data-gdpr','emp-zeba-001','in_progress','2026-03-31',NULL,NULL,60,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('ta-nan-fire','xavvy-tenant-001','tc-fire-safety','emp-nanjusha-001','completed','2026-06-30','2026-04-10',100,100,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('ta-pri-fire','xavvy-tenant-001','tc-fire-safety','emp-priya-001','completed','2026-06-30','2026-04-12',100,100,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('ta-swa-fire','xavvy-tenant-001','tc-fire-safety','emp-swathi-001','not_started','2026-06-30',NULL,NULL,0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('ta-zeb-fire','xavvy-tenant-001','tc-fire-safety','emp-zeba-001','not_started','2026-06-30',NULL,NULL,0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('ta-nan-aws','xavvy-tenant-001','tc-aws','emp-nanjusha-001','in_progress','2026-09-30',NULL,NULL,35,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('ta-swa-aws','xavvy-tenant-001','tc-aws','emp-swathi-001','in_progress','2026-09-30',NULL,NULL,50,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);

-- Expense claims
INSERT OR IGNORE INTO expense_claims (id,tenant_id,employee_id,category,amount,currency,description,expense_date,status,created_at)
VALUES
  ('exp-001','xavvy-tenant-001','emp-nanjusha-001','travel',45.80,'GBP','Train to client meeting','2026-05-15','approved',CURRENT_TIMESTAMP),
  ('exp-002','xavvy-tenant-001','emp-priya-001','software',120.00,'GBP','Tableau license renewal','2026-05-20','approved',CURRENT_TIMESTAMP),
  ('exp-003','xavvy-tenant-001','emp-swathi-001','equipment',89.99,'GBP','Keyboard and mouse','2026-05-22','pending',CURRENT_TIMESTAMP),
  ('exp-004','xavvy-tenant-001','emp-zeba-001','travel',28.50,'GBP','Taxi to office','2026-06-01','pending',CURRENT_TIMESTAMP);

-- Resource bookings (for resource planning showcase)
INSERT OR IGNORE INTO resource_bookings (id,tenant_id,employee_id,project_id,booking_type,week_starting,hours,notes,created_by,created_at)
VALUES
  ('rb-nan-w1','xavvy-tenant-001','emp-nanjusha-001','proj-iot-001','project','2026-06-08',35,'SEWIO integration','usr-nanjusha-001',CURRENT_TIMESTAMP),
  ('rb-pri-w1','xavvy-tenant-001','emp-priya-001','proj-iot-001','project','2026-06-08',35,'BI pipeline','usr-priya-001',CURRENT_TIMESTAMP),
  ('rb-swa-w1','xavvy-tenant-001','emp-swathi-001','proj-iot-001','project','2026-06-08',30,'API development','usr-swathi-001',CURRENT_TIMESTAMP),
  ('rb-zeb-w1','xavvy-tenant-001','emp-zeba-001','proj-iot-001','project','2026-06-08',35,'DB work','usr-zeba-001',CURRENT_TIMESTAMP),
  ('rb-swa-int','xavvy-tenant-001','emp-swathi-001',NULL,'internal','2026-06-08',5,'Team meetings','usr-swathi-001',CURRENT_TIMESTAMP),
  ('rb-nan-w2','xavvy-tenant-001','emp-nanjusha-001','proj-iot-001','project','2026-06-15',35,'Analysis','usr-nanjusha-001',CURRENT_TIMESTAMP),
  ('rb-pri-w2','xavvy-tenant-001','emp-priya-001','proj-iot-001','project','2026-06-15',35,'BI reports','usr-priya-001',CURRENT_TIMESTAMP),
  ('rb-swa-w2','xavvy-tenant-001','emp-swathi-001','proj-iot-001','project','2026-06-15',35,'Frontend','usr-swathi-001',CURRENT_TIMESTAMP),
  ('rb-zeb-w2','xavvy-tenant-001','emp-zeba-001','proj-iot-001','project','2026-06-15',28,'DB optimisation','usr-zeba-001',CURRENT_TIMESTAMP);

-- ════════════════════════════════════════════════════════════
-- RECRUITMENT SHOWCASE DATA
-- ════════════════════════════════════════════════════════════

-- Job postings
INSERT OR IGNORE INTO job_postings (id,tenant_id,title,department_id,location,location_type,description,requirements,salary_min,salary_max,currency,closing_date,status,created_by,created_at)
VALUES
  ('jp-swe-001','xavvy-tenant-001','Senior Software Engineer','dept-eng','London, UK','hybrid','We are looking for a Senior Software Engineer to join our growing IoT platform team.','5+ years experience, Python/TypeScript, cloud platforms',60000,80000,'GBP','2026-08-31','open','usr-nanjusha-001',CURRENT_TIMESTAMP),
  ('jp-pm-001','xavvy-tenant-001','Product Manager','dept-eng','London, UK','hybrid','Experienced Product Manager to lead our IoT product roadmap.','3+ years product management, B2B SaaS experience',55000,70000,'GBP','2026-07-31','open','usr-nanjusha-001',CURRENT_TIMESTAMP),
  ('jp-da-001','xavvy-tenant-001','Data Analyst','dept-eng','Remote','remote','Data Analyst to help build our analytics and reporting capabilities.','SQL, Python, BI tools (Tableau/PowerBI)',40000,55000,'GBP','2026-09-30','open','usr-nanjusha-001',CURRENT_TIMESTAMP);

-- Candidates
INSERT OR IGNORE INTO candidates (id,tenant_id,first_name,last_name,email,phone,location,source,notes,status,created_at,updated_at)
VALUES
  ('cand-001','xavvy-tenant-001','James','Harrison','james.harrison@email.com','+44 7700 123456','London, UK','linkedin','Strong TypeScript background, ex-Meta','active',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('cand-002','xavvy-tenant-001','Sarah','Chen','sarah.chen@email.com','+44 7700 234567','Manchester, UK','referral','Referred by Nanjusha — excellent PM background','active',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('cand-003','xavvy-tenant-001','Rahul','Patel','rahul.patel@email.com','+44 7700 345678','Remote','job_board','5 years at Deloitte, strong analytics skills','active',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('cand-004','xavvy-tenant-001','Emma','Williams','emma.williams@email.com','+44 7700 456789','London, UK','linkedin','Junior profile but strong portfolio','active',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('cand-005','xavvy-tenant-001','David','Okonkwo','david.okonkwo@email.com','+44 7700 567890','London, UK','linkedin','Lead engineer at fintech startup','active',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);

-- job_applications skipped — schema varies between 001_core and 006_recruitment migrations
-- Add applications through the Recruitment UI after seeding


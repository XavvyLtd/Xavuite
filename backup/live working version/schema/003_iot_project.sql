-- ============================================================
-- XavvySuite — IoT Platform Project Seed
-- 003_iot_project.sql  (v3 — failproof)
-- ============================================================

PRAGMA foreign_keys = OFF;

-- ── 1. USERS ─────────────────────────────────────────────────────────────────
-- INSERT OR REPLACE ensures they always exist regardless of prior runs
INSERT OR REPLACE INTO users (id, tenant_id, email, password_hash, status, auth_provider, created_at)
VALUES
  ('usr-nanjusha-001', 'xavvy-tenant-001', 'nanjusha.vasireddy@xavvy.uk',
   'sha256:xavvy2025:8b7e9f2a1c4d6e3b0a5f8c2d7e4b1a9f6c3d8e5b2a7f4c1d6e3b0a5f8c2d7e',
   'active', 'local', CURRENT_TIMESTAMP),
  ('usr-priya-001', 'xavvy-tenant-001', 'priya.narsing@xavvy.uk',
   'sha256:xavvy2025:8b7e9f2a1c4d6e3b0a5f8c2d7e4b1a9f6c3d8e5b2a7f4c1d6e3b0a5f8c2d7e',
   'active', 'local', CURRENT_TIMESTAMP),
  ('usr-swathi-001', 'xavvy-tenant-001', 'swathi.m@xavvy.uk',
   'sha256:xavvy2025:8b7e9f2a1c4d6e3b0a5f8c2d7e4b1a9f6c3d8e5b2a7f4c1d6e3b0a5f8c2d7e',
   'active', 'local', CURRENT_TIMESTAMP),
  ('usr-zeba-001', 'xavvy-tenant-001', 'zeba.mansoor@xavvy.uk',
   'sha256:xavvy2025:8b7e9f2a1c4d6e3b0a5f8c2d7e4b1a9f6c3d8e5b2a7f4c1d6e3b0a5f8c2d7e',
   'active', 'local', CURRENT_TIMESTAMP);

-- ── 2. DESIGNATIONS ──────────────────────────────────────────────────────────
INSERT OR REPLACE INTO designations (id, tenant_id, title, grade) VALUES
  ('des-analyst-prog', 'xavvy-tenant-001', 'Analyst Programmer',      'L3'),
  ('des-ba-bi',        'xavvy-tenant-001', 'IT Business Analyst (BI)', 'L3'),
  ('des-fullstack',    'xavvy-tenant-001', 'Developer (Full Stack)',   'L3'),
  ('des-db-prog',      'xavvy-tenant-001', 'Database Programmer',      'L3');

-- ── 3. EMPLOYEES ─────────────────────────────────────────────────────────────
INSERT OR REPLACE INTO employees (id, tenant_id, user_id, employee_number, status, created_at, created_by)
VALUES
  ('emp-nanjusha-001', 'xavvy-tenant-001', 'usr-nanjusha-001', 'EMP-1001', 'active', CURRENT_TIMESTAMP,
   (SELECT id FROM users WHERE tenant_id='xavvy-tenant-001' AND email='admin@xavvy.uk' LIMIT 1)),
  ('emp-priya-001', 'xavvy-tenant-001', 'usr-priya-001', 'EMP-1002', 'active', CURRENT_TIMESTAMP,
   (SELECT id FROM users WHERE tenant_id='xavvy-tenant-001' AND email='admin@xavvy.uk' LIMIT 1)),
  ('emp-swathi-001', 'xavvy-tenant-001', 'usr-swathi-001', 'EMP-1003', 'active', CURRENT_TIMESTAMP,
   (SELECT id FROM users WHERE tenant_id='xavvy-tenant-001' AND email='admin@xavvy.uk' LIMIT 1)),
  ('emp-zeba-001', 'xavvy-tenant-001', 'usr-zeba-001', 'EMP-1004', 'active', CURRENT_TIMESTAMP,
   (SELECT id FROM users WHERE tenant_id='xavvy-tenant-001' AND email='admin@xavvy.uk' LIMIT 1));

-- ── 4. EMPLOYEE HISTORY ───────────────────────────────────────────────────────
-- First clear any stale is_current flags for these employees
UPDATE employee_history SET is_current = 0
  WHERE employee_id IN ('emp-nanjusha-001','emp-priya-001','emp-swathi-001','emp-zeba-001');

INSERT OR REPLACE INTO employee_history (
  id, employee_id, tenant_id,
  first_name, last_name,
  department_id, designation_id, org_unit_id,
  start_date, employment_type, employment_basis, contract_type,
  work_location_type, work_location,
  probation_status, status,
  change_reason, changed_by, effective_from, is_current
) VALUES
  ('eh-nanjusha-001', 'emp-nanjusha-001', 'xavvy-tenant-001',
   'Nanjusha', 'Vasireddy',
   'dept-eng', 'des-analyst-prog', 'unit-xavvy-001',
   '2025-01-06', 'full_time', 'permanent', 'employed',
   'hybrid', 'London HQ', 'passed', 'active', 'new_hire',
   (SELECT id FROM users WHERE tenant_id='xavvy-tenant-001' AND email='admin@xavvy.uk' LIMIT 1),
   '2025-01-06', 1),

  ('eh-priya-001', 'emp-priya-001', 'xavvy-tenant-001',
   'Priya', 'Narsing',
   'dept-eng', 'des-ba-bi', 'unit-xavvy-001',
   '2025-01-06', 'full_time', 'permanent', 'employed',
   'hybrid', 'London HQ', 'passed', 'active', 'new_hire',
   (SELECT id FROM users WHERE tenant_id='xavvy-tenant-001' AND email='admin@xavvy.uk' LIMIT 1),
   '2025-01-06', 1),

  ('eh-swathi-001', 'emp-swathi-001', 'xavvy-tenant-001',
   'Swathi', 'M',
   'dept-eng', 'des-fullstack', 'unit-xavvy-001',
   '2025-01-06', 'full_time', 'permanent', 'employed',
   'remote', 'Remote', 'passed', 'active', 'new_hire',
   (SELECT id FROM users WHERE tenant_id='xavvy-tenant-001' AND email='admin@xavvy.uk' LIMIT 1),
   '2025-01-06', 1),

  ('eh-zeba-001', 'emp-zeba-001', 'xavvy-tenant-001',
   'Zeba', 'Mansoor',
   'dept-eng', 'des-db-prog', 'unit-xavvy-001',
   '2025-01-06', 'full_time', 'permanent', 'employed',
   'hybrid', 'London HQ', 'passed', 'active', 'new_hire',
   (SELECT id FROM users WHERE tenant_id='xavvy-tenant-001' AND email='admin@xavvy.uk' LIMIT 1),
   '2025-01-06', 1);

-- ── 5. USER ROLES ─────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO user_roles (id, user_id, role_id, scope_type, granted_by, granted_at)
VALUES
  ('ur-nanjusha-001', 'usr-nanjusha-001', 'role-employee', 'tenant',
   (SELECT id FROM users WHERE tenant_id='xavvy-tenant-001' AND email='admin@xavvy.uk' LIMIT 1), CURRENT_TIMESTAMP),
  ('ur-priya-001', 'usr-priya-001', 'role-employee', 'tenant',
   (SELECT id FROM users WHERE tenant_id='xavvy-tenant-001' AND email='admin@xavvy.uk' LIMIT 1), CURRENT_TIMESTAMP),
  ('ur-swathi-001', 'usr-swathi-001', 'role-employee', 'tenant',
   (SELECT id FROM users WHERE tenant_id='xavvy-tenant-001' AND email='admin@xavvy.uk' LIMIT 1), CURRENT_TIMESTAMP),
  ('ur-zeba-001', 'usr-zeba-001', 'role-employee', 'tenant',
   (SELECT id FROM users WHERE tenant_id='xavvy-tenant-001' AND email='admin@xavvy.uk' LIMIT 1), CURRENT_TIMESTAMP);

-- ── 6. PROJECT ────────────────────────────────────────────────────────────────
INSERT OR REPLACE INTO pmo_projects (id, tenant_id, name, client_name, start_date, end_date, budget, spent, priority, status, created_by, created_at)
VALUES (
  'proj-iot-001', 'xavvy-tenant-001',
  'IoT Platform', 'Xavvy Ltd',
  '2025-01-06', '2027-12-31',
  480000, 0, 'high', 'active',
  (SELECT id FROM users WHERE tenant_id='xavvy-tenant-001' AND email='admin@xavvy.uk' LIMIT 1),
  CURRENT_TIMESTAMP
);

-- ── 7. SPRINTS ────────────────────────────────────────────────────────────────
INSERT OR REPLACE INTO pmo_sprints (id, tenant_id, project_id, sprint_number, sprint_name, start_date, end_date, status)
VALUES
  ('spr-iot-01', 'xavvy-tenant-001', 'proj-iot-001', 10, 'Requirements & Discovery',   '2025-01-06', '2025-04-30', 'completed'),
  ('spr-iot-02', 'xavvy-tenant-001', 'proj-iot-001', 11, 'Architecture & Design',       '2025-03-01', '2025-07-31', 'completed'),
  ('spr-iot-03', 'xavvy-tenant-001', 'proj-iot-001', 12, 'Hardware / RTLS Integration', '2025-06-01', '2025-12-31', 'active'),
  ('spr-iot-04', 'xavvy-tenant-001', 'proj-iot-001', 13, 'Backend Development',         '2025-08-01', '2026-06-30', 'active'),
  ('spr-iot-05', 'xavvy-tenant-001', 'proj-iot-001', 14, 'Dashboard Development',       '2026-01-01', '2026-09-30', 'upcoming'),
  ('spr-iot-06', 'xavvy-tenant-001', 'proj-iot-001', 15, 'Testing & QA',                '2026-07-01', '2027-02-28', 'upcoming'),
  ('spr-iot-07', 'xavvy-tenant-001', 'proj-iot-001', 16, 'Pilot & Rollout',             '2027-01-01', '2027-07-31', 'upcoming'),
  ('spr-iot-08', 'xavvy-tenant-001', 'proj-iot-001', 17, 'Support & Optimisation',      '2027-05-01', '2027-12-31', 'upcoming');

-- ── 8. ALLOCATIONS ───────────────────────────────────────────────────────────
INSERT OR REPLACE INTO pmo_allocations (id, tenant_id, project_id, employee_id, role, allocation, start_date, end_date)
VALUES
  ('alloc-nanjusha', 'xavvy-tenant-001', 'proj-iot-001', 'emp-nanjusha-001', 'Analyst Programmer',      100, '2025-01-06', '2027-12-31'),
  ('alloc-priya',    'xavvy-tenant-001', 'proj-iot-001', 'emp-priya-001',    'IT Business Analyst (BI)', 100, '2025-01-06', '2027-12-31'),
  ('alloc-swathi',   'xavvy-tenant-001', 'proj-iot-001', 'emp-swathi-001',   'Developer (Full Stack)',   100, '2025-01-06', '2027-12-31'),
  ('alloc-zeba',     'xavvy-tenant-001', 'proj-iot-001', 'emp-zeba-001',     'Database Programmer',      100, '2025-01-06', '2027-12-31');

-- ── 9. TASKS ─────────────────────────────────────────────────────────────────
-- Phase 1: Requirements & Discovery
INSERT OR REPLACE INTO pmo_tasks (id, tenant_id, project_id, sprint_id, name, description, assignee_id, priority, status, estimated_hours, phase, task_category, task_order, due_date, created_by, created_at, updated_at) VALUES
  ('task-iot-001','xavvy-tenant-001','proj-iot-001','spr-iot-01','Stakeholder interviews & workshops','Conduct structured interviews with all key stakeholders. Document requirements and business objectives for SEWIO IoT platform.','emp-nanjusha-001','high','done',40,'Requirements & Discovery','Analysis',1,'2025-01-31',(SELECT id FROM users WHERE tenant_id='xavvy-tenant-001' AND email='admin@xavvy.uk' LIMIT 1),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-002','xavvy-tenant-001','proj-iot-001','spr-iot-01','BI requirements & KPI definition','Define all BI reporting requirements, KPIs, dashboards and data flows required by business stakeholders.','emp-priya-001','high','done',48,'Requirements & Discovery','Analysis',2,'2025-02-14',(SELECT id FROM users WHERE tenant_id='xavvy-tenant-001' AND email='admin@xavvy.uk' LIMIT 1),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-003','xavvy-tenant-001','proj-iot-001','spr-iot-01','Technical feasibility & stack selection','Assess technical feasibility of SEWIO RTLS integration. Recommend technology stack.','emp-swathi-001','high','done',32,'Requirements & Discovery','Analysis',3,'2025-02-28',(SELECT id FROM users WHERE tenant_id='xavvy-tenant-001' AND email='admin@xavvy.uk' LIMIT 1),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-004','xavvy-tenant-001','proj-iot-001','spr-iot-01','Data model scoping & schema requirements','Define high-level data model for location tracking, asset management and time-series telemetry.','emp-zeba-001','high','done',32,'Requirements & Discovery','Analysis',4,'2025-03-14',(SELECT id FROM users WHERE tenant_id='xavvy-tenant-001' AND email='admin@xavvy.uk' LIMIT 1),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-005','xavvy-tenant-001','proj-iot-001','spr-iot-01','Business requirements document (BRD)','Produce final signed-off BRD covering all functional and non-functional requirements.','emp-nanjusha-001','critical','done',24,'Requirements & Discovery','Documentation',5,'2025-04-30',(SELECT id FROM users WHERE tenant_id='xavvy-tenant-001' AND email='admin@xavvy.uk' LIMIT 1),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
-- Phase 2: Architecture & Design
  ('task-iot-006','xavvy-tenant-001','proj-iot-001','spr-iot-02','Solution architecture design','Design end-to-end solution architecture covering SEWIO RTLS anchors, IoT gateway, backend API, database and dashboard layers.','emp-nanjusha-001','critical','done',56,'Architecture & Design','Architecture',1,'2025-04-30',(SELECT id FROM users WHERE tenant_id='xavvy-tenant-001' AND email='admin@xavvy.uk' LIMIT 1),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-007','xavvy-tenant-001','proj-iot-001','spr-iot-02','BI architecture & data warehouse design','Design data warehouse schema, ETL pipelines and reporting layer architecture.','emp-priya-001','high','done',48,'Architecture & Design','Architecture',2,'2025-05-15',(SELECT id FROM users WHERE tenant_id='xavvy-tenant-001' AND email='admin@xavvy.uk' LIMIT 1),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-008','xavvy-tenant-001','proj-iot-001','spr-iot-02','Full-stack architecture & API design','Design REST API contracts, frontend component architecture, auth model and real-time data streaming.','emp-swathi-001','high','done',64,'Architecture & Design','Architecture',3,'2025-06-15',(SELECT id FROM users WHERE tenant_id='xavvy-tenant-001' AND email='admin@xavvy.uk' LIMIT 1),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-009','xavvy-tenant-001','proj-iot-001','spr-iot-02','Database schema & ERD design','Design full database schema including time-series tables for RTLS telemetry and zone management.','emp-zeba-001','high','done',56,'Architecture & Design','Architecture',4,'2025-06-30',(SELECT id FROM users WHERE tenant_id='xavvy-tenant-001' AND email='admin@xavvy.uk' LIMIT 1),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-010','xavvy-tenant-001','proj-iot-001','spr-iot-02','Architecture sign-off & design review','Conduct formal architecture review. Obtain sign-off before proceeding to build phases.','emp-nanjusha-001','critical','done',16,'Architecture & Design','Review',5,'2025-07-31',(SELECT id FROM users WHERE tenant_id='xavvy-tenant-001' AND email='admin@xavvy.uk' LIMIT 1),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
-- Phase 3: Hardware / RTLS Integration
  ('task-iot-011','xavvy-tenant-001','proj-iot-001','spr-iot-03','SEWIO anchor placement specification','Define anchor placement plan for all zones. Produce RF coverage map and installation checklist.','emp-nanjusha-001','high','in_progress',48,'Hardware / RTLS Integration','Hardware',1,'2025-07-31',(SELECT id FROM users WHERE tenant_id='xavvy-tenant-001' AND email='admin@xavvy.uk' LIMIT 1),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-012','xavvy-tenant-001','proj-iot-001','spr-iot-03','SEWIO API integration — tag & zone data','Implement real-time integration with SEWIO Location Engine API. Ingest tag positions and zone events.','emp-swathi-001','critical','in_progress',120,'Hardware / RTLS Integration','Integration',2,'2025-10-31',(SELECT id FROM users WHERE tenant_id='xavvy-tenant-001' AND email='admin@xavvy.uk' LIMIT 1),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-013','xavvy-tenant-001','proj-iot-001','spr-iot-03','Time-series database for location telemetry','Implement time-series storage for RTLS position data. Design partitioning and retention strategy.','emp-zeba-001','high','in_progress',80,'Hardware / RTLS Integration','Database',3,'2025-11-30',(SELECT id FROM users WHERE tenant_id='xavvy-tenant-001' AND email='admin@xavvy.uk' LIMIT 1),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-014','xavvy-tenant-001','proj-iot-001','spr-iot-03','Hardware integration testing','End-to-end testing of anchor-to-platform data pipeline. Validate position accuracy and zone event detection.','emp-nanjusha-001','high','todo',40,'Hardware / RTLS Integration','Testing',4,'2025-12-31',(SELECT id FROM users WHERE tenant_id='xavvy-tenant-001' AND email='admin@xavvy.uk' LIMIT 1),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
-- Phase 4: Backend Development
  ('task-iot-015','xavvy-tenant-001','proj-iot-001','spr-iot-04','REST API — asset tracking endpoints','Build CRUD API endpoints for asset registration, assignment, location history and zone occupancy.','emp-swathi-001','critical','in_progress',160,'Backend Development','Development',1,'2026-01-31',(SELECT id FROM users WHERE tenant_id='xavvy-tenant-001' AND email='admin@xavvy.uk' LIMIT 1),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-016','xavvy-tenant-001','proj-iot-001','spr-iot-04','Authentication, RBAC & multi-tenant support','Implement JWT-based auth, role-based access control and tenant isolation for the IoT platform API.','emp-swathi-001','critical','todo',80,'Backend Development','Development',2,'2025-11-30',(SELECT id FROM users WHERE tenant_id='xavvy-tenant-001' AND email='admin@xavvy.uk' LIMIT 1),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-017','xavvy-tenant-001','proj-iot-001','spr-iot-04','Database development — core schema','Implement all database tables, indexes, stored procedures and migration scripts per approved ERD.','emp-zeba-001','critical','in_progress',200,'Backend Development','Database',3,'2026-03-31',(SELECT id FROM users WHERE tenant_id='xavvy-tenant-001' AND email='admin@xavvy.uk' LIMIT 1),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-018','xavvy-tenant-001','proj-iot-001','spr-iot-04','BI data pipeline & ETL development','Build ETL pipelines from RTLS telemetry to data warehouse with incremental load and data quality checks.','emp-priya-001','high','todo',120,'Backend Development','BI/Data',4,'2026-04-30',(SELECT id FROM users WHERE tenant_id='xavvy-tenant-001' AND email='admin@xavvy.uk' LIMIT 1),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-019','xavvy-tenant-001','proj-iot-001','spr-iot-04','Query optimisation & performance tuning','Profile and optimise all slow queries. Implement caching strategy and connection pooling.','emp-zeba-001','high','todo',80,'Backend Development','Database',5,'2026-06-30',(SELECT id FROM users WHERE tenant_id='xavvy-tenant-001' AND email='admin@xavvy.uk' LIMIT 1),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
-- Phase 5: Dashboard Development
  ('task-iot-020','xavvy-tenant-001','proj-iot-001','spr-iot-05','Real-time location map dashboard','Build interactive floor-plan map showing live asset positions, zone occupancy heatmaps and movement trails.','emp-swathi-001','critical','todo',160,'Dashboard Development','Frontend',1,'2026-05-31',(SELECT id FROM users WHERE tenant_id='xavvy-tenant-001' AND email='admin@xavvy.uk' LIMIT 1),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-021','xavvy-tenant-001','proj-iot-001','spr-iot-05','BI dashboards — utilisation & analytics','Build Power BI / Grafana dashboards for zone utilisation, asset dwell time and operational KPIs.','emp-priya-001','high','todo',144,'Dashboard Development','BI',2,'2026-07-31',(SELECT id FROM users WHERE tenant_id='xavvy-tenant-001' AND email='admin@xavvy.uk' LIMIT 1),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-022','xavvy-tenant-001','proj-iot-001','spr-iot-05','Alert & notification system','Implement configurable alert rules for zone breaches, asset movement and geofence violations.','emp-swathi-001','high','todo',80,'Dashboard Development','Frontend',3,'2026-08-31',(SELECT id FROM users WHERE tenant_id='xavvy-tenant-001' AND email='admin@xavvy.uk' LIMIT 1),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-023','xavvy-tenant-001','proj-iot-001','spr-iot-05','Dashboard DB views & aggregation queries','Create optimised database views and aggregation tables to power dashboard data endpoints.','emp-zeba-001','high','todo',80,'Dashboard Development','Database',4,'2026-09-30',(SELECT id FROM users WHERE tenant_id='xavvy-tenant-001' AND email='admin@xavvy.uk' LIMIT 1),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
-- Phase 6: Testing & QA
  ('task-iot-024','xavvy-tenant-001','proj-iot-001','spr-iot-06','UAT planning & test script authoring','Produce comprehensive UAT test plan and scripts covering all user journeys and acceptance criteria.','emp-nanjusha-001','high','todo',80,'Testing & QA','QA',1,'2026-08-31',(SELECT id FROM users WHERE tenant_id='xavvy-tenant-001' AND email='admin@xavvy.uk' LIMIT 1),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-025','xavvy-tenant-001','proj-iot-001','spr-iot-06','Integration & end-to-end testing','Execute full integration test suite covering SEWIO anchor to dashboard pipeline. Triage all defects.','emp-swathi-001','critical','todo',160,'Testing & QA','QA',2,'2026-11-30',(SELECT id FROM users WHERE tenant_id='xavvy-tenant-001' AND email='admin@xavvy.uk' LIMIT 1),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-026','xavvy-tenant-001','proj-iot-001','spr-iot-06','BI report & data accuracy validation','Validate all BI dashboard figures against source data. Sign off data lineage with business stakeholders.','emp-priya-001','high','todo',96,'Testing & QA','QA',3,'2026-12-31',(SELECT id FROM users WHERE tenant_id='xavvy-tenant-001' AND email='admin@xavvy.uk' LIMIT 1),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-027','xavvy-tenant-001','proj-iot-001','spr-iot-06','Database load & integrity testing','Conduct database load tests at 10x expected volume. Validate referential integrity and backup/restore.','emp-zeba-001','high','todo',96,'Testing & QA','QA',4,'2027-01-31',(SELECT id FROM users WHERE tenant_id='xavvy-tenant-001' AND email='admin@xavvy.uk' LIMIT 1),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-028','xavvy-tenant-001','proj-iot-001','spr-iot-06','UAT execution & defect resolution','Manage UAT execution with end users. Track and validate resolution of all defects before go-live.','emp-nanjusha-001','critical','todo',80,'Testing & QA','QA',5,'2027-02-28',(SELECT id FROM users WHERE tenant_id='xavvy-tenant-001' AND email='admin@xavvy.uk' LIMIT 1),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
-- Phase 7: Pilot & Rollout
  ('task-iot-029','xavvy-tenant-001','proj-iot-001','spr-iot-07','Pilot site deployment & configuration','Deploy platform to pilot site. Configure SEWIO anchors, provision user accounts and validate live data flows.','emp-nanjusha-001','critical','todo',80,'Pilot & Rollout','Deployment',1,'2027-02-28',(SELECT id FROM users WHERE tenant_id='xavvy-tenant-001' AND email='admin@xavvy.uk' LIMIT 1),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-030','xavvy-tenant-001','proj-iot-001','spr-iot-07','User training & onboarding','Deliver training sessions for all platform user groups. Produce user guides and video walkthroughs.','emp-nanjusha-001','high','todo',64,'Pilot & Rollout','Training',2,'2027-03-31',(SELECT id FROM users WHERE tenant_id='xavvy-tenant-001' AND email='admin@xavvy.uk' LIMIT 1),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-031','xavvy-tenant-001','proj-iot-001','spr-iot-07','Pilot data analysis & reporting','Analyse pilot data quality. Produce pilot performance report with recommendations for full rollout.','emp-priya-001','high','todo',96,'Pilot & Rollout','Analysis',3,'2027-04-30',(SELECT id FROM users WHERE tenant_id='xavvy-tenant-001' AND email='admin@xavvy.uk' LIMIT 1),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-032','xavvy-tenant-001','proj-iot-001','spr-iot-07','Production go-live & hypercare','Full production deployment. Provide 30-day hypercare support. Monitor all KPIs and resolve critical issues.','emp-swathi-001','critical','todo',80,'Pilot & Rollout','Deployment',4,'2027-06-30',(SELECT id FROM users WHERE tenant_id='xavvy-tenant-001' AND email='admin@xavvy.uk' LIMIT 1),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-033','xavvy-tenant-001','proj-iot-001','spr-iot-07','Production DB migration & data verification','Execute production data migration. Validate all records and confirm zero data loss.','emp-zeba-001','critical','todo',64,'Pilot & Rollout','Database',5,'2027-05-31',(SELECT id FROM users WHERE tenant_id='xavvy-tenant-001' AND email='admin@xavvy.uk' LIMIT 1),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
-- Phase 8: Support & Optimisation
  ('task-iot-034','xavvy-tenant-001','proj-iot-001','spr-iot-08','BAU support & issue management','Provide ongoing BAU support. Triage and resolve incidents within SLA. Maintain support log.','emp-nanjusha-001','medium','todo',200,'Support & Optimisation','Support',1,'2027-12-31',(SELECT id FROM users WHERE tenant_id='xavvy-tenant-001' AND email='admin@xavvy.uk' LIMIT 1),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-035','xavvy-tenant-001','proj-iot-001','spr-iot-08','BI optimisation & new report development','Optimise existing BI reports. Develop new dashboards based on user feedback.','emp-priya-001','medium','todo',160,'Support & Optimisation','BI',2,'2027-12-31',(SELECT id FROM users WHERE tenant_id='xavvy-tenant-001' AND email='admin@xavvy.uk' LIMIT 1),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-036','xavvy-tenant-001','proj-iot-001','spr-iot-08','Platform feature development','Develop and release prioritised enhancement features. Maintain CI/CD pipeline and release cadence.','emp-swathi-001','medium','todo',160,'Support & Optimisation','Development',3,'2027-12-31',(SELECT id FROM users WHERE tenant_id='xavvy-tenant-001' AND email='admin@xavvy.uk' LIMIT 1),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('task-iot-037','xavvy-tenant-001','proj-iot-001','spr-iot-08','Database optimisation & archiving','Implement database archiving strategy and ongoing query optimisation as data volumes grow.','emp-zeba-001','medium','todo',120,'Support & Optimisation','Database',4,'2027-12-31',(SELECT id FROM users WHERE tenant_id='xavvy-tenant-001' AND email='admin@xavvy.uk' LIMIT 1),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);

PRAGMA foreign_keys = ON;
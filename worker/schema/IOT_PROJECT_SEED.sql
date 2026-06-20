-- ============================================================
-- XavvySuite — IoT Platform Project Fresh Seed
-- Wipes: timesheets, leave, tasks, projects
-- Reseeds: full SDLC Nov'25 → Dec'28, £270K, 50% allocation
-- ============================================================

-- ── WIPE (children before parents to satisfy FK constraints) ────
DELETE FROM timesheet_entries   WHERE tenant_id='xavvy-tenant-001';
DELETE FROM timesheets          WHERE tenant_id='xavvy-tenant-001';
DELETE FROM leave_requests      WHERE tenant_id='xavvy-tenant-001';
DELETE FROM leave_balances      WHERE tenant_id='xavvy-tenant-001';
DELETE FROM resource_bookings   WHERE tenant_id='xavvy-tenant-001';
DELETE FROM resource_capacity   WHERE tenant_id='xavvy-tenant-001';
DELETE FROM pmo_tasks           WHERE tenant_id='xavvy-tenant-001';
DELETE FROM pmo_allocations     WHERE tenant_id='xavvy-tenant-001';
DELETE FROM pmo_sprints         WHERE tenant_id='xavvy-tenant-001';
DELETE FROM pmo_projects        WHERE tenant_id='xavvy-tenant-001';

-- ── PROJECT ───────────────────────────────────────────────────
-- £270K total, 50% resource allocation, Nov 2025 → Dec 2028
INSERT OR REPLACE INTO pmo_projects (
  id, tenant_id, name, client_name,
  start_date, end_date, budget, spent,
  priority, status, created_by, created_at
) VALUES (
  'proj-iot-001', 'xavvy-tenant-001',
  'SEWIO IoT Platform', 'Xavvy Ltd',
  '2025-11-01', '2028-12-31',
  270000, 47800,
  'high', 'active',
  (SELECT id FROM users WHERE email='admin@xavvy.uk' LIMIT 1),
  CURRENT_TIMESTAMP
);

-- ── RESOURCE ALLOCATIONS (50% each) ──────────────────────────
-- 4 people × 50% × ~17.5 hrs/wk = £270K over 38 months
INSERT OR IGNORE INTO pmo_allocations (id, project_id, employee_id, tenant_id, role, allocation, start_date, end_date) VALUES
  ('alloc-nan-iot','proj-iot-001','emp-nanjusha-001','xavvy-tenant-001','Business Analyst / PM',  50,'2025-11-01','2028-12-31'),
  ('alloc-pri-iot','proj-iot-001','emp-priya-001',   'xavvy-tenant-001','BI & Analytics Engineer',50,'2025-11-01','2028-12-31'),
  ('alloc-swa-iot','proj-iot-001','emp-swathi-001',  'xavvy-tenant-001','Full Stack Developer',   50,'2025-11-01','2028-12-31'),
  ('alloc-zeb-iot','proj-iot-001','emp-zeba-001',    'xavvy-tenant-001','Database Engineer',      50,'2025-11-01','2028-12-31');

-- ── SPRINTS (8 phases across 3 years) ────────────────────────
INSERT OR IGNORE INTO pmo_sprints (id, project_id, tenant_id, sprint_number, sprint_name, start_date, end_date, status) VALUES
  ('spr-ph1','proj-iot-001','xavvy-tenant-001',1,'Phase 1 — Discovery & Requirements',      '2025-11-01','2026-01-31','completed'),
  ('spr-ph2','proj-iot-001','xavvy-tenant-001',2,'Phase 2 — System Design & Architecture',  '2026-02-01','2026-04-30','completed'),
  ('spr-ph3','proj-iot-001','xavvy-tenant-001',3,'Phase 3 — Core Infrastructure',            '2026-05-01','2026-09-30','active'),
  ('spr-ph4','proj-iot-001','xavvy-tenant-001',4,'Phase 4 — Integration & APIs',             '2026-10-01','2027-02-28','upcoming'),
  ('spr-ph5','proj-iot-001','xavvy-tenant-001',5,'Phase 5 — Frontend & Dashboards',          '2027-03-01','2027-07-31','upcoming'),
  ('spr-ph6','proj-iot-001','xavvy-tenant-001',6,'Phase 6 — Testing & QA',                  '2027-08-01','2027-11-30','upcoming'),
  ('spr-ph7','proj-iot-001','xavvy-tenant-001',7,'Phase 7 — UAT & Pilot Deployment',        '2027-12-01','2028-04-30','upcoming'),
  ('spr-ph8','proj-iot-001','xavvy-tenant-001',8,'Phase 8 — Go-Live & Optimisation',        '2028-05-01','2028-12-31','upcoming');

-- ═══════════════════════════════════════════════════════════════
-- PHASE 1 — DISCOVERY & REQUIREMENTS  (Nov 2025 – Jan 2026)
-- Budget: £15,000 | Status: COMPLETED
-- ═══════════════════════════════════════════════════════════════
INSERT OR IGNORE INTO pmo_tasks (id,tenant_id,project_id,sprint_id,name,description,assignee_id,priority,status,estimated_hours,allocated_hours,phase,task_category,task_order,due_date,created_by,created_at,updated_at) VALUES
  ('t-p1-01','xavvy-tenant-001','proj-iot-001','spr-ph1','Stakeholder interviews & workshops',         'Conduct structured interviews with all key stakeholders across warehouse ops, IT and management. Document pain points and desired outcomes.','emp-nanjusha-001','high','done',  40,40,'Phase 1 — Discovery','Analysis',    1,'2025-11-21',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p1-02','xavvy-tenant-001','proj-iot-001','spr-ph1','Current state process mapping',              'Document existing warehouse workflows, manual tracking processes, and pain points. Create AS-IS process maps.','emp-nanjusha-001','high','done',  24,24,'Phase 1 — Discovery','Analysis',    2,'2025-11-28',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p1-03','xavvy-tenant-001','proj-iot-001','spr-ph1','SEWIO hardware site survey',                 'On-site assessment of warehouse layout, anchor placement feasibility, network infrastructure, and SEWIO tag requirements.','emp-swathi-001',  'high','done',  16,16,'Phase 1 — Discovery','Infrastructure',3,'2025-12-05',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p1-04','xavvy-tenant-001','proj-iot-001','spr-ph1','Data requirements analysis',                 'Define data capture requirements: asset types, location granularity, refresh rates, retention periods, and reporting KPIs.','emp-priya-001',   'high','done',  32,32,'Phase 1 — Discovery','Analysis',    4,'2025-12-12',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p1-05','xavvy-tenant-001','proj-iot-001','spr-ph1','Technical feasibility study',               'Assess SEWIO API capabilities, integration options, cloud hosting requirements, and third-party dependencies.','emp-swathi-001',  'high','done',  24,24,'Phase 1 — Discovery','Analysis',    5,'2025-12-19',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p1-06','xavvy-tenant-001','proj-iot-001','spr-ph1','Legacy system integration assessment',       'Review existing WMS, ERP, and reporting tools for integration points and data migration requirements.','emp-zeba-001',    'medium','done', 20,20,'Phase 1 — Discovery','Analysis',    6,'2025-12-19',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p1-07','xavvy-tenant-001','proj-iot-001','spr-ph1','Functional requirements specification (FRS)','Author full FRS document covering all functional requirements, user stories, and acceptance criteria.','emp-nanjusha-001','high','done',  40,40,'Phase 1 — Discovery','Documentation',7,'2026-01-09',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p1-08','xavvy-tenant-001','proj-iot-001','spr-ph1','Non-functional requirements (NFR)',          'Define performance, security, scalability, availability and compliance requirements.','emp-zeba-001',    'high','done',  16,16,'Phase 1 — Discovery','Documentation',8,'2026-01-09',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p1-09','xavvy-tenant-001','proj-iot-001','spr-ph1','Requirements sign-off meeting',             'Present FRS and NFR to steering committee. Collect formal sign-off and update RAID log.','emp-nanjusha-001','high','done',  8, 8, 'Phase 1 — Discovery','Governance',   9,'2026-01-23',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p1-10','xavvy-tenant-001','proj-iot-001','spr-ph1','Project plan & resource schedule',          'Build detailed project plan in MS Project, assign resources at 50% allocation, define critical path.','emp-nanjusha-001','medium','done',16,16,'Phase 1 — Discovery','Governance',  10,'2026-01-31',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);

-- ═══════════════════════════════════════════════════════════════
-- PHASE 2 — SYSTEM DESIGN & ARCHITECTURE  (Feb 2026 – Apr 2026)
-- Budget: £20,000 | Status: COMPLETED
-- ═══════════════════════════════════════════════════════════════
INSERT OR IGNORE INTO pmo_tasks (id,tenant_id,project_id,sprint_id,name,description,assignee_id,priority,status,estimated_hours,allocated_hours,phase,task_category,task_order,due_date,created_by,created_at,updated_at) VALUES
  ('t-p2-01','xavvy-tenant-001','proj-iot-001','spr-ph2','High-level system architecture',            'Design overall system architecture: cloud hosting, microservices layout, IoT data pipeline, and integration topology.','emp-swathi-001',  'high','done',  32,32,'Phase 2 — Design','Architecture',  1,'2026-02-13',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p2-02','xavvy-tenant-001','proj-iot-001','spr-ph2','Database schema design',                    'Design normalised D1/SQLite schema for IoT events, asset tracking, alerts, and reporting. Define partitioning strategy for high-volume event data.','emp-zeba-001','high','done',40,40,'Phase 2 — Design','Database',      2,'2026-02-20',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p2-03','xavvy-tenant-001','proj-iot-001','spr-ph2','API design specification (OpenAPI)',        'Author OpenAPI 3.0 spec for all REST endpoints: asset tracking, events, alerts, user management, and reporting APIs.','emp-swathi-001','high','done',32,32,'Phase 2 — Design','Architecture',  3,'2026-02-27',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p2-04','xavvy-tenant-001','proj-iot-001','spr-ph2','Real-time data pipeline architecture',     'Design SEWIO webhook ingestion, event streaming, transformation layer, and database write strategy for real-time location updates.','emp-zeba-001','high','done',24,24,'Phase 2 — Design','Architecture',  4,'2026-03-06',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p2-05','xavvy-tenant-001','proj-iot-001','spr-ph2','BI & analytics data model',               'Design star-schema data model for Power BI reporting: asset utilisation, zone dwell time, OEE metrics, and exception reporting.','emp-priya-001','high','done',32,32,'Phase 2 — Design','Analytics',     5,'2026-03-06',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p2-06','xavvy-tenant-001','proj-iot-001','spr-ph2','Security & compliance design',             'Define authentication, authorisation (RBAC), data encryption, GDPR compliance, and audit logging architecture.','emp-zeba-001','high','done',24,24,'Phase 2 — Design','Security',      6,'2026-03-13',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p2-07','xavvy-tenant-001','proj-iot-001','spr-ph2','UI/UX wireframes — web portal',           'Create Figma wireframes for all web portal screens: live map, asset registry, alerts dashboard, and reports.','emp-priya-001','medium','done',40,40,'Phase 2 — Design','Design',        7,'2026-03-27',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p2-08','xavvy-tenant-001','proj-iot-001','spr-ph2','Infrastructure sizing & cloud design',    'Size Cloudflare Workers, D1 storage, R2 and KV requirements. Define environment strategy (dev/staging/prod).','emp-swathi-001','medium','done',16,16,'Phase 2 — Design','Infrastructure', 8,'2026-04-03',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p2-09','xavvy-tenant-001','proj-iot-001','spr-ph2','Technical design document (TDD)',         'Compile all design artefacts into a Technical Design Document. Circulate for peer review and client approval.','emp-nanjusha-001','high','done',24,24,'Phase 2 — Design','Documentation', 9,'2026-04-17',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p2-10','xavvy-tenant-001','proj-iot-001','spr-ph2','Architecture sign-off & design freeze',  'Present TDD to steering committee, resolve comments, obtain formal design freeze sign-off.','emp-nanjusha-001','high','done',8,8,'Phase 2 — Design','Governance',   10,'2026-04-30',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);

-- ═══════════════════════════════════════════════════════════════
-- PHASE 3 — CORE INFRASTRUCTURE  (May 2026 – Sep 2026)
-- Budget: £45,000 | Status: IN PROGRESS
-- ═══════════════════════════════════════════════════════════════
INSERT OR IGNORE INTO pmo_tasks (id,tenant_id,project_id,sprint_id,name,description,assignee_id,priority,status,estimated_hours,allocated_hours,phase,task_category,task_order,due_date,created_by,created_at,updated_at) VALUES
  ('t-p3-01','xavvy-tenant-001','proj-iot-001','spr-ph3','Cloudflare Workers project setup',          'Initialise Workers project, configure wrangler.toml for dev/staging/prod, set up CI/CD pipeline with GitHub Actions.','emp-swathi-001','high','done',  16,16,'Phase 3 — Core Infra','Infrastructure',1,'2026-05-09',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p3-02','xavvy-tenant-001','proj-iot-001','spr-ph3','D1 database provisioning & migrations',   'Create D1 databases for dev/staging/prod, run all migrations, set up migration management workflow.','emp-zeba-001',  'high','done',  16,16,'Phase 3 — Core Infra','Database',       2,'2026-05-09',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p3-03','xavvy-tenant-001','proj-iot-001','spr-ph3','Authentication & JWT middleware',         'Implement JWT-based auth, RBAC middleware, refresh token rotation, and session management using KV.','emp-swathi-001','high','done',  32,32,'Phase 3 — Core Infra','Backend',        3,'2026-05-23',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p3-04','xavvy-tenant-001','proj-iot-001','spr-ph3','Core asset tracking API',                'Build REST endpoints for asset CRUD, tag assignment, zone configuration, and location history.','emp-swathi-001','high','in_progress',40,20,'Phase 3 — Core Infra','Backend',        4,'2026-06-20',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p3-05','xavvy-tenant-001','proj-iot-001','spr-ph3','SEWIO webhook receiver',                 'Build inbound webhook endpoint to receive SEWIO UWB location events, validate payloads, and write to event stream.','emp-swathi-001','high','in_progress',32,12,'Phase 3 — Core Infra','Integration',    5,'2026-06-27',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p3-06','xavvy-tenant-001','proj-iot-001','spr-ph3','Event storage schema & indexing',        'Implement partitioned event storage in D1, create composite indexes for time-series queries, run performance benchmarks.','emp-zeba-001','high','in_progress',40,16,'Phase 3 — Core Infra','Database',       6,'2026-07-04',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p3-07','xavvy-tenant-001','proj-iot-001','spr-ph3','R2 file storage integration',           'Integrate R2 for document storage (floor plans, manuals, export files). Build upload/download APIs with signed URLs.','emp-swathi-001','medium','todo',16,0,'Phase 3 — Core Infra','Infrastructure',7,'2026-07-18',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p3-08','xavvy-tenant-001','proj-iot-001','spr-ph3','Alert engine — rules & notifications',  'Build configurable alert rules engine: zone breaches, dwell time thresholds, asset not-found alerts. Email/webhook notifications.','emp-zeba-001','high','todo',48,0,'Phase 3 — Core Infra','Backend',        8,'2026-08-01',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p3-09','xavvy-tenant-001','proj-iot-001','spr-ph3','ETL pipeline — events to analytics DB', 'Build scheduled ETL job to aggregate raw events into analytics-optimised summary tables for BI consumption.','emp-priya-001','high','todo',40,0,'Phase 3 — Core Infra','Analytics',      9,'2026-08-15',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p3-10','xavvy-tenant-001','proj-iot-001','spr-ph3','Audit logging & GDPR compliance',       'Implement immutable audit log for all data access and mutations. Add data retention policies and anonymisation routines.','emp-zeba-001','medium','todo',24,0,'Phase 3 — Core Infra','Security',      10,'2026-08-29',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p3-11','xavvy-tenant-001','proj-iot-001','spr-ph3','Dev environment smoke testing',         'Run end-to-end smoke tests across all core APIs in dev environment. Document test results and raise defects.','emp-nanjusha-001','medium','todo',16,0,'Phase 3 — Core Infra','Testing',       11,'2026-09-12',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p3-12','xavvy-tenant-001','proj-iot-001','spr-ph3','Phase 3 review & sign-off',            'Demo core infrastructure to client. Collect feedback, update backlog, obtain phase sign-off.','emp-nanjusha-001','high','todo',8,0,'Phase 3 — Core Infra','Governance',    12,'2026-09-30',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);

-- ═══════════════════════════════════════════════════════════════
-- PHASE 4 — INTEGRATION & APIs  (Oct 2026 – Feb 2027)
-- Budget: £50,000 | Status: PLANNED
-- ═══════════════════════════════════════════════════════════════
INSERT OR IGNORE INTO pmo_tasks (id,tenant_id,project_id,sprint_id,name,description,assignee_id,priority,status,estimated_hours,allocated_hours,phase,task_category,task_order,due_date,created_by,created_at,updated_at) VALUES
  ('t-p4-01','xavvy-tenant-001','proj-iot-001','spr-ph4','SEWIO RTLS full integration',            'Complete bidirectional integration with SEWIO UWB infrastructure: tag management, anchor calibration, zone configuration APIs.','emp-swathi-001','high','todo',48,0,'Phase 4 — Integration','Integration',1,'2026-10-30',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p4-02','xavvy-tenant-001','proj-iot-001','spr-ph4','WMS data connector',                    'Build connector to pull asset master data and order information from existing Warehouse Management System.','emp-zeba-001',  'high','todo',40,0,'Phase 4 — Integration','Integration',2,'2026-11-13',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p4-03','xavvy-tenant-001','proj-iot-001','spr-ph4','ERP integration — SAP connector',       'Implement SAP RFC/IDoc connector to sync asset data, locations, and utilisation metrics into SAP PM and WM modules.','emp-swathi-001','high','todo',56,0,'Phase 4 — Integration','Integration',3,'2026-12-04',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p4-04','xavvy-tenant-001','proj-iot-001','spr-ph4','Real-time event streaming (WebSocket)', 'Build WebSocket server for live location streaming to web portal. Handle 1000+ concurrent connections with KV-based pub/sub.','emp-swathi-001','high','todo',48,0,'Phase 4 — Integration','Backend',    4,'2026-12-18',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p4-05','xavvy-tenant-001','proj-iot-001','spr-ph4','Power BI data connector & dataset',     'Build Power BI DirectQuery connector against analytics DB. Create certified shared dataset for all reports.','emp-priya-001', 'high','todo',40,0,'Phase 4 — Integration','Analytics',  5,'2027-01-08',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p4-06','xavvy-tenant-001','proj-iot-001','spr-ph4','Reporting API — aggregates & exports', 'Build reporting API endpoints: utilisation summaries, zone heatmaps, exception reports, and CSV/Excel export.','emp-priya-001', 'medium','todo',32,0,'Phase 4 — Integration','Backend',    6,'2027-01-22',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p4-07','xavvy-tenant-001','proj-iot-001','spr-ph4','Third-party notification integration', 'Integrate with Microsoft Teams, PagerDuty, and email for alert delivery. Build notification preference management.','emp-zeba-001',  'medium','todo',24,0,'Phase 4 — Integration','Integration',7,'2027-02-05',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p4-08','xavvy-tenant-001','proj-iot-001','spr-ph4','Integration testing & certification',  'Execute full integration test suite across all connectors. Document results and obtain client technical sign-off.','emp-nanjusha-001','high','todo',32,0,'Phase 4 — Integration','Testing',    8,'2027-02-28',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);

-- ═══════════════════════════════════════════════════════════════
-- PHASE 5 — FRONTEND & DASHBOARDS  (Mar 2027 – Jul 2027)
-- Budget: £45,000 | Status: PLANNED
-- ═══════════════════════════════════════════════════════════════
INSERT OR IGNORE INTO pmo_tasks (id,tenant_id,project_id,sprint_id,name,description,assignee_id,priority,status,estimated_hours,allocated_hours,phase,task_category,task_order,due_date,created_by,created_at,updated_at) VALUES
  ('t-p5-01','xavvy-tenant-001','proj-iot-001','spr-ph5','React web portal — scaffold & routing',  'Set up React/Vite project, component library, routing, auth context, and API client for IoT portal.','emp-swathi-001','high','todo',24,0,'Phase 5 — Frontend','Frontend',  1,'2027-03-19',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p5-02','xavvy-tenant-001','proj-iot-001','spr-ph5','Real-time location map (Leaflet.js)',   'Build interactive floor-plan map with live asset position overlay, zone highlighting, and click-through to asset detail.','emp-swathi-001','high','todo',56,0,'Phase 5 — Frontend','Frontend',  2,'2027-04-16',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p5-03','xavvy-tenant-001','proj-iot-001','spr-ph5','Asset registry & management UI',        'Build asset registry screens: list view, detail view, tag assignment, zone assignment, and maintenance history.','emp-swathi-001','high','todo',40,0,'Phase 5 — Frontend','Frontend',  3,'2027-04-30',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p5-04','xavvy-tenant-001','proj-iot-001','spr-ph5','Alerts dashboard & notification centre','Build alerts dashboard: active alerts list, alert history, acknowledgement workflow, and escalation management.','emp-priya-001', 'high','todo',32,0,'Phase 5 — Frontend','Frontend',  4,'2027-05-14',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p5-05','xavvy-tenant-001','proj-iot-001','spr-ph5','Power BI embedded dashboards',          'Embed certified Power BI reports in web portal: OEE dashboard, zone utilisation, asset tracking history, exception report.','emp-priya-001','high','todo',40,0,'Phase 5 — Frontend','Analytics', 5,'2027-05-28',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p5-06','xavvy-tenant-001','proj-iot-001','spr-ph5','User & role management UI',             'Build admin screens: user management, RBAC role assignment, site configuration, and system settings.','emp-swathi-001','medium','todo',24,0,'Phase 5 — Frontend','Frontend',  6,'2027-06-11',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p5-07','xavvy-tenant-001','proj-iot-001','spr-ph5','Mobile-responsive design & PWA',        'Ensure all screens are mobile-responsive. Add PWA manifest for tablet/mobile warehouse floor use.','emp-swathi-001','medium','todo',24,0,'Phase 5 — Frontend','Frontend',  7,'2027-06-25',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p5-08','xavvy-tenant-001','proj-iot-001','spr-ph5','Accessibility audit (WCAG 2.1 AA)',    'Run accessibility audit against all portal screens. Resolve all critical and major accessibility issues.','emp-priya-001','medium','todo',16,0,'Phase 5 — Frontend','Quality',   8,'2027-07-09',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p5-09','xavvy-tenant-001','proj-iot-001','spr-ph5','Frontend performance optimisation',    'Profile and optimise: code splitting, lazy loading, WebSocket reconnection logic, map tile caching.','emp-swathi-001','medium','todo',16,0,'Phase 5 — Frontend','Performance',9,'2027-07-23',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p5-10','xavvy-tenant-001','proj-iot-001','spr-ph5','Frontend integration testing',        'Execute full frontend integration tests against staging. Resolve defects, performance-test with 500 concurrent map clients.','emp-nanjusha-001','high','todo',24,0,'Phase 5 — Frontend','Testing',  10,'2027-07-31',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);

-- ═══════════════════════════════════════════════════════════════
-- PHASE 6 — TESTING & QA  (Aug 2027 – Nov 2027)
-- Budget: £30,000 | Status: PLANNED
-- ═══════════════════════════════════════════════════════════════
INSERT OR IGNORE INTO pmo_tasks (id,tenant_id,project_id,sprint_id,name,description,assignee_id,priority,status,estimated_hours,allocated_hours,phase,task_category,task_order,due_date,created_by,created_at,updated_at) VALUES
  ('t-p6-01','xavvy-tenant-001','proj-iot-001','spr-ph6','Test strategy & plan',                 'Author test strategy covering functional, regression, performance, security, and UAT phases. Define entry/exit criteria.','emp-nanjusha-001','high','todo',16,0,'Phase 6 — Testing','Testing',   1,'2027-08-13',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p6-02','xavvy-tenant-001','proj-iot-001','spr-ph6','Functional test execution',            'Execute 320 functional test cases across all modules. Log, triage and retest defects through to closure.','emp-nanjusha-001','high','todo',64,0,'Phase 6 — Testing','Testing',   2,'2027-09-10',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p6-03','xavvy-tenant-001','proj-iot-001','spr-ph6','Performance & load testing',          'Load test with 2,000 concurrent UWB tag updates/second. Validate p99 latency < 500ms for map updates.','emp-swathi-001','high','todo',32,0,'Phase 6 — Testing','Performance',3,'2027-09-24',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p6-04','xavvy-tenant-001','proj-iot-001','spr-ph6','Security penetration testing',        'Engage third-party pen test. Resolve all critical and high vulnerabilities before UAT.','emp-zeba-001',  'high','todo',24,0,'Phase 6 — Testing','Security',   4,'2027-10-08',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p6-05','xavvy-tenant-001','proj-iot-001','spr-ph6','Data accuracy & integrity testing',   'Validate location accuracy vs ground truth. Test event data integrity through full pipeline from SEWIO to BI dashboard.','emp-priya-001','high','todo',32,0,'Phase 6 — Testing','Testing',   5,'2027-10-22',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p6-06','xavvy-tenant-001','proj-iot-001','spr-ph6','Integration regression suite',        'Run full regression suite across all integrations (SEWIO, WMS, SAP, Power BI). Automate top 50 critical paths.','emp-swathi-001','medium','todo',40,0,'Phase 6 — Testing','Testing',   6,'2027-11-05',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p6-07','xavvy-tenant-001','proj-iot-001','spr-ph6','Defect resolution & retesting',       'Resolve all P1 and P2 defects raised during testing phases. Retest and close via sign-off.','emp-zeba-001',  'high','todo',32,0,'Phase 6 — Testing','Testing',   7,'2027-11-19',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p6-08','xavvy-tenant-001','proj-iot-001','spr-ph6','QA sign-off & test completion report','Compile test completion report. Obtain QA sign-off for UAT entry. Update risk register.','emp-nanjusha-001','high','todo',8,0,'Phase 6 — Testing','Governance', 8,'2027-11-30',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);

-- ═══════════════════════════════════════════════════════════════
-- PHASE 7 — UAT & PILOT  (Dec 2027 – Apr 2028)
-- Budget: £40,000 | Status: PLANNED
-- ═══════════════════════════════════════════════════════════════
INSERT OR IGNORE INTO pmo_tasks (id,tenant_id,project_id,sprint_id,name,description,assignee_id,priority,status,estimated_hours,allocated_hours,phase,task_category,task_order,due_date,created_by,created_at,updated_at) VALUES
  ('t-p7-01','xavvy-tenant-001','proj-iot-001','spr-ph7','UAT environment setup & data prep',    'Configure UAT environment with production-mirrored data. Brief business testers, issue test credentials.','emp-zeba-001',  'high','todo',16,0,'Phase 7 — UAT','Testing',    1,'2027-12-12',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p7-02','xavvy-tenant-001','proj-iot-001','spr-ph7','UAT test execution — pilot site A',   'Support Pilot Site A (Warehouse 1) UAT execution over 3 weeks. Daily defect triage calls with business team.','emp-nanjusha-001','high','todo',80,0,'Phase 7 — UAT','Testing',    2,'2028-01-20',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p7-03','xavvy-tenant-001','proj-iot-001','spr-ph7','UAT test execution — pilot site B',   'Support Pilot Site B (Distribution Centre) UAT. Extended real-world test with 150 active tags over 2 weeks.','emp-nanjusha-001','high','todo',64,0,'Phase 7 — UAT','Testing',    3,'2028-02-14',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p7-04','xavvy-tenant-001','proj-iot-001','spr-ph7','SEWIO hardware calibration (pilot)',   'On-site anchor installation, calibration, and coverage validation for both pilot sites.','emp-swathi-001','high','todo',40,0,'Phase 7 — UAT','Infrastructure',4,'2028-01-31',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p7-05','xavvy-tenant-001','proj-iot-001','spr-ph7','UAT defect resolution',               'Triage, prioritise and resolve all UAT-raised defects. Deploy hotfixes to UAT environment within agreed SLA.','emp-swathi-001','high','todo',48,0,'Phase 7 — UAT','Development', 5,'2028-03-14',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p7-06','xavvy-tenant-001','proj-iot-001','spr-ph7','Power BI dashboard UAT',             'Business validation of all BI dashboards with real pilot data. Refine visuals, labels, and KPI definitions.','emp-priya-001','high','todo',32,0,'Phase 7 — UAT','Analytics',   6,'2028-03-14',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p7-07','xavvy-tenant-001','proj-iot-001','spr-ph7','User training — key users',           'Deliver 3-day training programme for super users and system administrators across both pilot sites.','emp-nanjusha-001','high','todo',24,0,'Phase 7 — UAT','Training',    7,'2028-03-28',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p7-08','xavvy-tenant-001','proj-iot-001','spr-ph7','UAT sign-off & go-live approval',    'Obtain formal UAT sign-off from business sponsor. Approve go-live readiness and notify steering committee.','emp-nanjusha-001','high','todo',8,0,'Phase 7 — UAT','Governance',  8,'2028-04-30',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);

-- ═══════════════════════════════════════════════════════════════
-- PHASE 8 — GO-LIVE & OPTIMISATION  (May 2028 – Dec 2028)
-- Budget: £25,000 | Status: PLANNED
-- ═══════════════════════════════════════════════════════════════
INSERT OR IGNORE INTO pmo_tasks (id,tenant_id,project_id,sprint_id,name,description,assignee_id,priority,status,estimated_hours,allocated_hours,phase,task_category,task_order,due_date,created_by,created_at,updated_at) VALUES
  ('t-p8-01','xavvy-tenant-001','proj-iot-001','spr-ph8','Production deployment & cutover',      'Execute go-live cutover plan: blue-green deployment, DNS cutover, SEWIO live switch, and hypercare activation.','emp-swathi-001','high','todo',24,0,'Phase 8 — Go-Live','Deployment',1,'2028-05-10',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p8-02','xavvy-tenant-001','proj-iot-001','spr-ph8','Hypercare support (30 days)',          '30-day intensive post-go-live support: daily stand-ups, 4hr response SLA on P1s, live performance monitoring.','emp-nanjusha-001','high','todo',80,0,'Phase 8 — Go-Live','Support',   2,'2028-06-09',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p8-03','xavvy-tenant-001','proj-iot-001','spr-ph8','Full site rollout — all warehouses',  'Roll out SEWIO infrastructure and portal to remaining 4 warehouse sites following pilot learnings.','emp-swathi-001','high','todo',64,0,'Phase 8 — Go-Live','Deployment',3,'2028-07-31',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p8-04','xavvy-tenant-001','proj-iot-001','spr-ph8','Performance monitoring & tuning',     'Set up Cloudflare Analytics dashboards, D1 query performance monitoring, and alert thresholds for production.','emp-zeba-001',  'high','todo',32,0,'Phase 8 — Go-Live','Performance',4,'2028-06-30',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p8-05','xavvy-tenant-001','proj-iot-001','spr-ph8','End-user training — all sites',       'Deliver end-user training to 200+ warehouse staff across all sites. Produce self-service training videos.','emp-nanjusha-001','medium','todo',48,0,'Phase 8 — Go-Live','Training',  5,'2028-08-30',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p8-06','xavvy-tenant-001','proj-iot-001','spr-ph8','Advanced analytics & ML pipeline',   'Build ML-based anomaly detection for asset movement patterns. Implement predictive maintenance alerts.','emp-priya-001','medium','todo',80,0,'Phase 8 — Go-Live','Analytics', 6,'2028-10-31',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p8-07','xavvy-tenant-001','proj-iot-001','spr-ph8','Documentation & knowledge transfer', 'Deliver operations runbook, API documentation, admin guide, and complete knowledge transfer to client IT team.','emp-nanjusha-001','high','todo',40,0,'Phase 8 — Go-Live','Documentation',7,'2028-11-29',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('t-p8-08','xavvy-tenant-001','proj-iot-001','spr-ph8','Project closure & lessons learned',  'Compile project closure report, lessons learned, benefits realisation baseline, and financial reconciliation.','emp-nanjusha-001','high','todo',16,0,'Phase 8 — Go-Live','Governance', 8,'2028-12-20',NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);

-- ═══════════════════════════════════════════════════════════════
-- TIMESHEETS — Phases 1 & 2 completed work (Nov'25 – Apr'26)
-- 50% allocation = 17.5 hrs/week per person
-- Approved timesheets for the completed phases
-- ═══════════════════════════════════════════════════════════════

-- Phase 1 timesheets (4 employees × 13 weeks × 17.5hrs = 910hrs total)
INSERT OR IGNORE INTO timesheets (id,tenant_id,employee_id,week_starting,status,submitted_at) VALUES
  ('ts-nan-2025-44','xavvy-tenant-001','emp-nanjusha-001','2025-11-03','approved',CURRENT_TIMESTAMP),
  ('ts-nan-2025-46','xavvy-tenant-001','emp-nanjusha-001','2025-11-17','approved',CURRENT_TIMESTAMP),
  ('ts-nan-2025-48','xavvy-tenant-001','emp-nanjusha-001','2025-12-01','approved',CURRENT_TIMESTAMP),
  ('ts-nan-2025-50','xavvy-tenant-001','emp-nanjusha-001','2025-12-15','approved',CURRENT_TIMESTAMP),
  ('ts-nan-2025-52','xavvy-tenant-001','emp-nanjusha-001','2025-12-29','approved',CURRENT_TIMESTAMP),
  ('ts-nan-2026-02','xavvy-tenant-001','emp-nanjusha-001','2026-01-05','approved',CURRENT_TIMESTAMP),
  ('ts-nan-2026-04','xavvy-tenant-001','emp-nanjusha-001','2026-01-19','approved',CURRENT_TIMESTAMP),
  ('ts-pri-2025-44','xavvy-tenant-001','emp-priya-001',   '2025-11-03','approved',CURRENT_TIMESTAMP),
  ('ts-pri-2025-46','xavvy-tenant-001','emp-priya-001',   '2025-11-17','approved',CURRENT_TIMESTAMP),
  ('ts-pri-2025-48','xavvy-tenant-001','emp-priya-001',   '2025-12-01','approved',CURRENT_TIMESTAMP),
  ('ts-pri-2025-50','xavvy-tenant-001','emp-priya-001',   '2025-12-15','approved',CURRENT_TIMESTAMP),
  ('ts-pri-2025-52','xavvy-tenant-001','emp-priya-001',   '2025-12-29','approved',CURRENT_TIMESTAMP),
  ('ts-pri-2026-02','xavvy-tenant-001','emp-priya-001',   '2026-01-05','approved',CURRENT_TIMESTAMP),
  ('ts-pri-2026-04','xavvy-tenant-001','emp-priya-001',   '2026-01-19','approved',CURRENT_TIMESTAMP),
  ('ts-swa-2025-44','xavvy-tenant-001','emp-swathi-001',  '2025-11-03','approved',CURRENT_TIMESTAMP),
  ('ts-swa-2025-46','xavvy-tenant-001','emp-swathi-001',  '2025-11-17','approved',CURRENT_TIMESTAMP),
  ('ts-swa-2025-48','xavvy-tenant-001','emp-swathi-001',  '2025-12-01','approved',CURRENT_TIMESTAMP),
  ('ts-swa-2025-50','xavvy-tenant-001','emp-swathi-001',  '2025-12-15','approved',CURRENT_TIMESTAMP),
  ('ts-swa-2025-52','xavvy-tenant-001','emp-swathi-001',  '2025-12-29','approved',CURRENT_TIMESTAMP),
  ('ts-swa-2026-02','xavvy-tenant-001','emp-swathi-001',  '2026-01-05','approved',CURRENT_TIMESTAMP),
  ('ts-swa-2026-04','xavvy-tenant-001','emp-swathi-001',  '2026-01-19','approved',CURRENT_TIMESTAMP),
  ('ts-zeb-2025-44','xavvy-tenant-001','emp-zeba-001',    '2025-11-03','approved',CURRENT_TIMESTAMP),
  ('ts-zeb-2025-46','xavvy-tenant-001','emp-zeba-001',    '2025-11-17','approved',CURRENT_TIMESTAMP),
  ('ts-zeb-2025-48','xavvy-tenant-001','emp-zeba-001',    '2025-12-01','approved',CURRENT_TIMESTAMP),
  ('ts-zeb-2025-50','xavvy-tenant-001','emp-zeba-001',    '2025-12-15','approved',CURRENT_TIMESTAMP),
  ('ts-zeb-2025-52','xavvy-tenant-001','emp-zeba-001',    '2025-12-29','approved',CURRENT_TIMESTAMP),
  ('ts-zeb-2026-02','xavvy-tenant-001','emp-zeba-001',    '2026-01-05','approved',CURRENT_TIMESTAMP),
  ('ts-zeb-2026-04','xavvy-tenant-001','emp-zeba-001',    '2026-01-19','approved',CURRENT_TIMESTAMP);

-- Phase 2 timesheets (Feb – Apr 2026)
INSERT OR IGNORE INTO timesheets (id,tenant_id,employee_id,week_starting,status,submitted_at) VALUES
  ('ts-nan-2026-06','xavvy-tenant-001','emp-nanjusha-001','2026-02-02','approved',CURRENT_TIMESTAMP),
  ('ts-nan-2026-08','xavvy-tenant-001','emp-nanjusha-001','2026-02-16','approved',CURRENT_TIMESTAMP),
  ('ts-nan-2026-10','xavvy-tenant-001','emp-nanjusha-001','2026-03-02','approved',CURRENT_TIMESTAMP),
  ('ts-nan-2026-12','xavvy-tenant-001','emp-nanjusha-001','2026-03-16','approved',CURRENT_TIMESTAMP),
  ('ts-nan-2026-14','xavvy-tenant-001','emp-nanjusha-001','2026-03-30','approved',CURRENT_TIMESTAMP),
  ('ts-nan-2026-16','xavvy-tenant-001','emp-nanjusha-001','2026-04-13','approved',CURRENT_TIMESTAMP),
  ('ts-nan-2026-17','xavvy-tenant-001','emp-nanjusha-001','2026-04-27','approved',CURRENT_TIMESTAMP),
  ('ts-pri-2026-06','xavvy-tenant-001','emp-priya-001',   '2026-02-02','approved',CURRENT_TIMESTAMP),
  ('ts-pri-2026-08','xavvy-tenant-001','emp-priya-001',   '2026-02-16','approved',CURRENT_TIMESTAMP),
  ('ts-pri-2026-10','xavvy-tenant-001','emp-priya-001',   '2026-03-02','approved',CURRENT_TIMESTAMP),
  ('ts-pri-2026-12','xavvy-tenant-001','emp-priya-001',   '2026-03-16','approved',CURRENT_TIMESTAMP),
  ('ts-pri-2026-14','xavvy-tenant-001','emp-priya-001',   '2026-03-30','approved',CURRENT_TIMESTAMP),
  ('ts-pri-2026-16','xavvy-tenant-001','emp-priya-001',   '2026-04-13','approved',CURRENT_TIMESTAMP),
  ('ts-pri-2026-17','xavvy-tenant-001','emp-priya-001',   '2026-04-27','approved',CURRENT_TIMESTAMP),
  ('ts-swa-2026-06','xavvy-tenant-001','emp-swathi-001',  '2026-02-02','approved',CURRENT_TIMESTAMP),
  ('ts-swa-2026-08','xavvy-tenant-001','emp-swathi-001',  '2026-02-16','approved',CURRENT_TIMESTAMP),
  ('ts-swa-2026-10','xavvy-tenant-001','emp-swathi-001',  '2026-03-02','approved',CURRENT_TIMESTAMP),
  ('ts-swa-2026-12','xavvy-tenant-001','emp-swathi-001',  '2026-03-16','approved',CURRENT_TIMESTAMP),
  ('ts-swa-2026-14','xavvy-tenant-001','emp-swathi-001',  '2026-03-30','approved',CURRENT_TIMESTAMP),
  ('ts-swa-2026-16','xavvy-tenant-001','emp-swathi-001',  '2026-04-13','approved',CURRENT_TIMESTAMP),
  ('ts-swa-2026-17','xavvy-tenant-001','emp-swathi-001',  '2026-04-27','approved',CURRENT_TIMESTAMP),
  ('ts-zeb-2026-06','xavvy-tenant-001','emp-zeba-001',    '2026-02-02','approved',CURRENT_TIMESTAMP),
  ('ts-zeb-2026-08','xavvy-tenant-001','emp-zeba-001',    '2026-02-16','approved',CURRENT_TIMESTAMP),
  ('ts-zeb-2026-10','xavvy-tenant-001','emp-zeba-001',    '2026-03-02','approved',CURRENT_TIMESTAMP),
  ('ts-zeb-2026-12','xavvy-tenant-001','emp-zeba-001',    '2026-03-16','approved',CURRENT_TIMESTAMP),
  ('ts-zeb-2026-14','xavvy-tenant-001','emp-zeba-001',    '2026-03-30','approved',CURRENT_TIMESTAMP),
  ('ts-zeb-2026-16','xavvy-tenant-001','emp-zeba-001',    '2026-04-13','approved',CURRENT_TIMESTAMP),
  ('ts-zeb-2026-17','xavvy-tenant-001','emp-zeba-001',    '2026-04-27','approved',CURRENT_TIMESTAMP);

-- Phase 3 timesheets (May – Jun 2026, in progress)
INSERT OR IGNORE INTO timesheets (id,tenant_id,employee_id,week_starting,status,submitted_at) VALUES
  ('ts-nan-2026-18','xavvy-tenant-001','emp-nanjusha-001','2026-05-04','approved',CURRENT_TIMESTAMP),
  ('ts-nan-2026-20','xavvy-tenant-001','emp-nanjusha-001','2026-05-18','approved',CURRENT_TIMESTAMP),
  ('ts-nan-2026-22','xavvy-tenant-001','emp-nanjusha-001','2026-06-01','approved',CURRENT_TIMESTAMP),
  ('ts-nan-2026-23','xavvy-tenant-001','emp-nanjusha-001','2026-06-08','submitted',CURRENT_TIMESTAMP),
  ('ts-pri-2026-18','xavvy-tenant-001','emp-priya-001',   '2026-05-04','approved',CURRENT_TIMESTAMP),
  ('ts-pri-2026-20','xavvy-tenant-001','emp-priya-001',   '2026-05-18','approved',CURRENT_TIMESTAMP),
  ('ts-pri-2026-22','xavvy-tenant-001','emp-priya-001',   '2026-06-01','approved',CURRENT_TIMESTAMP),
  ('ts-pri-2026-23','xavvy-tenant-001','emp-priya-001',   '2026-06-08','submitted',CURRENT_TIMESTAMP),
  ('ts-swa-2026-18','xavvy-tenant-001','emp-swathi-001',  '2026-05-04','approved',CURRENT_TIMESTAMP),
  ('ts-swa-2026-20','xavvy-tenant-001','emp-swathi-001',  '2026-05-18','approved',CURRENT_TIMESTAMP),
  ('ts-swa-2026-22','xavvy-tenant-001','emp-swathi-001',  '2026-06-01','approved',CURRENT_TIMESTAMP),
  ('ts-swa-2026-23','xavvy-tenant-001','emp-swathi-001',  '2026-06-08','submitted',CURRENT_TIMESTAMP),
  ('ts-zeb-2026-18','xavvy-tenant-001','emp-zeba-001',    '2026-05-04','approved',CURRENT_TIMESTAMP),
  ('ts-zeb-2026-20','xavvy-tenant-001','emp-zeba-001',    '2026-05-18','approved',CURRENT_TIMESTAMP),
  ('ts-zeb-2026-22','xavvy-tenant-001','emp-zeba-001',    '2026-06-01','approved',CURRENT_TIMESTAMP),
  ('ts-zeb-2026-23','xavvy-tenant-001','emp-zeba-001',    '2026-06-08','submitted',CURRENT_TIMESTAMP);

-- Timesheet entries — 17.5hrs/week (3.5hrs/day × 5 days) per person, billable
-- Using a representative sample (first week of each phase for brevity)
INSERT OR IGNORE INTO timesheet_entries (id,timesheet_id,tenant_id,date,hours_worked,description,billable) VALUES
  ('te-nan-44-m','ts-nan-2025-44','xavvy-tenant-001','2025-11-03',3.5,'Stakeholder kick-off workshop',1),
  ('te-nan-44-t','ts-nan-2025-44','xavvy-tenant-001','2025-11-04',3.5,'Requirements gathering interviews',1),
  ('te-nan-44-w','ts-nan-2025-44','xavvy-tenant-001','2025-11-05',3.5,'Process mapping workshop',1),
  ('te-nan-44-th','ts-nan-2025-44','xavvy-tenant-001','2025-11-06',3.5,'Documentation and follow-up',1),
  ('te-nan-44-f','ts-nan-2025-44','xavvy-tenant-001','2025-11-07',3.5,'Weekly review and planning',1),
  ('te-pri-44-m','ts-pri-2025-44','xavvy-tenant-001','2025-11-03',3.5,'Data requirements workshop',1),
  ('te-pri-44-t','ts-pri-2025-44','xavvy-tenant-001','2025-11-04',3.5,'Current state analysis',1),
  ('te-pri-44-w','ts-pri-2025-44','xavvy-tenant-001','2025-11-05',3.5,'KPI definition sessions',1),
  ('te-pri-44-th','ts-pri-2025-44','xavvy-tenant-001','2025-11-06',3.5,'BI requirements documentation',1),
  ('te-pri-44-f','ts-pri-2025-44','xavvy-tenant-001','2025-11-07',3.5,'Weekly review and planning',1),
  ('te-swa-44-m','ts-swa-2025-44','xavvy-tenant-001','2025-11-03',3.5,'Technical feasibility research',1),
  ('te-swa-44-t','ts-swa-2025-44','xavvy-tenant-001','2025-11-04',3.5,'SEWIO API documentation review',1),
  ('te-swa-44-w','ts-swa-2025-44','xavvy-tenant-001','2025-11-05',3.5,'Site survey preparation',1),
  ('te-swa-44-th','ts-swa-2025-44','xavvy-tenant-001','2025-11-06',3.5,'Infrastructure assessment',1),
  ('te-swa-44-f','ts-swa-2025-44','xavvy-tenant-001','2025-11-07',3.5,'Weekly review and planning',1),
  ('te-zeb-44-m','ts-zeb-2025-44','xavvy-tenant-001','2025-11-03',3.5,'Legacy system data audit',1),
  ('te-zeb-44-t','ts-zeb-2025-44','xavvy-tenant-001','2025-11-04',3.5,'WMS data model review',1),
  ('te-zeb-44-w','ts-zeb-2025-44','xavvy-tenant-001','2025-11-05',3.5,'Data migration scoping',1),
  ('te-zeb-44-th','ts-zeb-2025-44','xavvy-tenant-001','2025-11-06',3.5,'NFR data requirements',1),
  ('te-zeb-44-f','ts-zeb-2025-44','xavvy-tenant-001','2025-11-07',3.5,'Weekly review and planning',1),
  -- Phase 3 current week entries
  ('te-nan-23-m','ts-nan-2026-23','xavvy-tenant-001','2026-06-08',3.5,'Core API review and testing',1),
  ('te-nan-23-t','ts-nan-2026-23','xavvy-tenant-001','2026-06-09',3.5,'Client status meeting',1),
  ('te-nan-23-w','ts-nan-2026-23','xavvy-tenant-001','2026-06-10',3.5,'Sprint planning phase 3',1),
  ('te-nan-23-th','ts-nan-2026-23','xavvy-tenant-001','2026-06-11',3.5,'Risk register update',1),
  ('te-nan-23-f','ts-nan-2026-23','xavvy-tenant-001','2026-06-12',3.5,'Stakeholder progress report',1),
  ('te-swa-23-m','ts-swa-2026-23','xavvy-tenant-001','2026-06-08',3.5,'Asset tracking API development',1),
  ('te-swa-23-t','ts-swa-2026-23','xavvy-tenant-001','2026-06-09',3.5,'SEWIO webhook implementation',1),
  ('te-swa-23-w','ts-swa-2026-23','xavvy-tenant-001','2026-06-10',3.5,'Unit testing and code review',1),
  ('te-swa-23-th','ts-swa-2026-23','xavvy-tenant-001','2026-06-11',3.5,'Dev environment deployment',1),
  ('te-swa-23-f','ts-swa-2026-23','xavvy-tenant-001','2026-06-12',3.5,'Sprint review preparation',1),
  ('te-pri-23-m','ts-pri-2026-23','xavvy-tenant-001','2026-06-08',3.5,'ETL pipeline design',1),
  ('te-pri-23-t','ts-pri-2026-23','xavvy-tenant-001','2026-06-09',3.5,'Analytics schema review',1),
  ('te-pri-23-w','ts-pri-2026-23','xavvy-tenant-001','2026-06-10',3.5,'Power BI data model refinement',1),
  ('te-pri-23-th','ts-pri-2026-23','xavvy-tenant-001','2026-06-11',3.5,'KPI validation with stakeholders',1),
  ('te-pri-23-f','ts-pri-2026-23','xavvy-tenant-001','2026-06-12',3.5,'Sprint review preparation',1),
  ('te-zeb-23-m','ts-zeb-2026-23','xavvy-tenant-001','2026-06-08',3.5,'Event storage indexing',1),
  ('te-zeb-23-t','ts-zeb-2026-23','xavvy-tenant-001','2026-06-09',3.5,'Query performance benchmarking',1),
  ('te-zeb-23-w','ts-zeb-2026-23','xavvy-tenant-001','2026-06-10',3.5,'D1 migration scripts',1),
  ('te-zeb-23-th','ts-zeb-2026-23','xavvy-tenant-001','2026-06-11',3.5,'Data retention policy implementation',1),
  ('te-zeb-23-f','ts-zeb-2026-23','xavvy-tenant-001','2026-06-12',3.5,'Sprint review preparation',1);

-- ═══════════════════════════════════════════════════════════════
-- LEAVE BALANCES — reinstate for all employees
-- ═══════════════════════════════════════════════════════════════
INSERT OR IGNORE INTO leave_balances (id,tenant_id,employee_id,leave_type_id,year,entitlement,taken,pending,carried_forward,updated_at) VALUES
  ('lb-nan-annual-2026','xavvy-tenant-001','emp-nanjusha-001','lt-annual',2026,25,8,0,3,CURRENT_TIMESTAMP),
  ('lb-pri-annual-2026','xavvy-tenant-001','emp-priya-001',   'lt-annual',2026,25,3,0,3,CURRENT_TIMESTAMP),
  ('lb-swa-annual-2026','xavvy-tenant-001','emp-swathi-001',  'lt-annual',2026,25,5,0,3,CURRENT_TIMESTAMP),
  ('lb-zeb-annual-2026','xavvy-tenant-001','emp-zeba-001',    'lt-annual',2026,25,5,0,3,CURRENT_TIMESTAMP),
  ('lb-nan-sick-2026',  'xavvy-tenant-001','emp-nanjusha-001','lt-sick',  2026,10,0,0,0,CURRENT_TIMESTAMP),
  ('lb-pri-sick-2026',  'xavvy-tenant-001','emp-priya-001',   'lt-sick',  2026,10,2,0,0,CURRENT_TIMESTAMP),
  ('lb-swa-sick-2026',  'xavvy-tenant-001','emp-swathi-001',  'lt-sick',  2026,10,0,0,0,CURRENT_TIMESTAMP),
  ('lb-zeb-sick-2026',  'xavvy-tenant-001','emp-zeba-001',    'lt-sick',  2026,10,0,0,0,CURRENT_TIMESTAMP);

-- Leave requests reflecting actual leave taken in 2026
INSERT OR IGNORE INTO leave_requests (id,tenant_id,employee_id,leave_type,start_date,end_date,days,reason,half_day,status,decided_at,comment,created_at) VALUES
  ('lr-nan-01','xavvy-tenant-001','emp-nanjusha-001','annual','2026-01-26','2026-01-30',5,'New Year break',0,'approved',CURRENT_TIMESTAMP,'Approved',CURRENT_TIMESTAMP),
  ('lr-nan-02','xavvy-tenant-001','emp-nanjusha-001','annual','2026-04-02','2026-04-04',3,'Easter break',  0,'approved',CURRENT_TIMESTAMP,'Approved',CURRENT_TIMESTAMP),
  ('lr-pri-01','xavvy-tenant-001','emp-priya-001',   'sick',  '2026-02-10','2026-02-11',2,'Unwell',        0,'approved',CURRENT_TIMESTAMP,'Get well soon',CURRENT_TIMESTAMP),
  ('lr-pri-02','xavvy-tenant-001','emp-priya-001',   'annual','2026-03-30','2026-03-31',1,'Doctor appointment',0,'approved',CURRENT_TIMESTAMP,'Approved',CURRENT_TIMESTAMP),
  ('lr-swa-01','xavvy-tenant-001','emp-swathi-001',  'annual','2026-02-16','2026-02-20',5,'Family holiday', 0,'approved',CURRENT_TIMESTAMP,'Approved',CURRENT_TIMESTAMP),
  ('lr-zeb-01','xavvy-tenant-001','emp-zeba-001',    'annual','2026-03-23','2026-03-27',5,'Spring break',   0,'approved',CURRENT_TIMESTAMP,'Approved',CURRENT_TIMESTAMP);

-- Resource bookings for current and upcoming weeks
INSERT OR IGNORE INTO resource_bookings (id,tenant_id,employee_id,project_id,booking_type,week_starting,hours,notes,created_by,created_at) VALUES
  ('rb-nan-w23','xavvy-tenant-001','emp-nanjusha-001','proj-iot-001','project','2026-06-08',17.5,'Phase 3 — PM & BA', NULL,CURRENT_TIMESTAMP),
  ('rb-pri-w23','xavvy-tenant-001','emp-priya-001',   'proj-iot-001','project','2026-06-08',17.5,'Phase 3 — ETL work', NULL,CURRENT_TIMESTAMP),
  ('rb-swa-w23','xavvy-tenant-001','emp-swathi-001',  'proj-iot-001','project','2026-06-08',17.5,'Phase 3 — Core APIs',NULL,CURRENT_TIMESTAMP),
  ('rb-zeb-w23','xavvy-tenant-001','emp-zeba-001',    'proj-iot-001','project','2026-06-08',17.5,'Phase 3 — DB work',  NULL,CURRENT_TIMESTAMP),
  ('rb-nan-w24','xavvy-tenant-001','emp-nanjusha-001','proj-iot-001','project','2026-06-15',17.5,'Phase 3 — PM & BA', NULL,CURRENT_TIMESTAMP),
  ('rb-pri-w24','xavvy-tenant-001','emp-priya-001',   'proj-iot-001','project','2026-06-15',17.5,'Phase 3 — ETL work', NULL,CURRENT_TIMESTAMP),
  ('rb-swa-w24','xavvy-tenant-001','emp-swathi-001',  'proj-iot-001','project','2026-06-15',17.5,'Phase 3 — Core APIs',NULL,CURRENT_TIMESTAMP),
  ('rb-zeb-w24','xavvy-tenant-001','emp-zeba-001',    'proj-iot-001','project','2026-06-15',17.5,'Phase 3 — DB work',  NULL,CURRENT_TIMESTAMP);

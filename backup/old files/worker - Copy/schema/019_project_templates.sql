-- ============================================================
-- 019_project_templates.sql
-- Project template tables + seed data for 5 project types
-- Run: wrangler d1 execute xavvysuite-fresh-db --local --file=schema/019_project_templates.sql
-- ============================================================

-- ── Tables ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_templates (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id    TEXT REFERENCES tenants(id),  -- NULL = global system template
  name         TEXT NOT NULL,
  project_type TEXT NOT NULL DEFAULT 'general'
    CHECK(project_type IN ('iot','data_migration','platform','support','training','general')),
  description  TEXT,
  is_system    INTEGER NOT NULL DEFAULT 0,   -- 1 = built-in, cannot be deleted
  is_active    INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_proj_tmpl_type   ON project_templates(project_type);
CREATE INDEX IF NOT EXISTS idx_proj_tmpl_active ON project_templates(is_active);

CREATE TABLE IF NOT EXISTS project_template_phases (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  template_id  TEXT NOT NULL REFERENCES project_templates(id) ON DELETE CASCADE,
  phase_name   TEXT NOT NULL,
  phase_order  INTEGER NOT NULL DEFAULT 0,
  duration_pct REAL NOT NULL DEFAULT 20   -- % of total project duration this phase covers
);
CREATE INDEX IF NOT EXISTS idx_tmpl_phase_tmpl ON project_template_phases(template_id);

CREATE TABLE IF NOT EXISTS project_template_tasks (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  phase_id        TEXT NOT NULL REFERENCES project_template_phases(id) ON DELETE CASCADE,
  template_id     TEXT NOT NULL REFERENCES project_templates(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  priority        TEXT NOT NULL DEFAULT 'medium'
    CHECK(priority IN ('low','medium','high','critical')),
  estimated_hours REAL NOT NULL DEFAULT 8,
  category        TEXT,
  task_order      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_tmpl_task_phase ON project_template_tasks(phase_id);
CREATE INDEX IF NOT EXISTS idx_tmpl_task_tmpl  ON project_template_tasks(template_id);

-- ════════════════════════════════════════════════════════════════
-- SEED: IoT / RTLS Deployment
-- ════════════════════════════════════════════════════════════════
INSERT INTO project_templates (id, name, project_type, description, is_system) VALUES
('tmpl-iot-001', 'IoT / RTLS Deployment', 'iot',
 'Full IoT/RTLS platform deployment from site survey through hardware installation, system integration, dashboard delivery and go-live hypercare.',
 1);

INSERT INTO project_template_phases (id, template_id, phase_name, phase_order, duration_pct) VALUES
('ph-iot-01','tmpl-iot-001','Discovery & Requirements',  1, 12),
('ph-iot-02','tmpl-iot-001','System Design & Architecture', 2, 12),
('ph-iot-03','tmpl-iot-001','Core Infrastructure',       3, 20),
('ph-iot-04','tmpl-iot-001','Integration & APIs',        4, 18),
('ph-iot-05','tmpl-iot-001','Frontend & Dashboards',     5, 22),
('ph-iot-06','tmpl-iot-001','Testing, UAT & Go-Live',    6, 16);

INSERT INTO project_template_tasks (id, phase_id, template_id, name, description, priority, estimated_hours, category, task_order) VALUES
-- Phase 1
('tt-iot-01','ph-iot-01','tmpl-iot-001','Stakeholder interviews','Interview facility managers, warehouse ops and IT leads to capture requirements','high',16,'Analysis',1),
('tt-iot-02','ph-iot-01','tmpl-iot-001','Site survey & hardware audit','Survey physical environment, network infrastructure and anchor placement options','high',24,'Analysis',2),
('tt-iot-03','ph-iot-01','tmpl-iot-001','Requirements specification','Document functional and non-functional requirements, KPIs and acceptance criteria','high',20,'Documentation',3),
('tt-iot-04','ph-iot-01','tmpl-iot-001','Technology selection sign-off','Compare RTLS vendors, present recommendation and get client sign-off','medium',8,'Design',4),
-- Phase 2
('tt-iot-05','ph-iot-02','tmpl-iot-001','Network topology design','Design WiFi/UWB anchor placement, coverage map and redundancy plan','high',24,'Architecture',1),
('tt-iot-06','ph-iot-02','tmpl-iot-001','Data model design','Design asset, location event and telemetry schemas','high',16,'Architecture',2),
('tt-iot-07','ph-iot-02','tmpl-iot-001','Integration architecture','Design APIs for ERP, WMS and BI tool integrations','high',20,'Architecture',3),
('tt-iot-08','ph-iot-02','tmpl-iot-001','Security & GDPR review','Assess data sensitivity, encryption at rest/transit, access controls','critical',12,'Security',4),
('tt-iot-09','ph-iot-02','tmpl-iot-001','Architecture sign-off','Present to client technical team and get written approval','medium',6,'Documentation',5),
-- Phase 3
('tt-iot-10','ph-iot-03','tmpl-iot-001','Hardware procurement & delivery','Order and take delivery of anchors, tags, gateways and servers','critical',8,'Infrastructure',1),
('tt-iot-11','ph-iot-03','tmpl-iot-001','Network infrastructure installation','Install and configure anchors, access points and cabling','critical',40,'Infrastructure',2),
('tt-iot-12','ph-iot-03','tmpl-iot-001','SEWIO server installation','Install and configure SEWIO RTLS server, license activation','critical',16,'Infrastructure',3),
('tt-iot-13','ph-iot-03','tmpl-iot-001','Tag commissioning','Commission, test and label all asset tags','high',24,'Infrastructure',4),
('tt-iot-14','ph-iot-03','tmpl-iot-001','Core telemetry pipeline','Build location event ingestion, processing and storage pipeline','high',40,'Engineering',5),
('tt-iot-15','ph-iot-03','tmpl-iot-001','Infrastructure acceptance testing','Coverage, accuracy and latency testing against agreed KPIs','high',24,'QA',6),
-- Phase 4
('tt-iot-16','ph-iot-04','tmpl-iot-001','REST API build','Build asset location, history and alert APIs for downstream consumers','high',40,'Engineering',1),
('tt-iot-17','ph-iot-04','tmpl-iot-001','ERP integration','Real-time asset status sync with client ERP system','high',32,'Integration',2),
('tt-iot-18','ph-iot-04','tmpl-iot-001','WMS integration','Bi-directional sync with warehouse management system','high',32,'Integration',3),
('tt-iot-19','ph-iot-04','tmpl-iot-001','Alert & notification engine','Build geofence breach, missing asset and maintenance alerts','medium',24,'Engineering',4),
('tt-iot-20','ph-iot-04','tmpl-iot-001','API documentation','OpenAPI spec, Postman collection, integration guide','medium',12,'Documentation',5),
-- Phase 5
('tt-iot-21','ph-iot-05','tmpl-iot-001','Floor plan visualisation','Interactive 2D floor plan with real-time asset positions','critical',48,'Frontend',1),
('tt-iot-22','ph-iot-05','tmpl-iot-001','Asset tracking dashboard','Asset inventory, location history, search and filter','high',32,'Frontend',2),
('tt-iot-23','ph-iot-05','tmpl-iot-001','Analytics dashboard','Utilisation rates, dwell times, movement heatmaps','high',32,'Analytics',3),
('tt-iot-24','ph-iot-05','tmpl-iot-001','Alert management UI','Alert inbox, rule configuration, notification preferences','medium',20,'Frontend',4),
('tt-iot-25','ph-iot-05','tmpl-iot-001','Mobile companion app','React Native app for warehouse operatives — scan, locate, report','medium',60,'Mobile',5),
-- Phase 6
('tt-iot-26','ph-iot-06','tmpl-iot-001','End-to-end system testing','Full scenario testing across all integrated systems','critical',40,'QA',1),
('tt-iot-27','ph-iot-06','tmpl-iot-001','Performance & load testing','500 concurrent tags, high-frequency event processing','high',24,'QA',2),
('tt-iot-28','ph-iot-06','tmpl-iot-001','UAT facilitation','Support client UAT, track defects, coordinate fixes','critical',32,'UAT',3),
('tt-iot-29','ph-iot-06','tmpl-iot-001','Staff training','Train warehouse staff, supervisors and IT admins','high',16,'Training',4),
('tt-iot-30','ph-iot-06','tmpl-iot-001','Go-live cutover','Production deployment, data migration, cutover execution','critical',16,'Deployment',5),
('tt-iot-31','ph-iot-06','tmpl-iot-001','Post go-live hypercare','30-day hypercare support, issue resolution, optimisation','high',40,'Support',6);

-- ════════════════════════════════════════════════════════════════
-- SEED: Data Analysis & Migration
-- ════════════════════════════════════════════════════════════════
INSERT INTO project_templates (id, name, project_type, description, is_system) VALUES
('tmpl-dm-001', 'Data Analysis & Migration', 'data_migration',
 'Legacy to cloud-native data warehouse migration covering data profiling, ETL pipeline build, quality validation, reporting dashboards and production cutover.',
 1);

INSERT INTO project_template_phases (id, template_id, phase_name, phase_order, duration_pct) VALUES
('ph-dm-01','tmpl-dm-001','Discovery & Profiling',   1, 15),
('ph-dm-02','tmpl-dm-001','Architecture & Design',   2, 10),
('ph-dm-03','tmpl-dm-001','ETL Build',                3, 35),
('ph-dm-04','tmpl-dm-001','Validation & Dashboards', 4, 25),
('ph-dm-05','tmpl-dm-001','Go-Live',                  5, 15);

INSERT INTO project_template_tasks (id, phase_id, template_id, name, description, priority, estimated_hours, category, task_order) VALUES
('tt-dm-01','ph-dm-01','tmpl-dm-001','Source system inventory','Catalogue all source tables, document owners, row counts and PII fields','high',16,'Analysis',1),
('tt-dm-02','ph-dm-01','tmpl-dm-001','Data profiling','Run profiling on all sources — nulls, duplicates, formats, outliers, referential integrity','high',32,'Analysis',2),
('tt-dm-03','ph-dm-01','tmpl-dm-001','Source-to-target mapping','Map source fields to target schema, document transformations and business rules','high',24,'Design',3),
('tt-dm-04','ph-dm-01','tmpl-dm-001','Data quality baseline report','Document current quality issues, severity ratings and remediation plan','medium',12,'Documentation',4),
('tt-dm-05','ph-dm-02','tmpl-dm-001','Target schema design','Design warehouse schema — medallion architecture or dimensional model','high',24,'Architecture',1),
('tt-dm-06','ph-dm-02','tmpl-dm-001','ETL framework selection','Evaluate and select ETL tooling (dbt, ADF, Airbyte etc)','high',8,'Architecture',2),
('tt-dm-07','ph-dm-02','tmpl-dm-001','Migration strategy document','Big bang vs incremental, rollback plan, validation approach','critical',16,'Documentation',3),
('tt-dm-08','ph-dm-02','tmpl-dm-001','Architecture sign-off','Client review and written approval of target architecture','medium',6,'Documentation',4),
('tt-dm-09','ph-dm-03','tmpl-dm-001','Bronze layer ingestion','Build raw extract pipelines from all source systems into landing zone','critical',48,'Engineering',1),
('tt-dm-10','ph-dm-03','tmpl-dm-001','Silver layer transformations','Cleanse, conform, deduplicate and standardise into silver zone','critical',56,'Engineering',2),
('tt-dm-11','ph-dm-03','tmpl-dm-001','Gold layer aggregates','Business-ready facts, dimensions and aggregates for reporting','high',40,'Engineering',3),
('tt-dm-12','ph-dm-03','tmpl-dm-001','Orchestration & scheduling','Pipeline scheduling, dependency management, retry logic and alerting','high',24,'Engineering',4),
('tt-dm-13','ph-dm-03','tmpl-dm-001','Unit test suite','Data transformation unit tests, row count assertions, null checks','high',20,'QA',5),
('tt-dm-14','ph-dm-04','tmpl-dm-001','Reconciliation testing','Row count, sum checks and statistical sampling vs source systems','critical',32,'QA',1),
('tt-dm-15','ph-dm-04','tmpl-dm-001','Data quality dashboard','Real-time DQ monitoring, anomaly detection, completeness scores','high',24,'Analytics',2),
('tt-dm-16','ph-dm-04','tmpl-dm-001','Business reporting dashboards','Deliver agreed Power BI / Looker report set with client sign-off','high',40,'Analytics',3),
('tt-dm-17','ph-dm-04','tmpl-dm-001','UAT support','Facilitate UAT, track defects, deliver fixes within SLA','critical',24,'UAT',4),
('tt-dm-18','ph-dm-05','tmpl-dm-001','Full historical load','Execute full historical data load into production environment','critical',16,'Deployment',1),
('tt-dm-19','ph-dm-05','tmpl-dm-001','Cutover validation','Final reconciliation, stakeholder sign-off, issue log cleared','critical',12,'QA',2),
('tt-dm-20','ph-dm-05','tmpl-dm-001','Handover & documentation','Runbook, data dictionary, pipeline docs and knowledge transfer','high',20,'Documentation',3),
('tt-dm-21','ph-dm-05','tmpl-dm-001','Hypercare support','30-day post-migration monitoring, critical fixes within 4h SLA','high',40,'Support',4);

-- ════════════════════════════════════════════════════════════════
-- SEED: Platform / SaaS Build
-- ════════════════════════════════════════════════════════════════
INSERT INTO project_templates (id, name, project_type, description, is_system) VALUES
('tmpl-pf-001', 'Platform / SaaS Build', 'platform',
 'End-to-end SaaS product build from architecture and UX design through core engineering, feature modules, security testing and production launch.',
 1);

INSERT INTO project_template_phases (id, template_id, phase_name, phase_order, duration_pct) VALUES
('ph-pf-01','tmpl-pf-001','Discovery & Architecture', 1, 15),
('ph-pf-02','tmpl-pf-001','Core Platform Build',      2, 30),
('ph-pf-03','tmpl-pf-001','Feature Modules',           3, 35),
('ph-pf-04','tmpl-pf-001','Testing & Launch',          4, 20);

INSERT INTO project_template_tasks (id, phase_id, template_id, name, description, priority, estimated_hours, category, task_order) VALUES
('tt-pf-01','ph-pf-01','tmpl-pf-001','Product requirements document','Define features, user stories, acceptance criteria and MVP scope','critical',24,'Product',1),
('tt-pf-02','ph-pf-01','tmpl-pf-001','Technical architecture','Tech stack, data model, API design, deployment architecture','critical',32,'Architecture',2),
('tt-pf-03','ph-pf-01','tmpl-pf-001','UX wireframes','Wireframe all key screens, user flows and responsive breakpoints','high',40,'Design',3),
('tt-pf-04','ph-pf-01','tmpl-pf-001','Design system','Component library, colour tokens, typography, spacing system','high',24,'Design',4),
('tt-pf-05','ph-pf-02','tmpl-pf-001','Auth & multi-tenancy','JWT auth, refresh tokens, tenant isolation, RBAC foundation','critical',40,'Engineering',1),
('tt-pf-06','ph-pf-02','tmpl-pf-001','Database schema & migrations','Core schema, indexes, migration framework, seed data','critical',32,'Engineering',2),
('tt-pf-07','ph-pf-02','tmpl-pf-001','API framework','REST API routing, middleware, error handling, response envelopes','critical',24,'Engineering',3),
('tt-pf-08','ph-pf-02','tmpl-pf-001','Frontend shell','App shell, sidebar nav, routing, auth context, theme system','high',32,'Frontend',4),
('tt-pf-09','ph-pf-02','tmpl-pf-001','CI/CD pipeline','Build, test, deploy pipeline with staging and production environments','high',16,'DevOps',5),
('tt-pf-10','ph-pf-03','tmpl-pf-001','Module 1 — Core feature','Build primary feature module end-to-end (API + UI)','critical',48,'Engineering',1),
('tt-pf-11','ph-pf-03','tmpl-pf-001','Module 2 — Secondary feature','Build secondary feature module end-to-end','high',40,'Engineering',2),
('tt-pf-12','ph-pf-03','tmpl-pf-001','Module 3 — Supporting feature','Build supporting feature module end-to-end','high',32,'Engineering',3),
('tt-pf-13','ph-pf-03','tmpl-pf-001','Email & notification system','Transactional email, in-app notifications, preference management','medium',20,'Engineering',4),
('tt-pf-14','ph-pf-03','tmpl-pf-001','Reporting & analytics','Key metrics dashboards, export functions, scheduled reports','medium',24,'Analytics',5),
('tt-pf-15','ph-pf-04','tmpl-pf-001','End-to-end test suite','Playwright/Cypress E2E tests for all critical user journeys','high',32,'QA',1),
('tt-pf-16','ph-pf-04','tmpl-pf-001','Security penetration test','External pen test, fix all critical and high findings','critical',24,'Security',2),
('tt-pf-17','ph-pf-04','tmpl-pf-001','Performance testing','Load testing, database query optimisation, caching strategy','high',20,'QA',3),
('tt-pf-18','ph-pf-04','tmpl-pf-001','Beta programme','Onboard 5 beta users, collect feedback, iterate on UX','high',32,'Product',4),
('tt-pf-19','ph-pf-04','tmpl-pf-001','Production launch','Final deployment, DNS cutover, monitoring setup, launch comms','critical',16,'Deployment',5);

-- ════════════════════════════════════════════════════════════════
-- SEED: Managed Support Retainer
-- ════════════════════════════════════════════════════════════════
INSERT INTO project_templates (id, name, project_type, description, is_system) VALUES
('tmpl-sp-001', 'Managed Support Retainer', 'support',
 'Rolling managed support retainer with incident management, proactive monitoring, minor enhancements and quarterly service reviews.',
 1);

INSERT INTO project_template_phases (id, template_id, phase_name, phase_order, duration_pct) VALUES
('ph-sp-01','tmpl-sp-001','Onboarding & Setup',     1, 15),
('ph-sp-02','tmpl-sp-001','Active Support — Q1',    2, 28),
('ph-sp-03','tmpl-sp-001','Active Support — Q2',    3, 28),
('ph-sp-04','tmpl-sp-001','Review & Renewal',       4, 29);

INSERT INTO project_template_tasks (id, phase_id, template_id, name, description, priority, estimated_hours, category, task_order) VALUES
('tt-sp-01','ph-sp-01','tmpl-sp-001','Service desk configuration','Set up ticketing system, SLA rules, escalation paths and queues','high',16,'Setup',1),
('tt-sp-02','ph-sp-01','tmpl-sp-001','Runbook creation','Document known issues, fix procedures and escalation contacts','high',24,'Documentation',2),
('tt-sp-03','ph-sp-01','tmpl-sp-001','Monitoring & alerting setup','Configure uptime, error rate and performance alerts','critical',20,'DevOps',3),
('tt-sp-04','ph-sp-01','tmpl-sp-001','Knowledge base setup','Build initial KB articles for common L1 issues','medium',16,'Documentation',4),
('tt-sp-05','ph-sp-02','tmpl-sp-001','L1/L2 incident management','Respond to and resolve incidents within agreed SLA targets','high',80,'Support',1),
('tt-sp-06','ph-sp-02','tmpl-sp-001','Weekly status reports','Send weekly ticket volume, SLA achievement and open issue reports','medium',8,'Reporting',2),
('tt-sp-07','ph-sp-02','tmpl-sp-001','Proactive monitoring','Daily system health checks, anomaly investigation','high',20,'DevOps',3),
('tt-sp-08','ph-sp-02','tmpl-sp-001','Q1 service review','Quarterly service review meeting, SLA report, improvement actions','medium',8,'Reporting',4),
('tt-sp-09','ph-sp-03','tmpl-sp-001','L1/L2 incident management','Ongoing incident response and resolution','high',80,'Support',1),
('tt-sp-10','ph-sp-03','tmpl-sp-001','Minor enhancements','Deliver agreed minor change requests within monthly allocation','medium',32,'Engineering',2),
('tt-sp-11','ph-sp-03','tmpl-sp-001','Performance optimisation','Identify and fix performance bottlenecks from monitoring data','medium',20,'Engineering',3),
('tt-sp-12','ph-sp-03','tmpl-sp-001','Q2 service review','Quarterly review, SLA report, roadmap for H2','medium',8,'Reporting',4),
('tt-sp-13','ph-sp-04','tmpl-sp-001','H2 incident management','Ongoing L1/L2 support through Q3 and Q4','high',160,'Support',1),
('tt-sp-14','ph-sp-04','tmpl-sp-001','Annual service review','Full-year review, SLA performance, renewal proposal','high',12,'Reporting',2);

-- ════════════════════════════════════════════════════════════════
-- SEED: Team Upskilling & Training
-- ════════════════════════════════════════════════════════════════
INSERT INTO project_templates (id, name, project_type, description, is_system) VALUES
('tmpl-tr-001', 'Team Upskilling & Training', 'training',
 'Structured upskilling programme covering cloud certifications, technical skills, professional development and internal knowledge sharing.',
 1);

INSERT INTO project_template_phases (id, template_id, phase_name, phase_order, duration_pct) VALUES
('ph-tr-01','tmpl-tr-001','Planning & Design',         1, 10),
('ph-tr-02','tmpl-tr-001','Technical Skills',           2, 40),
('ph-tr-03','tmpl-tr-001','Professional Development',  3, 35),
('ph-tr-04','tmpl-tr-001','Knowledge Sharing & Review',4, 15);

INSERT INTO project_template_tasks (id, phase_id, template_id, name, description, priority, estimated_hours, category, task_order) VALUES
('tt-tr-01','ph-tr-01','tmpl-tr-001','Training needs analysis','Survey team skills gaps, map against role requirements and business goals','high',16,'Analysis',1),
('tt-tr-02','ph-tr-01','tmpl-tr-001','Learning plan design','Design individual learning paths, select courses and certifications','high',12,'Design',2),
('tt-tr-03','ph-tr-01','tmpl-tr-001','Budget allocation','Allocate training budget across team members and course types','medium',4,'Planning',3),
('tt-tr-04','ph-tr-01','tmpl-tr-001','Schedule planning','Block learning time in calendars, coordinate with project commitments','medium',4,'Planning',4),
('tt-tr-05','ph-tr-02','tmpl-tr-001','Cloud certification — Engineer 1','AWS/Azure cert: study, practice exams, sit exam','high',40,'Cloud',1),
('tt-tr-06','ph-tr-02','tmpl-tr-001','Cloud certification — Engineer 2','AWS/Azure cert: study, practice exams, sit exam','high',40,'Cloud',2),
('tt-tr-07','ph-tr-02','tmpl-tr-001','Data engineering deep-dive','dbt, Spark, pipeline design — online course and internal project','high',24,'Data',3),
('tt-tr-08','ph-tr-02','tmpl-tr-001','Security & compliance training','GDPR, ISO27001 awareness, secure coding practices','high',8,'Security',4),
('tt-tr-09','ph-tr-02','tmpl-tr-001','AI/ML practical workshop','Hands-on: prompt engineering, ML basics, AI tooling','medium',8,'AI',5),
('tt-tr-10','ph-tr-03','tmpl-tr-001','Project management certification','PRINCE2/PMP preparation: study guide, practice tests, exam booking','medium',60,'Management',1),
('tt-tr-11','ph-tr-03','tmpl-tr-001','Communication & presenting skills','External workshop: structuring ideas, presenting to stakeholders','medium',8,'Soft Skills',2),
('tt-tr-12','ph-tr-03','tmpl-tr-001','Technical writing','Online course: documentation, runbooks, architecture decision records','low',8,'Soft Skills',3),
('tt-tr-13','ph-tr-04','tmpl-tr-001','Brown-bag sessions x4','Monthly internal tech talks: each engineer presents a topic','medium',12,'Internal',1),
('tt-tr-14','ph-tr-04','tmpl-tr-001','Lessons learned retrospective','End-of-programme retrospective: what worked, ROI, next steps','medium',4,'Internal',2),
('tt-tr-15','ph-tr-04','tmpl-tr-001','Skills matrix update','Update team skills matrix, publish to HR system','low',4,'Internal',3);

-- ════════════════════════════════════════════════════════════════
-- SEED: General Project
-- ════════════════════════════════════════════════════════════════
INSERT INTO project_templates (id, name, project_type, description, is_system) VALUES
('tmpl-gn-001', 'General Project', 'general',
 'Generic project lifecycle template — initiation, planning, execution and closure. Customise tasks to suit your specific project.',
 1);

INSERT INTO project_template_phases (id, template_id, phase_name, phase_order, duration_pct) VALUES
('ph-gn-01','tmpl-gn-001','Initiation', 1, 10),
('ph-gn-02','tmpl-gn-001','Planning',   2, 15),
('ph-gn-03','tmpl-gn-001','Execution',  3, 60),
('ph-gn-04','tmpl-gn-001','Closure',    4, 15);

INSERT INTO project_template_tasks (id, phase_id, template_id, name, description, priority, estimated_hours, category, task_order) VALUES
('tt-gn-01','ph-gn-01','tmpl-gn-001','Project charter','Define objectives, scope, constraints, assumptions and success criteria','high',8,'Planning',1),
('tt-gn-02','ph-gn-01','tmpl-gn-001','Stakeholder register','Identify and document all stakeholders, influence and communication needs','medium',4,'Planning',2),
('tt-gn-03','ph-gn-01','tmpl-gn-001','Risk register','Identify risks, assess probability and impact, define mitigations','high',8,'Planning',3),
('tt-gn-04','ph-gn-02','tmpl-gn-001','Work breakdown structure','Decompose deliverables into manageable work packages','high',12,'Planning',1),
('tt-gn-05','ph-gn-02','tmpl-gn-001','Resource plan','Assign resources to tasks, identify gaps and constraints','high',8,'Planning',2),
('tt-gn-06','ph-gn-02','tmpl-gn-001','Project schedule baseline','Build full project schedule, get stakeholder sign-off','high',8,'Planning',3),
('tt-gn-07','ph-gn-03','tmpl-gn-001','Deliverable 1','Primary project deliverable — specify during project setup','critical',40,'Delivery',1),
('tt-gn-08','ph-gn-03','tmpl-gn-001','Deliverable 2','Secondary project deliverable','high',32,'Delivery',2),
('tt-gn-09','ph-gn-03','tmpl-gn-001','Deliverable 3','Supporting deliverable','high',24,'Delivery',3),
('tt-gn-10','ph-gn-03','tmpl-gn-001','Weekly status reports','Weekly RAG status, progress vs plan, risks and issues','medium',8,'Reporting',4),
('tt-gn-11','ph-gn-04','tmpl-gn-001','Final delivery & sign-off','Client acceptance, formal project closure, sign-off documentation','critical',8,'Delivery',1),
('tt-gn-12','ph-gn-04','tmpl-gn-001','Lessons learned','Project retrospective, lessons learned report','medium',4,'Documentation',2),
('tt-gn-13','ph-gn-04','tmpl-gn-001','Handover documentation','Complete handover pack, knowledge transfer to operations team','high',16,'Documentation',3);

-- Enable clients+invoicing on professional/enterprise plans (idempotent)
UPDATE plan_limits
SET features = replace(features, '"]', '","clients","invoicing","project_templates"]')
WHERE plan IN ('professional','enterprise')
  AND features NOT LIKE '%project_templates%';

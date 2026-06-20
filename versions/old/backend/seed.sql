-- ====================================================================
-- XAVVYSUITE: UNIFIED 3-YEAR MASTER SEED DATA
-- Cadence: Strict 4-Week Cycles (13 Sprints/Year | 39 Sprints Total)
-- Order of Execution: Users -> Employees -> Sprints -> Milestones -> Tasks
-- ====================================================================

-- Clear out any existing data nodes in reverse dependency order
DELETE FROM history;
DELETE FROM leaves;
DELETE FROM timesheets;
DELETE FROM compliance_records;
DELETE FROM pms_tasks;
DELETE FROM pms_milestones;
DELETE FROM pms_sprints;
DELETE FROM employees;
DELETE FROM users;

-- --- SECTION 1: SYSTEM IDENTITIES & SECURITY ENGINES ---
INSERT INTO users (id, email, password, role) VALUES (1, 'admin@xavvy.uk', 'admin123', 'admin');
INSERT INTO users (id, email, password, role) VALUES (2, 'priya-madhuri-narsing@xavvy.uk', 'password123', 'employee');
INSERT INTO users (id, email, password, role) VALUES (3, 'zeba-mansoor@xavvy.uk', 'password123', 'employee');
INSERT INTO users (id, email, password, role) VALUES (4, 'nanjusha-vasireddy@xavvy.uk', 'password123', 'employee');
INSERT INTO users (id, email, password, role) VALUES (5, 'swathi-madadi@xavvy.uk', 'password123', 'employee');

-- --- SECTION 2: CORE PLATFORM RESOURCING NODES ---
INSERT INTO employees (id, user_id, name, department, designation, joining_date, mobile, address, salary, start_date, status) 
VALUES (1, 1, 'Xavvy Admin', 'Executive', 'System Administrator', '2026-01-01', '+44 7700 900077', '10 Obsidian Way, London', 120000.00, '2026-01-01', 'Active');

INSERT INTO employees (id, user_id, name, department, designation, joining_date, mobile, address, salary, start_date, status) 
VALUES (2, 2, 'Priya Madhuri Narsing', 'Product', 'Business Analyst & QA Tester', '2026-06-01', '+44 7700 900333', '14 Grenadier Rd, Manchester', 92000.00, '2026-06-01', 'Active');

INSERT INTO employees (id, user_id, name, department, designation, joining_date, mobile, address, salary, start_date, status) 
VALUES (3, 3, 'Zeba Mansoor', 'Engineering', 'Database Developer', '2026-06-01', '+44 7700 900222', '88 Canary Wharf, London', 78000.00, '2026-06-01', 'Active');

INSERT INTO employees (id, user_id, name, department, designation, joining_date, mobile, address, salary, start_date, status) 
VALUES (4, 4, 'Nanjusha Vasireddy', 'Engineering', 'Analyst Programmer', '2026-06-01', '+44 7700 900111', '24 Baker St, London', 65000.00, '2026-06-01', 'Active');

INSERT INTO employees (id, user_id, name, department, designation, joining_date, mobile, address, salary, start_date, status) 
VALUES (5, 5, 'Swathi Madadi', 'Engineering', 'Senior Developer', '2026-06-01', '+44 7700 900444', '31 High St, Bristol', 94000.00, '2026-06-01', 'Active');

-- --- SECTION 3: 3-YEAR SPRINT ARCHITECTURE CHRONOLOGY ---
-- Year 1 Sprints (Sprints 01 - 13)
INSERT INTO pms_sprints (sprint_number, sprint_name, start_date, end_date, status) VALUES 
(1, 'Sprint 01: Core Workspace & Architecture Definition', '2026-06-01', '2026-06-29', 'Active'),
(2, 'Sprint 02: Verification Middleware & Security Locking', '2026-06-29', '2026-07-27', 'Upcoming'),
(3, 'Sprint 03: Personnel Grid & Identity Console Assembly', '2026-07-27', '2026-08-24', 'Upcoming'),
(4, 'Sprint 04: Profile Status States & Soft Deletion Core', '2026-08-24', '2026-09-21', 'Upcoming'),
(5, 'Sprint 05: Cryptographic Administration Logs Engine', '2026-09-21', '2026-10-19', 'Upcoming'),
(6, 'Sprint 06: Ledger Query Optimization & Filtering Views', '2026-10-19', '2026-11-16', 'Upcoming'),
(7, 'Sprint 07: One-To-Many Relational Compliance Architecture', '2026-11-16', '2026-12-14', 'Upcoming'),
(8, 'Sprint 08: Timesheet Telemetry Aggregation Core', '2026-12-14', '2027-01-11', 'Upcoming'),
(9, 'Sprint 09: Manager Exceptions Approval Dashboard Layer', '2027-01-11', '2027-02-08', 'Upcoming'),
(10, 'Sprint 10: Capacity Leaves Management Systems Core', '2027-02-08', '2027-03-08', 'Upcoming'),
(11, 'Sprint 11: Visual Team Capacity Timeline Calendars', '2027-03-08', '2027-04-05', 'Upcoming'),
(12, 'Sprint 12: Compensation Structures In-line Wizard', '2027-04-05', '2027-05-03', 'Upcoming'),
(13, 'Sprint 13: Corporate Asset Blending & Branding Lock', '2027-05-03', '2027-05-31', 'Upcoming');

-- Year 2 Sprints (Sprints 14 - 26)
INSERT INTO pms_sprints (sprint_number, sprint_name, start_date, end_date, status) VALUES 
(14, 'Sprint 14: Standalone PMS Codebase Decoupling Loop', '2027-05-31', '2027-06-28', 'Upcoming'),
(15, 'Sprint 15: projects.xavvy.uk DNS Subdomain Binding', '2027-06-28', '2027-07-26', 'Upcoming'),
(16, 'Sprint 16: Chronological 3-Year Sprint Builder Logic', '2027-07-26', '2027-08-23', 'Upcoming'),
(17, 'Sprint 17: Lifecycle Software Task Payload Injection', '2027-08-23', '2027-09-20', 'Upcoming'),
(18, 'Sprint 18: Cross-Domain Directory Resource Lookup API', '2027-09-20', '2027-10-18', 'Upcoming'),
(19, 'Sprint 19: Interactive Kanban Status Boards Execution', '2027-10-18', '2027-11-15', 'Upcoming'),
(20, 'Sprint 20: Lifecycle Milestone Progress Widgets', '2027-11-15', '2027-12-13', 'Upcoming'),
(21, 'Sprint 21: HR Utilization & Commit Analytics Core', '2027-12-13', '2028-01-10', 'Upcoming'),
(22, 'Sprint 22: High-Performance Data Aggregation Arrays', '2028-01-10', '2028-02-07', 'Upcoming'),
(23, 'Sprint 23: Headcount Variance Forecasting Metrics', '2028-02-07', '2028-03-06', 'Upcoming'),
(24, 'Sprint 24: Cross-App Layout Responsive Testing (Mobile)', '2028-03-06', '2028-04-03', 'Upcoming'),
(25, 'Sprint 25: Unified Flex-Grid Breakpoints Refinement', '2028-04-03', '2028-05-01', 'Upcoming'),
(26, 'Sprint 26: Cross-Browser CSS Render Safety Locking', '2028-05-01', '2028-05-29', 'Upcoming');

-- Year 3 Sprints (Sprints 27 - 39)
INSERT INTO pms_sprints (sprint_number, sprint_name, start_date, end_date, status) VALUES 
(27, 'Sprint 27: System Automated Push Alerts Architecture', '2028-05-29', '2028-06-26', 'Upcoming'),
(28, 'Sprint 28: Date-Checked DB System Event Triggers', '2028-06-26', '2028-07-24', 'Upcoming'),
(29, 'Sprint 29: Toast Event Notification Broker Components', '2028-07-24', '2028-08-21', 'Upcoming'),
(30, 'Sprint 30: Edge Worker D1 Query Caching Subsystems', '2028-08-21', '2028-09-18', 'Upcoming'),
(31, 'Sprint 31: High-Traffic SQL Join Indexing Tuning', '2028-09-18', '2028-10-16', 'Upcoming'),
(32, 'Sprint 32: Client Data Collections Memory Lazy Loading', '2028-10-16', '2028-11-13', 'Upcoming'),
(33, 'Sprint 33: JWT Validation Payload Encrypt Hardening', '2028-11-13', '2028-12-11', 'Upcoming'),
(34, 'Sprint 34: API Endpoint Security Diagnostics & Scrubbing', '2028-12-11', '2029-01-08', 'Upcoming'),
(35, 'Sprint 35: Global End-To-End Cross-Module Bug Passes', '2029-01-08', '2029-02-05', 'Upcoming'),
(36, 'Sprint 36: Unit Validation Assertions Matrix Run', '2029-02-05', '2029-03-05', 'Upcoming'),
(37, 'Sprint 37: Cloud Production Cluster Load Benchmarking', '2029-03-05', '2029-04-02', 'Upcoming'),
(38, 'Sprint 38: Deployment Script Optimization Frameworks', '2029-04-02', '2029-04-30', 'Upcoming'),
(39, 'Sprint 39: Stable Release Lifecycle Compilation V1.0', '2029-04-30', '2029-05-28', 'Upcoming');

-- --- SECTION 4: PRODUCT DEVELOPMENT MILESTONE GATEWAYS ---
INSERT INTO pms_milestones (milestone_name, target_date, description, status) VALUES ('Milestone Alpha: Core Schema Lock-In', '2026-07-15', 'Relational database model layouts and security check definitions validated stable.', 'Pending');
INSERT INTO pms_milestones (milestone_name, target_date, description, status) VALUES ('Milestone Beta: Minimum Viable Product Pipeline', '2026-12-20', 'End-to-end integration metrics functional across active HR telemetry panels.', 'Pending');

-- --- SECTION 5: RELATIONAL WORK TASK ENTRIES (Sprint 1 Active Map) ---
INSERT INTO pms_tasks (sprint_id, assigned_employee_id, task_name, phase, status) 
VALUES ((SELECT id FROM pms_sprints WHERE sprint_number = 1), 4, 'Compile Comprehensive Epics and User Stories Documents for HR Shell', 'Requirements', 'In Progress');

INSERT INTO pms_tasks (sprint_id, assigned_employee_id, task_name, phase, status) 
VALUES ((SELECT id FROM pms_sprints WHERE sprint_number = 1), 3, 'Model Multi-tenant Database Isolation Strategies Layout Tables', 'Architecture', 'In Progress');

INSERT INTO pms_tasks (sprint_id, assigned_employee_id, task_name, phase, status) 
VALUES ((SELECT id FROM pms_sprints WHERE sprint_number = 1), 5, 'Configure Authentication Workers & Secure Jose JWT Encoding Libraries', 'Development', 'In Progress');

INSERT INTO pms_tasks (sprint_id, assigned_employee_id, task_name, phase, status) 
VALUES ((SELECT id FROM pms_sprints WHERE sprint_number = 1), 2, 'Construct Base App Layout Framework & Accent UI Styling Tokens', 'Development', 'In Progress');

INSERT INTO pms_tasks (sprint_id, assigned_employee_id, task_name, phase, status) 
VALUES ((SELECT id FROM pms_sprints WHERE sprint_number = 1), 4, 'Formulate Test Suites & End-to-End Automated Testing Suite Scripts', 'Testing', 'Backlog');
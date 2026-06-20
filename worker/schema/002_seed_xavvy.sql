-- ============================================================
-- XavvySuite — Xavvy Tenant #1 Seed
-- 002_seed_xavvy.sql
-- Run AFTER 001_core.sql
-- ============================================================

PRAGMA foreign_keys = OFF;

-- ── Tenant ────────────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO tenants (id, subdomain, name, status, plan)
VALUES ('xavvy-tenant-001', 'xavvy', 'Xavvy', 'active', 'enterprise');

-- ── Domain ────────────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO tenant_domains (id, tenant_id, domain, is_primary, tls_status, verified_at)
VALUES ('dom-xavvy-001', 'xavvy-tenant-001', 'app.xavvy.uk', 1, 'active', CURRENT_TIMESTAMP);

-- ── Branding ──────────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO tenant_branding (id, tenant_id, company_name, primary_color, secondary_color)
VALUES ('brand-xavvy-001', 'xavvy-tenant-001', 'Xavvy', '#6366F1', '#14B8A6');

-- ── Modules (all enabled) ─────────────────────────────────────────────────────
INSERT OR IGNORE INTO tenant_modules (id, tenant_id, module_key, enabled) VALUES
  ('mod-xavvy-01', 'xavvy-tenant-001', 'hr',            1),
  ('mod-xavvy-02', 'xavvy-tenant-001', 'leave',         1),
  ('mod-xavvy-03', 'xavvy-tenant-001', 'timesheets',    1),
  ('mod-xavvy-04', 'xavvy-tenant-001', 'expenses',      1),
  ('mod-xavvy-05', 'xavvy-tenant-001', 'compliance',    1),
  ('mod-xavvy-06', 'xavvy-tenant-001', 'pmo',           1),
  ('mod-xavvy-07', 'xavvy-tenant-001', 'recruitment',   1),
  ('mod-xavvy-08', 'xavvy-tenant-001', 'documents',     1),
  ('mod-xavvy-09', 'xavvy-tenant-001', 'assets',        1),
  ('mod-xavvy-10', 'xavvy-tenant-001', 'training',      1),
  ('mod-xavvy-11', 'xavvy-tenant-001', 'announcements', 1),
  ('mod-xavvy-12', 'xavvy-tenant-001', 'sos',           1),
  ('mod-xavvy-13', 'xavvy-tenant-001', 'checklists',    1),
  ('mod-xavvy-14', 'xavvy-tenant-001', 'reporting',     1);

-- ── Settings ──────────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO tenant_settings (id, tenant_id, key, value) VALUES
  ('set-xavvy-01', 'xavvy-tenant-001', 'timezone',            '"Europe/London"'),
  ('set-xavvy-02', 'xavvy-tenant-001', 'currency',            '"GBP"'),
  ('set-xavvy-03', 'xavvy-tenant-001', 'annual_leave_days',   '25'),
  ('set-xavvy-04', 'xavvy-tenant-001', 'work_week_hours',     '37.5'),
  ('set-xavvy-05', 'xavvy-tenant-001', 'fiscal_year_start',   '"04-01"'),
  ('set-xavvy-06', 'xavvy-tenant-001', 'probation_days',      '90'),
  ('set-xavvy-07', 'xavvy-tenant-001', 'rtw_alert_days',      '90');

-- ── Permissions ───────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO permissions (id, module_key, action, resource, description) VALUES
  -- HR
  ('perm-hr-01', 'hr', 'view',   'employee',     'View employee records'),
  ('perm-hr-02', 'hr', 'create', 'employee',     'Create new employees'),
  ('perm-hr-03', 'hr', 'edit',   'employee',     'Edit employee records'),
  ('perm-hr-04', 'hr', 'delete', 'employee',     'Delete employee records'),
  ('perm-hr-05', 'hr', 'manage', 'employee',     'Full HR management'),
  ('perm-hr-06', 'hr', 'view',   'compensation', 'View salary data'),
  ('perm-hr-07', 'hr', 'manage', 'compensation', 'Manage salary data'),
  -- Leave
  ('perm-lv-01', 'leave', 'view',    'leave_request', 'View leave requests'),
  ('perm-lv-02', 'leave', 'create',  'leave_request', 'Submit leave requests'),
  ('perm-lv-03', 'leave', 'approve', 'leave_request', 'Approve/decline leave'),
  ('perm-lv-04', 'leave', 'manage',  'leave_policy',  'Manage leave policies'),
  -- Timesheets
  ('perm-ts-01', 'timesheets', 'view',    'timesheet', 'View timesheets'),
  ('perm-ts-02', 'timesheets', 'create',  'timesheet', 'Submit timesheets'),
  ('perm-ts-03', 'timesheets', 'approve', 'timesheet', 'Approve timesheets'),
  ('perm-ts-04', 'timesheets', 'export',  'timesheet', 'Export timesheet data'),
  -- Expenses
  ('perm-ex-01', 'expenses', 'view',    'expense_claim', 'View expense claims'),
  ('perm-ex-02', 'expenses', 'create',  'expense_claim', 'Submit expenses'),
  ('perm-ex-03', 'expenses', 'approve', 'expense_claim', 'Approve expenses'),
  ('perm-ex-04', 'expenses', 'manage',  'expense_claim', 'Full expense management'),
  -- Compliance
  ('perm-co-01', 'compliance', 'view',   'rtw_check',  'View RTW checks'),
  ('perm-co-02', 'compliance', 'create', 'rtw_check',  'Create RTW checks'),
  ('perm-co-03', 'compliance', 'manage', 'rtw_check',  'Full compliance management'),
  ('perm-co-04', 'compliance', 'view',   'audit_log',  'View audit log'),
  -- PMO
  ('perm-pm-01', 'pmo', 'view',   'project', 'View projects'),
  ('perm-pm-02', 'pmo', 'create', 'project', 'Create projects'),
  ('perm-pm-03', 'pmo', 'edit',   'project', 'Edit projects'),
  ('perm-pm-04', 'pmo', 'manage', 'project', 'Full project management'),
  ('perm-pm-05', 'pmo', 'view',   'task',    'View tasks'),
  ('perm-pm-06', 'pmo', 'create', 'task',    'Create tasks'),
  ('perm-pm-07', 'pmo', 'edit',   'task',    'Edit tasks'),
  -- Recruitment
  ('perm-re-01', 'recruitment', 'view',   'job_posting', 'View job postings'),
  ('perm-re-02', 'recruitment', 'create', 'job_posting', 'Create job postings'),
  ('perm-re-03', 'recruitment', 'manage', 'job_posting', 'Full recruitment management'),
  -- Documents
  ('perm-do-01', 'documents', 'view',   'document', 'View documents'),
  ('perm-do-02', 'documents', 'create', 'document', 'Upload documents'),
  ('perm-do-03', 'documents', 'delete', 'document', 'Delete documents'),
  ('perm-do-04', 'documents', 'manage', 'document', 'Full document management'),
  -- Assets
  ('perm-as-01', 'assets', 'view',   'asset', 'View assets'),
  ('perm-as-02', 'assets', 'create', 'asset', 'Register assets'),
  ('perm-as-03', 'assets', 'edit',   'asset', 'Edit assets'),
  ('perm-as-04', 'assets', 'manage', 'asset', 'Full asset management'),
  -- Training
  ('perm-tr-01', 'training', 'view',   'course',     'View training'),
  ('perm-tr-02', 'training', 'create', 'course',     'Create courses'),
  ('perm-tr-03', 'training', 'record', 'completion', 'Record completions'),
  ('perm-tr-04', 'training', 'manage', 'course',     'Full training management'),
  -- Announcements
  ('perm-an-01', 'announcements', 'view',   'announcement', 'View announcements'),
  ('perm-an-02', 'announcements', 'create', 'announcement', 'Create announcements'),
  ('perm-an-03', 'announcements', 'manage', 'announcement', 'Full announcement management');

-- ── Roles ─────────────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO roles (id, tenant_id, name, description, is_system) VALUES
  ('role-super-admin',      'xavvy-tenant-001', 'super_admin',        'Full platform access',                         1),
  ('role-hr-admin',         'xavvy-tenant-001', 'hr_admin',           'HR, Leave, Recruitment, Compliance access',    1),
  ('role-manager',          'xavvy-tenant-001', 'manager',            'Team approval permissions',                    1),
  ('role-employee',         'xavvy-tenant-001', 'employee',           'Self-service access',                          1),
  ('role-compliance',       'xavvy-tenant-001', 'compliance_officer', 'Compliance and RTW management',                1),
  ('role-finance',          'xavvy-tenant-001', 'finance_admin',      'Expenses, timesheets and reporting',           1);

-- ── Role → Permission assignments ─────────────────────────────────────────────
-- super_admin gets everything via wildcard check in code (is_system=1 + name=super_admin)

-- hr_admin
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) SELECT 'role-hr-admin', id FROM permissions WHERE module_key IN ('hr','leave','recruitment','compliance') OR (module_key = 'documents' AND action IN ('view','create','manage'));

-- manager
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) SELECT 'role-manager', id FROM permissions WHERE (module_key = 'hr'          AND action = 'view'    AND resource = 'employee') OR (module_key = 'leave'       AND action IN ('view','approve')) OR (module_key = 'timesheets'  AND action IN ('view','approve')) OR (module_key = 'expenses'    AND action IN ('view','approve')) OR (module_key = 'pmo'         AND action IN ('view','create','edit')) OR (module_key = 'documents'   AND action = 'view') OR (module_key = 'announcements' AND action = 'view');

-- employee (self-service)
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) SELECT 'role-employee', id FROM permissions WHERE (module_key = 'leave'       AND action IN ('view','create')) OR (module_key = 'timesheets'  AND action IN ('view','create')) OR (module_key = 'expenses'    AND action IN ('view','create')) OR (module_key = 'documents'   AND action = 'view') OR (module_key = 'announcements' AND action = 'view') OR (module_key = 'training'    AND action IN ('view','record')) OR (module_key = 'pmo'         AND action IN ('view','edit'));

-- compliance_officer
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) SELECT 'role-compliance', id FROM permissions WHERE module_key IN ('compliance') OR (module_key = 'hr' AND action = 'view' AND resource = 'employee') OR (module_key = 'compliance' AND action = 'view' AND resource = 'audit_log');

-- finance_admin
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) SELECT 'role-finance', id FROM permissions WHERE module_key IN ('expenses') OR (module_key = 'timesheets' AND action IN ('view','approve','export'));

-- ── Org structure ─────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO organizational_units (id, tenant_id, parent_id, name, type, code)
VALUES ('unit-xavvy-001', 'xavvy-tenant-001', NULL, 'Xavvy', 'company', 'XAVVY');

INSERT OR IGNORE INTO departments (id, tenant_id, unit_id, name) VALUES
  ('dept-eng',     'xavvy-tenant-001', 'unit-xavvy-001', 'Engineering'),
  ('dept-hr',      'xavvy-tenant-001', 'unit-xavvy-001', 'HR'),
  ('dept-finance', 'xavvy-tenant-001', 'unit-xavvy-001', 'Finance'),
  ('dept-ops',     'xavvy-tenant-001', 'unit-xavvy-001', 'Operations'),
  ('dept-exec',    'xavvy-tenant-001', 'unit-xavvy-001', 'Executive');

INSERT OR IGNORE INTO designations (id, tenant_id, title, grade) VALUES
  ('des-001', 'xavvy-tenant-001', 'Junior Engineer',     'L2'),
  ('des-002', 'xavvy-tenant-001', 'Software Engineer',   'L3'),
  ('des-003', 'xavvy-tenant-001', 'Senior Engineer',     'L4'),
  ('des-004', 'xavvy-tenant-001', 'Lead Engineer',       'L5'),
  ('des-005', 'xavvy-tenant-001', 'Engineering Manager', 'L6'),
  ('des-006', 'xavvy-tenant-001', 'CTO',                 'L8'),
  ('des-007', 'xavvy-tenant-001', 'HR Manager',          'L4'),
  ('des-008', 'xavvy-tenant-001', 'Finance Analyst',     'L3'),
  ('des-009', 'xavvy-tenant-001', 'Operations Manager',  'L5');

PRAGMA foreign_keys = ON;

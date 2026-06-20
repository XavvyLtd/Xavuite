-- ============================================================
-- 021_permissions_complete.sql
-- Adds missing module permissions + role assignments
-- Run: wrangler d1 execute xavvysuite-fresh-db --local --file=schema/021_permissions_complete.sql
-- ============================================================

-- ── New permissions for modules that had none ─────────────────
INSERT OR IGNORE INTO permissions (id, module_key, action, resource, description) VALUES
  -- Onboarding
  ('perm-on-01', 'onboarding', 'view',   'onboarding', 'View onboarding records'),
  ('perm-on-02', 'onboarding', 'manage', 'onboarding', 'Manage onboarding process'),
  -- Offboarding
  ('perm-ob-01', 'offboarding', 'view',   'offboarding', 'View offboarding records'),
  ('perm-ob-02', 'offboarding', 'manage', 'offboarding', 'Manage offboarding process'),
  -- Checklists
  ('perm-ch-01', 'checklists', 'view',   'checklist', 'View checklists'),
  ('perm-ch-02', 'checklists', 'manage', 'checklist', 'Manage checklists and templates'),
  -- Visa
  ('perm-vi-01', 'visa', 'view',   'visa', 'View visa records'),
  ('perm-vi-02', 'visa', 'manage', 'visa', 'Manage visa records'),
  -- SOS / Incidents
  ('perm-so-01', 'sos', 'view',   'incident', 'View SOS incidents'),
  ('perm-so-02', 'sos', 'manage', 'incident', 'Manage SOS incidents'),
  -- Resources
  ('perm-rs-01', 'resources', 'view',   'resource', 'View resource planning'),
  ('perm-rs-02', 'resources', 'manage', 'resource', 'Manage resource bookings'),
  -- Reporting
  ('perm-rp-01', 'reporting', 'view',   'report', 'View reports'),
  ('perm-rp-02', 'reporting', 'view',   'financial_report', 'View financial reports'),
  -- Workflow
  ('perm-wf-01', 'workflow', 'view',   'workflow', 'View workflows'),
  ('perm-wf-02', 'workflow', 'manage', 'workflow', 'Manage workflow definitions'),
  -- Scheduler
  ('perm-sc-01', 'scheduler', 'view',   'job', 'View scheduled jobs'),
  ('perm-sc-02', 'scheduler', 'manage', 'job', 'Manage scheduled jobs'),
  -- Settings (split by sensitivity)
  ('perm-st-01', 'settings', 'view',   'settings',  'View settings'),
  ('perm-st-02', 'settings', 'manage', 'company',   'Manage company & statutory info'),
  ('perm-st-03', 'settings', 'manage', 'branding',  'Manage branding'),
  ('perm-st-04', 'settings', 'manage', 'security',  'Manage SSO, MFA, session settings'),
  ('perm-st-05', 'settings', 'manage', 'modules',   'Enable/disable modules'),
  -- Clients
  ('perm-cl-01', 'clients', 'view',   'client', 'View clients'),
  ('perm-cl-02', 'clients', 'create', 'client', 'Create clients'),
  ('perm-cl-03', 'clients', 'edit',   'client', 'Edit clients'),
  ('perm-cl-04', 'clients', 'delete', 'client', 'Delete/deactivate clients'),
  -- Invoicing
  ('perm-in-01', 'invoicing', 'view',   'invoice', 'View invoices'),
  ('perm-in-02', 'invoicing', 'create', 'invoice', 'Create invoices'),
  ('perm-in-03', 'invoicing', 'edit',   'invoice', 'Edit invoices'),
  ('perm-in-04', 'invoicing', 'send',   'invoice', 'Send invoices'),
  ('perm-in-05', 'invoicing', 'void',   'invoice', 'Void invoices'),
  -- Org chart (everyone can view)
  ('perm-oc-01', 'orgchart', 'view', 'orgchart', 'View org chart');

-- ── Role → new permission assignments ─────────────────────────

-- hr_admin: onboarding, offboarding, checklists, visa
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 'role-hr-admin', id FROM permissions
WHERE module_key IN ('onboarding','offboarding','checklists','visa','orgchart')
   OR (module_key = 'settings' AND action = 'manage' AND resource = 'company')
   OR (module_key = 'reporting' AND resource = 'report');

-- manager: view onboarding/offboarding, resources, reporting (non-financial)
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 'role-manager', id FROM permissions
WHERE (module_key IN ('onboarding','offboarding','checklists') AND action = 'view')
   OR (module_key = 'resources' AND action IN ('view','manage'))
   OR (module_key = 'reporting' AND resource = 'report')
   OR (module_key = 'sos' AND action = 'view')
   OR (module_key = 'orgchart');

-- employee: view org chart, submit SOS, view own reporting
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 'role-employee', id FROM permissions
WHERE (module_key = 'orgchart')
   OR (module_key = 'sos' AND action IN ('view','manage'))
   OR (module_key = 'onboarding' AND action = 'view')
   OR (module_key = 'checklists' AND action = 'view');

-- compliance_officer: visa, checklists
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 'role-compliance', id FROM permissions
WHERE module_key IN ('visa','checklists')
   OR (module_key = 'onboarding' AND action = 'view')
   OR (module_key = 'reporting' AND resource = 'report');

-- finance_admin: clients, invoicing, resources, financial reporting
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 'role-finance', id FROM permissions
WHERE module_key IN ('clients','invoicing')
   OR (module_key = 'resources' AND action = 'view')
   OR (module_key = 'reporting' AND action = 'view')
   OR (module_key = 'settings' AND action = 'manage' AND resource = 'company');

-- ── Assign roles to existing Xavvy employees ─────────────────
-- Nanjusha: manager role (she's PM/Lead)
INSERT OR IGNORE INTO user_roles (user_id, role_id, scope_type, granted_by, granted_at)
SELECT 'usr-nanjusha-001', 'role-manager', 'global',
  (SELECT id FROM users WHERE email='admin@xavvy.uk' LIMIT 1), datetime('now')
WHERE EXISTS (SELECT 1 FROM users WHERE id='usr-nanjusha-001');

-- Priya, Swathi, Zeba: employee role
INSERT OR IGNORE INTO user_roles (user_id, role_id, scope_type, granted_by, granted_at)
SELECT id, 'role-employee', 'global',
  (SELECT id FROM users WHERE email='admin@xavvy.uk' LIMIT 1), datetime('now')
FROM users WHERE id IN ('usr-priya-001','usr-swathi-001','usr-zeba-001');

-- Admin user: super_admin (already assigned but ensure it's there)
INSERT OR IGNORE INTO user_roles (user_id, role_id, scope_type, granted_by, granted_at)
SELECT u.id, 'role-super-admin', 'global', u.id, datetime('now')
FROM users u WHERE u.email = 'admin@xavvy.uk' AND u.tenant_id = 'xavvy-tenant-001';

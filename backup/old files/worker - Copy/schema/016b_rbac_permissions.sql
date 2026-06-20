-- ============================================================
-- 016b_rbac_permissions.sql
-- New permissions: Clients + Invoicing modules
-- Safe to re-run (INSERT OR IGNORE throughout)
-- ============================================================

-- ── 1. Insert the new permission rows ────────────────────────
INSERT OR IGNORE INTO permissions (id, module_key, action, resource, description) VALUES
  ('perm-clients-01', 'clients',   'view',   'client',  'View clients'),
  ('perm-clients-02', 'clients',   'create', 'client',  'Create clients'),
  ('perm-clients-03', 'clients',   'edit',   'client',  'Edit clients'),
  ('perm-clients-04', 'clients',   'delete', 'client',  'Deactivate clients'),
  ('perm-inv-01',     'invoicing', 'view',   'invoice', 'View invoices'),
  ('perm-inv-02',     'invoicing', 'create', 'invoice', 'Create invoices'),
  ('perm-inv-03',     'invoicing', 'edit',   'invoice', 'Edit draft invoices'),
  ('perm-inv-04',     'invoicing', 'send',   'invoice', 'Send invoices to clients'),
  ('perm-inv-05',     'invoicing', 'void',   'invoice', 'Void invoices');

-- ── 2. Grant to roles ─────────────────────────────────────────
-- super_admin / hr-admin: all clients + invoicing permissions
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT 'role-hr-admin', id FROM permissions
  WHERE module_key IN ('clients', 'invoicing');

-- manager: view + create + edit clients; view + create + edit + send invoices
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT 'role-manager', id FROM permissions
  WHERE (module_key = 'clients'   AND action IN ('view','create','edit'))
     OR (module_key = 'invoicing' AND action IN ('view','create','edit','send'));

-- finance: view clients; view + send invoices (mark paid handled server-side by send perm)
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT 'role-finance', id FROM permissions
  WHERE (module_key = 'clients'   AND action = 'view')
     OR (module_key = 'invoicing' AND action IN ('view','send'));

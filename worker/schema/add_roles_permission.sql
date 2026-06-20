-- ════════════════════════════════════════════════════════════
-- add_roles_permission.sql
-- Adds hr:manage:roles — gates the new employee-profile Role
-- Assignment tab. Flows automatically to role-hr-admin via the
-- existing bulk grant (WHERE module_key IN ('hr', ...)) and to
-- super_admin via the wildcard, matching super_admin + hr_admin
-- access as agreed. No new role or table needed.
-- ════════════════════════════════════════════════════════════

INSERT OR IGNORE INTO permissions (id, module_key, action, resource, description) VALUES
  ('perm-hr-08', 'hr', 'manage', 'roles', 'Assign and revoke employee roles');

-- role-hr-admin already SELECTs every permission WHERE module_key='hr',
-- so it picks up perm-hr-08 automatically the next time that grant runs.
-- Re-running it here is harmless (INSERT OR IGNORE) and makes the grant
-- immediate without waiting on anything else.
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 'role-hr-admin', id FROM permissions WHERE id = 'perm-hr-08';

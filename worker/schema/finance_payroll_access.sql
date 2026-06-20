-- ════════════════════════════════════════════════════════════
-- finance_payroll_access.sql
-- Grants role-finance (finance_admin) the existing hr:view:compensation
-- and hr:manage:compensation permissions so Finance users can use the
-- new Payroll Review page. No new permissions, roles, or tables created —
-- both perm-hr-06 and perm-hr-07 already exist in the permissions table.
-- ════════════════════════════════════════════════════════════

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
VALUES
  ('role-finance', 'perm-hr-06'),
  ('role-finance', 'perm-hr-07');

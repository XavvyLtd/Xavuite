-- Enables the new finance_payroll module key so it appears in the nav.
-- This is a tenant_modules toggle row, identical in nature to every other
-- module enablement already in production — not a schema change.
INSERT OR IGNORE INTO tenant_modules (id, tenant_id, module_key, enabled)
VALUES ('tm-p-finance-payroll', 'xavvy-tenant-001', 'finance_payroll', 1);

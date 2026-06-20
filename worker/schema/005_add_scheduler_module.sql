-- Add scheduler to tenant modules
INSERT OR IGNORE INTO tenant_modules (id, tenant_id, module_key, enabled)
VALUES ('mod-xavvy-15', 'xavvy-tenant-001', 'scheduler', 1);

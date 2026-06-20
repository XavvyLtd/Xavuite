-- Check admin user's permissions
SELECT '=== ADMIN USER ROLES ===' as section;
SELECT u.email, r.name as role_name, r.is_system
FROM users u
JOIN user_roles ur ON ur.user_id = u.id
JOIN roles r ON r.id = ur.role_id
WHERE u.tenant_id = 'xavvy-tenant-001' AND u.email = 'admin@xavvy.uk';

SELECT '=== ADMIN PERMISSIONS (sample) ===' as section;
SELECT p.module_key, p.action, p.resource
FROM users u
JOIN user_roles ur ON ur.user_id = u.id
JOIN role_permissions rp ON rp.role_id = ur.role_id
JOIN permissions p ON p.id = rp.permission_id
WHERE u.email = 'admin@xavvy.uk'
AND p.module_key = 'hr'
LIMIT 10;

SELECT '=== SUPER ADMIN CHECK ===' as section;
SELECT COUNT(*) as has_super_admin
FROM users u
JOIN user_roles ur ON ur.user_id = u.id
JOIN roles r ON r.id = ur.role_id
WHERE u.email = 'admin@xavvy.uk'
AND r.name = 'super_admin';
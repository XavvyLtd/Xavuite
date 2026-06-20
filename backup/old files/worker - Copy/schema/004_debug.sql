-- Run this and paste the output back
SELECT '=== USERS ===' as section;
SELECT id, email, status FROM users WHERE tenant_id = 'xavvy-tenant-001';

SELECT '=== EMPLOYEES ===' as section;
SELECT id, user_id, employee_number, status FROM employees WHERE tenant_id = 'xavvy-tenant-001';

SELECT '=== EMPLOYEE_HISTORY ===' as section;
SELECT employee_id, first_name, last_name, is_current, status FROM employee_history WHERE tenant_id = 'xavvy-tenant-001';

SELECT '=== HR QUERY (what the API runs) ===' as section;
SELECT e.id, e.status,
       eh.first_name, eh.last_name,
       u.email
FROM employees e
JOIN employee_history eh ON eh.employee_id = e.id AND eh.is_current = 1
JOIN users u ON u.id = e.user_id
WHERE e.tenant_id = 'xavvy-tenant-001';
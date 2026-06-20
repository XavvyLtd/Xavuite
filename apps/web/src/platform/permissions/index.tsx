/**
 * platform/permissions/index.ts
 * RBAC permission model — constants, hook, guard component.
 */

import { ReactNode } from 'react';
import { useAuth } from '../../context/AuthContext';

export type Permission = string;

export const PERMISSIONS = {
  HR_VIEW:       'hr:view:employee',
  HR_CREATE:     'hr:create:employee',
  HR_EDIT:       'hr:edit:employee',
  HR_DELETE:     'hr:delete:employee',
  HR_MANAGE:     'hr:manage:employee',
  COMP_VIEW:     'hr:view:compensation',
  COMP_MANAGE:   'hr:manage:compensation',
  HR_MANAGE_ROLES: 'hr:manage:roles',
  LEAVE_VIEW:    'leave:view:leave_request',
  LEAVE_CREATE:  'leave:create:leave_request',
  LEAVE_APPROVE: 'leave:approve:leave_request',
  LEAVE_POLICY:  'leave:manage:leave_policy',
  TS_VIEW:       'timesheets:view:timesheet',
  TS_CREATE:     'timesheets:create:timesheet',
  TS_APPROVE:    'timesheets:approve:timesheet',
  TS_EXPORT:     'timesheets:export:timesheet',
  EXP_VIEW:      'expenses:view:expense_claim',
  EXP_CREATE:    'expenses:create:expense_claim',
  EXP_APPROVE:   'expenses:approve:expense_claim',
  EXP_MANAGE:    'expenses:manage:expense_claim',
  COMP_RTW_VIEW:   'compliance:view:rtw_check',
  COMP_RTW_CREATE: 'compliance:create:rtw_check',
  COMP_RTW_MANAGE: 'compliance:manage:rtw_check',
  AUDIT_VIEW:      'compliance:view:audit_log',
  PMO_VIEW:    'pmo:view:project',
  PMO_CREATE:  'pmo:create:project',
  PMO_EDIT:    'pmo:edit:project',
  PMO_MANAGE:  'pmo:manage:project',
  TASK_VIEW:   'pmo:view:task',
  TASK_CREATE: 'pmo:create:task',
  TASK_EDIT:   'pmo:edit:task',
  JOBS_VIEW:   'recruitment:view:job_posting',
  JOBS_CREATE: 'recruitment:create:job_posting',
  JOBS_MANAGE: 'recruitment:manage:job_posting',
  DOCS_VIEW:   'documents:view:document',
  DOCS_CREATE: 'documents:create:document',
  DOCS_DELETE: 'documents:delete:document',
  DOCS_MANAGE: 'documents:manage:document',
  ASSETS_VIEW:   'assets:view:asset',
  ASSETS_CREATE: 'assets:create:asset',
  ASSETS_EDIT:   'assets:edit:asset',
  ASSETS_MANAGE: 'assets:manage:asset',
  TRAINING_VIEW:   'training:view:course',
  TRAINING_CREATE: 'training:create:course',
  TRAINING_RECORD: 'training:record:completion',
  TRAINING_MANAGE: 'training:manage:course',
  ANN_VIEW:   'announcements:view:announcement',
  ANN_CREATE: 'announcements:create:announcement',
  ANN_MANAGE: 'announcements:manage:announcement',
  CLIENT_VIEW:   'clients:view:client',
  CLIENT_CREATE: 'clients:create:client',
  CLIENT_EDIT:   'clients:edit:client',
  CLIENT_DELETE: 'clients:delete:client',
  INV_VIEW:      'invoicing:view:invoice',
  INV_CREATE:    'invoicing:create:invoice',
  INV_EDIT:      'invoicing:edit:invoice',
  INV_SEND:      'invoicing:send:invoice',
  INV_VOID:      'invoicing:void:invoice',
} as const;

// Standalone helper for components that receive ctx directly
export function isSuperAdmin(ctx: any): boolean {
  return ctx?.permissions?.includes('*:*:*') ?? false;
}

export function usePermission() {
  const { user } = useAuth();
  const perms = user?.permissions ?? [];
  const isSuperAdmin = perms.includes('*:*:*');
  const can    = (p: Permission) => isSuperAdmin || perms.includes(p);
  const canAny = (...ps: Permission[]) => ps.some(can);
  const canAll = (...ps: Permission[]) => ps.every(can);
  const ctx = { permissions: perms };
  return { can, canAny, canAll, isSuperAdmin, ctx };
}

export function PermissionGate({ permission, children, fallback = null }: {
  permission: Permission; children: ReactNode; fallback?: ReactNode;
}) {
  const { can } = usePermission();
  return can(permission) ? <>{children}</> : <>{fallback}</>;
}

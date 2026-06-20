/**
 * platform/routing/registry.ts
 *
 * Central route registry.
 * Routes are generated from module manifests — not hardcoded in App.tsx.
 *
 * TODO(tenancy): Filter routes by tenant.isModuleEnabled(key) at runtime.
 * TODO(licensing): Filter routes by plan entitlement before registering.
 */

import { lazy, ComponentType } from 'react';

export interface RouteDefinition {
  key:       string;
  path:      string;
  component: ComponentType;
  exact?:    boolean;
}

// Lazy-load all modules — code split per module
const moduleImports: Record<string, () => Promise<{ default: ComponentType }>> = {
  dashboard:    () => import('../../modules/dashboard/Dashboard'),
  hr:           () => import('../../modules/hr/HR'),
  leave:        () => import('../../modules/leave/Leave'),
  timesheets:   () => import('../../modules/timesheets/Timesheets'),
  expenses:     () => import('../../modules/expenses/Expenses'),
  compliance:   () => import('../../modules/compliance/Compliance'),
  pmo:          () => import('../../modules/pmo/PMO'),
  recruitment:  () => import('../../modules/recruitment/Recruitment'),
  documents:    () => import('../../modules/documents/Documents'),
  assets:       () => import('../../modules/assets/Assets'),
  training:     () => import('../../modules/training/Training'),
  announcements:() => import('../../modules/announcements/Announcements'),
  audit:        () => import('../../modules/audit/Audit'),
};

// Build route table from manifests
export function buildRoutes(enabledModuleKeys: string[]): RouteDefinition[] {
  return enabledModuleKeys
    .filter(key => moduleImports[key])
    .map(key => ({
      key,
      path:      `/${key}`,
      component: lazy(moduleImports[key]),
    }));
}

// Always-on routes (not tenant-configurable)
export const PLATFORM_ROUTES = ['dashboard', 'audit'] as const;

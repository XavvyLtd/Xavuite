/**
 * platform/tenancy/TenantContext.tsx
 *
 * Abstraction layer for multi-tenancy.
 * Currently wraps the shell data from AuthContext.
 *
 * TODO(tenancy): When Mode 1 (multi-tenant SaaS) is activated:
 *   - Load tenant config from /api/tenant/shell on subdomain resolution
 *   - Expose tenant_id to all API calls via this context
 *   - Drive module visibility from tenant_modules table
 *   - Drive branding from tenant_branding table
 *   - Enforce plan limits via PlanGuard checks in this context
 */

import { createContext, useContext, ReactNode } from 'react';
import { useAuth } from '../../context/AuthContext';

export interface TenantBranding {
  company_name:    string;
  primary_color:   string;
  secondary_color: string;
  logo_url?:       string;
  favicon_url?:    string;
}

export interface EnabledModule {
  key:    string;
  config: Record<string, unknown>;
}

export interface TenantConfig {
  id:       string;
  name:     string;
  domain:   string;
  plan:     string;           // TODO(tenancy): enforce plan limits per module
  branding: TenantBranding | null;
  modules:  EnabledModule[];
}

interface TenantContextValue {
  tenant:        TenantConfig | null;
  isModuleEnabled: (key: string) => boolean;
  loading:       boolean;
}

const TenantCtx = createContext<TenantContextValue | null>(null);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { shell, loading } = useAuth();

  const tenant: TenantConfig | null = shell ? {
    id:      shell.tenant.id,
    name:    shell.tenant.name,
    domain:  shell.tenant.domain,
    plan:    'enterprise', // TODO(tenancy): expose plan from /api/tenant/shell
    branding:shell.branding,
    modules: shell.modules,
  } : null;

  const isModuleEnabled = (key: string): boolean => {
    if (!tenant) return false;
    return tenant.modules.some(m => m.key === key);
  };

  return (
    <TenantCtx.Provider value={{ tenant, isModuleEnabled, loading }}>
      {children}
    </TenantCtx.Provider>
  );
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantCtx);
  if (!ctx) throw new Error('useTenant must be used within TenantProvider');
  return ctx;
}

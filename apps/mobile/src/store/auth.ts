import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { DEFAULT_API_BASE_URL } from '../config';

// ── Tenant config used throughout the app ─────────────────────────────────────
export interface TenantConfig {
  tenantId:     string;
  tenantName:   string;
  apiBase:      string;
  primaryColor: string;
  logoUrl:      string | null;
}

// Raw shape returned by GET /api/tenant/resolve — see worker index.ts.
// Kept separate from TenantConfig because the two have different field names
// and the worker doesn't (yet) return apiBase/primaryColor/logoUrl.
interface RawTenantResolveRow {
  id:        string;
  name:      string;
  subdomain: string | null;
  plan:      string;
  domain:    string;
}

// Maps the worker's response onto the shape the app actually uses.
// This is the ONE place to update if the worker's /api/tenant/resolve
// response shape changes.
function toTenantConfig(row: RawTenantResolveRow): TenantConfig {
  return {
    tenantId:     row.id,
    tenantName:   row.name,
    // The worker doesn't return a per-tenant API base today, so every
    // tenant shares DEFAULT_API_BASE_URL. If/when the worker starts
    // returning a per-tenant URL (e.g. a tenant-specific subdomain),
    // swap the line below for `row.apiBase ?? DEFAULT_API_BASE_URL`.
    apiBase:      DEFAULT_API_BASE_URL,
    primaryColor: '#6366F1',
    logoUrl:      null,
  };
}

// ── Auth store ────────────────────────────────────────────────────────────────
interface AuthState {
  tenant:       TenantConfig | null;
  accessToken:  string | null;
  refreshToken: string | null;
  user:         any | null;
  isLoading:    boolean;

  setTenant:    (t: TenantConfig) => void;
  setTokens:    (access: string, refresh: string) => Promise<void>;
  setUser:      (u: any) => void;
  logout:       () => Promise<void>;
  hydrate:      () => Promise<void>;
}

// Safe SecureStore wrapper — returns null instead of throwing/hanging
async function safeGet(key: string): Promise<string | null> {
  try {
    const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), 3000));
    const read    = SecureStore.getItemAsync(key);
    return await Promise.race([read, timeout]);
  } catch {
    return null;
  }
}

async function safeSet(key: string, value: string): Promise<void> {
  try { await SecureStore.setItemAsync(key, value); } catch { /* non-fatal */ }
}

async function safeDel(key: string): Promise<void> {
  try { await SecureStore.deleteItemAsync(key); } catch { /* non-fatal */ }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  tenant:       null,
  accessToken:  null,
  refreshToken: null,
  user:         null,
  isLoading:    true,

  setTenant: (t) => set({ tenant: t }),

  setTokens: async (access, refresh) => {
    await safeSet('xs_token',   access);
    await safeSet('xs_refresh', refresh);
    set({ accessToken: access, refreshToken: refresh });
  },

  setUser: (u) => set({ user: u }),

  logout: async () => {
    await safeDel('xs_token');
    await safeDel('xs_refresh');
    await safeDel('xs_tenant');
    set({ accessToken: null, refreshToken: null, user: null, tenant: null });
  },

  hydrate: async () => {
    try {
      const [token, refresh, tenantJson] = await Promise.all([
        safeGet('xs_token'),
        safeGet('xs_refresh'),
        safeGet('xs_tenant'),
      ]);
      const tenant = tenantJson ? JSON.parse(tenantJson) : null;
      set({ accessToken: token, refreshToken: refresh, tenant, isLoading: false });
    } catch {
      // Always unblock the UI
      set({ isLoading: false });
    }
  },
}));

// ── API client ────────────────────────────────────────────────────────────────
export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const { accessToken, tenant } = useAuthStore.getState();
  const base   = tenant?.apiBase ?? DEFAULT_API_BASE_URL;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const res  = await fetch(`${base}${path}`, { ...options, headers });
  const json = await res.json() as { ok: boolean; data?: T; error?: string };

  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      const { accessToken: newToken } = useAuthStore.getState();
      const res2  = await fetch(`${base}${path}`, { ...options, headers: { ...headers, Authorization: `Bearer ${newToken}` } });
      const json2 = await res2.json() as { ok: boolean; data?: T; error?: string };
      if (json2.ok) return json2.data as T;
    }
    useAuthStore.getState().logout();
    throw new Error('Session expired');
  }

  if (!json.ok) throw new Error(json.error ?? `Request failed: ${res.status}`);
  return json.data as T;
}

async function tryRefresh(): Promise<boolean> {
  try {
    const { refreshToken, tenant } = useAuthStore.getState();
    if (!refreshToken) return false;
    const base = tenant?.apiBase ?? DEFAULT_API_BASE_URL;
    const res  = await fetch(`${base}/api/auth/refresh`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ refreshToken }),
    });
    const json = await res.json() as any;
    if (!json.ok) return false;
    await useAuthStore.getState().setTokens(json.data.accessToken, json.data.refreshToken);
    return true;
  } catch { return false; }
}

// ── Tenant resolution ─────────────────────────────────────────────────────────
// Calls the PUBLIC GET /api/tenant/resolve?email=... endpoint (no auth token —
// this runs before the user has logged in). See worker index.ts lines ~191-227.
export async function resolveTenant(email: string): Promise<TenantConfig> {
  const res  = await fetch(
    `${DEFAULT_API_BASE_URL}/api/tenant/resolve?email=${encodeURIComponent(email)}`
  );
  const json = await res.json() as { ok: boolean; data?: { tenant: RawTenantResolveRow }; error?: string };
  if (!json.ok || !json.data?.tenant) throw new Error(json.error ?? 'Tenant not found');

  const config = toTenantConfig(json.data.tenant);
  await safeSet('xs_tenant', JSON.stringify(config));
  return config;
}

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';

const API_URL = import.meta.env.VITE_API_URL ?? 'https://api-v2.xavvy.uk';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface User {
  id:          string;
  email:       string;
  roles:       string[];
  permissions: string[];
  employeeId?: string;
}

export interface TenantShell {
  tenant:   { id: string; name: string; domain: string };
  branding: { company_name: string; primary_color: string; secondary_color: string; logo_url?: string } | null;
  modules:  Array<{ key: string; config: Record<string, unknown> }>;
}

interface AuthState {
  user:         User | null;
  accessToken:  string | null;
  shell:        TenantShell | null;
  loading:      boolean;
  login:        (email: string, password: string) => Promise<void>;
  logout:       () => void;
  hasPermission:(perm: string) => boolean;
  isSuperAdmin: () => boolean;
}

// ── API client ────────────────────────────────────────────────────────────────
export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  // 401 = session expired → clear tokens and reload to login
  if (res.status === 401 && token) {
    localStorage.removeItem('xs_token');
    localStorage.removeItem('xs_refresh');
    window.location.href = '/';
    throw new Error('Session expired — please sign in again');
  }

  const json = await res.json() as { ok: boolean; data?: T; error?: string };

  if (!res.ok || !json.ok) {
    throw new Error(json.error ?? `Request failed: ${res.status}`);
  }
  return json.data as T;
}

// ── Decode JWT expiry without a library ───────────────────────────────────────
function jwtExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp ?? null; // Unix seconds
  } catch {
    return null;
  }
}

// ── Context ───────────────────────────────────────────────────────────────────
const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]               = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(() => localStorage.getItem('xs_token'));
  const [refreshToken, setRefreshToken] = useState<string | null>(() => localStorage.getItem('xs_refresh'));
  const [shell, setShell]             = useState<TenantShell | null>(null);
  const [loading, setLoading]         = useState(true);

  // Ref so SessionGuard always reads the latest token without needing re-renders
  const accessTokenRef = useRef<string | null>(accessToken);
  useEffect(() => { accessTokenRef.current = accessToken; }, [accessToken]);

  // Apply branding CSS variables
  useEffect(() => {
    if (!shell?.branding) return;
    const root = document.documentElement;
    root.style.setProperty('--color-accent', shell.branding.primary_color);
    root.style.setProperty('--color-teal',   shell.branding.secondary_color);
    if (shell.branding.company_name) {
      document.title = shell.branding.company_name;
    }
  }, [shell]);

  // Load tenant shell (public)
  useEffect(() => {
    apiFetch<TenantShell>('/api/tenant/shell')
      .then(setShell)
      .catch(console.error);
  }, []);

  // Restore session on mount
  useEffect(() => {
    if (!accessToken) { setLoading(false); return; }
    apiFetch<{ user: User; roles: string[]; permissions: string[] }>('/api/me', {}, accessToken)
      .then(data => {
        setUser({ ...data.user, roles: data.roles, permissions: data.permissions });
      })
      .catch(() => {
        if (refreshToken) {
          apiFetch<{ accessToken: string; refreshToken: string }>(
            '/api/auth/refresh',
            { method: 'POST', body: JSON.stringify({ refreshToken }) },
            accessToken
          ).then(tokens => {
            localStorage.setItem('xs_token',   tokens.accessToken);
            localStorage.setItem('xs_refresh', tokens.refreshToken);
            setAccessToken(tokens.accessToken);
            setRefreshToken(tokens.refreshToken);
          }).catch(() => {
            localStorage.removeItem('xs_token');
            localStorage.removeItem('xs_refresh');
            setAccessToken(null);
            setRefreshToken(null);
          });
        } else {
          localStorage.removeItem('xs_token');
          setAccessToken(null);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiFetch<{
      accessToken: string;
      refreshToken: string;
      user: { id: string; email: string; roles: string[] };
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    localStorage.setItem('xs_token',   data.accessToken);
    localStorage.setItem('xs_refresh', data.refreshToken);
    setAccessToken(data.accessToken);
    setRefreshToken(data.refreshToken);

    const me = await apiFetch<{ user: User; roles: string[]; permissions: string[] }>(
      '/api/me', {}, data.accessToken
    );
    setUser({ ...me.user, roles: me.roles, permissions: me.permissions });
  }, []);

  const logout = useCallback(() => {
    if (accessToken) {
      fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
      }).catch(() => {});
    }
    localStorage.removeItem('xs_token');
    localStorage.removeItem('xs_refresh');
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
  }, [accessToken]);

  const doRefresh = useCallback(async () => {
    const rt = localStorage.getItem('xs_refresh');
    if (!rt) throw new Error('No refresh token');
    const tokens = await apiFetch<{ accessToken: string; refreshToken: string }>(
      '/api/auth/refresh',
      { method: 'POST', body: JSON.stringify({ refreshToken: rt }) },
      accessTokenRef.current
    );
    localStorage.setItem('xs_token',   tokens.accessToken);
    localStorage.setItem('xs_refresh', tokens.refreshToken);
    setAccessToken(tokens.accessToken);
    setRefreshToken(tokens.refreshToken);
    accessTokenRef.current = tokens.accessToken;
  }, []);

  const hasPermission = useCallback((perm: string): boolean => {
    if (!user?.permissions) return false;
    if (user.permissions.includes('*:*:*')) return true;
    return user.permissions.includes(perm);
  }, [user]);

  const isSuperAdmin = useCallback(() => {
    return user?.permissions?.includes('*:*:*') ?? false;
  }, [user]);

  return (
    <AuthCtx.Provider value={{ user, accessToken, shell, loading, login, logout, hasPermission, isSuperAdmin }}>
      {children}
      {/* Session guard — shows warning modal before token expires, silently refreshes */}
      {user && accessToken && (
        <SessionGuard
          getToken={() => accessTokenRef.current}
          onRefresh={doRefresh}
          onExpire={logout}
        />
      )}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// ── SessionGuard ──────────────────────────────────────────────────────────────
// Silently refreshes the access token 90s before expiry.
// If refresh fails, shows a countdown warning modal at 60s.
function SessionGuard({
  getToken,
  onRefresh,
  onExpire,
}: {
  getToken: () => string | null;
  onRefresh: () => Promise<void>;
  onExpire: () => void;
}) {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const refreshTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearAll = () => {
    if (refreshTimer.current)   clearTimeout(refreshTimer.current);
    if (warningTimer.current)   clearTimeout(warningTimer.current);
    if (countdownTimer.current) clearInterval(countdownTimer.current);
  };

  const showExpiryWarning = useCallback((remaining: number) => {
    setSecondsLeft(Math.max(1, remaining));
    setShowWarning(true);
    if (countdownTimer.current) clearInterval(countdownTimer.current);
    countdownTimer.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          clearInterval(countdownTimer.current!);
          setShowWarning(false);
          onExpire();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }, [onExpire]);

  const schedule = useCallback(() => {
    clearAll();
    const token = getToken();
    if (!token) return;
    const exp = jwtExpiry(token);
    if (!exp) return;
    const nowSecs = Math.floor(Date.now() / 1000);
    const ttl = exp - nowSecs;
    if (ttl <= 0) { onExpire(); return; }

    // Silent refresh 90s before expiry
    const refreshIn = Math.max(0, (ttl - 90) * 1000);
    refreshTimer.current = setTimeout(async () => {
      try {
        await onRefresh();
        schedule(); // reschedule with new token
        setShowWarning(false);
        if (countdownTimer.current) clearInterval(countdownTimer.current);
      } catch {
        // Refresh failed — show warning at 60s
        showExpiryWarning(Math.min(60, ttl - 90 + 60));
      }
    }, refreshIn);

    // Fallback warning 60s before expiry (fires if refresh wasn't attempted or was too early)
    if (ttl > 60) {
      warningTimer.current = setTimeout(() => {
        showExpiryWarning(60);
      }, (ttl - 60) * 1000);
    } else if (ttl > 0) {
      showExpiryWarning(ttl);
    }
  }, [getToken, onRefresh, onExpire, showExpiryWarning]);

  useEffect(() => {
    schedule();
    return clearAll;
  }, [schedule]);

  // Re-schedule when user returns to tab
  useEffect(() => {
    const onVisible = () => { if (!document.hidden) schedule(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [schedule]);

  async function handleStayLoggedIn() {
    try {
      await onRefresh();
      setShowWarning(false);
      if (countdownTimer.current) clearInterval(countdownTimer.current);
      schedule();
    } catch {
      onExpire();
    }
  }

  if (!showWarning) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--card, #1e1e2e)', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16, padding: '36px 40px', width: '100%', maxWidth: 400,
        textAlign: 'center', boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
      }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⏱</div>
        <h2 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 700, color: 'var(--text, #fff)' }}>
          Session expiring soon
        </h2>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--muted, #aaa)', lineHeight: 1.6 }}>
          You'll be logged out in{' '}
          <strong style={{ color: secondsLeft < 15 ? '#ef4444' : 'var(--text, #fff)' }}>
            {secondsLeft}s
          </strong>{' '}
          due to inactivity. Any unsaved data on this screen may be lost.
        </p>

        {/* Countdown ring */}
        <div style={{ margin: '0 auto 28px', width: 64, height: 64, position: 'relative' }}>
          <svg width={64} height={64} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={32} cy={32} r={28} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={4} />
            <circle
              cx={32} cy={32} r={28} fill="none"
              stroke={secondsLeft < 15 ? '#ef4444' : '#6366f1'}
              strokeWidth={4}
              strokeDasharray={175.9}
              strokeDashoffset={175.9 * (1 - secondsLeft / 60)}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }}
            />
          </svg>
          <span style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 18, fontWeight: 700,
            color: secondsLeft < 15 ? '#ef4444' : 'var(--text, #fff)',
          }}>
            {secondsLeft}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            onClick={onExpire}
            style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', cursor: 'pointer', fontSize: 14, color: 'var(--muted, #aaa)' }}
          >
            Log out now
          </button>
          <button
            onClick={handleStayLoggedIn}
            style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}
          >
            Stay logged in
          </button>
        </div>
      </div>
    </div>
  );
}

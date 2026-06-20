import Constants from 'expo-constants';

/**
 * Single source of truth for the worker's base URL.
 *
 * Priority (highest wins):
 *   1. EXPO_PUBLIC_API_BASE_URL  — set at build time, e.g. via `eas.json` env vars
 *      or a local `.env` file picked up by Expo's env system. Easiest way to
 *      point a build at a different worker without touching code.
 *   2. extra.apiBaseUrl in app.json — the checked-in default.
 *   3. Hardcoded fallback below — last resort if neither is set.
 *
 * To point the whole app at a new worker URL, change ONE of:
 *   - app.json → expo.extra.apiBaseUrl
 *   - or set EXPO_PUBLIC_API_BASE_URL as an env var before `eas build` / `expo start`
 *
 * Per-tenant override: when /api/tenant/resolve returns a tenant-specific
 * apiBase (e.g. a per-tenant worker subdomain), that value takes precedence
 * for all requests *after* login — see resolveTenant() in store/auth.ts.
 */
const FALLBACK_API_BASE = 'https://api-v2.xavvy.uk';

export const DEFAULT_API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ??
  FALLBACK_API_BASE;

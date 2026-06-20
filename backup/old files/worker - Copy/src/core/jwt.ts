import { SignJWT, jwtVerify } from 'jose';
import type { JWTPayload, Env } from '../types';

const ALG = 'HS256';
const DEFAULT_ACCESS_TTL = 60 * 60;           // 60 min default (was 15 min hard-coded)
const REFRESH_TTL        = 7 * 24 * 60 * 60;  // 7 days — unchanged

function secret(env: Env) {
  return new TextEncoder().encode(env.JWT_SECRET);
}

// tenant_settings is a key/value table: SELECT value WHERE key = 'session_timeout_minutes'
// Cache in KV for 5 min so we don't hit D1 on every request
async function getAccessTTL(tenantId: string, env: Env): Promise<number> {
  if (!tenantId) return DEFAULT_ACCESS_TTL;
  const cacheKey = `tenant_session_ttl:${tenantId}`;
  try {
    const cached = await env.KV.get(cacheKey);
    if (cached) return parseInt(cached, 10);

    const row = await env.DB.prepare(
      `SELECT value FROM tenant_settings WHERE tenant_id = ? AND key = 'session_timeout_minutes' LIMIT 1`
    ).bind(tenantId).first<{ value: string }>();

    const mins    = row?.value ? parseInt(row.value, 10) : 60;
    const ttlSecs = (isNaN(mins) || mins < 1 ? 60 : mins) * 60;
    await env.KV.put(cacheKey, String(ttlSecs), { expirationTtl: 300 });
    return ttlSecs;
  } catch {
    return DEFAULT_ACCESS_TTL;
  }
}

export async function signAccessToken(
  payload: Omit<JWTPayload, 'iat' | 'exp'>,
  env: Env
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const ttl = await getAccessTTL(payload.tid as string, env);
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt(now)
    .setExpirationTime(now + ttl)
    .sign(secret(env));
}

export async function verifyAccessToken(token: string, env: Env): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret(env));
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function issueRefreshToken(userId: string, tenantId: string, env: Env): Promise<string> {
  const jti = crypto.randomUUID();
  const key = `refresh:${tenantId}:${userId}:${jti}`;
  await env.KV.put(key, userId, { expirationTtl: REFRESH_TTL });
  return jti;
}

export async function consumeRefreshToken(
  userId: string, tenantId: string, jti: string, env: Env
): Promise<boolean> {
  const key    = `refresh:${tenantId}:${userId}:${jti}`;
  const stored = await env.KV.get(key);
  if (!stored) return false;
  await env.KV.delete(key);
  return true;
}

export async function revokeAllRefreshTokens(userId: string, tenantId: string, env: Env): Promise<void> {
  const list = await env.KV.list({ prefix: `refresh:${tenantId}:${userId}:` });
  await Promise.all(list.keys.map(k => env.KV.delete(k.name)));
}

export function extractBearerToken(request: Request): string | null {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

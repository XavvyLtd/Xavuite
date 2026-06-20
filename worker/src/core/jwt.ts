import { SignJWT, jwtVerify } from 'jose';
import type { JWTPayload, Env } from '../types';

const ALG = 'HS256';
const ACCESS_TTL  = 15 * 60;        // 15 minutes
const REFRESH_TTL = 7 * 24 * 60 * 60; // 7 days

function secret(env: Env) {
  return new TextEncoder().encode(env.JWT_SECRET);
}

export async function signAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>, env: Env): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt(now)
    .setExpirationTime(now + ACCESS_TTL)
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

// Refresh tokens stored in KV: refresh:{tenantId}:{userId}:{jti} → userId
export async function issueRefreshToken(userId: string, tenantId: string, env: Env): Promise<string> {
  const jti = crypto.randomUUID();
  const key = `refresh:${tenantId}:${userId}:${jti}`;
  await env.KV.put(key, userId, { expirationTtl: REFRESH_TTL });
  return jti;
}

export async function consumeRefreshToken(
  userId: string, tenantId: string, jti: string, env: Env
): Promise<boolean> {
  const key = `refresh:${tenantId}:${userId}:${jti}`;
  const stored = await env.KV.get(key);
  if (!stored) return false;
  await env.KV.delete(key); // single-use
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

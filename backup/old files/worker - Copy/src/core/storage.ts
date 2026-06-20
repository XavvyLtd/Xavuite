import type { Env } from '../types';

export function storageKey(tenantId: string, module: string, id: string, filename: string): string {
  return `${tenantId}/${module}/${id}/${filename}`;
}

export async function uploadFile(
  env: Env,
  key: string,
  body: ArrayBuffer | ReadableStream,
  contentType: string
): Promise<string> {
  if (!env.STORE) {
    // R2 not bound — store key as reference only (file content not persisted)
    console.warn('[storage] STORE (R2) binding not configured — file metadata saved but content not stored');
    return key;
  }
  await env.STORE.put(key, body, {
    httpMetadata: { contentType },
  });
  return key;
}

export async function deleteFile(env: Env, key: string): Promise<void> {
  await env.STORE.delete(key);
}

export async function getSignedDownloadUrl(
  env: Env,
  key: string,
  expiresInSeconds = 3600
): Promise<string | null> {
  if (!env.STORE) return null;
  const obj = await env.STORE.get(key);
  if (!obj) return null;
  // Cloudflare R2 presigned URL via Workers binding
  // Using a signed fetch pattern — R2 public bucket URL + signed token in KV
  const token = crypto.randomUUID();
  await env.KV.put(`download:${token}`, key, { expirationTtl: expiresInSeconds });
  return `/api/files/download/${token}`;
}

export async function resolveDownloadToken(env: Env, token: string): Promise<string | null> {
  const key = await env.KV.get(`download:${token}`);
  if (!key) return null;
  await env.KV.delete(`download:${token}`); // single-use
  return key;
}

export async function streamFile(env: Env, key: string): Promise<Response | null> {
  if (!env.STORE) return null;
  if (!env.STORE) return null;
  const obj = await env.STORE.get(key);
  if (!obj) return null;
  return new Response(obj.body, {
    headers: {
      'Content-Type': obj.httpMetadata?.contentType ?? 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${key.split('/').pop()}"`,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}

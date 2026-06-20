import { ok, err } from '../../core/response';
import type { Env, AppContext } from '../../types';

const ALLOWED_TYPES: Record<string, string[]> = {
  cv:      ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  photo:   ['image/jpeg', 'image/png', 'image/webp'],
  document:['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
};

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function handleStorage(
  request: Request, env: Env, ctx: AppContext, subPath: string
): Promise<Response> {
  const [action] = subPath.split('/').filter(Boolean);

  // POST /api/storage/upload
  if (action === 'upload' && request.method === 'POST') {
    if (!env.STORE) return err('Storage not configured');

    const formData = await request.formData();
    const file     = formData.get('file') as File | null;
    const path     = (formData.get('path') as string) ?? 'uploads';

    if (!file) return err('No file provided');
    if (file.size > MAX_SIZE) return err('File too large — maximum 10MB');

    // Determine file category from path
    const category = path.split('/')[0] ?? 'document';
    const allowed  = ALLOWED_TYPES[category] ?? ALLOWED_TYPES.document;
    if (!allowed.includes(file.type)) {
      return err(`File type ${file.type} not allowed for ${category}`);
    }

    const ext      = file.name.split('.').pop() ?? 'bin';
    const key      = `${ctx.tenantId}/${path}/${crypto.randomUUID()}.${ext}`;
    const bytes    = await file.arrayBuffer();

    await env.STORE.put(key, bytes, {
      httpMetadata: { contentType: file.type },
      customMetadata: {
        originalName: file.name,
        uploadedBy:   ctx.userId,
        tenantId:     ctx.tenantId,
      },
    });

    // Store reference in DB if it's a document
    const url = `/api/storage/file/${key}`;
    return ok({ key, url, originalName: file.name, size: file.size, contentType: file.type });
  }

  // GET /api/storage/file/:key — serve file
  if (action === 'file' && request.method === 'GET') {
    const key = subPath.replace('/file/', '');
    if (!key.startsWith(ctx.tenantId + '/')) return err('Access denied', 403);

    if (!env.STORE) return err('Storage not configured');
    const obj = await env.STORE.get(key);
    if (!obj) return err('File not found', 404);

    const headers = new Headers();
    obj.writeHttpMetadata(headers);
    headers.set('Cache-Control', 'private, max-age=3600');
    return new Response(obj.body, { headers });
  }

  // DELETE /api/storage/file/:key
  if (action === 'file' && request.method === 'DELETE') {
    const key = subPath.replace('/file/', '');
    if (!key.startsWith(ctx.tenantId + '/')) return err('Access denied', 403);
    if (env.STORE) await env.STORE.delete(key);
    return ok({ deleted: true });
  }

  return err('Not found', 404);
}

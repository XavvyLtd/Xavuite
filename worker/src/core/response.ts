const ALLOWED_ORIGINS = [
  'https://app.xavvy.uk',
  'https://xavvysuite-core-app.pages.dev',
  'https://xavvysuite-app.pages.dev',
  'https://hr.xavvy.uk',
  'https://timesheet.xavvy.uk',
  'https://projects.xavvy.uk',
  'http://localhost:3000',
  'http://localhost:5173',
];

export function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('Origin') ?? '';
  // Allow any pages.dev subdomain for Cloudflare Pages previews
  const isAllowed = ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.pages.dev');
  const allow = isAllowed ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };
}

export function ok<T>(data: T, status = 200, extra?: HeadersInit): Response {
  return Response.json({ ok: true, data }, { status, headers: extra });
}

export function created<T>(data: T): Response {
  return Response.json({ ok: true, data }, { status: 201 });
}

export function noContent(): Response {
  return new Response(null, { status: 204 });
}

export function err(message: string, status = 400, code?: string): Response {
  return Response.json({ ok: false, error: message, ...(code ? { code } : {}) }, { status });
}

export function unauthorized(msg = 'Unauthorized'): Response {
  return err(msg, 401, 'UNAUTHORIZED');
}

export function forbidden(msg = 'Forbidden'): Response {
  return err(msg, 403, 'FORBIDDEN');
}

export function notFound(msg = 'Not found'): Response {
  return err(msg, 404, 'NOT_FOUND');
}

export function handleOptions(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export function withCors(response: Response, request: Request): Response {
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders(request)).forEach(([k, v]) => headers.set(k, v));
  return new Response(response.body, { status: response.status, headers });
}

export function paginate<T>(items: T[], total: number, page: number, limit: number) {
  return {
    items,
    meta: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    },
  };
}

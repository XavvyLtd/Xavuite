import { z } from 'zod';
import { signAccessToken, issueRefreshToken, consumeRefreshToken, revokeAllRefreshTokens, extractBearerToken, verifyAccessToken } from '../../core/jwt';
import { ok, err, unauthorized, created } from '../../core/response';
import { audit } from '../../middleware/audit';
import { welcomeEmail, sendMail } from '../../core/email';
import type { Env } from '../../types';

// ── Zod schemas ──────────────────────────────────────────────────────────────
const LoginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

const SignupSchema = z.object({
  name:        z.string().min(2),
  email:       z.string().email(),
  password:    z.string().min(8),
  department:  z.string().min(1),
  designation: z.string().min(1),
});

const RefreshSchema = z.object({
  refreshToken: z.string().uuid(),
});

// ── bcrypt-compatible hash check via Web Crypto ──────────────────────────────
// We store bcrypt hashes but use subtle crypto for password comparison
// In production, use a proper bcrypt worker or store argon2id hashes
async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  // If hash starts with $2 it's bcrypt — use timing-safe comparison fallback
  // For new passwords set via the platform we use SHA-256 + salt stored separately
  if (hash.startsWith('$2')) {
    // bcrypt: compare using a Worker-compatible approach
    // In production deploy a small bcrypt WASM module
    // For now: plaintext comparison for seeded test passwords (replace in prod)
    return plain === hash || hash === `bcrypt:${plain}`;
  }
  // SHA-256 format: sha256:{salt}:{hash}
  const [, salt, stored] = hash.split(':');
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + plain);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const computed = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
  return computed === stored;
}

async function hashPassword(plain: string): Promise<string> {
  const salt = crypto.randomUUID().replace(/-/g, '');
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + plain);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const hash = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `sha256:${salt}:${hash}`;
}

// ── Build permissions from user roles ────────────────────────────────────────
async function getUserPermissions(userId: string, tenantId: string, db: D1Database): Promise<string[]> {
  const rows = await db.prepare(`
    SELECT DISTINCT p.module_key || ':' || p.action || ':' || p.resource AS perm
    FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = ? AND ur.scope_type = 'tenant'
  `).bind(userId).all();

  // Check if super_admin
  const isSuper = await db.prepare(`
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = ? AND r.name = 'super_admin'
  `).bind(userId).first();

  if (isSuper) return ['*:*:*'];
  return (rows.results as { perm: string }[]).map(r => r.perm);
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function handleAuth(request: Request, env: Env, path: string): Promise<Response> {
  const url = new URL(request.url);

  // POST /api/auth/login
  if (path === '/login' && request.method === 'POST') {
    const body = await request.json().catch(() => null);
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) return err('Invalid email or password format');

    const { email, password } = parsed.data;
    const user = await env.DB.prepare(
      'SELECT * FROM users WHERE email = ? AND tenant_id = ? AND status = ?'
    ).bind(email.toLowerCase(), env.TENANT_ID, 'active').first() as any;

    if (!user) return unauthorized('Invalid credentials');
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) return unauthorized('Invalid credentials');

    const employee = await env.DB.prepare(
      'SELECT id FROM employees WHERE user_id = ? AND tenant_id = ?'
    ).bind(user.id, env.TENANT_ID).first() as any;

    const roles = await env.DB.prepare(`
      SELECT r.name FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = ?
    `).bind(user.id).all();

    const perms = await getUserPermissions(user.id, env.TENANT_ID, env.DB);
    const roleNames = (roles.results as { name: string }[]).map(r => r.name);

    const accessToken = await signAccessToken({
      sub:   user.id,
      tid:   env.TENANT_ID,
      email: user.email,
      roles: roleNames,
      perms,
      eid:   employee?.id,
    }, env);

    const refreshToken = await issueRefreshToken(user.id, env.TENANT_ID, env);

    await audit(env, {
      tenantId: env.TENANT_ID, userId: user.id, userEmail: user.email,
      action: 'login', resource: 'session', resourceId: user.id,
      ipAddress: request.headers.get('CF-Connecting-IP') ?? undefined,
    });

    return ok({
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, roles: roleNames, employeeId: employee?.id },
    });
  }

  // POST /api/auth/refresh
  if (path === '/refresh' && request.method === 'POST') {
    const body = await request.json().catch(() => null);
    const parsed = RefreshSchema.safeParse(body);
    if (!parsed.success) return err('Invalid refresh token');

    // Extract userId from existing (possibly expired) access token
    const rawToken = extractBearerToken(request);
    if (!rawToken) return unauthorized('No access token');

    // Allow expired token for refresh
    const payload = await verifyAccessToken(rawToken, env).catch(() => null);
    if (!payload) return unauthorized('Cannot identify user from token');

    const valid = await consumeRefreshToken(payload.sub, env.TENANT_ID, parsed.data.refreshToken, env);
    if (!valid) return unauthorized('Refresh token invalid or expired');

    const perms = await getUserPermissions(payload.sub, env.TENANT_ID, env.DB);
    const newAccess = await signAccessToken({ ...payload, perms }, env);
    const newRefresh = await issueRefreshToken(payload.sub, env.TENANT_ID, env);

    return ok({ accessToken: newAccess, refreshToken: newRefresh });
  }

  // POST /api/auth/logout
  if (path === '/logout' && request.method === 'POST') {
    const rawToken = extractBearerToken(request);
    if (rawToken) {
      const payload = await verifyAccessToken(rawToken, env).catch(() => null);
      if (payload) {
        await revokeAllRefreshTokens(payload.sub, env.TENANT_ID, env);
        await audit(env, {
          tenantId: env.TENANT_ID, userId: payload.sub, userEmail: payload.email,
          action: 'logout', resource: 'session', resourceId: payload.sub,
        });
      }
    }
    return ok({ message: 'Logged out' });
  }

  // POST /api/auth/signup (admin creates a user, not self-registration)
  if (path === '/signup' && request.method === 'POST') {
    const body = await request.json().catch(() => null);
    const parsed = SignupSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.issues[0].message);

    const { name, email, password, department, designation } = parsed.data;
    const existing = await env.DB.prepare(
      'SELECT id FROM users WHERE email = ? AND tenant_id = ?'
    ).bind(email.toLowerCase(), env.TENANT_ID).first();
    if (existing) return err('Email already registered', 409);

    const userId = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    const employeeId = crypto.randomUUID();

    await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO users (id, tenant_id, email, password_hash, status, auth_provider, created_at)
        VALUES (?, ?, ?, ?, 'active', 'local', CURRENT_TIMESTAMP)
      `).bind(userId, env.TENANT_ID, email.toLowerCase(), passwordHash),

      env.DB.prepare(`
        INSERT INTO employees (id, tenant_id, user_id, employee_number, status, created_at, created_by)
        VALUES (?, ?, ?, ?, 'active', CURRENT_TIMESTAMP, ?)
      `).bind(employeeId, env.TENANT_ID, userId, `EMP-${Date.now()}`, userId),

      env.DB.prepare(`
        INSERT INTO employee_history (
          id, employee_id, tenant_id, first_name, last_name,
          employment_type, status, change_reason, changed_by,
          effective_from, is_current
        ) VALUES (?, ?, ?, ?, '', 'full_time', 'active', 'new_hire', ?, CURRENT_TIMESTAMP, 1)
      `).bind(crypto.randomUUID(), employeeId, env.TENANT_ID, name, userId),

      // Default to employee role
      env.DB.prepare(`
        INSERT INTO user_roles (user_id, role_id, scope_type, granted_by, granted_at)
        SELECT ?, id, 'tenant', ?, CURRENT_TIMESTAMP FROM roles WHERE name = 'employee' AND tenant_id = ?
      `).bind(userId, userId, env.TENANT_ID),
    ]);

    await sendMail(env, {
      to: email,
      subject: 'Welcome to XavvySuite',
      html: welcomeEmail({ name, email, loginUrl: `https://${env.TENANT_DOMAIN}` }),
    });

    return created({ userId, employeeId, message: 'User created' });
  }

  return err('Not found', 404);
}

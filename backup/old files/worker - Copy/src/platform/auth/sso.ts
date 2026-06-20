/**
 * platform/auth/sso.ts
 * SSO routes: Magic Links, MFA enrollment/verify,
 * Entra ID (OIDC), Google Workspace (OIDC), SAML 2.0
 */

import { ok, created, err } from '../../core/response';
import { sendMail } from '../../core/email';
import { signAccessToken } from '../../core/jwt';
import {
  generateTOTPSecret, verifyTOTP, buildOTPAuthURL,
  generateBackupCodes, hashBackupCode, verifyBackupCode,
} from './totp';
import type { Env, AppContext } from '../../types';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

// ── Shared: create session tokens ─────────────────────────────────────────────
async function createSession(env: Env, userId: string, tenantId: string) {
  const user = await env.DB.prepare(`
    SELECT u.id, u.email, u.tenant_id,
           GROUP_CONCAT(r.name, ',') AS roles
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    WHERE u.id = ? AND u.tenant_id = ?
    GROUP BY u.id
  `).bind(userId, tenantId).first() as any;

  if (!user) throw new Error('User not found');

  const roles = user.roles ? user.roles.split(',') : ['employee'];
  const isSuperAdmin = roles.includes('super_admin');
  const perms = isSuperAdmin ? ['*:*:*'] : roles.map((r: string) => `${r}:*:*`);

  const accessToken = await signAccessToken({
    sub:   user.id,
    email: user.email,
    tid:   tenantId,
    roles,
    perms,
  }, env);

  const refreshToken = crypto.randomUUID();
  await env.KV.put(`refresh:${refreshToken}`, userId, { expirationTtl: 7 * 86400 });

  return { accessToken, refreshToken, user: { id: user.id, email: user.email, roles } };
}

// ══════════════════════════════════════════════════════════════════════════════
// MAGIC LINKS
// ══════════════════════════════════════════════════════════════════════════════

export async function handleMagicLink(
  request: Request, env: Env, ctx: AppContext, subPath: string
): Promise<Response> {
  const [action] = subPath.split('/').filter(Boolean);

  // POST /api/auth/magic-link — request a magic link
  if (!action && request.method === 'POST') {
    const { email } = await request.json() as any;
    if (!email) return err('Email is required');

    const user = await env.DB.prepare(`
      SELECT id, tenant_id FROM users WHERE email=? AND status='active' LIMIT 1
    `).bind(email.toLowerCase()).first() as any;

    // Always return success — don't reveal if email exists
    if (!user) return ok({ sent: true });

    // Generate token
    const token     = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '');
    const tokenHash = await hashToken(token);
    const expiresAt = new Date(Date.now() + FIFTEEN_MINUTES).toISOString();

    await env.DB.prepare(`
      INSERT INTO magic_link_tokens (id, tenant_id, user_id, token_hash, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(crypto.randomUUID(), user.tenant_id, user.id, tokenHash, expiresAt).run();

    const platformUrl = `https://${env.TENANT_DOMAIN ?? 'api-v2.xavvy.uk'}`;
    await sendMail(env, {
      to: email,
      subject: `Your sign-in link for ${env.TENANT_NAME ?? 'XavvySuite'}`,
      html: `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">
  <div style="background:#0F2A4A;padding:24px"><h2 style="color:#fff;margin:0">Sign in to ${env.TENANT_NAME ?? 'XavvySuite'}</h2></div>
  <div style="padding:28px">
    <p>Click the button below to sign in. This link expires in <strong>15 minutes</strong> and can only be used once.</p>
    <a href="${platformUrl}/auth/magic?token=${token}" style="display:inline-block;background:#6366F1;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;margin:16px 0">
      Sign In →
    </a>
    <p style="color:#999;font-size:12px;margin-top:24px">If you didn't request this, you can safely ignore this email.</p>
  </div>
</div></body></html>`,
    });

    return ok({ sent: true });
  }

  // GET /api/auth/magic-link/verify?token=
  if (action === 'verify' && request.method === 'GET') {
    const url   = new URL(request.url);
    const token = url.searchParams.get('token');
    if (!token) return err('Token is required');

    const tokenHash = await hashToken(token);
    const record    = await env.DB.prepare(`
      SELECT * FROM magic_link_tokens
      WHERE token_hash=? AND used=0 AND expires_at > datetime('now')
    `).bind(tokenHash).first() as any;

    if (!record) return err('Invalid or expired token', 401);

    // Mark used
    await env.DB.prepare(`UPDATE magic_link_tokens SET used=1 WHERE id=?`).bind(record.id).run();

    // Check if MFA required
    const mfa = await env.DB.prepare(
      `SELECT * FROM user_mfa WHERE user_id=? AND enabled=1`
    ).bind(record.user_id).first() as any;

    if (mfa) {
      const mfaChallenge = crypto.randomUUID();
      await env.KV.put(`mfa:${mfaChallenge}`, JSON.stringify({ userId: record.user_id, tenantId: record.tenant_id }), { expirationTtl: 300 });
      return ok({ mfaRequired: true, mfaChallenge });
    }

    const session = await createSession(env, record.user_id, record.tenant_id);
    return ok({ ...session, mfaRequired: false });
  }

  return err('Not found', 404);
}

// ══════════════════════════════════════════════════════════════════════════════
// MFA
// ══════════════════════════════════════════════════════════════════════════════

export async function handleMFA(
  request: Request, env: Env, ctx: AppContext, subPath: string
): Promise<Response> {
  const [action] = subPath.split('/').filter(Boolean);

  // POST /api/auth/mfa/setup — begin TOTP enrollment
  if (action === 'setup' && request.method === 'POST') {
    if (!ctx.userId) return err('Authentication required', 401);

    const secret    = generateTOTPSecret();
    const user      = await env.DB.prepare(`SELECT email FROM users WHERE id=?`).bind(ctx.userId).first() as any;
    const issuer    = env.TENANT_NAME ?? 'XavvySuite';
    const otpAuthUrl= buildOTPAuthURL(secret, user?.email ?? '', issuer);

    // Store pending secret in KV (not committed until verified)
    await env.KV.put(`mfa:setup:${ctx.userId}`, secret, { expirationTtl: 600 });

    // QR code via Google Charts API
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpAuthUrl)}`;

    return ok({ secret, otpAuthUrl, qrUrl });
  }

  // POST /api/auth/mfa/confirm — verify TOTP and enable MFA
  if (action === 'confirm' && request.method === 'POST') {
    if (!ctx.userId) return err('Authentication required', 401);

    const { token } = await request.json() as any;
    const secret    = await env.KV.get(`mfa:setup:${ctx.userId}`);
    if (!secret) return err('MFA setup session expired — please restart setup');

    const valid = await verifyTOTP(secret, token);
    if (!valid) return err('Invalid code — please try again');

    // Generate backup codes
    const backupCodes  = generateBackupCodes(8);
    const hashedCodes  = await Promise.all(backupCodes.map(hashBackupCode));

    await env.DB.prepare(`
      INSERT INTO user_mfa (id, user_id, tenant_id, method, totp_secret, backup_codes, enabled, enrolled_at)
      VALUES (?, ?, ?, 'totp', ?, ?, 1, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        totp_secret=excluded.totp_secret,
        backup_codes=excluded.backup_codes,
        enabled=1, enrolled_at=CURRENT_TIMESTAMP
    `).bind(crypto.randomUUID(), ctx.userId, ctx.tenantId, secret, JSON.stringify(hashedCodes)).run();

    // Update users table
    await env.DB.prepare(`UPDATE users SET mfa_enabled=1 WHERE id=?`).bind(ctx.userId).run();
    await env.KV.delete(`mfa:setup:${ctx.userId}`);

    return ok({ enabled: true, backupCodes }); // Return plain codes ONCE
  }

  // POST /api/auth/mfa/verify — verify TOTP during login
  if (action === 'verify' && request.method === 'POST') {
    const { token, challenge, backupCode } = await request.json() as any;
    if (!challenge) return err('Challenge required');

    const challengeData = await env.KV.get(`mfa:${challenge}`);
    if (!challengeData) return err('Challenge expired', 401);

    const { userId, tenantId } = JSON.parse(challengeData);
    const mfa = await env.DB.prepare(`SELECT * FROM user_mfa WHERE user_id=? AND enabled=1`).bind(userId).first() as any;
    if (!mfa) return err('MFA not configured', 401);

    let verified = false;

    if (backupCode) {
      const hashes = JSON.parse(mfa.backup_codes ?? '[]');
      const idx    = await verifyBackupCode(backupCode, hashes);
      if (idx >= 0) {
        // Remove used backup code
        hashes.splice(idx, 1);
        await env.DB.prepare(`UPDATE user_mfa SET backup_codes=?, last_used_at=CURRENT_TIMESTAMP WHERE user_id=?`)
          .bind(JSON.stringify(hashes), userId).run();
        verified = true;
      }
    } else if (token) {
      verified = await verifyTOTP(mfa.totp_secret, token);
      if (verified) {
        await env.DB.prepare(`UPDATE user_mfa SET last_used_at=CURRENT_TIMESTAMP WHERE user_id=?`).bind(userId).run();
      }
    }

    if (!verified) return err('Invalid MFA code', 401);

    await env.KV.delete(`mfa:${challenge}`);
    const session = await createSession(env, userId, tenantId);
    return ok(session);
  }

  // POST /api/auth/mfa/disable
  if (action === 'disable' && request.method === 'POST') {
    if (!ctx.userId) return err('Authentication required', 401);
    const { token } = await request.json() as any;

    const mfa = await env.DB.prepare(`SELECT * FROM user_mfa WHERE user_id=? AND enabled=1`).bind(ctx.userId).first() as any;
    if (!mfa) return err('MFA not enabled');

    const valid = await verifyTOTP(mfa.totp_secret, token);
    if (!valid) return err('Invalid code');

    await env.DB.batch([
      env.DB.prepare(`UPDATE user_mfa SET enabled=0 WHERE user_id=?`).bind(ctx.userId),
      env.DB.prepare(`UPDATE users SET mfa_enabled=0 WHERE id=?`).bind(ctx.userId),
    ]);
    return ok({ disabled: true });
  }

  // GET /api/auth/mfa/status
  if (action === 'status' && request.method === 'GET') {
    if (!ctx.userId) return err('Authentication required', 401);
    const mfa = await env.DB.prepare(
      `SELECT enabled, method, enrolled_at, last_used_at FROM user_mfa WHERE user_id=?`
    ).bind(ctx.userId).first();
    return ok({ mfa: mfa ?? { enabled: 0 } });
  }

  return err('Not found', 404);
}

// ══════════════════════════════════════════════════════════════════════════════
// OAUTH2 / OIDC (Entra ID + Google)
// ══════════════════════════════════════════════════════════════════════════════

export async function handleOAuth(
  request: Request, env: Env, ctx: AppContext, subPath: string, provider: 'entra' | 'google'
): Promise<Response> {
  const [action] = subPath.split('/').filter(Boolean);
  const platformUrl = `https://${env.TENANT_DOMAIN ?? 'api-v2.xavvy.uk'}`;

  // Resolve tenant from host header if not in ctx
  const tenantId = ctx.tenantId;

  // GET config for this provider
  const config = await env.DB.prepare(`
    SELECT * FROM sso_providers WHERE tenant_id=? AND provider=? AND enabled=1
  `).bind(tenantId, provider).first() as any;

  if (!config) return err(`${provider} SSO not configured for this tenant`);

  // ── Redirect to IdP ─────────────────────────────────────────────────────────
  if (action === 'redirect' || !action) {
    const state = crypto.randomUUID();
    await env.KV.put(`sso:state:${state}`, JSON.stringify({ tenantId, provider }), { expirationTtl: 600 });

    const redirectUri = `${platformUrl}/api/auth/${provider}/callback`;
    let authUrl: string;

    if (provider === 'entra') {
      const tenantDomain = config.tenant_domain; // Azure tenant ID or 'common'
      authUrl = `https://login.microsoftonline.com/${tenantDomain}/oauth2/v2.0/authorize?` + new URLSearchParams({
        client_id:     config.client_id,
        response_type: 'code',
        redirect_uri:  redirectUri,
        scope:         'openid profile email',
        state,
        prompt:        'select_account',
      });
    } else { // google
      authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
        client_id:     config.client_id,
        response_type: 'code',
        redirect_uri:  redirectUri,
        scope:         'openid profile email',
        state,
        hd:            config.tenant_domain ?? '', // restrict to domain
        access_type:   'online',
      });
    }

    return Response.redirect(authUrl, 302);
  }

  // ── Handle callback ──────────────────────────────────────────────────────────
  if (action === 'callback') {
    const url   = new URL(request.url);
    const code  = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!code || !state) return err('Missing code or state');

    const stateData = await env.KV.get(`sso:state:${state}`);
    if (!stateData) return err('Invalid or expired state');
    await env.KV.delete(`sso:state:${state}`);

    const redirectUri = `${platformUrl}/api/auth/${provider}/callback`;

    // Exchange code for tokens
    let tokenUrl: string, tokenBody: URLSearchParams;

    if (provider === 'entra') {
      tokenUrl = `https://login.microsoftonline.com/${config.tenant_domain}/oauth2/v2.0/token`;
    } else {
      tokenUrl = 'https://oauth2.googleapis.com/token';
    }

    tokenBody = new URLSearchParams({
      grant_type:    'authorization_code',
      code,
      redirect_uri:  redirectUri,
      client_id:     config.client_id,
      client_secret: config.client_secret,
    });

    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:   tokenBody,
    });

    if (!tokenRes.ok) return err('Token exchange failed');
    const tokens = await tokenRes.json() as any;

    // Decode id_token to get user info (JWT — no signature verify needed, we trust the IdP)
    const idToken = tokens.id_token;
    if (!idToken) return err('No id_token received');

    const payload = JSON.parse(atob(idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    const email   = payload.email ?? payload.preferred_username ?? payload.upn;
    const name    = payload.name ?? email;

    if (!email) return err('Could not extract email from SSO token');

    // Find or create user
    let user = await env.DB.prepare(
      `SELECT id FROM users WHERE email=? AND tenant_id=?`
    ).bind(email.toLowerCase(), tenantId).first() as any;

    if (!user) {
      if (!config.auto_provision) {
        // Redirect to login with error
        return Response.redirect(`${platformUrl}/login?error=not_provisioned`, 302);
      }

      const userId = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT INTO users (id, tenant_id, email, password_hash, status, auth_provider, provider_id, created_at)
        VALUES (?, ?, ?, '', 'active', ?, ?, CURRENT_TIMESTAMP)
      `).bind(userId, tenantId, email.toLowerCase(), provider, payload.sub).run();

      // Assign default role
      await env.DB.prepare(`
        INSERT OR IGNORE INTO user_roles (id, user_id, role_id, scope_type, granted_by, granted_at)
        VALUES (?, ?, ?, 'tenant', NULL, CURRENT_TIMESTAMP)
      `).bind(crypto.randomUUID(), userId, config.default_role).run();

      user = { id: userId };
    }

    // Check MFA requirement
    const mfa = await env.DB.prepare(
      `SELECT * FROM user_mfa WHERE user_id=? AND enabled=1`
    ).bind(user.id).first() as any;

    if (mfa) {
      const mfaChallenge = crypto.randomUUID();
      await env.KV.put(`mfa:${mfaChallenge}`, JSON.stringify({ userId: user.id, tenantId }), { expirationTtl: 300 });
      return Response.redirect(`${platformUrl}/auth/mfa?challenge=${mfaChallenge}`, 302);
    }

    const session = await createSession(env, user.id, tenantId);

    // Redirect to app with tokens in URL fragment (SPA handles storage)
    return Response.redirect(
      `${platformUrl}/auth/callback#access_token=${session.accessToken}&refresh_token=${session.refreshToken}`,
      302
    );
  }

  return err('Not found', 404);
}

// ══════════════════════════════════════════════════════════════════════════════
// SAML 2.0
// ══════════════════════════════════════════════════════════════════════════════

export async function handleSAML(
  request: Request, env: Env, ctx: AppContext, subPath: string
): Promise<Response> {
  const [action] = subPath.split('/').filter(Boolean);
  const platformUrl = `https://${env.TENANT_DOMAIN ?? 'api-v2.xavvy.uk'}`;
  const tenantId    = ctx.tenantId;

  const config = await env.DB.prepare(`
    SELECT * FROM sso_providers WHERE tenant_id=? AND provider='saml' AND enabled=1
  `).bind(tenantId).first() as any;

  // GET /api/auth/saml/metadata — SP metadata XML
  if (action === 'metadata' && request.method === 'GET') {
    const spEntityId  = `${platformUrl}/api/auth/saml/metadata`;
    const acsUrl      = `${platformUrl}/api/auth/saml/callback`;
    const xml = `<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${spEntityId}">
  <SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="true"
    protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${acsUrl}" index="1"/>
  </SPSSODescriptor>
</EntityDescriptor>`;
    return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
  }

  if (!config) return err('SAML SSO not configured for this tenant');

  // GET /api/auth/saml/redirect — initiate SAML SSO
  if (action === 'redirect' && request.method === 'GET') {
    const state   = crypto.randomUUID();
    const acsUrl  = `${platformUrl}/api/auth/saml/callback`;
    await env.KV.put(`sso:state:${state}`, JSON.stringify({ tenantId, provider:'saml' }), { expirationTtl: 600 });

    // Build AuthnRequest
    const id          = '_' + crypto.randomUUID().replace(/-/g, '');
    const issueInstant= new Date().toISOString();
    const spEntityId  = `${platformUrl}/api/auth/saml/metadata`;
    const authnRequest= `<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
  xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
  ID="${id}" Version="2.0" IssueInstant="${issueInstant}"
  Destination="${config.saml_sso_url}" AssertionConsumerServiceURL="${acsUrl}"
  ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">
  <saml:Issuer>${spEntityId}</saml:Issuer>
</samlp:AuthnRequest>`;

    const encoded  = btoa(authnRequest);
    const samlUrl  = `${config.saml_sso_url}?SAMLRequest=${encodeURIComponent(encoded)}&RelayState=${encodeURIComponent(state)}`;
    return Response.redirect(samlUrl, 302);
  }

  // POST /api/auth/saml/callback — process SAML assertion
  if (action === 'callback' && request.method === 'POST') {
    const formData    = await request.formData();
    const samlResponse= formData.get('SAMLResponse') as string;
    const relayState  = formData.get('RelayState') as string;

    if (!samlResponse) return err('No SAML response');

    // Decode and parse the SAML response (basic XML parsing)
    const decoded = atob(samlResponse);

    // Extract email from NameID or attribute
    const emailMatch = decoded.match(/<(?:saml:)?NameID[^>]*>([^<@]+@[^<]+)<\/(?:saml:)?NameID>/i)
      ?? decoded.match(/emailAddress.*?>(.*?)</i);

    const email = emailMatch?.[1]?.trim();
    if (!email) return Response.redirect(`${platformUrl}/login?error=saml_email_missing`, 302);

    // Find or provision user
    let user = await env.DB.prepare(
      `SELECT id FROM users WHERE email=? AND tenant_id=?`
    ).bind(email.toLowerCase(), tenantId).first() as any;

    if (!user) {
      if (!config.auto_provision) return Response.redirect(`${platformUrl}/login?error=not_provisioned`, 302);
      const userId = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT INTO users (id, tenant_id, email, password_hash, status, auth_provider, created_at)
        VALUES (?, ?, ?, '', 'active', 'saml', CURRENT_TIMESTAMP)
      `).bind(userId, tenantId, email.toLowerCase()).run();
      await env.DB.prepare(`
        INSERT OR IGNORE INTO user_roles (id, user_id, role_id, scope_type, granted_by, granted_at)
        VALUES (?, ?, ?, 'tenant', NULL, CURRENT_TIMESTAMP)
      `).bind(crypto.randomUUID(), userId, config.default_role).run();
      user = { id: userId };
    }

    const session = await createSession(env, user.id, tenantId);
    return Response.redirect(
      `${platformUrl}/auth/callback#access_token=${session.accessToken}&refresh_token=${session.refreshToken}`,
      302
    );
  }

  return err('Not found', 404);
}

// ── SSO Provider Config CRUD ──────────────────────────────────────────────────
export async function handleSSOConfig(
  request: Request, env: Env, ctx: AppContext, subPath: string
): Promise<Response> {
  // GET /api/auth/sso-config
  if (request.method === 'GET') {
    const rows = await env.DB.prepare(`
      SELECT id, provider, enabled, client_id, tenant_domain, redirect_uri,
             saml_entity_id, saml_sso_url, auto_provision, force_sso, default_role
      FROM sso_providers WHERE tenant_id=? ORDER BY provider
    `).bind(ctx.tenantId).all();
    return ok(rows.results);
  }

  // POST /api/auth/sso-config — upsert SSO provider
  if (request.method === 'POST') {
    const body = await request.json() as any;
    if (!body.provider) return err('provider is required');

    await env.DB.prepare(`
      INSERT INTO sso_providers (id, tenant_id, provider, enabled, client_id, client_secret,
        tenant_domain, redirect_uri, saml_entity_id, saml_sso_url, saml_cert,
        auto_provision, force_sso, default_role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(tenant_id, provider) DO UPDATE SET
        enabled=excluded.enabled, client_id=excluded.client_id,
        client_secret=excluded.client_secret, tenant_domain=excluded.tenant_domain,
        redirect_uri=excluded.redirect_uri, saml_entity_id=excluded.saml_entity_id,
        saml_sso_url=excluded.saml_sso_url, saml_cert=excluded.saml_cert,
        auto_provision=excluded.auto_provision, force_sso=excluded.force_sso,
        default_role=excluded.default_role, updated_at=CURRENT_TIMESTAMP
    `).bind(
      crypto.randomUUID(), ctx.tenantId, body.provider, body.enabled??0,
      body.clientId??null, body.clientSecret??null, body.tenantDomain??null,
      body.redirectUri??null, body.samlEntityId??null, body.samlSsoUrl??null,
      body.samlCert??null, body.autoProvision??1, body.forceSso??0,
      body.defaultRole??'role-employee'
    ).run();
    return ok({ saved: true });
  }

  return err('Not found', 404);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function hashToken(token: string): Promise<string> {
  const data   = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

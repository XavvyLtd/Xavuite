-- ============================================================
-- XavvySuite — SSO & MFA Schema
-- 014_sso_mfa.sql
-- ============================================================

PRAGMA foreign_keys = OFF;

-- ── SSO Provider Config (per tenant) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sso_providers (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  provider        TEXT NOT NULL CHECK (provider IN ('entra','google','saml','oidc')),
  enabled         INTEGER NOT NULL DEFAULT 0,
  -- OIDC / OAuth2
  client_id       TEXT,
  client_secret   TEXT,           -- stored encrypted in production
  tenant_domain   TEXT,           -- e.g. mycompany.com or Azure tenant ID
  redirect_uri    TEXT,
  -- SAML
  saml_entity_id  TEXT,
  saml_sso_url    TEXT,
  saml_cert       TEXT,           -- IdP signing certificate
  saml_sp_cert    TEXT,           -- SP certificate
  -- Behaviour
  auto_provision  INTEGER DEFAULT 1,   -- auto-create user on first SSO login
  force_sso       INTEGER DEFAULT 0,   -- disable local login when SSO enabled
  default_role    TEXT DEFAULT 'role-employee',
  created_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  UNIQUE (tenant_id, provider)
);

-- ── MFA settings per user ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_mfa (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL UNIQUE REFERENCES users(id),
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  method          TEXT NOT NULL DEFAULT 'totp' CHECK (method IN ('totp','sms','email')),
  totp_secret     TEXT,           -- base32 encoded TOTP secret
  backup_codes    TEXT,           -- JSON array of hashed backup codes
  enabled         INTEGER NOT NULL DEFAULT 0,
  enrolled_at     TEXT,
  last_used_at    TEXT,
  created_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- ── Magic link tokens ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS magic_link_tokens (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id),
  user_id     TEXT NOT NULL REFERENCES users(id),
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TEXT NOT NULL,
  used        INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_magic_tokens ON magic_link_tokens(token_hash, expires_at);

-- ── SSO sessions (state param storage for OAuth flows) ────────────────────────
-- These are short-lived; KV is the primary store but DB as fallback
CREATE TABLE IF NOT EXISTS sso_states (
  state       TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL,
  provider    TEXT NOT NULL,
  redirect_to TEXT,
  created_at  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

PRAGMA foreign_keys = ON;

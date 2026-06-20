-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: push_tokens table for mobile push notification registration
-- Used by: POST/DELETE /api/notifications/push-token (worker index.ts)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS push_tokens (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  token       TEXT NOT NULL,
  platform    TEXT NOT NULL DEFAULT 'android',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, token)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_tenant_user
  ON push_tokens(tenant_id, user_id);

-- ============================================================
-- XavvySuite — SaaS Mode Schema
-- 015_saas.sql
-- ============================================================

PRAGMA foreign_keys = OFF;

-- ── Subscriptions (per tenant) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id                    TEXT PRIMARY KEY,
  tenant_id             TEXT NOT NULL UNIQUE REFERENCES tenants(id),
  plan                  TEXT NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free','starter','professional','enterprise')),
  status                TEXT NOT NULL DEFAULT 'trialing'
    CHECK (status IN ('trialing','active','past_due','cancelled','paused')),
  stripe_customer_id    TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id       TEXT,
  trial_ends_at         TEXT,
  current_period_start  TEXT,
  current_period_end    TEXT,
  cancel_at_period_end  INTEGER DEFAULT 0,
  seat_count            INTEGER DEFAULT 5,
  created_at            TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at            TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);

-- ── Plan limits (what each plan can do) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS plan_limits (
  plan              TEXT PRIMARY KEY,
  max_employees     INTEGER DEFAULT 10,
  max_modules       INTEGER DEFAULT 5,
  max_storage_gb    REAL DEFAULT 1.0,
  max_api_calls_day INTEGER DEFAULT 1000,
  features          TEXT DEFAULT '[]'  -- JSON array of feature flags
);

INSERT OR IGNORE INTO plan_limits (plan, max_employees, max_modules, max_storage_gb, max_api_calls_day, features) VALUES
  ('free',         5,   5,  0.5, 500,   '["hr","leave","timesheets"]'),
  ('starter',      25,  10, 2.0, 2000,  '["hr","leave","timesheets","expenses","compliance","documents","training","announcements","orgchart","reporting"]'),
  ('professional', 100, 20, 10.0,10000, '["hr","leave","timesheets","expenses","compliance","documents","training","announcements","orgchart","reporting","recruitment","onboarding","visa","workflow","scheduler","checklists","offboarding2","resources","sos","pmo"]'),
  ('enterprise',   -1,  -1, -1,  -1,   '["*"]');

-- ── Onboarding checklist (tracks tenant setup progress) ──────────────────────
CREATE TABLE IF NOT EXISTS tenant_onboarding (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL UNIQUE REFERENCES tenants(id),
  step        TEXT NOT NULL DEFAULT 'profile'
    CHECK (step IN ('profile','team','modules','branding','complete')),
  completed_steps TEXT DEFAULT '[]',  -- JSON array
  created_at  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- ── Billing events (webhook log) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS billing_events (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT REFERENCES tenants(id),
  event_type  TEXT NOT NULL,
  stripe_event_id TEXT UNIQUE,
  payload     TEXT,  -- JSON
  processed   INTEGER DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- ── Extend tenants table with subdomain uniqueness index ─────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_subdomain ON tenants(subdomain);

PRAGMA foreign_keys = ON;

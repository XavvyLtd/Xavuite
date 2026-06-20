// ── Cloudflare Worker environment bindings ──────────────────────────────────
export interface Env {
  // D1 Database
  DB: D1Database;

  // R2 Storage (bound as STORE in wrangler.toml)
  STORE: R2Bucket;
  STORAGE?: R2Bucket;    // alias — resolved in index.ts

  // KV Namespace (bound as KV in wrangler.toml)
  KV: KVNamespace;
  SESSIONS?: KVNamespace; // alias — resolved in index.ts

  // Worker vars
  DEPLOYMENT_MODE: string;
  TENANT_ID: string;
  TENANT_NAME: string;
  TENANT_DOMAIN: string;
  EMAIL_FROM: string;
  EMAIL_HR: string;
  EMAIL_STAFF: string;
  EMAIL_STAFF_CUSTOM?: string;

  // Secrets
  JWT_SECRET: string;
  EMAIL_API_KEY: string;
  ENCRYPTION_KEY: string;

  // Stripe (optional — SaaS billing)
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRICE_STARTER_MONTHLY?: string;
  STRIPE_PRICE_STARTER_ANNUAL?: string;
  STRIPE_PRICE_PROFESSIONAL_MONTHLY?: string;
  STRIPE_PRICE_PROFESSIONAL_ANNUAL?: string;
  STRIPE_PRICE_ENTERPRISE_MONTHLY?: string;
  STRIPE_PRICE_ENTERPRISE_ANNUAL?: string;
}

// ── Request context, populated by middleware ────────────────────────────────
export interface AppContext {
  tenantId: string;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  permissions?: string[];
  employeeId?: string;
}

// ── JWT payload ─────────────────────────────────────────────────────────────
export interface JWTPayload {
  sub: string;       // user_id
  tid: string;       // tenant_id
  email: string;
  roles: string[];
  perms: string[];
  eid?: string;      // employee_id
  iat: number;
  exp: number;
}

// ── API helpers ──────────────────────────────────────────────────────────────
export type ApiResponse<T = unknown> =
  | { ok: true;  data: T }
  | { ok: false; error: string; code?: string };

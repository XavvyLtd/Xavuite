-- ============================================================
-- 016_clients_invoicing.sql
-- XavvySuite — Clients, Invoicing, session timeout, statutory
-- Run: wrangler d1 execute xavvysuite-fresh-db --local --file=schema/016_clients_invoicing.sql
-- ============================================================

-- ── Clients ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id                    TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id             TEXT NOT NULL REFERENCES tenants(id),
  company_name          TEXT NOT NULL,
  trading_name          TEXT,
  industry              TEXT,
  website               TEXT,
  logo_r2_key           TEXT,
  reg_address_line1     TEXT,
  reg_address_line2     TEXT,
  reg_city              TEXT,
  reg_county            TEXT,
  reg_postcode          TEXT,
  reg_country           TEXT DEFAULT 'United Kingdom',
  company_reg_number    TEXT,
  vat_number            TEXT,
  tax_reference         TEXT,
  payment_terms_days    INTEGER NOT NULL DEFAULT 30,
  currency_code         TEXT NOT NULL DEFAULT 'GBP',
  invoice_email         TEXT,
  invoice_cc            TEXT,
  notes                 TEXT,
  is_active             INTEGER NOT NULL DEFAULT 1,
  created_by            TEXT REFERENCES users(id),
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_clients_tenant ON clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clients_active  ON clients(tenant_id, is_active);

-- ── Client contacts ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_contacts (
  id                   TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id            TEXT NOT NULL REFERENCES tenants(id),
  client_id            TEXT NOT NULL REFERENCES clients(id),
  full_name            TEXT NOT NULL,
  job_title            TEXT,
  email                TEXT,
  phone                TEXT,
  whatsapp             TEXT,
  contact_type         TEXT NOT NULL DEFAULT 'liaison'
                         CHECK(contact_type IN ('liaison','finance','technical','executive','other')),
  is_primary_liaison   INTEGER NOT NULL DEFAULT 0,
  is_primary_finance   INTEGER NOT NULL DEFAULT 0,
  notes                TEXT,
  created_at           TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_client_contacts_client ON client_contacts(client_id);
CREATE INDEX IF NOT EXISTS idx_client_contacts_tenant ON client_contacts(tenant_id);

-- ── Link projects to clients (pmo_projects already exists) ───
ALTER TABLE pmo_projects ADD COLUMN client_id TEXT REFERENCES clients(id);
CREATE INDEX IF NOT EXISTS idx_pmo_projects_client ON pmo_projects(client_id);

-- ── Invoices ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id                   TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id            TEXT NOT NULL REFERENCES tenants(id),
  client_id            TEXT NOT NULL REFERENCES clients(id),
  invoice_number       TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'draft'
                         CHECK(status IN ('draft','sent','viewed','paid','overdue','void')),
  issue_date           TEXT NOT NULL,
  due_date             TEXT NOT NULL,
  subtotal             REAL NOT NULL DEFAULT 0,
  tax_rate             REAL NOT NULL DEFAULT 20,
  tax_amount           REAL NOT NULL DEFAULT 0,
  total                REAL NOT NULL DEFAULT 0,
  currency_code        TEXT NOT NULL DEFAULT 'GBP',
  notes_to_client      TEXT,
  internal_notes       TEXT,
  sent_at              TEXT,
  paid_at              TEXT,
  created_by           TEXT REFERENCES users(id),
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, invoice_number)
);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(tenant_id, status);

-- ── Invoice line items ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_line_items (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  invoice_id    TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  description   TEXT NOT NULL,
  quantity      REAL NOT NULL DEFAULT 1,
  unit_price    REAL NOT NULL DEFAULT 0,
  amount        REAL NOT NULL DEFAULT 0,
  from_date     TEXT,
  to_date       TEXT,
  timesheet_ids TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_line_items(invoice_id);

-- ── Invoice events ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_events (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  invoice_id   TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  tenant_id    TEXT NOT NULL REFERENCES tenants(id),
  event_type   TEXT NOT NULL
                 CHECK(event_type IN ('created','edited','sent','viewed','paid','voided','note_added','overdue_flagged')),
  actor_id     TEXT REFERENCES users(id),
  actor_name   TEXT,
  note         TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_invoice_events_invoice ON invoice_events(invoice_id);

-- ── Invoice number sequence ───────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_sequences (
  tenant_id  TEXT PRIMARY KEY REFERENCES tenants(id),
  year       INTEGER NOT NULL,
  last_seq   INTEGER NOT NULL DEFAULT 0
);

-- ── Statutory + session settings ─────────────────────────────
-- tenant_settings is a key-value table (key, value) so we INSERT rows.
-- INSERT OR IGNORE means re-running this file is safe.
INSERT OR IGNORE INTO tenant_settings (id, tenant_id, key, value) SELECT lower(hex(randomblob(16))), id, 'company_reg_number',      '' FROM tenants;
INSERT OR IGNORE INTO tenant_settings (id, tenant_id, key, value) SELECT lower(hex(randomblob(16))), id, 'vat_number',              '' FROM tenants;
INSERT OR IGNORE INTO tenant_settings (id, tenant_id, key, value) SELECT lower(hex(randomblob(16))), id, 'tax_reference',           '' FROM tenants;
INSERT OR IGNORE INTO tenant_settings (id, tenant_id, key, value) SELECT lower(hex(randomblob(16))), id, 'reg_address_line1',       '' FROM tenants;
INSERT OR IGNORE INTO tenant_settings (id, tenant_id, key, value) SELECT lower(hex(randomblob(16))), id, 'reg_address_line2',       '' FROM tenants;
INSERT OR IGNORE INTO tenant_settings (id, tenant_id, key, value) SELECT lower(hex(randomblob(16))), id, 'reg_city',                '' FROM tenants;
INSERT OR IGNORE INTO tenant_settings (id, tenant_id, key, value) SELECT lower(hex(randomblob(16))), id, 'reg_county',              '' FROM tenants;
INSERT OR IGNORE INTO tenant_settings (id, tenant_id, key, value) SELECT lower(hex(randomblob(16))), id, 'reg_postcode',            '' FROM tenants;
INSERT OR IGNORE INTO tenant_settings (id, tenant_id, key, value) SELECT lower(hex(randomblob(16))), id, 'reg_country',             'United Kingdom' FROM tenants;
INSERT OR IGNORE INTO tenant_settings (id, tenant_id, key, value) SELECT lower(hex(randomblob(16))), id, 'default_currency',        'GBP' FROM tenants;
INSERT OR IGNORE INTO tenant_settings (id, tenant_id, key, value) SELECT lower(hex(randomblob(16))), id, 'default_tax_rate',        '20' FROM tenants;
INSERT OR IGNORE INTO tenant_settings (id, tenant_id, key, value) SELECT lower(hex(randomblob(16))), id, 'payment_terms_days',      '30' FROM tenants;
INSERT OR IGNORE INTO tenant_settings (id, tenant_id, key, value) SELECT lower(hex(randomblob(16))), id, 'bank_name',               '' FROM tenants;
INSERT OR IGNORE INTO tenant_settings (id, tenant_id, key, value) SELECT lower(hex(randomblob(16))), id, 'bank_account_name',       '' FROM tenants;
INSERT OR IGNORE INTO tenant_settings (id, tenant_id, key, value) SELECT lower(hex(randomblob(16))), id, 'bank_account_number',     '' FROM tenants;
INSERT OR IGNORE INTO tenant_settings (id, tenant_id, key, value) SELECT lower(hex(randomblob(16))), id, 'bank_sort_code',          '' FROM tenants;
INSERT OR IGNORE INTO tenant_settings (id, tenant_id, key, value) SELECT lower(hex(randomblob(16))), id, 'bank_iban',               '' FROM tenants;
INSERT OR IGNORE INTO tenant_settings (id, tenant_id, key, value) SELECT lower(hex(randomblob(16))), id, 'bank_bic',                '' FROM tenants;
INSERT OR IGNORE INTO tenant_settings (id, tenant_id, key, value) SELECT lower(hex(randomblob(16))), id, 'session_timeout_minutes', '60' FROM tenants;

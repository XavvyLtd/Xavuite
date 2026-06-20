-- ============================================================
-- XavvySuite — Recruitment Module Schema
-- 006_recruitment.sql
-- ============================================================

PRAGMA foreign_keys = OFF;

-- ── Job Requisitions (internal approval before posting) ───────────────────────
CREATE TABLE IF NOT EXISTS job_requisitions (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  title           TEXT NOT NULL,
  department_id   TEXT REFERENCES departments(id),
  location        TEXT,
  location_type   TEXT DEFAULT 'hybrid' CHECK (location_type IN ('office','remote','hybrid')),
  employment_type TEXT DEFAULT 'full_time',
  headcount       INTEGER NOT NULL DEFAULT 1,
  reason          TEXT,           -- replacement | new_role | expansion
  justification   TEXT,
  salary_min      REAL,
  salary_max      REAL,
  currency        TEXT DEFAULT 'GBP',
  target_start    TEXT,
  status          TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','pending_approval','approved','rejected','filled','cancelled')),
  priority        TEXT DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  requested_by    TEXT REFERENCES users(id),
  approved_by     TEXT REFERENCES users(id),
  approved_at     TEXT,
  created_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- ── Job Postings (public-facing, linked to approved requisition) ──────────────
-- Extends existing job_postings table with requisition link
ALTER TABLE job_postings ADD COLUMN requisition_id TEXT REFERENCES job_requisitions(id);
ALTER TABLE job_postings ADD COLUMN hiring_manager_id TEXT REFERENCES employees(id);
ALTER TABLE job_postings ADD COLUMN interview_stages TEXT; -- JSON array of stage names
ALTER TABLE job_postings ADD COLUMN application_count INTEGER DEFAULT 0;
ALTER TABLE job_postings ADD COLUMN published_at TEXT;
ALTER TABLE job_postings ADD COLUMN filled_at TEXT;

-- ── Candidates ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS candidates (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  email           TEXT NOT NULL,
  phone           TEXT,
  location        TEXT,
  linkedin_url    TEXT,
  cv_r2_key       TEXT,
  source          TEXT DEFAULT 'direct'
    CHECK (source IN ('direct','linkedin','referral','agency','job_board','website','other')),
  referral_by     TEXT REFERENCES employees(id),
  tags            TEXT,           -- JSON array of skill tags
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','hired','rejected','withdrawn','blacklisted')),
  created_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  UNIQUE (tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_candidates_tenant  ON candidates(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_candidates_email   ON candidates(tenant_id, email);

-- ── Applications (candidate applied to a job posting) ────────────────────────
-- Replaces / extends existing job_applications table
DROP TABLE IF EXISTS job_applications;
CREATE TABLE IF NOT EXISTS job_applications (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  job_id          TEXT NOT NULL REFERENCES job_postings(id),
  candidate_id    TEXT NOT NULL REFERENCES candidates(id),
  -- Pipeline stage
  stage           TEXT NOT NULL DEFAULT 'applied'
    CHECK (stage IN ('applied','screening','phone_screen','interview','assessment','offer','hired','rejected','withdrawn')),
  stage_order     INTEGER NOT NULL DEFAULT 1,
  -- Scores
  cv_score        INTEGER,        -- 1-5 rating
  overall_score   INTEGER,        -- calculated from interview scores
  -- Rejection
  rejection_reason TEXT,
  rejected_by     TEXT REFERENCES users(id),
  rejected_at     TEXT,
  -- Hiring
  hired_at        TEXT,
  employee_id     TEXT REFERENCES employees(id),  -- set when converted to employee
  -- Meta
  applied_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  created_by      TEXT REFERENCES users(id),
  UNIQUE (job_id, candidate_id)
);

CREATE INDEX IF NOT EXISTS idx_applications_job   ON job_applications(tenant_id, job_id, stage);
CREATE INDEX IF NOT EXISTS idx_applications_cand  ON job_applications(tenant_id, candidate_id);

-- ── Interview Schedules ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS interviews (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  application_id  TEXT NOT NULL REFERENCES job_applications(id),
  stage_name      TEXT NOT NULL,  -- e.g. 'Phone Screen', 'Technical', 'Final'
  interview_type  TEXT NOT NULL DEFAULT 'video'
    CHECK (interview_type IN ('phone','video','in_person','technical','panel')),
  scheduled_at    TEXT NOT NULL,
  duration_mins   INTEGER DEFAULT 60,
  location        TEXT,           -- room or video link
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','completed','cancelled','no_show')),
  -- Outcome
  score           INTEGER,        -- 1-5
  feedback        TEXT,
  recommendation  TEXT CHECK (recommendation IN ('strong_yes','yes','maybe','no','strong_no')),
  created_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- ── Interview Interviewers ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS interview_interviewers (
  interview_id    TEXT NOT NULL REFERENCES interviews(id),
  employee_id     TEXT NOT NULL REFERENCES employees(id),
  role            TEXT DEFAULT 'interviewer', -- lead | interviewer | observer
  feedback_given  INTEGER DEFAULT 0,
  PRIMARY KEY (interview_id, employee_id)
);

-- ── Offers ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_offers (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  application_id  TEXT NOT NULL REFERENCES job_applications(id),
  candidate_id    TEXT NOT NULL REFERENCES candidates(id),
  job_id          TEXT NOT NULL REFERENCES job_postings(id),
  -- Offer details
  salary          REAL NOT NULL,
  currency        TEXT DEFAULT 'GBP',
  start_date      TEXT,
  contract_type   TEXT DEFAULT 'permanent',
  employment_type TEXT DEFAULT 'full_time',
  location        TEXT,
  benefits        TEXT,           -- JSON array
  offer_letter_r2_key TEXT,
  -- Status
  status          TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sent','accepted','declined','expired','withdrawn')),
  sent_at         TEXT,
  expires_at      TEXT,
  responded_at    TEXT,
  decline_reason  TEXT,
  -- Meta
  created_by      TEXT REFERENCES users(id),
  created_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- ── Application Stage History (audit trail of pipeline movement) ──────────────
CREATE TABLE IF NOT EXISTS application_stage_history (
  id              TEXT PRIMARY KEY,
  application_id  TEXT NOT NULL REFERENCES job_applications(id),
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  from_stage      TEXT,
  to_stage        TEXT NOT NULL,
  moved_by        TEXT REFERENCES users(id),
  note            TEXT,
  moved_at        TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- ── Seed interview stages for IoT Platform job ────────────────────────────────
UPDATE job_postings
SET interview_stages = '["CV Screen","Phone Screen","Technical Interview","Final Interview"]'
WHERE tenant_id = 'xavvy-tenant-001';

PRAGMA foreign_keys = ON;

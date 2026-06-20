-- ============================================================
-- XavvySuite — Job Scheduler Schema
-- 004_job_scheduler.sql
-- Run: wrangler d1 execute xavvysuite-fresh-db --file=schema/004_job_scheduler.sql --local
-- ============================================================

PRAGMA foreign_keys = OFF;

-- ── Job definitions ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scheduled_jobs (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  key           TEXT NOT NULL,                   -- system key e.g. 'rtw_expiry_check'
  name          TEXT NOT NULL,                   -- display name
  description   TEXT,
  category      TEXT NOT NULL DEFAULT 'custom',  -- system | compliance | hr | custom
  enabled       INTEGER NOT NULL DEFAULT 1,
  -- Schedule
  schedule_type TEXT NOT NULL DEFAULT 'cron'     -- cron | interval | once
    CHECK (schedule_type IN ('cron','interval','once')),
  cron_expr     TEXT,                            -- e.g. '0 9 * * 1' (Mon 9am)
  interval_mins INTEGER,                         -- e.g. 60 for hourly
  run_at        TEXT,                            -- ISO datetime for 'once' jobs
  -- Email config
  email_enabled INTEGER NOT NULL DEFAULT 1,
  email_to      TEXT NOT NULL DEFAULT 'hr',      -- hr | staff | employee | custom
  email_to_custom TEXT,                          -- comma-separated emails for 'custom'
  email_subject TEXT NOT NULL,
  email_body    TEXT NOT NULL,                   -- HTML with {{placeholders}}
  -- Trigger config (JSON) — e.g. {"days_before": 90} for expiry jobs
  trigger_config TEXT,
  -- Metadata
  last_run_at   TEXT,
  last_run_status TEXT,                          -- success | error | skipped
  next_run_at   TEXT,
  run_count     INTEGER NOT NULL DEFAULT 0,
  created_by    TEXT REFERENCES users(id),
  created_at    TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at    TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  UNIQUE (tenant_id, key)
);

-- ── Job execution log ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_run_log (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id),
  job_id      TEXT NOT NULL REFERENCES scheduled_jobs(id),
  triggered_by TEXT NOT NULL DEFAULT 'scheduler', -- scheduler | manual | api
  status      TEXT NOT NULL,                      -- running | success | error | skipped
  started_at  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  finished_at TEXT,
  duration_ms INTEGER,
  emails_sent INTEGER DEFAULT 0,
  records_processed INTEGER DEFAULT 0,
  error_message TEXT,
  output      TEXT                                -- JSON summary of what ran
);

CREATE INDEX IF NOT EXISTS idx_job_run_log_job    ON job_run_log(job_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_run_log_tenant ON job_run_log(tenant_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_tenant ON scheduled_jobs(tenant_id, enabled);

-- ── Seed system jobs for Xavvy ─────────────────────────────────────────────────
INSERT OR IGNORE INTO scheduled_jobs (
  id, tenant_id, key, name, description, category, enabled,
  schedule_type, cron_expr,
  email_enabled, email_to, email_subject, email_body,
  trigger_config, created_at, updated_at
) VALUES

-- 1. RTW Expiry Check
(
  'job-rtw-expiry', 'xavvy-tenant-001',
  'rtw_expiry_check',
  'Right to Work — Expiry Check',
  'Emails HR when employee RTW documents expire or are expiring within the configured threshold.',
  'compliance', 1,
  'cron', '0 8 * * 1',
  1, 'hr',
  'RTW Alert: {{expired_count}} Expired, {{expiring_count}} Expiring Soon',
  '<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden">
  <div style="background:#0F2A4A;padding:20px 24px">
    <h2 style="color:#fff;margin:0">Right to Work — Weekly Status Report</h2>
    <p style="color:#94A3B8;margin:4px 0 0;font-size:12px">{{company_name}} · {{run_date}}</p>
  </div>
  <div style="padding:24px">
    <p>Hi HR Team,</p>
    <p>The weekly RTW check has completed. Here is a summary:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr style="background:#f4f4f4">
        <th style="padding:10px;text-align:left;border:1px solid #e0e0e0">Employee</th>
        <th style="padding:10px;text-align:left;border:1px solid #e0e0e0">Document</th>
        <th style="padding:10px;text-align:left;border:1px solid #e0e0e0">Status</th>
        <th style="padding:10px;text-align:left;border:1px solid #e0e0e0">Expiry Date</th>
        <th style="padding:10px;text-align:left;border:1px solid #e0e0e0">Days Remaining</th>
      </tr>
      {{rtw_rows}}
    </table>
    <p style="color:#666;font-size:13px">Please take action on expired or expiring documents as soon as possible.</p>
    <a href="{{platform_url}}/compliance" style="display:inline-block;background:#1D6FA4;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold">View in XavvySuite →</a>
  </div>
</div></body></html>',
  '{"days_before": 90}',
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),

-- 2. Visa Expiry Check
(
  'job-visa-expiry', 'xavvy-tenant-001',
  'visa_expiry_check',
  'Visa Expiry Alert',
  'Emails HR and the employee when their visa is expiring within the configured threshold.',
  'compliance', 1,
  'cron', '0 9 * * *',
  1, 'hr',
  'Visa Expiry Alert: {{employee_name}} — {{days_remaining}} days remaining',
  '<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden">
  <div style="background:#0F2A4A;padding:20px 24px">
    <h2 style="color:#fff;margin:0">Visa Expiry Alert</h2>
    <p style="color:#94A3B8;margin:4px 0 0;font-size:12px">{{company_name}} · {{run_date}}</p>
  </div>
  <div style="padding:24px">
    <p>Hi {{recipient_name}},</p>
    <p>This is an automated alert regarding the following visa record:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr><td style="padding:8px;border:1px solid #e0e0e0;color:#666">Employee</td><td style="padding:8px;border:1px solid #e0e0e0"><strong>{{employee_name}}</strong></td></tr>
      <tr style="background:#f9f9f9"><td style="padding:8px;border:1px solid #e0e0e0;color:#666">Document Type</td><td style="padding:8px;border:1px solid #e0e0e0">{{document_type}}</td></tr>
      <tr><td style="padding:8px;border:1px solid #e0e0e0;color:#666">Expiry Date</td><td style="padding:8px;border:1px solid #e0e0e0;color:#EF4444;font-weight:bold">{{expiry_date}}</td></tr>
      <tr style="background:#f9f9f9"><td style="padding:8px;border:1px solid #e0e0e0;color:#666">Days Remaining</td><td style="padding:8px;border:1px solid #e0e0e0;font-weight:bold">{{days_remaining}} days</td></tr>
    </table>
    <p style="color:#666;font-size:13px">Please arrange renewal immediately to avoid any compliance risk.</p>
    <a href="{{platform_url}}/compliance" style="display:inline-block;background:#1D6FA4;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold">View in XavvySuite →</a>
  </div>
</div></body></html>',
  '{"days_before": 90, "notify_employee": true}',
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),

-- 3. Timesheet Submission Reminder
(
  'job-timesheet-reminder', 'xavvy-tenant-001',
  'timesheet_submission_reminder',
  'Timesheet Submission Reminder',
  'Reminds employees who have not submitted their timesheet for the current week.',
  'hr', 1,
  'cron', '0 16 * * 5',
  1, 'staff',
  'Reminder: Please submit your timesheet for week ending {{week_ending}}',
  '<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden">
  <div style="background:#0F2A4A;padding:20px 24px">
    <h2 style="color:#fff;margin:0">Timesheet Reminder</h2>
    <p style="color:#94A3B8;margin:4px 0 0;font-size:12px">{{company_name}}</p>
  </div>
  <div style="padding:24px">
    <p>Hi {{employee_name}},</p>
    <p>This is a friendly reminder to submit your timesheet for the week ending <strong>{{week_ending}}</strong>.</p>
    <p>Your timesheet has not yet been submitted. Please log your hours before end of business today.</p>
    <a href="{{platform_url}}/timesheets" style="display:inline-block;background:#1D6FA4;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;margin-top:8px">Submit Timesheet →</a>
    <p style="color:#999;font-size:12px;margin-top:24px">If you have already submitted your timesheet, please ignore this message.</p>
  </div>
</div></body></html>',
  '{}',
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),

-- 4. Probation End Alert
(
  'job-probation-alert', 'xavvy-tenant-001',
  'probation_end_alert',
  'Probation Period Ending Alert',
  'Alerts HR and the line manager when an employee probation period is ending within 14 days.',
  'hr', 1,
  'cron', '0 9 * * 1',
  1, 'hr',
  'Probation Ending: {{employee_name}} — {{days_remaining}} days remaining',
  '<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden">
  <div style="background:#0F2A4A;padding:20px 24px">
    <h2 style="color:#fff;margin:0">Probation Period Ending</h2>
    <p style="color:#94A3B8;margin:4px 0 0;font-size:12px">{{company_name}} · {{run_date}}</p>
  </div>
  <div style="padding:24px">
    <p>Hi {{manager_name}},</p>
    <p><strong>{{employee_name}}</strong> probation period is ending in <strong>{{days_remaining}} days</strong> on <strong>{{probation_end_date}}</strong>.</p>
    <p>Please ensure you have:</p>
    <ul>
      <li>Completed the probation review meeting</li>
      <li>Documented feedback in the system</li>
      <li>Confirmed the outcome (pass / extend / terminate)</li>
    </ul>
    <a href="{{platform_url}}/hr" style="display:inline-block;background:#1D6FA4;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold">View Employee Record →</a>
  </div>
</div></body></html>',
  '{"days_before": 14}',
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),

-- 5. Leave Balance Monthly Report
(
  'job-leave-balance-report', 'xavvy-tenant-001',
  'leave_balance_report',
  'Monthly Leave Balance Report',
  'Sends HR a summary of outstanding leave balances and pending requests on the 1st of each month.',
  'hr', 1,
  'cron', '0 8 1 * *',
  1, 'hr',
  'Monthly Leave Balance Report — {{month_year}}',
  '<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden">
  <div style="background:#0F2A4A;padding:20px 24px">
    <h2 style="color:#fff;margin:0">Monthly Leave Report</h2>
    <p style="color:#94A3B8;margin:4px 0 0;font-size:12px">{{company_name}} · {{month_year}}</p>
  </div>
  <div style="padding:24px">
    <p>Hi HR Team,</p>
    <p>Here is the leave summary for <strong>{{month_year}}</strong>:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr style="background:#f4f4f4">
        <th style="padding:10px;text-align:left;border:1px solid #e0e0e0">Employee</th>
        <th style="padding:10px;text-align:left;border:1px solid #e0e0e0">Annual Entitlement</th>
        <th style="padding:10px;text-align:left;border:1px solid #e0e0e0">Days Taken</th>
        <th style="padding:10px;text-align:left;border:1px solid #e0e0e0">Days Remaining</th>
        <th style="padding:10px;text-align:left;border:1px solid #e0e0e0">Pending</th>
      </tr>
      {{leave_rows}}
    </table>
    <a href="{{platform_url}}/leave" style="display:inline-block;background:#1D6FA4;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold">View in XavvySuite →</a>
  </div>
</div></body></html>',
  '{}',
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),

-- 6. Pending Approvals Digest
(
  'job-pending-approvals', 'xavvy-tenant-001',
  'pending_approvals_digest',
  'Pending Approvals Digest',
  'Sends managers a daily digest of items awaiting their approval (leave, timesheets, expenses).',
  'hr', 1,
  'cron', '0 9 * * 1-5',
  1, 'hr',
  'You have {{total_pending}} items awaiting approval',
  '<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden">
  <div style="background:#0F2A4A;padding:20px 24px">
    <h2 style="color:#fff;margin:0">Pending Approvals</h2>
    <p style="color:#94A3B8;margin:4px 0 0;font-size:12px">{{company_name}} · {{run_date}}</p>
  </div>
  <div style="padding:24px">
    <p>Hi {{manager_name}},</p>
    <p>You have <strong>{{total_pending}} items</strong> awaiting your approval:</p>
    <ul>
      <li>🌴 Leave requests: <strong>{{leave_pending}}</strong></li>
      <li>⏱ Timesheets: <strong>{{timesheet_pending}}</strong></li>
      <li>💳 Expense claims: <strong>{{expense_pending}}</strong></li>
    </ul>
    <a href="{{platform_url}}/dashboard" style="display:inline-block;background:#1D6FA4;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold">Review Now →</a>
  </div>
</div></body></html>',
  '{"skip_if_none": true}',
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

PRAGMA foreign_keys = ON;

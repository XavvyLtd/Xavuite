import { z } from 'zod';
import { ok, created, err, notFound } from '../../core/response';
import { requirePermission } from '../../middleware/auth';
import { audit, auditFromRequest } from '../../middleware/audit';
import { sendMail } from '../../core/email';
import type { Env, AppContext } from '../../types';

// ── Zod schemas ───────────────────────────────────────────────────────────────
const JobSchema = z.object({
  name:            z.string().min(1).max(200),
  description:     z.string().optional(),
  category:        z.enum(['system','compliance','hr','custom']).default('custom'),
  enabled:         z.boolean().default(true),
  scheduleType:    z.enum(['cron','interval','once']).default('cron'),
  cronExpr:        z.string().optional(),
  intervalMins:    z.number().positive().optional(),
  runAt:           z.string().optional(),
  emailEnabled:    z.boolean().default(true),
  emailTo:         z.enum(['hr','staff','employee','custom']).default('hr'),
  emailToCustom:   z.string().optional(),
  emailSubject:    z.string().min(1),
  emailBody:       z.string().min(1),
  triggerConfig:   z.record(z.unknown()).default({}),
});

// ── Template renderer — replaces {{placeholders}} with values ─────────────────
function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

function todayStr(): string {
  return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Resolve the actual email recipient(s) from job config
function resolveRecipient(job: any, env: Env, employeeEmail?: string): string | string[] {
  if (job.email_to === 'custom' && job.email_to_custom) return job.email_to_custom;
  if (job.email_to === 'employee' && employeeEmail)     return employeeEmail;
  if (job.email_to === 'staff')                         return env.EMAIL_STAFF;
  return env.EMAIL_HR;
}

// ── Job executors — the actual logic each job runs ────────────────────────────
async function executeJob(
  job: any,
  env: Env,
  triggeredBy: 'scheduler' | 'manual' = 'scheduler'
): Promise<{ emailsSent: number; recordsProcessed: number; output: object }> {
  const startTime = Date.now();
  let emailsSent = 0;
  let recordsProcessed = 0;
  const output: Record<string, unknown> = {};

  const config = job.trigger_config ? JSON.parse(job.trigger_config) : {};
  const platformUrl = `https://${env.TENANT_DOMAIN}`;
  const companyName = env.TENANT_NAME;
  const runDate = todayStr();

  try {
    switch (job.key) {

      // ── RTW Expiry Check ────────────────────────────────────────────────────
      case 'rtw_expiry_check': {
        const daysBefore = config.days_before ?? 90;
        const rows = await env.DB.prepare(`
          SELECT rw.doc_type, rw.expiry_date, rw.status,
                 eh.first_name || ' ' || eh.last_name AS employee_name
          FROM employee_right_to_work rw
          JOIN employee_history eh ON eh.employee_id = rw.employee_id AND eh.is_current = 1
          WHERE rw.tenant_id = ?
            AND (
              rw.status = 'expired'
              OR (rw.expiry_date IS NOT NULL
                  AND rw.expiry_date <= date('now', '+' || ? || ' days')
                  AND rw.expiry_date >= date('now'))
            )
          ORDER BY rw.expiry_date ASC
        `).bind(env.TENANT_ID, daysBefore).all() as any;

        recordsProcessed = rows.results.length;
        if (recordsProcessed === 0 && config.skip_if_none !== false) {
          output.skipped = 'No expiring/expired RTW records found';
          break;
        }

        const expired  = rows.results.filter((r: any) => r.status === 'expired');
        const expiring = rows.results.filter((r: any) => r.status !== 'expired');

        const rtwRows = rows.results.map((r: any) => {
          const daysLeft = r.expiry_date
            ? Math.ceil((new Date(r.expiry_date).getTime() - Date.now()) / 86400000)
            : null;
          const color = r.status === 'expired' ? '#EF4444' : daysLeft && daysLeft < 30 ? '#F59E0B' : '#10B981';
          return `<tr>
            <td style="padding:8px;border:1px solid #e0e0e0">${r.employee_name}</td>
            <td style="padding:8px;border:1px solid #e0e0e0">${r.doc_type}</td>
            <td style="padding:8px;border:1px solid #e0e0e0;color:${color};font-weight:bold">${r.status}</td>
            <td style="padding:8px;border:1px solid #e0e0e0">${r.expiry_date ?? 'N/A'}</td>
            <td style="padding:8px;border:1px solid #e0e0e0;color:${color};font-weight:bold">${daysLeft !== null ? `${daysLeft} days` : '—'}</td>
          </tr>`;
        }).join('');

        const subject = renderTemplate(job.email_subject, {
          expired_count: String(expired.length),
          expiring_count: String(expiring.length),
          company_name: companyName,
        });
        const body = renderTemplate(job.email_body, {
          company_name: companyName,
          run_date: runDate,
          rtw_rows: rtwRows,
          platform_url: platformUrl,
          expired_count: String(expired.length),
          expiring_count: String(expiring.length),
        });

        const toAddr = resolveRecipient(job, env);
        await sendMail(env, { to: toAddr, subject, html: body });
        emailsSent++;
        output.expiredCount  = expired.length;
        output.expiringCount = expiring.length;
        break;
      }

      // ── Visa Expiry Check (per employee, daily) ─────────────────────────────
      case 'visa_expiry_check': {
        const daysBefore = config.days_before ?? 90;
        const notifyEmployee = config.notify_employee ?? true;

        const rows = await env.DB.prepare(`
          SELECT id.doc_type, id.expiry_date,
                 eh.first_name || ' ' || eh.last_name AS employee_name,
                 u.email AS employee_email,
                 CAST((julianday(id.expiry_date) - julianday('now')) AS INTEGER) AS days_remaining
          FROM employee_identity_docs id
          JOIN employees e ON e.id = id.employee_id
          JOIN employee_history eh ON eh.employee_id = e.id AND eh.is_current = 1
          JOIN users u ON u.id = e.user_id
          WHERE id.tenant_id = ?
            AND id.doc_type IN ('Passport','BRP Card','Work Visa','Visa')
            AND id.expiry_date IS NOT NULL
            AND id.expiry_date <= date('now', '+' || ? || ' days')
            AND id.expiry_date >= date('now')
            AND id.is_current = 1
          ORDER BY id.expiry_date ASC
        `).bind(env.TENANT_ID, daysBefore).all() as any;

        recordsProcessed = rows.results.length;
        if (recordsProcessed === 0) { output.skipped = 'No expiring visas found'; break; }

        for (const row of rows.results) {
          const vars = {
            employee_name:   row.employee_name,
            document_type:   row.doc_type,
            expiry_date:     row.expiry_date,
            days_remaining:  String(row.days_remaining),
            company_name:    companyName,
            run_date:        runDate,
            platform_url:    platformUrl,
            recipient_name:  'HR Team',
          };

          const toList: string[] = [env.EMAIL_HR];
          if (notifyEmployee && row.employee_email) toList.push(row.employee_email);

          await sendMail(env, {
            to: toList,
            subject: renderTemplate(job.email_subject, vars),
            html:    renderTemplate(job.email_body, vars),
          });
          emailsSent++;
        }
        output.visasExpiring = recordsProcessed;
        break;
      }

      // ── Timesheet Submission Reminder ────────────────────────────────────────
      case 'timesheet_submission_reminder': {
        const today = new Date();
        const monday = new Date(today);
        monday.setDate(today.getDate() - today.getDay() + 1);
        const weekStarting = monday.toISOString().split('T')[0];

        const friday = new Date(monday);
        friday.setDate(monday.getDate() + 4);
        const weekEnding = friday.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

        // Find active employees who haven't submitted this week
        const missing = await env.DB.prepare(`
          SELECT e.id, eh.first_name, u.email
          FROM employees e
          JOIN employee_history eh ON eh.employee_id = e.id AND eh.is_current = 1
          JOIN users u ON u.id = e.user_id
          WHERE e.tenant_id = ? AND e.status = 'active'
            AND e.id NOT IN (
              SELECT employee_id FROM timesheets
              WHERE tenant_id = ? AND week_starting = ? AND status != 'rejected'
            )
        `).bind(env.TENANT_ID, env.TENANT_ID, weekStarting).all() as any;

        recordsProcessed = missing.results.length;
        if (recordsProcessed === 0) { output.skipped = 'All timesheets submitted'; break; }

        for (const emp of missing.results) {
          const vars = {
            employee_name: emp.first_name,
            week_ending:   weekEnding,
            company_name:  companyName,
            platform_url:  platformUrl,
          };
          // Respect job's email_to setting — custom overrides per-employee send
          const to = resolveRecipient(job, env, emp.email);
          await sendMail(env, {
            to,
            subject: renderTemplate(job.email_subject, vars),
            html:    renderTemplate(job.email_body, vars),
          });
          emailsSent++;
        }
        output.remindersSent = emailsSent;
        break;
      }

      // ── Probation End Alert ───────────────────────────────────────────────────
      case 'probation_end_alert': {
        const daysBefore = config.days_before ?? 14;

        const rows = await env.DB.prepare(`
          SELECT eh.first_name || ' ' || eh.last_name AS employee_name,
                 eh.probation_end_date,
                 CAST((julianday(eh.probation_end_date) - julianday('now')) AS INTEGER) AS days_remaining,
                 me.first_name || ' ' || me.last_name AS manager_name,
                 mu.email AS manager_email
          FROM employee_history eh
          JOIN employees e ON e.id = eh.employee_id
          LEFT JOIN reporting_hierarchy rh ON rh.employee_id = e.id AND rh.is_direct = 1
          LEFT JOIN employees mgr ON mgr.id = rh.manager_id
          LEFT JOIN employee_history me ON me.employee_id = mgr.id AND me.is_current = 1
          LEFT JOIN users mu ON mu.id = mgr.user_id
          WHERE eh.tenant_id = ? AND eh.is_current = 1
            AND eh.probation_status = 'in_progress'
            AND eh.probation_end_date IS NOT NULL
            AND eh.probation_end_date <= date('now', '+' || ? || ' days')
            AND eh.probation_end_date >= date('now')
        `).bind(env.TENANT_ID, daysBefore).all() as any;

        recordsProcessed = rows.results.length;
        if (recordsProcessed === 0) { output.skipped = 'No probations ending soon'; break; }

        for (const row of rows.results) {
          const vars = {
            employee_name:      row.employee_name,
            manager_name:       row.manager_name ?? 'HR',
            probation_end_date: row.probation_end_date,
            days_remaining:     String(row.days_remaining),
            company_name:       companyName,
            run_date:           runDate,
            platform_url:       platformUrl,
          };
          const to = row.manager_email ?? env.EMAIL_HR;
          await sendMail(env, {
            to,
            subject: renderTemplate(job.email_subject, vars),
            html:    renderTemplate(job.email_body, vars),
          });
          emailsSent++;
        }
        output.alertsSent = emailsSent;
        break;
      }

      // ── Leave Balance Report ──────────────────────────────────────────────────
      case 'leave_balance_report': {
        const monthYear = new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
        const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];

        const rows = await env.DB.prepare(`
          SELECT eh.first_name || ' ' || eh.last_name AS employee_name,
                 25 AS entitlement,
                 COALESCE(SUM(CASE WHEN lr.status='approved' AND lr.leave_type='annual' THEN lr.days ELSE 0 END), 0) AS days_taken,
                 COALESCE(COUNT(CASE WHEN lr.status='pending' THEN 1 END), 0) AS days_pending
          FROM employee_history eh
          JOIN employees e ON e.id = eh.employee_id
          LEFT JOIN leave_requests lr ON lr.employee_id = e.id AND lr.start_date >= ?
          WHERE eh.tenant_id = ? AND eh.is_current = 1 AND e.status = 'active'
          GROUP BY e.id, eh.first_name, eh.last_name
          ORDER BY eh.last_name
        `).bind(yearStart, env.TENANT_ID).all() as any;

        recordsProcessed = rows.results.length;
        const leaveRows = rows.results.map((r: any) => {
          const remaining = r.entitlement - r.days_taken;
          return `<tr>
            <td style="padding:8px;border:1px solid #e0e0e0">${r.employee_name}</td>
            <td style="padding:8px;border:1px solid #e0e0e0;text-align:center">${r.entitlement}</td>
            <td style="padding:8px;border:1px solid #e0e0e0;text-align:center">${r.days_taken}</td>
            <td style="padding:8px;border:1px solid #e0e0e0;text-align:center;font-weight:bold;color:${remaining < 5 ? '#EF4444' : '#10B981'}">${remaining}</td>
            <td style="padding:8px;border:1px solid #e0e0e0;text-align:center">${r.days_pending}</td>
          </tr>`;
        }).join('');

        const vars = { month_year: monthYear, company_name: companyName, run_date: runDate, platform_url: platformUrl, leave_rows: leaveRows };
        await sendMail(env, { to: resolveRecipient(job, env), subject: renderTemplate(job.email_subject, vars), html: renderTemplate(job.email_body, vars) });
        emailsSent++;
        output.employeesReported = recordsProcessed;
        break;
      }

      // ── Pending Approvals Digest ──────────────────────────────────────────────
      case 'pending_approvals_digest': {
        const [leave, timesheets, expenses] = await Promise.all([
          env.DB.prepare(`SELECT COUNT(*) as n FROM leave_requests WHERE tenant_id=? AND status='pending'`).bind(env.TENANT_ID).first() as any,
          env.DB.prepare(`SELECT COUNT(*) as n FROM timesheets WHERE tenant_id=? AND status='pending'`).bind(env.TENANT_ID).first() as any,
          env.DB.prepare(`SELECT COUNT(*) as n FROM expense_claims WHERE tenant_id=? AND status='pending'`).bind(env.TENANT_ID).first() as any,
        ]);
        const total = (leave?.n ?? 0) + (timesheets?.n ?? 0) + (expenses?.n ?? 0);
        if (total === 0 && config.skip_if_none) { output.skipped = 'No pending approvals'; break; }

        const vars = {
          manager_name:      'HR Team',
          total_pending:     String(total),
          leave_pending:     String(leave?.n ?? 0),
          timesheet_pending: String(timesheets?.n ?? 0),
          expense_pending:   String(expenses?.n ?? 0),
          company_name:      companyName,
          run_date:          runDate,
          platform_url:      platformUrl,
        };
        await sendMail(env, { to: resolveRecipient(job, env), subject: renderTemplate(job.email_subject, vars), html: renderTemplate(job.email_body, vars) });
        emailsSent++;
        output.totalPending = total;
        break;
      }

      case 'auto_timesheet_submission': {
        const config = JSON.parse(job.trigger_config ?? '{}');
        const hoursPerWeek = config.hours_per_week ?? 35;

        // Get previous week dates
        const now  = new Date();
        const lastMon = new Date(now); lastMon.setDate(now.getDate() - now.getDay() - 6);
        const lastSun = new Date(lastMon); lastSun.setDate(lastMon.getDate() + 6);
        const weekStart  = lastMon.toISOString().split('T')[0];
        const weekEnd    = lastSun.toISOString().split('T')[0];
        const weekEnding = lastSun.toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });

        // Get all active employees
        const emps = await env.DB.prepare(`
          SELECT e.id FROM employees e WHERE e.tenant_id=? AND e.status='active'
        `).bind(env.TENANT_ID).all() as any;

        let submitted = 0;
        for (const emp of emps.results ?? []) {
          // Skip if already submitted
          const exists = await env.DB.prepare(`
            SELECT id FROM timesheets WHERE tenant_id=? AND employee_id=? AND week_starting=?
          `).bind(env.TENANT_ID, emp.id, weekStart).first();
          if (exists) continue;

          // Get tasks allocated to this employee in the previous week
          const tasks = await env.DB.prepare(`
            SELECT id FROM pmo_tasks
            WHERE tenant_id=? AND assignee_id=?
              AND (due_date >= ? OR due_date IS NULL)
              AND status NOT IN ('done','cancelled')
            LIMIT 5
          `).bind(env.TENANT_ID, emp.id, weekStart).all() as any;

          // Create timesheet
          const tsId = crypto.randomUUID();
          await env.DB.prepare(`
            INSERT INTO timesheets (id,tenant_id,employee_id,week_starting,status,submitted_at)
            VALUES (?,?,?,?,'approved',CURRENT_TIMESTAMP)
          `).bind(tsId, env.TENANT_ID, emp.id, weekStart).run();

          // Add timesheet entries (spread 35hrs across working days)
          const dailyHours = hoursPerWeek / 5;
          const entries = [];
          for (let d = 0; d < 5; d++) {
            const date = new Date(lastMon); date.setDate(lastMon.getDate() + d);
            const taskId = tasks.results?.[d % Math.max(tasks.results.length, 1)]?.id ?? null;
            entries.push(env.DB.prepare(`
              INSERT INTO timesheet_entries (id,timesheet_id,tenant_id,date,hours_worked,description,billable)
              VALUES (?,?,?,?,?,?,1)
            `).bind(crypto.randomUUID(), tsId, env.TENANT_ID, date.toISOString().split('T')[0], dailyHours, 'Automated entry', ));
          }
          if (entries.length) await env.DB.batch(entries);

          // Mark previous week tasks as done if configured
          if (config.auto_complete_tasks && tasks.results?.length) {
            await env.DB.prepare(`
              UPDATE pmo_tasks SET status='done', updated_at=CURRENT_TIMESTAMP
              WHERE tenant_id=? AND assignee_id=? AND id IN (${tasks.results.map(()=>'?').join(',')})
            `).bind(env.TENANT_ID, emp.id, ...tasks.results.map((t:any) => t.id)).run();
          }

          submitted++;
        }

        recordsProcessed = submitted;
        output.message = `Submitted timesheets for ${submitted} employees for week ending ${weekEnding}`;
        break;
      }

      case 'leave_balance_init': {
        const leaveYear = new Date().getFullYear();
        const emps = await env.DB.prepare(`SELECT id FROM employees WHERE tenant_id=? AND status='active'`).bind(env.TENANT_ID).all() as any;
        const lts  = await env.DB.prepare(`SELECT id, code FROM leave_types WHERE tenant_id=? AND enabled=1`).bind(env.TENANT_ID).all() as any;
        let initialised = 0;
        for (const emp of emps.results ?? []) {
          for (const lt of lts.results ?? []) {
            const pol = await env.DB.prepare(`SELECT entitlement_days FROM leave_policies WHERE tenant_id=? AND leave_type_id=? AND enabled=1 LIMIT 1`).bind(env.TENANT_ID, lt.id).first() as any;
            if (!pol) continue;
            await env.DB.prepare(`INSERT OR IGNORE INTO leave_balances (id,tenant_id,employee_id,leave_type_id,year,entitlement,taken,pending,carried_forward) VALUES (?,?,?,?,?,?,0,0,0)`).bind(`${emp.id}-${lt.id}-${leaveYear}`, env.TENANT_ID, emp.id, lt.id, leaveYear, pol.entitlement_days).run();
            initialised++;
          }
        }
        recordsProcessed = initialised;
        output.message = `Initialised ${initialised} leave balances for ${leaveYear}`;
        break;
      }

      case 'timesheet_missing_alert': {
        const mon = new Date(); mon.setDate(mon.getDate() - mon.getDay() - 6);
        const weekStart = mon.toISOString().split('T')[0];
        const fri = new Date(mon); fri.setDate(mon.getDate() + 4);
        const weekEnding = fri.toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });
        const missing = await env.DB.prepare(`
          SELECT eh.first_name||' '||eh.last_name AS name, u.email
          FROM employees e
          JOIN employee_history eh ON eh.employee_id=e.id AND eh.is_current=1
          JOIN users u ON u.id=e.user_id
          WHERE e.tenant_id=? AND e.status='active'
            AND e.id NOT IN (SELECT employee_id FROM timesheets WHERE tenant_id=? AND week_starting=? AND status!='rejected')
        `).bind(env.TENANT_ID, env.TENANT_ID, weekStart).all() as any;
        if (!missing.results?.length) { output.skipped = 'All submitted'; break; }
        const empList = missing.results.map((r: any) => `<li>${r.name}</li>`).join('');
        const to = job.email_to==='custom'?job.email_to_custom:env.EMAIL_HR;
        if (to && job.email_enabled) await sendMail(env, { to, subject: renderTemplate(job.email_subject, { count:missing.results.length, week_ending:weekEnding }), html: renderTemplate(job.email_body, { manager_name:'Manager', count:missing.results.length, week_ending:weekEnding, employee_list:empList, platform_url:platformUrl }) });
        recordsProcessed = missing.results.length;
        emailsSent++;
        break;
      }

      // ── Custom job — just sends the email as-is ───────────────────────────────
      default: {
        const vars = { company_name: companyName, run_date: runDate, platform_url: platformUrl };
        const to = job.email_to === 'custom' ? job.email_to_custom : job.email_to === 'staff' ? env.EMAIL_STAFF : env.EMAIL_HR;
        await sendMail(env, { to, subject: renderTemplate(job.email_subject, vars), html: renderTemplate(job.email_body, vars) });
        emailsSent++;
        break;
      }
    }
  } catch (error: any) {
    throw new Error(`Job execution failed: ${error.message}`);
  }

  return { emailsSent, recordsProcessed, output };
}

// ── Write run log ─────────────────────────────────────────────────────────────
async function writeRunLog(env: Env, jobId: string, tenantId: string, status: string, triggeredBy: string, result: { emailsSent: number; recordsProcessed: number; output: object }, durationMs: number, errorMessage?: string) {
  await env.DB.prepare(`
    INSERT INTO job_run_log (id, tenant_id, job_id, triggered_by, status, started_at, finished_at, duration_ms, emails_sent, records_processed, error_message, output)
    VALUES (?, ?, ?, ?, ?, datetime('now', '-' || ? || ' seconds'), CURRENT_TIMESTAMP, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(), tenantId, jobId, triggeredBy, status,
    Math.round(durationMs / 1000), durationMs,
    result.emailsSent, result.recordsProcessed,
    errorMessage ?? null,
    JSON.stringify(result.output),
  ).run();

  await env.DB.prepare(`
    UPDATE scheduled_jobs SET last_run_at = CURRENT_TIMESTAMP, last_run_status = ?, run_count = run_count + 1 WHERE id = ?
  `).bind(status, jobId).run();
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function handleScheduler(
  request: Request, env: Env, ctx: AppContext, subPath: string
): Promise<Response> {
  const [id, action] = subPath.split('/').filter(Boolean);

  // GET /api/scheduler — list all jobs
  if (!id && request.method === 'GET') {
    const denied = requirePermission(ctx, 'hr:manage:employee');
    if (denied) return denied;

    const jobs = await env.DB.prepare(`
      SELECT j.*,
        (SELECT COUNT(*) FROM job_run_log WHERE job_id = j.id) as total_runs,
        (SELECT COUNT(*) FROM job_run_log WHERE job_id = j.id AND status = 'error') as error_runs
      FROM scheduled_jobs j
      WHERE j.tenant_id = ?
      ORDER BY j.category, j.name
    `).bind(ctx.tenantId).all();

    return ok(jobs.results);
  }

  // POST /api/scheduler — create new job
  if (!id && request.method === 'POST') {
    const denied = requirePermission(ctx, 'hr:manage:employee');
    if (denied) return denied;

    const body = await request.json().catch(() => null);
    const parsed = JobSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.issues[0].message);

    const d = parsed.data;
    const jobId = crypto.randomUUID();
    const key   = `custom_${jobId.slice(0, 8)}`;

    await env.DB.prepare(`
      INSERT INTO scheduled_jobs (
        id, tenant_id, key, name, description, category, enabled,
        schedule_type, cron_expr, interval_mins, run_at,
        email_enabled, email_to, email_to_custom, email_subject, email_body,
        trigger_config, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(
      jobId, ctx.tenantId, key, d.name, d.description ?? null,
      d.category, d.enabled ? 1 : 0,
      d.scheduleType, d.cronExpr ?? null, d.intervalMins ?? null, d.runAt ?? null,
      d.emailEnabled ? 1 : 0, d.emailTo, d.emailToCustom ?? null,
      d.emailSubject, d.emailBody,
      JSON.stringify(d.triggerConfig),
      ctx.userId,
    ).run();

    await audit(env, { ...auditFromRequest(request, ctx), action: 'create', resource: 'scheduled_job', resourceId: jobId });
    return created({ id: jobId });
  }

  // GET /api/scheduler/:id/logs — run history
  if (id && action === 'logs' && request.method === 'GET') {
    const logs = await env.DB.prepare(`
      SELECT * FROM job_run_log WHERE job_id = ? AND tenant_id = ? ORDER BY started_at DESC LIMIT 50
    `).bind(id, ctx.tenantId).all();
    return ok(logs.results);
  }

  // POST /api/scheduler/:id/fire — immediate execution
  if (id && action === 'fire' && request.method === 'POST') {
    const denied = requirePermission(ctx, 'hr:manage:employee');
    if (denied) return denied;

    const job = await env.DB.prepare(
      `SELECT * FROM scheduled_jobs WHERE id = ? AND tenant_id = ?`
    ).bind(id, ctx.tenantId).first() as any;
    if (!job) return notFound('Job not found');

    const start = Date.now();
    let result = { emailsSent: 0, recordsProcessed: 0, output: {} as object };
    let status = 'success';
    let errorMessage: string | undefined;

    try {
      result = await executeJob(job, env, 'manual');
    } catch (e: any) {
      status = 'error';
      errorMessage = e.message;
    }

    const duration = Date.now() - start;
    await writeRunLog(env, id, ctx.tenantId, status, 'manual', result, duration, errorMessage);

    await audit(env, { ...auditFromRequest(request, ctx), action: 'update', resource: 'scheduled_job', resourceId: id, metadata: { action: 'manual_fire', status } });

    if (status === 'error') return err(errorMessage ?? 'Job failed', 500);
    return ok({ status, ...result, durationMs: duration });
  }

  // PATCH /api/scheduler/:id — update job
  if (id && !action && request.method === 'PATCH') {
    const denied = requirePermission(ctx, 'hr:manage:employee');
    if (denied) return denied;

    const body = await request.json().catch(() => null);
    const parsed = JobSchema.partial().safeParse(body);
    if (!parsed.success) return err(parsed.error.issues[0].message);

    const d = parsed.data;
    const sets: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const params: unknown[] = [];

    if (d.name          !== undefined) { sets.push('name = ?');           params.push(d.name); }
    if (d.description   !== undefined) { sets.push('description = ?');    params.push(d.description); }
    if (d.enabled       !== undefined) { sets.push('enabled = ?');        params.push(d.enabled ? 1 : 0); }
    if (d.cronExpr      !== undefined) { sets.push('cron_expr = ?');      params.push(d.cronExpr); }
    if (d.emailSubject  !== undefined) { sets.push('email_subject = ?');  params.push(d.emailSubject); }
    if (d.emailBody     !== undefined) { sets.push('email_body = ?');     params.push(d.emailBody); }
    if (d.emailTo       !== undefined) { sets.push('email_to = ?');       params.push(d.emailTo); }
    if (d.emailToCustom !== undefined) { sets.push('email_to_custom = ?'); params.push(d.emailToCustom); }
    if (d.triggerConfig !== undefined) { sets.push('trigger_config = ?'); params.push(JSON.stringify(d.triggerConfig)); }

    await env.DB.prepare(
      `UPDATE scheduled_jobs SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`
    ).bind(...params, id, ctx.tenantId).run();

    return ok({ id, updated: true });
  }

  // DELETE /api/scheduler/:id — soft delete (disable) or hard delete for custom jobs
  if (id && !action && request.method === 'DELETE') {
    const denied = requirePermission(ctx, 'hr:manage:employee');
    if (denied) return denied;

    const job = await env.DB.prepare(
      `SELECT key, category FROM scheduled_jobs WHERE id = ? AND tenant_id = ?`
    ).bind(id, ctx.tenantId).first() as any;
    if (!job) return notFound('Job not found');

    if (job.category === 'system') return err('System jobs cannot be deleted — disable them instead', 400);

    await env.DB.prepare(`DELETE FROM scheduled_jobs WHERE id = ? AND tenant_id = ?`).bind(id, ctx.tenantId).run();
    return ok({ id, deleted: true });
  }

  return err('Not found', 404);
}

// ── Cron dispatcher — called from index.ts scheduled handler ──────────────────
export async function runScheduledJobs(env: Env, cronExpr: string): Promise<void> {
  const jobs = await env.DB.prepare(`
    SELECT * FROM scheduled_jobs WHERE tenant_id = ? AND enabled = 1 AND schedule_type = 'cron' AND cron_expr = ?
  `).bind(env.TENANT_ID, cronExpr).all() as any;

  for (const job of jobs.results) {
    const start = Date.now();
    let result = { emailsSent: 0, recordsProcessed: 0, output: {} as object };
    let status = 'success';
    let errorMessage: string | undefined;

    try {
      result = await executeJob(job, env, 'scheduler');
    } catch (e: any) {
      status = 'error';
      errorMessage = e.message;
      console.error(`[scheduler] Job ${job.key} failed:`, e.message);
    }

    await writeRunLog(env, job.id, env.TENANT_ID, status, 'scheduler', result, Date.now() - start, errorMessage);
  }
}

function ok<T>(data: T) { return Response.json({ ok: true, data }, { status: 200 }); }
function created<T>(data: T) { return Response.json({ ok: true, data }, { status: 201 }); }
function err(message: string, status = 400) { return Response.json({ ok: false, error: message }, { status }); }
function notFound(msg: string) { return err(msg, 404); }

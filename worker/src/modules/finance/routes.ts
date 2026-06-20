// modules/finance/routes.ts
//
// Finance module — payroll review, built entirely on existing tables.
// No schema changes. Reuses employees, employee_compensation, employee_history,
// timesheets, timesheet_entries, leave_requests, leave_types, public_holidays.
// Gated on existing hr:view:compensation / hr:manage:compensation permissions.

import { ok, err }                  from '../../core/response';
import { requirePermission }        from '../../middleware/auth';
import { audit, auditFromRequest }  from '../../middleware/audit';
import { sendMail }                 from '../../core/email';
import type { Env, AppContext }     from '../../types';

interface PayrollRow {
  employee_id:    string;
  employee_name:  string;
  base_salary:    number;
  currency:       string;
  pay_frequency:  string;
  working_days:   number;
  worked_days:    number;
  paid_leave_days:   number;
  unpaid_leave_days: number;
  payroll_days:   number;
  gross_salary:   number;
  notes:          string;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

// Count weekdays (Mon–Fri) in [start, end] inclusive, minus public holidays in range.
function countWorkingDays(year: number, month: number, holidayDates: Set<string>): number {
  const total = daysInMonth(year, month);
  let count = 0;
  for (let d = 1; d <= total; d++) {
    const date = new Date(year, month - 1, d);
    const dow  = date.getDay(); // 0=Sun, 6=Sat
    if (dow === 0 || dow === 6) continue;
    const iso = date.toISOString().slice(0, 10);
    if (holidayDates.has(iso)) continue;
    count++;
  }
  return count;
}

export async function handleFinance(
  request: Request, env: Env, ctx: AppContext, subPath: string
): Promise<Response> {
  const method = request.method;
  const url    = new URL(request.url);

  // ── GET /api/finance/payroll?year=&month= — calculate payroll on-the-fly ──
  if (subPath === '/payroll' && method === 'GET') {
    const denied = requirePermission(ctx, 'hr:view:compensation');
    if (denied) return denied;

    const now   = new Date();
    const year  = parseInt(url.searchParams.get('year')  ?? String(now.getFullYear()));
    const month = parseInt(url.searchParams.get('month') ?? String(now.getMonth() + 1)); // 1-12

    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay     = daysInMonth(year, month);
    const monthEnd    = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    // Public holidays in range (region 'all' — existing seed pattern)
    const holidaysRes = await env.DB.prepare(`
      SELECT date FROM public_holidays
      WHERE tenant_id = ? AND date >= ? AND date <= ?
    `).bind(ctx.tenantId, monthStart, monthEnd).all();
    const holidayDates = new Set<string>((holidaysRes.results ?? []).map((r: any) => r.date));

    const workingDays = countWorkingDays(year, month, holidayDates);

    // Active employees, LEFT JOINed to whichever compensation row was effective
    // during this payroll month. LEFT JOIN (not INNER) is deliberate: an employee
    // with no employee_compensation row at all must still appear in the grid —
    // missing from payroll is the exact thing Finance needs to be alerted to,
    // not something that should silently drop them off the report.
    const employeesRes = await env.DB.prepare(`
      SELECT e.id AS employee_id,
             eh.first_name, eh.last_name,
             ec.base_salary, ec.currency, ec.pay_frequency, ec.hours_per_week, ec.effective_from, ec.effective_to
      FROM employees e
      JOIN employee_history eh ON eh.employee_id = e.id AND eh.is_current = 1
      LEFT JOIN employee_compensation ec ON ec.id = (
        SELECT ec2.id FROM employee_compensation ec2
        WHERE ec2.employee_id = e.id
          AND ec2.effective_from <= ?
          AND (ec2.effective_to IS NULL OR ec2.effective_to >= ?)
        ORDER BY ec2.effective_from DESC
        LIMIT 1
      )
      WHERE e.tenant_id = ? AND e.status = 'active'
      ORDER BY eh.first_name, eh.last_name
    `).bind(monthEnd, monthStart, ctx.tenantId).all();

    const employees = (employeesRes.results ?? []) as any[];
    if (employees.length === 0) {
      return ok({ year, month, workingDays, rows: [] as PayrollRow[] });
    }

    const employeeIds = employees.map(e => e.employee_id);
    const placeholders = employeeIds.map(() => '?').join(',');

    // Worked days — distinct dates with timesheet_entries.hours_worked > 0,
    // via timesheets owned by these employees, within range, approved or pending
    const workedRes = await env.DB.prepare(`
      SELECT t.employee_id, COUNT(DISTINCT te.date) AS worked_days
      FROM timesheet_entries te
      JOIN timesheets t ON t.id = te.timesheet_id
      WHERE t.tenant_id = ? AND t.employee_id IN (${placeholders})
        AND te.date >= ? AND te.date <= ? AND te.hours_worked > 0
        AND t.status IN ('approved','pending')
      GROUP BY t.employee_id
    `).bind(ctx.tenantId, ...employeeIds, monthStart, monthEnd).all();
    const workedMap = new Map<string, number>(
      (workedRes.results ?? []).map((r: any) => [r.employee_id, r.worked_days])
    );

    // Leave days — approved leave_requests overlapping the month, split paid/unpaid via leave_types.paid.
    // leave_requests.leave_type is a CHECK-constrained code string (annual/sick/...), matched
    // against leave_types.code. 'unpaid' always counts as unpaid even if the leave_types row is missing.
    const leaveRes = await env.DB.prepare(`
      SELECT lr.employee_id, lr.start_date, lr.end_date, lr.days, lr.half_day, lr.leave_type,
             COALESCE(lt.paid, CASE WHEN lr.leave_type = 'unpaid' THEN 0 ELSE 1 END) AS paid
      FROM leave_requests lr
      LEFT JOIN leave_types lt ON lt.code = lr.leave_type AND lt.tenant_id = lr.tenant_id
      WHERE lr.tenant_id = ? AND lr.employee_id IN (${placeholders})
        AND lr.status = 'approved'
        AND lr.start_date <= ? AND lr.end_date >= ?
    `).bind(ctx.tenantId, ...employeeIds, monthEnd, monthStart).all();

    const paidLeaveMap   = new Map<string, number>();
    const unpaidLeaveMap = new Map<string, number>();
    for (const lr of (leaveRes.results ?? []) as any[]) {
      // Clamp leave days to the days that actually fall within this month
      const days = Number(lr.days) || 0;
      const map = lr.paid ? paidLeaveMap : unpaidLeaveMap;
      map.set(lr.employee_id, (map.get(lr.employee_id) ?? 0) + days);
    }

    const rows: PayrollRow[] = employees.map(e => {
      const workedDays      = workedMap.get(e.employee_id) ?? 0;
      const paidLeaveDays   = paidLeaveMap.get(e.employee_id) ?? 0;
      const unpaidLeaveDays = unpaidLeaveMap.get(e.employee_id) ?? 0;
      const payrollDays     = Math.min(workingDays, workedDays + paidLeaveDays);

      const hasComp = e.base_salary != null;

      // base_salary is stored however the user entered it (annual, monthly,
      // fortnightly, weekly, daily or hourly) — normalize to a monthly
      // equivalent first, since the payroll math below is month-based.
      // Without this, an "annual" entry would be divided by ~21 working
      // days as if it were already a monthly figure, producing a grossly
      // inflated gross salary.
      const hoursPerWeek = e.hours_per_week ?? 37.5;
      const hoursPerMonth = (hoursPerWeek * 52) / 12;
      let monthlySalary = e.base_salary ?? 0;
      if (hasComp) {
        switch (e.pay_frequency) {
          case 'annual':      monthlySalary = e.base_salary / 12; break;
          case 'monthly':     monthlySalary = e.base_salary; break;
          case 'fortnightly': monthlySalary = (e.base_salary * 26) / 12; break;
          case 'weekly':      monthlySalary = (e.base_salary * 52) / 12; break;
          case 'daily':       monthlySalary = e.base_salary * workingDays; break;
          case 'hourly':      monthlySalary = e.base_salary * hoursPerMonth; break;
          default:            monthlySalary = e.base_salary; // unknown/legacy value — assume already monthly
        }
      }

      const dailyRate = hasComp && workingDays > 0 ? monthlySalary / workingDays : 0;
      const grossSalary = hasComp ? Math.round(dailyRate * payrollDays * 100) / 100 : 0;

      const notes = !hasComp
        ? 'No compensation record found for this employee'
        : (unpaidLeaveDays > 0 ? `${unpaidLeaveDays} unpaid day(s) deducted` : '');

      return {
        employee_id:       e.employee_id,
        employee_name:     `${e.first_name} ${e.last_name}`,
        base_salary:       e.base_salary ?? 0,
        currency:          e.currency ?? 'GBP',
        pay_frequency:     e.pay_frequency ?? 'monthly',
        working_days:      workingDays,
        worked_days:       workedDays,
        paid_leave_days:   paidLeaveDays,
        unpaid_leave_days: unpaidLeaveDays,
        payroll_days:      payrollDays,
        gross_salary:      grossSalary,
        notes,
      };
    });

    // Record this load as a payroll_run history entry — fire and forget,
    // never block or fail the actual payroll response if logging has an issue.
    const runId = crypto.randomUUID();
    try {
      const totalGross = rows.reduce((s, r) => s + (r.gross_salary || 0), 0);
      await env.DB.prepare(`
        INSERT INTO payroll_runs (id, tenant_id, year, month, employee_count, total_gross, currency, rows_snapshot, action, run_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'loaded', ?)
      `).bind(
        runId, ctx.tenantId, year, month, rows.length, totalGross,
        rows[0]?.currency ?? 'GBP', JSON.stringify(rows), ctx.userId
      ).run();
    } catch (e) {
      console.error('[finance] Failed to record payroll_runs history:', e);
    }

    return ok({ year, month, workingDays, rows, runId });
  }

  // ── POST /api/finance/payroll/export — CSV export ─────────
  if (subPath === '/payroll/export' && method === 'POST') {
    const denied = requirePermission(ctx, 'hr:view:compensation');
    if (denied) return denied;

    const body = await request.json().catch(() => null) as { rows?: PayrollRow[]; year?: number; month?: number } | null;
    if (!body?.rows) return err('rows required', 400);

    const header = ['Employee','Salary','Currency','Working Days','Worked Days','Paid Leave','Unpaid Leave','Payroll Days','Gross Salary','Notes'];
    const lines = [header.join(',')];
    for (const r of body.rows) {
      lines.push([
        `"${r.employee_name}"`, r.base_salary, r.currency, r.working_days, r.worked_days,
        r.paid_leave_days, r.unpaid_leave_days, r.payroll_days, r.gross_salary,
        `"${(r.notes ?? '').replace(/"/g, '""')}"`,
      ].join(','));
    }
    const csv = lines.join('\n');

    await audit(env, {
      ...auditFromRequest(request, ctx),
      action: 'export', resource: 'payroll_report', resourceId: `${body.year}-${body.month}`,
    });

    try {
      const totalGross = body.rows.reduce((s, r) => s + (r.gross_salary || 0), 0);
      await env.DB.prepare(`
        INSERT INTO payroll_runs (tenant_id, year, month, employee_count, total_gross, currency, rows_snapshot, action, run_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'exported', ?)
      `).bind(
        ctx.tenantId, body.year, body.month, body.rows.length, totalGross,
        body.rows[0]?.currency ?? 'GBP', JSON.stringify(body.rows), ctx.userId
      ).run();
    } catch (e) {
      console.error('[finance] Failed to record payroll_runs history (export):', e);
    }

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="payroll-${body.year}-${String(body.month).padStart(2,'0')}.csv"`,
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  // ── POST /api/finance/payroll/email — email payroll report to Finance/HR ──
  if (subPath === '/payroll/email' && method === 'POST') {
    const denied = requirePermission(ctx, 'hr:manage:compensation');
    if (denied) return denied;

    const body = await request.json().catch(() => null) as
      { rows?: PayrollRow[]; year?: number; month?: number; to?: string } | null;
    if (!body?.rows) return err('rows required', 400);

    // 'to' is supplied by the Finance user via the frontend prompt — falls back
    // to EMAIL_HR only if they leave it blank, so the recipient is always explicit.
    const recipient = body.to?.trim() || env.EMAIL_HR || env.EMAIL_FROM;
    if (!recipient) return err('No recipient email provided', 400);

    const totalGross = body.rows.reduce((s, r) => s + (r.gross_salary || 0), 0);
    const monthLabel = new Date(body.year ?? 0, (body.month ?? 1) - 1, 1)
      .toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

    const tableRows = body.rows.map(r => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${r.employee_name}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right">${r.payroll_days}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right">${r.currency} ${r.gross_salary.toFixed(2)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${r.notes ?? ''}</td>
      </tr>`).join('');

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto">
        <h2 style="color:#111">Payroll Report — ${monthLabel}</h2>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:#f4f4f5">
              <th style="padding:6px 10px;text-align:left">Employee</th>
              <th style="padding:6px 10px;text-align:right">Payroll Days</th>
              <th style="padding:6px 10px;text-align:right">Gross Salary</th>
              <th style="padding:6px 10px;text-align:left">Notes</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
        <p style="margin-top:16px;font-weight:bold">Total Gross: ${totalGross.toFixed(2)}</p>
      </div>`;

    await sendMail(env, {
      to: recipient,
      subject: `Payroll Report — ${monthLabel}`,
      html,
    });

    await audit(env, {
      ...auditFromRequest(request, ctx),
      action: 'email', resource: 'payroll_report', resourceId: `${body.year}-${body.month}`,
    });

    try {
      await env.DB.prepare(`
        INSERT INTO payroll_runs (tenant_id, year, month, employee_count, total_gross, currency, rows_snapshot, action, emailed_to, run_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'emailed', ?, ?)
      `).bind(
        ctx.tenantId, body.year, body.month, body.rows.length, totalGross,
        body.rows[0]?.currency ?? 'GBP', JSON.stringify(body.rows), recipient, ctx.userId
      ).run();
    } catch (e) {
      console.error('[finance] Failed to record payroll_runs history (email):', e);
    }

    return ok({ sent: true, to: recipient });
  }

  // ── POST /api/finance/payroll/save — persist manual adjustments ─────────
  // The grid's inline edits (Worked Days, Paid Leave, Notes, etc.) only ever
  // live in browser state until Export or Email is clicked, which silently
  // also acts as a save point. This endpoint exists so a Finance user can
  // explicitly save their adjustments as a snapshot without having to
  // export a CSV or send an email just to make them stick.
  if (subPath === '/payroll/save' && method === 'POST') {
    const denied = requirePermission(ctx, 'hr:manage:compensation');
    if (denied) return denied;

    const body = await request.json().catch(() => null) as
      { rows?: PayrollRow[]; year?: number; month?: number } | null;
    if (!body?.rows || !body.year || !body.month) return err('rows, year and month required', 400);

    const totalGross = body.rows.reduce((s, r) => s + (r.gross_salary || 0), 0);
    const runId = crypto.randomUUID();

    await env.DB.prepare(`
      INSERT INTO payroll_runs (id, tenant_id, year, month, employee_count, total_gross, currency, rows_snapshot, action, run_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'saved', ?)
    `).bind(
      runId, ctx.tenantId, body.year, body.month, body.rows.length, totalGross,
      body.rows[0]?.currency ?? 'GBP', JSON.stringify(body.rows), ctx.userId
    ).run();

    await audit(env, {
      ...auditFromRequest(request, ctx),
      action: 'save', resource: 'payroll_report', resourceId: `${body.year}-${body.month}`,
    });

    return ok({ saved: true, runId });
  }

  // ── GET /api/finance/payroll/history?year=&month= — list past runs ──────
  // Simple list, newest first, optionally filtered to a single period.
  // Returns the lightweight summary columns only — not the full rows_snapshot,
  // to keep the list fast; a future "view details" could fetch by id if needed.
  if (subPath === '/payroll/history' && method === 'GET') {
    const denied = requirePermission(ctx, 'hr:view:compensation');
    if (denied) return denied;

    const yearFilter  = url.searchParams.get('year');
    const monthFilter = url.searchParams.get('month');

    const where: string[] = ['pr.tenant_id = ?'];
    const params: unknown[] = [ctx.tenantId];
    if (yearFilter)  { where.push('pr.year = ?');  params.push(parseInt(yearFilter)); }
    if (monthFilter) { where.push('pr.month = ?'); params.push(parseInt(monthFilter)); }

    const res = await env.DB.prepare(`
      SELECT pr.id, pr.year, pr.month, pr.employee_count, pr.total_gross, pr.currency,
             pr.action, pr.emailed_to, pr.run_at,
             u.email AS run_by_email
      FROM payroll_runs pr
      LEFT JOIN users u ON u.id = pr.run_by
      WHERE ${where.join(' AND ')}
      ORDER BY pr.run_at DESC
      LIMIT 100
    `).bind(...params).all();

    return ok({ runs: res.results ?? [] });
  }

  return err('Not found', 404);
}

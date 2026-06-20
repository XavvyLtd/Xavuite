import { SignJWT, jwtVerify } from 'jose';
import { generateSprintTasks } from './helpers/sdlcTemplates';

const ALLOWED_ORIGINS = [
  'https://hr.xavvy.uk',
  'https://timesheet.xavvy.uk',
  'https://projects.xavvy.uk',
  'http://localhost:3000', 
  'http://localhost:5173'
];

function getCorsHeaders(request) {
  const origin = request.headers.get('Origin');
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true'
  };
}

function errorResponse(message, status = 400, headers = {}) {
  return new Response(JSON.stringify({ error: message }), { 
    status, headers: { 'Content-Type': 'application/json', ...headers } 
  });
}

function successResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { 
    status, headers: { 'Content-Type': 'application/json', ...headers } 
  });
}

async function verifyToken(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch (e) { return null; }
}

// ====================================================================
// MODULE: SECURE OUTBOUND TRANS-EMAIL DISPATCH VIA RESEND API
// ====================================================================
async function sendEnterpriseMail(env, toAddress, subject, htmlContent) {
  const mailApiKey = env.EMAIL_PROVIDER_API_KEY;
  
  if (!mailApiKey) {
    console.error("Missing EMAIL_PROVIDER_API_KEY variable configuration assignment.");
    return false;
  }
  
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mailApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'XavvySuite Automation <automation@xavvy.uk>',
        to: Array.isArray(toAddress) ? toAddress : [toAddress],
        subject: subject,
        html: htmlContent
      })
    });
    return response.ok;
  } catch (err) {
    console.error("Outbound communication dispatch failure:", err);
    return false;
  }
}

// ====================================================================
// NATIVE CRON CHRONOLOGY SCHEDULER EXECUTION LAYER HANDLER
// ====================================================================

// =====================================================
// SPRINT LIFECYCLE AUTOMATION ENGINE
// =====================================================

async function runSprintLifecycleAutomation(env) {

  const today =
    new Date().toISOString().split('T')[0];

  // =====================================================
  // FIND CURRENT ACTIVE SPRINT
  // =====================================================

  const currentSprint =
    await env.DB.prepare(`
      SELECT *
      FROM pms_sprints
      WHERE start_date <= ?
      AND end_date >= ?
      ORDER BY sprint_number DESC
      LIMIT 1
    `)
    .bind(today, today)
    .first();

  if (!currentSprint) {

    console.log(
      'No active sprint found'
    );

    return;
  }

  // =====================================================
  // COMPLETE OLD TASKS
  // =====================================================

  await env.DB.prepare(`
    UPDATE pms_tasks
    SET
      status = 'Complete',
      updated_at = CURRENT_TIMESTAMP
    WHERE sprint_id != ?
    AND status = 'In Progress'
  `)
  .bind(currentSprint.id)
  .run();

  // =====================================================
  // ACTIVATE CURRENT TASKS
  // =====================================================

  await env.DB.prepare(`
    UPDATE pms_tasks
    SET
      status = 'In Progress',
      updated_at = CURRENT_TIMESTAMP
    WHERE sprint_id = ?
    AND status = 'Backlog'
  `)
  .bind(currentSprint.id)
  .run();

  // =====================================================
  // LOAD ACTIVE TASKS
  // =====================================================

  const taskResult =
    await env.DB.prepare(`
      SELECT *
      FROM pms_tasks
      WHERE sprint_id = ?
      AND status = 'In Progress'
    `)
    .bind(currentSprint.id)
    .all();

  const tasks =
    taskResult.results || [];

  // =====================================================
  // GENERATE WEEKLY TIMESHEETS
  // =====================================================

  for (const task of tasks) {

    for (let i = 0; i < 5; i++) {

      const monday =
        new Date();

      const day =
        monday.getDay();

      const diff =
        monday.getDate() - day + (day === 0 ? -6 : 1);

      monday.setDate(diff);

      const workDate =
        new Date(monday);

      workDate.setDate(
        monday.getDate() + i
      );

      const workDateStr =
        workDate.toISOString().split('T')[0];

      // DUPLICATE CHECK

      const existing =
        await env.DB.prepare(`
          SELECT id
          FROM timesheets
          WHERE employee_id = ?
          AND task_id = ?
          AND date = ?
          LIMIT 1
        `)
        .bind(
          task.assigned_employee_id,
          task.id,
          workDateStr
        )
        .first();

      if (existing)
        continue;

      // INSERT AUTO TIMESHEET

      await env.DB.prepare(`
        INSERT INTO timesheets (
          employee_id,
          task_id,
          sprint_id,
          date,
          hours_worked,
          description,
          status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        task.assigned_employee_id,
        task.id,
        currentSprint.id,
        workDateStr,
        Number(task.allocated_hours || 8) / 5,
        `[AUTO-SDLC]
        Sprint ${currentSprint.sprint_number}
        ${task.task_name}`,
        'Approved'
      )
      .run();
    }
  }

  console.log(
    `Sprint lifecycle completed for sprint ${currentSprint.sprint_number}`
  );
}

async function handleAutomatedSchedules(cronEvent, env) {
  const cronExpression = cronEvent.cron;
  const today = new Date().toISOString().split('T')[0];

  // 1) MONDAY PENDING LIFECYCLE TASKS DIGEST ROUTINE 
  if (cronExpression === "0 8 * * 1") {
   
   /* const { results } = await env.DB.prepare(`
      SELECT t.task_name, t.phase, t.status, s.sprint_name, e.name as emp_name
      FROM pms_tasks t
      JOIN pms_sprints s ON t.sprint_id = s.id
      LEFT JOIN employees e ON t.assigned_employee_id = e.id
      WHERE t.status != 'Complete'
      ORDER BY s.sprint_number ASC, t.phase ASC
    `).all();
  */
 // =====================================================
  // LOAD ACTIVE SPRINT
  // =====================================================

  const activeSprint =
    await env.DB.prepare(`
      SELECT *
      FROM pms_sprints
      WHERE start_date <= date('now')
      AND end_date >= date('now')
      ORDER BY sprint_number DESC
      LIMIT 1
    `)
    .first();

  if (!activeSprint) {

    console.log(
      "No active sprint found for weekly digest"
    );

    return;
  }

  // =====================================================
  // LOAD ACTIVE OPERATIONAL TASKS
  // =====================================================

    const { results } =
      await env.DB.prepare(`

        SELECT
          t.id,
          t.task_name,
          t.phase,
          t.status,
          t.priority,
          t.allocated_hours,
          s.sprint_name,
          s.sprint_number,
          e.name as emp_name

        FROM pms_tasks t

        JOIN pms_sprints s
          ON t.sprint_id = s.id

        LEFT JOIN employees e
          ON t.assigned_employee_id = e.id

        WHERE t.sprint_id = ?

        AND t.status IN (
          'Backlog',
          'In Progress'
        )

        ORDER BY

          CASE t.phase
            WHEN 'Requirements' THEN 1
            WHEN 'Architecture' THEN 2
            WHEN 'Development' THEN 3
            WHEN 'Testing' THEN 4
            WHEN 'Deployment' THEN 5
            ELSE 99
          END,

          t.priority DESC,
          t.task_name ASC

      `)
      .bind(activeSprint.id)
      .all();
      
    let taskRowsHtml = "";
    if (!results || results.length === 0) {
      taskRowsHtml = `<tr><td colspan="4" style="padding: 15px; text-align: center; color: #64748b; font-family: monospace; background: #0f172a;">Zero incomplete task nodes active in the current stream.</td></tr>`;
    } else {
      results.forEach(row => {
        taskRowsHtml += `
          <tr style="border-bottom: 1px solid #1e293b; background: #0f172a;">
            <td style="padding: 12px; font-weight: bold; color: #3b82f6; font-family: monospace;">${row.sprint_name}</td>
            <td style="padding: 12px; color: #ffffff; font-weight: 500;">${row.task_name}</td>
            <td style="padding: 12px;"><span style="background: #1e1b4b; color: #c084fc; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: bold; font-family: monospace; border: 1px solid #581c87;">${row.phase}</span></td>
            <td style="padding: 12px; color: #f59e0b; font-weight: bold;">${row.emp_name || '⚠️ Unassigned Pool'}</td>
          </tr>`;
      });
    }

    const emailHtml = `
      <div style="background: #020617; color: #f1f5f9; padding: 30px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; min-height: 100%;">
        <div style="max-width: 800px; margin: 0 auto; background: #0f172a; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; padding: 24px;">
          <h2 style="color: #ffffff; border-bottom: 2px solid #3b82f6; padding-bottom: 12px; font-weight: 900; letter-spacing: -0.025em; margin-top: 0;"> ACTIVE SPRINT OPERATIONAL DIGEST</h2>
          <p style="color: #94a3b8; font-size: 14px; margin-bottom: 24px;">Generated on ${today}. Below is the structural operational tracker matrix for all incomplete sprint vectors:</p>
          <table style="width: 100%; text-align: left; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="background: #020617; color: #94a3b8; border-bottom: 2px solid #1e293b; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em;">
                <th style="padding: 12px;">Sprint Target</th>
                <th style="padding: 12px;">Task Context Title</th>
                <th style="padding: 12px;">Execution Phase</th>
                <th style="padding: 12px;">Assigned Resource</th>
              </tr>
            </thead>
            <tbody>${taskRowsHtml}</tbody>
          </table>
          <p style="margin-top: 30px; font-size: 11px; color: #475569; text-align: center; border-top: 1px solid #1e293b; padding-top: 20px;">XavvyPM Automated Notification Engine • projects.xavvy.uk</p>
        </div>
      </div>`;

    await sendEnterpriseMail(env, 'all_staff@xavvy.uk', "Weekly Operational Digest: Pending Lifecycle Tasks Matrix", emailHtml);
  }

  // 2) MONTHLY 26TH TIMESHEETS REMINDER ROUTINE
  if (cronExpression === "0 9 26 * *") {
    const reminderHtml = `
      <div style="background: #020617; color: #f1f5f9; padding: 40px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center;">
        <div style="max-width: 500px; margin: 0 auto; background: #0f172a; border: 1px solid #1e293b; padding: 32px; border-radius: 16px; border-top: 4px solid #f59e0b; text-align: left;">
          <h2 style="color: #ffffff; font-weight: 900; margin-top: 0; margin-bottom: 8px; letter-spacing: -0.025em;">⏰ TIMESHEETS CLOSING WINDOW</h2>
          <p style="color: #f59e0b; font-weight: bold; font-size: 12px; font-family: monospace; text-transform: uppercase; tracking-wider; margin-bottom: 20px; background: #78350f/20; display: inline-block; padding: 4px 8px; border-radius: 4px; border: 1px solid #78350f;">Cycle Target Gate: 26th of the Month</p>
          <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
            This is an automated regulatory notification to confirm your current operational timesheet log entries. 
            Please ensure all completed hours for your active sprint task elements are securely streamed and committed before the administrative locking window closes.
          </p>
          <div style="text-align: center;">
            <a href="https://timesheet.xavvy.uk" style="background: #3b82f6; color: #ffffff; padding: 12px 28px; border-radius: 8px; font-weight: bold; font-size: 13px; text-decoration: none; display: inline-block; text-transform: uppercase; font-family: monospace; letter-spacing: 0.05em; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);">Access Telemetry Console</a>
          </div>
        </div>
        <p style="margin-top: 30px; font-size: 11px; color: #475569;">XavvyTime Resource Governance • timesheet.xavvy.uk</p>
      </div>`;

    await sendEnterpriseMail(env, 'all_staff@xavvy.uk', "Action Required: Monthly Timesheet Submission Deadline Window Open", reminderHtml);
  }

// =====================================================
// FRIDAY TIMESHEET COMPLIANCE REMINDER ENGINE
// =====================================================

if (cronExpression === "0 17 * * 5") {

  console.log(
    "Executing Friday Timesheet Compliance Engine"
  );

  // =====================================================
  // DETERMINE CURRENT WEEK WINDOW
  // =====================================================

  const now = new Date();

  const day =
    now.getDay();

  const diff =
    now.getDate() - day + (day === 0 ? -6 : 1);

  const monday =
    new Date(now);

  monday.setDate(diff);

  monday.setHours(0,0,0,0);

  const friday =
    new Date(monday);

  friday.setDate(
    monday.getDate() + 4
  );

  const mondayStr =
    monday.toISOString().split('T')[0];

  const fridayStr =
    friday.toISOString().split('T')[0];

  // =====================================================
  // FIND TASK ASSIGNMENTS WITH NO TIMESHEETS
  // =====================================================

  const { results } =
    await env.DB.prepare(`
      SELECT
        e.id as employee_id,
        e.name,
        e.designation,
        t.id as task_id,
        t.task_name,
        s.sprint_name
      FROM pms_tasks t

      JOIN employees e
        ON e.id = t.assigned_employee_id

      JOIN pms_sprints s
        ON s.id = t.sprint_id

      WHERE t.status = 'In Progress'

      AND NOT EXISTS (
        SELECT 1
        FROM timesheets ts
        WHERE ts.employee_id = e.id
        AND ts.task_id = t.id
        AND ts.date >= ?
        AND ts.date <= ?
      )

      ORDER BY e.name ASC
    `)
    .bind(
      mondayStr,
      fridayStr
    )
    .all();

  // =====================================================
  // NO MISSING TIMESHEETS
  // =====================================================

  if (!results || results.length === 0) {

    console.log(
      "All sprint task allocations contain timesheets"
    );

    return;
  }

  // =====================================================
  // BUILD EMAIL GRID
  // =====================================================

  let rowsHtml = '';

  results.forEach(row => {

    rowsHtml += `
      <tr style="border-bottom:1px solid #1e293b;">

        <td style="padding:12px;color:#fff;">
          ${row.name}
        </td>

        <td style="padding:12px;color:#94a3b8;">
          ${row.designation || 'Employee'}
        </td>

        <td style="padding:12px;color:#3b82f6;">
          ${row.sprint_name}
        </td>

        <td style="padding:12px;color:#f59e0b;">
          ${row.task_name}
        </td>

      </tr>
    `;
  });

  // =====================================================
  // EMAIL TEMPLATE
  // =====================================================

  const reminderHtml = `
    <div style="background:#020617;padding:30px;color:#f1f5f9;font-family:sans-serif;">

      <div style="max-width:900px;margin:auto;background:#0f172a;border:1px solid #1e293b;border-radius:16px;padding:24px;">

        <h2 style="margin-top:0;color:#fff;">
          ⏰ Missing Weekly Timesheet Entries
        </h2>

        <p style="color:#94a3b8;">
          The following active sprint task allocations
          do not contain any timesheet entries for the
          current operational work week.
        </p>

        <table style="width:100%;border-collapse:collapse;font-size:13px;">

          <thead>
            <tr style="border-bottom:1px solid #1e293b;">

              <th style="padding:12px;text-align:left;color:#94a3b8;">
                Employee
              </th>

              <th style="padding:12px;text-align:left;color:#94a3b8;">
                Designation
              </th>

              <th style="padding:12px;text-align:left;color:#94a3b8;">
                Sprint
              </th>

              <th style="padding:12px;text-align:left;color:#94a3b8;">
                Task
              </th>

            </tr>
          </thead>

          <tbody>
            ${rowsHtml}
          </tbody>

        </table>

      </div>

    </div>
  `;

  // =====================================================
  // SEND EMAIL
  // =====================================================

  await sendEnterpriseMail(
    env,
    'all_staff@xavvy.uk',
    'Action Required: Missing Weekly Timesheet Entries',
    reminderHtml
  );

  console.log(
    `Friday reminder dispatched for ${results.length} missing task allocations`
  );
}

// end of reminder
  // 3) 90-DAY COMPLIANCE "RIGHT TO WORK" SCAN OVERVIEW 
  if (cronExpression === "0 7 * * 1") {
    const validationThresholdDate = new Date();
    validationThresholdDate.setDate(validationThresholdDate.getDate() - 90);
    const thresholdStr = validationThresholdDate.toISOString().split('T')[0];

    const { results } = await env.DB.prepare(`
      SELECT e.id, e.name, e.department, e.designation, c.date_checked, c.is_compliant
      FROM employees e
      LEFT JOIN compliance_records c ON e.id = c.employee_id AND LOWER(c.compliance_name) = 'right to work'
      WHERE c.id IS NULL OR c.date_checked < ? OR c.is_compliant = 0
      ORDER BY e.id ASC
    `).bind(thresholdStr).all();

    let complianceRowsHtml = "";
    if (!results || results.length === 0) {
      complianceRowsHtml = `<tr><td colspan="3" style="padding: 16px; text-align: center; color: #10b981; font-weight: bold; font-family: monospace; background: #0f172a;">All personnel vectors securely cleared. Zero compliance alerts generated.</td></tr>`;
    } else {
      results.forEach(row => {
        const hasRecord = row.date_checked !== null;
        const badgeColor = !hasRecord ? '#ef4444' : '#f59e0b';
        const bgInnerColor = !hasRecord ? '#2d1414' : '#2d2214';
        const labelText = !hasRecord ? '🚨 NEVER CHECKED' : `⏳ EXPIRED (Last: ${row.date_checked})`;

        complianceRowsHtml += `
          <tr style="border-bottom: 1px solid #1e293b; background: #0f172a;">
            <td style="padding: 14px; font-family: monospace; font-weight: bold; color: #3b82f6;">#${String(row.id).padStart(3, '0')}</td>
            <td style="padding: 14px; color: #ffffff;"><div style="font-weight: bold; font-size: 14px;">${row.name}</div><div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">${row.designation} • ${row.department}</div></td>
            <td style="padding: 14px; text-align: right;"><span style="background: ${bgInnerColor}; color: ${badgeColor}; padding: 5px 10px; border-radius: 6px; font-size: 11px; font-weight: bold; font-family: monospace; border: 1px solid ${badgeColor}40; display: inline-block; white-space: nowrap;">${labelText}</span></td>
          </tr>`;
      });
    }

    const reportHtml = `
      <div style="background: #020617; color: #f1f5f9; padding: 30px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="max-width: 750px; margin: 0 auto; background: #0f172a; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; padding: 24px; border-top: 4px solid #ef4444;">
          <h2 style="color: #ffffff; margin-top: 0; padding-bottom: 12px; border-bottom: 2px solid #1e293b; font-weight: 900; letter-spacing: -0.025em;">⚠️ RIGHT TO WORK: COMPLIANCE EXCEPTION REPORT</h2>
          <p style="color: #94a3b8; font-size: 14px; line-height: 1.5; margin-bottom: 24px;">
            The active directory registry scan finished processing on <strong>${today}</strong>. 
            The following personnel records currently violate operational standards due to missing validations or evaluation logs exceeding the 90-day structural lifecycle threshold:
          </p>
          <table style="width: 100%; text-align: left; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="background: #020617; color: #94a3b8; border-bottom: 2px solid #1e293b; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em;">
                <th style="padding: 12px; width: 60px;">ID</th>
                <th style="padding: 12px;">Employee Identity Context</th>
                <th style="padding: 12px; text-align: right;">Standard Exception Violation</th>
              </tr>
            </thead>
            <tbody>${complianceRowsHtml}</tbody>
          </table>
          <p style="margin-top: 30px; font-size: 11px; color: #475569; text-align: center; border-top: 1px solid #1e293b; padding-top: 20px;">XavvyHR Compliance System Governance Hub • hr.xavvy.uk</p>
        </div>
      </div>`;

    await sendEnterpriseMail(env, 'hr@xavvy.uk', "Alert: Right to Work Compliance Exception Matrix Report", reportHtml);
  }

  // 4) NEW: MONDAY VISA EXPIRATION WARNING SCANNER 
  if (cronExpression === "15 6 * * 1") {
    const targetExpirationGate = new Date();
    targetExpirationGate.setDate(targetExpirationGate.getDate() + 30);
    const targetExpirationStr = targetExpirationGate.toISOString().split('T')[0];

    const { results } = await env.DB.prepare(`
      SELECT id, name, department, designation, brp_no, visa_end_date
      FROM employees
      WHERE visa_end_date IS NOT NULL 
        AND visa_end_date != '' 
        AND visa_end_date <= ?
        AND status = 'Active'
      ORDER BY visa_end_date ASC
    `).bind(targetExpirationStr).all();

    let visaRowsHtml = "";
    if (!results || results.length === 0) {
      visaRowsHtml = `<tr><td colSpan="4" style="padding: 16px; text-align: center; color: #10b981; font-weight: bold; font-family: monospace; background: #0f172a;">Zero visa expiration threats detected in the 30-day monitoring window.</td></tr>`;
    } else {
      results.forEach(row => {
        visaRowsHtml += `
          <tr style="border-bottom: 1px solid #1e293b; background: #0f172a;">
            <td style="padding: 12px; font-family: monospace; font-weight: bold; color: #3b82f6;">#${String(row.id).padStart(3, '0')}</td>
            <td style="padding: 12px; color: #ffffff;"><div style="font-weight: bold;">${row.name}</div><div style="font-size: 11px; color: #94a3b8;">${row.designation} (${row.department})</div></td>
            <td style="padding: 12px; font-family: monospace; color: #e2e8f0;">${row.brp_no || 'Not Logged'}</td>
            <td style="padding: 12px; text-align: right;"><span style="background: #2d1414; color: #ef4444; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: bold; font-family: monospace; border: 1px solid #ef444440; display: inline-block;">💥 ${row.visa_end_date}</span></td>
          </tr>`;
      });
    }

    const visaReportHtml = `
      <div style="background: #020617; color: #f1f5f9; padding: 30px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="max-width: 750px; margin: 0 auto; background: #0f172a; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; padding: 24px; border-top: 4px solid #f97316;">
          <h2 style="color: #ffffff; margin-top: 0; padding-bottom: 12px; border-bottom: 2px solid #1e293b; font-weight: 900; letter-spacing: -0.025em;">🛂 VISA & IMMIGRATION EXPIRATION ALERT</h2>
          <p style="color: #94a3b8; font-size: 14px; line-height: 1.5; margin-bottom: 24px;">
            The automated immigration timeline matrix log finished scanning on <strong>${today}</strong>. 
            The following active employee profiles have visas expiring within the **1-month critical buffer window**:
          </p>
          <table style="width: 100%; text-align: left; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="background: #020617; color: #94a3b8; border-bottom: 2px solid #1e293b; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em;">
                <th style="padding: 12px; width: 60px;">ID</th>
                <th style="padding: 12px;">Employee Identity</th>
                <th style="padding: 12px;">BRP / Document No</th>
                <th style="padding: 12px; text-align: right;">Expiration Date</th>
              </tr>
            </thead>
            <tbody>${visaRowsHtml}</tbody>
          </table>
          <p style="margin-top: 30px; font-size: 11px; color: #475569; text-align: center; border-top: 1px solid #1e293b; padding-top: 20px;">XavvyHR Immigration & Border Compliance Module • hr.xavvy.uk</p>
        </div>
      </div>`;

    await sendEnterpriseMail(env, 'hr@xavvy.uk', "Urgent: 1-Month Visa Expiration Compliance Warning Report", visaReportHtml);
  }

// =====================================================
// MASTER MONDAY ENTERPRISE ORCHESTRATOR
// =====================================================

  if (cronExpression === "0 6 * * 1") {

    console.log(
      "Executing Monday Enterprise Orchestrator"
    );

    // =====================================================
    // 1) SPRINT LIFECYCLE
    // =====================================================

    await runSprintLifecycleAutomation(env);

    // =====================================================
    // 2) VISA EXPIRATION ALERTS
    // =====================================================

    await handleAutomatedSchedules(
      { cron: "15 6 * * 1" },
      env
    );

    // =====================================================
    // 3) RIGHT TO WORK COMPLIANCE
    // =====================================================

    await handleAutomatedSchedules(
      { cron: "0 7 * * 1" },
      env
    );

    // =====================================================
    // 4) WEEKLY TASK DIGEST
    // =====================================================

    await handleAutomatedSchedules(
      { cron: "0 8 * * 1" },
      env
    );

    console.log(
      "Monday Enterprise Orchestrator Complete"
    );
  }
  
  /*if (cronExpression === "15 6 * * 1") {

    const today =
      new Date().toISOString().split('T')[0];

    // =====================================================
    // FIND CURRENT ACTIVE SPRINT
    // =====================================================

    const currentSprint =
      await env.DB.prepare(`
          SELECT *
          FROM pms_sprints
          WHERE start_date <= ?
          AND end_date >= ?
          ORDER BY sprint_number DESC
          LIMIT 1
      `)
      .bind(today, today)
      .first();

    if (!currentSprint) {

      console.log(
        'No active sprint found for lifecycle automation'
      );

      return;
    }

    // =====================================================
    // COMPLETE OLD SPRINT TASKS
    // =====================================================

    await env.DB.prepare(`
      UPDATE pms_tasks
      SET
        status = 'Complete',
        updated_at = CURRENT_TIMESTAMP
      WHERE sprint_id != ?
      AND status = 'In Progress'
    `)
    .bind(currentSprint.id)
    .run();

    // =====================================================
    // ACTIVATE CURRENT SPRINT TASKS
    // =====================================================

    await env.DB.prepare(`
      UPDATE pms_tasks
      SET
        status = 'In Progress',
        updated_at = CURRENT_TIMESTAMP
      WHERE sprint_id = ?
      AND status = 'Backlog'
    `)
    .bind(currentSprint.id)
    .run();

    // =====================================================
    // GET CURRENT SPRINT TASKS
    // =====================================================

    const taskResult =
      await env.DB.prepare(`
        SELECT *
        FROM pms_tasks
        WHERE sprint_id = ?
        AND status = 'In Progress'
      `)
      .bind(currentSprint.id)
      .all();

    const tasks =
      taskResult.results || [];

    // =====================================================
    // GENERATE WEEKLY TIMESHEETS
    // =====================================================

    for (const task of tasks) {

      // Monday-Friday
      for (let i = 0; i < 5; i++) {

        const monday =
          new Date();

        const day =
          monday.getDay();

        const diff =
          monday.getDate() - day + (day === 0 ? -6 : 1);

        monday.setDate(diff);

        const workDate =
          new Date(monday);

        workDate.setDate(
          monday.getDate() + i
        );

        const workDateStr =
          workDate
            .toISOString()
            .split('T')[0];

        // =====================================================
        // DUPLICATE CHECK
        // =====================================================

        const existing =
          await env.DB.prepare(`
            SELECT id
            FROM timesheets
            WHERE employee_id = ?
            AND task_id = ?
            AND date = ?
            LIMIT 1
          `)
          .bind(
            task.assigned_employee_id,
            task.id,
            workDateStr
          )
          .first();

        if (existing)
          continue;

        // =====================================================
        // CREATE APPROVED TIMESHEET
        // =====================================================

        await env.DB.prepare(`
          INSERT INTO timesheets (
            employee_id,
            task_id,
            sprint_id,
            date,
            hours_worked,
            description,
            status
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          task.assigned_employee_id,
          task.id,
          currentSprint.id,
          workDateStr,
          Number(task.allocated_hours || 8) / 5,
          `[AUTO-SDLC]
          Sprint ${currentSprint.sprint_number}
        ${task.task_name}`,
          'Approved'
        )
        .run();
      }
    }

    console.log(
      `Sprint lifecycle automation completed for sprint ${currentSprint.sprint_number}`
    );
  }*/

  // =====================================================
  // FRIDAY TIMESHEET REMINDER ENGINE
  // =====================================================

  /*if (cronExpression === "0 17 * * 5") {

    console.log("Executing Friday Timesheet Reminder Engine");

    const pendingTimesheets =
      await env.DB.prepare(`
        SELECT
          e.name,
          COUNT(t.id) pending_count
        FROM employees e
        LEFT JOIN timesheets t
          ON e.id = t.employee_id
          AND t.status != 'Approved'
        GROUP BY e.id
      `).all();

    console.log(
      "Pending Timesheet Summary:",
      JSON.stringify(pendingTimesheets.results)
    );
  }*/

}

export default {
  async fetch(request, env) {
    const corsHeaders = getCorsHeaders(request);
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // --- SECURE DEBUG REMOTELY TRIGGERED CRON GATEWAY ---
    if (path === '/api/debug/trigger-cron' && method === 'GET') {
      const targetCron = url.searchParams.get('cron');
      try {
        if (targetCron === 'tasks') {
          await handleAutomatedSchedules({ cron: "0 8 * * 1" }, env);
          return successResponse({ success: true, message: "Weekly tasks digest event force-fired remotely." }, 200, corsHeaders);
        } 
        if (targetCron === 'timesheet') {
          await handleAutomatedSchedules({ cron: "0 9 26 * *" }, env);
          return successResponse({ success: true, message: "Monthly timesheet warning event force-fired remotely." }, 200, corsHeaders);
        }
        if (targetCron === 'compliance') {
          await handleAutomatedSchedules({ cron: "0 7 * * 1" }, env);
          return successResponse({ success: true, message: "90-day Right to Work compliance audit scan completed successfully." }, 200, corsHeaders);
        }
        if (targetCron === 'visa') {

          await handleAutomatedSchedules(
            { cron: "15 6 * * 1" },
            env
          );

          return successResponse(
            {
              success: true,
              message:
                "Visa expiration alert scan executed successfully."
            },
            200,
            corsHeaders
          );
        }
        return errorResponse("Invalid argument. Use ?cron=tasks, ?cron=timesheet, ?cron=compliance, or ?cron=visa", 400, corsHeaders);
      } catch (err) {
        return errorResponse(`Execution Crash: ${err.message}`, 500, corsHeaders);
      }
    }

    // --- GRACEFUL ONBOARDING MERGED SIGNUP FLOW ---
    if (path === '/api/auth/signup' && method === 'POST') {
      const { name, email, password, department, designation } = await request.json();
      if (!name || !email || !password || !department || !designation) {
        return errorResponse("Missing required field parameters", 400, corsHeaders);
      }

      const existingUser = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();

      try {
        let userId;
        let employeeId;

        if (existingUser) {
          const linkedEmployee = await env.DB.prepare("SELECT * FROM employees WHERE user_id = ?").bind(existingUser.id).first();
          
          if (linkedEmployee && existingUser.password === 'admin123') {
            await env.DB.prepare("UPDATE users SET password = ? WHERE id = ?").bind(password, existingUser.id).run();
            await env.DB.prepare("UPDATE employees SET name = ?, department = ?, designation = ?, status = 'Active' WHERE id = ?")
              .bind(name, department, designation, linkedEmployee.id).run();
              
            userId = existingUser.id;
            employeeId = linkedEmployee.id;
          } else {
            return errorResponse("Email already mapped.", 409, corsHeaders);
          }
        } else {
          const userResult = await env.DB.prepare("INSERT INTO users (email, password, role) VALUES (?, ?, 'employee') RETURNING id")
            .bind(email, password).first();
          
          const joiningDate = new Date().toISOString().split('T')[0];
          const empResult = await env.DB.prepare("INSERT INTO employees (user_id, name, department, designation, joining_date, status, salary) VALUES (?, ?, ?, ?, ?, 'Active', 0) RETURNING id")
            .bind(userResult.id, name, department, designation, joiningDate).first();
            
          userId = userResult.id;
          employeeId = empResult.id;
        }

        const secret = new TextEncoder().encode(env.JWT_SECRET);
        const token = await new SignJWT({
                                  userId,
                                  role: existingUser?.role || 'employee',
                                  employeeId,
                                  email
                                }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('2h').sign(secret);

        return successResponse({ 
          token, 
          user: { email, role: existingUser?.role || 'employee', name, employeeId } 
        }, 200, corsHeaders);

      } catch (e) {
        console.error("Signup handler error:", e);
        return errorResponse("Database error processing account profile mapping.", 500, corsHeaders);
      }
    }

    if (path === '/api/auth/login' && method === 'POST') {
      const { email, password } = await request.json();
      const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
      if (!user || password !== user.password) return errorResponse("Invalid credentials", 401, corsHeaders);
      const employee = await env.DB.prepare("SELECT * FROM employees WHERE user_id = ?").bind(user.id).first();
      const secret = new TextEncoder().encode(env.JWT_SECRET);
      const token = await new SignJWT({
                            userId: user.id,
                            role: user.role,
                            employeeId: employee?.id,
                            email: user.email
                          }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('2h').sign(secret);
      return successResponse({ token, user: { email: user.email, role: user.role, name: employee?.name, employeeId: employee?.id } }, 200, corsHeaders);
    }

    const userPayload = await verifyToken(request, env);
    if (!userPayload) return errorResponse("Unauthorized", 401, corsHeaders);

    // ====================================================================
    // MODULE: XAVVYREPO HIGH-PERFORMANCE STORAGE ENGINE (projects.xavvy.uk)
    // ====================================================================
    
    // Endpoint: Fetch stats for ALL projects (Grid Dashboard View)
    if (path === '/api/repo/projects-overview' && method === 'GET') {
      const isSystemAdmin = userPayload.role === 'admin';
      const userEmail = userPayload.email || 'staff@xavvy.uk';
      
      const query = isSystemAdmin
        ? "SELECT project_id, COUNT(*) as file_count FROM repo_files WHERE is_active = 1 GROUP BY project_id"
        : "SELECT project_id, COUNT(*) as file_count FROM repo_files WHERE is_active = 1 AND user_email = ? GROUP BY project_id";
        
      const { results } = await (isSystemAdmin 
        ? env.DB.prepare(query).all() 
        : env.DB.prepare(query).bind(userEmail).all());
        
      return successResponse(results, 200, corsHeaders);
    }

    // Endpoint: Project-Scoped Files & Commits Routing Block
    if (path.startsWith('/api/projects/') && path.includes('/vault')) {
      const parts = path.split('/');
      const projectId = parts[3]; // Grabs project context identifier string safely

      // GET: Retrieve file manifest array scoped to this project
      if (method === 'GET') {
        const isSystemAdmin = userPayload.role === 'admin';
        const userEmail = userPayload.email || 'staff@xavvy.uk';
        
        const fileQuery = isSystemAdmin
          ? "SELECT * FROM repo_files WHERE project_id = ? AND is_active = 1 ORDER BY timestamp DESC"
          : "SELECT * FROM repo_files WHERE project_id = ? AND user_email = ? AND is_active = 1 ORDER BY timestamp DESC";
          
        const { results } = await (isSystemAdmin
          ? env.DB.prepare(fileQuery).bind(projectId).all()
          : env.DB.prepare(fileQuery).bind(projectId, userEmail).all());
          
        return successResponse(results, 200, corsHeaders);
      }

      // POST: File Commit pipeline with zero-egress R2 mutation and automated D1 historical version tracking
      if (method === 'POST') {
        try {
          const formData = await request.formData();
          const file = formData.get('file');
          const userEmail = userPayload.email || 'staff@xavvy.uk';

          if (!file) return errorResponse("No file bundle attached to form payload.", 400, corsHeaders);

          // 1. Versioning: Demote currently active nodes matching this file name to backup state (is_active = 0)
          await env.DB.prepare(
            "UPDATE repo_files SET is_active = 0 WHERE filename = ? AND project_id = ?"
          ).bind(file.name, projectId).run();

          // 🌟 THE CRITICAL FIX: Convert the high-level browser file stream wrapper directly to a raw ArrayBuffer parameter layout
          const rawBinaryBuffer = await file.arrayBuffer();

          // 2. Storage: Route structural content stream to R2 bucket workspace folder tree safely as pure binary
          const uniqueFileKey = `projects/${projectId}/${Date.now()}-${file.name}`;
          await env.XAVVYREPO.put(uniqueFileKey, rawBinaryBuffer, {
            httpMetadata: { contentType: file.type || 'application/octet-stream' }
          });

          // 3. Metadata Commit: Track tracking entry with calculated sub-query auto-increment logic for version
          await env.DB.prepare(`
            INSERT INTO repo_files (project_id, user_email, filename, file_key, version, is_active) 
            VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(version), 0) + 1 FROM repo_files WHERE filename = ? AND project_id = ?), 1)
          `).bind(projectId, userEmail, file.name, uniqueFileKey, file.name, projectId).run();

          return successResponse({ success: true, key: uniqueFileKey }, 200, corsHeaders);
        } catch (repoErr) {
          console.error("Vault commit operational pipeline error exception:", repoErr);
          return errorResponse(`Repository Commit Aborted: ${repoErr.message}`, 500, corsHeaders);
        }
      }
    }

    // --- PRIVACY ENFORCED ENTERPRISE DIRECTORY QUERY GATEWAY ---
    if (path === '/api/employees' && method === 'GET') {
      const { results } = await env.DB.prepare(" SELECT e.*,m.name as manager_name FROM employees e LEFT JOIN employees m ON e.reporting_manager_id = m.id ORDER BY e.name ASC").all();
      
      const isSystemAdmin = userPayload.role === 'admin';
      const currentUserEmployeeId = userPayload.employeeId ? parseInt(userPayload.employeeId, 10) : null;

      if (isSystemAdmin) {
        return successResponse(results, 200, corsHeaders);
      }

      const sanitizedResults = results.map(emp => {
        const isSelf = currentUserEmployeeId === emp.id;
        if (isSelf) return emp; 
        
        return {
          ...emp,
          mobile: '',   
          address: '',  
          salary: 0     
        };
      });

      return successResponse(sanitizedResults, 200, corsHeaders);
    }

    if (path === '/api/employees' && method === 'POST') {
      const { name, department, designation, joining_date, email, mobile, address, salary, start_date, end_date, role, brp_no, visa_start_date, visa_end_date } = await request.json();
      const userResult = await env.DB.prepare("INSERT INTO users (email, password, role) VALUES (?, 'admin123', ?) RETURNING id").bind(email, role || 'employee').first();
      await env.DB.prepare("INSERT INTO employees (user_id, name, department, designation, joining_date, mobile, address, salary, start_date, end_date, brp_no, visa_start_date, visa_end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(userResult.id, name, department, designation, joining_date, mobile || '', address || '', salary || 0, start_date || joining_date, end_date || '', brp_no || '', visa_start_date || '', visa_end_date || '').run();
      return successResponse({ success: true }, 200, corsHeaders);
    }

    if (path.startsWith('/api/employees/') && method === 'PUT') {
      const id = parseInt(path.split('/').pop(), 10);
      const { name, department, designation, status, mobile, address, salary, start_date, end_date, brp_no, visa_start_date, visa_end_date } = await request.json();
      
      const isSystemAdmin = userPayload.role === 'admin';
      const isTargetSelf = userPayload.employeeId === id;

      if (!isSystemAdmin && !isTargetSelf) {
        return errorResponse("Access Denied: Employees can only update their own profile nodes.", 403, corsHeaders);
      }

      const old = await env.DB.prepare("SELECT * FROM employees WHERE id = ?").bind(id).first();
      if (!old) return errorResponse("Target database entry node missing.", 404, corsHeaders);
      
      const todayStr = new Date().toISOString().split('T')[0];
      
      try {
        const finalDepartment = isSystemAdmin ? (department || old.department) : old.department;
        const finalStatus = isSystemAdmin ? (status || old.status) : old.status;
        const finalSalary = isSystemAdmin ? (salary !== undefined ? Number(salary) : Number(old.salary)) : Number(old.salary);
        const finalDesignation = isSystemAdmin ? (designation || old.designation) : old.designation;
        const finalStartDate = isSystemAdmin ? (start_date || old.start_date) : old.start_date;
        const finalEndDate = isSystemAdmin ? (end_date !== undefined ? end_date : old.end_date) : old.end_date;

        const finalName = name || old.name;
        const finalMobile = mobile !== undefined ? mobile : old.mobile;
        const finalAddress = address !== undefined ? address : old.address;
        
        const finalBRP = brp_no !== undefined ? brp_no : old.brp_no;
        const finalVisaStart = visa_start_date !== undefined ? visa_start_date : old.visa_start_date;
        const finalVisaEnd = visa_end_date !== undefined ? visa_end_date : old.visa_end_date;

        await env.DB.prepare(`
          UPDATE employees 
          SET name = ?, department = ?, designation = ?, status = ?, mobile = ?, address = ?, salary = ?, start_date = ?, end_date = ?, brp_no = ?, visa_start_date = ?, visa_end_date = ?
          WHERE id = ?
        `).bind(
          finalName, finalDepartment, finalDesignation, finalStatus, 
          finalMobile, finalAddress, finalSalary, finalStartDate, finalEndDate,
          finalBRP, finalVisaStart, finalVisaEnd, id
        ).run();

        if (isSystemAdmin) {
          const oldDept = old.department || 'Unassigned';
          const oldStatus = old.status || 'Active';
          const oldSalary = String(old.salary || 0);

          if (department && old.department !== department) {
            await env.DB.prepare("INSERT INTO history (employee_id, change_date, field_changed, old_value, new_value) VALUES (?, ?, 'department', ?, ?)")
              .bind(id, todayStr, oldDept, department).run();
          }
          if (status && old.status !== status) {
            await env.DB.prepare("INSERT INTO history (employee_id, change_date, field_changed, old_value, new_value) VALUES (?, ?, 'status', ?, ?)")
              .bind(id, todayStr, oldStatus, status).run();
          }
          if (Number(old.salary) !== Number(finalSalary)) {
            await env.DB.prepare("INSERT INTO history (employee_id, change_date, field_changed, old_value, new_value) VALUES (?, ?, 'salary', ?, ?)")
              .bind(id, todayStr, oldSalary, String(finalSalary)).run();
          }
        }

        return successResponse({ success: true }, 200, corsHeaders);
      } catch (e) {
        console.error("Relational query processing exception:", e);
        return errorResponse("Database transaction validation fallback triggered.", 500, corsHeaders);
      }
    }

    if (path === '/api/pms/sprints' && method === 'GET') {
      const { results } = await env.DB.prepare("SELECT * FROM pms_sprints ORDER BY sprint_number ASC").all();
      return successResponse(results, 200, corsHeaders);
    }

    if (path === '/api/pms/milestones' && method === 'GET') {
      const { results } = await env.DB.prepare("SELECT * FROM pms_milestones ORDER BY target_date ASC").all();
      return successResponse(results, 200, corsHeaders);
    }

// new code
    if (path === '/api/pms/force-sprint-transition'  && method === 'POST') {

      try {

        // =====================================================
        // EXECUTE MONDAY CRON MANUALLY
        // =====================================================

        await handleAutomatedSchedules(
          {
            cron: "0 6 * * 1"
          },
          env
        );

        return successResponse(
          {
            success: true,
            message:
              'Sprint lifecycle automation executed successfully'
          },
          200,
          corsHeaders
        );

      } catch (err) {

        console.error(err);

        return errorResponse(
          err.message,
          500,
          corsHeaders
        );
      }
    }

    if (path === '/api/pms/initialize-sdlc' && method === 'POST' ) {
    try {

      // =====================================================
      // LOAD ALL SPRINTS
      // =====================================================

      const sprintResult =
        await env.DB.prepare(`
          SELECT *
          FROM pms_sprints
          ORDER BY sprint_number ASC
        `).all();

      const sprints =
        sprintResult.results || [];

      if (sprints.length === 0) {

        return errorResponse(
          'No sprints found',
          400,
          corsHeaders
        );
      }

      const today =
        new Date().toISOString().split('T')[0];

      let totalCreated = 0;

      // =====================================================
      // PROCESS ALL SPRINTS
      // =====================================================

      for (const sprint of sprints) {

        // =====================================================
        // DETERMINE SPRINT STATUS
        // =====================================================

        let taskStatus = 'Backlog';

        if (
          sprint.start_date <= today &&
          sprint.end_date >= today
        ) {
          taskStatus = 'In Progress';
        }

        // =====================================================
        // GENERATE SDLC TASKS
        // =====================================================

        const generatedTasks =
          generateSprintTasks(sprint);

        // =====================================================
        // INSERT TASKS
        // =====================================================

        for (const task of generatedTasks) {

          // Duplicate protection
          const existing =
            await env.DB.prepare(`
              SELECT id
              FROM pms_tasks
              WHERE sprint_id = ?
              AND task_name = ?
              LIMIT 1
            `)
            .bind(
              sprint.id,
              task.task
            )
            .first();

          if (existing)
            continue;

          await env.DB.prepare(`
            INSERT INTO pms_tasks (
              sprint_id,
              assigned_employee_id,
              task_name,
              phase,
              status,
              estimated_hours,
              allocated_hours,
              priority,
              task_category,
              task_order,
              created_at,
              updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `)
          .bind(
            sprint.id,
            task.employeeId,
            task.task,
            task.phase,
            taskStatus,
            8,
            8,
            task.order,
            task.category,
            task.order
          )
          .run();

          totalCreated++;
        }
      }

      return successResponse(
        {
          success: true,
          totalCreated
        },
        200,
        corsHeaders
      );

    } catch (err) {

      console.error(err);

      return errorResponse(
        err.message,
        500,
        corsHeaders
      );
    }
  }
    // end code
    
    if (path === '/api/pms/tasks' && method === 'GET') {
      const { results } = await env.DB.prepare(`
        SELECT t.*, s.sprint_name, e.name as assigned_name, e.designation as assigned_designation
        FROM pms_tasks t
        JOIN pms_sprints s ON t.sprint_id = s.id
        LEFT JOIN employees e ON t.assigned_employee_id = e.id
        ORDER BY t.id DESC
      `).all();
      return successResponse(results, 200, corsHeaders);
    }

    if (path === '/api/pms/tasks' && method === 'POST') {
        const {
          sprint_id,
          assigned_employee_id,
          task_name,
          phase,
          estimated_hours,
          priority
        } = await request.json();

        await env.DB.prepare(`
          INSERT INTO pms_tasks (
            sprint_id,
            assigned_employee_id,
            task_name,
            phase,
            estimated_hours,
            allocated_hours,
            priority,
            status
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          sprint_id,
          assigned_employee_id || null,
          task_name,
          phase,
          estimated_hours || 8,
          estimated_hours || 8,
          priority || 1,
          'Backlog'
        )
        .run();
      return successResponse({ success: true }, 200, corsHeaders);
    }

    if (path.startsWith('/api/pms/tasks/') && method === 'PUT') {
      const id = path.split('/').pop();
      const { status } = await request.json();
      await env.DB.prepare("UPDATE pms_tasks SET status = ? WHERE id = ?").bind(status, id).run();
      return successResponse({ success: true }, 200, corsHeaders);
    }

    if (path === '/api/my-tasks' && method === 'GET') {
      if (!userPayload.employeeId) return successResponse([], 200, corsHeaders);
      const { results } = await env.DB.prepare(`
        SELECT t.id, t.task_name, s.sprint_name 
        FROM pms_tasks t
        JOIN pms_sprints s ON t.sprint_id = s.id
        WHERE t.assigned_employee_id = ? AND t.status != 'Complete'
      `).bind(userPayload.employeeId).all();
      return successResponse(results, 200, corsHeaders);
    }

    if (path === '/api/compliance' && method === 'GET') {
      const { results } = await env.DB.prepare("SELECT c.*, e.name as employee_name FROM compliance_records c JOIN employees e ON c.employee_id = e.id ORDER BY c.id DESC").all();
      return successResponse(results, 200, corsHeaders);
    }

    if (path === '/api/compliance' && method === 'POST') {
      const { employee_id, compliance_name, is_compliant, date_checked } = await request.json();
      await env.DB.prepare("INSERT INTO compliance_records (employee_id, compliance_name, is_compliant, date_checked) VALUES (?, ?, ?, ?)")
        .bind(employee_id, compliance_name, is_compliant, date_checked).run();
      return successResponse({ success: true }, 200, corsHeaders);
    }

    if (path === '/api/timesheets' && method === 'GET') {
      const q = userPayload.role === 'admin' ? "SELECT t.*, e.name FROM timesheets t JOIN employees e ON t.employee_id = e.id" : "SELECT t.*, e.name FROM timesheets t JOIN employees e ON t.employee_id = e.id WHERE t.employee_id = ?";
      const { results } = await (userPayload.role === 'admin' ? env.DB.prepare(q).all() : env.DB.prepare(q).bind(userPayload.employeeId).all());
      return successResponse(results, 200, corsHeaders);
    }

    if (path === '/api/timesheets' && method === 'POST') {
      const {
        date,
        hours_worked,
        description,
        task_id,
        sprint_id
      } = await request.json();

      await env.DB.prepare(`
        INSERT INTO timesheets (
          employee_id,
          task_id,
          sprint_id,
          date,
          hours_worked,
          description
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .bind(
        userPayload.employeeId,
        task_id || null,
        sprint_id || null,
        date,
        hours_worked,
        description
      )
      .run();
      return successResponse({ success: true }, 200, corsHeaders);
    }

    if (path.startsWith('/api/timesheets/') && method === 'PUT') {
      const id = path.split('/').pop();
      const { status } = await request.json();
      await env.DB.prepare("UPDATE timesheets SET status = ? WHERE id = ?").bind(status, id).run();
      return successResponse({ success: true }, 200, corsHeaders);
    }

    if (path === '/api/leaves' && method === 'GET') {
      const q = userPayload.role === 'admin' ? "SELECT l.*, e.name FROM leaves l JOIN employees e ON l.employee_id = e.id" : "SELECT l.*, e.name FROM leaves l JOIN employees e ON l.employee_id = e.id WHERE l.employee_id = ?";
      const { results } = await (userPayload.role === 'admin' ? env.DB.prepare(q).all() : env.DB.prepare(q).bind(userPayload.employeeId).all());
      return successResponse(results, 200, corsHeaders);
    }

    if (path === '/api/leaves' && method === 'POST') {
      const { start_date, end_date, type, reason } = await request.json();
      await env.DB.prepare("INSERT INTO leaves (employee_id, start_date, end_date, type, reason) VALUES (?, ?, ?, ?, ?)")
        .bind(userPayload.employeeId, start_date, end_date, type, reason).run();
      return successResponse({ success: true }, 200, corsHeaders);
    }

    if (path.startsWith('/api/leaves/') && method === 'PUT') {
      const id = path.split('/').pop();
      const { status } = await request.json();
      await env.DB.prepare("UPDATE leaves SET status = ? WHERE id = ?").bind(status, id).run();
      return successResponse({ success: true }, 200, corsHeaders);
    }

    if (path === '/api/history' && method === 'GET') {
      const { results } = await env.DB.prepare("SELECT h.*, e.name FROM history h JOIN employees e ON h.employee_id = e.id ORDER BY h.id DESC").all();
      return successResponse(results, 200, corsHeaders);
    }

    return errorResponse("Endpoint missing", 404, corsHeaders);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleAutomatedSchedules(event, env));
  }
};
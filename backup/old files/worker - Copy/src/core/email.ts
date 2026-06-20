import type { Env } from '../types';

const RESEND_URL = 'https://api.resend.com/emails';

interface MailOptions {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}

export async function sendMail(env: Env, opts: MailOptions): Promise<boolean> {
  if (!env.EMAIL_API_KEY) {
    console.error('[email] EMAIL_API_KEY not configured');
    return false;
  }
  console.log('[email] Using API key prefix:', env.EMAIL_API_KEY?.slice(0, 10));
  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.EMAIL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: Array.isArray(opts.to) ? opts.to : [opts.to],
        subject: opts.subject,
        html: opts.html,
        reply_to: opts.replyTo,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error('[email] Resend error:', res.status, body);
    }
    return res.ok;
  } catch (err) {
    console.error('[email] Dispatch failed:', err);
    return false;
  }
}

// ── Email templates ──────────────────────────────────────────────────────────

function layout(title: string, body: string, company = 'XavvySuite'): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
  .wrap { max-width: 600px; margin: 32px auto; background: #fff; border-radius: 8px; overflow: hidden; }
  .header { background: #0F2A4A; padding: 24px 32px; }
  .header h1 { color: #fff; margin: 0; font-size: 18px; }
  .header p { color: #94A3B8; margin: 4px 0 0; font-size: 12px; }
  .body { padding: 32px; color: #1a1a1a; font-size: 14px; line-height: 1.6; }
  .footer { background: #f4f4f4; padding: 16px 32px; font-size: 11px; color: #888; border-top: 1px solid #e0e0e0; }
  .btn { display: inline-block; background: #1D6FA4; color: #fff; padding: 10px 22px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 16px; }
  .tag { display: inline-block; background: #e8f4fb; color: #1D6FA4; padding: 2px 10px; border-radius: 4px; font-size: 12px; font-weight: bold; }
</style></head><body>
<div class="wrap">
  <div class="header"><h1>${company}</h1><p>Workforce Operations Platform</p></div>
  <div class="body">${body}</div>
  <div class="footer">This is an automated message from ${company}. Do not reply directly to this email.</div>
</div></body></html>`;
}

export function leaveRequestEmail(opts: {
  managerName: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  approvalUrl: string;
}): string {
  return layout('Leave Request', `
    <p>Hi ${opts.managerName},</p>
    <p><strong>${opts.employeeName}</strong> has submitted a leave request requiring your approval.</p>
    <table style="border-collapse:collapse;width:100%;margin:16px 0;font-size:13px;">
      <tr><td style="padding:8px;border:1px solid #e0e0e0;color:#666;width:140px;">Leave Type</td><td style="padding:8px;border:1px solid #e0e0e0;">${opts.leaveType}</td></tr>
      <tr><td style="padding:8px;border:1px solid #e0e0e0;color:#666;">From</td><td style="padding:8px;border:1px solid #e0e0e0;">${opts.startDate}</td></tr>
      <tr><td style="padding:8px;border:1px solid #e0e0e0;color:#666;">To</td><td style="padding:8px;border:1px solid #e0e0e0;">${opts.endDate}</td></tr>
      <tr><td style="padding:8px;border:1px solid #e0e0e0;color:#666;">Days</td><td style="padding:8px;border:1px solid #e0e0e0;">${opts.days}</td></tr>
      <tr><td style="padding:8px;border:1px solid #e0e0e0;color:#666;">Reason</td><td style="padding:8px;border:1px solid #e0e0e0;">${opts.reason}</td></tr>
    </table>
    <a href="${opts.approvalUrl}" class="btn">Review Request →</a>
  `);
}

export function leaveDecisionEmail(opts: {
  employeeName: string;
  decision: 'approved' | 'declined';
  leaveType: string;
  startDate: string;
  endDate: string;
  comment?: string;
}): string {
  const approved = opts.decision === 'approved';
  return layout('Leave Request Update', `
    <p>Hi ${opts.employeeName},</p>
    <p>Your leave request has been <strong style="color:${approved ? '#0D6830' : '#8B1A1A'}">${opts.decision}</strong>.</p>
    <p><span class="tag">${opts.leaveType}</span> &nbsp; ${opts.startDate} → ${opts.endDate}</p>
    ${opts.comment ? `<p style="color:#666;font-style:italic;">Comment: ${opts.comment}</p>` : ''}
  `);
}

export function timesheetReminderEmail(opts: { name: string; weekEnding: string }): string {
  return layout('Timesheet Reminder', `
    <p>Hi ${opts.name},</p>
    <p>This is a reminder to submit your timesheet for the week ending <strong>${opts.weekEnding}</strong>.</p>
    <p>Please log in to submit your hours before end of day Friday.</p>
  `);
}

export function welcomeEmail(opts: { name: string; email: string; loginUrl: string }): string {
  return layout('Welcome to XavvySuite', `
    <p>Hi ${opts.name},</p>
    <p>Your XavvySuite account has been created. You can now log in using your work email.</p>
    <p><strong>Email:</strong> ${opts.email}</p>
    <p>Click below to set your password and access the platform.</p>
    <a href="${opts.loginUrl}" class="btn">Set Password & Log In →</a>
  `);
}

export function complianceAlertEmail(opts: {
  items: Array<{ name: string; item: string; status: string; expires: string }>;
}): string {
  const rows = opts.items.map(i =>
    `<tr><td style="padding:8px;border:1px solid #e0e0e0;">${i.name}</td>
     <td style="padding:8px;border:1px solid #e0e0e0;">${i.item}</td>
     <td style="padding:8px;border:1px solid #e0e0e0;color:${i.status==='Expired'?'#8B1A1A':'#7A4F00'};font-weight:bold;">${i.status}</td>
     <td style="padding:8px;border:1px solid #e0e0e0;">${i.expires}</td></tr>`
  ).join('');
  return layout('Compliance Action Required', `
    <p>The following compliance items require immediate attention:</p>
    <table style="border-collapse:collapse;width:100%;font-size:13px;margin:16px 0;">
      <tr style="background:#f4f4f4;">
        <th style="padding:8px;border:1px solid #e0e0e0;text-align:left;">Employee</th>
        <th style="padding:8px;border:1px solid #e0e0e0;text-align:left;">Item</th>
        <th style="padding:8px;border:1px solid #e0e0e0;text-align:left;">Status</th>
        <th style="padding:8px;border:1px solid #e0e0e0;text-align:left;">Expiry</th>
      </tr>
      ${rows}
    </table>
  `);
}

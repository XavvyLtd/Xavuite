import { z } from 'zod';
import { ok, created, err, notFound } from '../../core/response';
import { requirePermission, hasPermission } from '../../middleware/auth';
import { audit, auditFromRequest } from '../../middleware/audit';
import { sendMail } from '../../core/email';
import { startWorkflow } from '../../platform/workflow/engine';
import type { Env, AppContext } from '../../types';

// ── Schemas ───────────────────────────────────────────────────────────────────
const RequisitionSchema = z.object({
  title:          z.string().min(1),
  departmentId:   z.string().optional(),
  location:       z.string().optional(),
  locationType:   z.enum(['office','remote','hybrid']).default('hybrid'),
  employmentType: z.string().default('full_time'),
  headcount:      z.number().int().positive().default(1),
  reason:         z.string().optional(),
  justification:  z.string().optional(),
  salaryMin:      z.number().positive().optional(),
  salaryMax:      z.number().positive().optional(),
  currency:       z.string().default('GBP'),
  targetStart:    z.string().optional(),
  priority:       z.enum(['low','medium','high','urgent']).default('medium'),
});

const CandidateSchema = z.object({
  firstName:    z.string().min(1),
  lastName:     z.string().min(1),
  email:        z.string().email(),
  phone:        z.string().optional(),
  location:     z.string().optional(),
  linkedinUrl:  z.string().optional(),
  source:       z.enum(['direct','linkedin','referral','agency','job_board','website','other']).default('direct'),
  referralBy:   z.string().optional(),
  tags:         z.array(z.string()).default([]),
  notes:        z.string().optional(),
});

const ApplicationSchema = z.object({
  jobId:       z.string(),
  candidateId: z.string(),
});

const StageSchema = z.object({
  stage:  z.string(),
  note:   z.string().optional(),
});

const InterviewSchema = z.object({
  applicationId:  z.string(),
  stageName:      z.string().min(1),
  interviewType:  z.enum(['phone','video','in_person','technical','panel']).default('video'),
  scheduledAt:    z.string(),
  durationMins:   z.number().default(60),
  location:       z.string().optional(),
  notes:          z.string().optional(),
  interviewerIds: z.array(z.string()).default([]),
});

const InterviewFeedbackSchema = z.object({
  score:          z.number().min(1).max(5),
  feedback:       z.string().min(1),
  recommendation: z.enum(['strong_yes','yes','maybe','no','strong_no']),
  status:         z.enum(['completed','no_show']).default('completed'),
});

const OfferSchema = z.object({
  applicationId:  z.string(),
  candidateId:    z.string(),
  jobId:          z.string(),
  salary:         z.number().positive(),
  currency:       z.string().default('GBP'),
  startDate:      z.string().optional(),
  contractType:   z.string().default('permanent'),
  employmentType: z.string().default('full_time'),
  location:       z.string().optional(),
  benefits:       z.array(z.string()).default([]),
});

// ── Route handler ─────────────────────────────────────────────────────────────
export async function handleRecruitment(
  request: Request, env: Env, ctx: AppContext, subPath: string
): Promise<Response> {
  const [resource, id, action] = subPath.split('/').filter(Boolean);

  // ═══════════════════════════════
  // REQUISITIONS
  // ═══════════════════════════════
  if (resource === 'requisitions') {
    if (!id && request.method === 'GET') {
      const url = new URL(request.url);
      const status = url.searchParams.get('status');
      let where = 'r.tenant_id = ?';
      const params: unknown[] = [ctx.tenantId];
      if (status) { where += ' AND r.status = ?'; params.push(status); }

      const rows = await env.DB.prepare(`
        SELECT r.*, d.name as department_name,
               u.email as requested_by_email,
               (SELECT COUNT(*) FROM job_postings jp WHERE jp.requisition_id = r.id) as posting_count
        FROM job_requisitions r
        LEFT JOIN departments d ON d.id = r.department_id
        LEFT JOIN users u ON u.id = r.requested_by
        WHERE ${where}
        ORDER BY r.created_at DESC LIMIT 100
      `).bind(...params).all();
      return ok(rows.results);
    }

    if (!id && request.method === 'POST') {
      const body = await request.json().catch(() => null);
      const parsed = RequisitionSchema.safeParse(body);
      if (!parsed.success) return err(parsed.error.issues[0].message);
      const d = parsed.data;
      const reqId = crypto.randomUUID();

      await env.DB.prepare(`
        INSERT INTO job_requisitions (id, tenant_id, title, department_id, location, location_type, employment_type, headcount, reason, justification, salary_min, salary_max, currency, target_start, priority, status, requested_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_approval', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(reqId, ctx.tenantId, d.title, d.departmentId ?? null, d.location ?? null, d.locationType, d.employmentType, d.headcount, d.reason ?? null, d.justification ?? null, d.salaryMin ?? null, d.salaryMax ?? null, d.currency, d.targetStart ?? null, d.priority, ctx.userId).run();

      // Start vacancy approval workflow
      await startWorkflow(env, {
        definitionKey: 'recruitment_approval',
        recordType:    'job_requisition',
        recordId:      reqId,
        submittedBy:   ctx.userId!,
        tenantId:      ctx.tenantId,
      });

      await audit(env, { ...auditFromRequest(request, ctx), action: 'create', resource: 'job_requisition', resourceId: reqId });
      return created({ id: reqId });
    }

    if (id && action === 'approve' && request.method === 'POST') {
      const denied = requirePermission(ctx, 'recruitment:manage:job_posting');
      if (denied) return denied;
      await env.DB.prepare(
        `UPDATE job_requisitions SET status='approved', approved_by=?, approved_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=?`
      ).bind(ctx.userId, id, ctx.tenantId).run();
      return ok({ id, status: 'approved' });
    }
  }

  // ═══════════════════════════════
  // JOB POSTINGS
  // ═══════════════════════════════
  if (resource === 'jobs' || (!resource && request.method === 'GET')) {
    if (!id && request.method === 'GET') {
      const url = new URL(request.url);
      const status = url.searchParams.get('status');
      let where = 'j.tenant_id = ?';
      const params: unknown[] = [ctx.tenantId];
      if (status) { where += ' AND j.status = ?'; params.push(status); }

      const rows = await env.DB.prepare(`
        SELECT j.*, d.name as department_name,
               (SELECT COUNT(*) FROM job_applications a WHERE a.job_id = j.id) as applicant_count,
               (SELECT COUNT(*) FROM job_applications a WHERE a.job_id = j.id AND a.stage = 'hired') as hired_count
        FROM job_postings j
        LEFT JOIN departments d ON d.id = j.department_id
        WHERE ${where}
        ORDER BY j.created_at DESC
      `).bind(...params).all();
      return ok(rows.results);
    }

    if (id && !action && request.method === 'GET') {
      const job = await env.DB.prepare(`
        SELECT j.*, d.name as department_name FROM job_postings j
        LEFT JOIN departments d ON d.id = j.department_id
        WHERE j.id = ? AND j.tenant_id = ?
      `).bind(id, ctx.tenantId).first();
      if (!job) return notFound('Job not found');

      const applications = await env.DB.prepare(`
        SELECT a.*, c.first_name, c.last_name, c.email as candidate_email, c.source
        FROM job_applications a
        JOIN candidates c ON c.id = a.candidate_id
        WHERE a.job_id = ? AND a.tenant_id = ?
        ORDER BY a.applied_at DESC
      `).bind(id, ctx.tenantId).all();

      return ok({ ...job, applications: applications.results });
    }

    if (id && action === 'publish' && request.method === 'POST') {
      const denied = requirePermission(ctx, 'recruitment:create:job_posting');
      if (denied) return denied;
      await env.DB.prepare(
        `UPDATE job_postings SET status='open', published_at=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=?`
      ).bind(id, ctx.tenantId).run();
      return ok({ id, status: 'open' });
    }

    if (id && action === 'close' && request.method === 'POST') {
      const denied = requirePermission(ctx, 'recruitment:manage:job_posting');
      if (denied) return denied;
      await env.DB.prepare(
        `UPDATE job_postings SET status='closed', filled_at=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=?`
      ).bind(id, ctx.tenantId).run();
      return ok({ id, status: 'closed' });
    }
  }

  // ═══════════════════════════════
  // CANDIDATES
  // ═══════════════════════════════
  if (resource === 'candidates') {
    if (!id && request.method === 'GET') {
      const url = new URL(request.url);
      const search = url.searchParams.get('search') ?? '';
      const source = url.searchParams.get('source');

      let where = 'c.tenant_id = ?';
      const params: unknown[] = [ctx.tenantId];
      if (search) { where += ` AND (c.first_name || ' ' || c.last_name LIKE ? OR c.email LIKE ?)`; params.push(`%${search}%`, `%${search}%`); }
      if (source) { where += ' AND c.source = ?'; params.push(source); }

      const rows = await env.DB.prepare(`
        SELECT c.*,
               (SELECT COUNT(*) FROM job_applications a WHERE a.candidate_id = c.id) as application_count,
               (SELECT GROUP_CONCAT(j.title, ', ') FROM job_applications a JOIN job_postings j ON j.id = a.job_id WHERE a.candidate_id = c.id LIMIT 3) as applied_to
        FROM candidates c
        WHERE ${where}
        ORDER BY c.created_at DESC LIMIT 200
      `).bind(...params).all();
      return ok(rows.results);
    }

    if (!id && request.method === 'POST') {
      const body = await request.json().catch(() => null);
      const parsed = CandidateSchema.safeParse(body);
      if (!parsed.success) return err(parsed.error.issues[0].message);
      const d = parsed.data;

      const existing = await env.DB.prepare(`SELECT id FROM candidates WHERE email=? AND tenant_id=?`).bind(d.email.toLowerCase(), ctx.tenantId).first();
      if (existing) return err(`Candidate with email ${d.email} already exists`, 409);

      const candId = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT INTO candidates (id, tenant_id, first_name, last_name, email, phone, location, linkedin_url, source, referral_by, tags, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(candId, ctx.tenantId, d.firstName, d.lastName, d.email.toLowerCase(), d.phone ?? null, d.location ?? null, d.linkedinUrl ?? null, d.source, d.referralBy ?? null, JSON.stringify(d.tags), d.notes ?? null).run();

      await audit(env, { ...auditFromRequest(request, ctx), action: 'create', resource: 'candidate', resourceId: candId });
      return created({ id: candId });
    }

    if (id && !action && request.method === 'GET') {
      const candidate = await env.DB.prepare(`SELECT * FROM candidates WHERE id=? AND tenant_id=?`).bind(id, ctx.tenantId).first();
      if (!candidate) return notFound('Candidate not found');

      const applications = await env.DB.prepare(`
        SELECT a.*, j.title as job_title, j.status as job_status
        FROM job_applications a
        JOIN job_postings j ON j.id = a.job_id
        WHERE a.candidate_id = ? AND a.tenant_id = ?
        ORDER BY a.applied_at DESC
      `).bind(id, ctx.tenantId).all();

      const interviews = await env.DB.prepare(`
        SELECT i.* FROM interviews i
        JOIN job_applications a ON a.id = i.application_id
        WHERE a.candidate_id = ? AND i.tenant_id = ?
        ORDER BY i.scheduled_at DESC
      `).bind(id, ctx.tenantId).all();

      return ok({ ...candidate, applications: applications.results, interviews: interviews.results });
    }

    if (id && !action && request.method === 'PATCH') {
      const body = await request.json() as any;
      const allowed = ['first_name','last_name','phone','location','linkedin_url','source','notes','tags','status'];
      const sets = ['updated_at = CURRENT_TIMESTAMP'];
      const params: unknown[] = [];
      for (const [k, v] of Object.entries(body)) {
        if (allowed.includes(k)) { sets.push(`${k} = ?`); params.push(k === 'tags' ? JSON.stringify(v) : v); }
      }
      await env.DB.prepare(`UPDATE candidates SET ${sets.join(', ')} WHERE id=? AND tenant_id=?`).bind(...params, id, ctx.tenantId).run();
      return ok({ id });
    }
  }

  // ═══════════════════════════════
  // APPLICATIONS
  // ═══════════════════════════════
  if (resource === 'applications') {
    if (!id && request.method === 'POST') {
      const body = await request.json().catch(() => null);
      const parsed = ApplicationSchema.safeParse(body);
      if (!parsed.success) return err(parsed.error.issues[0].message);

      const existing = await env.DB.prepare(`SELECT id FROM job_applications WHERE job_id=? AND candidate_id=? AND tenant_id=?`).bind(parsed.data.jobId, parsed.data.candidateId, ctx.tenantId).first();
      if (existing) return err('Candidate already applied to this job', 409);

      const appId = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT INTO job_applications (id, tenant_id, job_id, candidate_id, stage, stage_order, applied_at, updated_at, created_by)
        VALUES (?, ?, ?, ?, 'applied', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)
      `).bind(appId, ctx.tenantId, parsed.data.jobId, parsed.data.candidateId, ctx.userId).run();

      // Update application count on job
      await env.DB.prepare(`UPDATE job_postings SET application_count = application_count + 1 WHERE id=?`).bind(parsed.data.jobId).run();

      await audit(env, { ...auditFromRequest(request, ctx), action: 'create', resource: 'job_application', resourceId: appId });
      return created({ id: appId });
    }

    if (id && action === 'stage' && request.method === 'PATCH') {
      const body = await request.json().catch(() => null);
      const parsed = StageSchema.safeParse(body);
      if (!parsed.success) return err(parsed.error.issues[0].message);

      const app = await env.DB.prepare(`SELECT * FROM job_applications WHERE id=? AND tenant_id=?`).bind(id, ctx.tenantId).first() as any;
      if (!app) return notFound('Application not found');

      const STAGE_ORDER: Record<string, number> = { applied: 1, screening: 2, phone_screen: 3, interview: 4, assessment: 5, offer: 6, hired: 7, rejected: 8, withdrawn: 9 };
      const stageOrder = STAGE_ORDER[parsed.data.stage] ?? 1;

      await env.DB.batch([
        env.DB.prepare(`UPDATE job_applications SET stage=?, stage_order=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=?`).bind(parsed.data.stage, stageOrder, id, ctx.tenantId),
        env.DB.prepare(`INSERT INTO application_stage_history (id, application_id, tenant_id, from_stage, to_stage, moved_by, note) VALUES (?,?,?,?,?,?,?)`).bind(crypto.randomUUID(), id, ctx.tenantId, app.stage, parsed.data.stage, ctx.userId, parsed.data.note ?? null),
      ]);

      // If hired — update candidate status
      if (parsed.data.stage === 'hired') {
        await env.DB.prepare(`UPDATE candidates SET status='hired', updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(app.candidate_id).run();
        await env.DB.prepare(`UPDATE job_postings SET status='filled', filled_at=CURRENT_TIMESTAMP WHERE id=?`).bind(app.job_id).run();
      }
      if (parsed.data.stage === 'rejected') {
        await env.DB.prepare(`UPDATE candidates SET updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(app.candidate_id).run();
      }

      await audit(env, { ...auditFromRequest(request, ctx), action: 'update', resource: 'job_application', resourceId: id, metadata: { from: app.stage, to: parsed.data.stage } });
      return ok({ id, stage: parsed.data.stage });
    }

    if (id && action === 'reject' && request.method === 'POST') {
      const { reason } = await request.json() as any;
      await env.DB.batch([
        env.DB.prepare(`UPDATE job_applications SET stage='rejected', rejection_reason=?, rejected_by=?, rejected_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=?`).bind(reason ?? null, ctx.userId, id, ctx.tenantId),
        env.DB.prepare(`INSERT INTO application_stage_history (id, application_id, tenant_id, from_stage, to_stage, moved_by, note) VALUES (?,?,?,?,?,?,?)`).bind(crypto.randomUUID(), id, ctx.tenantId, 'current', 'rejected', ctx.userId, reason ?? null),
      ]);
      return ok({ id, stage: 'rejected' });
    }
  }

  // ═══════════════════════════════
  // INTERVIEWS
  // ═══════════════════════════════
  if (resource === 'interviews') {
    if (!id && request.method === 'GET') {
      const url = new URL(request.url);
      const applicationId = url.searchParams.get('applicationId');
      const upcoming      = url.searchParams.get('upcoming') === 'true';

      let where = 'i.tenant_id = ?';
      const params: unknown[] = [ctx.tenantId];
      if (applicationId) { where += ' AND i.application_id = ?'; params.push(applicationId); }
      if (upcoming)      { where += " AND i.scheduled_at >= datetime('now') AND i.status = 'scheduled'"; }

      const rows = await env.DB.prepare(`
        SELECT i.*,
               c.first_name || ' ' || c.last_name AS candidate_name, c.email AS candidate_email,
               j.title AS job_title
        FROM interviews i
        JOIN job_applications a ON a.id = i.application_id
        JOIN candidates c ON c.id = a.candidate_id
        JOIN job_postings j ON j.id = a.job_id
        WHERE ${where}
        ORDER BY i.scheduled_at ASC LIMIT 100
      `).bind(...params).all();
      return ok(rows.results);
    }

    if (!id && request.method === 'POST') {
      const body = await request.json().catch(() => null);
      const parsed = InterviewSchema.safeParse(body);
      if (!parsed.success) return err(parsed.error.issues[0].message);
      const d = parsed.data;
      const intId = crypto.randomUUID();

      await env.DB.prepare(`
        INSERT INTO interviews (id, tenant_id, application_id, stage_name, interview_type, scheduled_at, duration_mins, location, notes, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')
      `).bind(intId, ctx.tenantId, d.applicationId, d.stageName, d.interviewType, d.scheduledAt, d.durationMins, d.location ?? null, d.notes ?? null).run();

      // Add interviewers
      if (d.interviewerIds.length > 0) {
        const stmts = d.interviewerIds.map(eid =>
          env.DB.prepare(`INSERT OR IGNORE INTO interview_interviewers (interview_id, employee_id, role) VALUES (?, ?, 'interviewer')`).bind(intId, eid)
        );
        await env.DB.batch(stmts);
      }

      // Notify candidate
      const app = await env.DB.prepare(`
        SELECT c.email, c.first_name, j.title
        FROM job_applications a
        JOIN candidates c ON c.id = a.candidate_id
        JOIN job_postings j ON j.id = a.job_id
        WHERE a.id = ?
      `).bind(d.applicationId).first() as any;

      if (app?.email) {
        const scheduledDate = new Date(d.scheduledAt).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        await sendMail(env, {
          to:      app.email,
          subject: `Interview Scheduled: ${app.title} at ${env.TENANT_NAME}`,
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#0F2A4A;padding:20px 24px"><h2 style="color:#fff;margin:0">Interview Scheduled</h2><p style="color:#94A3B8;margin:4px 0 0;font-size:12px">${env.TENANT_NAME}</p></div>
            <div style="padding:24px">
              <p>Hi ${app.first_name},</p>
              <p>Your <strong>${d.stageName}</strong> interview for <strong>${app.title}</strong> has been scheduled.</p>
              <table style="border-collapse:collapse;width:100%;margin:16px 0">
                <tr><td style="padding:8px;border:1px solid #e0e0e0;color:#666">Date &amp; Time</td><td style="padding:8px;border:1px solid #e0e0e0;font-weight:bold">${scheduledDate}</td></tr>
                <tr><td style="padding:8px;border:1px solid #e0e0e0;color:#666">Format</td><td style="padding:8px;border:1px solid #e0e0e0">${d.interviewType.replace(/_/g,' ')}</td></tr>
                <tr><td style="padding:8px;border:1px solid #e0e0e0;color:#666">Duration</td><td style="padding:8px;border:1px solid #e0e0e0">${d.durationMins} minutes</td></tr>
                ${d.location ? `<tr><td style="padding:8px;border:1px solid #e0e0e0;color:#666">Location/Link</td><td style="padding:8px;border:1px solid #e0e0e0">${d.location}</td></tr>` : ''}
              </table>
              <p>Please confirm your attendance by replying to this email.</p>
              <p>Best of luck!</p>
            </div>
          </div>`,
        });
      }

      // Advance application stage
      await env.DB.prepare(`UPDATE job_applications SET stage='interview', updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(d.applicationId).run();

      await audit(env, { ...auditFromRequest(request, ctx), action: 'create', resource: 'interview', resourceId: intId });
      return created({ id: intId });
    }

    if (id && action === 'feedback' && request.method === 'POST') {
      const body = await request.json().catch(() => null);
      const parsed = InterviewFeedbackSchema.safeParse(body);
      if (!parsed.success) return err(parsed.error.issues[0].message);
      const d = parsed.data;

      await env.DB.prepare(`
        UPDATE interviews SET score=?, feedback=?, recommendation=?, status=? WHERE id=? AND tenant_id=?
      `).bind(d.score, d.feedback, d.recommendation, d.status, id, ctx.tenantId).run();

      // Mark interviewer feedback given
      await env.DB.prepare(`
        UPDATE interview_interviewers SET feedback_given=1 WHERE interview_id=? AND employee_id=(SELECT id FROM employees WHERE user_id=? AND tenant_id=?)
      `).bind(id, ctx.userId, ctx.tenantId).run();

      return ok({ id, recommendation: d.recommendation });
    }

    if (id && action === 'cancel' && request.method === 'POST') {
      await env.DB.prepare(`UPDATE interviews SET status='cancelled' WHERE id=? AND tenant_id=?`).bind(id, ctx.tenantId).run();
      return ok({ id, status: 'cancelled' });
    }
  }

  // ═══════════════════════════════
  // OFFERS
  // ═══════════════════════════════
  if (resource === 'offers') {
    if (!id && request.method === 'GET') {
      const rows = await env.DB.prepare(`
        SELECT o.*, c.first_name || ' ' || c.last_name AS candidate_name, c.email AS candidate_email, j.title AS job_title
        FROM job_offers o
        JOIN candidates c ON c.id = o.candidate_id
        JOIN job_postings j ON j.id = o.job_id
        WHERE o.tenant_id = ?
        ORDER BY o.created_at DESC LIMIT 100
      `).bind(ctx.tenantId).all();
      return ok(rows.results);
    }

    if (!id && request.method === 'POST') {
      const body = await request.json().catch(() => null);
      const parsed = OfferSchema.safeParse(body);
      if (!parsed.success) return err(parsed.error.issues[0].message);
      const d = parsed.data;
      const offerId = crypto.randomUUID();

      // Expires in 7 days
      const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();

      await env.DB.prepare(`
        INSERT INTO job_offers (id, tenant_id, application_id, candidate_id, job_id, salary, currency, start_date, contract_type, employment_type, location, benefits, status, expires_at, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(offerId, ctx.tenantId, d.applicationId, d.candidateId, d.jobId, d.salary, d.currency, d.startDate ?? null, d.contractType, d.employmentType, d.location ?? null, JSON.stringify(d.benefits), expiresAt, ctx.userId).run();

      // Advance application stage
      await env.DB.prepare(`UPDATE job_applications SET stage='offer', updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(d.applicationId).run();

      await audit(env, { ...auditFromRequest(request, ctx), action: 'create', resource: 'job_offer', resourceId: offerId });
      return created({ id: offerId });
    }

    if (id && action === 'send' && request.method === 'POST') {
      const offer = await env.DB.prepare(`
        SELECT o.*, c.email, c.first_name, j.title
        FROM job_offers o JOIN candidates c ON c.id=o.candidate_id JOIN job_postings j ON j.id=o.job_id
        WHERE o.id=? AND o.tenant_id=?
      `).bind(id, ctx.tenantId).first() as any;
      if (!offer) return notFound('Offer not found');

      await env.DB.prepare(`UPDATE job_offers SET status='sent', sent_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(id).run();

      // Send offer email
      await sendMail(env, {
        to: offer.email,
        subject: `Offer Letter: ${offer.title} at ${env.TENANT_NAME}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#065F46;padding:20px 24px"><h2 style="color:#fff;margin:0">🎉 Congratulations — Job Offer</h2><p style="color:#A7F3D0;margin:4px 0 0;font-size:12px">${env.TENANT_NAME}</p></div>
          <div style="padding:24px">
            <p>Dear ${offer.first_name},</p>
            <p>We are delighted to offer you the position of <strong>${offer.title}</strong> at ${env.TENANT_NAME}.</p>
            <table style="border-collapse:collapse;width:100%;margin:16px 0">
              <tr><td style="padding:8px;border:1px solid #e0e0e0;color:#666">Salary</td><td style="padding:8px;border:1px solid #e0e0e0;font-weight:bold">${offer.currency} ${Number(offer.salary).toLocaleString()} per annum</td></tr>
              <tr style="background:#f9f9f9"><td style="padding:8px;border:1px solid #e0e0e0;color:#666">Contract</td><td style="padding:8px;border:1px solid #e0e0e0">${offer.contract_type} · ${offer.employment_type.replace(/_/g,' ')}</td></tr>
              ${offer.start_date ? `<tr><td style="padding:8px;border:1px solid #e0e0e0;color:#666">Start Date</td><td style="padding:8px;border:1px solid #e0e0e0">${offer.start_date}</td></tr>` : ''}
              ${offer.location ? `<tr style="background:#f9f9f9"><td style="padding:8px;border:1px solid #e0e0e0;color:#666">Location</td><td style="padding:8px;border:1px solid #e0e0e0">${offer.location}</td></tr>` : ''}
            </table>
            <p>Please respond by <strong>${new Date(offer.expires_at).toLocaleDateString('en-GB')}</strong>.</p>
            <p>We look forward to welcoming you to the team.</p>
          </div>
        </div>`,
      });

      return ok({ id, status: 'sent' });
    }

    if (id && action === 'respond' && request.method === 'POST') {
      const { response, reason } = await request.json() as any;
      if (!['accepted','declined'].includes(response)) return err('Invalid response');

      await env.DB.prepare(`
        UPDATE job_offers SET status=?, responded_at=CURRENT_TIMESTAMP, decline_reason=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=?
      `).bind(response, reason ?? null, id, ctx.tenantId).run();

      // If accepted — advance to hired
      if (response === 'accepted') {
        const offer = await env.DB.prepare(`SELECT * FROM job_offers WHERE id=?`).bind(id).first() as any;
        if (offer) {
          await env.DB.prepare(`UPDATE job_applications SET stage='hired', hired_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(offer.application_id).run();
          await env.DB.prepare(`UPDATE candidates SET status='hired', updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(offer.candidate_id).run();
          await env.DB.prepare(`UPDATE job_postings SET status='filled', filled_at=CURRENT_TIMESTAMP WHERE id=?`).bind(offer.job_id).run();
        }
      }

      return ok({ id, status: response });
    }
  }

  // ── Pipeline overview (all jobs + stage counts) ────────────────────────────
  if (resource === 'pipeline' && !id && request.method === 'GET') {
    const rows = await env.DB.prepare(`
      SELECT j.id, j.title, j.status, j.location_type,
             COUNT(a.id) as total,
             SUM(CASE WHEN a.stage='applied'      THEN 1 ELSE 0 END) as applied,
             SUM(CASE WHEN a.stage='screening'    THEN 1 ELSE 0 END) as screening,
             SUM(CASE WHEN a.stage='phone_screen' THEN 1 ELSE 0 END) as phone_screen,
             SUM(CASE WHEN a.stage='interview'    THEN 1 ELSE 0 END) as interview,
             SUM(CASE WHEN a.stage='offer'        THEN 1 ELSE 0 END) as offer,
             SUM(CASE WHEN a.stage='hired'        THEN 1 ELSE 0 END) as hired,
             SUM(CASE WHEN a.stage='rejected'     THEN 1 ELSE 0 END) as rejected
      FROM job_postings j
      LEFT JOIN job_applications a ON a.job_id = j.id
      WHERE j.tenant_id = ?
      GROUP BY j.id
      ORDER BY j.created_at DESC
    `).bind(ctx.tenantId).all();
    return ok(rows.results);
  }

  return err('Not found', 404);
}

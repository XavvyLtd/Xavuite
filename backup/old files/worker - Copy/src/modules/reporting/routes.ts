import { ok } from '../../core/response';
import type { Env, AppContext } from '../../types';

export async function handleReporting(
  request: Request, env: Env, ctx: AppContext, subPath: string
): Promise<Response> {
  // Strip query string from subPath before parsing resource
  const pathOnly = subPath.split('?')[0];
  const [resource] = pathOnly.split('/').filter(Boolean);
  const tid = ctx.tenantId;
  const url = new URL(request.url);

  // GET /api/reporting/headcount
  if (resource === 'headcount') {
    const [byDept, byType, byLocation, monthly] = await Promise.all([
      env.DB.prepare(`
        SELECT d.name, COUNT(e.id) as count
        FROM employees e
        JOIN employee_history eh ON eh.employee_id=e.id AND eh.is_current=1
        LEFT JOIN departments d ON d.id=eh.department_id
        WHERE e.tenant_id=? AND e.status='active'
        GROUP BY d.name ORDER BY count DESC
      `).bind(tid).all(),
      env.DB.prepare(`
        SELECT eh.employment_type, COUNT(e.id) as count
        FROM employees e
        JOIN employee_history eh ON eh.employee_id=e.id AND eh.is_current=1
        WHERE e.tenant_id=? AND e.status='active'
        GROUP BY eh.employment_type ORDER BY count DESC
      `).bind(tid).all(),
      env.DB.prepare(`
        SELECT eh.work_location_type, COUNT(e.id) as count
        FROM employees e
        JOIN employee_history eh ON eh.employee_id=e.id AND eh.is_current=1
        WHERE e.tenant_id=? AND e.status='active'
        GROUP BY eh.work_location_type ORDER BY count DESC
      `).bind(tid).all(),
      env.DB.prepare(`
        SELECT strftime('%Y-%m', e.created_at) as month, COUNT(*) as new_hires
        FROM employees e WHERE e.tenant_id=? AND e.created_at>=date('now','-12 months')
        GROUP BY month ORDER BY month
      `).bind(tid).all(),
    ]);
    return ok({ byDept: byDept.results, byType: byType.results, byLocation: byLocation.results, monthly: monthly.results });
  }

  // GET /api/reporting/leave
  if (resource === 'leave') {
    const leaveUrl = new URL(request.url);
    const leaveYear = leaveUrl.searchParams.get('year') ?? new Date().getFullYear().toString();
    const yearStart = `${leaveYear}-01-01`;
    const yearEnd   = `${leaveYear}-12-31`;
    const [byType, byMonth, topTakers, avgDuration] = await Promise.all([
      env.DB.prepare(`
        SELECT leave_type, COUNT(*) as requests, SUM(days) as total_days
        FROM leave_requests WHERE tenant_id=? AND status='approved'
          AND start_date>=? AND start_date<=?
        GROUP BY leave_type ORDER BY total_days DESC
      `).bind(tid, yearStart, yearEnd).all(),
      env.DB.prepare(`
        SELECT strftime('%Y-%m', start_date) as month, COUNT(*) as requests, SUM(days) as days
        FROM leave_requests WHERE tenant_id=? AND status='approved'
          AND start_date>=? AND start_date<=?
        GROUP BY month ORDER BY month
      `).bind(tid, yearStart, yearEnd).all(),
      env.DB.prepare(`
        SELECT eh.first_name||' '||eh.last_name as name, COUNT(*) as requests, SUM(lr.days) as days
        FROM leave_requests lr
        JOIN employees e ON e.id=lr.employee_id
        JOIN employee_history eh ON eh.employee_id=e.id AND eh.is_current=1
        WHERE lr.tenant_id=? AND lr.status='approved'
          AND lr.start_date>=? AND lr.start_date<=?
        GROUP BY lr.employee_id ORDER BY days DESC LIMIT 10
      `).bind(tid, yearStart, yearEnd).all(),
      env.DB.prepare(`
        SELECT AVG(days) as avg_duration FROM leave_requests
        WHERE tenant_id=? AND status='approved' AND start_date>=? AND start_date<=?
      `).bind(tid, yearStart, yearEnd).first(),
    ]);
    return ok({ byType: byType.results, byMonth: byMonth.results, topTakers: topTakers.results, avgDuration });
  }

  // GET /api/reporting/timesheets
  if (resource === 'timesheets') {
    const fromDate = url.searchParams.get('from') ?? (() => { const d = new Date(); d.setMonth(d.getMonth()-12); return d.toISOString().split('T')[0]; })();
    const toDate   = url.searchParams.get('to')   ?? new Date().toISOString().split('T')[0];
    const [weekly, utilisation, byEmployee, missing] = await Promise.all([
      env.DB.prepare(`
        SELECT t.week_starting,
               SUM(te.hours_worked) as hours,
               SUM(CASE WHEN te.billable=1 THEN te.hours_worked ELSE 0 END) as billable,
               ROUND(SUM(CASE WHEN te.billable=1 THEN te.hours_worked ELSE 0 END)*100.0/NULLIF(SUM(te.hours_worked),0),1) as util_pct
        FROM timesheets t
        JOIN timesheet_entries te ON te.timesheet_id=t.id
        WHERE t.tenant_id=? AND t.status='approved' AND t.week_starting>=? AND t.week_starting<=?
        GROUP BY t.week_starting ORDER BY t.week_starting
      `).bind(tid, fromDate, toDate).all(),
      env.DB.prepare(`
        SELECT eh.first_name||' '||eh.last_name as name,
               ROUND(SUM(CASE WHEN te2.billable=1 THEN te2.hours_worked ELSE 0 END)*100.0/NULLIF(SUM(te2.hours_worked),0),1) as util_pct,
               SUM(te2.hours_worked) as total_hours, SUM(CASE WHEN te2.billable=1 THEN te2.hours_worked ELSE 0 END) as billable_hours
        FROM timesheets t
        JOIN timesheet_entries te2 ON te2.timesheet_id=t.id
        JOIN employees e ON e.id=t.employee_id
        JOIN employee_history eh ON eh.employee_id=e.id AND eh.is_current=1
        WHERE t.tenant_id=? AND t.status='approved'
          AND t.week_starting >= ? AND t.week_starting <= ?
        GROUP BY t.employee_id ORDER BY util_pct DESC
      `).bind(tid, fromDate, toDate).all(),
      env.DB.prepare(`
        SELECT eh.first_name||' '||eh.last_name as name,
               COUNT(DISTINCT t.id) as submissions, SUM(te.hours_worked) as hours
        FROM timesheets t
        JOIN timesheet_entries te ON te.timesheet_id=t.id
        JOIN employees e ON e.id=t.employee_id
        JOIN employee_history eh ON eh.employee_id=e.id AND eh.is_current=1
        WHERE t.tenant_id=? AND t.week_starting>=?
        GROUP BY t.employee_id ORDER BY hours DESC
      `).bind(tid, fromDate).all(),
      env.DB.prepare(`
        SELECT eh.first_name||' '||eh.last_name as name, u.email
        FROM employees e
        JOIN employee_history eh ON eh.employee_id=e.id AND eh.is_current=1
        JOIN users u ON u.id=e.user_id
        WHERE e.tenant_id=? AND e.status='active'
          AND e.id NOT IN (SELECT employee_id FROM timesheets WHERE tenant_id=? AND week_starting=date('now','weekday 1','-7 days'))
      `).bind(tid, tid).all(),
    ]);
    return ok({ weekly: weekly.results, utilisation: utilisation.results, byEmployee: byEmployee.results, missing: missing.results });
  }

  // GET /api/reporting/compliance
  if (resource === 'compliance') {
    const [rtwSummary, visaSummary, trainingCompliance, onboardingStatus] = await Promise.all([
      env.DB.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status='valid' THEN 1 ELSE 0 END) as valid,
          SUM(CASE WHEN status='expired' THEN 1 ELSE 0 END) as expired,
          SUM(CASE WHEN expiry_date IS NOT NULL AND expiry_date<=date('now','+90 days') AND expiry_date>=date('now') THEN 1 ELSE 0 END) as expiring
        FROM employee_right_to_work WHERE tenant_id=?
      `).bind(tid).first(),
      env.DB.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN status='expired' THEN 1 ELSE 0 END) as expired,
          SUM(CASE WHEN expiry_date<=date('now','+30 days') AND expiry_date>=date('now') THEN 1 ELSE 0 END) as expiring30,
          SUM(CASE WHEN sponsorship_required=1 THEN 1 ELSE 0 END) as sponsored
        FROM employee_visas WHERE tenant_id=?
      `).bind(tid).first(),
      env.DB.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN tc.mandatory=1 AND ta.status!='completed' THEN 1 ELSE 0 END) as mandatory_incomplete
        FROM training_assignments ta
        JOIN training_courses tc ON tc.id=ta.course_id
        WHERE ta.tenant_id=?
      `).bind(tid).first(),
      env.DB.prepare(`
        SELECT status, COUNT(*) as count FROM employee_onboarding WHERE tenant_id=? GROUP BY status
      `).bind(tid).all(),
    ]);
    return ok({ rtwSummary, visaSummary, trainingCompliance, onboardingStatus: onboardingStatus.results });
  }

  // GET /api/reporting/projects
  if (resource === 'projects') {
    const [summary, taskStatus, budgetUsage, teamUtil] = await Promise.all([
      env.DB.prepare(`
        SELECT status, COUNT(*) as count, SUM(budget) as budget, SUM(spent) as spent
        FROM pmo_projects WHERE tenant_id=? GROUP BY status
      `).bind(tid).all(),
      env.DB.prepare(`
        SELECT status, COUNT(*) as count FROM pmo_tasks WHERE tenant_id=? GROUP BY status ORDER BY count DESC
      `).bind(tid).all(),
      env.DB.prepare(`
        SELECT
          p.name, p.status, p.budget, COALESCE(p.spent,0) as spent,
          ROUND(COALESCE(p.spent,0)*100.0/NULLIF(p.budget,0),1) as budget_pct,
          COUNT(t.id) as task_count,
          SUM(CASE WHEN t.status='done' THEN 1 ELSE 0 END) as done_count,
          ROUND(SUM(CASE WHEN t.status='done' THEN 1.0 ELSE 0 END)/NULLIF(COUNT(t.id),0)*100,1) as completion_pct
        FROM pmo_projects p
        LEFT JOIN pmo_tasks t ON t.project_id=p.id AND t.tenant_id=p.tenant_id
        WHERE p.tenant_id=?
        GROUP BY p.id ORDER BY p.status, p.name
      `).bind(tid).all(),
      env.DB.prepare(`
        SELECT eh.first_name||' '||eh.last_name as name,
               COUNT(DISTINCT pa.project_id) as projects,
               SUM(pa.allocation) as total_allocation,
               SUM(pa.hours_per_week) as hours_per_week
        FROM pmo_allocations pa
        JOIN employees e ON e.id=pa.employee_id
        JOIN employee_history eh ON eh.employee_id=e.id AND eh.is_current=1
        WHERE pa.tenant_id=? AND (pa.end_date IS NULL OR pa.end_date>=date('now'))
        GROUP BY pa.employee_id ORDER BY total_allocation DESC
      `).bind(tid).all(),
    ]);
    return ok({ summary: summary.results, taskStatus: taskStatus.results, budgetUsage: budgetUsage.results, teamUtil: teamUtil.results });
  }

  return ok({});
}

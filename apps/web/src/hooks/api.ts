/**
 * hooks/api.ts
 *
 * Backward-compatible barrel export.
 * All hooks remain importable from this path — no existing imports break.
 *
 * Internal structure:
 *   - Shared primitives → platform/auth/apiClient.ts
 *   - All types        → platform/types/index.ts
 *   - Module selectors → modules/{module}/hooks/
 *
 * TODO(migration): Progressively move module-specific hooks into their
 *   own modules/{module}/hooks/ files and update imports.
 */

// Re-export platform primitives (backward compat)
export { useApi, useApiMutation } from '../platform/auth/apiClient';

// ── Roles ─────────────────────────────────────────────────────────────────────
export interface RoleOption {
  id:          string;
  name:        string;
  description: string | null;
}

export interface EmployeeRoleAssignment {
  assignment_id: string;
  role_id:       string;
  name:          string;
  description:   string | null;
  granted_at:    string;
}

export function useRoles() {
  return useApi<{ roles: RoleOption[] }>(['roles'], '/api/roles');
}

export function useEmployeeRoles(employeeId: string) {
  return useApi<{ roles: EmployeeRoleAssignment[] }>(
    ['employees', employeeId, 'roles'],
    `/api/roles/employee/${employeeId}`,
    { enabled: !!employeeId }
  );
}

export function useGrantRole(employeeId: string) {
  return useApiMutation<{ granted: boolean; roleName: string }, { roleId: string }>(
    `/api/roles/employee/${employeeId}`, 'POST', [['employees', employeeId, 'roles']]
  );
}

export function useRevokeRole(employeeId: string) {
  return useApiMutation<{ revoked: boolean }, string>(
    (roleId: string) => `/api/roles/employee/${employeeId}/${roleId}`,
    'DELETE', [['employees', employeeId, 'roles']]
  );
}

// Re-export all types (backward compat)
export type {
  PaginationMeta, Employee, EmployeeHistory, Dept,
  LeaveRequest, Timesheet, TimesheetEntry,
  ExpenseClaim, RTWCheck,
  Project, Task, Sprint,
  JobPosting, Document, Asset,
  TrainingCourse, TrainingAssignment,
  Announcement, AuditEvent,
} from '../platform/types';

import { useApi, useApiMutation } from '../platform/auth/apiClient';

// ── Dashboard ─────────────────────────────────────────────────────────────────
export function useDashboard() {
  return useApi<{ metrics: Record<string, number>; recentActivity: unknown[] }>(
    ['dashboard'], '/api/dashboard', { refetchInterval: 30_000 }
  );
}

// ── Employees ─────────────────────────────────────────────────────────────────
import type { Employee, EmployeeHistory, Dept, PaginationMeta } from '../platform/types';

export function useEmployees(params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return useApi<{ items: Employee[]; meta: PaginationMeta }>(['employees', params], `/api/employees${qs}`);
}
export function useEmployee(id: string) {
  return useApi<Employee>(['employees', id], `/api/employees/${id}`, { enabled: !!id });
}
export function useEmployeeHistory(id: string) {
  return useApi<EmployeeHistory[]>(['employees', id, 'history'], `/api/employees/${id}/history`, { enabled: !!id });
}
export function useCreateEmployee() {
  return useApiMutation('/api/employees', 'POST', [['employees']]);
}
export function useUpdateEmployee(id: string) {
  return useApiMutation(`/api/employees/${id}`, 'PATCH', [['employees'], ['employees', id]]);
}
export function useDepartments() {
  return useApi<Dept[]>(['departments'], '/api/departments');
}

// ── Leave ─────────────────────────────────────────────────────────────────────
import type { LeaveRequest } from '../platform/types';

export function useLeaveRequests(params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return useApi<LeaveRequest[]>(['leave', params], `/api/leave${qs}`);
}
export function useCreateLeave() {
  return useApiMutation('/api/leave', 'POST', [['leave']]);
}
export function useLeaveDecision(id: string) {
  return useApiMutation(`/api/leave/${id}/decision`, 'POST', [['leave']]);
}

// ── Timesheets ────────────────────────────────────────────────────────────────
import type { Timesheet, TimesheetEntry } from '../platform/types';

export function useTimesheets(params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return useApi<Timesheet[]>(['timesheets', params], `/api/timesheets${qs}`);
}
export function useTimesheetDetail(id: string) {
  return useApi<Timesheet & { entries: TimesheetEntry[] }>(['timesheets', id], `/api/timesheets/${id}`, { enabled: !!id });
}
export function useSubmitTimesheet() {
  return useApiMutation('/api/timesheets', 'POST', [['timesheets']]);
}
export function useTimesheetDecision(id: string) {
  return useApiMutation(`/api/timesheets/${id}/decision`, 'POST', [['timesheets']]);
}
export function useBulkTimesheetDecision() {
  return useApiMutation('/api/timesheets/bulk-decision', 'POST', [['timesheets']]);
}

// ── Expenses ──────────────────────────────────────────────────────────────────
import type { ExpenseClaim } from '../platform/types';

export function useExpenses(params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return useApi<ExpenseClaim[]>(['expenses', params], `/api/expenses${qs}`);
}
export function useCreateExpense() {
  return useApiMutation('/api/expenses', 'POST', [['expenses']]);
}
export function useExpenseDecision(id: string) {
  return useApiMutation(`/api/expenses/${id}/decision`, 'POST', [['expenses']]);
}

// ── Compliance ────────────────────────────────────────────────────────────────
import type { RTWCheck } from '../platform/types';

export function useCompliance(params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return useApi<RTWCheck[]>(['compliance', params], `/api/compliance${qs}`);
}
export function useCreateRTW() {
  return useApiMutation('/api/compliance', 'POST', [['compliance']]);
}

// ── PMO ───────────────────────────────────────────────────────────────────────
import type { Project, Task, Sprint } from '../platform/types';

export function useProjects() {
  return useApi<Project[]>(['pmo', 'projects'], '/api/pmo/projects');
}
export function useCreateProject() {
  return useApiMutation('/api/pmo/projects', 'POST', [['pmo', 'projects']]);
}
export function useTasks(params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return useApi<Task[]>(['pmo', 'tasks', params], `/api/pmo/tasks${qs}`);
}
export function useCreateTask() {
  return useApiMutation('/api/pmo/tasks', 'POST', [['pmo', 'tasks']]);
}
export function useUpdateTask(id: string) {
  return useApiMutation(`/api/pmo/tasks/${id}`, 'PATCH', [['pmo', 'tasks']]);
}
export function useSprints() {
  return useApi<Sprint[]>(['pmo', 'sprints'], '/api/pmo/sprints');
}

// ── Recruitment ───────────────────────────────────────────────────────────────
import type { JobPosting } from '../platform/types';

export function useJobs() {
  return useApi<JobPosting[]>(['recruitment', 'jobs'], '/api/recruitment');
}
export function useCreateJob() {
  return useApiMutation('/api/recruitment', 'POST', [['recruitment', 'jobs']]);
}

// ── Documents ─────────────────────────────────────────────────────────────────
import type { Document } from '../platform/types';

export function useDocuments(params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return useApi<Document[]>(['documents', params], `/api/documents${qs}`);
}

// ── Assets ────────────────────────────────────────────────────────────────────
import type { Asset } from '../platform/types';

export function useAssets(params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return useApi<Asset[]>(['assets', params], `/api/assets${qs}`);
}
export function useCreateAsset() {
  return useApiMutation('/api/assets', 'POST', [['assets']]);
}
export function useAssignAsset(id: string) {
  return useApiMutation(`/api/assets/${id}/assign`, 'POST', [['assets']]);
}

// ── Training ──────────────────────────────────────────────────────────────────
import type { TrainingCourse, TrainingAssignment } from '../platform/types';

export function useTrainingCourses() {
  return useApi<TrainingCourse[]>(['training', 'courses'], '/api/training');
}
export function useTrainingAssignments(params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return useApi<TrainingAssignment[]>(['training', 'assignments', params], `/api/training/assignments${qs}`);
}

// ── Announcements ─────────────────────────────────────────────────────────────
import type { Announcement } from '../platform/types';

export function useAnnouncements() {
  return useApi<Announcement[]>(['announcements'], '/api/announcements', { refetchInterval: 60_000 });
}
export function useCreateAnnouncement() {
  return useApiMutation('/api/announcements', 'POST', [['announcements']]);
}

// ── Audit ─────────────────────────────────────────────────────────────────────
import type { AuditEvent } from '../platform/types';

export function useAuditLog(page = 1) {
  return useApi<{ items: AuditEvent[]; meta: PaginationMeta }>(
    ['audit', page], `/api/audit?page=${page}&limit=50`
  );
}

// ── Scheduler ─────────────────────────────────────────────────────────────────
export interface ScheduledJob {
  id:               string;
  key:              string;
  name:             string;
  description?:     string;
  category:         string;
  enabled:          number;
  schedule_type:    string;
  cron_expr?:       string;
  interval_mins?:   number;
  email_to:         string;
  email_to_custom?: string;
  email_subject:    string;
  email_body:       string;
  trigger_config?:  string;
  last_run_at?:     string;
  last_run_status?: string;
  run_count:        number;
  total_runs:       number;
  error_runs:       number;
}

export interface JobRunLog {
  id:                  string;
  job_id:              string;
  triggered_by:        string;
  status:              string;
  started_at:          string;
  finished_at?:        string;
  duration_ms?:        number;
  emails_sent:         number;
  records_processed:   number;
  error_message?:      string;
  output?:             string;
}

export function useScheduledJobs() {
  return useApi<ScheduledJob[]>(['scheduler'], '/api/scheduler');
}
export function useJobRunLog(jobId: string) {
  return useApi<JobRunLog[]>(['scheduler', jobId, 'logs'], `/api/scheduler/${jobId}/logs`, { enabled: !!jobId });
}
export function useFireJob(id: string) {
  return useApiMutation(`/api/scheduler/${id}/fire`, 'POST', [['scheduler']]);
}
export function useCreateScheduledJob() {
  return useApiMutation('/api/scheduler', 'POST', [['scheduler']]);
}
export function useUpdateScheduledJob(id: string) {
  return useApiMutation(`/api/scheduler/${id}`, 'PATCH', [['scheduler']]);
}
export function useDeleteScheduledJob(id: string) {
  return useApiMutation(`/api/scheduler/${id}`, 'DELETE', [['scheduler']]);
}

// ── Workflow ──────────────────────────────────────────────────────────────────
export interface WorkflowDefinition {
  id:           string;
  key:          string;
  name:         string;
  description?: string;
  module:       string;
  enabled:      number;
  step_count:   number;
  active_count: number;
}
export interface WorkflowStep {
  id:             string;
  step_order:     number;
  name:           string;
  step_type:      string;
  approver_type:  string;
  approver_role?: string;
  sla_hours?:     number;
  condition?:     string;
  step_status?:   string;
}
export interface WorkflowInstance {
  outcome_comment?: string;
  id:                string;
  definition_key:    string;
  workflow_name:     string;
  module:            string;
  record_type:       string;
  record_id:         string;
  status:            string;
  current_step:      number;
  current_step_name: string;
  submitted_by_email:string;
  submitted_at:      string;
  sla_deadline?:     string;
  decided_at?:       string;
  outcome?:          string;
}
export interface WorkflowAction {
  id:          string;
  step_name:   string;
  actor_email: string;
  action:      string;
  comment?:    string;
  created_at:  string;
}

export function useWorkflowDefinitions() {
  return useApi<WorkflowDefinition[]>(['workflow', 'definitions'], '/api/workflows/definitions');
}
export function useWorkflowSteps(defId: string) {
  return useApi<WorkflowStep[]>(['workflow', 'steps', defId], `/api/workflows/definitions/${defId}/steps`, { enabled: !!defId });
}
export function usePendingApprovals() {
  return useApi<WorkflowInstance[]>(['workflow', 'pending'], '/api/workflows/pending', { refetchInterval: 30_000 });
}
export function useWorkflowInstances(params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return useApi<WorkflowInstance[]>(['workflow', 'instances', params], `/api/workflows/instances${qs}`);
}
export function useWorkflowInstance(id: string) {
  return useApi<WorkflowInstance & { actions: WorkflowAction[]; steps: WorkflowStep[] }>(
    ['workflow', 'instances', id], `/api/workflows/instances/${id}`, { enabled: !!id }
  );
}
export function useTakeWorkflowAction(instanceId: string) {
  return useApiMutation(`/api/workflows/instances/${instanceId}/action`, 'POST', [['workflow']]);
}
export function useToggleWorkflow(id: string) {
  return useApiMutation(`/api/workflows/definitions/${id}`, 'PATCH', [['workflow', 'definitions']]);
}

// ── Recruitment (full pipeline) ───────────────────────────────────────────────
export interface Requisition {
  id:              string;
  title:           string;
  department_name?:string;
  location?:       string;
  location_type:   string;
  headcount:       number;
  priority:        string;
  status:          string;
  salary_min?:     number;
  salary_max?:     number;
  currency:        string;
  target_start?:   string;
  posting_count:   number;
  created_at:      string;
}
export interface Candidate {
  id:               string;
  first_name:       string;
  last_name:        string;
  email:            string;
  phone?:           string;
  location?:        string;
  linkedin_url?:    string;
  source:           string;
  tags?:            string;
  status:           string;
  application_count:number;
  applied_to?:      string;
  created_at:       string;
}
export interface Application {
  id:              string;
  job_id:          string;
  candidate_id:    string;
  first_name:      string;
  last_name:       string;
  candidate_email: string;
  stage:           string;
  stage_order:     number;
  source:          string;
  applied_at:      string;
  cv_score?:       number;
}
export interface Interview {
  id:              string;
  application_id:  string;
  stage_name:      string;
  interview_type:  string;
  scheduled_at:    string;
  duration_mins:   number;
  location?:       string;
  status:          string;
  score?:          number;
  feedback?:       string;
  recommendation?: string;
  candidate_name:  string;
  candidate_email: string;
  job_title:       string;
}
export interface Offer {
  id:             string;
  candidate_name: string;
  candidate_email:string;
  job_title:      string;
  salary:         number;
  currency:       string;
  status:         string;
  start_date?:    string;
  sent_at?:       string;
  expires_at?:    string;
}
export interface PipelineJob {
  id:          string;
  title:       string;
  status:      string;
  total:       number;
  applied:     number;
  screening:   number;
  phone_screen:number;
  interview:   number;
  offer:       number;
  hired:       number;
  rejected:    number;
}

export function useRequisitions(params?: Record<string,string>) {
  const qs = params ? '?'+new URLSearchParams(params).toString() : '';
  return useApi<Requisition[]>(['recruitment','requisitions',params], `/api/recruitment/requisitions${qs}`);
}
export function useCreateRequisition() {
  return useApiMutation('/api/recruitment/requisitions','POST',[['recruitment','requisitions']]);
}
export function useCandidates(params?: Record<string,string>) {
  const qs = params ? '?'+new URLSearchParams(params).toString() : '';
  return useApi<Candidate[]>(['recruitment','candidates',params], `/api/recruitment/candidates${qs}`);
}
export function useCandidate(id: string) {
  return useApi<Candidate & {applications:Application[];interviews:Interview[]}>(['recruitment','candidates',id], `/api/recruitment/candidates/${id}`, {enabled:!!id});
}
export function useCreateCandidate() {
  return useApiMutation('/api/recruitment/candidates','POST',[['recruitment','candidates']]);
}
export function useUpdateCandidate(id: string) {
  return useApiMutation(`/api/recruitment/candidates/${id}`,'PATCH',[['recruitment','candidates']]);
}
export function useRecruitmentJobs(params?: Record<string,string>) {
  const qs = params ? '?'+new URLSearchParams(params).toString() : '';
  return useApi<JobPosting[]>(['recruitment','jobs',params], `/api/recruitment/jobs${qs}`);
}
export function useRecruitmentJob(id: string) {
  return useApi<JobPosting & {applications:Application[]}>(['recruitment','jobs',id], `/api/recruitment/jobs/${id}`, {enabled:!!id});
}
export function useCreateRecruitmentJob() {
  return useApiMutation('/api/recruitment/jobs','POST',[['recruitment','jobs']]);
}
export function usePublishJob(id: string) {
  return useApiMutation(`/api/recruitment/jobs/${id}/publish`,'POST',[['recruitment','jobs']]);
}
export function useRecruitmentPipeline() {
  return useApi<PipelineJob[]>(['recruitment','pipeline'], '/api/recruitment/pipeline');
}
export function useCreateApplication() {
  return useApiMutation('/api/recruitment/applications','POST',[['recruitment']]);
}
export function useMoveApplicationStage(id: string) {
  return useApiMutation(`/api/recruitment/applications/${id}/stage`,'PATCH',[['recruitment']]);
}
export function useInterviews(params?: Record<string,string>) {
  const qs = params ? '?'+new URLSearchParams(params).toString() : '';
  return useApi<Interview[]>(['recruitment','interviews',params], `/api/recruitment/interviews${qs}`);
}
export function useScheduleInterview() {
  return useApiMutation('/api/recruitment/interviews','POST',[['recruitment','interviews']]);
}
export function useInterviewFeedback(id: string) {
  return useApiMutation(`/api/recruitment/interviews/${id}/feedback`,'POST',[['recruitment','interviews']]);
}
export function useOffers() {
  return useApi<Offer[]>(['recruitment','offers'], '/api/recruitment/offers');
}
export function useCreateOffer() {
  return useApiMutation('/api/recruitment/offers','POST',[['recruitment','offers']]);
}
export function useSendOffer(id: string) {
  return useApiMutation(`/api/recruitment/offers/${id}/send`,'POST',[['recruitment','offers']]);
}

// ── Leave Enhancements ────────────────────────────────────────────────────────
export interface LeaveType {
  id:               string;
  name:             string;
  code:             string;
  colour:           string;
  paid:             number;
  max_days?:        number;
  carry_forward:    number;
  carry_forward_max:number;
  half_day_allowed: number;
  enabled:          number;
}
export interface LeaveBalance {
  id:             string;
  employee_id:    string;
  employee_name:  string;
  leave_type_id:  string;
  leave_type_name:string;
  colour:         string;
  code:           string;
  year:           number;
  entitlement:    number;
  accrued:        number;
  taken:          number;
  pending:        number;
  carried_forward:number;
  adjusted:       number;
  remaining:      number;
}
export interface PublicHoliday {
  id:     string;
  name:   string;
  date:   string;
  region: string;
  year:   number;
}
export interface LeaveCalendarDay {
  leaves:   any[];
  holidays: PublicHoliday[];
}

export function useLeaveTypes() {
  return useApi<LeaveType[]>(['leave','types'], '/api/leave/types');
}
export function useLeaveBalances(params?: Record<string,string>) {
  const qs = params ? '?'+new URLSearchParams(params).toString() : '';
  return useApi<LeaveBalance[]>(['leave','balances',params], `/api/leave/balances${qs}`);
}
export function useEmployeeLeaveBalances(employeeId: string, year?: number) {
  return useApi<LeaveBalance[]>(
    ['leave','balances',employeeId,year],
    `/api/leave/balances/${employeeId}${year?`?year=${year}`:''}`,
    { enabled: !!employeeId }
  );
}
export function usePublicHolidays(year?: number) {
  return useApi<PublicHoliday[]>(['leave','holidays',year], `/api/leave/holidays${year?`?year=${year}`:''}` );
}
export function useLeaveCalendar(month: number, year: number) {
  return useApi<{leaves:any[];holidays:PublicHoliday[]}>(
    ['leave','calendar',month,year], `/api/leave/calendar?month=${month}&year=${year}`
  );
}
export function useInitialiseLeaveBalances() {
  return useApiMutation('/api/leave/balances/initialise','POST',[['leave','balances']]);
}

// ── Visa Management ───────────────────────────────────────────────────────────
export interface VisaRecord {
  id:                string;
  employee_id:       string;
  employee_name:     string;
  employee_email:    string;
  visa_type:         string;
  visa_number?:      string;
  country_of_issue:  string;
  issue_date?:       string;
  expiry_date?:      string;
  days_remaining?:   number;
  status:            string;
  sponsorship_required: number;
  sponsor_licence_number?: string;
  cos_number?:       string;
  cos_expiry?:       string;
  notes?:            string;
  created_at:        string;
}

export function useVisas(params?: Record<string,string>) {
  const qs = params ? '?'+new URLSearchParams(params).toString() : '';
  return useApi<VisaRecord[]>(['visas',params], `/api/visas${qs}`);
}
export function useCreateVisa() {
  return useApiMutation('/api/visas','POST',[['visas']]);
}
export function useUpdateVisa(id: string) {
  return useApiMutation(`/api/visas/${id}`,'PATCH',[['visas']]);
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export interface DashboardMetrics {
  employees:        { total:number; active:number; on_leave:number; new_this_month:number };
  leave:            { pending:number; approved_today:number; on_leave_now:number };
  timesheets:       { pending:number; missing:number; submitted_this_week:number };
  expenses:         { pending:number; pending_value:number };
  compliance:       { expired:number; expiring_90:number };
  visas:            { expiring_90:number; expiring_30:number };
  recruitment:      { open_roles:number; candidates:number };
  projects:         { active:number; tasks_overdue:number };
  onboarding:       { active:number };
  workflows:        { pending:number; escalated:number };
}
export interface ActivityItem {
  id:string; action:string; resource:string; user_email:string; created_at:string; resource_id:string;
}

export function useDashboardMetrics() {
  return useApi<DashboardMetrics>(['dashboard','metrics'], '/api/dashboard/metrics', { refetchInterval: 60_000 });
}
export function useDashboardActivity() {
  return useApi<ActivityItem[]>(['dashboard','activity'], '/api/dashboard/activity');
}

// ── Reporting ─────────────────────────────────────────────────────────────────
export interface HeadcountTrend   { month:string; total:number; active:number; new_hires:number; leavers:number }
export interface LeaveReport      { leave_type:string; total_days:number; employee_count:number; avg_days:number }
export interface TimesheetReport  { employee_name:string; total_hours:number; billable_hours:number; utilisation:number; submitted:number; approved:number }
export interface ComplianceReport { category:string; total:number; compliant:number; expiring:number; expired:number; compliance_pct:number }
export interface ProjectReport    { name:string; status:string; budget:number; spent:number; budget_pct:number; task_count:number; done_count:number; completion_pct:number }

export function useHeadcountReport()   { return useApi<HeadcountTrend[]>  (['reports','headcount'],   '/api/reporting/headcount'); }
export function useLeaveReport(year?:number)        { return useApi<LeaveReport[]>    (['reports','leave',year],   `/api/reporting/leave${year?`?year=${year}`:''}`);}
export function useTimesheetReport(params?:Record<string,string>) {
  const qs = params?'?'+new URLSearchParams(params).toString():'';
  return useApi<TimesheetReport[]>(['reports','timesheets',params], `/api/reporting/timesheets${qs}`);
}
export function useComplianceReport()  { return useApi<ComplianceReport[]>(['reports','compliance'],  '/api/reporting/compliance'); }
export function useProjectReport()     { return useApi<ProjectReport[]>   (['reports','projects'],    '/api/reporting/projects'); }

// ── Notifications ─────────────────────────────────────────────────────────────

export function useNotifications() {
  return useApi<Notification[]>(['notifications'], '/api/dashboard/notifications', { refetchInterval: 30_000 });
}
export function useMarkNotificationRead() {
  return useApiMutation('/api/dashboard/notifications/read','POST',[['notifications']]);
}

// ── Dashboard (live) ──────────────────────────────────────────────────────────
export interface DashboardMetrics {
  activeEmployees:       number;
  onLeaveToday:          number;
  pendingLeave:          number;
  pendingTimesheets:     number;
  pendingExpenses:       number;
  openJobs:              number;
  activeProjects:        number;
  expiringRTW:           number;
  expiringVisas:         number;
  overdueOnboarding:     number;
  totalPendingApprovals: number;
}
export interface Notification {
  id:         string;
  type:       string;
  icon:       string;
  title:      string;
  link:       string;
  priority:   'urgent' | 'high' | 'medium' | 'low';
  created_at: string;
}
export function useLiveDashboard() {
  return useApi<{ metrics: DashboardMetrics; recentActivity: any[] }>(
    ['dashboard','live'], '/api/dashboard', { refetchInterval: 30_000 }
  );
}

// ── Reporting ─────────────────────────────────────────────────────────────────

// ── Employee full profile ─────────────────────────────────────────────────────
export interface EmergencyContact {
  id:           string;
  name:         string;
  relationship: string;
  phone:        string;
  email?:       string;
  is_primary:   number;
}
export interface BankDetails {
  id:              string;
  account_name:    string;
  bank_name:       string;
  sort_code:       string;
  account_number:  string;
  is_primary:      number;
}
export interface CompensationRecord {
  id:             string;
  effective_from: string;
  salary:         number;
  currency:       string;
  pay_frequency:  string;
  change_reason:  string;
  change_pct?:    number;
}
export function useEmergencyContacts(employeeId: string) {
  return useApi<EmergencyContact[]>(['employees',employeeId,'emergency'], `/api/employees/${employeeId}/emergency-contacts`, {enabled:!!employeeId});
}
export function useCreateEmergencyContact(employeeId: string) {
  return useApiMutation(`/api/employees/${employeeId}/emergency-contacts`,'POST',[['employees',employeeId,'emergency']]);
}
export function useCompensation(employeeId: string) {
  return useApi<CompensationRecord[]>(['employees',employeeId,'compensation'], `/api/employees/${employeeId}/compensation`, {enabled:!!employeeId});
}
export function useCreateCompensation(employeeId: string) {
  return useApiMutation(`/api/employees/${employeeId}/compensation`,'POST',[['employees',employeeId,'compensation']]);
}

// ── Checklists ────────────────────────────────────────────────────────────────
export interface ChecklistTemplate {
  id:          string;
  name:        string;
  category:    string;
  task_count:  number;
  enabled:     number;
}
export interface ChecklistRun {
  id:             string;
  template_name:  string;
  category:       string;
  status:         string;
  completion_pct: number;
  due_date?:      string;
  assigned_to_name?: string;
  created_at:     string;
}
export interface ChecklistTask {
  id:           string;
  title:        string;
  description?: string;
  status:       string;
  required:     number;
  due_date?:    string;
  completed_at?: string;
  notes?:       string;
}
export function useChecklistTemplates() {
  return useApi<ChecklistTemplate[]>(['checklists','templates'], '/api/checklists/templates');
}
export function useChecklistRuns(params?: Record<string,string>) {
  const qs = params ? '?'+new URLSearchParams(params).toString() : '';
  return useApi<ChecklistRun[]>(['checklists','runs',params], `/api/checklists/runs${qs}`);
}
export function useChecklistRunDetail(id: string) {
  return useApi<ChecklistRun & {tasks:ChecklistTask[]}>(['checklists','runs',id], `/api/checklists/runs/${id}`, {enabled:!!id});
}
export function useStartChecklist() {
  return useApiMutation('/api/checklists/runs','POST',[['checklists','runs']]);
}
export function useCompleteChecklistTask(runId: string, taskId: string) {
  return useApiMutation(`/api/checklists/runs/${runId}/tasks/${taskId}/complete`,'POST',[['checklists','runs']]);
}

// ── Offboarding ───────────────────────────────────────────────────────────────
export interface OffboardingRecord {
  id:               string;
  employee_id:      string;
  employee_name:    string;
  reason:           string;
  last_working_day: string;
  status:           string;
  completion_pct:   number;
  task_count:       number;
  completed_count:  number;
  created_at:       string;
}
export function useOffboardingList() {
  return useApi<OffboardingRecord[]>(['offboarding'], '/api/offboarding');
}
export function useOffboardingDetail(id: string) {
  return useApi<any>(['offboarding', id], `/api/offboarding/${id}`, { enabled: !!id });
}
export function useStartOffboarding() {
  return useApiMutation('/api/offboarding', 'POST', [['offboarding']]);
}

// ── SOS Alerts ────────────────────────────────────────────────────────────────
export interface SOSAlert {
  id:              string;
  title:           string;
  message:         string;
  severity:        string;
  alert_type:      string;
  status:          string;
  audience:        string;
  location?:       string;
  action_required?:string;
  raised_by_email: string;
  raised_at:       string;
  resolved_at?:    string;
  ack_count:       number;
}
export function useSOSAlerts(status = 'active') {
  return useApi<SOSAlert[]>(['sos', status], `/api/sos?status=${status}`, { refetchInterval: 15_000 });
}
export function useRaiseSOS() {
  return useApiMutation('/api/sos', 'POST', [['sos']]);
}
export function useResolveAlert(id: string) {
  return useApiMutation(`/api/sos/${id}/resolve`, 'POST', [['sos']]);
}
export function useAcknowledgeAlert(id: string) {
  return useApiMutation(`/api/sos/${id}/acknowledge`, 'POST', [['sos']]);
}

// ── Resource Planning ─────────────────────────────────────────────────────────
export interface ResourceCapacity {
  employee_id:      string;
  employee_name:    string;
  department_name:  string;
  available_hours:  number;
  allocated_hours:  number;
  utilisation_pct:  number;
  projects:         string;
}
export function useResourceCapacity(weekStart?: string, weekEnd?: string) {
  const qs = new URLSearchParams();
  if (weekStart) qs.set('weekStart', weekStart);
  if (weekEnd)   qs.set('weekEnd',   weekEnd);
  const q = qs.toString();
  return useApi<ResourceCapacity[]>(['resources','capacity',weekStart], `/api/resources/capacity${q ? '?'+q : ''}`);
}
export function useResourceBench() {
  return useApi<any[]>(['resources','bench'], '/api/resources/bench');
}
export function useResourceForecast(weeks = 8) {
  return useApi<any[]>(['resources','forecast',weeks], `/api/resources/forecast?weeks=${weeks}`);
}
export function useResourceBookings(params?: Record<string,string>) {
  const qs = params ? '?'+new URLSearchParams(params).toString() : '';
  return useApi<any[]>(['resources','bookings',params], `/api/resources/bookings${qs}`);
}
export function useCreateResourceBooking() {
  return useApiMutation('/api/resources/bookings', 'POST', [['resources']]);
}

// ── Settings / White Label ────────────────────────────────────────────────────
export interface BrandingSettings {
  id:              string;
  company_name:    string;
  primary_color:   string;
  secondary_color: string;
  logo_url?:       string;
  favicon_url?:    string;
}
export function useSettings() {
  return useApi<{ branding: BrandingSettings; settings: Record<string,string> }>(['settings'], '/api/settings/branding');
}
export function useUpdateBranding() {
  return useApiMutation('/api/settings/branding', 'PATCH', [['settings']]);
}
export function useModuleSettings() {
  return useApi<any[]>(['settings','modules'], '/api/settings/modules');
}
export function useToggleModule(moduleKey: string) {
  return useApiMutation(`/api/settings/modules/${moduleKey}`, 'PATCH', [['settings','modules']]);
}

// ── SSO / Auth ────────────────────────────────────────────────────────────────
export function useRequestMagicLink() {
  return useApiMutation('/api/auth/magic-link', 'POST', []);
}
export function useMFAStatus() {
  return useApi<{mfa:{enabled:number;method?:string;enrolled_at?:string}}>(['mfa','status'], '/api/auth/mfa/status');
}
export function useMFASetup() {
  return useApiMutation('/api/auth/mfa/setup', 'POST', [['mfa']]);
}
export function useMFAConfirm() {
  return useApiMutation('/api/auth/mfa/confirm', 'POST', [['mfa']]);
}
export function useMFAVerify() {
  return useApiMutation('/api/auth/mfa/verify', 'POST', []);
}
export function useMFADisable() {
  return useApiMutation('/api/auth/mfa/disable', 'POST', [['mfa']]);
}
export function useSSORProviders() {
  return useApi<any[]>(['sso','providers'], '/api/auth/sso-config');
}
export function useSaveSSORProvider() {
  return useApiMutation('/api/auth/sso-config', 'POST', [['sso']]);
}

// ── Document expiry ───────────────────────────────────────────────────────────
export function useExpiringDocuments() {
  return useApi<any[]>(['documents','expiring'], '/api/documents/expiring');
}
export function useUpdateDocumentExpiry(id: string) {
  return useApiMutation(`/api/documents/${id}/expiry`, 'PATCH', [['documents']]);
}

// ── R2 file upload ────────────────────────────────────────────────────────────
export async function uploadFile(file: File, path: string, token: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('path', path);
  const res  = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/api/storage/upload`, { method:'POST', headers:{ Authorization:`Bearer ${token}` }, body:formData });
  const data = await res.json() as any;
  if (!data.ok) throw new Error(data.error ?? 'Upload failed');
  return data.data.url;
}

// ── Notifications dismiss ─────────────────────────────────────────────────────
export function useDismissNotification() {
  return useApiMutation('/api/dashboard/notifications/dismiss', 'POST', [['notifications']]);
}

// ── PMO extras ───────────────────────────────────────────────────────────────
export function useAvailableResources(startDate?: string) {
  const qs = startDate ? `?startDate=${startDate}` : '';
  return useApi<any[]>(['resources','available',startDate], `/api/pmo/resources/available${qs}`);
}
export function useProjectTemplates() {
  return useApi<any[]>(['pmo','templates'], '/api/pmo/templates');
}
export function useSeedProjectTasks() {
  return useApiMutation('/api/pmo/templates/seed', 'POST', [['pmo']]);
}

// ── Type exports for module consumption ──────────────────────────────────────
export type Asset = any;
export type AuditEvent = any;
export type ChecklistRun = any;
export type ChecklistTask = any;
export type ChecklistTemplate = any;
export type RTWCheck = any;
export type CompensationRecord = any;
export type EmergencyContact = any;
export type ExpenseClaim = any;
export type LeaveRequest = any;
export type Timesheet = any;
export type OffboardingRecord = any;
export type Employee = any;
export type Project = any;
export type Task = any;
export type Application = any;
export type Candidate = any;
export type Interview = any;
export type Offer = any;
export type PipelineJob = any;
export type JobRunLog = any;
export type ScheduledJob = any;
export type SOSAlert = any;
export type VisaRecord = any;
export type WorkflowDefinition = any;
export type WorkflowInstance = any;

// ── Projects (additional) ─────────────────────────────────────────────────────
export function useProject(id: string) {
  return useApi<any>(['projects', id], `/api/pmo/projects/${id}`, { enabled: !!id });
}
export function useUpdateProject() {
  return useApiMutation((vars: any) => `/api/pmo/projects/${vars.id}`, 'PUT', [['projects']]);
}
export function useProjectAllocations(projectId: string) {
  return useApi<any[]>(['projects','allocations',projectId], `/api/pmo/projects/${projectId}/allocations`, { enabled: !!projectId });
}
export function useAddAllocation() {
  return useApiMutation('/api/pmo/allocations', 'POST', [['projects']]);
}
export function useRemoveAllocation() {
  return useApiMutation((id: string) => `/api/pmo/allocations/${id}`, 'DELETE', [['projects']]);
}
export function useDeleteProject() {
  return useApiMutation((id: string) => `/api/pmo/projects/${id}`, 'DELETE', [['projects']]);
}

// ── Clients ───────────────────────────────────────────────────────────────────
export function useClients(params?: Record<string,string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return useApi<any>(['clients', params], `/api/clients${qs}`);
}
export function useClient(id: string) {
  return useApi<any>(['clients', id], `/api/clients/${id}`, { enabled: !!id });
}
export function useCreateClient() {
  return useApiMutation('/api/clients', 'POST', [['clients']]);
}
export function useUpdateClient() {
  return useApiMutation((vars: any) => `/api/clients/${vars.id}`, 'PUT', [['clients']]);
}
export function useDeactivateClient() {
  return useApiMutation((id: string) => `/api/clients/${id}`, 'DELETE', [['clients']]);
}
export function useCreateClientContact() {
  return useApiMutation('/api/clients/contacts', 'POST', [['clients']]);
}
export function useUpdateClientContact() {
  return useApiMutation((vars: any) => `/api/clients/contacts/${vars.id}`, 'PUT', [['clients']]);
}
export function useDeleteClientContact() {
  return useApiMutation((id: string) => `/api/clients/contacts/${id}`, 'DELETE', [['clients']]);
}

// ── Invoicing ─────────────────────────────────────────────────────────────────
export function useInvoices(params?: Record<string,string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return useApi<any>(['invoices', params], `/api/invoicing${qs}`);
}
export function useInvoice(id: string) {
  return useApi<any>(['invoices', id], `/api/invoicing/${id}`, { enabled: !!id });
}
export function useCreateInvoice() {
  return useApiMutation('/api/invoicing', 'POST', [['invoices']]);
}
export function useUpdateInvoice() {
  return useApiMutation((vars: any) => `/api/invoicing/${vars.id}`, 'PUT', [['invoices']]);
}
export function useSendInvoice() {
  return useApiMutation((id: string) => `/api/invoicing/${id}/send`, 'POST', [['invoices']]);
}
export function useMarkInvoicePaid() {
  return useApiMutation((id: string) => `/api/invoicing/${id}/paid`, 'POST', [['invoices']]);
}
export function useVoidInvoice() {
  return useApiMutation((id: string) => `/api/invoicing/${id}/void`, 'POST', [['invoices']]);
}
export function useInvoiceEvents(invoiceId: string) {
  return useApi<any[]>(['invoices','events',invoiceId], `/api/invoicing/${invoiceId}/events`, { enabled: !!invoiceId });
}
export function usePullTimesheets() {
  return useApiMutation('/api/invoicing/pull-timesheets', 'POST', [['invoices']]);
}

// ── Mobile / Onboarding ───────────────────────────────────────────────────────
export function useMyTasks(params?: Record<string,string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return useApi<any[]>(['tasks','mine',params], `/api/pmo/tasks?mine=true${qs ? '&'+qs.slice(1) : ''}`);
}
export function useOnboardingWizard() {
  return useApi<any>(['onboarding','wizard'], '/api/onboarding/wizard');
}

// ── Overtime / Country rules ──────────────────────────────────────────────────
export function useOvertimeRecords(params?: Record<string,string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return useApi<any[]>(['overtime','records',params], `/api/overtime/records${qs}`);
}
export function useLogOvertime() {
  return useApiMutation('/api/overtime/records', 'POST', [['overtime']]);
}
export function useCountryLeaveRules(country?: string) {
  const qs = country ? `?country=${country}` : '';
  return useApi<any[]>(['overtime','country-rules',country], `/api/overtime/country-rules${qs}`);
}
export function useCountryList() {
  return useApi<any[]>(['overtime','countries'], '/api/overtime/country-rules/countries');
}

// ── Finance / Payroll ──────────────────────────────────────────────────────────
export interface PayrollRow {
  employee_id:       string;
  employee_name:     string;
  base_salary:       number;
  currency:          string;
  pay_frequency:     string;
  working_days:      number;
  worked_days:       number;
  paid_leave_days:   number;
  unpaid_leave_days: number;
  payroll_days:      number;
  gross_salary:      number;
  notes:             string;
}

export function usePayroll(year: number, month: number) {
  return useApi<{ year: number; month: number; workingDays: number; rows: PayrollRow[]; runId?: string }>(
    ['finance', 'payroll', year, month],
    `/api/finance/payroll?year=${year}&month=${month}`
  );
}

export interface PayrollRunSummary {
  id:             string;
  year:           number;
  month:          number;
  employee_count: number;
  total_gross:    number;
  currency:       string;
  action:         'loaded' | 'exported' | 'emailed' | 'saved';
  emailed_to:     string | null;
  run_at:         string;
  run_by_email:   string | null;
}

export function useSavePayroll() {
  return useApiMutation<{ saved: boolean; runId: string }, { rows: PayrollRow[]; year: number; month: number }>(
    '/api/finance/payroll/save', 'POST', [['finance', 'payroll-history']]
  );
}

export function usePayrollHistory(year?: number, month?: number) {
  const qs = new URLSearchParams();
  if (year)  qs.set('year', String(year));
  if (month) qs.set('month', String(month));
  const qstr = qs.toString();
  return useApi<{ runs: PayrollRunSummary[] }>(
    ['finance', 'payroll-history', year, month],
    `/api/finance/payroll/history${qstr ? `?${qstr}` : ''}`
  );
}

export async function exportPayrollCsv(
  rows: PayrollRow[], year: number, month: number, token: string
): Promise<void> {
  const API_URL = import.meta.env.VITE_API_URL ?? 'https://api-v2.xavvy.uk';
  const res = await fetch(`${API_URL}/api/finance/payroll/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ rows, year, month }),
  });
  if (!res.ok) throw new Error('Export failed');
  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `payroll-${year}-${String(month).padStart(2, '0')}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function useEmailPayrollReport() {
  return useApiMutation<{ sent: boolean; to: string }, { rows: PayrollRow[]; year: number; month: number; to: string }>(
    '/api/finance/payroll/email', 'POST', [['finance', 'payroll-history']]
  );
}

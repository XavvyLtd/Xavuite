/**
 * platform/types/index.ts
 *
 * Shared domain types across all modules.
 * Extracted from hooks/api.ts.
 *
 * TODO(tenancy): Add tenant_id to all types when multi-tenant mode is activated.
 */

export interface PaginationMeta {
  total:  number;
  page:   number;
  limit:  number;
  pages:  number;
}

// ── HR ────────────────────────────────────────────────────────────────────────
export interface Employee {
  id:                string;
  employee_number:   string;
  first_name:        string;
  last_name:         string;
  email:             string;
  department_name?:  string;
  designation_title?:string;
  employment_type:   string;
  work_location_type:string;
  status:            string;
  start_date?:       string;
  manager_id?:       string;
  department_id?:    string;
  employment_basis?: string;
}

export interface EmployeeHistory {
  id:               string;
  employee_id:      string;
  first_name:       string;
  last_name:        string;
  change_reason?:   string;
  changed_by_email?:string;
  effective_from:   string;
  effective_to?:    string;
  is_current:       number;
}

export interface Dept {
  id:             string;
  name:           string;
  employee_count?:number;
}

// ── Leave ─────────────────────────────────────────────────────────────────────
export interface LeaveRequest {
  id:            string;
  employee_id:   string;
  employee_name: string;
  leave_type:    string;
  start_date:    string;
  end_date:      string;
  days:          number;
  reason?:       string;
  status:        string;
  created_at:    string;
  comment?:      string;
}

// ── Timesheets ────────────────────────────────────────────────────────────────
export interface Timesheet {
  id:             string;
  employee_id:    string;
  employee_name:  string;
  week_starting:  string;
  total_hours?:   number;
  billable_hours?:number;
  status:         string;
  submitted_at:   string;
}

export interface TimesheetEntry {
  id:           string;
  date:         string;
  hours_worked: number;
  description?: string;
  billable:     number;
}

// ── Expenses ──────────────────────────────────────────────────────────────────
export interface ExpenseClaim {
  id:           string;
  employee_id:  string;
  employee_name:string;
  category:     string;
  amount:       number;
  currency:     string;
  description:  string;
  expense_date: string;
  status:       string;
}

// ── Compliance ────────────────────────────────────────────────────────────────
export interface RTWCheck {
  id:            string;
  employee_id:   string;
  employee_name: string;
  doc_type:      string;
  check_date:    string;
  expiry_date?:  string;
  status:        string;
}

// ── PMO ───────────────────────────────────────────────────────────────────────
export interface Project {
  id:          string;
  name:        string;
  status:      string;
  priority:    string;
  budget?:     number;
  spent?:      number;
  start_date?: string;
  end_date?:   string;
  task_count:  number;
  team_size:   number;
}

export interface Task {
  id:               string;
  project_id?:      string;
  sprint_id?:       string;
  name:             string;
  status:           string;
  priority:         string;
  assignee_id?:     string;
  assignee_name?:   string;
  estimated_hours?: number;
  due_date?:        string;
}

export interface Sprint {
  id:            string;
  sprint_number: number;
  sprint_name:   string;
  start_date:    string;
  end_date:      string;
  status:        string;
  project_id?:   string;
}

// ── Recruitment ───────────────────────────────────────────────────────────────
export interface JobPosting {
  id:               string;
  title:            string;
  department_name?: string;
  location?:        string;
  location_type:    string;
  status:           string;
  applicant_count:  number;
  closing_date?:    string;
}

// ── Documents ─────────────────────────────────────────────────────────────────
export interface Document {
  id:                 string;
  name:               string;
  category:           string;
  size_bytes?:        number;
  r2_key:             string;
  access_level:       string;
  uploaded_by_email?: string;
  created_at:         string;
}

// ── Assets ────────────────────────────────────────────────────────────────────
export interface Asset {
  id:               string;
  name:             string;
  category:         string;
  serial_number?:   string;
  purchase_value?:  number;
  assigned_to_id?:  string;
  assigned_to_name?:string;
  status:           string;
}

// ── Training ──────────────────────────────────────────────────────────────────
export interface TrainingCourse {
  id:               string;
  name:             string;
  mandatory:        number;
  duration_hours?:  number;
  assignment_count: number;
  completed_count:  number;
}

export interface TrainingAssignment {
  id:             string;
  course_id:      string;
  course_name:    string;
  employee_id:    string;
  employee_name:  string;
  status:         string;
  due_date?:      string;
  completed_date?:string;
  score?:         number;
  mandatory:      number;
  progress?:      number;
}

// ── Announcements ─────────────────────────────────────────────────────────────
export interface Announcement {
  id:          string;
  title:       string;
  body:        string;
  priority:    string;
  audience:    string;
  pinned:      number;
  author_name?:string;
  created_at:  string;
}

// ── Audit ─────────────────────────────────────────────────────────────────────
export interface AuditEvent {
  id:          string;
  user_email?: string;
  action:      string;
  resource:    string;
  resource_id: string;
  changes?:    string;
  created_at:  string;
}

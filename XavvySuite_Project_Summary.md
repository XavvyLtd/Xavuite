# XavvySuite — Project Summary
## Key Decisions, Technical Implementation & Current State
*Generated 14 June 2026*

---

## 1. What Was Built

**XavvySuite** is a full-stack enterprise SaaS workforce operations platform built from scratch in a single session. It targets SMEs with up to 50 employees as the primary go-to-market segment, with the architecture capable of scaling to 250+ with minor changes.

The showcase tenant is **Xavvy Ltd**, running a 4-person IoT platform delivery team on a £270K SEWIO warehouse tracking project spanning Nov 2025 – Dec 2028.

---

## 2. Architecture Decisions

### Stack
| Layer | Technology | Decision rationale |
|---|---|---|
| Backend | Cloudflare Workers (TypeScript) | Zero cold starts, globally distributed, no server management |
| Database | Cloudflare D1 (SQLite) | Free tier sufficient for <50 employees, serverless, co-located with Workers |
| Cache / Sessions | Cloudflare KV | Already included in Workers Paid plan, used for JWT sessions |
| File storage | Cloudflare R2 | S3-compatible, free egress, graceful fallback if unbound |
| Frontend | React + Vite + TanStack Query + Zustand | Fast DX, lightweight bundle, optimistic UI |
| Styling | Tailwind-free inline CSS with a shared `C` (colour) token system | No build step complexity, consistent theming |
| Auth | JWT (15-min access + 7-day refresh) stored in KV | Stateless, revocable, multi-tenant safe |

### Multi-tenancy
Row-level isolation via `tenant_id` on every table. Subdomain resolution (`resolver.ts`) reads the hostname and maps it to a tenant at the edge. For sub-50 deployments, all tenants share one D1 database. The plan is separate D1 databases per tenant at 250+.

### Route architecture
A single Cloudflare Worker (`index.ts`) handles all API routes via a `ROUTES` array with `prefix`/`handler` pairs. Middleware stack: public routes (signup, auth, logo) → auth JWT check → tenant resolution → plan enforcement → module handler. Sub-routes for employees (emergency contacts, compensation) are dispatched inline in the employees handler to avoid the `startsWith` prefix matching limitation.

### RBAC
Permission strings follow `resource:action:entity` format (e.g., `hr:edit:employee`, `leave:manage:leave_policy`). User roles are stored in `user_roles`, permissions in `role_permissions`. `requirePermission()` checked at the top of every handler. Frontend enforces via `<PermissionGate>` and `hasPermission()` from AuthContext.

---

## 3. Database Schema

**80 tables** across 15 migration files, combined into `DEPLOY_schema.sql` for production deployment. Key design decisions:

- `employee_history` is the source of truth for all employee attributes — immutable audit trail, `is_current=1` marks the live record. This caused the "Dashboard shows 6, HR shows 2" bug — dashboard was counting `employees` directly, HR was joining `employee_history WHERE is_current=1`.
- Column name conflicts between migrations: `001_core.sql` definitions always win (`base_salary` not `salary`, `full_name` not `name` for emergency contacts, `r2_key` not `file_url` for documents).
- `job_applications` exists in both `001_core.sql` (with `name/email/phone`) and `006_recruitment.sql` (with `candidate_id/stage`) — whichever ran first wins. `CREATE TABLE IF NOT EXISTS` means the second is silently skipped.
- `PRAGMA foreign_keys = OFF` is **ignored by D1** — FK constraints are always enforced. This caused repeated seed failures and required the DELETE order to strictly follow child → parent sequence.
- D1 CHECK constraints on status columns: `pmo_sprints` allows `upcoming/active/completed` (not `planned`), `pmo_tasks` allows `backlog/todo/in_progress/review/done` (not `not_started/cancelled`).

---

## 4. Modules Built

Every module follows the same pattern: `handler(req, env, ctx, subPath)` in the worker, `useXxx()` hooks in `hooks/api.ts`, React component in `modules/xxx/Xxx.tsx`.

| Module | Status | Notes |
|---|---|---|
| **HR / Employees** | ✅ Complete | Profile, history, emergency contacts, pay records, photo upload, manager assignment, org chart |
| **Leave Management** | ✅ Complete | Requests, balances, policies, calendar, types, holiday bank, initialise endpoint |
| **Timesheets** | ✅ Complete | Weekly submission, approval, entries, auto-CRON scheduler |
| **Expenses** | ✅ Complete | Claims, receipts, approval workflow |
| **Compliance / RTW** | ✅ Complete | Right-to-work checks, expiry tracking, alerts |
| **Documents** | ✅ Complete | R2 upload with graceful fallback, expiry tracking, categories |
| **Projects (PMO)** | ✅ Complete | Projects, sprints/phases, tasks (Kanban), allocations, time tracking |
| **Resources** | ✅ Complete | Capacity planning with logged vs booked hours, utilisation % |
| **Recruitment** | ✅ Complete | Job postings, candidate pipeline, applications, offers, interview scheduling |
| **Onboarding** | ✅ Complete | Checklists, task assignments, automated workflows |
| **Offboarding** | ✅ Complete | Exit checklist, access revocation workflow |
| **Training** | ✅ Complete | Courses, assignments, completion tracking, mandatory flag |
| **Assets** | ✅ Complete | Asset registry, assignments, maintenance |
| **Announcements** | ✅ Complete | Tenant-wide broadcasts with read tracking |
| **Org Chart** | ✅ Complete | Closure table (`reporting_hierarchy`), visual hierarchy rendering |
| **Visa / Immigration** | ✅ Complete | Visa tracking, expiry alerts, sponsorship |
| **SOS / Safety** | ✅ Complete | Incident reporting, escalation, resolution |
| **Scheduler** | ✅ Complete | Job scheduler with CRON, auto-timesheet generation, task completion |
| **Workflows** | ✅ Complete | Visual workflow builder, trigger-based automation engine |
| **Checklists** | ✅ Complete | Reusable checklists for onboarding/offboarding/custom |
| **Reporting** | ✅ Complete | 5 report tabs: headcount, timesheets, leave, compliance, projects |
| **Dashboard** | ✅ Complete | Live counts (employees, pending leave, pending timesheets, open tasks) |
| **Settings** | ✅ Complete | Branding (logo upload, colours), SSO providers, module toggles, notifications |
| **Billing** | ✅ Complete | Stripe checkout, webhook, portal |
| **Audit Log** | ✅ Complete | Immutable log of all mutations |
| **SSO / MFA** | ✅ Complete | Magic links, TOTP, Entra ID, Google, SAML |
| **Signup** | ✅ Complete | 4-step wizard (company → admin → plan → done) |

---

## 5. Key Bugs Fixed (Chronological)

| Bug | Root cause | Fix |
|---|---|---|
| Dashboard count ≠ HR count | Dashboard counted `employees` directly; HR joined `employee_history WHERE is_current=1` | Dashboard query now joins employee_history |
| 3 employees missing from HR | `003_iot_project.sql` only created history for Nanjusha | `INSERT OR REPLACE INTO employee_history` for all 4 in seed |
| Emergency contacts 404 | Router uses `startsWith` — `/api/employees/:id/emergency-contacts` never matched | Sub-routes dispatched inline in employees handler |
| `collapsed is not defined` | State declared in previous session's in-memory copy, not written to disk | `useState` for collapsed added to Shell function |
| `SetLeaveBalanceForm is not defined` | Three form components used inside EmployeeModal but never defined in file | Defined all three before EmployeeModal in HR.tsx |
| `salary` column error | Profile routes used `salary` but schema has `base_salary` | Fixed lookup query to `SELECT base_salary AS salary` |
| Leave balance UNIQUE constraint | `ON CONFLICT(id)` didn't catch the composite unique constraint `(tenant_id, employee_id, leave_type_id, year)` | Changed to `ON CONFLICT(tenant_id, employee_id, leave_type_id, year)` |
| `useExpiringDocuments` not exported | `api.ts` on disk was an older version missing hooks added in session | Delivered full 901-line `api.ts` |
| Seed FK failures (repeated) | D1 ignores `PRAGMA foreign_keys = OFF`; child tables must be deleted before parents | Correct DELETE order: entries → timesheets → bookings → tasks → allocations → sprints → projects |
| Sprint status `planned` rejected | D1 CHECK constraint: only `upcoming/active/completed` allowed | Changed all future phases to `upcoming` |
| Task status `not_started` rejected | D1 CHECK constraint: only `backlog/todo/in_progress/review/done` allowed | Changed to `todo` |
| SQL file FK errors | D1 file execution behaves differently to individual `--command` execution | Switched to PowerShell script running each section as separate `--command` call |
| Timesheet entries command too long | PowerShell/wrangler truncates very long `--command` strings | Split into 5 commands of 5 rows each |

---

## 6. IoT Project Showcase Data

**Project:** SEWIO IoT Platform  
**Client:** Xavvy Ltd  
**Budget:** £270,000 GBP  
**Duration:** 1 Nov 2025 → 31 Dec 2028 (38 months)  
**Team:** 4 engineers at 50% allocation (17.5 hrs/week each)

| Phase | Period | Status | Budget |
|---|---|---|---|
| 1 — Discovery & Requirements | Nov '25 – Jan '26 | ✅ Completed | £15K |
| 2 — System Design & Architecture | Feb '26 – Apr '26 | ✅ Completed | £20K |
| 3 — Core Infrastructure | May '26 – Sep '26 | 🔵 In Progress | £45K |
| 4 — Integration & APIs | Oct '26 – Feb '27 | ⬜ Upcoming | £50K |
| 5 — Frontend & Dashboards | Mar '27 – Jul '27 | ⬜ Upcoming | £45K |
| 6 — Testing & QA | Aug '27 – Nov '27 | ⬜ Upcoming | £30K |
| 7 — UAT & Pilot | Dec '27 – Apr '28 | ⬜ Upcoming | £40K |
| 8 — Go-Live & Optimisation | May '28 – Dec '28 | ⬜ Upcoming | £25K |

**74 tasks** across 8 phases. Phases 1 & 2 marked done. Phase 3 has 3 tasks in_progress, 6 todo. Phases 4–8 all todo.

**Team allocations:**
- Nanjusha Vasireddy — Business Analyst / PM
- Priya Narsing — BI & Analytics Engineer  
- Swathi M — Full Stack Developer
- Zeba Mansoor — Database Engineer

---

## 7. Deployment State

### Local (current)
- Worker running via `wrangler dev`
- D1 local database: `xavvysuite-fresh-db` (ID: `225260d0-2eb3-4a61-9eeb-d1d3aae6d1d3`)
- Frontend at `http://localhost:5173`
- Login: `admin@xavvy.uk` / `Password123`

### Production (ready to deploy)
Files prepared, not yet deployed:
- `DEPLOY_schema.sql` — 80 tables, 34 indexes, 10 ALTERs
- `DEPLOY_seed.sql` — tenant, roles, IoT team
- `IOT_PROJECT_SEED.ps1` — PowerShell script for IoT project data

**Deploy commands:**
```powershell
# Remote schema + seed
wrangler d1 execute xavvysuite-fresh-db --remote --file=schema/DEPLOY_schema.sql
wrangler d1 execute xavvysuite-fresh-db --remote --file=schema/DEPLOY_seed.sql
powershell -ExecutionPolicy Bypass -File .\IOT_PROJECT_SEED.ps1  # (change to --remote)

# Deploy worker
wrangler deploy

# Deploy frontend
cd apps/web && npm run build
npx wrangler pages deploy dist --project-name xavvysuite-web
```

**Domains:** `api-v2.xavvy.uk` (worker) · `app.xavvy.uk` (frontend)

---

## 8. Known Remaining Items

| Item | Priority | Notes |
|---|---|---|
| IoT seed Step 10 (timesheet entries) | High | Split into 5 commands of 5 rows — needs re-run with `$DB` variable set |
| Remote deployment | High | All files ready, commands documented above |
| R2 bucket binding in wrangler.toml | Medium | Storage graceful fallback active locally; bind for production |
| Email (MailChannels) | Medium | Only works in production — set `EMAIL_FROM` and `DEPLOYMENT_MODE=production` in vars |
| 5 missing DB indexes | Medium | Add `016_performance_indexes.sql` before going to 250 employees |
| Performance indexes | Low | Not needed for <50 employees |

---

## 9. File Locations

```
Xaviute/
  worker/
    src/
      index.ts                    ← All routes wired, public endpoints, error handler
      core/jwt.ts                 ← signAccessToken / verifyAccessToken
      core/storage.ts             ← R2 with graceful fallback
      modules/
        auth/, employees/, leave/, timesheets/, expenses/
        compliance/, documents/, training/, assets/
        recruitment/, onboarding/, offboarding/, sos/
        resources/, visa/, reporting/, checklists/
        settings/, billing/, storage/, profile/
        dashboard/, scheduler/, workflow/
    schema/
      DEPLOY_schema.sql           ← Single combined schema (production)
      DEPLOY_seed.sql             ← Single combined seed (production)
      IOT_PROJECT_SEED.ps1        ← IoT project PowerShell seed script
  apps/web/src/
    App.tsx                       ← Shell, sidebar, nav groups (collapsible), auth pages
    context/AuthContext.tsx       ← JWT, 401 handling, shell loading
    hooks/api.ts                  ← 901 lines, all ~60 hooks
    modules/                      ← All 26 module components
    platform/
      branding/theme.ts           ← C token system
      tenancy/TenantContext.tsx
      auth/apiClient.ts
```

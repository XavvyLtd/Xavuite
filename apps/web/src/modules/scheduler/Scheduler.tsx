import { useState } from 'react';
import {
  useScheduledJobs, useJobRunLog, useFireJob,
  useCreateScheduledJob, useUpdateScheduledJob, useDeleteScheduledJob,
  type ScheduledJob, type JobRunLog,
} from '../../hooks/api';
import {
  Card, Modal, InfoRow, MetricCard, MetricGrid,
  Loading, Alert, FormField, inputStyle, selectStyle,
  C, fmtDate,
} from '../../components/ui';
import { useQueryClient } from '@tanstack/react-query';

// ── Helpers ───────────────────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  system:     C.primary,
  compliance: C.danger,
  hr:         C.secondary,
  custom:     '#A855F7',
};

const CRON_PRESETS = [
  { label: 'Every weekday at 9am',  value: '0 9 * * 1-5' },
  { label: 'Every Monday at 8am',   value: '0 8 * * 1' },
  { label: 'Every Friday at 4pm',   value: '0 16 * * 5' },
  { label: 'Every day at 9am',      value: '0 9 * * *' },
  { label: '1st of every month',    value: '0 8 1 * *' },
  { label: 'Custom...',             value: 'custom' },
];

const PLACEHOLDER_DOCS = [
  { key: '{{employee_name}}',      desc: 'Full name of the employee' },
  { key: '{{manager_name}}',       desc: 'Full name of the line manager' },
  { key: '{{company_name}}',       desc: 'Tenant company name' },
  { key: '{{run_date}}',           desc: 'Date the job ran' },
  { key: '{{week_ending}}',        desc: 'Week ending date (timesheets)' },
  { key: '{{expiry_date}}',        desc: 'Document expiry date' },
  { key: '{{days_remaining}}',     desc: 'Days until expiry' },
  { key: '{{probation_end_date}}', desc: 'Probation period end date' },
  { key: '{{platform_url}}',       desc: 'Link to the platform' },
  { key: '{{total_pending}}',      desc: 'Total pending approval count' },
  { key: '{{rtw_rows}}',           desc: 'HTML table rows for RTW items' },
  { key: '{{leave_rows}}',         desc: 'HTML table rows for leave balance' },
];

function StatusPill({ status }: { status?: string }) {
  const colors: Record<string, string> = {
    success: C.success, error: C.danger, skipped: C.warning,
    running: C.sky, never: C.dim,
  };
  const s = status ?? 'never';
  return (
    <span style={{
      background: (colors[s] ?? C.dim) + '22',
      color:      colors[s] ?? C.dim,
      border:     `1px solid ${(colors[s] ?? C.dim)}33`,
      borderRadius: 6, fontSize: 10, fontWeight: 700,
      padding: '2px 8px', textTransform: 'uppercase', letterSpacing: '0.05em',
    }}>{s}</span>
  );
}

function CronHint({ expr }: { expr?: string }) {
  if (!expr) return null;
  const hints: Record<string, string> = {
    '0 8 * * 1':   'Every Monday at 8:00 AM',
    '0 9 * * *':   'Every day at 9:00 AM',
    '0 16 * * 5':  'Every Friday at 4:00 PM',
    '0 9 * * 1-5': 'Every weekday at 9:00 AM',
    '0 8 1 * *':   '1st of every month at 8:00 AM',
    '0 9 * * 1':   'Every Monday at 9:00 AM',
  };
  const hint = hints[expr];
  return hint ? <div style={{ fontSize: 11, color: C.secondary, marginTop: 4 }}>↻ {hint}</div> : null;
}

// ── Run Log Modal ─────────────────────────────────────────────────────────────
function RunLogModal({ job, onClose }: { job: ScheduledJob; onClose: () => void }) {
  const { data: logs, isLoading } = useJobRunLog(job.id);

  return (
    <Modal title={`Run History — ${job.name}`} onClose={onClose} wide>
      {isLoading ? <Loading /> : (
        <>
          {(!logs || logs.length === 0) && (
            <div style={{ textAlign: 'center', padding: '30px 0', color: C.dim, fontSize: 13 }}>
              No runs yet — fire the job manually or wait for its schedule.
            </div>
          )}
          {logs?.map(log => (
            <div key={log.id} style={{
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 10, padding: 14, marginBottom: 10,
              borderLeft: `4px solid ${log.status === 'success' ? C.success : log.status === 'error' ? C.danger : C.warning}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <StatusPill status={log.status} />
                  <span style={{ fontSize: 11, color: C.muted, textTransform: 'capitalize' }}>
                    {log.triggered_by === 'manual' ? '👆 Manual fire' : '⏰ Scheduled'}
                  </span>
                </div>
                <span style={{ fontSize: 11, color: C.dim }}>{fmtDate(log.started_at)}</span>
              </div>
              <div style={{ display: 'flex', gap: 20, fontSize: 12, color: C.muted }}>
                <span>📧 <strong style={{ color: C.text }}>{log.emails_sent}</strong> emails sent</span>
                <span>📋 <strong style={{ color: C.text }}>{log.records_processed}</strong> records</span>
                {log.duration_ms && <span>⏱ <strong style={{ color: C.text }}>{log.duration_ms}ms</strong></span>}
              </div>
              {log.error_message && (
                <div style={{ background: C.danger + '11', border: `1px solid ${C.danger}22`, borderRadius: 6, padding: '8px 10px', marginTop: 8, fontSize: 11, color: C.danger }}>
                  {log.error_message}
                </div>
              )}
              {log.output && (
                <div style={{ marginTop: 8, fontSize: 11, color: C.dim, fontFamily: 'monospace', background: C.elevated, borderRadius: 6, padding: '6px 10px' }}>
                  {(() => { try { return JSON.stringify(JSON.parse(log.output!), null, 2); } catch { return log.output; } })()}
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </Modal>
  );
}

// ── Job Form Modal (Create + Edit) ────────────────────────────────────────────
function JobFormModal({ job, onClose }: { job?: ScheduledJob; onClose: () => void }) {
  const isEdit = !!job;
  const createJob = useCreateScheduledJob();
  const updateJob = useUpdateScheduledJob(job?.id ?? '');
  const qc = useQueryClient();

  const [error, setError]   = useState('');
  const [saving, setSaving] = useState(false);
  const [tab, setTab]       = useState<'config' | 'template' | 'placeholders'>('config');

  const [form, setForm] = useState({
    name:          job?.name          ?? '',
    description:   job?.description   ?? '',
    category:      job?.category      ?? 'custom',
    enabled:       job?.enabled !== 0,
    scheduleType:  job?.schedule_type ?? 'cron',
    cronPreset:    'custom',
    cronExpr:      job?.cron_expr     ?? '0 9 * * 1',
    emailTo:       job?.email_to      ?? 'hr',
    emailToCustom: job?.email_to_custom ?? '',
    emailSubject:  job?.email_subject ?? '',
    emailBody:     job?.email_body    ?? '',
    triggerConfig: job?.trigger_config
      ? (() => { try { return JSON.stringify(JSON.parse(job.trigger_config!), null, 2); } catch { return '{}'; } })()
      : '{}',
  });

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handlePreset = (val: string) => {
    set('cronPreset', val);
    if (val !== 'custom') set('cronExpr', val);
  };

  const insertPlaceholder = (ph: string) => {
    set('emailBody', form.emailBody + ph);
  };

  const handleSave = async () => {
    if (!form.name.trim())         { setError('Name is required'); return; }
    if (!form.emailSubject.trim()) { setError('Email subject is required'); return; }
    if (!form.emailBody.trim())    { setError('Email body is required'); return; }
    if (!form.cronExpr.trim())     { setError('Cron expression is required'); return; }

    let triggerConfig: Record<string, unknown> = {};
    try { triggerConfig = JSON.parse(form.triggerConfig); } catch { setError('Trigger config must be valid JSON'); return; }

    setSaving(true); setError('');
    try {
      const payload = {
        name:          form.name,
        description:   form.description || undefined,
        category:      form.category,
        enabled:       form.enabled,
        scheduleType:  form.scheduleType,
        cronExpr:      form.cronExpr,
        emailTo:       form.emailTo,
        emailToCustom: form.emailToCustom || undefined,
        emailSubject:  form.emailSubject,
        emailBody:     form.emailBody,
        triggerConfig,
      };
      if (isEdit) {
        await updateJob.mutateAsync(payload);
      } else {
        await createJob.mutateAsync(payload);
      }
      qc.invalidateQueries({ queryKey: ['scheduler'] });
      onClose();
    } catch (e: any) { setError(e.message ?? 'Failed to save job'); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={isEdit ? `Edit — ${job!.name}` : 'New Scheduled Job'} onClose={onClose} wide>
      {error && <Alert type="error" message={error} />}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {(['config', 'template', 'placeholders'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: tab === t ? C.primary : C.elevated,
            color:      tab === t ? '#fff'    : C.muted,
            border: `1px solid ${tab === t ? C.primary : C.border}`,
            borderRadius: 8, padding: '6px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>
            {t === 'config' ? '⚙️ Config' : t === 'template' ? '📧 Email Template' : '📌 Placeholders'}
          </button>
        ))}
      </div>

      {/* ── Config tab ── */}
      {tab === 'config' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <FormField label="Job Name" required>
            <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Weekly Compliance Check" />
          </FormField>
          <FormField label="Category">
            <select style={selectStyle} value={form.category} onChange={e => set('category', e.target.value)}>
              <option value="compliance">Compliance</option>
              <option value="hr">HR</option>
              <option value="custom">Custom</option>
            </select>
          </FormField>
          <div style={{ gridColumn: '1/-1' }}>
            <FormField label="Description">
              <input style={inputStyle} value={form.description} onChange={e => set('description', e.target.value)} placeholder="What does this job do?" />
            </FormField>
          </div>

          <FormField label="Schedule">
            <select style={selectStyle} value={form.cronPreset} onChange={e => handlePreset(e.target.value)}>
              {CRON_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </FormField>
          <FormField label="Cron Expression" required>
            <input style={inputStyle} value={form.cronExpr} onChange={e => set('cronExpr', e.target.value)} placeholder="0 9 * * 1" />
            <CronHint expr={form.cronExpr} />
          </FormField>

          <FormField label="Send Email To">
            <select style={selectStyle} value={form.emailTo} onChange={e => set('emailTo', e.target.value)}>
              <option value="hr">HR Team</option>
              <option value="staff">All Staff</option>
              <option value="employee">Employee (per record)</option>
              <option value="custom">Custom email(s)</option>
            </select>
          </FormField>
          {form.emailTo === 'custom' && (
            <FormField label="Custom Email(s)">
              <input style={inputStyle} value={form.emailToCustom} onChange={e => set('emailToCustom', e.target.value)} placeholder="email1@co.uk, email2@co.uk" />
            </FormField>
          )}

          <div style={{ gridColumn: '1/-1' }}>
            <FormField label="Trigger Config (JSON)">
              <textarea style={{ ...inputStyle, height: 72, fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
                value={form.triggerConfig} onChange={e => set('triggerConfig', e.target.value)}
                placeholder='{"days_before": 90}' />
              <div style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>
                Common: <code style={{ background: C.elevated, padding: '1px 5px', borderRadius: 4 }}>{"{"}"days_before": 90{"}"}</code> &nbsp;
                <code style={{ background: C.elevated, padding: '1px 5px', borderRadius: 4 }}>{"{"}"skip_if_none": true{"}"}</code> &nbsp;
                <code style={{ background: C.elevated, padding: '1px 5px', borderRadius: 4 }}>{"{"}"notify_employee": true{"}"}</code>
              </div>
            </FormField>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" id="enabled" checked={form.enabled} onChange={e => set('enabled', e.target.checked)} />
            <label htmlFor="enabled" style={{ fontSize: 13, color: C.muted, cursor: 'pointer' }}>
              Job enabled — will run on schedule
            </label>
          </div>
        </div>
      )}

      {/* ── Template tab ── */}
      {tab === 'template' && (
        <div>
          <FormField label="Email Subject" required>
            <input style={inputStyle} value={form.emailSubject} onChange={e => set('emailSubject', e.target.value)}
              placeholder="e.g. RTW Alert: {{expired_count}} items need attention" />
          </FormField>
          <FormField label="Email Body (HTML with {{placeholders}})" required>
            <textarea
              style={{ ...inputStyle, height: 320, fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
              value={form.emailBody}
              onChange={e => set('emailBody', e.target.value)}
              placeholder="<p>Hi {{employee_name}},</p><p>This is a reminder...</p>"
            />
          </FormField>
          <div style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>
            Use the Placeholders tab to see available variables. Click any to insert it at the cursor.
          </div>
        </div>
      )}

      {/* ── Placeholders tab ── */}
      {tab === 'placeholders' && (
        <div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
            Click a placeholder to append it to the email body.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {PLACEHOLDER_DOCS.map(p => (
              <div key={p.key} onClick={() => { insertPlaceholder(p.key); setTab('template'); }}
                style={{
                  background: C.elevated, border: `1px solid ${C.border}`, borderRadius: 8,
                  padding: '10px 14px', cursor: 'pointer', transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = C.primary + '66')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
              >
                <code style={{ color: C.secondary, fontSize: 12, fontWeight: 700 }}>{p.key}</code>
                <div style={{ color: C.dim, fontSize: 11, marginTop: 3 }}>{p.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
        <button onClick={onClose} style={{ background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
        <button onClick={handleSave} disabled={saving} style={{ background: C.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Saving...' : isEdit ? 'Save Changes' : '+ Create Job'}
        </button>
      </div>
    </Modal>
  );
}

// ── Job Card ──────────────────────────────────────────────────────────────────
function JobCard({ job, onEdit, onLog }: { job: ScheduledJob; onEdit: () => void; onLog: () => void }) {
  const fire       = useFireJob(job.id);
  const updateJob  = useUpdateScheduledJob(job.id);
  const deleteJob  = useDeleteScheduledJob(job.id);
  const qc         = useQueryClient();
  const [firing, setFiring] = useState(false);
  const [fireResult, setFireResult] = useState<{ status: string; emailsSent: number } | null>(null);

  const handleFire = async () => {
    setFiring(true); setFireResult(null);
    try {
      const result = await fire.mutateAsync({}) as any;
      setFireResult({ status: result.status, emailsSent: result.emailsSent ?? 0 });
      qc.invalidateQueries({ queryKey: ['scheduler'] });
    } catch (e: any) {
      setFireResult({ status: 'error', emailsSent: 0 });
    } finally {
      setFiring(false);
    }
  };

  const handleToggle = async () => {
    await updateJob.mutateAsync({ enabled: !job.enabled } as any);
    qc.invalidateQueries({ queryKey: ['scheduler'] });
  };

  const handleDelete = async () => {
    if (!confirm(`Delete job "${job.name}"? This cannot be undone.`)) return;
    await deleteJob.mutateAsync({} as any);
    qc.invalidateQueries({ queryKey: ['scheduler'] });
  };

  const catColor = CATEGORY_COLORS[job.category] ?? C.dim;
  const isSystem = job.category === 'system';

  return (
    <div style={{
      background: C.card, border: `1px solid ${job.enabled ? C.border : C.border + '66'}`,
      borderRadius: 14, padding: 18, opacity: job.enabled ? 1 : 0.65,
      borderLeft: `4px solid ${catColor}`,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontWeight: 800, color: C.text, fontSize: 14 }}>{job.name}</span>
            <span style={{ background: catColor + '22', color: catColor, border: `1px solid ${catColor}33`, borderRadius: 6, fontSize: 9, fontWeight: 700, padding: '2px 7px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {job.category}
            </span>
            {isSystem && (
              <span style={{ background: C.dim + '22', color: C.dim, border: `1px solid ${C.dim}33`, borderRadius: 6, fontSize: 9, fontWeight: 700, padding: '2px 7px', textTransform: 'uppercase' }}>System</span>
            )}
          </div>
          {job.description && <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.4 }}>{job.description}</div>}
        </div>
        {/* Enable/disable toggle */}
        <button onClick={handleToggle} style={{
          background: job.enabled ? C.success + '22' : C.dim + '22',
          color:      job.enabled ? C.success       : C.dim,
          border: `1px solid ${job.enabled ? C.success + '44' : C.dim + '33'}`,
          borderRadius: 8, padding: '4px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0, marginLeft: 12,
        }}>
          {job.enabled ? '● Active' : '○ Disabled'}
        </button>
      </div>

      {/* Schedule + stats */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 11, color: C.dim }}>
          <span style={{ color: C.muted }}>⏰ Schedule:</span>{' '}
          <code style={{ color: C.text, background: C.elevated, padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>{job.cron_expr ?? job.schedule_type}</code>
          <CronHint expr={job.cron_expr} />
        </div>
        <div style={{ fontSize: 11, color: C.dim }}>
          <span style={{ color: C.muted }}>📧 To:</span>{' '}
          <span style={{ color: C.text }}>{job.email_to === 'custom' ? job.email_to_custom : job.email_to}</span>
        </div>
        <div style={{ fontSize: 11, color: C.dim }}>
          <span style={{ color: C.muted }}>Runs:</span>{' '}
          <span style={{ color: C.text, fontWeight: 700 }}>{job.run_count ?? 0}</span>
          {job.error_runs > 0 && <span style={{ color: C.danger, marginLeft: 4 }}>({job.error_runs} errors)</span>}
        </div>
      </div>

      {/* Last run */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '8px 10px', background: C.surface, borderRadius: 8 }}>
        <span style={{ fontSize: 11, color: C.dim }}>Last run:</span>
        <StatusPill status={job.last_run_status ?? 'never'} />
        {job.last_run_at && <span style={{ fontSize: 11, color: C.dim }}>{fmtDate(job.last_run_at)}</span>}
        {!job.last_run_at && <span style={{ fontSize: 11, color: C.dim }}>Never run</span>}
      </div>

      {/* Fire result */}
      {fireResult && (
        <div style={{ marginBottom: 10 }}>
          <Alert
            type={fireResult.status === 'success' ? 'success' : 'error'}
            message={fireResult.status === 'success'
              ? `✅ Job completed — ${fireResult.emailsSent} email${fireResult.emailsSent !== 1 ? 's' : ''} sent`
              : '❌ Job failed — check run log for details'
            }
          />
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {/* Fire now */}
        <button onClick={handleFire} disabled={firing} style={{
          background: firing ? C.success + '55' : C.success,
          color: '#fff', border: 'none', borderRadius: 8,
          padding: '7px 16px', fontSize: 12, fontWeight: 700,
          cursor: firing ? 'wait' : 'pointer', opacity: firing ? 0.7 : 1,
        }}>
          {firing ? '▶ Running...' : '▶ Fire Now'}
        </button>
        <button onClick={onEdit} style={{ background: C.primary + '22', color: C.primary, border: `1px solid ${C.primary}33`, borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          ✏️ Edit
        </button>
        <button onClick={onLog} style={{ background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          📋 Run Log
        </button>
        {!isSystem && (
          <button onClick={handleDelete} style={{ background: C.danger + '11', color: C.danger, border: `1px solid ${C.danger}22`, borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', marginLeft: 'auto' }}>
            🗑 Delete
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Scheduler Module ─────────────────────────────────────────────────────
export default function SchedulerModule() {
  const { data: jobs, isLoading, refetch } = useScheduledJobs();
  const [showCreate, setShowCreate] = useState(false);
  const [editJob,    setEditJob]    = useState<ScheduledJob | null>(null);
  const [logJob,     setLogJob]     = useState<ScheduledJob | null>(null);
  const [filter,     setFilter]     = useState('all');

  const all       = jobs ?? [];
  const active    = all.filter(j => j.enabled);
  const errored   = all.filter(j => j.last_run_status === 'error');
  const displayed = filter === 'all'      ? all    :
                    filter === 'active'   ? active  :
                    filter === 'errored'  ? errored :
                    all.filter(j => j.category === filter);

  const groups = [
    { key: 'compliance', label: '🛡 Compliance', jobs: displayed.filter(j => j.category === 'compliance') },
    { key: 'hr',         label: '👥 HR',         jobs: displayed.filter(j => j.category === 'hr') },
    { key: 'system',     label: '⚙️ System',     jobs: displayed.filter(j => j.category === 'system') },
    { key: 'custom',     label: '✨ Custom',     jobs: displayed.filter(j => j.category === 'custom') },
  ].filter(g => g.jobs.length > 0);

  return (
    <div className="animate-fadeIn">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ color: C.text, fontSize: 20, fontWeight: 800, margin: 0 }}>Job Scheduler</h2>
          <p style={{ color: C.muted, fontSize: 12, margin: '4px 0 0' }}>
            Automated emails, compliance checks and scheduled reports
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} style={{
          background: C.primary, color: '#fff', border: 'none',
          borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}>
          + New Job
        </button>
      </div>

      {/* Metrics */}
      <MetricGrid>
        <MetricCard label="Total Jobs"   value={all.length}          icon="⚙️" color={`linear-gradient(135deg,${C.primary},#8B5CF6)`} />
        <MetricCard label="Active"       value={active.length}       icon="✅" color={`linear-gradient(135deg,${C.success},${C.secondary})`} />
        <MetricCard label="Errors"       value={errored.length}      icon="❌" color={`linear-gradient(135deg,${C.danger},${C.warning})`} />
        <MetricCard label="Total Runs"   value={all.reduce((a, j) => a + (j.run_count ?? 0), 0)} icon="▶" color={`linear-gradient(135deg,${C.sky},${C.primary})`} />
      </MetricGrid>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { key: 'all',        label: `All (${all.length})` },
          { key: 'active',     label: `Active (${active.length})` },
          { key: 'compliance', label: '🛡 Compliance' },
          { key: 'hr',         label: '👥 HR' },
          { key: 'custom',     label: '✨ Custom' },
          { key: 'errored',    label: `❌ Errored (${errored.length})` },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{
            background: filter === f.key ? C.primary : C.elevated,
            color:      filter === f.key ? '#fff'    : C.muted,
            border: `1px solid ${filter === f.key ? C.primary : C.border}`,
            borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>{f.label}</button>
        ))}
      </div>

      {/* Job groups */}
      {isLoading ? <Loading /> : (
        <>
          {groups.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: C.dim }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⚙️</div>
              <div>No jobs match this filter</div>
            </div>
          )}
          {groups.map(group => (
            <div key={group.key} style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
                {group.label}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {group.jobs.map(job => (
                  <div key={job.id}>
                  <JobCard
                    job={job}
                    onEdit={() => setEditJob(job)}
                    onLog={()  => setLogJob(job)}
                  />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {/* Modals */}
      {showCreate && <JobFormModal onClose={() => { setShowCreate(false); refetch(); }} />}
      {editJob    && <JobFormModal job={editJob} onClose={() => { setEditJob(null); refetch(); }} />}
      {logJob     && <RunLogModal  job={logJob}  onClose={() => setLogJob(null)} />}
    </div>
  );
}

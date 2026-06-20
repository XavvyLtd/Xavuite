import { useState, useEffect, useMemo } from 'react';
import {
  useTimesheets, useTimesheetDetail, useSubmitTimesheet,
  useTimesheetDecision, useBulkTimesheetDecision,
  useProjects, useTasks,
} from '../../hooks/api';
import {
  Card, Modal, FormField, Loading, Alert, Btn,
  MetricCard, MetricGrid, StatusBadge, DataTable,
  inputStyle, selectStyle, C, fmtDate, ColDef,
} from '../../components/ui';
import { usePermission, PermissionGate, PERMISSIONS } from '../../platform/permissions/index';
import { useQueryClient } from '@tanstack/react-query';

// ── Helpers ───────────────────────────────────────────────────
function weekDates(weekStart: string): string[] {
  const dates: string[] = [];
  const d = new Date(weekStart);
  for (let i = 0; i < 7; i++) {
    dates.push(d.toISOString().split('T')[0]);
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function getMondayOf(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ── Main module ───────────────────────────────────────────────
export function TimesheetsModule() {
  const { can } = usePermission();
  const canApprove = can(PERMISSIONS.TS_APPROVE);

  const [view, setView]           = useState<'my' | 'team'>('my');
  const [showSubmit, setShowSubmit] = useState(false);
  const [viewId, setViewId]       = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkErr, setBulkErr]     = useState('');

  const { data: mySheets, isLoading: myLoading } = useTimesheets({ mine: 'true' });
  const { data: teamSheets, isLoading: teamLoading } = useTimesheets(
    canApprove ? { status: 'pending' } : undefined
  );
  const bulkDecide = useBulkTimesheetDecision();
  const qc = useQueryClient();

  const sheets: any[] = view === 'my' ? (mySheets as any ?? []) : (teamSheets as any ?? []);
  const isLoading     = view === 'my' ? myLoading : teamLoading;

  const pending  = (mySheets as any ?? []).filter((t: any) => t.status === 'pending').length;
  const approved = (mySheets as any ?? []).filter((t: any) => t.status === 'approved').length;
  const totalHrs = (mySheets as any ?? []).reduce((s: number, t: any) => s + (t.total_hours ?? 0), 0);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBulk = async (decision: 'approved' | 'rejected') => {
    if (selectedIds.size === 0) return;
    setBulkErr('');
    try {
      await bulkDecide.mutateAsync({ ids: Array.from(selectedIds), decision } as any);
      setSelectedIds(new Set());
      qc.invalidateQueries({ queryKey: ['timesheets'] });
    } catch (e: any) { setBulkErr(e.message ?? 'Failed'); }
  };

  const cols: ColDef<any>[] = [
    ...(canApprove && view === 'team' ? [{
      key: 'select', label: '',
      render: (_v: any, r: any) => (
        <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)} onClick={e => e.stopPropagation()} />
      ),
    }] : []),
    { key: 'employee_name', label: 'Employee',   render: (_v: any, r: any) => r.employee_name ?? 'Me' },
    { key: 'week_starting', label: 'Week',        render: (_v: any, r: any) => fmtDate(r.week_starting) },
    { key: 'total_hours',   label: 'Hours',       render: (_v: any, r: any) => <strong>{(r.total_hours ?? 0).toFixed(1)}h</strong> },
    { key: 'billable_hours',label: 'Billable',    render: (_v: any, r: any) => `${(r.billable_hours ?? 0).toFixed(1)}h` },
    { key: 'status',        label: 'Status',      render: (_v: any, r: any) => <StatusBadge status={r.status} /> },
    { key: 'submitted_at',  label: 'Submitted',   render: (_v: any, r: any) => fmtDate(r.submitted_at) },
  ];

  if (viewId) return <TimesheetDetail id={viewId} onBack={() => setViewId(null)} />;

  return (
    <div className="animate-fadeIn">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
        <div>
          <h2 style={{ color: C.text, fontSize: 20, fontWeight: 800, margin: 0 }}>Timesheets</h2>
          <p style={{ color: C.muted, fontSize: 12, margin: '4px 0 0' }}>Weekly time tracking with project and task allocation</p>
        </div>
        <PermissionGate permission={PERMISSIONS.TS_CREATE}>
          <Btn onClick={() => setShowSubmit(true)}>+ Log this week</Btn>
        </PermissionGate>
      </div>

      <MetricGrid>
        <MetricCard label="Pending"       value={pending}              icon="⏳" color={`linear-gradient(135deg,${C.warning},${C.amber})`} />
        <MetricCard label="Approved"      value={approved}             icon="✅" color={`linear-gradient(135deg,${C.success},${C.secondary})`} />
        <MetricCard label="Total hours"   value={`${totalHrs.toFixed(0)}h`} icon="🕐" color={`linear-gradient(135deg,${C.primary},#8B5CF6)`} />
        <MetricCard label="Weeks logged"  value={(mySheets as any ?? []).length} icon="📅" color={`linear-gradient(135deg,${C.sky},${C.primary})`} />
      </MetricGrid>

      {/* View tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[{ k: 'my', l: 'My timesheets' }, ...(canApprove ? [{ k: 'team', l: 'Pending approval' }] : [])].map(t => (
          <button key={t.k} onClick={() => setView(t.k as any)} style={{
            background: view === t.k ? C.primary : C.elevated,
            color:      view === t.k ? '#fff'    : C.muted,
            border: `1px solid ${view === t.k ? C.primary : C.border}`,
            borderRadius: 8, padding: '6px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>{t.l}</button>
        ))}
      </div>

      {/* Bulk actions for team view */}
      {canApprove && view === 'team' && (
        <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:8 }}>
          <button onClick={() => {
            const rows = (teamSheets as any[]) ?? [];
            const csv = ['Employee,Week,Hours,Billable,Status,Submitted']
              .concat(rows.map((r:any) => `"${r.employee_name ?? ''}","${r.week_starting}",${r.total_hours ?? 0},${r.billable_hours ?? 0},"${r.status}","${r.submitted_at ?? ''}"`))
              .join('\n');
            const a = document.createElement('a');
            a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
            a.download = `timesheets-${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
          }} style={{ background:C.elevated, color:C.muted, border:`1px solid ${C.border}`, borderRadius:8, padding:'5px 12px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
            ⬇ Export CSV
          </button>
        </div>
      )}

      {canApprove && view === 'team' && selectedIds.size > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, padding: '10px 14px', background: C.elevated, borderRadius: 10 }}>
          <span style={{ fontSize: 13, color: C.muted }}>{selectedIds.size} selected</span>
          <Btn small onClick={() => handleBulk('approved')} disabled={bulkDecide.isPending}>✓ Approve all</Btn>
          <button onClick={() => handleBulk('rejected')} disabled={bulkDecide.isPending} style={{ background: C.danger + '22', color: C.danger, border: `1px solid ${C.danger}33`, borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            ✕ Reject all
          </button>
          {bulkErr && <span style={{ fontSize: 12, color: C.danger }}>{bulkErr}</span>}
        </div>
      )}

      {isLoading ? <Loading /> : (
        <DataTable
          cols={cols}
          rows={sheets}
          onRow={r => setViewId(r.id)}
          emptyText={view === 'my' ? 'No timesheets yet — log your first week.' : 'No timesheets pending approval.'}
        />
      )}

      {showSubmit && <SubmitTimesheetModal onClose={() => setShowSubmit(false)} />}
    </div>
  );
}

// ── Submit timesheet modal ────────────────────────────────────
function SubmitTimesheetModal({ onClose }: { onClose: () => void }) {
  const qc      = useQueryClient();
  const submit  = useSubmitTimesheet();
  const { data: projects } = useProjects();
  const projectList: any[] = (projects as any) ?? [];

  const [weekStart, setWeekStart] = useState(getMondayOf(new Date()));
  const [errMsg, setErrMsg]       = useState('');
  const [saving, setSaving]       = useState(false);

  // One entry row per day of the week, each with its own project+task
  const [entries, setEntries] = useState(() =>
    weekDates(getMondayOf(new Date())).map(date => ({
      date,
      hoursWorked: 0,
      description: '',
      billable: false,
      projectId: '',
      taskId: '',
    }))
  );

  // When weekStart changes, regenerate date list but keep hours/project/task
  useEffect(() => {
    const dates = weekDates(weekStart);
    setEntries(prev => dates.map((date, i) => ({
      date,
      hoursWorked: prev[i]?.hoursWorked ?? 0,
      description: prev[i]?.description ?? '',
      billable:    prev[i]?.billable    ?? false,
      projectId:   prev[i]?.projectId   ?? '',
      taskId:      prev[i]?.taskId      ?? '',
    })));
  }, [weekStart]);

  const totalHours = entries.reduce((s, e) => s + (e.hoursWorked || 0), 0);

  const setEntry = (i: number, k: string, v: any) => {
    setEntries(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [k]: v };
      // Clear task when project changes
      if (k === 'projectId') next[i].taskId = '';
      return next;
    });
  };

  const handleSubmit = async () => {
    const filled = entries.filter(e => e.hoursWorked > 0);
    if (filled.length === 0) { setErrMsg('Enter hours for at least one day'); return; }
    setSaving(true); setErrMsg('');
    try {
      await submit.mutateAsync({
        weekStarting: weekStart,
        entries: filled.map(e => ({
          date:        e.date,
          hoursWorked: e.hoursWorked,
          description: e.description || undefined,
          billable:    e.billable,
          projectId:   e.projectId || undefined,
          taskId:      e.taskId    || undefined,
        })),
      } as any);
      qc.invalidateQueries({ queryKey: ['timesheets'] });
      onClose();
    } catch (e: any) { setErrMsg(e.message ?? 'Failed to submit'); }
    finally { setSaving(false); }
  };

  return (
    <Modal title="Log timesheet" onClose={onClose} wide>
      {errMsg && <Alert type="error" message={errMsg} />}

      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}>
        <FormField label="Week starting (Monday)">
          <input
            style={{ ...inputStyle, width: 160 }}
            type="date"
            value={weekStart}
            onChange={e => setWeekStart(getMondayOf(new Date(e.target.value)))}
          />
        </FormField>
        <div style={{ marginTop: 18, fontSize: 13, color: C.muted }}>
          Total: <strong style={{ color: C.text }}>{totalHours.toFixed(1)}h</strong>
        </div>
      </div>

      {/* Entry rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Header row */}
        <div style={{ display: 'grid', gridTemplateColumns: '70px 70px 1fr 1fr 80px 80px', gap: 8, padding: '0 0 4px', borderBottom: `1px solid ${C.border}` }}>
          {['Day', 'Hours', 'Project', 'Task', 'Billable', 'Notes'].map(h => (
            <span key={h} style={{ fontSize: 11, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
          ))}
        </div>

        {entries.map((entry, i) => (
          <EntryRow
            key={entry.date}
            entry={entry}
            dayLabel={DAY_LABELS[i]}
            projectList={projectList}
            onChange={(k, v) => setEntry(i, k, v)}
          />
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn onClick={handleSubmit} disabled={saving || totalHours === 0}>
          {saving ? 'Submitting...' : `Submit ${totalHours.toFixed(1)}h`}
        </Btn>
      </div>
    </Modal>
  );
}

// ── Entry row ─────────────────────────────────────────────────
function EntryRow({ entry, dayLabel, projectList, onChange }: {
  entry:       { date: string; hoursWorked: number; description: string; billable: boolean; projectId: string; taskId: string };
  dayLabel:    string;
  projectList: any[];
  onChange:    (k: string, v: any) => void;
}) {
  // Fetch tasks only for the selected project
  const { data: taskData } = useTasks(entry.projectId ? { projectId: entry.projectId } : undefined);
  const tasks: any[] = (taskData as any) ?? [];

  const isWeekend = dayLabel === 'Sat' || dayLabel === 'Sun';

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '70px 70px 1fr 1fr 80px 80px', gap: 8, alignItems: 'center',
      padding: '6px 8px', borderRadius: 8,
      background: isWeekend ? C.elevated + '88' : 'transparent',
      opacity: isWeekend && entry.hoursWorked === 0 ? 0.5 : 1,
    }}>
      {/* Day */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{dayLabel}</div>
        <div style={{ fontSize: 10, color: C.dim }}>{entry.date.slice(5)}</div>
      </div>

      {/* Hours */}
      <input
        style={{ ...inputStyle, textAlign: 'center', fontWeight: 700 }}
        type="number"
        min={0} max={24} step={0.5}
        value={entry.hoursWorked || ''}
        placeholder="0"
        onChange={e => onChange('hoursWorked', parseFloat(e.target.value) || 0)}
      />

      {/* Project */}
      <select
        style={{ ...selectStyle, opacity: entry.hoursWorked === 0 ? 0.5 : 1 }}
        value={entry.projectId}
        onChange={e => onChange('projectId', e.target.value)}
        disabled={entry.hoursWorked === 0}
      >
        <option value="">— No project —</option>
        {projectList.filter((p: any) => p.status === 'active' || p.status === 'planning').map((p: any) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>

      {/* Task — only shows tasks for selected project */}
      <select
        style={{ ...selectStyle, opacity: (!entry.projectId || entry.hoursWorked === 0) ? 0.5 : 1 }}
        value={entry.taskId}
        onChange={e => onChange('taskId', e.target.value)}
        disabled={!entry.projectId || entry.hoursWorked === 0}
      >
        <option value="">— No task —</option>
        {tasks.map((t: any) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>

      {/* Billable */}
      <div style={{ textAlign: 'center' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={entry.billable}
            onChange={e => onChange('billable', e.target.checked)}
            disabled={entry.hoursWorked === 0}
          />
          <span style={{ fontSize: 11, color: C.muted }}>Bill</span>
        </label>
      </div>

      {/* Notes */}
      <input
        style={{ ...inputStyle, fontSize: 11 }}
        value={entry.description}
        placeholder="Notes…"
        onChange={e => onChange('description', e.target.value)}
        disabled={entry.hoursWorked === 0}
      />
    </div>
  );
}

// ── Timesheet detail ──────────────────────────────────────────
function TimesheetDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { data, isLoading }    = useTimesheetDetail(id);
  const decide                 = useTimesheetDecision(id);
  const qc                     = useQueryClient();
  const { can }                = usePermission();
  const canApprove             = can(PERMISSIONS.TS_APPROVE);
  const [comment, setComment]  = useState('');
  const [deciding, setDeciding] = useState(false);
  const [errMsg, setErrMsg]    = useState('');

  const ts: any     = data;
  const entries: any[] = ts?.entries ?? [];

  const handleDecision = async (decision: 'approved' | 'rejected') => {
    setDeciding(true); setErrMsg('');
    try {
      await decide.mutateAsync({ decision, comment: comment || undefined } as any);
      qc.invalidateQueries({ queryKey: ['timesheets'] });
      onBack();
    } catch (e: any) { setErrMsg(e.message ?? 'Failed'); }
    finally { setDeciding(false); }
  };

  if (isLoading) return <Loading />;
  if (!ts)       return <Alert type="error" message="Timesheet not found" />;

  const totalHours    = entries.reduce((s: number, e: any) => s + (e.hours_worked ?? 0), 0);
  const billableHours = entries.reduce((s: number, e: any) => s + (e.billable ? (e.hours_worked ?? 0) : 0), 0);

  // Group entries by project for summary
  const byProject = entries.reduce((acc: any, e: any) => {
    const key = e.project_name ?? 'No project';
    acc[key]  = (acc[key] ?? 0) + (e.hours_worked ?? 0);
    return acc;
  }, {});

  return (
    <div className="animate-fadeIn">
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 12, marginBottom: 16, padding: 0 }}>
        ← Back to timesheets
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ color: C.text, fontSize: 20, fontWeight: 800, margin: 0 }}>
            Week of {fmtDate(ts.week_starting)}
          </h2>
          <p style={{ color: C.muted, fontSize: 13, margin: '4px 0 0' }}>
            {ts.employee_name} · <StatusBadge status={ts.status} />
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: C.text }}>{totalHours.toFixed(1)}h</div>
            <div style={{ fontSize: 12, color: C.muted }}>{billableHours.toFixed(1)}h billable</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20 }}>
        {/* Entry table */}
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.elevated }}>
                {['Date', 'Hours', 'Project', 'Task', 'Billable', 'Notes'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: C.dim, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `1px solid ${C.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e: any) => (
                <tr key={e.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '10px 14px', color: C.text }}>{fmtDate(e.date)}</td>
                  <td style={{ padding: '10px 14px', fontWeight: 700, color: C.text }}>{e.hours_worked}h</td>
                  <td style={{ padding: '10px 14px', color: C.muted }}>{e.project_name ?? <span style={{ color: C.dim }}>—</span>}</td>
                  <td style={{ padding: '10px 14px', color: C.muted }}>{e.task_name ?? <span style={{ color: C.dim }}>—</span>}</td>
                  <td style={{ padding: '10px 14px' }}>
                    {e.billable ? <span style={{ color: C.success, fontSize: 11, fontWeight: 700 }}>✓ Bill</span> : <span style={{ color: C.dim, fontSize: 11 }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 14px', color: C.dim, fontSize: 12 }}>{e.description ?? '—'}</td>
                </tr>
              ))}
              <tr style={{ background: C.elevated }}>
                <td style={{ padding: '10px 14px', fontWeight: 700, color: C.text }}>Total</td>
                <td style={{ padding: '10px 14px', fontWeight: 800, color: C.primary }}>{totalHours.toFixed(1)}h</td>
                <td colSpan={4} style={{ padding: '10px 14px', color: C.dim, fontSize: 12 }}>{billableHours.toFixed(1)}h billable</td>
              </tr>
            </tbody>
          </table>
        </Card>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Project breakdown */}
          <Card>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>By project</div>
            {Object.entries(byProject).map(([proj, hrs]: any) => (
              <div key={proj} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
                <span style={{ color: C.text }}>{proj}</span>
                <span style={{ fontWeight: 700, color: C.primary }}>{Number(hrs).toFixed(1)}h</span>
              </div>
            ))}
          </Card>

          {/* Approval */}
          {canApprove && ts.status === 'pending' && (
            <Card>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Decision</div>
              {errMsg && <Alert type="error" message={errMsg} />}
              <FormField label="Comment (optional)">
                <textarea style={{ ...inputStyle, height: 60, resize: 'vertical' }} value={comment} onChange={e => setComment(e.target.value)} />
              </FormField>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <Btn onClick={() => handleDecision('approved')} disabled={deciding}>✓ Approve</Btn>
                <button onClick={() => handleDecision('rejected')} disabled={deciding} style={{ background: C.danger + '22', color: C.danger, border: `1px solid ${C.danger}33`, borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  ✕ Reject
                </button>
              </div>
            </Card>
          )}

          {/* Decision info */}
          {ts.status !== 'pending' && (
            <Card>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                {ts.status === 'approved' ? '✅ Approved' : '❌ Rejected'}
              </div>
              {ts.decided_at && <div style={{ fontSize: 12, color: C.dim }}>{fmtDate(ts.decided_at)}</div>}
              {ts.comment    && <div style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>{ts.comment}</div>}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default TimesheetsModule;

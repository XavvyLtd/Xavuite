import { useState } from 'react';
import { useEmployees, type Employee } from '../../hooks/api';
import { useApi, useApiMutation } from '../../platform/auth/apiClient';;
import {
  Card, Modal, InfoRow, MetricCard, MetricGrid, StatusBadge,
  Avatar, Loading, Alert, FormField, inputStyle, selectStyle,
  C, fmtDate, ProgressBar,
} from '../../components/ui';
import { useQueryClient } from '@tanstack/react-query';

// ── Types ─────────────────────────────────────────────────────────────────────
interface OnboardingRecord {
  id:                string;
  employee_id:       string;
  first_name:        string;
  last_name:         string;
  start_date:        string;
  status:            string;
  completion_pct:    number;
  probation_end_date?:string;
  probation_status:  string;
  task_count:        number;
  completed_count:   number;
}

interface OnboardingTask {
  id:          string;
  category:    string;
  title:       string;
  description: string;
  owner:       string;
  due_date?:   string;
  status:      string;
  assigned_to_name?: string;
  completed_at?:string;
  notes?:      string;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────
function useOnboardingList() {
  return useApi<OnboardingRecord[]>(['onboarding'], '/api/onboarding');
}
function useOnboardingDetail(id: string) {
  return useApi<OnboardingRecord & { tasks: OnboardingTask[] }>(['onboarding', id], `/api/onboarding/${id}`, { enabled: !!id });
}
function useStartOnboarding() {
  return useApiMutation('/api/onboarding', 'POST', [['onboarding']]);
}
function useCompleteTask(onboardingId: string, taskId: string) {
  return useApiMutation(`/api/onboarding/${onboardingId}/tasks/${taskId}/complete`, 'POST', [['onboarding']]);
}

// ── Category config ───────────────────────────────────────────────────────────
const CATEGORY_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  it_setup:     { icon: '💻', label: 'IT Setup',     color: C.sky },
  hr_docs:      { icon: '📄', label: 'HR Docs',      color: C.primary },
  equipment:    { icon: '🖥️', label: 'Equipment',    color: C.secondary },
  access:       { icon: '🔑', label: 'Access',       color: C.warning },
  training:     { icon: '🎓', label: 'Training',     color: '#A855F7' },
  introduction: { icon: '👋', label: 'Introduction', color: C.success },
  legal:        { icon: '⚖️', label: 'Legal',        color: C.danger },
  other:        { icon: '📦', label: 'Other',        color: C.dim },
};

const OWNER_LABELS: Record<string, string> = { hr:'HR', it:'IT', manager:'Manager', employee:'Employee', finance:'Finance', legal:'Legal' };

// ── Start Onboarding Modal ────────────────────────────────────────────────────
function StartOnboardingModal({ onClose }: { onClose: () => void }) {
  const start = useStartOnboarding();
  const { data: employees } = useEmployees();
  const qc = useQueryClient();
  const [errMsg, setErrMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ employeeId: '', startDate: new Date().toISOString().split('T')[0], probationEndDate: '' });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  // Auto-set probation end date to 90 days after start
  const handleStartDateChange = (v: string) => {
    set('startDate', v);
    if (v) {
      const probEnd = new Date(new Date(v).getTime() + 90 * 86400000).toISOString().split('T')[0];
      set('probationEndDate', probEnd);
    }
  };

  const handleSave = async () => {
    if (!form.employeeId) { setErrMsg('Please select an employee'); return; }
    setSaving(true); setErrMsg('');
    try {
      await start.mutateAsync(form);
      qc.invalidateQueries({ queryKey: ['onboarding'] });
      onClose();
    } catch (e: any) { setErrMsg(e.message ?? 'Failed to start onboarding'); }
    finally { setSaving(false); }
  };

  return (
    <Modal title="Start Onboarding" onClose={onClose} wide>
      {errMsg && <Alert type="error" message={errMsg} />}
      <FormField label="Employee" required>
        <select style={selectStyle} value={form.employeeId} onChange={e => set('employeeId', e.target.value)}>
          <option value="">Select employee...</option>
          {(employees?.items ?? []).map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
        </select>
      </FormField>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <FormField label="Start Date" required>
          <input style={inputStyle} type="date" value={form.startDate} onChange={e => handleStartDateChange(e.target.value)} />
        </FormField>
        <FormField label="Probation End Date">
          <input style={inputStyle} type="date" value={form.probationEndDate} onChange={e => set('probationEndDate', e.target.value)} />
        </FormField>
      </div>
      <div style={{ background: C.elevated, borderRadius: 8, padding: '10px 14px', fontSize: 12, color: C.muted, marginTop: 8 }}>
        💡 The standard onboarding checklist (18 tasks) will be automatically created for this employee.
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
        <button onClick={onClose} style={{ background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
        <button onClick={handleSave} disabled={saving} style={{ background: saving ? C.primary + '99' : C.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: saving ? 'wait' : 'pointer' }}>
          {saving ? 'Starting...' : 'Start Onboarding'}
        </button>
      </div>
    </Modal>
  );
}

// ── Onboarding Detail Modal ───────────────────────────────────────────────────
function OnboardingDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, isLoading, refetch } = useOnboardingDetail(id);
  const qc = useQueryClient();
  const [activeCategory, setActiveCategory] = useState('all');

  if (isLoading) return <Modal title="Onboarding" onClose={onClose}><Loading /></Modal>;
  if (!data) return null;

  const tasks = data.tasks ?? [];
  const categories = [...new Set(tasks.map(t => t.category))];
  const filtered = activeCategory === 'all' ? tasks : tasks.filter(t => t.category === activeCategory);
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const pct = tasks.length > 0 ? Math.round(completedCount / tasks.length * 100) : 0;

  const handleComplete = async (taskId: string) => {
    const token = localStorage.getItem('access_token');
    await fetch(`/api/onboarding/${id}/tasks/${taskId}/complete`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    refetch();
  };

  const probationDaysLeft = data.probation_end_date
    ? Math.ceil((new Date(data.probation_end_date).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <Modal title={`${data.first_name} ${data.last_name} — Onboarding`} onClose={onClose} wide>
      {/* Header stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
        <div style={{ background: C.surface, borderRadius: 10, padding: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: C.primary }}>{pct}%</div>
          <div style={{ fontSize: 11, color: C.muted }}>Complete</div>
          <div style={{ marginTop: 6 }}><ProgressBar value={pct} color={C.primary} /></div>
        </div>
        <div style={{ background: C.surface, borderRadius: 10, padding: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: C.success }}>{completedCount}</div>
          <div style={{ fontSize: 11, color: C.muted }}>Tasks Done</div>
          <div style={{ fontSize: 10, color: C.dim, marginTop: 4 }}>of {tasks.length} total</div>
        </div>
        <div style={{ background: C.surface, borderRadius: 10, padding: 14, textAlign: 'center' }}>
          {probationDaysLeft !== null ? (
            <>
              <div style={{ fontSize: 24, fontWeight: 800, color: probationDaysLeft > 14 ? C.text : C.danger }}>{probationDaysLeft}</div>
              <div style={{ fontSize: 11, color: C.muted }}>Probation Days Left</div>
              <div style={{ fontSize: 10, color: C.dim, marginTop: 4 }}>{data.probation_status}</div>
            </>
          ) : (
            <div style={{ fontSize: 12, color: C.dim, paddingTop: 10 }}>No probation set</div>
          )}
        </div>
      </div>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        <button onClick={() => setActiveCategory('all')} style={{ background: activeCategory === 'all' ? C.primary : C.elevated, color: activeCategory === 'all' ? '#fff' : C.muted, border: `1px solid ${activeCategory === 'all' ? C.primary : C.border}`, borderRadius: 8, padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>All ({tasks.length})</button>
        {categories.map(cat => {
          const cfg = (CATEGORY_CONFIG as Record<string,any>)[cat as string] ?? CATEGORY_CONFIG.other;
          const catTasks = tasks.filter(t => t.category === cat);
          const catDone  = catTasks.filter(t => t.status === 'completed').length;
          return (
            <button key={cat} onClick={() => setActiveCategory(cat)} style={{ background: activeCategory === cat ? cfg.color + '33' : C.elevated, color: activeCategory === cat ? cfg.color : C.muted, border: `1px solid ${activeCategory === cat ? cfg.color : C.border}`, borderRadius: 8, padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              {cfg.icon} {cfg.label} ({catDone}/{catTasks.length})
            </button>
          );
        })}
      </div>

      {/* Task list */}
      <div style={{ maxHeight: 400, overflowY: 'auto' }}>
        {filtered.map(task => {
          const cfg = (CATEGORY_CONFIG as any)[task.category] ?? CATEGORY_CONFIG.other;
          const done = task.status === 'completed';
          const overdue = task.due_date && !done && new Date(task.due_date) < new Date();
          return (
            <div key={task.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0',
              borderBottom: `1px solid ${C.border}33`, opacity: done ? 0.7 : 1,
            }}>
              <button onClick={() => !done && handleComplete(task.id)} style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                background: done ? C.success : 'transparent',
                border: `2px solid ${done ? C.success : C.border}`,
                cursor: done ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 11, fontWeight: 800,
              }}>
                {done ? '✓' : ''}
              </button>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: done ? 400 : 600, color: done ? C.dim : C.text, textDecoration: done ? 'line-through' : 'none' }}>{task.title}</span>
                  <span style={{ background: cfg.color + '22', color: cfg.color, borderRadius: 4, fontSize: 9, padding: '1px 6px', fontWeight: 700 }}>{cfg.icon} {cfg.label}</span>
                </div>
                {task.description && <div style={{ fontSize: 11, color: C.dim, marginBottom: 4 }}>{task.description}</div>}
                <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
                  <span style={{ color: C.dim }}>Owner: <span style={{ color: C.muted }}>{OWNER_LABELS[task.owner] ?? task.owner}</span></span>
                  {task.due_date && <span style={{ color: overdue ? C.danger : C.dim, fontWeight: overdue ? 700 : 400 }}>Due: {fmtDate(task.due_date)}{overdue ? ' ⚠️' : ''}</span>}
                  {task.completed_at && <span style={{ color: C.success }}>Done: {fmtDate(task.completed_at)}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

// ── Main Onboarding Module ────────────────────────────────────────────────────
export default function OnboardingModule() {
  const [showStart, setShowStart]     = useState(false);
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [filter, setFilter]           = useState('all');

  const { data: onboardings, isLoading } = useOnboardingList();
  const all  = onboardings ?? [];
  const active    = all.filter(o => o.status === 'in_progress');
  const overdue   = all.filter(o => o.status === 'overdue');
  const completed = all.filter(o => o.status === 'completed');
  const onProbation = all.filter(o => o.probation_status === 'in_progress');
  const displayed = filter === 'all' ? all : filter === 'active' ? active : filter === 'overdue' ? overdue : completed;

  return (
    <div className="animate-fadeIn">
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ color: C.text, fontSize: 20, fontWeight: 800, margin: 0 }}>Onboarding</h2>
          <p style={{ color: C.muted, fontSize: 12, margin: '4px 0 0' }}>New starter checklists and probation tracking</p>
        </div>
        <button onClick={() => setShowStart(true)} style={{ background: C.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          + Start Onboarding
        </button>
      </div>

      <MetricGrid>
        <MetricCard label="Active"      value={active.length}     icon="🎯" color={`linear-gradient(135deg,${C.primary},#8B5CF6)`} />
        <MetricCard label="On Probation" value={onProbation.length} icon="⏳" color={`linear-gradient(135deg,${C.warning},${C.danger})`} />
        <MetricCard label="Overdue"     value={overdue.length}    icon="⚠️" color={`linear-gradient(135deg,${C.danger},#7F1D1D)`} />
        <MetricCard label="Completed"   value={completed.length}  icon="✅" color={`linear-gradient(135deg,${C.success},${C.secondary})`} />
      </MetricGrid>

      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {[
          { key: 'all',       label: `All (${all.length})` },
          { key: 'active',    label: `Active (${active.length})` },
          { key: 'overdue',   label: `Overdue (${overdue.length})` },
          { key: 'completed', label: `Completed (${completed.length})` },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{ background: filter === f.key ? C.primary : C.elevated, color: filter === f.key ? '#fff' : C.muted, border: `1px solid ${filter === f.key ? C.primary : C.border}`, borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{f.label}</button>
        ))}
      </div>

      {isLoading ? <Loading /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {displayed.map(o => {
            const probDaysLeft = o.probation_end_date ? Math.ceil((new Date(o.probation_end_date).getTime() - Date.now()) / 86400000) : null;
            return (
              <Card key={o.id} onClick={() => setSelectedId(o.id)} style={{ cursor: 'pointer', borderLeft: `4px solid ${o.status === 'completed' ? C.success : o.status === 'overdue' ? C.danger : C.primary}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Avatar name={`${o.first_name} ${o.last_name}`} size={40} />
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14, color: C.text }}>{o.first_name} {o.last_name}</div>
                      <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                        Started {fmtDate(o.start_date)}
                        {probDaysLeft !== null && probDaysLeft > 0 && <span style={{ marginLeft: 10, color: probDaysLeft < 14 ? C.danger : C.dim }}>· Probation: {probDaysLeft}d left</span>}
                        {probDaysLeft !== null && probDaysLeft <= 0 && <span style={{ marginLeft: 10, color: C.danger }}>· Probation ended</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <StatusBadge status={o.status} />
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>{o.completed_count}/{o.task_count} tasks</div>
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.dim, marginBottom: 4 }}>
                    <span>Progress</span>
                    <span style={{ fontWeight: 700, color: C.text }}>{o.completion_pct}%</span>
                  </div>
                  <ProgressBar value={o.completion_pct} color={o.status === 'completed' ? C.success : o.status === 'overdue' ? C.danger : C.primary} />
                </div>
              </Card>
            );
          })}
          {displayed.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: C.dim }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
              <div>No onboarding records — start one for a new hire</div>
            </div>
          )}
        </div>
      )}

      {showStart   && <StartOnboardingModal onClose={() => setShowStart(false)} />}
      {selectedId  && <OnboardingDetailModal id={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

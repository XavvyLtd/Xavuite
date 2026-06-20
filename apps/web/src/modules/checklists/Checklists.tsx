import { useState } from 'react';
import {
  useChecklistTemplates, useChecklistRuns, useChecklistRunDetail,
  useStartChecklist, useEmployees,
  type ChecklistTemplate, type ChecklistRun, type ChecklistTask,
} from '../../hooks/api';
import {
  Card, Modal, MetricCard, MetricGrid, StatusBadge,
  Avatar, Loading, Alert, FormField, inputStyle, selectStyle,
  ProgressBar, C, fmtDate,
} from '../../components/ui';
import { useQueryClient } from '@tanstack/react-query';

const CATEGORY_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  operational: { icon: '⚙️', color: C.primary,   label: 'Operational' },
  site_audit:  { icon: '🏢', color: C.secondary, label: 'Site Audit'   },
  compliance:  { icon: '🛡', color: C.danger,    label: 'Compliance'   },
  hr:          { icon: '👥', color: '#A855F7',   label: 'HR'           },
  it:          { icon: '💻', color: C.sky,      label: 'IT'           },
  custom:      { icon: '📋', color: C.dim,       label: 'Custom'       },
};

// ── Start checklist modal ─────────────────────────────────────────────────────
function StartChecklistModal({ onClose }: { onClose: () => void }) {
  const { data: templates } = useChecklistTemplates();
  const { data: employees }  = useEmployees();
  const start = useStartChecklist();
  const qc    = useQueryClient();
  const [errMsg, setErrMsg]     = useState('');
  const [saving, setSaving]     = useState(false);
  const [form, setForm]         = useState({ templateId: '', title: '', dueDate: '', assignedTo: '' });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleTemplateChange = (id: string) => {
    const t = (templates ?? []).find(t => t.id === id);
    set('templateId', id);
    if (t) setForm(f => ({ ...f, templateId: id, title: t.name }));
  };

  const handleSave = async () => {
    if (!form.templateId) { setErrMsg('Please select a template'); return; }
    setSaving(true); setErrMsg('');
    try {
      await start.mutateAsync({ ...form, assignedTo: form.assignedTo || undefined, dueDate: form.dueDate || undefined });
      qc.invalidateQueries({ queryKey: ['checklists', 'runs'] });
      onClose();
    } catch (e: any) { setErrMsg(e.message ?? 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <Modal title="Start Checklist" onClose={onClose} wide>
      {errMsg && <Alert type="error" message={errMsg} />}
      <FormField label="Template" required>
        <select style={selectStyle} value={form.templateId} onChange={e => handleTemplateChange(e.target.value)}>
          <option value="">Select template...</option>
          {(templates ?? []).map(t => {
            const cfg = CATEGORY_CONFIG[t.category] ?? CATEGORY_CONFIG.custom;
            return <option key={t.id} value={t.id}>{cfg.icon} {t.name}</option>;
          })}
        </select>
      </FormField>
      <FormField label="Title">
        <input style={inputStyle} value={form.title} onChange={e => set('title', e.target.value)} placeholder="Custom title (optional)" />
      </FormField>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <FormField label="Due Date">
          <input style={inputStyle} type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} />
        </FormField>
        <FormField label="Assign To">
          <select style={selectStyle} value={form.assignedTo} onChange={e => set('assignedTo', e.target.value)}>
            <option value="">Unassigned</option>
            {(employees?.items ?? []).map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
          </select>
        </FormField>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
        <button onClick={onClose} style={{ background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
        <button onClick={handleSave} disabled={saving} style={{ background: saving ? C.primary + '99' : C.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: saving ? 'wait' : 'pointer' }}>
          {saving ? 'Starting...' : '▶ Start Checklist'}
        </button>
      </div>
    </Modal>
  );
}

// ── Checklist run detail modal ────────────────────────────────────────────────
function ChecklistRunModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, isLoading, refetch } = useChecklistRunDetail(id);
  const qc = useQueryClient();

  const handleComplete = async (taskId: string, notes?: string) => {
    const token = localStorage.getItem('access_token');
    await fetch(`/api/checklists/runs/${id}/tasks/${taskId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ notes }),
    });
    refetch();
  };

  const handleSkip = async (taskId: string) => {
    const token = localStorage.getItem('access_token');
    await fetch(`/api/checklists/runs/${id}/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: 'skipped' }),
    });
    refetch();
  };

  if (isLoading) return <Modal title="Checklist" onClose={onClose}><Loading /></Modal>;
  if (!data) return null;

  const tasks: ChecklistTask[] = (data as any).tasks ?? [];
  const done     = tasks.filter(t => t.status === 'completed').length;
  const skipped  = tasks.filter(t => t.status === 'skipped').length;
  const pending  = tasks.filter(t => t.status === 'pending').length;
  const pct      = tasks.length > 0 ? Math.round(done / tasks.length * 100) : 0;
  const cfg      = CATEGORY_CONFIG[(data as any).category] ?? CATEGORY_CONFIG.custom;

  return (
    <Modal title={data.title} onClose={onClose} wide>
      {/* Header stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div style={{ flex: 1, background: C.surface, borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: C.primary }}>{pct}%</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Complete</div>
          <div style={{ marginTop: 6 }}><ProgressBar value={pct} color={cfg.color} /></div>
        </div>
        <div style={{ flex: 1, background: C.surface, borderRadius: 10, padding: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: C.success }}>{done}</div>
          <div style={{ fontSize: 11, color: C.muted }}>Done</div>
        </div>
        <div style={{ flex: 1, background: C.surface, borderRadius: 10, padding: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: C.warning }}>{pending}</div>
          <div style={{ fontSize: 11, color: C.muted }}>Pending</div>
        </div>
        <div style={{ flex: 1, background: C.surface, borderRadius: 10, padding: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: C.dim }}>{skipped}</div>
          <div style={{ fontSize: 11, color: C.muted }}>Skipped</div>
        </div>
      </div>

      {/* Task list */}
      <div style={{ maxHeight: 440, overflowY: 'auto' }}>
        {tasks.map((task, i) => {
          const done = task.status === 'completed';
          const skipped = task.status === 'skipped';
          return (
            <div key={task.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0', borderBottom: `1px solid ${C.border}33`, opacity: skipped ? 0.5 : 1 }}>
              {/* Checkbox */}
              <button onClick={() => !done && !skipped && handleComplete(task.id)} style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                background: done ? cfg.color : 'transparent',
                border: `2px solid ${done ? cfg.color : C.border}`,
                cursor: done || skipped ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 11, fontWeight: 800,
              }}>
                {done ? '✓' : ''}
              </button>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: done ? 400 : 600, color: done || skipped ? C.dim : C.text, textDecoration: done ? 'line-through' : 'none' }}>
                    {task.title}
                  </span>
                  {task.required === 1 && !done && <span style={{ fontSize: 9, color: C.danger, fontWeight: 700, textTransform: 'uppercase' }}>Required</span>}
                </div>
                {task.description && <div style={{ fontSize: 11, color: C.dim }}>{task.description}</div>}
                {task.completed_at && <div style={{ fontSize: 10, color: C.success, marginTop: 2 }}>✓ Completed {fmtDate(task.completed_at)}</div>}
                {task.notes && <div style={{ fontSize: 10, color: C.muted, fontStyle: 'italic', marginTop: 2 }}>{task.notes}</div>}
              </div>
              {!done && !skipped && (
                <button onClick={() => handleSkip(task.id)} style={{ background: 'transparent', color: C.dim, border: 'none', fontSize: 10, cursor: 'pointer', flexShrink: 0, padding: '2px 6px' }}>
                  Skip
                </button>
              )}
              {skipped && <span style={{ fontSize: 10, color: C.dim, flexShrink: 0 }}>Skipped</span>}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

// ── Main Checklists Module ────────────────────────────────────────────────────
export default function ChecklistsModule() {
  const [tab, setTab]           = useState<'runs' | 'templates'>('runs');
  const [showStart, setShowStart] = useState(false);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [filter, setFilter]     = useState('all');

  const { data: templates, isLoading: tL } = useChecklistTemplates();
  const { data: runs,      isLoading: rL } = useChecklistRuns(filter !== 'all' ? { status: filter } : undefined);

  const allRuns   = runs ?? [];
  const active    = allRuns.filter(r => r.status === 'in_progress');
  const completed = allRuns.filter(r => r.status === 'completed');
  const overdue   = allRuns.filter(r => r.status === 'overdue');

  return (
    <div className="animate-fadeIn">
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ color: C.text, fontSize: 20, fontWeight: 800, margin: 0 }}>Checklists</h2>
          <p style={{ color: C.muted, fontSize: 12, margin: '4px 0 0' }}>Operational tasks, site audits and compliance checks</p>
        </div>
        <button onClick={() => setShowStart(true)} style={{ background: C.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          ▶ Start Checklist
        </button>
      </div>

      <MetricGrid>
        <MetricCard label="Active"    value={active.length}    icon="▶" color={`linear-gradient(135deg,${C.primary},#8B5CF6)`} />
        <MetricCard label="Completed" value={completed.length} icon="✅" color={`linear-gradient(135deg,${C.success},${C.secondary})`} />
        <MetricCard label="Overdue"   value={overdue.length}   icon="⚠️" color={`linear-gradient(135deg,${C.danger},#7F1D1D)`} />
        <MetricCard label="Templates" value={(templates ?? []).length} icon="📋" color={`linear-gradient(135deg,${C.sky},${C.primary})`} />
      </MetricGrid>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        <button onClick={() => setTab('runs')} style={{ background: tab === 'runs' ? C.primary : C.elevated, color: tab === 'runs' ? '#fff' : C.muted, border: `1px solid ${tab === 'runs' ? C.primary : C.border}`, borderRadius: 8, padding: '7px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          ▶ Active Runs
        </button>
        <button onClick={() => setTab('templates')} style={{ background: tab === 'templates' ? C.primary : C.elevated, color: tab === 'templates' ? '#fff' : C.muted, border: `1px solid ${tab === 'templates' ? C.primary : C.border}`, borderRadius: 8, padding: '7px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          📋 Templates
        </button>
      </div>

      {/* ── Runs tab ── */}
      {tab === 'runs' && (
        <>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {['all', 'in_progress', 'completed', 'overdue'].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{ background: filter === f ? C.primary : C.elevated, color: filter === f ? '#fff' : C.muted, border: `1px solid ${filter === f ? C.primary : C.border}`, borderRadius: 8, padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize' }}>
                {f === 'in_progress' ? 'Active' : f === 'all' ? `All (${allRuns.length})` : f}
              </button>
            ))}
          </div>
          {rL ? <Loading /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {allRuns.map(run => {
                const cfg = CATEGORY_CONFIG[run.category] ?? CATEGORY_CONFIG.custom;
                const overdue = run.due_date && run.status !== 'completed' && new Date(run.due_date) < new Date();
                return (
                  <Card key={run.id} onClick={() => setSelectedRun(run.id)} style={{ cursor: 'pointer', borderLeft: `4px solid ${cfg.color}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 16 }}>{cfg.icon}</span>
                          <span style={{ fontWeight: 800, fontSize: 14, color: C.text }}>{run.title}</span>
                          <span style={{ background: cfg.color + '22', color: cfg.color, borderRadius: 6, fontSize: 9, padding: '2px 7px', fontWeight: 700, textTransform: 'uppercase' }}>{cfg.label}</span>
                        </div>
                        <div style={{ fontSize: 12, color: C.muted }}>
                          Started {fmtDate(run.created_at)}
                          {run.assigned_to_name && ` · ${run.assigned_to_name}`}
                          {run.due_date && <span style={{ color: overdue ? C.danger : C.dim }}> · Due {fmtDate(run.due_date)}{overdue ? ' ⚠️' : ''}</span>}
                        </div>
                      </div>
                      <StatusBadge status={run.status} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1 }}><ProgressBar value={run.completion_pct} color={run.status === 'completed' ? C.success : cfg.color} /></div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.text, flexShrink: 0 }}>{run.completion_pct}%</span>
                    </div>
                  </Card>
                );
              })}
              {allRuns.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: C.dim }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
                  <div>No checklists yet — start one using a template</div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Templates tab ── */}
      {tab === 'templates' && (
        tL ? <Loading /> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
            {(templates ?? []).map(t => {
              const cfg = CATEGORY_CONFIG[t.category] ?? CATEGORY_CONFIG.custom;
              return (
                <Card key={t.id} style={{ borderTop: `3px solid ${cfg.color}` }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                    <span style={{ fontSize: 24 }}>{cfg.icon}</span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14, color: C.text }}>{t.name}</div>
                      <span style={{ background: cfg.color + '22', color: cfg.color, borderRadius: 6, fontSize: 9, padding: '2px 7px', fontWeight: 700, textTransform: 'uppercase' }}>{cfg.label}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>{t.task_count} tasks</div>
                  <button onClick={() => { setShowStart(true); }} style={{ background: cfg.color, color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', width: '100%' }}>
                    ▶ Start This Checklist
                  </button>
                </Card>
              );
            })}
          </div>
        )
      )}

      {showStart   && <StartChecklistModal onClose={() => setShowStart(false)} />}
      {selectedRun && <ChecklistRunModal id={selectedRun} onClose={() => setSelectedRun(null)} />}
    </div>
  );
}

import { useState, useMemo } from 'react';
import {
  useProjects, useProject, useCreateProject, useUpdateProject,
  useTasks, useCreateTask, useUpdateTask,
  useSprints, useProjectAllocations, useAddAllocation, useRemoveAllocation, useDeleteProject,
  useAvailableResources, useSeedProjectTasks, useProjectTemplates, useClients,
} from '../../hooks/api';
import {
  Card, Modal, FormField, Loading, Alert, Btn, Avatar,
  StatusBadge, MetricCard, MetricGrid, ProgressBar,
  inputStyle, selectStyle, C, fmtDate, ColDef,
} from '../../components/ui';
import { PermissionGate, PERMISSIONS, usePermission } from '../../platform/permissions/index';
import { useQueryClient } from '@tanstack/react-query';

// ── Constants ─────────────────────────────────────────────────
const KANBAN_COLS = ['backlog','todo','in_progress','review','done'] as const;
const COL_LABELS: Record<string, string> = {
  backlog:'Backlog', todo:'To Do', in_progress:'In Progress', review:'Review', done:'Done'
};
const COL_COLORS: Record<string, string> = {
  backlog: C.dim, todo: C.muted, in_progress: C.amber, review: C.sky, done: '#10B981'
};
const TYPE_CONFIG: Record<string, { label: string; icon: string; colour: string }> = {
  iot:           { label: 'IoT',              icon: '📡', colour: '#0EA5E9' },
  data_migration:{ label: 'Data & Migration', icon: '🗄️', colour: '#8B5CF6' },
  platform:      { label: 'Platform',         icon: '🚀', colour: '#10B981' },
  support:       { label: 'Support',          icon: '🛟', colour: '#F59E0B' },
  training:      { label: 'Training / HR',    icon: '🎓', colour: '#EC4899' },
  general:       { label: 'General',          icon: '📂', colour: '#6366F1' },
};

// ── Util ──────────────────────────────────────────────────────
function utilisationColor(pct: number) {
  if (pct >= 90) return '#EF4444';
  if (pct >= 70) return '#F59E0B';
  return '#10B981';
}

// ════════════════════════════════════════════════════════════════
// PROJECT CARD
// ════════════════════════════════════════════════════════════════
function ProjectCard({ project: p, onClick, onDelete }: { project: any; onClick: () => void; onDelete?: (id: string, name: string) => void }) {
  const { can } = usePermission();
  const tc    = TYPE_CONFIG[p.project_type ?? 'general'] ?? TYPE_CONFIG.general;
  const color = p.colour ?? tc.colour;
  const pct   = p.completion_pct ?? 0;

  return (
    <Card onClick={onClick} style={{ cursor: 'pointer', borderTop: `3px solid ${color}`, position: 'relative' }}>
      {onDelete && can(PERMISSIONS.PMO_MANAGE) && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(p.id, p.name); }}
          title="Delete project"
          style={{
            position: 'absolute', top: 8, right: 8, background: 'transparent',
            border: 'none', color: C.dim, cursor: 'pointer', fontSize: 14,
            padding: 4, borderRadius: 4, lineHeight: 1,
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#EF4444'; }}
          onMouseLeave={e => { e.currentTarget.style.color = C.dim; }}
        >
          ✕
        </button>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 14 }}>{tc.icon}</span>
            <span style={{ fontSize: 11, color: color, fontWeight: 700 }}>{tc.label}</span>
          </div>
          <div style={{ fontWeight: 800, color: C.text, fontSize: 14, lineHeight: 1.3,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {p.name}
          </div>
          {p.client_company_name && (
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>🏢 {p.client_company_name}</div>
          )}
        </div>
        <StatusBadge status={p.priority} />
      </div>

      {p.description && (
        <p style={{ fontSize: 11, color: C.dim, margin: '0 0 10px', lineHeight: 1.5,
          overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {p.description}
        </p>
      )}

      <ProgressBar value={pct} color={pct >= 90 ? '#10B981' : pct >= 50 ? C.amber : C.muted} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.dim, marginTop: 4, marginBottom: 10 }}>
        <span>{pct}% complete</span>
        <span>{p.open_task_count ?? 0} open · {p.task_count ?? 0} total tasks</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
        <StatusBadge status={p.status} />
        <div style={{ display: 'flex', gap: 10, fontSize: 11, color: C.dim }}>
          {p.team_size > 0 && <span>👥 {p.team_size}</span>}
          {p.end_date && <span>📅 {fmtDate(p.end_date)}</span>}
          {p.budget > 0 && <span>💷 £{(p.budget/1000).toFixed(0)}k</span>}
        </div>
      </div>
    </Card>
  );
}

// ════════════════════════════════════════════════════════════════
// RESOURCE UTILISATION PANEL (used in project create + project detail)
// ════════════════════════════════════════════════════════════════
function ResourcePanel({
  startDate,
  selectedIds,
  onToggle,
  readOnly = false,
}: {
  startDate?: string;
  selectedIds?: Set<string>;
  onToggle?: (id: string, name: string) => void;
  readOnly?: boolean;
}) {
  const { data: resources, isLoading } = useAvailableResources(startDate);
  const people: any[] = resources ?? [];

  if (isLoading) return <Loading />;
  if (people.length === 0) return <div style={{ color: C.dim, fontSize: 12 }}>No active employees found.</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {people.map((r: any) => {
        const pct      = r.utilisation_pct ?? 0;
        const avail    = Math.max(0, 37.5 - r.booked_hours_per_week);
        const isSelected = selectedIds?.has(r.employee_id);
        const color    = utilisationColor(pct);

        return (
          <div key={r.employee_id}
            onClick={() => !readOnly && onToggle?.(r.employee_id, r.employee_name)}
            style={{
              display: 'flex', gap: 10, alignItems: 'center',
              padding: '10px 12px', borderRadius: 10,
              border: `1px solid ${isSelected ? C.primary : C.border}`,
              background: isSelected ? C.primary + '11' : C.elevated,
              cursor: readOnly ? 'default' : 'pointer',
              transition: 'border-color 0.15s, background 0.15s',
            }}
          >
            <Avatar name={r.employee_name} size={36} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{r.employee_name}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color }}>
                  {pct}% booked
                </span>
              </div>
              <ProgressBar value={pct} color={color} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11 }}>
                <span style={{ color: C.dim }}>{r.designation ?? r.department ?? ''}</span>
                <span style={{ color: pct >= 90 ? '#EF4444' : '#10B981' }}>
                  {avail.toFixed(1)}h/wk free
                </span>
              </div>
              {r.current_projects && !readOnly && (
                <div style={{ fontSize: 10, color: C.dim, marginTop: 2,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  📂 {r.current_projects}
                </div>
              )}
            </div>
            {!readOnly && (
              <div style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                background: isSelected ? C.primary : 'transparent',
                border: `2px solid ${isSelected ? C.primary : C.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {isSelected && <span style={{ color: '#fff', fontSize: 12, lineHeight: 1 }}>✓</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}


// ════════════════════════════════════════════════════════════════
// RESOURCE PANEL WITH HOURS INPUT
// Shows utilisation + lets user set hours/week per person
// ════════════════════════════════════════════════════════════════
function ResourcePanelWithHours({
  startDate,
  selected,
  onToggle,
  onUpdateHours,
}: {
  startDate?: string;
  selected: Map<string, { name: string; hoursPerWeek: number; allocation: number }>;
  onToggle: (id: string, name: string) => void;
  onUpdateHours: (id: string, hours: number) => void;
}) {
  const { data: resources, isLoading } = useAvailableResources(startDate);
  const people: any[] = resources ?? [];

  if (isLoading) return <Loading />;
  if (people.length === 0) return <div style={{ color: C.dim, fontSize: 12 }}>No active employees found.</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {people.map((r: any) => {
        const pct       = r.utilisation_pct ?? 0;
        const avail     = Math.max(0, 37.5 - r.booked_hours_per_week);
        const isSelected = selected.has(r.employee_id);
        const selData   = selected.get(r.employee_id);
        const color     = utilisationColor(pct);

        return (
          <div key={r.employee_id} style={{
            borderRadius: 10, border: `1px solid ${isSelected ? C.primary : C.border}`,
            background: isSelected ? C.primary + '0d' : C.elevated,
            overflow: 'hidden', transition: 'border-color 0.15s',
          }}>
            {/* Main row — click to toggle */}
            <div
              onClick={() => onToggle(r.employee_id, r.employee_name)}
              style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', cursor: 'pointer' }}
            >
              <Avatar name={r.employee_name} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{r.employee_name}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color }}>{pct}% booked</span>
                </div>
                <ProgressBar value={pct} color={color} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11 }}>
                  <span style={{ color: C.dim }}>{r.designation ?? r.department ?? ''}</span>
                  <span style={{ color: pct >= 90 ? '#EF4444' : '#10B981' }}>{avail.toFixed(1)}h/wk free</span>
                </div>
                {r.current_projects && (
                  <div style={{ fontSize: 10, color: C.dim, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    📂 {r.current_projects}
                  </div>
                )}
              </div>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                background: isSelected ? C.primary : 'transparent',
                border: `2px solid ${isSelected ? C.primary : C.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {isSelected && <span style={{ color: '#fff', fontSize: 12 }}>✓</span>}
              </div>
            </div>

            {/* Expanded hours input when selected */}
            {isSelected && selData && (
              <div
                style={{ padding: '8px 12px 12px 58px', borderTop: `1px solid ${C.primary}22` }}
                onClick={e => e.stopPropagation()}
              >
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <FormField label="Hours per week on this project">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        style={{ ...inputStyle, width: 80, textAlign: 'center' }}
                        type="number"
                        min={1} max={37.5} step={0.5}
                        value={selData.hoursPerWeek}
                        onChange={e => onUpdateHours(r.employee_id, parseFloat(e.target.value) || 0)}
                      />
                      <span style={{ fontSize: 12, color: C.muted }}>h/wk = {selData.allocation}% allocation</span>
                    </div>
                  </FormField>
                  {/* Quick presets */}
                  <div style={{ display: 'flex', gap: 4, marginTop: 16 }}>
                    {[{ l: '25%', h: 9.4 }, { l: '50%', h: 18.75 }, { l: '75%', h: 28.1 }, { l: '100%', h: 37.5 }].map(p => (
                      <button key={p.l} type="button"
                        onClick={() => onUpdateHours(r.employee_id, p.h)}
                        style={{
                          padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                          border: `1px solid ${Math.abs(selData.hoursPerWeek - p.h) < 0.5 ? C.primary : C.border}`,
                          background: Math.abs(selData.hoursPerWeek - p.h) < 0.5 ? C.primary + '22' : 'transparent',
                          color: Math.abs(selData.hoursPerWeek - p.h) < 0.5 ? C.primary : C.muted,
                        }}>
                        {p.l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// PROJECT FORM MODAL — 3-step wizard
// Step 1: Details  →  Step 2: Resources  →  Step 3: Seed tasks
// ════════════════════════════════════════════════════════════════
function ProjectFormModal({ project, onClose }: { project?: any; onClose: () => void }) {
  const qc     = useQueryClient();
  const create = useCreateProject();
  const update = useUpdateProject();
  const addAllocation  = useAddAllocation();
  const seedTasks      = useSeedProjectTasks();
  const { data: templatesData, isLoading: tmplLoading } = useProjectTemplates();
  const templates: any[] = (templatesData as any) ?? [];
  const { data: clientsData } = useClients({});
  const clients: any[] = (clientsData as any)?.clients ?? [];

  // Step state — edit mode goes straight to details, no seeding step
  const [step, setStep] = useState<'details' | 'resources' | 'tasks'>(
    project ? 'details' : 'details'
  );
  const [errMsg, setErrMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(project?.id ?? null);

  // ── Step 1: Project details ───────────────────────────────────
  const [form, setForm] = useState({
    name:        project?.name         ?? '',
    description: project?.description  ?? '',
    clientId:    project?.client_id    ?? '',
    projectType: project?.project_type ?? 'general',
    colour:      project?.colour       ?? '#6366F1',
    startDate:   project?.start_date   ?? '',
    endDate:     project?.end_date     ?? '',
    budget:      project?.budget?.toString() ?? '',
    priority:    project?.priority     ?? 'medium',
    status:      project?.status       ?? 'planning',
  });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  // ── Step 2: Resources ─────────────────────────────────────────
  // Map of employeeId → { name, hoursPerWeek, allocation }
  const [resources, setResources] = useState<Map<string, { name: string; hoursPerWeek: number; allocation: number }>>(new Map());

  const toggleResource = (id: string, name: string) => {
    setResources(prev => {
      const next = new Map(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.set(id, { name, hoursPerWeek: 17.5, allocation: 50 });
      }
      return next;
    });
  };

  const updateResourceHours = (id: string, hoursPerWeek: number) => {
    setResources(prev => {
      const next = new Map(prev);
      const existing = next.get(id);
      if (existing) {
        const allocation = Math.round((hoursPerWeek / 37.5) * 100);
        next.set(id, { ...existing, hoursPerWeek, allocation });
      }
      return next;
    });
  };

  // ── Step 3: Task seeding ──────────────────────────────────────
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [skipSeed, setSkipSeed] = useState(false);

  // Task count preview per template
  const TEMPLATE_INFO: Record<string, { phases: number; tasks: number; description: string }> = {
    iot:            { phases: 6, tasks: 30, description: 'IoT/RTLS deployment from site survey through go-live with hardware, integrations, dashboards and UAT' },
    data_migration: { phases: 5, tasks: 20, description: 'Legacy to cloud migration covering profiling, ETL build, validation, dashboards and production cutover' },
    platform:       { phases: 4, tasks: 18, description: 'SaaS platform build from architecture through feature modules, security testing and launch' },
    support:        { phases: 3, tasks: 14, description: 'Managed support retainer with incident management, monitoring, enhancements and quarterly reviews' },
    training:       { phases: 4, tasks: 15, description: 'Team upskilling programme — certifications, technical skills, soft skills and internal knowledge sharing' },
    general:        { phases: 4, tasks: 12, description: 'Generic project lifecycle — initiation, planning, execution and closure phases' },
  };

  // ── Handlers ──────────────────────────────────────────────────
  const handleSaveDetails = async () => {
    if (!form.name.trim()) { setErrMsg('Project name is required'); return; }
    setSaving(true); setErrMsg('');
    try {
      const payload = {
        ...form,
        budget:   form.budget ? Number(form.budget) : undefined,
        clientId: form.clientId || undefined,
      };
      if (project?.id) {
        await update.mutateAsync({ id: project.id, ...payload } as any);
        qc.invalidateQueries({ queryKey: ['pmo', 'projects'] });
        onClose();
      } else {
        const result: any = await create.mutateAsync(payload as any);
        setCreatedId(result.id);
        // Don't pre-select - user picks from DB template list in step 3
        setSelectedTemplate('');
        qc.invalidateQueries({ queryKey: ['pmo', 'projects'] });
        setStep('resources');
      }
    } catch (e: any) { setErrMsg(e.message ?? 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleSaveResources = async () => {
    if (!createdId) { setStep('tasks'); return; }
    setSaving(true);
    try {
      for (const [empId, r] of resources.entries()) {
        await addAllocation.mutateAsync({
          projectId:   createdId,
          employeeId:  empId,
          allocation:  r.allocation,
          hoursPerWeek: r.hoursPerWeek,
        } as any);
      }
      setStep('tasks');
    } catch (e: any) { setErrMsg(e.message ?? 'Failed to assign resources'); }
    finally { setSaving(false); }
  };

  const [seedResult, setSeedResult] = useState<{ tasks_created: number; sprints_created: number; timesheets_created: number } | null>(null);

  const handleSeedTasks = async () => {
    if (skipSeed || !selectedTemplate || !createdId) { onClose(); return; }
    setSaving(true); setErrMsg('');
    try {
      const allocations = Array.from(resources.entries()).map(([employeeId, r]) => ({
        employeeId,
        hoursPerWeek: r.hoursPerWeek,
        allocation:   r.allocation,
      }));

      const result: any = await seedTasks.mutateAsync({
        projectId:  createdId,
        templateId: selectedTemplate,
        startDate:  form.startDate || undefined,
        endDate:    form.endDate   || undefined,
        allocations,
      } as any);

      qc.invalidateQueries({ queryKey: ['pmo', 'tasks'] });
      qc.invalidateQueries({ queryKey: ['timesheets'] });
      setSeedResult(result);
    } catch (e: any) { setErrMsg(e.message ?? 'Failed to seed tasks'); setSaving(false); }
  };

  // ── Step indicator ────────────────────────────────────────────
  const STEPS = [
    { key: 'details',   label: '1. Details'   },
    { key: 'resources', label: '2. Resources' },
    { key: 'tasks',     label: '3. Tasks'     },
  ];

  const tc = TYPE_CONFIG[form.projectType] ?? TYPE_CONFIG.general;

  return (
    <Modal
      title={project ? `Edit — ${project.name}` : `New project — ${STEPS.find(s => s.key === step)?.label}`}
      onClose={onClose}
      wide
    >
      {/* Step indicator (new projects only) */}
      {!project && (
        <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: `1px solid ${C.border}`, paddingBottom: 14 }}>
          {STEPS.map((s, i) => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800,
                  background: step === s.key ? C.primary : (STEPS.indexOf(STEPS.find(x => x.key === step)!) > i ? '#10B981' : C.elevated),
                  color: step === s.key || (STEPS.indexOf(STEPS.find(x => x.key === step)!) > i) ? '#fff' : C.dim,
                }}>
                  {STEPS.indexOf(STEPS.find(x => x.key === step)!) > i ? '✓' : i + 1}
                </div>
                <span style={{ fontSize: 12, fontWeight: step === s.key ? 700 : 400, color: step === s.key ? C.text : C.dim }}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ width: 32, height: 1, background: C.border, margin: '0 8px' }} />
              )}
            </div>
          ))}
        </div>
      )}

      {errMsg && <Alert type="error" message={errMsg} />}

      {/* ── STEP 1: DETAILS ─────────────────────────────────── */}
      {step === 'details' && (
        <>
          {/* Type picker */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>
              Project type
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {Object.entries(TYPE_CONFIG).map(([key, tc]) => (
                <button key={key} type="button"
                  onClick={() => { set('projectType', key); set('colour', tc.colour); }}
                  style={{
                    padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    border: `1px solid ${form.projectType === key ? tc.colour : C.border}`,
                    background: form.projectType === key ? tc.colour + '22' : C.elevated,
                    color: form.projectType === key ? tc.colour : C.muted,
                  }}>
                  {tc.icon} {tc.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Project name *">
              <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. SEWIO IoT Platform" />
            </FormField>
            <FormField label="Client">
              <select style={selectStyle} value={form.clientId} onChange={e => set('clientId', e.target.value)}>
                <option value="">— Internal / no client —</option>
                {clients.map((c: any) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
            </FormField>
          </div>

          <FormField label="Description">
            <textarea style={{ ...inputStyle, height: 64, resize: 'vertical', marginTop: 10 }}
              value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="Scope, objectives and key deliverables…" />
          </FormField>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginTop: 12 }}>
            <FormField label="Start date">
              <input style={inputStyle} type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
            </FormField>
            <FormField label="End date">
              <input style={inputStyle} type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} />
            </FormField>
            <FormField label="Budget (£)">
              <input style={inputStyle} type="number" min="0" value={form.budget} onChange={e => set('budget', e.target.value)} placeholder="0" />
            </FormField>
            <FormField label="Priority">
              <select style={selectStyle} value={form.priority} onChange={e => set('priority', e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </FormField>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, marginTop: 12, alignItems: 'end' }}>
            <FormField label="Status">
              <select style={selectStyle} value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="planning">Planning</option>
                <option value="active">Active</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </FormField>
            <FormField label="Colour">
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', paddingTop: 4 }}>
                {['#6366F1','#0EA5E9','#10B981','#F59E0B','#EC4899','#8B5CF6','#EF4444'].map(col => (
                  <button key={col} type="button" onClick={() => set('colour', col)} style={{
                    width: 24, height: 24, borderRadius: '50%', background: col,
                    border: `2px solid ${form.colour === col ? '#fff' : 'transparent'}`,
                    cursor: 'pointer', boxShadow: form.colour === col ? `0 0 0 2px ${col}` : 'none',
                  }} />
                ))}
              </div>
            </FormField>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
            <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
            <Btn onClick={handleSaveDetails} disabled={saving}>
              {saving ? 'Saving...' : project ? 'Save changes' : 'Next: Assign resources →'}
            </Btn>
          </div>
        </>
      )}

      {/* ── STEP 2: RESOURCES ───────────────────────────────── */}
      {step === 'resources' && (
        <>
          <p style={{ fontSize: 13, color: C.muted, margin: '0 0 4px' }}>
            Select team members and adjust their weekly hours for this project.
            Hours are used to proportionally auto-assign tasks in the next step.
          </p>
          <p style={{ fontSize: 11, color: C.dim, margin: '0 0 16px' }}>
            Showing current utilisation across all active projects.
          </p>

          <ResourcePanelWithHours
            startDate={form.startDate || undefined}
            selected={resources}
            onToggle={toggleResource}
            onUpdateHours={updateResourceHours}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
            <button onClick={() => setStep('details')} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 13 }}>
              ← Back
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="secondary" onClick={() => setStep('tasks')}>Skip resources</Btn>
              <Btn onClick={handleSaveResources} disabled={saving || resources.size === 0}>
                {saving ? 'Assigning...' : `Next: Seed tasks → (${resources.size} selected)`}
              </Btn>
            </div>
          </div>
        </>
      )}

      {/* ── STEP 3: SEED TASKS ──────────────────────────────── */}
      {step === 'tasks' && seedResult && (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
          <h3 style={{ color: C.text, margin: '0 0 16px', fontWeight: 800 }}>Project created!</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
            {[
              { icon: '📋', label: 'Tasks created',       value: seedResult.tasks_created },
              { icon: '🏃', label: 'Sprints created',     value: seedResult.sprints_created },
              { icon: '⏱️', label: 'Timesheets generated', value: seedResult.timesheets_created },
            ].map(m => (
              <div key={m.label} style={{ background: C.elevated, borderRadius: 10, padding: '14px 10px', border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>{m.icon}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: C.primary }}>{m.value}</div>
                <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{m.label}</div>
              </div>
            ))}
          </div>
          {seedResult.timesheets_created > 0 && (
            <div style={{ fontSize: 12, color: C.muted, background: C.elevated, borderRadius: 8, padding: '10px 14px', marginBottom: 20, textAlign: 'left' }}>
              ✅ <strong style={{ color: C.text }}>{seedResult.timesheets_created} approved timesheets</strong> were automatically generated
              for all backdated weeks up to today, with hours distributed proportionally to each resource's allocation.
            </div>
          )}
          <Btn onClick={onClose}>Done — view project</Btn>
        </div>
      )}

      {step === 'tasks' && !seedResult && (
        <>
          <p style={{ fontSize: 13, color: C.muted, margin: '0 0 16px' }}>
            Choose a task template to automatically generate a realistic set of phases and tasks,
            spread across your project dates and assigned proportionally to your selected resources.
          </p>

          {tmplLoading && <Loading />}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {templates.map((tmpl: any) => {
              const tc  = TYPE_CONFIG[tmpl.project_type] ?? TYPE_CONFIG.general;
              const sel = selectedTemplate === tmpl.id;
              return (
                <div key={tmpl.id}
                  onClick={() => { setSelectedTemplate(tmpl.id); setSkipSeed(false); }}
                  style={{
                    display: 'flex', gap: 14, alignItems: 'flex-start',
                    padding: '12px 16px', borderRadius: 10, cursor: 'pointer',
                    border: `2px solid ${sel ? tc.colour : C.border}`,
                    background: sel ? tc.colour + '11' : C.elevated,
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                >
                  <div style={{ fontSize: 24, flexShrink: 0, marginTop: 2 }}>{tc.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: sel ? tc.colour : C.text }}>{tmpl.name}</span>
                        {tmpl.is_system ? (
                          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: C.border, color: C.dim }}>System</span>
                        ) : (
                          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: tc.colour + '22', color: tc.colour }}>Custom</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: tc.colour + '22', color: tc.colour, fontWeight: 700 }}>
                          {tmpl.phase_count} phases
                        </span>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: C.border, color: C.muted, fontWeight: 700 }}>
                          {tmpl.task_count} tasks
                        </span>
                      </div>
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: C.dim, lineHeight: 1.5 }}>{tmpl.description}</p>
                  </div>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                    background: sel ? tc.colour : 'transparent',
                    border: `2px solid ${sel ? tc.colour : C.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {sel && <span style={{ color: '#fff', fontSize: 11 }}>✓</span>}
                  </div>
                </div>
              );
            })}

            {/* Skip option */}
            <div
              onClick={() => { setSkipSeed(true); setSelectedTemplate(''); }}
              style={{
                display: 'flex', gap: 14, alignItems: 'center',
                padding: '12px 16px', borderRadius: 10, cursor: 'pointer',
                border: `2px solid ${skipSeed ? C.muted : C.border}`,
                background: skipSeed ? C.elevated : 'transparent',
              }}
            >
              <div style={{ fontSize: 24 }}>✨</div>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: C.muted }}>Start blank</span>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: C.dim }}>I'll create tasks manually. Skip task seeding.</p>
              </div>
              <div style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                background: skipSeed ? C.muted : 'transparent',
                border: `2px solid ${skipSeed ? C.muted : C.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {skipSeed && <span style={{ color: '#fff', fontSize: 11 }}>✓</span>}
              </div>
            </div>
          </div>

          {/* Preview of what will happen */}
          {selectedTemplate && !skipSeed && (() => {
            const tmpl = templates.find((t: any) => t.id === selectedTemplate);
            if (!tmpl) return null;
            const tc = TYPE_CONFIG[tmpl.project_type] ?? TYPE_CONFIG.general;
            return (
              <div style={{ padding: '12px 16px', background: C.card, borderRadius: 10, border: `1px solid ${tc.colour}44`, marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: tc.colour, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                  What will be created
                </div>
                <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.8 }}>
                  <div>📋 <strong style={{ color: C.text }}>{tmpl.task_count} tasks</strong> across <strong style={{ color: C.text }}>{tmpl.phase_count} phases / sprints</strong></div>
                  <div>📅 Dates spread from <strong style={{ color: C.text }}>{form.startDate || 'today'}</strong> to <strong style={{ color: C.text }}>{form.endDate || '(open-ended)'}</strong></div>
                  {resources.size > 0 && (
                    <div>👥 Auto-assigned to: <strong style={{ color: C.text }}>{Array.from(resources.values()).map(r => r.name).join(', ')}</strong></div>
                  )}
                  <div style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>
                    Tasks distributed proportionally — team members with more hours/week get more tasks assigned.
                    You can reassign any task afterwards from the board view.
                  </div>
                </div>
              </div>
            );
          })()}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            <button onClick={() => setStep('resources')} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 13 }}>
              ← Back
            </button>
            <Btn
              onClick={handleSeedTasks}
              disabled={saving || (!selectedTemplate && !skipSeed)}
            >
              {saving
                ? 'Creating tasks & timesheets…'
                : skipSeed
                  ? 'Finish — create project'
                  : `Create project with ${templates.find((t: any) => t.id === selectedTemplate)?.task_count ?? ''} tasks`
              }
            </Btn>
          </div>
        </>
      )}
    </Modal>
  );
}



// ════════════════════════════════════════════════════════════════
// ADD TASK MODAL
// ════════════════════════════════════════════════════════════════
function AddTaskModal({ onClose, projects, defaultProjectId }: { onClose: () => void; projects: any[]; defaultProjectId?: string }) {
  const qc     = useQueryClient();
  const create = useCreateTask();
  const { data: sprints } = useSprints(defaultProjectId ? { projectId: defaultProjectId } : undefined);
  const { data: resources } = useAvailableResources();

  const [errMsg, setErrMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    projectId:      defaultProjectId ?? (projects[0]?.id ?? ''),
    sprintId:       '',
    name:           '',
    description:    '',
    assigneeId:     '',
    priority:       'medium',
    status:         'backlog',
    estimatedHours: '8',
    dueDate:        '',
    phase:          '',
    category:       '',
  });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim() || !form.projectId) { setErrMsg('Project and task name required'); return; }
    setSaving(true); setErrMsg('');
    try {
      await create.mutateAsync({
        ...form,
        estimatedHours: form.estimatedHours ? Number(form.estimatedHours) : 8,
        assigneeId:     form.assigneeId  || undefined,
        sprintId:       form.sprintId    || undefined,
        dueDate:        form.dueDate     || undefined,
        phase:          form.phase       || undefined,
        category:       form.category    || undefined,
      } as any);
      qc.invalidateQueries({ queryKey: ['pmo', 'tasks'] });
      onClose();
    } catch (e: any) { setErrMsg(e.message ?? 'Failed to create task'); }
    finally { setSaving(false); }
  };

  const sprintList: any[] = (sprints as any) ?? [];
  const people: any[]     = resources ?? [];

  return (
    <Modal title="New task" onClose={onClose}>
      {errMsg && <Alert type="error" message={errMsg} />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Project *">
            <select style={selectStyle} value={form.projectId} onChange={e => set('projectId', e.target.value)}>
              <option value="">Select project…</option>
              {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </FormField>
          <FormField label="Sprint / Phase">
            <select style={selectStyle} value={form.sprintId} onChange={e => set('sprintId', e.target.value)}>
              <option value="">No sprint</option>
              {sprintList.map((s: any) => <option key={s.id} value={s.id}>{s.sprint_name}</option>)}
            </select>
          </FormField>
        </div>
        <FormField label="Task name *">
          <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Build bronze layer ingestion pipeline" />
        </FormField>
        <FormField label="Description">
          <textarea style={{ ...inputStyle, height: 60, resize: 'vertical' }} value={form.description} onChange={e => set('description', e.target.value)} />
        </FormField>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
          <FormField label="Assignee">
            <select style={selectStyle} value={form.assigneeId} onChange={e => set('assigneeId', e.target.value)}>
              <option value="">Unassigned</option>
              {people.map((p: any) => <option key={p.employee_id} value={p.employee_id}>{p.employee_name}</option>)}
            </select>
          </FormField>
          <FormField label="Priority">
            <select style={selectStyle} value={form.priority} onChange={e => set('priority', e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </FormField>
          <FormField label="Status">
            <select style={selectStyle} value={form.status} onChange={e => set('status', e.target.value)}>
              <option value="backlog">Backlog</option>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="review">Review</option>
              <option value="done">Done</option>
            </select>
          </FormField>
          <FormField label="Est. hours">
            <input style={inputStyle} type="number" min="1" value={form.estimatedHours} onChange={e => set('estimatedHours', e.target.value)} />
          </FormField>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <FormField label="Due date">
            <input style={inputStyle} type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} />
          </FormField>
          <FormField label="Phase">
            <input style={inputStyle} value={form.phase} onChange={e => set('phase', e.target.value)} placeholder="e.g. Discovery" />
          </FormField>
          <FormField label="Category">
            <input style={inputStyle} value={form.category} onChange={e => set('category', e.target.value)} placeholder="e.g. Engineering" />
          </FormField>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn onClick={handleSave} disabled={saving}>{saving ? 'Creating...' : '+ Create task'}</Btn>
      </div>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════
// PROJECT DETAIL MODAL
// ════════════════════════════════════════════════════════════════
function ProjectDetailModal({ project, onClose, onViewBoard }: { project: any; onClose: () => void; onViewBoard: () => void }) {
  const [tab, setTab] = useState<'overview' | 'tasks' | 'resources'>('overview');
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [commentText, setCommentText]   = useState('');
  const [commentSaving, setCommentSaving] = useState(false);
  const [comments, setComments]         = useState<any[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);

  const loadComments = async (taskId: string) => {
    setCommentsLoading(true);
    try {
      const tok = localStorage.getItem('xs_token') ?? '';
      const res = await fetch(`/api/pmo/tasks/${taskId}/comments`, { headers: { Authorization: `Bearer ${tok}` } });
      const json: any = await res.json();
      setComments(json.data ?? []);
    } finally { setCommentsLoading(false); }
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !selectedTask) return;
    setCommentSaving(true);
    try {
      const tok = localStorage.getItem('xs_token') ?? '';
      await fetch(`/api/pmo/tasks/${selectedTask.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ comment: commentText.trim() }),
      });
      setCommentText('');
      await loadComments(selectedTask.id);
    } finally { setCommentSaving(false); }
  };
  const { data: detail } = useProject(project.id);
  const { data: allocData } = useProjectAllocations(project.id);
  const removeAllocation = useRemoveAllocation();
  const addAllocation    = useAddAllocation();
  const qc = useQueryClient();

  const [addingResource, setAddingResource] = useState(false);
  const [selectedResources, setSelectedResources] = useState<Set<string>>(new Set());

  const allocations: any[] = allocData ?? [];
  const tasks: any[]       = (detail as any)?.tasks ?? [];
  const tc                 = TYPE_CONFIG[project.project_type ?? 'general'] ?? TYPE_CONFIG.general;
  const color              = project.colour ?? tc.colour;

  const handleAddResources = async () => {
    for (const empId of selectedResources) {
      await addAllocation.mutateAsync({ projectId: project.id, employeeId: empId, allocation: 50 } as any);
    }
    qc.invalidateQueries({ queryKey: ['pmo', 'allocations', project.id] });
    setAddingResource(false);
    setSelectedResources(new Set());
  };

  return (
    <Modal title={project.name} onClose={onClose} wide>
      {/* Header strip */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 0 16px', borderBottom: `1px solid ${C.border}`, marginBottom: 16 }}>
        <span style={{ fontSize: 20 }}>{tc.icon}</span>
        <span style={{ fontSize: 12, color: color, fontWeight: 700 }}>{tc.label}</span>
        {project.client_company_name && <span style={{ fontSize: 12, color: C.muted }}>· 🏢 {project.client_company_name}</span>}
        <div style={{ flex: 1 }} />
        <StatusBadge status={project.status} />
        <StatusBadge status={project.priority} />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {(['overview','tasks','resources'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: tab === t ? C.primary : C.elevated, color: tab === t ? '#fff' : C.muted,
            border: `1px solid ${tab === t ? C.primary : C.border}`, borderRadius: 8,
            padding: '5px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize',
          }}>{t} {t === 'tasks' ? `(${tasks.length})` : t === 'resources' ? `(${allocations.length})` : ''}</button>
        ))}
        <div style={{ flex: 1 }} />
        <Btn small onClick={onViewBoard}>📋 Board view →</Btn>
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div>
          {project.description && (
            <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, marginBottom: 16 }}>{project.description}</p>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {project.start_date && <InfoPair label="Start" value={fmtDate(project.start_date)} />}
            {project.end_date   && <InfoPair label="End"   value={fmtDate(project.end_date)} />}
            {project.budget > 0 && <InfoPair label="Budget" value={`£${Number(project.budget).toLocaleString()}`} />}
            <InfoPair label="Tasks" value={`${project.open_task_count ?? 0} open / ${project.task_count ?? 0} total`} />
            <InfoPair label="Completion" value={`${project.completion_pct ?? 0}%`} />
            <InfoPair label="Team" value={`${project.team_size ?? 0} members`} />
          </div>
          <ProgressBar value={project.completion_pct ?? 0} color={color} style={{ marginTop: 16 }} />
        </div>
      )}

      {/* Tasks */}
      {tab === 'tasks' && (
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {tasks.length === 0 && <div style={{ color: C.dim, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No tasks yet.</div>}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['Task', 'Assignee', 'Phase', 'Status', 'Due', 'Hrs'].map(h => (
                  <th key={h} style={{ padding: '6px 8px', textAlign: 'left', color: C.dim, fontWeight: 700, fontSize: 11, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tasks.map((t: any) => (
                <tr key={t.id} onClick={() => { setSelectedTask(t); loadComments(t.id); }} style={{ borderBottom: `1px solid ${C.border}11`, cursor: 'pointer' }} onMouseEnter={e => (e.currentTarget.style.background = C.elevated)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '8px 8px', color: C.text, fontWeight: 500 }}>{t.name}</td>
                  <td style={{ padding: '8px 8px', color: C.muted }}>{t.assignee_name ?? '—'}</td>
                  <td style={{ padding: '8px 8px', color: C.dim }}>{t.phase ?? '—'}</td>
                  <td style={{ padding: '8px 8px' }}><StatusBadge status={t.status} /></td>
                  <td style={{ padding: '8px 8px', color: C.dim }}>{t.due_date ? fmtDate(t.due_date) : '—'}</td>
                  <td style={{ padding: '8px 8px', color: C.muted }}>{t.estimated_hours}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Task detail drawer */}
      {selectedTask && (
        <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 380, background: C.card, border: `1px solid ${C.border}`, boxShadow: '-8px 0 32px #0006', zIndex: 2000, display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, marginRight: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: C.text, marginBottom: 4 }}>{selectedTask.name}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <StatusBadge status={selectedTask.status} />
                <StatusBadge status={selectedTask.priority} />
                {selectedTask.phase && <span style={{ fontSize: 10, color: C.dim, padding: '2px 6px', background: C.elevated, borderRadius: 4 }}>{selectedTask.phase}</span>}
              </div>
            </div>
            <button type="button" onClick={() => setSelectedTask(null)} style={{ background: 'none', border: 'none', color: C.dim, cursor: 'pointer', fontSize: 18 }}>✕</button>
          </div>

          {/* Details */}
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'Assignee', value: selectedTask.assignee_name ?? '—' },
                { label: 'Due',      value: selectedTask.due_date ? fmtDate(selectedTask.due_date) : '—' },
                { label: 'Est.',     value: `${selectedTask.estimated_hours ?? 0}h` },
                { label: 'Category', value: selectedTask.task_category ?? '—' },
              ].map(f => (
                <div key={f.label}>
                  <div style={{ fontSize: 10, color: C.dim, fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>{f.label}</div>
                  <div style={{ color: C.text }}>{f.value}</div>
                </div>
              ))}
            </div>
            {selectedTask.description && (
              <div style={{ marginTop: 10, fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{selectedTask.description}</div>
            )}
          </div>

          {/* Comments */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.dim, textTransform: 'uppercase', marginBottom: 12 }}>
              Comments ({comments.length})
            </div>
            {commentsLoading && <div style={{ color: C.dim, fontSize: 12 }}>Loading...</div>}
            {comments.map((cm: any) => (
              <div key={cm.id} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                  <Avatar name={cm.user_name} size={22} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.text }}>{cm.user_name}</span>
                  <span style={{ fontSize: 10, color: C.dim }}>{fmtDate(cm.created_at)}</span>
                </div>
                <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, paddingLeft: 30 }}>{cm.comment}</div>
              </div>
            ))}
            {comments.length === 0 && !commentsLoading && (
              <div style={{ color: C.dim, fontSize: 12, textAlign: 'center', padding: '20px 0' }}>No comments yet — be the first</div>
            )}
          </div>

          {/* Add comment */}
          <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.border}` }}>
            <textarea value={commentText} onChange={e => setCommentText(e.target.value)}
              placeholder="Add a comment..."
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddComment(); }}
              style={{ width: '100%', minHeight: 64, background: C.elevated, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', color: C.text, fontSize: 13, resize: 'none', outline: 'none', marginBottom: 8 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: C.dim }}>Ctrl+Enter to send</span>
              <button type="button" onClick={handleAddComment} disabled={!commentText.trim() || commentSaving}
                style={{ background: C.primary, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: !commentText.trim() ? 0.5 : 1 }}>
                {commentSaving ? '...' : 'Comment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resources */}
      {tab === 'resources' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <PermissionGate permission={PERMISSIONS.PMO_EDIT}>
              <Btn small onClick={() => setAddingResource(true)}>+ Add resource</Btn>
            </PermissionGate>
          </div>
          {allocations.length === 0 && !addingResource && (
            <div style={{ color: C.dim, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No resources allocated yet.</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {allocations.map((a: any) => (
              <div key={a.employee_id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', background: C.elevated, borderRadius: 10 }}>
                <Avatar name={a.employee_name} size={36} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{a.employee_name}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{a.role ?? a.department ?? ''}</div>
                  <div style={{ fontSize: 11, color: C.dim }}>{a.hours_per_week ?? 17.5}h/wk · {a.allocation ?? 50}%</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: utilisationColor(a.total_utilisation_pct ?? 0), fontWeight: 700 }}>
                    {a.total_utilisation_pct ?? 0}% total booked
                  </div>
                  <PermissionGate permission={PERMISSIONS.PMO_EDIT}>
                    <button onClick={() => removeAllocation.mutate({ projectId: project.id, employeeId: a.employee_id } as any)}
                      style={{ background: 'none', border: 'none', color: C.danger, cursor: 'pointer', fontSize: 11, marginTop: 2 }}>
                      Remove
                    </button>
                  </PermissionGate>
                </div>
              </div>
            ))}
          </div>

          {addingResource && (
            <div style={{ marginTop: 16, padding: 14, background: C.card, borderRadius: 10, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 10 }}>Select resources to add:</div>
              <ResourcePanel selectedIds={selectedResources} onToggle={(id) => {
                setSelectedResources(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
              }} />
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <Btn small variant="secondary" onClick={() => { setAddingResource(false); setSelectedResources(new Set()); }}>Cancel</Btn>
                <Btn small onClick={handleAddResources} disabled={selectedResources.size === 0 || addAllocation.isPending}>
                  {addAllocation.isPending ? 'Adding...' : `Add ${selectedResources.size}`}
                </Btn>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function InfoPair({ label, value }: { label: string; value: any }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontSize: 12, color: C.dim }}>{label}</span>
      <span style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// MAIN PMO MODULE
// ════════════════════════════════════════════════════════════════
export default function PMOModule() {
  const [view, setView]                   = useState<'projects' | 'board'>('projects');
  const [clientFilter, setClientFilter]   = useState('');
  const [typeFilter, setTypeFilter]       = useState('');
  const [statusFilter, setStatusFilter]   = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [selected, setSelected]           = useState<any | null>(null);
  const [showAddProject, setShowAddProject] = useState(false);
  const [showAddTask, setShowAddTask]       = useState(false);
  const [editingProject, setEditingProject] = useState<any | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const deleteProject = useDeleteProject();

  const { data: projectsData, isLoading: pLoading } = useProjects({
    clientId: clientFilter || undefined,
    status:   statusFilter || undefined,
    type:     typeFilter   || undefined,
  });
  const { data: tasksData, isLoading: tLoading } = useTasks(
    projectFilter ? { projectId: projectFilter, clientId: clientFilter || undefined }
                  : { clientId: clientFilter || undefined }
  );
  const { data: clientsData } = useClients({});

  const allProjects: any[] = (projectsData as any) ?? [];
  const allTasks: any[]    = (tasksData    as any) ?? [];
  const clients: any[]     = (clientsData  as any)?.clients ?? [];

  const active      = allProjects.filter((p: any) => p.status === 'active');
  const totalBudget = allProjects.reduce((s: number, p: any) => s + (p.budget ?? 0), 0);
  const openTasks   = allTasks.filter((t: any) => t.status !== 'done').length;

  async function handleDeleteProject(id: string, name: string) {
    setDeleteError('');
    if (!window.confirm(`Permanently delete "${name}"? This cannot be undone.`)) return;
    try {
      await deleteProject.mutateAsync(id);
    } catch (e: any) {
      // The worker returns a 409 with a specific message listing exactly
      // what's still linked (e.g. "5 tasks, 12 timesheet entries") when a
      // project can't be safely deleted — surface that verbatim rather
      // than a generic failure message, since it tells the user exactly
      // what to do next (clean up the data, or cancel the project instead).
      setDeleteError(e.message ?? `Failed to delete "${name}"`);
    }
  }

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ color: C.text, fontSize: 20, fontWeight: 800, margin: 0 }}>Projects & Tasks</h2>
          <p style={{ color: C.muted, fontSize: 12, margin: '4px 0 0' }}>
            {active.length} active · {allProjects.length} total
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <PermissionGate permission={PERMISSIONS.TASK_CREATE}>
            <Btn variant="secondary" onClick={() => setShowAddTask(true)}>+ Task</Btn>
          </PermissionGate>
          <PermissionGate permission={PERMISSIONS.PMO_CREATE}>
            <Btn onClick={() => setShowAddProject(true)}>+ Project</Btn>
          </PermissionGate>
        </div>
      </div>

      {/* Metrics */}
      <MetricGrid>
        <MetricCard label="Active projects" value={active.length} icon="📂" color={`linear-gradient(135deg,${C.primary},#8B5CF6)`} />
        <MetricCard label="Total budget"    value={totalBudget > 0 ? `£${(totalBudget/1000).toFixed(0)}k` : '—'} icon="💷" color={`linear-gradient(135deg,#0EA5E9,${C.primary})`} />
        <MetricCard label="Open tasks"      value={openTasks} icon="✅" color={`linear-gradient(135deg,#10B981,#0EA5E9)`} />
        <MetricCard label="Clients"         value={[...new Set(allProjects.map((p: any) => p.client_id).filter(Boolean))].length || '—'} icon="🏢" color={`linear-gradient(135deg,${C.amber},#EF4444)`} />
      </MetricGrid>

      {/* View toggle */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
        {[{ k: 'projects', l: '📂 Projects' }, { k: 'board', l: '📋 Task Board' }].map(t => (
          <button key={t.k} onClick={() => setView(t.k as any)} style={{
            background: view === t.k ? C.primary : C.elevated, color: view === t.k ? '#fff' : C.muted,
            border: `1px solid ${view === t.k ? C.primary : C.border}`, borderRadius: 8,
            padding: '6px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>{t.l}</button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <select style={{ ...selectStyle, width: 'auto' }} value={clientFilter} onChange={e => setClientFilter(e.target.value)}>
          <option value="">All clients</option>
          {clients.map((c: any) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
        </select>
        <select style={{ ...selectStyle, width: 'auto' }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">All types</option>
          {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
        </select>
        <select style={{ ...selectStyle, width: 'auto' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="planning">Planning</option>
          <option value="active">Active</option>
          <option value="on_hold">On Hold</option>
          <option value="completed">Completed</option>
        </select>
        {view === 'board' && (
          <select style={{ ...selectStyle, width: 'auto' }} value={projectFilter} onChange={e => setProjectFilter(e.target.value)}>
            <option value="">All projects</option>
            {allProjects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>

      {/* PROJECTS GRID */}
      {deleteError && (
        <div style={{ marginBottom: 16 }}>
          <Alert type="error" message={deleteError} />
        </div>
      )}
      {view === 'projects' && (
        pLoading ? <Loading /> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {allProjects.map((p: any) => (
              <ProjectCard key={p.id} project={p} onClick={() => setSelected(p)} onDelete={handleDeleteProject} />
            ))}
            {allProjects.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 0', color: C.dim }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📂</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: C.text, marginBottom: 6 }}>No projects found</div>
                <div style={{ fontSize: 13, marginBottom: 20 }}>Create your first project or adjust the filters above.</div>
                <PermissionGate permission={PERMISSIONS.PMO_CREATE}>
                  <Btn onClick={() => setShowAddProject(true)}>+ New project</Btn>
                </PermissionGate>
              </div>
            )}
            <PermissionGate permission={PERMISSIONS.PMO_CREATE}>
              <div onClick={() => setShowAddProject(true)} style={{
                border: `2px dashed ${C.border}`, borderRadius: 16, padding: 20, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                color: C.muted, fontSize: 13, fontWeight: 600, minHeight: 140,
              }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = C.primary)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
              >
                <span style={{ fontSize: 20 }}>+</span> New project
              </div>
            </PermissionGate>
          </div>
        )
      )}

      {/* KANBAN BOARD */}
      {view === 'board' && (
        tLoading ? <Loading /> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, overflowX: 'auto' }}>
            {KANBAN_COLS.map(col => {
              const colTasks = allTasks.filter((t: any) => t.status === col);
              return (
                <div key={col}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: COL_COLORS[col], textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {COL_LABELS[col]}
                    </span>
                    <span style={{ background: COL_COLORS[col] + '22', color: COL_COLORS[col], borderRadius: 4, fontSize: 10, padding: '2px 6px', fontWeight: 700 }}>
                      {colTasks.length}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {colTasks.map((task: any) => (
                      <div key={task.id} style={{
                        background: C.card, border: `1px solid ${C.border}`,
                        borderLeft: `3px solid ${task.project_colour ?? C.primary}`,
                        borderRadius: 10, padding: 12, cursor: 'pointer',
                      }}>
                        {task.client_name && (
                          <div style={{ fontSize: 10, color: C.dim, marginBottom: 4 }}>🏢 {task.client_name}</div>
                        )}
                        {task.project_name && (
                          <div style={{ fontSize: 10, color: task.project_colour ?? C.primary, fontWeight: 700, marginBottom: 4 }}>{task.project_name}</div>
                        )}
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 6, lineHeight: 1.4 }}>{task.name}</div>
                        {task.phase && <div style={{ fontSize: 10, color: C.dim, marginBottom: 4 }}>{task.phase}</div>}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          {task.assignee_name ? <Avatar name={task.assignee_name} size={22} /> : <span style={{ fontSize: 10, color: C.dim }}>Unassigned</span>}
                          <StatusBadge status={task.priority} />
                        </div>
                        {task.estimated_hours && <div style={{ fontSize: 10, color: C.dim, marginTop: 6 }}>{task.estimated_hours}h est.</div>}
                        {task.due_date && <div style={{ fontSize: 10, color: C.amber, marginTop: 2 }}>📅 {fmtDate(task.due_date)}</div>}
                      </div>
                    ))}
                    {colTasks.length === 0 && (
                      <div style={{ border: `1.5px dashed ${C.border}`, borderRadius: 10, padding: '20px 12px', textAlign: 'center', color: C.dim, fontSize: 11 }}>
                        Empty
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Modals */}
      {showAddProject && <ProjectFormModal onClose={() => setShowAddProject(false)} />}
      {editingProject  && <ProjectFormModal project={editingProject} onClose={() => setEditingProject(null)} />}
      {showAddTask     && <AddTaskModal onClose={() => setShowAddTask(false)} projects={allProjects} />}
      {selected && (
        <ProjectDetailModal
          project={selected}
          onClose={() => setSelected(null)}
          onViewBoard={() => {
            setProjectFilter(selected.id);
            setView('board');
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}

import { useState } from 'react';
import {
  useWorkflowDefinitions, useWorkflowSteps, usePendingApprovals,
  useWorkflowInstances, useWorkflowInstance,
  useTakeWorkflowAction, useToggleWorkflow,
  type WorkflowDefinition, type WorkflowInstance,
} from '../../hooks/api';
import {
  Card, DataTable, Modal, InfoRow, MetricCard, MetricGrid,
  StatusBadge, Avatar, Loading, Alert, FormField, inputStyle,
  C, fmtDate,
} from '../../components/ui';
import { useQueryClient } from '@tanstack/react-query';

// ── Helpers ───────────────────────────────────────────────────────────────────
const MODULE_ICONS: Record<string, string> = {
  leave: '🌴', timesheets: '⏱', expenses: '💳',
  recruitment: '💼', assets: '💻', onboarding: '🎯',
};

const STATUS_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  in_progress: { bg: C.warning + '22', color: C.warning, label: 'In Progress' },
  approved:    { bg: C.success + '22', color: C.success, label: 'Approved' },
  rejected:    { bg: C.danger  + '22', color: C.danger,  label: 'Rejected' },
  pending:     { bg: C.sky    + '22', color: C.sky,    label: 'Pending' },
  escalated:   { bg: C.danger  + '33', color: C.danger,  label: 'Escalated ⚠️' },
  withdrawn:   { bg: C.dim     + '22', color: C.dim,     label: 'Withdrawn' },
};

function WorkflowBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { bg: C.dim + '22', color: C.dim, label: status };
  return (
    <span style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}33`, borderRadius: 6, fontSize: 10, fontWeight: 700, padding: '2px 8px', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
      {cfg.label}
    </span>
  );
}

function SLAIndicator({ deadline }: { deadline?: string }) {
  if (!deadline) return null;
  const hoursLeft = Math.round((new Date(deadline).getTime() - Date.now()) / 3600000);
  const color = hoursLeft < 0 ? C.danger : hoursLeft < 4 ? C.warning : C.success;
  return (
    <span style={{ fontSize: 10, color, fontWeight: 700 }}>
      {hoursLeft < 0 ? `⚠️ ${Math.abs(hoursLeft)}h overdue` : `⏰ ${hoursLeft}h left`}
    </span>
  );
}

// ── Instance Detail Modal ─────────────────────────────────────────────────────
function InstanceModal({ instance, onClose }: { instance: WorkflowInstance; onClose: () => void }) {
  const { data, isLoading } = useWorkflowInstance(instance.id);
  const takeAction = useTakeWorkflowAction(instance.id);
  const qc = useQueryClient();
  const [comment, setComment] = useState('');
  const [acting, setActing] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleAction = async (action: 'approved' | 'rejected' | 'withdrawn') => {
    setActing(true);
    try {
      await takeAction.mutateAsync({ action, comment: comment || undefined });
      qc.invalidateQueries({ queryKey: ['workflow'] });
      setResult(action);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActing(false);
    }
  };

  const canAct = instance.status === 'in_progress' || instance.status === 'pending' || instance.status === 'escalated';

  return (
    <Modal title={`${instance.workflow_name}`} onClose={onClose} wide>
      {isLoading ? <Loading /> : (
        <>
          {/* Status banner */}
          <div style={{ background: (STATUS_CONFIG[instance.status]?.bg ?? C.dim + '22'), borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <WorkflowBadge status={instance.status} />
              {instance.current_step_name && instance.status === 'in_progress' && (
                <span style={{ fontSize: 12, color: C.muted, marginLeft: 10 }}>
                  Current step: <strong style={{ color: C.text }}>{instance.current_step_name}</strong>
                </span>
              )}
            </div>
            <SLAIndicator deadline={instance.sla_deadline} />
          </div>

          {/* Info */}
          <InfoRow label="Record Type"  value={instance.record_type?.replace(/_/g, ' ')} />
          <InfoRow label="Submitted By" value={instance.submitted_by_email} />
          <InfoRow label="Submitted"    value={fmtDate(instance.submitted_at)} />
          {instance.decided_at && <InfoRow label="Decided"   value={fmtDate(instance.decided_at)} />}
          {instance.outcome_comment && <InfoRow label="Comment" value={instance.outcome_comment} />}

          {/* Step progress */}
          {data?.steps && data.steps.length > 0 && (
            <div style={{ margin: '20px 0' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Steps</div>
              {data.steps.map((step, i) => (
                <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800,
                    background: step.step_status === 'completed' ? C.success : step.step_status === 'active' ? C.primary : C.elevated,
                    color: step.step_status === 'completed' || step.step_status === 'active' ? '#fff' : C.dim,
                    border: `2px solid ${step.step_status === 'completed' ? C.success : step.step_status === 'active' ? C.primary : C.border}`,
                  }}>
                    {step.step_status === 'completed' ? '✓' : step.step_order}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: step.step_status === 'active' ? 700 : 500, color: step.step_status === 'pending' ? C.dim : C.text }}>
                      {step.name}
                    </div>
                    <div style={{ fontSize: 11, color: C.dim }}>
                      {step.approver_role ?? step.approver_type}{step.sla_hours ? ` · SLA: ${step.sla_hours}h` : ''}
                    </div>
                  </div>
                  <span style={{ fontSize: 10, color: step.step_status === 'completed' ? C.success : step.step_status === 'active' ? C.warning : C.dim, fontWeight: 700, textTransform: 'uppercase' }}>
                    {step.step_status}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Action history */}
          {data?.actions && data.actions.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>History</div>
              {data.actions.map(a => (
                <div key={a.id} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: `1px solid ${C.border}33` }}>
                  <Avatar name={a.actor_email} size={24} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12 }}>
                      <span style={{ fontWeight: 600 }}>{a.actor_email.split('@')[0]}</span>
                      {' '}<span style={{ color: a.action === 'approved' ? C.success : a.action === 'rejected' ? C.danger : C.muted, fontWeight: 700 }}>{a.action}</span>
                      {a.step_name && <span style={{ color: C.dim }}> on {a.step_name}</span>}
                    </div>
                    {a.comment && <div style={{ fontSize: 11, color: C.muted, fontStyle: 'italic', marginTop: 2 }}>{a.comment}</div>}
                  </div>
                  <span style={{ fontSize: 11, color: C.dim, flexShrink: 0 }}>{fmtDate(a.created_at)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Action buttons */}
          {canAct && !result && (
            <div>
              <FormField label="Comment (optional)">
                <input style={inputStyle} value={comment} onChange={e => setComment(e.target.value)} placeholder="Add a comment..." />
              </FormField>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button onClick={() => handleAction('approved')} disabled={acting} style={{ background: C.success, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: acting ? 'wait' : 'pointer' }}>
                  ✓ Approve
                </button>
                <button onClick={() => handleAction('rejected')} disabled={acting} style={{ background: C.danger + '22', color: C.danger, border: `1px solid ${C.danger}44`, borderRadius: 8, padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: acting ? 'wait' : 'pointer' }}>
                  ✗ Reject
                </button>
                <button onClick={() => handleAction('withdrawn')} disabled={acting} style={{ background: 'transparent', color: C.dim, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: acting ? 'wait' : 'pointer' }}>
                  Withdraw
                </button>
              </div>
            </div>
          )}

          {result && (
            <Alert type={result === 'approved' ? 'success' : 'warning'} message={`Workflow ${result} successfully`} />
          )}
        </>
      )}
    </Modal>
  );
}

// ── Definition Card ───────────────────────────────────────────────────────────
function DefinitionCard({ def }: { def: WorkflowDefinition }) {
  const [showSteps, setShowSteps] = useState(false);
  const { data: steps } = useWorkflowSteps(showSteps ? def.id : '');
  const toggle = useToggleWorkflow(def.id);
  const qc = useQueryClient();

  const handleToggle = async () => {
    await toggle.mutateAsync({ enabled: !def.enabled });
    qc.invalidateQueries({ queryKey: ['workflow', 'definitions'] });
  };

  return (
    <Card style={{ borderLeft: `4px solid ${def.enabled ? C.primary : C.dim}`, opacity: def.enabled ? 1 : 0.7 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 16 }}>{MODULE_ICONS[def.module] ?? '🔀'}</span>
            <span style={{ fontWeight: 800, color: C.text, fontSize: 14 }}>{def.name}</span>
            <span style={{ background: C.primary + '22', color: C.primary, border: `1px solid ${C.primary}33`, borderRadius: 6, fontSize: 9, fontWeight: 700, padding: '2px 7px', textTransform: 'uppercase' }}>{def.module}</span>
          </div>
          {def.description && <div style={{ fontSize: 12, color: C.muted }}>{def.description}</div>}
        </div>
        <button onClick={handleToggle} style={{ background: def.enabled ? C.success + '22' : C.dim + '22', color: def.enabled ? C.success : C.dim, border: `1px solid ${def.enabled ? C.success + '44' : C.dim + '33'}`, borderRadius: 8, padding: '4px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
          {def.enabled ? '● Enabled' : '○ Disabled'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 20, fontSize: 12, color: C.muted, marginBottom: 12 }}>
        <span>📋 <strong style={{ color: C.text }}>{def.step_count}</strong> steps</span>
        <span>🔄 <strong style={{ color: C.text }}>{def.active_count}</strong> active</span>
      </div>

      <button onClick={() => setShowSteps(!showSteps)} style={{ background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 6, padding: '4px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
        {showSteps ? '▲ Hide Steps' : '▼ View Steps'}
      </button>

      {showSteps && steps && (
        <div style={{ marginTop: 14, borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
          {steps.map((step, i) => (
            <div key={step.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${C.border}33` }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: C.primary + '22', color: C.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                {step.step_order}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{step.name}</div>
                <div style={{ fontSize: 11, color: C.dim }}>
                  {step.approver_type} · {step.approver_role ?? '—'}
                  {step.sla_hours ? ` · SLA: ${step.sla_hours}h` : ''}
                  {step.condition ? ` · Conditional` : ''}
                </div>
              </div>
              <span style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', fontWeight: 700 }}>{step.step_type}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ── Main Workflow Module ──────────────────────────────────────────────────────
export default function WorkflowModule() {
  const [tab, setTab] = useState<'pending' | 'definitions' | 'instances'>('pending');
  const [selected, setSelected] = useState<WorkflowInstance | null>(null);
  const [moduleFilter, setModuleFilter] = useState('');

  const { data: pending,     isLoading: pLoading } = usePendingApprovals();
  const { data: definitions, isLoading: dLoading } = useWorkflowDefinitions();
  const { data: instances,   isLoading: iLoading } = useWorkflowInstances(
    moduleFilter ? { module: moduleFilter } : undefined
  );

  const allPending = pending ?? [];
  const allDefs    = definitions ?? [];
  const allInst    = instances ?? [];

  const escalated = allPending.filter(i => i.status === 'escalated');

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ color: C.text, fontSize: 20, fontWeight: 800, margin: 0 }}>Workflow Engine</h2>
          <p style={{ color: C.muted, fontSize: 12, margin: '4px 0 0' }}>Configurable approval workflows with SLA tracking</p>
        </div>
      </div>

      {/* Metrics */}
      <MetricGrid>
        <MetricCard label="Pending Approval" value={allPending.length}                    icon="⏳" color={`linear-gradient(135deg,${C.warning},${C.danger})`} />
        <MetricCard label="Escalated"         value={escalated.length}                    icon="🚨" color={`linear-gradient(135deg,${C.danger},#7F1D1D)`} />
        <MetricCard label="Active Workflows"  value={allDefs.reduce((a,d) => a + d.active_count, 0)} icon="🔀" color={`linear-gradient(135deg,${C.primary},#8B5CF6)`} />
        <MetricCard label="Definitions"       value={allDefs.filter(d => d.enabled).length} icon="📋" color={`linear-gradient(135deg,${C.secondary},${C.sky})`} />
      </MetricGrid>

      {escalated.length > 0 && (
        <Alert type="error" message={`${escalated.length} workflow${escalated.length > 1 ? 's' : ''} escalated — SLA breached. Immediate action required.`} />
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {[
          { key: 'pending',     label: `⏳ Pending (${allPending.length})` },
          { key: 'definitions', label: `📋 Definitions (${allDefs.length})` },
          { key: 'instances',   label: `🔀 All Instances` },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)} style={{ background: tab === t.key ? C.primary : C.elevated, color: tab === t.key ? '#fff' : C.muted, border: `1px solid ${tab === t.key ? C.primary : C.border}`, borderRadius: 8, padding: '7px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Pending Approvals ── */}
      {tab === 'pending' && (
        pLoading ? <Loading /> : (
          <>
            {allPending.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: C.dim }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <div>No pending approvals — all clear</div>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {allPending.map(inst => (
                <Card key={inst.id} onClick={() => setSelected(inst)} style={{ cursor: 'pointer', borderLeft: `4px solid ${inst.status === 'escalated' ? C.danger : C.warning}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 16 }}>{MODULE_ICONS[inst.module] ?? '🔀'}</span>
                        <span style={{ fontWeight: 700, color: C.text, fontSize: 14 }}>{inst.workflow_name}</span>
                        <WorkflowBadge status={inst.status} />
                      </div>
                      <div style={{ fontSize: 12, color: C.muted }}>
                        <span style={{ color: C.text }}>{inst.record_type?.replace(/_/g, ' ')}</span>
                        {' · '}Submitted by <span style={{ color: C.text }}>{inst.submitted_by_email?.split('@')[0]}</span>
                        {' · '}{fmtDate(inst.submitted_at)}
                      </div>
                      {inst.current_step_name && (
                        <div style={{ fontSize: 11, color: C.primary, marginTop: 4, fontWeight: 600 }}>
                          Step {inst.current_step}: {inst.current_step_name}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                      <SLAIndicator deadline={inst.sla_deadline} />
                      <div style={{ marginTop: 8 }}>
                        <button style={{ background: C.success, color: '#fff', border: 'none', borderRadius: 6, padding: '5px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }} onClick={e => { e.stopPropagation(); setSelected(inst); }}>
                          Review →
                        </button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )
      )}

      {/* ── Definitions ── */}
      {tab === 'definitions' && (
        dLoading ? <Loading /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {allDefs.map(def => <DefinitionCard def={def} />)}
          </div>
        )
      )}

      {/* ── All Instances ── */}
      {tab === 'instances' && (
        <>
          <div style={{ marginBottom: 14, display: 'flex', gap: 8 }}>
            {['', 'leave', 'timesheets', 'expenses', 'recruitment', 'assets'].map(m => (
              <button key={m} onClick={() => setModuleFilter(m)} style={{ background: moduleFilter === m ? C.primary : C.elevated, color: moduleFilter === m ? '#fff' : C.muted, border: `1px solid ${moduleFilter === m ? C.primary : C.border}`, borderRadius: 8, padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                {m ? `${MODULE_ICONS[m] ?? ''} ${m}` : 'All'}
              </button>
            ))}
          </div>
          {iLoading ? <Loading /> : (
            <Card>
              <DataTable
                cols={[
                  { key: 'workflow_name',       label: 'Workflow',   render: (v: any, r: any) => <div style={{ display:'flex', alignItems:'center', gap:6 }}><span>{MODULE_ICONS[(r as any).module] ?? '🔀'}</span><span style={{fontWeight:600}}>{v}</span></div> },
                  { key: 'record_type',         label: 'Type',       render: v => v?.replace(/_/g,' '), muted: true },
                  { key: 'submitted_by_email',  label: 'Submitted By', render: v => <div style={{display:'flex',alignItems:'center',gap:6}}><Avatar name={v} size={22}/>{v?.split('@')[0]}</div> },
                  { key: 'status',              label: 'Status',     render: v => <WorkflowBadge status={v} /> },
                  { key: 'current_step_name',   label: 'Current Step', muted: true },
                  { key: 'sla_deadline',        label: 'SLA',        render: v => <SLAIndicator deadline={v} /> },
                  { key: 'submitted_at',        label: 'Submitted',  render: v => fmtDate(v), muted: true },
                ]}
                rows={allInst}
                onRow={setSelected}
                emptyText="No workflow instances found"
              />
            </Card>
          )}
        </>
      )}

      {selected && <InstanceModal instance={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

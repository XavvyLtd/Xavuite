/**
 * GDPR.tsx — Data Protection & Privacy module
 * Tabs: Overview · Subject Requests · Data Breaches · Configuration · Privacy Notice
 */

import { useState } from 'react';
import { useEmployees } from '../../hooks/api';
import { useApi, useApiMutation } from '../../platform/auth/apiClient';;
import {
  Card, Modal, SectionHeader, StatusBadge, Loading, Alert,
  FormField, inputStyle, selectStyle, C, fmtDate, Btn,
} from '../../components/ui';
import { useQueryClient } from '@tanstack/react-query';
import { CookieSettingsPanel } from '../../CookieBanner';
import { usePermission } from '../../platform/permissions/index';

const API_URL = import.meta.env.VITE_API_URL ?? 'https://api-v2.xavvy.uk';

// ── Hooks ─────────────────────────────────────────────────────
const useGdprConfig    = () => useApi<any>(['gdpr','config'],    '/api/gdpr/config');
const useGdprRequests  = () => useApi<any[]>(['gdpr','requests'],'/api/gdpr/requests');
const useGdprBreaches  = () => useApi<any[]>(['gdpr','breaches'],'/api/gdpr/breaches');

// ── DSAR types ────────────────────────────────────────────────
const REQUEST_TYPES: Record<string, { label: string; icon: string; desc: string }> = {
  access:        { label: 'Subject Access',    icon: '📋', desc: 'Request a copy of all personal data held' },
  rectification: { label: 'Rectification',     icon: '✏️', desc: 'Correct inaccurate or incomplete data' },
  erasure:       { label: 'Erasure',           icon: '🗑️', desc: 'Right to be forgotten — delete personal data' },
  restriction:   { label: 'Restrict Processing',icon: '⏸️', desc: 'Limit how data is processed' },
  portability:   { label: 'Data Portability',  icon: '📦', desc: 'Export data in machine-readable format' },
  objection:     { label: 'Object to Processing',icon:'✋',desc: 'Object to processing based on legitimate interest' },
};

const STATUS_COLORS: Record<string, string> = {
  pending: C.warning, in_progress: C.primary, completed: C.success,
  rejected: C.danger, withdrawn: C.muted,
};

// ── Overview tab ──────────────────────────────────────────────
function OverviewTab({ config }: { config: any }) {
  const { data: requests } = useGdprRequests();
  const { data: breaches  } = useGdprBreaches();
  const reqs = (requests as any[]) ?? [];
  const brs  = (breaches  as any[]) ?? [];
  const pending   = reqs.filter(r => r.status === 'pending').length;
  const overdue   = reqs.filter(r => r.due_date < new Date().toISOString().split('T')[0] && r.status !== 'completed').length;
  const openBreach= brs.filter(b => b.status !== 'resolved').length;

  return (
    <div>
      {/* Status cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Pending DSARs',    value: pending,   color: pending > 0   ? C.warning : C.success, icon: '📋' },
          { label: 'Overdue DSARs',    value: overdue,   color: overdue > 0   ? C.danger  : C.success, icon: '⚠️' },
          { label: 'Open Breaches',    value: openBreach,color: openBreach > 0 ? C.danger : C.success, icon: '🚨' },
          { label: 'DPO Assigned',     value: config?.dpo_email ? '✓' : '✗', color: config?.dpo_email ? C.success : C.warning, icon: '👤' },
        ].map(s => (
          <Card key={s.label}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{s.label}</div>
          </Card>
        ))}
      </div>

      {/* DPO info */}
      <Card style={{ marginBottom: 16 }}>
        <SectionHeader title="Data Protection Officer" />
        {config?.dpo_name ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, fontSize: 13 }}>
            <div><div style={{ color: C.dim, fontSize: 11 }}>Name</div><div style={{ color: C.text, fontWeight: 700 }}>{config.dpo_name}</div></div>
            <div><div style={{ color: C.dim, fontSize: 11 }}>Email</div><div style={{ color: C.text }}>{config.dpo_email}</div></div>
            <div><div style={{ color: C.dim, fontSize: 11 }}>ICO Number</div><div style={{ color: C.text }}>{config.ico_number ?? '—'}</div></div>
          </div>
        ) : (
          <div style={{ color: C.warning, fontSize: 13 }}>⚠️ No DPO assigned — required under UK GDPR if applicable. Configure in the Configuration tab.</div>
        )}
      </Card>

      {/* Sub-processors */}
      <Card>
        <SectionHeader title="Sub-Processors" />
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
          XavvySuite acts as your data processor. The following sub-processors are used:
        </div>
        {[
          { name: 'Cloudflare',         purpose: 'Infrastructure, CDN, DDoS protection', location: 'EU/UK', dpa: 'Yes' },
          { name: 'Cloudflare D1',      purpose: 'Database storage (SQLite at edge)',      location: 'EU',    dpa: 'Yes' },
          { name: 'Cloudflare R2',      purpose: 'File and attachment storage',            location: 'EU',    dpa: 'Yes' },
          { name: 'Expo (EAS)',         purpose: 'Mobile app build and distribution',      location: 'US',    dpa: 'Yes' },
        ].map(sp => (
          <div key={sp.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.border}33`, fontSize: 13 }}>
            <div>
              <div style={{ fontWeight: 700, color: C.text }}>{sp.name}</div>
              <div style={{ color: C.dim, fontSize: 11 }}>{sp.purpose}</div>
            </div>
            <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
              <span style={{ color: C.muted }}>📍 {sp.location}</span>
              <span style={{ color: sp.dpa === 'Yes' ? C.success : C.warning }}>DPA: {sp.dpa}</span>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ── DSAR Tab ──────────────────────────────────────────────────
function DSARTab() {
  const qc = useQueryClient();
  const { data: requests, isLoading } = useGdprRequests();
  const { data: employees } = useEmployees();
  const reqs     = (requests as any[]) ?? [];
  const empList  = (employees as any)?.items ?? [];
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [form, setForm] = useState({ employee_id: '', request_type: 'access', description: '', requested_by: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    if (!form.request_type) return;
    setSaving(true); setErr('');
    try {
      const tok = localStorage.getItem('xs_token') ?? '';
      const res = await fetch(`\${API_URL}/api/gdpr/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify(form),
      });
      const json: any = await res.json();
      if (!json.ok) throw new Error(json.error);
      qc.invalidateQueries({ queryKey: ['gdpr','requests'] });
      setShowNew(false);
      setForm({ employee_id: '', request_type: 'access', description: '', requested_by: '' });
    } catch (e: any) { setErr(e.message ?? 'Failed'); }
    finally { setSaving(false); }
  };

  const handleUpdateStatus = async (reqId: string, status: string, notes?: string) => {
    const tok = localStorage.getItem('xs_token') ?? '';
    await fetch(`/api/gdpr/requests/${reqId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ status, response_notes: notes }),
    });
    qc.invalidateQueries({ queryKey: ['gdpr','requests'] });
    setSelected(null);
  };

  const handleExport = (reqId: string) => {
    const tok = localStorage.getItem('xs_token') ?? '';
    window.open(`/api/gdpr/requests/${reqId}/export`, '_blank');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: C.muted }}>
          You must respond to subject access requests within <strong style={{ color: C.text }}>30 calendar days</strong> under UK GDPR.
        </div>
        <Btn onClick={() => setShowNew(true)}>+ New Request</Btn>
      </div>

      {isLoading ? <Loading /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {reqs.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: C.dim }}>No data subject requests yet</div>
          )}
          {reqs.map((r: any) => {
            const overdue = r.due_date < new Date().toISOString().split('T')[0] && r.status !== 'completed';
            const type    = REQUEST_TYPES[r.request_type];
            return (
              <Card key={r.id} onClick={() => setSelected(r)} style={{ cursor: 'pointer', borderLeft: `4px solid ${STATUS_COLORS[r.status] ?? C.muted}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 18 }}>{type?.icon}</span>
                      <span style={{ fontWeight: 800, fontSize: 14, color: C.text }}>{type?.label ?? r.request_type}</span>
                      <StatusBadge status={r.status} />
                      {overdue && <span style={{ fontSize: 10, color: C.danger, fontWeight: 700, background: C.danger + '22', borderRadius: 4, padding: '1px 6px' }}>OVERDUE</span>}
                    </div>
                    <div style={{ fontSize: 12, color: C.muted }}>
                      {r.employee_name ?? r.requested_by ?? 'Unknown'} · Due: <span style={{ color: overdue ? C.danger : C.dim, fontWeight: overdue ? 700 : 400 }}>{fmtDate(r.due_date)}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: C.dim }}>{fmtDate(r.created_at)}</div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* New DSAR modal */}
      {showNew && (
        <Modal title="New Data Subject Request" onClose={() => setShowNew(false)} wide>
          {err && <Alert type="error" message={err} />}
          <FormField label="Request Type" required>
            <select style={selectStyle} value={form.request_type} onChange={e => set('request_type', e.target.value)}>
              {Object.entries(REQUEST_TYPES).map(([k, v]) => (
                <option key={k} value={k}>{v.icon} {v.label}</option>
              ))}
            </select>
          </FormField>
          <div style={{ fontSize: 12, color: C.muted, background: C.elevated, borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
            {REQUEST_TYPES[form.request_type]?.desc}
          </div>
          <FormField label="Employee">
            <select style={selectStyle} value={form.employee_id} onChange={e => set('employee_id', e.target.value)}>
              <option value="">External request (no employee record)</option>
              {empList.map((e: any) => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
            </select>
          </FormField>
          <FormField label="Requested By (email)">
            <input style={inputStyle} value={form.requested_by} onChange={e => set('requested_by', e.target.value)} placeholder="requester@example.com" />
          </FormField>
          <FormField label="Description">
            <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' } as any}
              value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="Details of the request..." />
          </FormField>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <Btn variant="ghost" onClick={() => setShowNew(false)}>Cancel</Btn>
            <Btn onClick={handleCreate} disabled={saving}>{saving ? 'Creating...' : 'Create Request'}</Btn>
          </div>
        </Modal>
      )}

      {/* DSAR detail modal */}
      {selected && (
        <Modal title={`${REQUEST_TYPES[selected.request_type]?.icon} ${REQUEST_TYPES[selected.request_type]?.label}`} onClose={() => setSelected(null)} wide>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20, fontSize: 13 }}>
            <div><div style={{ color: C.dim, fontSize: 11, marginBottom: 2 }}>Status</div><StatusBadge status={selected.status} /></div>
            <div><div style={{ color: C.dim, fontSize: 11, marginBottom: 2 }}>Due date</div><div style={{ color: C.text, fontWeight: 700 }}>{fmtDate(selected.due_date)}</div></div>
            <div><div style={{ color: C.dim, fontSize: 11, marginBottom: 2 }}>Received</div><div style={{ color: C.text }}>{fmtDate(selected.created_at)}</div></div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ color: C.dim, fontSize: 11, marginBottom: 4 }}>Subject</div>
            <div style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>{selected.employee_name ?? selected.requested_by ?? 'Unknown'}</div>
          </div>
          {selected.description && (
            <div style={{ marginBottom: 16, background: C.elevated, borderRadius: 8, padding: '12px 14px', fontSize: 13, color: C.muted }}>{selected.description}</div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {selected.status === 'pending' && (
              <Btn onClick={() => handleUpdateStatus(selected.id, 'in_progress')}>Mark In Progress</Btn>
            )}
            {selected.request_type === 'access' && selected.employee_id && (
              <Btn onClick={() => handleExport(selected.id)}>📦 Generate Data Export</Btn>
            )}
            {['pending','in_progress'].includes(selected.status) && (
              <Btn onClick={() => handleUpdateStatus(selected.id, 'completed')}>✓ Mark Complete</Btn>
            )}
            {selected.status !== 'rejected' && (
              <Btn variant="danger" onClick={() => handleUpdateStatus(selected.id, 'rejected')}>Reject</Btn>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Breach Log Tab ────────────────────────────────────────────
function BreachTab() {
  const qc = useQueryClient();
  const { data: breaches, isLoading } = useGdprBreaches();
  const list = (breaches as any[]) ?? [];
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ discovered_at: new Date().toISOString().split('T')[0], description: '', risk_level: 'low', individuals_affected: '' });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    setSaving(true);
    try {
      const tok = localStorage.getItem('xs_token') ?? '';
      await fetch(`\${API_URL}/api/gdpr/breaches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ ...form, individuals_affected: parseInt(form.individuals_affected) || null }),
      });
      qc.invalidateQueries({ queryKey: ['gdpr','breaches'] });
      setShowNew(false);
    } finally { setSaving(false); }
  };

  const RISK_COLORS: Record<string, string> = { low: C.success, medium: C.warning, high: C.danger, critical: '#FF4444' };

  return (
    <div>
      <div style={{ background: C.warning + '11', border: `1px solid ${C.warning}44`, borderRadius: 10, padding: '12px 16px', fontSize: 12, color: C.muted, marginBottom: 20 }}>
        ⚠️ Under UK GDPR, data breaches likely to result in risk to individuals must be reported to the ICO <strong style={{ color: C.text }}>within 72 hours</strong> of becoming aware. High/critical risk breaches must also notify affected individuals without undue delay.
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Btn onClick={() => setShowNew(true)}>+ Log Breach</Btn>
      </div>
      {isLoading ? <Loading /> : list.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: C.dim }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🛡️</div>
          No data breaches recorded
        </div>
      ) : list.map((b: any) => (
        <Card key={b.id} style={{ marginBottom: 10, borderLeft: `4px solid ${RISK_COLORS[b.risk_level] ?? C.muted}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: RISK_COLORS[b.risk_level] + '22', color: RISK_COLORS[b.risk_level], fontWeight: 700 }}>
                  {b.risk_level.toUpperCase()}
                </span>
                <StatusBadge status={b.status} />
                {b.reported_to_ico ? <span style={{ fontSize: 11, color: C.success }}>✓ ICO Notified</span> : <span style={{ fontSize: 11, color: C.warning }}>ICO not notified</span>}
              </div>
              <div style={{ fontSize: 13, color: C.text, fontWeight: 600, marginBottom: 4 }}>{b.description}</div>
              <div style={{ fontSize: 11, color: C.dim }}>Discovered: {fmtDate(b.discovered_at)} · {b.individuals_affected ?? '?'} individuals</div>
            </div>
          </div>
        </Card>
      ))}
      {showNew && (
        <Modal title="Log Data Breach" onClose={() => setShowNew(false)}>
          <FormField label="Date Discovered"><input style={inputStyle} type="date" value={form.discovered_at} onChange={e => set('discovered_at', e.target.value)} /></FormField>
          <FormField label="Description" required><textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' } as any} value={form.description} onChange={e => set('description', e.target.value)} placeholder="What happened, what data was affected..." /></FormField>
          <FormField label="Risk Level">
            <select style={selectStyle} value={form.risk_level} onChange={e => set('risk_level', e.target.value)}>
              {['low','medium','high','critical'].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </FormField>
          <FormField label="Individuals Affected (approx.)"><input style={inputStyle} type="number" value={form.individuals_affected} onChange={e => set('individuals_affected', e.target.value)} placeholder="0" /></FormField>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <Btn variant="ghost" onClick={() => setShowNew(false)}>Cancel</Btn>
            <Btn variant="danger" onClick={handleCreate} disabled={saving}>{saving ? 'Logging...' : 'Log Breach'}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Config Tab ────────────────────────────────────────────────
function ConfigTab({ config }: { config: any }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    dpo_name:    config?.dpo_name    ?? '',
    dpo_email:   config?.dpo_email   ?? '',
    dpo_phone:   config?.dpo_phone   ?? '',
    ico_number:  config?.ico_number  ?? '',
    privacy_policy_url: config?.privacy_policy_url ?? '',
    retention_employee_data:  config?.retention_employee_data  ?? 2555,
    retention_audit_logs:     config?.retention_audit_logs     ?? 365,
    retention_timesheets:     config?.retention_timesheets     ?? 2555,
    retention_expenses:       config?.retention_expenses       ?? 2555,
    retention_leave_records:  config?.retention_leave_records  ?? 1825,
  });
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const tok = localStorage.getItem('xs_token') ?? '';
      await fetch(`\${API_URL}/api/gdpr/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify(form),
      });
      qc.invalidateQueries({ queryKey: ['gdpr','config'] });
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } finally { setSaving(false); }
  };

  return (
    <div>
      {saved && <Alert type="success" message="GDPR configuration saved" />}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div>
          <div style={{ fontWeight: 800, color: C.text, marginBottom: 14 }}>Data Protection Officer</div>
          <FormField label="DPO Name"><input style={inputStyle} value={form.dpo_name} onChange={e => set('dpo_name', e.target.value)} /></FormField>
          <FormField label="DPO Email"><input style={inputStyle} type="email" value={form.dpo_email} onChange={e => set('dpo_email', e.target.value)} /></FormField>
          <FormField label="DPO Phone"><input style={inputStyle} value={form.dpo_phone} onChange={e => set('dpo_phone', e.target.value)} /></FormField>
          <FormField label="ICO Registration Number"><input style={inputStyle} value={form.ico_number} onChange={e => set('ico_number', e.target.value)} placeholder="ZB123456" /></FormField>
          <FormField label="Privacy Policy URL"><input style={inputStyle} value={form.privacy_policy_url} onChange={e => set('privacy_policy_url', e.target.value)} placeholder="https://..." /></FormField>
        </div>
        <div>
          <div style={{ fontWeight: 800, color: C.text, marginBottom: 14 }}>Data Retention Periods</div>
          {[
            { k: 'retention_employee_data',  l: 'Employee Records (days)',    default: 2555, note: '7 years recommended' },
            { k: 'retention_audit_logs',     l: 'Audit Logs (days)',          default: 365,  note: '1 year minimum' },
            { k: 'retention_timesheets',     l: 'Timesheets (days)',          default: 2555, note: '7 years (HMRC)' },
            { k: 'retention_expenses',       l: 'Expense Records (days)',     default: 2555, note: '7 years (HMRC)' },
            { k: 'retention_leave_records',  l: 'Leave Records (days)',       default: 1825, note: '5 years' },
          ].map(f => (
            <div key={f.k} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: C.dim }}>{f.l}</label>
                <span style={{ fontSize: 10, color: C.dim }}>{f.note}</span>
              </div>
              <input type="number" style={inputStyle} value={form[f.k as keyof typeof form]} onChange={e => set(f.k, parseInt(e.target.value))} />
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
        <Btn onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Configuration'}</Btn>
      </div>
    </div>
  );
}

// ── Privacy Tab (cookie preferences) ─────────────────────────
function PrivacyTab() {
  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ fontWeight: 800, color: C.text, marginBottom: 8 }}>Cookie Preferences</div>
      <div style={{ color: C.muted, fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
        These settings apply to your current browser session. For XavvySuite to function correctly,
        necessary cookies are always enabled. All other cookies are optional.
      </div>
      <CookieSettingsPanel />
    </div>
  );
}

// ── Main GDPR Module ──────────────────────────────────────────
export default function GDPRModule() {
  const { ctx, isSuperAdmin } = usePermission();
  const [tab, setTab] = useState<'overview' | 'requests' | 'breaches' | 'config' | 'privacy'>('overview');
  const { data: config, isLoading } = useGdprConfig();

  const TABS = [
    { k: 'overview',  l: '🛡️ Overview'       },
    { k: 'requests',  l: '📋 Subject Requests' },
    { k: 'breaches',  l: '🚨 Breach Log'       },
    ...(isSuperAdmin ? [
      { k: 'config',  l: '⚙️ Configuration'    },
    ] : []),
    { k: 'privacy',   l: '🍪 My Cookies'       },
  ] as const;

  return (
    <div className="animate-fadeIn">
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ color: C.text, fontSize: 20, fontWeight: 800, margin: 0 }}>Data Protection & Privacy</h2>
        <p style={{ color: C.muted, fontSize: 12, margin: '4px 0 0' }}>UK GDPR compliance, subject access requests and breach management</p>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.k} onClick={() => setTab(t.k as any)} style={{
            background: tab === t.k ? C.primary : C.elevated,
            color: tab === t.k ? '#fff' : C.muted,
            border: `1px solid ${tab === t.k ? C.primary : C.border}`,
            borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>{t.l}</button>
        ))}
      </div>

      {isLoading ? <Loading /> : (
        <>
          {tab === 'overview'  && <OverviewTab config={config} />}
          {tab === 'requests'  && <DSARTab />}
          {tab === 'breaches'  && <BreachTab />}
          {tab === 'config'    && <ConfigTab config={config} />}
          {tab === 'privacy'   && <PrivacyTab />}
        </>
      )}
    </div>
  );
}

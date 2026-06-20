/**
 * LeaveSettings.tsx
 * Leave administration: types, country rules, TOIL/overtime management
 * Accessible from Settings → Leave or HR → Leave Settings
 */

import { useState } from 'react';
import {
  useOvertimeRecords, useCountryLeaveRules, useCountryList, useLogOvertime, useEmployees,
} from '../../hooks/api';
import {
  Card, Modal, SectionHeader, StatusBadge, Loading, Alert,
  FormField, inputStyle, selectStyle, C, fmtDate, Btn,
} from '../../components/ui';
import { useQueryClient } from '@tanstack/react-query';
import { usePermission } from '../../platform/permissions/index';

// ── Leave types data (from 007 seed — displayed read-only, editable via Settings) ──
const LEAVE_TYPES = [
  { code: 'annual',        name: 'Annual Leave',          icon: '🌴', colour: '#6366F1', paid: true,  entitlement: 25, carryForward: 5 },
  { code: 'sick',          name: 'Sick Leave',            icon: '🤒', colour: '#EF4444', paid: true,  entitlement: 10, carryForward: 0 },
  { code: 'maternity',     name: 'Maternity Leave',       icon: '👶', colour: '#14B8A6', paid: true,  entitlement: 52, carryForward: 0 },
  { code: 'paternity',     name: 'Paternity Leave',       icon: '👨‍👧', colour: '#38BDF8', paid: true, entitlement: 10, carryForward: 0 },
  { code: 'compassionate', name: 'Compassionate Leave',   icon: '💙', colour: '#F59E0B', paid: true,  entitlement: 5,  carryForward: 0 },
  { code: 'unpaid',        name: 'Unpaid Leave',          icon: '⏸️', colour: '#475569', paid: false, entitlement: 0,  carryForward: 0 },
  { code: 'toil',          name: 'Time Off In Lieu (TOIL)',icon:'⏰', colour: '#A855F7', paid: true,  entitlement: 0,  carryForward: 20 },
];

// ── Country rules tab ────────────────────────────────────────
function CountryRulesTab() {
  const { data: countries } = useCountryList();
  const [selectedCountry, setSelectedCountry] = useState('GB');
  const { data: rules, isLoading } = useCountryLeaveRules(selectedCountry);
  const countryList: any[] = (countries as any[]) ?? [];
  const ruleList: any[] = (rules as any[]) ?? [];

  const STATUTORY_COLORS: Record<string, string> = {
    annual: C.primary, sick: C.danger, maternity: C.success,
    paternity: C.sky, compassionate: C.warning, unpaid: C.muted,
  };

  return (
    <div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 20, lineHeight: 1.6 }}>
        Statutory minimum leave entitlements by country. These are reference values —
        your actual policies (configured in Leave Policies) must meet or exceed these minimums.
      </div>

      {/* Country selector */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        {countryList.map((c: any) => (
          <button key={c.country_code} onClick={() => setSelectedCountry(c.country_code)}
            style={{
              background: selectedCountry === c.country_code ? C.primary : C.elevated,
              color:      selectedCountry === c.country_code ? '#fff' : C.muted,
              border:     `1px solid ${selectedCountry === c.country_code ? C.primary : C.border}`,
              borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>
            {c.country_name}
          </button>
        ))}
      </div>

      {isLoading ? <Loading /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
          {ruleList.map((r: any) => (
            <Card key={r.id} style={{ borderLeft: `4px solid ${STATUTORY_COLORS[r.leave_code] ?? C.muted}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: C.text, marginBottom: 2 }}>
                    {r.leave_code.charAt(0).toUpperCase() + r.leave_code.slice(1)} Leave
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: STATUTORY_COLORS[r.leave_code] ?? C.muted }}>
                    {r.statutory_days} {r.leave_code === 'sick' && r.statutory_days === 0 ? '(SSP)' : r.leave_code === 'maternity' ? 'weeks' : 'days'}
                  </div>
                </div>
                <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: r.paid ? C.success + '22' : C.warning + '22', color: r.paid ? C.success : C.warning, fontWeight: 700 }}>
                  {r.paid ? 'Paid' : 'Unpaid'}
                </span>
              </div>
              {r.notes && (
                <div style={{ fontSize: 11, color: C.dim, lineHeight: 1.5, marginTop: 8, borderTop: `1px solid ${C.border}33`, paddingTop: 8 }}>
                  {r.notes}
                </div>
              )}
            </Card>
          ))}
          {ruleList.length === 0 && (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, color: C.dim }}>
              No rules configured for this country
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Leave types tab ───────────────────────────────────────────
function LeaveTypesTab() {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: C.muted }}>
          System leave types for your tenant. TOIL is accrued via the Overtime tab.
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {LEAVE_TYPES.map(lt => (
          <Card key={lt.code} style={{ borderLeft: `4px solid ${lt.colour}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontSize: 22 }}>{lt.icon}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{lt.name}</div>
                  <div style={{ fontSize: 11, color: C.dim, marginTop: 2, display: 'flex', gap: 12 }}>
                    <span>{lt.paid ? '💷 Paid' : '⏸️ Unpaid'}</span>
                    {lt.entitlement > 0 && <span>📅 {lt.entitlement} {lt.code === 'maternity' ? 'weeks' : 'days'}</span>}
                    {lt.carryForward > 0 && <span>↩️ Carry fwd: {lt.carryForward}d max</span>}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: lt.colour + '22', color: lt.colour, fontWeight: 700 }}>
                  {lt.code}
                </span>
                <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: C.success + '22', color: C.success, fontWeight: 700 }}>
                  Enabled
                </span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── TOIL / Overtime tab ───────────────────────────────────────
function OvertimeTab() {
  const qc = useQueryClient();
  const { data: employees } = useEmployees();
  const logOvertime = useLogOvertime();
  const [empFilter, setEmpFilter] = useState('');
  const { data: records, isLoading } = useOvertimeRecords(empFilter ? { employeeId: empFilter } : undefined);
  const [showLog, setShowLog] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    hours: '', rate_multiplier: '1.0', toil_eligible: 'true',
    notes: '', employee_id: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const empList: any[] = (employees as any)?.items ?? [];
  const recList: any[] = (records as any[]) ?? [];

  const STATUS_COLOR: Record<string, string> = {
    pending: C.warning, approved: C.success, converted_to_toil: C.primary,
    paid: C.success, rejected: C.danger,
  };

  const handleLog = async () => {
    if (!form.hours) { setErr('Hours required'); return; }
    setSaving(true); setErr('');
    try {
      await logOvertime.mutateAsync({
        ...form,
        hours: parseFloat(form.hours),
        rate_multiplier: parseFloat(form.rate_multiplier),
        toil_eligible: form.toil_eligible === 'true',
        employee_id: form.employee_id || undefined,
      } as any);
      qc.invalidateQueries({ queryKey: ['overtime'] });
      setShowLog(false);
      setForm({ date: new Date().toISOString().split('T')[0], hours: '', rate_multiplier: '1.0', toil_eligible: 'true', notes: '', employee_id: '' });
    } catch (e: any) { setErr(e.message ?? 'Failed'); }
    finally { setSaving(false); }
  };

  const handleAction = async (id: string, action: 'approve' | 'convert' | 'reject') => {
    const tok = localStorage.getItem('xs_token') ?? '';
    await fetch(`/api/overtime/records/${id}/${action}`, {
      method: 'POST', headers: { Authorization: `Bearer ${tok}` },
    });
    qc.invalidateQueries({ queryKey: ['overtime'] });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13, color: C.muted }}>
            Log overtime hours. Approved TOIL-eligible records can be converted to TOIL leave balance.
          </div>
          <div style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>
            1 TOIL day = 7.5 hours. TOIL hours × rate = TOIL credit.
          </div>
        </div>
        <Btn onClick={() => setShowLog(true)}>+ Log Overtime</Btn>
      </div>

      {/* Employee filter */}
      <div style={{ marginBottom: 16 }}>
        <select style={selectStyle} value={empFilter} onChange={e => setEmpFilter(e.target.value)}>
          <option value="">All employees</option>
          {empList.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
        </select>
      </div>

      {isLoading ? <Loading /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {recList.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: C.dim }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>⏱️</div>
              No overtime records yet
            </div>
          )}
          {recList.map((r: any) => {
            const toilDays = ((r.toil_hours ?? r.hours) / 7.5).toFixed(2);
            return (
              <Card key={r.id} style={{ borderLeft: `4px solid ${STATUS_COLOR[r.status] ?? C.muted}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{r.employee_name}</span>
                      <StatusBadge status={r.status} />
                      {r.toil_eligible ? (
                        <span style={{ fontSize: 10, background: C.primary + '22', color: C.primary, borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>TOIL eligible</span>
                      ) : (
                        <span style={{ fontSize: 10, background: C.success + '22', color: C.success, borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>Paid overtime</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: C.muted, display: 'flex', gap: 14 }}>
                      <span>📅 {fmtDate(r.date)}</span>
                      <span>⏱️ {r.hours}h worked</span>
                      {r.rate_multiplier !== 1 && <span>× {r.rate_multiplier} rate</span>}
                      {r.toil_eligible && <span>= {toilDays} TOIL days</span>}
                      {r.project_name && <span>📂 {r.project_name}</span>}
                    </div>
                    {r.notes && <div style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>{r.notes}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 12 }}>
                    {r.status === 'pending' && (
                      <>
                        <button onClick={() => handleAction(r.id, 'approve')}
                          style={{ background: C.success + '22', color: C.success, border: `1px solid ${C.success}44`, borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                          ✓ Approve
                        </button>
                        <button onClick={() => handleAction(r.id, 'reject')}
                          style={{ background: C.danger + '22', color: C.danger, border: `1px solid ${C.danger}44`, borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                          ✕ Reject
                        </button>
                      </>
                    )}
                    {r.status === 'approved' && r.toil_eligible ? (
                      <button onClick={() => handleAction(r.id, 'convert')}
                        style={{ background: C.primary + '22', color: C.primary, border: `1px solid ${C.primary}44`, borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                        ↩️ Convert to TOIL
                      </button>
                    ) : null}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Log overtime modal */}
      {showLog && (
        <Modal title="Log Overtime" onClose={() => setShowLog(false)}>
          {err && <Alert type="error" message={err} />}
          <FormField label="Employee (leave blank to log for yourself)">
            <select style={selectStyle} value={form.employee_id} onChange={e => set('employee_id', e.target.value)}>
              <option value="">Myself</option>
              {empList.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
            </select>
          </FormField>
          <FormField label="Date" required>
            <input style={inputStyle} type="date" value={form.date} onChange={e => set('date', e.target.value)} />
          </FormField>
          <FormField label="Hours Worked" required>
            <input style={inputStyle} type="number" min="0.5" max="24" step="0.5" value={form.hours}
              onChange={e => set('hours', e.target.value)} placeholder="e.g. 3" />
          </FormField>
          <FormField label="Rate Multiplier">
            <select style={selectStyle} value={form.rate_multiplier} onChange={e => set('rate_multiplier', e.target.value)}>
              <option value="1.0">1× straight time</option>
              <option value="1.5">1.5× time and a half</option>
              <option value="2.0">2× double time</option>
            </select>
          </FormField>
          <FormField label="Convert to TOIL or Pay?">
            <select style={selectStyle} value={form.toil_eligible} onChange={e => set('toil_eligible', e.target.value)}>
              <option value="true">↩️ Time Off In Lieu (TOIL)</option>
              <option value="false">💷 Paid overtime</option>
            </select>
          </FormField>
          <FormField label="Notes">
            <input style={inputStyle} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional — project, reason etc." />
          </FormField>
          <div style={{ background: C.elevated, borderRadius: 8, padding: '10px 14px', fontSize: 12, color: C.muted, marginTop: 8 }}>
            {parseFloat(form.hours || '0') > 0 && (
              <>
                {form.toil_eligible === 'true'
                  ? `↩️ ${(parseFloat(form.hours) * parseFloat(form.rate_multiplier) / 7.5).toFixed(2)} TOIL days will be credited once approved`
                  : `💷 ${parseFloat(form.hours)}h at ${form.rate_multiplier}× rate = ${(parseFloat(form.hours) * parseFloat(form.rate_multiplier)).toFixed(1)}h pay`
                }
              </>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <Btn variant="ghost" onClick={() => setShowLog(false)}>Cancel</Btn>
            <Btn onClick={handleLog} disabled={saving}>{saving ? 'Saving...' : 'Log Overtime'}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Main module ───────────────────────────────────────────────
export default function LeaveSettingsModule() {
  const [tab, setTab] = useState<'types' | 'country' | 'overtime'>('types');
  const { can } = usePermission();

  const TABS = [
    { k: 'types',    l: '📋 Leave Types'      },
    { k: 'country',  l: '🌍 Country Rules'     },
    { k: 'overtime', l: '⏱️ Overtime & TOIL'   },
  ] as const;

  return (
    <div className="animate-fadeIn">
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ color: C.text, fontSize: 20, fontWeight: 800, margin: 0 }}>Leave Settings</h2>
        <p style={{ color: C.muted, fontSize: 12, margin: '4px 0 0' }}>
          Leave types, statutory minimums by country, and overtime/TOIL management
        </p>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
        {TABS.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} style={{
            background: tab === t.k ? C.primary : C.elevated,
            color:      tab === t.k ? '#fff'    : C.muted,
            border:     `1px solid ${tab === t.k ? C.primary : C.border}`,
            borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>{t.l}</button>
        ))}
      </div>

      {tab === 'types'    && <LeaveTypesTab />}
      {tab === 'country'  && <CountryRulesTab />}
      {tab === 'overtime' && <OvertimeTab />}
    </div>
  );
}

import { useState } from 'react';
import { useVisas, useCreateVisa, useUpdateVisa, useEmployees, type VisaRecord } from '../../hooks/api';
import {
  Card, DataTable, Modal, InfoRow, MetricCard, MetricGrid,
  StatusBadge, Avatar, Loading, Alert, FormField,
  inputStyle, selectStyle, C, fmtDate, ColDef,
} from '../../components/ui';
import { useQueryClient } from '@tanstack/react-query';

const VISA_TYPES = [
  'Skilled Worker Visa', 'ICT Visa', 'Global Talent Visa',
  'Graduate Visa', 'Student Visa', 'Spouse/Partner Visa',
  'Indefinite Leave to Remain', 'British Citizenship',
  'EU Settlement Scheme', 'Tier 2 (General)', 'Other',
];

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  active:               { color: C.success, label: 'Active' },
  expired:              { color: C.danger,  label: 'Expired' },
  cancelled:            { color: C.dim,     label: 'Cancelled' },
  pending:              { color: C.warning, label: 'Pending' },
  renewal_in_progress:  { color: C.info,    label: 'Renewal In Progress' },
};

function daysLabel(days?: number): { text: string; color: string } {
  if (!days && days !== 0) return { text: 'No expiry', color: C.dim };
  if (days < 0)   return { text: `Expired ${Math.abs(days)}d ago`, color: C.danger };
  if (days < 30)  return { text: `${days}d left ⚠️`,              color: C.danger };
  if (days < 90)  return { text: `${days}d left`,                  color: C.warning };
  return           { text: `${days}d left`,                         color: C.success };
}

// ── Add / Edit Visa Modal ─────────────────────────────────────────────────────
function VisaModal({ visa, onClose }: { visa?: VisaRecord; onClose: () => void }) {
  const isEdit = !!visa;
  const create = useCreateVisa();
  const update = useUpdateVisa(visa?.id ?? '');
  const { data: employees } = useEmployees();
  const qc = useQueryClient();
  const [errMsg, setErrMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    employeeId:           visa?.employee_id           ?? '',
    visaType:             visa?.visa_type              ?? '',
    visaNumber:           visa?.visa_number            ?? '',
    countryOfIssue:       visa?.country_of_issue       ?? 'GBR',
    issueDate:            visa?.issue_date             ?? '',
    expiryDate:           visa?.expiry_date            ?? '',
    sponsorshipRequired:  visa?.sponsorship_required === 1,
    sponsorLicenceNumber: visa?.sponsor_licence_number ?? '',
    cosNumber:            visa?.cos_number             ?? '',
    cosExpiry:            visa?.cos_expiry             ?? '',
    notes:                visa?.notes                  ?? '',
  });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!isEdit && !form.employeeId) { setErrMsg('Please select an employee'); return; }
    if (!form.visaType) { setErrMsg('Visa type is required'); return; }
    setSaving(true); setErrMsg('');
    try {
      if (isEdit) {
        await update.mutateAsync({
          expiry_date: form.expiryDate || undefined,
          issue_date:  form.issueDate  || undefined,
          visa_number: form.visaNumber || undefined,
          cos_number:  form.cosNumber  || undefined,
          cos_expiry:  form.cosExpiry  || undefined,
          sponsor_licence_number: form.sponsorLicenceNumber || undefined,
          notes:       form.notes || undefined,
        });
      } else {
        await create.mutateAsync(form);
      }
      qc.invalidateQueries({ queryKey: ['visas'] });
      onClose();
    } catch (e: any) { setErrMsg(e.message ?? 'Failed to save visa'); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={isEdit ? `Edit Visa — ${visa!.employee_name}` : 'Add Visa Record'} onClose={onClose} wide>
      {errMsg && <Alert type="error" message={errMsg} />}

      {!isEdit && (
        <FormField label="Employee" required>
          <select style={selectStyle} value={form.employeeId} onChange={e => set('employeeId', e.target.value)}>
            <option value="">Select employee...</option>
            {(employees?.items ?? []).map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
          </select>
        </FormField>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <FormField label="Visa Type" required>
          <select style={selectStyle} value={form.visaType} onChange={e => set('visaType', e.target.value)}>
            <option value="">Select type...</option>
            {VISA_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </FormField>
        <FormField label="Visa Number">
          <input style={inputStyle} value={form.visaNumber} onChange={e => set('visaNumber', e.target.value)} placeholder="ABC123456" />
        </FormField>
        <FormField label="Issue Date">
          <input style={inputStyle} type="date" value={form.issueDate} onChange={e => set('issueDate', e.target.value)} />
        </FormField>
        <FormField label="Expiry Date">
          <input style={inputStyle} type="date" value={form.expiryDate} onChange={e => set('expiryDate', e.target.value)} />
        </FormField>
        <FormField label="Country of Issue">
          <select style={selectStyle} value={form.countryOfIssue} onChange={e => set('countryOfIssue', e.target.value)}>
            <option value="GBR">United Kingdom</option>
            <option value="USA">United States</option>
            <option value="IND">India</option>
            <option value="PAK">Pakistan</option>
            <option value="NGA">Nigeria</option>
            <option value="OTH">Other</option>
          </select>
        </FormField>
      </div>

      {/* Sponsorship section */}
      <div style={{ margin: '16px 0 8px', padding: '12px', background: C.surface, borderRadius: 10, border: `1px solid ${C.border}` }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.muted, cursor: 'pointer', marginBottom: form.sponsorshipRequired ? 12 : 0 }}>
          <input type="checkbox" checked={form.sponsorshipRequired} onChange={e => set('sponsorshipRequired', e.target.checked)} />
          <span style={{ fontWeight: 600 }}>🏢 Company is sponsoring this visa</span>
        </label>
        {form.sponsorshipRequired && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <FormField label="Sponsor Licence No.">
              <input style={inputStyle} value={form.sponsorLicenceNumber} onChange={e => set('sponsorLicenceNumber', e.target.value)} placeholder="XXXXXXXXXXX" />
            </FormField>
            <FormField label="CoS Reference">
              <input style={inputStyle} value={form.cosNumber} onChange={e => set('cosNumber', e.target.value)} placeholder="E1Y0Q0J0A0000000" />
            </FormField>
            <FormField label="CoS Expiry">
              <input style={inputStyle} type="date" value={form.cosExpiry} onChange={e => set('cosExpiry', e.target.value)} />
            </FormField>
          </div>
        )}
      </div>

      <FormField label="Notes">
        <textarea style={{ ...inputStyle, height: 60, resize: 'vertical' }} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any additional notes..." />
      </FormField>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
        <button onClick={onClose} style={{ background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
        <button onClick={handleSave} disabled={saving} style={{ background: saving ? C.primary + '99' : C.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: saving ? 'wait' : 'pointer' }}>
          {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Visa Record'}
        </button>
      </div>
    </Modal>
  );
}

// ── Renew Visa Modal ──────────────────────────────────────────────────────────
function RenewModal({ visa, onClose }: { visa: VisaRecord; onClose: () => void }) {
  const qc = useQueryClient();
  const [newExpiry, setNewExpiry] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleRenew = async () => {
    if (!newExpiry) return;
    setSaving(true);
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`/api/visas/${visa.id}/renew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ newExpiry, notes }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      qc.invalidateQueries({ queryKey: ['visas'] });
      onClose();
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={`Renew Visa — ${visa.employee_name}`} onClose={onClose}>
      <InfoRow label="Visa Type"   value={visa.visa_type} />
      <InfoRow label="Current Expiry" value={visa.expiry_date ? fmtDate(visa.expiry_date) : '—'} />
      <div style={{ marginTop: 16 }}>
        <FormField label="New Expiry Date" required>
          <input style={inputStyle} type="date" value={newExpiry} onChange={e => setNewExpiry(e.target.value)} />
        </FormField>
        <FormField label="Notes">
          <textarea style={{ ...inputStyle, height: 60, resize: 'vertical' }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Renewal reference, notes..." />
        </FormField>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
        <button onClick={onClose} style={{ background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
        <button onClick={handleRenew} disabled={saving || !newExpiry} style={{ background: C.success, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          {saving ? 'Renewing...' : '🔄 Renew Visa'}
        </button>
      </div>
    </Modal>
  );
}

// ── Main Visa Module ──────────────────────────────────────────────────────────
export default function VisaModule() {
  const [filter, setFilter]       = useState('all');
  const [selected, setSelected]   = useState<VisaRecord | null>(null);
  const [showAdd, setShowAdd]     = useState(false);
  const [showRenew, setShowRenew] = useState<VisaRecord | null>(null);
  const [showEdit, setShowEdit]   = useState<VisaRecord | null>(null);

  const params: Record<string, string> = {};
  if (filter === 'expiring')  params.expiring = 'true';
  if (filter === 'expired')   params.status   = 'expired';
  if (filter === 'sponsored') params.status   = 'active';

  const { data: visas, isLoading, refetch } = useVisas(filter === 'sponsored' ? { ...params } : params);

  const all  = visas ?? [];
  const displayed = filter === 'sponsored' ? all.filter(v => v.sponsorship_required === 1) : all;

  const expiring90 = all.filter(v => v.days_remaining !== undefined && v.days_remaining !== null && v.days_remaining >= 0 && v.days_remaining <= 90 && v.status === 'active');
  const expiring30 = all.filter(v => v.days_remaining !== undefined && v.days_remaining !== null && v.days_remaining >= 0 && v.days_remaining <= 30 && v.status === 'active');
  const expired    = all.filter(v => v.status === 'expired');
  const sponsored  = all.filter(v => v.sponsorship_required === 1);

  const cols: ColDef<VisaRecord>[] = [
    { key: 'employee_name', label: 'Employee', render: (v, r) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Avatar name={v} size={28} />
        <div>
          <div style={{ fontWeight: 600 }}>{v}</div>
          <div style={{ fontSize: 10, color: C.dim }}>{r.employee_email}</div>
        </div>
      </div>
    )},
    { key: 'visa_type',   label: 'Visa Type', render: v => <span style={{ fontWeight: 600 }}>{v}</span> },
    { key: 'visa_number', label: 'Reference', muted: true },
    { key: 'expiry_date', label: 'Expiry', render: (v, r) => {
      const { text, color } = daysLabel(r.days_remaining);
      return (
        <div>
          <div style={{ fontSize: 12 }}>{v ? fmtDate(v) : '—'}</div>
          {v && <div style={{ fontSize: 10, color, fontWeight: 700 }}>{text}</div>}
        </div>
      );
    }},
    { key: 'sponsorship_required', label: 'Sponsored', render: v => v ? <span style={{ background: C.primary + '22', color: C.primary, borderRadius: 6, fontSize: 10, padding: '2px 7px', fontWeight: 700 }}>🏢 Sponsored</span> : <span style={{ color: C.dim, fontSize: 11 }}>—</span> },
    { key: 'status', label: 'Status', render: v => <StatusBadge status={v} /> },
    { key: 'id', label: '', render: (_, r) => (
      <div style={{ display: 'flex', gap: 4 }}>
        <button onClick={e => { e.stopPropagation(); setShowRenew(r); }} style={{ background: C.success + '22', color: C.success, border: 'none', borderRadius: 6, padding: '3px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>🔄 Renew</button>
        <button onClick={e => { e.stopPropagation(); setShowEdit(r); }} style={{ background: C.primary + '22', color: C.primary, border: 'none', borderRadius: 6, padding: '3px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>✏️</button>
      </div>
    )},
  ];

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ color: C.text, fontSize: 20, fontWeight: 800, margin: 0 }}>Visa Management</h2>
          <p style={{ color: C.muted, fontSize: 12, margin: '4px 0 0' }}>Visa tracking, sponsorship and renewal alerts</p>
        </div>
        <button onClick={() => setShowAdd(true)} style={{ background: C.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          + Add Visa Record
        </button>
      </div>

      {/* Alerts */}
      {expiring30.length > 0 && (
        <Alert type="error" message={`${expiring30.length} visa${expiring30.length > 1 ? 's' : ''} expiring within 30 days — urgent action required`} />
      )}
      {expiring90.length > expiring30.length && (
        <Alert type="warning" message={`${expiring90.length - expiring30.length} visa${expiring90.length - expiring30.length > 1 ? 's' : ''} expiring within 90 days`} />
      )}

      {/* Metrics */}
      <MetricGrid>
        <MetricCard label="Active Visas"    value={all.filter(v => v.status === 'active').length} icon="✅" color={`linear-gradient(135deg,${C.success},${C.secondary})`} />
        <MetricCard label="Expiring 90d"    value={expiring90.length}                             icon="⚠️" color={`linear-gradient(135deg,${C.warning},${C.danger})`} />
        <MetricCard label="Expiring 30d"    value={expiring30.length}                             icon="🚨" color={`linear-gradient(135deg,${C.danger},#7F1D1D)`} />
        <MetricCard label="Sponsored"       value={sponsored.length}                              icon="🏢" color={`linear-gradient(135deg,${C.primary},#8B5CF6)`} />
      </MetricGrid>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { key: 'all',       label: `All (${all.length})` },
          { key: 'expiring',  label: `⚠️ Expiring 90d (${expiring90.length})` },
          { key: 'expired',   label: `❌ Expired (${expired.length})` },
          { key: 'sponsored', label: `🏢 Sponsored (${sponsored.length})` },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{ background: filter === f.key ? C.primary : C.elevated, color: filter === f.key ? '#fff' : C.muted, border: `1px solid ${filter === f.key ? C.primary : C.border}`, borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{f.label}</button>
        ))}
      </div>

      {/* Table */}
      <Card>
        {isLoading ? <Loading /> : (
          <DataTable
            cols={cols}
            rows={displayed}
            onRow={setSelected}
            emptyText={filter === 'expiring' ? 'No visas expiring within 90 days' : filter === 'expired' ? 'No expired visas' : 'No visa records — add your first one'}
          />
        )}
      </Card>

      {/* Detail modal */}
      {selected && !showEdit && !showRenew && (
        <Modal title={`${selected.employee_name} — ${selected.visa_type}`} onClose={() => setSelected(null)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <Avatar name={selected.employee_name} size={48} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: C.text }}>{selected.employee_name}</div>
              <div style={{ color: C.muted, fontSize: 13 }}>{selected.employee_email}</div>
            </div>
          </div>

          <InfoRow label="Visa Type"   value={selected.visa_type} />
          <InfoRow label="Visa No."    value={selected.visa_number ?? '—'} />
          <InfoRow label="Country"     value={selected.country_of_issue} />
          <InfoRow label="Issued"      value={selected.issue_date ? fmtDate(selected.issue_date) : '—'} />
          <InfoRow label="Expires"     value={selected.expiry_date ? fmtDate(selected.expiry_date) : 'No expiry'} />
          <InfoRow label="Status"      value={<StatusBadge status={selected.status} />} />

          {selected.days_remaining !== undefined && selected.expiry_date && (() => {
            const { text, color } = daysLabel(selected.days_remaining);
            return <InfoRow label="Remaining" value={<span style={{ color, fontWeight: 700 }}>{text}</span>} />;
          })()}

          {selected.sponsorship_required === 1 && (
            <>
              <div style={{ margin: '12px 0 8px', fontSize: 11, fontWeight: 700, color: C.primary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Sponsorship Details</div>
              <InfoRow label="Sponsor Licence" value={selected.sponsor_licence_number ?? '—'} />
              <InfoRow label="CoS Reference"   value={selected.cos_number ?? '—'} />
              {selected.cos_expiry && <InfoRow label="CoS Expiry"  value={fmtDate(selected.cos_expiry)} />}
            </>
          )}

          {selected.notes && <InfoRow label="Notes" value={selected.notes} />}

          <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => setShowRenew(selected)} style={{ background: C.success, color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>🔄 Renew</button>
            <button onClick={() => setShowEdit(selected)} style={{ background: C.primary + '22', color: C.primary, border: `1px solid ${C.primary}33`, borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>✏️ Edit</button>
            <button onClick={() => setSelected(null)} style={{ background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 14px', fontSize: 12, cursor: 'pointer' }}>Close</button>
          </div>
        </Modal>
      )}

      {showAdd    && <VisaModal onClose={() => { setShowAdd(false); refetch(); }} />}
      {showEdit   && <VisaModal visa={showEdit} onClose={() => { setShowEdit(null); refetch(); }} />}
      {showRenew  && <RenewModal visa={showRenew} onClose={() => { setShowRenew(null); setSelected(null); refetch(); }} />}
    </div>
  );
}

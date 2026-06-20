import { useState } from 'react';
const API_URL = import.meta.env.VITE_API_URL ?? '';
import {
  useEmployees, useEmployee, useEmployeeHistory,
  useDepartments, useCreateEmployee, useUpdateEmployee
} from '../../hooks/api';
import {
  Card, DataTable, SearchBar, Avatar, StatusBadge,
  Modal, InfoRow, MetricCard, Loading, C, fmtDate,
  FormField, inputStyle, selectStyle, Alert
} from '../../components/ui';
import { PermissionGate, usePermission, PERMISSIONS } from '../../platform/permissions/index';
import { useEmergencyContacts, useCreateEmergencyContact, useCompensation, useCreateCompensation, useLeaveTypes, useRoles, useEmployeeRoles, useGrantRole, useRevokeRole, type EmergencyContact, type CompensationRecord, type RoleOption, type EmployeeRoleAssignment } from '../../hooks/api';
import { useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '../../store/appStore';

// ── Local button primitives (plain elements — no event-loss risk) ─────────────
const PBtn = ({ onClick, disabled, children }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode }) => (
  <button onClick={onClick} disabled={disabled} style={{ background: disabled ? C.primary+'99' : C.primary, color:'#fff', border:'none', borderRadius:8, padding:'8px 18px', fontSize:13, fontWeight:700, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1 }}>{children}</button>
);
const GBtn = ({ onClick, children, small }: { onClick?: () => void; children: React.ReactNode; small?: boolean }) => (
  <button onClick={onClick} style={{ background:'transparent', color:C.muted, border:`1px solid ${C.border}`, borderRadius:8, padding: small ? '4px 10px' : '8px 16px', fontSize: small ? 11 : 13, fontWeight:600, cursor:'pointer' }}>{children}</button>
);
const DBtn = ({ onClick, children }: { onClick?: () => void; children: React.ReactNode }) => (
  <button onClick={onClick} style={{ background:C.danger+'22', color:C.danger, border:`1px solid ${C.danger}33`, borderRadius:8, padding:'5px 12px', fontSize:12, fontWeight:600, cursor:'pointer' }}>{children}</button>
);
const AccentBtn = ({ onClick, children }: { onClick?: () => void; children: React.ReactNode }) => (
  <button onClick={onClick} style={{ background:C.primary+'22', color:C.primary, border:`1px solid ${C.primary}33`, borderRadius:8, padding:'5px 12px', fontSize:12, fontWeight:700, cursor:'pointer' }}>{children}</button>
);

// ── Add Employee ──────────────────────────────────────────────────────────────
function AddEmployeeModal({ onClose, departments }: { onClose: () => void; departments: any[] }) {
  const createEmployee = useCreateEmployee();
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    firstName:'', lastName:'', email:'', departmentId:'',
    startDate: new Date().toISOString().split('T')[0],
    employmentType:'full_time', locationType:'office',
    employmentBasis:'permanent', contractType:'employed',
  });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.firstName.trim()) { setError('First name is required'); return; }
    if (!form.lastName.trim())  { setError('Last name is required'); return; }
    if (!form.email.trim())     { setError('Email is required'); return; }
    setSaving(true); setError('');
    try {
      await createEmployee.mutateAsync(form);
      qc.invalidateQueries({ queryKey: ['employees'] });
      onClose();
    } catch (e: any) { setError(e.message ?? 'Failed to create employee'); }
    finally { setSaving(false); }
  };

  return (
    <Modal title="Add New Employee" onClose={onClose} wide>
      {error && <Alert type="error" message={error} />}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <FormField label="First Name" required>
          <input style={inputStyle} value={form.firstName} onChange={e => set('firstName', e.target.value)} placeholder="Sarah" />
        </FormField>
        <FormField label="Last Name" required>
          <input style={inputStyle} value={form.lastName} onChange={e => set('lastName', e.target.value)} placeholder="Mitchell" />
        </FormField>
        <FormField label="Work Email" required>
          <input style={inputStyle} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="s.mitchell@xavvy.uk" />
        </FormField>
        <FormField label="Start Date" required>
          <input style={inputStyle} type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
        </FormField>
        <FormField label="Department">
          <select style={selectStyle} value={form.departmentId} onChange={e => set('departmentId', e.target.value)}>
            <option value="">Select department...</option>
            {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </FormField>
        <FormField label="Employment Type" required>
          <select style={selectStyle} value={form.employmentType} onChange={e => set('employmentType', e.target.value)}>
            <option value="full_time">Full Time</option>
            <option value="part_time">Part Time</option>
            <option value="contractor">Contractor</option>
            <option value="intern">Intern</option>
            <option value="casual">Casual</option>
          </select>
        </FormField>
        <FormField label="Contract Basis">
          <select style={selectStyle} value={form.employmentBasis} onChange={e => set('employmentBasis', e.target.value)}>
            <option value="permanent">Permanent</option>
            <option value="fixed_term">Fixed Term</option>
            <option value="zero_hours">Zero Hours</option>
          </select>
        </FormField>
        <FormField label="Work Location">
          <select style={selectStyle} value={form.locationType} onChange={e => set('locationType', e.target.value)}>
            <option value="office">Office</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </FormField>
      </div>
      <div style={{ display:'flex', gap:10, marginTop:24, justifyContent:'flex-end' }}>
        <GBtn onClick={onClose}>Cancel</GBtn>
        <PBtn onClick={handleSave} disabled={saving}>{saving ? 'Creating...' : '+ Add Employee'}</PBtn>
      </div>
    </Modal>
  );
}

// ── Edit Employee ─────────────────────────────────────────────────────────────
function EditEmployeeModal({ emp, onClose, departments }: { emp: any; onClose: () => void; departments: any[] }) {
  const update = useUpdateEmployee(emp.id);
  const { data: allEmployees } = useEmployees();
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    firstName:       emp.first_name       ?? '',
    lastName:        emp.last_name        ?? '',
    departmentId:    emp.department_id    ?? '',
    managerId:       emp.manager_id       ?? '',
    employmentType:  emp.employment_type  ?? 'full_time',
    locationType:    emp.work_location_type ?? 'office',
    employmentBasis: emp.employment_basis ?? 'permanent',
    changeReason:    'correction',
  });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      await update.mutateAsync(form);
      qc.invalidateQueries({ queryKey: ['employees'] });
      qc.invalidateQueries({ queryKey: ['employees', emp.id] });
      onClose();
    } catch (e: any) { setError(e.message ?? 'Failed to update employee'); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={`Edit — ${emp.first_name} ${emp.last_name}`} onClose={onClose} wide>
      {error && <Alert type="error" message={error} />}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <FormField label="First Name">
          <input style={inputStyle} value={form.firstName} onChange={e => set('firstName', e.target.value)} />
        </FormField>
        <FormField label="Last Name">
          <input style={inputStyle} value={form.lastName} onChange={e => set('lastName', e.target.value)} />
        </FormField>
        <FormField label="Department">
          <select style={selectStyle} value={form.departmentId} onChange={e => set('departmentId', e.target.value)}>
            <option value="">Select department...</option>
            {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </FormField>
        <FormField label="Line Manager (Reports To)">
          <select style={selectStyle} value={form.managerId} onChange={e => set('managerId', e.target.value)}>
            <option value="">No manager</option>
            {(allEmployees?.items ?? []).filter((e: any) => e.id !== emp.id).map((e: any) => (
              <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Employment Type">
          <select style={selectStyle} value={form.employmentType} onChange={e => set('employmentType', e.target.value)}>
            <option value="full_time">Full Time</option>
            <option value="part_time">Part Time</option>
            <option value="contractor">Contractor</option>
            <option value="intern">Intern</option>
            <option value="casual">Casual</option>
          </select>
        </FormField>
        <FormField label="Work Location">
          <select style={selectStyle} value={form.locationType} onChange={e => set('locationType', e.target.value)}>
            <option value="office">Office</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </FormField>
        <FormField label="Reason for Change" required>
          <select style={selectStyle} value={form.changeReason} onChange={e => set('changeReason', e.target.value)}>
            <option value="correction">Correction</option>
            <option value="promotion">Promotion</option>
            <option value="transfer">Transfer</option>
            <option value="annual_review">Annual Review</option>
            <option value="other">Other</option>
          </select>
        </FormField>
      </div>
      <div style={{ display:'flex', gap:10, marginTop:24, justifyContent:'flex-end' }}>
        <GBtn onClick={onClose}>Cancel</GBtn>
        <PBtn onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</PBtn>
      </div>
    </Modal>
  );
}

// ── SetLeaveBalanceForm ───────────────────────────────────────────────────────
function SetLeaveBalanceForm({ employeeId, onAdded }: { employeeId: string; onAdded: () => void }) {
  const { data: leaveTypes } = useLeaveTypes();
  const [open, setOpen]       = useState(false);
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState('');
  const year = new Date().getFullYear();
  const [form, setForm] = useState({ leaveTypeId:'', entitlement:'25', adjustment:'0', note:'' });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  if (!open) return (
    <button onClick={() => setOpen(true)} style={{ background:C.secondary+'22', color:C.secondary, border:`1px solid ${C.secondary}33`, borderRadius:8, padding:'6px 14px', fontSize:12, fontWeight:700, cursor:'pointer' }}>
      🏖 Set Leave Balance
    </button>
  );

  const handleSave = async () => {
    if (!form.leaveTypeId) { setErr('Select a leave type'); return; }
    setSaving(true); setErr('');
    try {
      const token = localStorage.getItem('xs_token') ?? '';
      const res = await fetch(`\${API_URL}/api/leave/balances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ employeeId, leaveTypeId: form.leaveTypeId, year, entitlement: Number(form.entitlement), adjustment: Number(form.adjustment), adjustmentNote: form.note }),
      });
      const data = await res.json() as any;
      if (!data.ok) throw new Error(data.error ?? 'Failed');
      setOpen(false); onAdded();
    } catch (e: any) { setErr(e.message ?? 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ background:C.surface, borderRadius:10, padding:14, border:`1px solid ${C.border}`, marginBottom:10 }}>
      <div style={{ fontSize:12, fontWeight:700, color:C.text, marginBottom:10 }}>Set Leave Balance for {year}</div>
      {err && <div style={{ color:C.danger, fontSize:11, marginBottom:8 }}>{err}</div>}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
        <FormField label="Leave Type" required>
          <select style={selectStyle} value={form.leaveTypeId} onChange={e => set('leaveTypeId', e.target.value)}>
            <option value="">Select...</option>
            {(leaveTypes ?? []).map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </FormField>
        <FormField label="Entitlement (days)">
          <input style={inputStyle} type="number" value={form.entitlement} onChange={e => set('entitlement', e.target.value)} />
        </FormField>
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <button onClick={() => setOpen(false)} style={{ background:'transparent', color:C.muted, border:`1px solid ${C.border}`, borderRadius:8, padding:'6px 12px', fontSize:12, cursor:'pointer' }}>Cancel</button>
        <button onClick={handleSave} disabled={saving} style={{ background:C.secondary, color:'#fff', border:'none', borderRadius:8, padding:'6px 14px', fontSize:12, fontWeight:700, cursor:'pointer' }}>
          {saving ? 'Saving...' : 'Save Balance'}
        </button>
      </div>
    </div>
  );
}

// ── AddEmergencyContactForm ───────────────────────────────────────────────────
function AddEmergencyContactForm({ employeeId, onAdded }: { employeeId: string; onAdded: () => void }) {
  const create = useCreateEmergencyContact(employeeId);
  const qc = useQueryClient();
  const [open, setOpen]     = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');
  const [form, setForm]     = useState({ name:'', relationship:'', phone:'', email:'', is_primary: false });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  if (!open) return (
    <button onClick={() => setOpen(true)} style={{ marginTop:14, background:C.primary+'22', color:C.primary, border:`1px solid ${C.primary}33`, borderRadius:8, padding:'6px 14px', fontSize:12, fontWeight:700, cursor:'pointer' }}>
      + Add Contact
    </button>
  );

  const handleSave = async () => {
    if (!form.name || !form.phone || !form.relationship) { setErr('Name, phone and relationship required'); return; }
    setSaving(true); setErr('');
    try {
      await create.mutateAsync(form);
      qc.invalidateQueries({ queryKey: ['employees', employeeId, 'emergency'] });
      setForm({ name:'', relationship:'', phone:'', email:'', is_primary: false });
      setOpen(false); onAdded();
    } catch (e: any) { setErr(e.message ?? 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ marginTop:14, background:C.surface, borderRadius:10, padding:14, border:`1px solid ${C.border}` }}>
      <div style={{ fontSize:12, fontWeight:700, color:C.text, marginBottom:10 }}>New Emergency Contact</div>
      {err && <div style={{ color:C.danger, fontSize:11, marginBottom:8 }}>{err}</div>}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
        <FormField label="Full Name" required><input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Jane Smith" /></FormField>
        <FormField label="Relationship" required>
          <select style={selectStyle} value={form.relationship} onChange={e => set('relationship', e.target.value)}>
            <option value="">Select...</option>
            {['Spouse','Partner','Parent','Sibling','Child','Friend','Other'].map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </FormField>
        <FormField label="Phone" required><input style={inputStyle} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+44 7700 000000" /></FormField>
        <FormField label="Email"><input style={inputStyle} type="email" value={form.email} onChange={e => set('email', e.target.value)} /></FormField>
      </div>
      <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:C.muted, marginBottom:10, cursor:'pointer' }}>
        <input type="checkbox" checked={form.is_primary} onChange={e => set('is_primary', e.target.checked)} /> Primary contact
      </label>
      <div style={{ display:'flex', gap:8 }}>
        <button onClick={() => { setOpen(false); setErr(''); }} style={{ background:'transparent', color:C.muted, border:`1px solid ${C.border}`, borderRadius:8, padding:'6px 12px', fontSize:12, cursor:'pointer' }}>Cancel</button>
        <button onClick={handleSave} disabled={saving} style={{ background:C.primary, color:'#fff', border:'none', borderRadius:8, padding:'6px 14px', fontSize:12, fontWeight:700, cursor:'pointer' }}>
          {saving ? 'Saving...' : 'Save Contact'}
        </button>
      </div>
    </div>
  );
}

// ── AddCompensationForm ───────────────────────────────────────────────────────
function AddCompensationForm({ employeeId, onAdded }: { employeeId: string; onAdded: () => void }) {
  const create = useCreateCompensation(employeeId);
  const qc = useQueryClient();
  const [open, setOpen]     = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({ salary:'', currency:'GBP', payFrequency:'annual', payType:'salary', changeReason:'', effectiveFrom: today });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  if (!open) return (
    <button onClick={() => setOpen(true)} style={{ marginTop:14, background:C.primary+'22', color:C.primary, border:`1px solid ${C.primary}33`, borderRadius:8, padding:'6px 14px', fontSize:12, fontWeight:700, cursor:'pointer' }}>
      + Add Pay Record
    </button>
  );

  const handleSave = async () => {
    if (!form.salary || !form.effectiveFrom) { setErr('Salary and effective date required'); return; }
    setSaving(true); setErr('');
    try {
      await create.mutateAsync({ ...form, salary: Number(form.salary) });
      qc.invalidateQueries({ queryKey: ['employees', employeeId, 'compensation'] });
      setOpen(false); onAdded();
    } catch (e: any) { setErr(e.message ?? 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ marginTop:14, background:C.surface, borderRadius:10, padding:14, border:`1px solid ${C.border}` }}>
      <div style={{ fontSize:12, fontWeight:700, color:C.text, marginBottom:10 }}>New Pay Record</div>
      {err && <div style={{ color:C.danger, fontSize:11, marginBottom:8 }}>{err}</div>}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
        <FormField label="Salary / Rate" required>
          <div style={{ display:'flex', gap:6 }}>
            <select style={{ ...selectStyle, width:80 }} value={form.currency} onChange={e => set('currency', e.target.value)}>
              {['GBP','EUR','USD'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input style={{ ...inputStyle, flex:1 }} type="number" value={form.salary} onChange={e => set('salary', e.target.value)} placeholder="45000" />
          </div>
        </FormField>
        <FormField label="Frequency">
          <select style={selectStyle} value={form.payFrequency} onChange={e => set('payFrequency', e.target.value)}>
            {['annual','monthly','weekly','daily','hourly'].map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </FormField>
        <FormField label="Pay Type">
          <select style={selectStyle} value={form.payType} onChange={e => set('payType', e.target.value)}>
            {['salary','hourly','commission','contract'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </FormField>
        <FormField label="Effective From" required>
          <input style={inputStyle} type="date" value={form.effectiveFrom} onChange={e => set('effectiveFrom', e.target.value)} />
        </FormField>
        <div style={{ gridColumn:'1/-1' }}>
          <FormField label="Reason">
            <select style={selectStyle} value={form.changeReason} onChange={e => set('changeReason', e.target.value)}>
              <option value="">Select...</option>
              {['new_hire','promotion','annual_review','market_adjustment','role_change','other'].map(r => <option key={r} value={r}>{r.replace(/_/g,' ')}</option>)}
            </select>
          </FormField>
        </div>
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <button onClick={() => { setOpen(false); setErr(''); }} style={{ background:'transparent', color:C.muted, border:`1px solid ${C.border}`, borderRadius:8, padding:'6px 12px', fontSize:12, cursor:'pointer' }}>Cancel</button>
        <button onClick={handleSave} disabled={saving} style={{ background:C.success, color:'#fff', border:'none', borderRadius:8, padding:'6px 14px', fontSize:12, fontWeight:700, cursor:'pointer' }}>
          {saving ? 'Saving...' : 'Save Pay Record'}
        </button>
      </div>
    </div>
  );
}

// ── Role Assignment ────────────────────────────────────────────────────────────
// Lives on the employee profile, gated on hr:manage:roles (super_admin gets it
// via the wildcard, hr_admin gets it via the existing bulk hr-module grant).
// Lets an admin grant/revoke any of the system roles (manager, employee,
// hr_admin, compliance_officer, finance_admin, super_admin) without ever
// needing direct database access.
function RoleAssignmentSection({ employeeId }: { employeeId: string }) {
  const { data: rolesData }     = useRoles();
  const { data: assignedData, refetch } = useEmployeeRoles(employeeId);
  const grantRole  = useGrantRole(employeeId);
  const revokeRole = useRevokeRole(employeeId);
  const [selectedRole, setSelectedRole] = useState('');
  const [err, setErr] = useState('');

  const allRoles      = rolesData?.roles ?? [];
  const assignedRoles = assignedData?.roles ?? [];
  const assignedIds   = new Set(assignedRoles.map(r => r.role_id));
  const availableToGrant = allRoles.filter(r => !assignedIds.has(r.id));

  async function handleGrant() {
    if (!selectedRole) return;
    setErr('');
    try {
      await grantRole.mutateAsync({ roleId: selectedRole });
      setSelectedRole('');
      refetch();
    } catch (e: any) {
      setErr(e.message ?? 'Failed to grant role');
    }
  }

  async function handleRevoke(roleId: string, roleName: string) {
    if (!window.confirm(`Remove the "${roleName}" role from this employee?`)) return;
    setErr('');
    try {
      await revokeRole.mutateAsync(roleId);
      refetch();
    } catch (e: any) {
      setErr(e.message ?? 'Failed to revoke role');
    }
  }

  return (
    <div>
      {err && <div style={{ color: C.danger, fontSize: 11, marginBottom: 8 }}>{err}</div>}

      {assignedRoles.length === 0 && (
        <div style={{ color: C.dim, fontSize: 13, padding: '20px 0', textAlign: 'center' }}>
          No roles assigned yet
        </div>
      )}

      {assignedRoles.map(r => (
        <div key={r.assignment_id} style={{ padding: '12px 0', borderBottom: `1px solid ${C.border}33`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontWeight: 700, color: C.text, fontSize: 13, textTransform: 'capitalize' }}>
              {r.name.replace(/_/g, ' ')}
            </span>
            {r.description && <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{r.description}</div>}
          </div>
          <button
            onClick={() => handleRevoke(r.role_id, r.name)}
            disabled={revokeRole.isPending}
            style={{ background: 'transparent', color: C.danger, border: `1px solid ${C.danger}44`, borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
          >
            Remove
          </button>
        </div>
      ))}

      {availableToGrant.length > 0 && (
        <div style={{ marginTop: 14, background: C.surface, borderRadius: 10, padding: 14, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 10 }}>Grant a Role</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <select style={{ ...selectStyle, flex: 1 }} value={selectedRole} onChange={e => setSelectedRole(e.target.value)}>
              <option value="">Select a role...</option>
              {availableToGrant.map(r => (
                <option key={r.id} value={r.id}>{r.name.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <button
              onClick={handleGrant}
              disabled={!selectedRole || grantRole.isPending}
              style={{ background: C.success, color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              {grantRole.isPending ? 'Granting...' : 'Grant'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Employee Detail Modal ─────────────────────────────────────────────────────
function EmployeeModal({ id, onClose, departments }: { id: string; onClose: () => void; departments: any[] }) {
  const { data: emp, isLoading, refetch } = useEmployee(id);
  const { data: history } = useEmployeeHistory(id);
  const { data: emergency } = useEmergencyContacts(id);
  const { data: compensation } = useCompensation(id);
  const { setModule } = useAppStore();
  const { can } = usePermission();
  const [tab, setTab]     = useState<'profile'|'history'|'emergency'|'compensation'|'roles'>('profile');
  const [showEdit, setShowEdit] = useState(false);

  if (isLoading) return <Modal title="Employee" onClose={onClose}><Loading /></Modal>;
  if (!emp) return null;
  const fullName = `${emp.first_name} ${emp.last_name}`;

  return (
    <>
      <Modal title={fullName} onClose={onClose}>
        <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:20 }}>
          <div style={{ position:'relative', display:'inline-block' }}>
            <Avatar name={fullName} size={52} />
            <label title="Upload photo" style={{ position:'absolute', bottom:-2, right:-2, background:C.primary, color:'#fff', borderRadius:'50%', width:18, height:18, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, cursor:'pointer', boxShadow:'0 2px 4px #0004' }}>
              ✎<input type="file" accept="image/jpeg,image/png,image/webp" style={{ display:'none' }} onChange={async (e: any) => {
                const file = e.target.files?.[0]; if (!file) return;
                const token = localStorage.getItem('xs_token') ?? '';
                const fd = new FormData(); fd.append('file', file); fd.append('path', 'photo');
                const res = await fetch(`\${API_URL}/api/storage/upload`, { method:'POST', headers:{ Authorization:`Bearer ${token}` }, body:fd });
                const data = await res.json() as any;
                if (data.ok) {
                  await fetch(`/api/employees/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`}, body:JSON.stringify({ photoUrl:data.data.url }) });
                  refetch();
                }
              }} />
            </label>
          </div>
          <div>
            <div style={{ fontWeight:800, color:C.text, fontSize:18 }}>{fullName}</div>
            <div style={{ color:C.muted, fontSize:13 }}>{emp.designation_title ?? '—'} · {emp.department_name ?? '—'}</div>
          </div>
        </div>

        <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' }}>
          {([...(['profile','history','emergency','compensation'] as const), ...(can(PERMISSIONS.HR_MANAGE_ROLES) ? ['roles' as const] : [])]).map(t => (
            <button key={t} onClick={() => setTab(t as any)} style={{ background: tab===t ? C.primary : C.elevated, color: tab===t ? '#fff' : C.muted, border:`1px solid ${tab===t ? C.primary : C.border}`, borderRadius:8, padding:'5px 12px', fontSize:11, fontWeight:700, cursor:'pointer', textTransform:'capitalize' }}>
              {t === 'emergency' ? '🆘 Emergency' : t === 'compensation' ? '💷 Pay' : t === 'roles' ? '🔑 Roles' : t.charAt(0).toUpperCase()+t.slice(1)}
            </button>
          ))}
        </div>


        {tab === 'profile' && (
          <>
            <div style={{ marginBottom:14 }}><SetLeaveBalanceForm employeeId={id} onAdded={refetch} /></div>
            <InfoRow label="Email"           value={emp.email} />
            <InfoRow label="Employee #"      value={emp.employee_number} />
            <InfoRow label="Status"          value={<StatusBadge status={emp.status} />} />
            <InfoRow label="Employment Type" value={emp.employment_type?.replace(/_/g,' ')} />
            <InfoRow label="Location"        value={emp.work_location_type?.replace(/_/g,' ')} />
            <InfoRow label="Start Date"      value={fmtDate(emp.start_date)} />
            <InfoRow label="Department"      value={emp.department_name ?? '—'} />
            <InfoRow label="Line Manager"    value={emp.manager_name ?? '—'} />
            <div style={{ marginTop:16, display:'flex', gap:8, flexWrap:'wrap' }}>
              <PermissionGate permission={PERMISSIONS.HR_EDIT}>
                <AccentBtn onClick={() => setShowEdit(true)}>✏️ Edit</AccentBtn>
              </PermissionGate>
              <GBtn onClick={() => { onClose(); setModule('leave'); }}>🌴 Leave</GBtn>
              <GBtn onClick={() => { onClose(); setModule('timesheets'); }}>⏱ Timesheets</GBtn>
              <PermissionGate permission={PERMISSIONS.HR_MANAGE}>
                <DBtn onClick={() => {
                  if (window.confirm(`Offboard ${fullName}?`)) alert('Offboarding workflow — coming soon');
                }}>Offboard</DBtn>
              </PermissionGate>
            </div>
          </>
        )}

        {tab === 'history' && (
          <div>
            {(!history || history.length === 0) && <div style={{ color:C.dim, fontSize:13, padding:'20px 0', textAlign:'center' }}>No history recorded yet</div>}
            {history?.map(h => (
              <div key={h.id} style={{ padding:'12px 0', borderBottom:`1px solid ${C.border}33` }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:12, fontWeight:700, color:C.primary, textTransform:'capitalize' }}>{h.change_reason?.replace(/_/g,' ') ?? 'Update'}</span>
                  <span style={{ fontSize:11, color:C.dim }}>{fmtDate(h.effective_from)}</span>
                </div>
                <div style={{ fontSize:11, color:C.muted }}>{h.first_name} {h.last_name}</div>
                {h.changed_by_email && <div style={{ fontSize:10, color:C.dim, marginTop:2 }}>by {h.changed_by_email}</div>}
              </div>
            ))}
          </div>
        )}

        {tab === 'emergency' && (
          <div>
            {(!emergency || emergency.length === 0) && (
              <div style={{ color:C.dim, fontSize:13, padding:'20px 0', textAlign:'center' }}>No emergency contacts added yet</div>
            )}
            {(emergency ?? []).map((ec: EmergencyContact) => (
              <div key={ec.id} style={{ padding:'12px 0', borderBottom:`1px solid ${C.border}33` }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontWeight:700, color:C.text, fontSize:13 }}>{ec.name}</span>
                  {ec.is_primary===1 && <span style={{ background:C.primary+'22', color:C.primary, borderRadius:4, fontSize:9, padding:'1px 6px', fontWeight:700 }}>PRIMARY</span>}
                </div>
                <div style={{ fontSize:12, color:C.muted }}>{ec.relationship} · {ec.phone}</div>
                {ec.email && <div style={{ fontSize:11, color:C.dim }}>{ec.email}</div>}
              </div>
            ))}
            <AddEmergencyContactForm employeeId={id} onAdded={refetch} />
          </div>
        )}

        {tab === 'compensation' && (
          <div>
            {(!compensation || compensation.length === 0) && (
              <div style={{ color:C.dim, fontSize:13, padding:'20px 0', textAlign:'center' }}>No compensation records yet</div>
            )}
            {(compensation ?? []).map((c: CompensationRecord, i: number) => (
              <div key={c.id} style={{ padding:'12px 0', borderBottom:`1px solid ${C.border}33` }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontWeight:800, color:C.text, fontSize:15 }}>
                    {c.currency} {Number(c.salary).toLocaleString()}
                    <span style={{ fontSize:11, color:C.dim, fontWeight:400, marginLeft:4 }}>/ {c.pay_frequency}</span>
                  </span>
                  {i === 0 && <span style={{ background:C.success+'22', color:C.success, borderRadius:4, fontSize:9, padding:'1px 6px', fontWeight:700 }}>CURRENT</span>}
                </div>
                <div style={{ fontSize:12, color:C.muted }}>
                  From {fmtDate(c.effective_from)}
                  {c.change_reason && ` · ${c.change_reason.replace(/_/g,' ')}`}
                  {c.change_pct !== null && c.change_pct !== undefined && (
                    <span style={{ color: c.change_pct > 0 ? C.success : C.danger, fontWeight:700, marginLeft:6 }}>
                      {c.change_pct > 0 ? '▲' : '▼'} {Math.abs(c.change_pct)}%
                    </span>
                  )}
                </div>
              </div>
            ))}
            <AddCompensationForm employeeId={id} onAdded={refetch} />
          </div>
        )}

        {tab === 'roles' && can(PERMISSIONS.HR_MANAGE_ROLES) && (
          <RoleAssignmentSection employeeId={id} />
        )}
      </Modal>

      {showEdit && <EditEmployeeModal emp={emp} departments={departments} onClose={() => { setShowEdit(false); refetch(); }} />}
    </>
  );
}

// ── Main HR Module ────────────────────────────────────────────────────────────
export default function HRModule() {
  const [search, setSearch]         = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAdd, setShowAdd]       = useState(false);
  const { can } = usePermission();

  const params: Record<string,string> = {};
  if (search)     params.search       = search;
  if (deptFilter) params.departmentId = deptFilter;

  const { data: employees, isLoading, refetch } = useEmployees(params);
  const { data: departments = [] }              = useDepartments();
  const items   = employees?.items ?? [];
  const active  = items.filter(e => e.status === 'active').length;
  const onLeave = items.filter(e => e.status === 'on_leave').length;

  return (
    <div className="animate-fadeIn">
      <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h2 style={{ color:C.text, fontSize:20, fontWeight:800, margin:0 }}>HR Management</h2>
          <p style={{ color:C.muted, fontSize:12, margin:'4px 0 0' }}>{items.length} employees</p>
        </div>
        {/* Add Employee — only shown with create permission */}
        <PermissionGate permission={PERMISSIONS.HR_CREATE}>
          <button onClick={() => setShowAdd(true)} style={{ background:C.primary, color:'#fff', border:'none', borderRadius:8, padding:'8px 18px', fontSize:13, fontWeight:700, cursor:'pointer' }}>
            + Add Employee
          </button>
        </PermissionGate>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px,1fr))', gap:12, marginBottom:24 }}>
        <MetricCard label="Active"      value={active}             icon="✅" color={`linear-gradient(135deg,${C.success},${C.secondary})`} />
        <MetricCard label="On Leave"    value={onLeave}            icon="🌴" color={`linear-gradient(135deg,${C.sky},${C.primary})`} />
        <MetricCard label="Departments" value={departments.length} icon="🏢" color={`linear-gradient(135deg,${C.primary},#8B5CF6)`} />
        <MetricCard label="Total"       value={items.length}       icon="👥" color={`linear-gradient(135deg,#8B5CF6,${C.primary})`} />
      </div>

      <Card>
        <div style={{ display:'flex', gap:10, marginBottom:16 }}>
          <div style={{ flex:1 }}>
            <SearchBar value={search} onChange={setSearch} placeholder="Search name, email, role..." />
          </div>
          <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} style={{ background:C.elevated, border:`1px solid ${C.border}`, borderRadius:10, padding:'8px 12px', color:C.text, fontSize:13, outline:'none', cursor:'pointer' }}>
            <option value="">All departments</option>
            {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        {isLoading ? <Loading /> : (
          <DataTable
            cols={[
              { key:'first_name', label:'Employee', render:(_: any, r: any) => (
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <Avatar name={`${r.first_name} ${r.last_name}`} />
                  <div>
                    <div style={{ fontWeight:700, fontSize:13 }}>{r.first_name} {r.last_name}</div>
                    <div style={{ fontSize:11, color:C.muted }}>{r.email}</div>
                  </div>
                </div>
              )},
              { key:'department_name',    label:'Department', muted:true },
              { key:'designation_title',  label:'Role',       muted:true },
              { key:'employment_type',    label:'Type',       render:v => v?.replace(/_/g,' '), muted:true },
              { key:'work_location_type', label:'Location',   render:v => v?.replace(/_/g,' '), muted:true },
              { key:'status',             label:'Status',     render:v => <StatusBadge status={v} /> },
            ]}
            rows={items}
            onRow={(r: any) => setSelectedId(r.id)}
            emptyText="No employees yet — add your first one"
          />
        )}
      </Card>

      {showAdd && <AddEmployeeModal onClose={() => { setShowAdd(false); refetch(); }} departments={departments} />}
      {selectedId && <EmployeeModal id={selectedId} departments={departments} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

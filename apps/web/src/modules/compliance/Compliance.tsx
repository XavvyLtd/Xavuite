import { useState } from 'react';
import { useCompliance, useCreateRTW, useEmployees, type RTWCheck } from '../../hooks/api';
import { Card, DataTable, Modal, InfoRow, MetricCard, MetricGrid, Tabs, StatusBadge, Avatar, Loading, Alert, FormField, inputStyle, selectStyle, C, fmtDate, ColDef } from '../../components/ui';
import { useQueryClient } from '@tanstack/react-query';

function AddRTWModal({ onClose }: { onClose:()=>void }) {
  const create = useCreateRTW();
  const { data:employees } = useEmployees();
  const qc = useQueryClient();
  const [errMsg, setErrMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ employeeId:'', checkType:'manual', docType:'', docReference:'', checkDate:new Date().toISOString().split('T')[0], expiryDate:'' });
  const set = (k:string,v:string) => setForm(f=>({...f,[k]:v}));
  const handleSave = async () => {
    if (!form.employeeId||!form.docType) { setErrMsg('Employee and document type are required'); return; }
    setSaving(true); setErrMsg('');
    try { await create.mutateAsync(form); qc.invalidateQueries({queryKey:['compliance']}); onClose(); }
    catch(e:any) { setErrMsg(e.message??'Failed'); } finally { setSaving(false); }
  };
  return (
    <Modal title="Add RTW / Compliance Check" onClose={onClose} wide>
      {errMsg && <Alert type="error" message={errMsg} />}
      <FormField label="Employee" required>
        <select style={selectStyle} value={form.employeeId} onChange={e=>set('employeeId',e.target.value)}>
          <option value="">Select employee...</option>
          {(employees?.items??[]).map(e=><option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
        </select>
      </FormField>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <FormField label="Document Type" required>
          <select style={selectStyle} value={form.docType} onChange={e=>set('docType',e.target.value)}>
            <option value="">Select...</option>
            <option>Passport</option><option>BRP Card</option><option>National ID</option>
            <option>Work Visa</option><option>Right to Work Share Code</option><option>DBS Check</option>
          </select>
        </FormField>
        <FormField label="Check Type">
          <select style={selectStyle} value={form.checkType} onChange={e=>set('checkType',e.target.value)}>
            <option value="manual">Manual</option><option value="share_code">Share Code</option>
          </select>
        </FormField>
        <FormField label="Check Date" required><input style={inputStyle} type="date" value={form.checkDate} onChange={e=>set('checkDate',e.target.value)} /></FormField>
        <FormField label="Expiry Date"><input style={inputStyle} type="date" value={form.expiryDate} onChange={e=>set('expiryDate',e.target.value)} /></FormField>
      </div>
      <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:24}}>
        <button onClick={onClose} style={{background:'transparent',color:C.muted,border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:600,cursor:'pointer'}}>Cancel</button>
        <button onClick={handleSave} disabled={saving} style={{background:C.primary,color:'#fff',border:'none',borderRadius:8,padding:'8px 18px',fontSize:13,fontWeight:700,cursor:'pointer'}}>{saving?'Saving...':'Add Check'}</button>
      </div>
    </Modal>
  );
}

export function ComplianceModule() {
  const [tab, setTab] = useState('all');
  const [selected, setSelected] = useState<RTWCheck|null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const params = tab==='expired'?{status:'expired'}:tab==='expiring'?{status:'expiring'}:{};
  const { data:checks, isLoading, refetch } = useCompliance(params);
  const items = checks??[];
  const expired  = items.filter(c=>c.status==='expired');
  const expiring = items.filter(c=>c.status==='expiring soon');

  const cols: ColDef<RTWCheck>[] = [
    { key:'employee_name', label:'Employee', render:v=><div style={{display:'flex',alignItems:'center',gap:8}}><Avatar name={v} size={28}/><span style={{fontWeight:600}}>{v}</span></div> },
    { key:'doc_type',   label:'Document' },
    { key:'check_date', label:'Checked', render:v=>fmtDate(v), muted:true },
    { key:'expiry_date',label:'Expires', render:v=>{
      if (!v) return <span style={{color:C.dim}}>No expiry</span>;
      const isExp = new Date(v)<new Date();
      const isSoon = !isExp && new Date(v)<new Date(Date.now()+90*86400000);
      return <span style={{color:isExp?C.danger:isSoon?C.warning:C.text,fontWeight:isExp||isSoon?700:400}}>{fmtDate(v)}</span>;
    }},
    { key:'status', label:'Status', render:v=><StatusBadge status={v} /> },
  ];

  return (
    <div className="animate-fadeIn">
      <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',marginBottom:20}}>
        <div><h2 style={{color:C.text,fontSize:20,fontWeight:800,margin:0}}>Compliance & Right to Work</h2>
        <p style={{color:C.muted,fontSize:12,margin:'4px 0 0'}}>RTW checks, visa tracking and compliance status</p></div>
        <button onClick={()=>setShowAdd(true)} style={{background:C.primary,color:'#fff',border:'none',borderRadius:8,padding:'8px 18px',fontSize:13,fontWeight:700,cursor:'pointer'}}>+ Add Check</button>
      </div>
      {expired.length>0  && <Alert type="error"   message={`${expired.length} compliance item${expired.length>1?'s':''} expired — immediate action required`} />}
      {expiring.length>0 && !expired.length && <Alert type="warning" message={`${expiring.length} item${expiring.length>1?'s':''} expiring within 90 days`} />}
      <MetricGrid>
        <MetricCard label="Valid"         value={items.filter(c=>c.status==='valid').length}    icon="✅" color={`linear-gradient(135deg,${C.success},${C.secondary})`} />
        <MetricCard label="Expiring Soon" value={expiring.length} icon="⚠️" color={`linear-gradient(135deg,${C.warning},${C.danger})`} />
        <MetricCard label="Expired"       value={expired.length}  icon="❌" color={`linear-gradient(135deg,${C.danger},#7F1D1D)`} />
        <MetricCard label="Total"         value={items.length}    icon="📋" color={`linear-gradient(135deg,${C.primary},#8B5CF6)`} />
      </MetricGrid>
      <Tabs tabs={[{key:'all',label:'All'},{key:'expiring',label:`Expiring (${expiring.length})`},{key:'expired',label:`Expired (${expired.length})`}]} active={tab} onChange={setTab} />
      <Card>{isLoading?<Loading />:<DataTable cols={cols} rows={items} onRow={setSelected} emptyText="No compliance records" />}</Card>
      {showAdd && <AddRTWModal onClose={()=>{setShowAdd(false);refetch();}} />}
      {selected && (
        <Modal title="Compliance Record" onClose={()=>setSelected(null)}>
          <InfoRow label="Employee" value={selected.employee_name} />
          <InfoRow label="Document" value={selected.doc_type} />
          <InfoRow label="Status"   value={<StatusBadge status={selected.status} />} />
          <InfoRow label="Checked"  value={fmtDate(selected.check_date)} />
          <InfoRow label="Expires"  value={selected.expiry_date?fmtDate(selected.expiry_date):'No expiry'} />
          <div style={{marginTop:16,display:'flex',gap:8}}>
            <button style={{background:C.elevated,color:C.muted,border:`1px solid ${C.border}`,borderRadius:8,padding:'5px 12px',fontSize:12,cursor:'pointer'}}>📎 Upload Doc</button>
            <button onClick={()=>setSelected(null)} style={{background:'transparent',color:C.muted,border:`1px solid ${C.border}`,borderRadius:8,padding:'5px 12px',fontSize:12,cursor:'pointer'}}>Close</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
export default ComplianceModule;

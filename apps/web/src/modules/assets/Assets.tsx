import { useState } from 'react';
import { useAssets, useCreateAsset, useAssignAsset, useEmployees, type Asset } from '../../hooks/api';
import { Card, DataTable, Modal, InfoRow, MetricCard, MetricGrid, StatusBadge, Avatar, Loading, Alert, FormField, inputStyle, selectStyle, C, fmtDate, ColDef } from '../../components/ui';
import { useQueryClient } from '@tanstack/react-query';

function AddAssetModal({ onClose }: { onClose:()=>void }) {
  const create = useCreateAsset();
  const { data: employees } = useEmployees();
  const qc = useQueryClient();
  const [errMsg, setErrMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name:'', category:'laptop', serialNumber:'', purchaseDate:'', purchaseValue:'', assignedToId:'', location:'', notes:'' });
  const set = (k:string,v:string) => setForm(f=>({...f,[k]:v}));
  const handleSave = async () => {
    if (!form.name.trim()) { setErrMsg('Asset name is required'); return; }
    setSaving(true); setErrMsg('');
    try {
      await create.mutateAsync({...form, purchaseValue:form.purchaseValue?Number(form.purchaseValue):undefined, assignedToId:form.assignedToId||undefined});
      qc.invalidateQueries({queryKey:['assets']}); onClose();
    } catch(e:any) { setErrMsg(e.message??'Failed'); } finally { setSaving(false); }
  };
  return (
    <Modal title="Register Asset" onClose={onClose} wide>
      {errMsg && <Alert type="error" message={errMsg} />}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <FormField label="Asset Name" required><input style={inputStyle} value={form.name} onChange={e=>set('name',e.target.value)} placeholder="MacBook Pro 16" /></FormField>
        <FormField label="Category">
          <select style={selectStyle} value={form.category} onChange={e=>set('category',e.target.value)}>
            <option value="laptop">💻 Laptop</option><option value="monitor">🖥️ Monitor</option>
            <option value="phone">📱 Phone</option><option value="tablet">📟 Tablet</option>
            <option value="peripheral">⌨️ Peripheral</option><option value="furniture">🪑 Furniture</option>
            <option value="vehicle">🚗 Vehicle</option><option value="other">📦 Other</option>
          </select>
        </FormField>
        <FormField label="Serial Number"><input style={inputStyle} value={form.serialNumber} onChange={e=>set('serialNumber',e.target.value)} /></FormField>
        <FormField label="Purchase Value (£)"><input style={inputStyle} type="number" value={form.purchaseValue} onChange={e=>set('purchaseValue',e.target.value)} /></FormField>
        <FormField label="Purchase Date"><input style={inputStyle} type="date" value={form.purchaseDate} onChange={e=>set('purchaseDate',e.target.value)} /></FormField>
        <FormField label="Assign To">
          <select style={selectStyle} value={form.assignedToId} onChange={e=>set('assignedToId',e.target.value)}>
            <option value="">Unassigned</option>
            {(employees?.items??[]).map(e=><option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
          </select>
        </FormField>
      </div>
      <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:24}}>
        <button onClick={onClose} style={{background:'transparent',color:C.muted,border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:600,cursor:'pointer'}}>Cancel</button>
        <button onClick={handleSave} disabled={saving} style={{background:C.primary,color:'#fff',border:'none',borderRadius:8,padding:'8px 18px',fontSize:13,fontWeight:700,cursor:'pointer'}}>{saving?'Saving...':'Register Asset'}</button>
      </div>
    </Modal>
  );
}

export function AssetsModule() {
  const [selected, setSelected] = useState<Asset|null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [assignTo, setAssignTo] = useState('');
  const { data:assets, isLoading, refetch } = useAssets();
  const { data:employees } = useEmployees();
  const assign = useAssignAsset(selected?.id??'');
  const qc = useQueryClient();
  const items = assets??[];

  const handleAssign = async () => {
    if (!assignTo||!selected) return;
    try { await assign.mutateAsync({employeeId:assignTo}); setShowAssign(false); setSelected(null); refetch(); } catch(e:any) { alert(e.message); }
  };

  const cols: ColDef<Asset>[] = [
    { key:'name',             label:'Asset',     render:v=><span style={{fontWeight:700}}>{v}</span> },
    { key:'category',         label:'Category',  muted:true },
    { key:'serial_number',    label:'Serial',    muted:true },
    { key:'assigned_to_name', label:'Assigned',  render:v=>v?<div style={{display:'flex',alignItems:'center',gap:6}}><Avatar name={v} size={22}/>{v}</div>:<span style={{color:C.dim}}>—</span> },
    { key:'purchase_value',   label:'Value',     render:v=>v?<span style={{color:C.secondary}}>£{Number(v).toLocaleString()}</span>:'—' },
    { key:'status',           label:'Status',    render:v=><StatusBadge status={v} /> },
  ];

  return (
    <div className="animate-fadeIn">
      <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',marginBottom:20}}>
        <div><h2 style={{color:C.text,fontSize:20,fontWeight:800,margin:0}}>Asset Management</h2>
        <p style={{color:C.muted,fontSize:12,margin:'4px 0 0'}}>Hardware register, assignments and lifecycle</p></div>
        <button onClick={()=>setShowAdd(true)} style={{background:C.primary,color:'#fff',border:'none',borderRadius:8,padding:'8px 18px',fontSize:13,fontWeight:700,cursor:'pointer'}}>+ Register Asset</button>
      </div>
      <MetricGrid>
        <MetricCard label="Total"     value={items.length}                                   icon="💻" color={`linear-gradient(135deg,${C.primary},#8B5CF6)`} />
        <MetricCard label="In Use"    value={items.filter(a=>a.status==='in_use').length}    icon="👤" color={`linear-gradient(135deg,${C.info},${C.primary})`} />
        <MetricCard label="Available" value={items.filter(a=>a.status==='available').length} icon="✅" color={`linear-gradient(135deg,${C.success},${C.secondary})`} />
        <MetricCard label="Value"     value={`£${items.reduce((a,x)=>a+(x.purchase_value??0),0).toLocaleString()}`} icon="💷" color={`linear-gradient(135deg,${C.warning},${C.danger})`} />
      </MetricGrid>
      <Card>{isLoading?<Loading />:<DataTable cols={cols} rows={items} onRow={setSelected} emptyText="No assets registered" />}</Card>
      {showAdd && <AddAssetModal onClose={()=>{setShowAdd(false);refetch();}} />}
      {selected && (
        <Modal title={selected.name} onClose={()=>setSelected(null)}>
          <InfoRow label="Category" value={selected.category} />
          <InfoRow label="Serial"   value={selected.serial_number??'—'} />
          <InfoRow label="Status"   value={<StatusBadge status={selected.status} />} />
          <InfoRow label="Assigned" value={selected.assigned_to_name??'Unassigned'} />
          <InfoRow label="Value"    value={selected.purchase_value?`£${Number(selected.purchase_value).toLocaleString()}`:'—'} />
          {showAssign ? (
            <div style={{marginTop:16}}>
              <FormField label="Assign To">
                <select style={selectStyle} value={assignTo} onChange={e=>setAssignTo(e.target.value)}>
                  <option value="">Select employee...</option>
                  {(employees?.items??[]).map(e=><option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
                </select>
              </FormField>
              <div style={{display:'flex',gap:8,marginTop:8}}>
                <button onClick={handleAssign} style={{background:C.primary,color:'#fff',border:'none',borderRadius:8,padding:'6px 14px',fontSize:12,fontWeight:700,cursor:'pointer'}}>Assign</button>
                <button onClick={()=>setShowAssign(false)} style={{background:'transparent',color:C.muted,border:`1px solid ${C.border}`,borderRadius:8,padding:'6px 14px',fontSize:12,cursor:'pointer'}}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{marginTop:16,display:'flex',gap:8}}>
              <button onClick={()=>setShowAssign(true)} style={{background:C.primary+'22',color:C.primary,border:`1px solid ${C.primary}33`,borderRadius:8,padding:'5px 12px',fontSize:12,fontWeight:700,cursor:'pointer'}}>Reassign</button>
              <button onClick={()=>setSelected(null)} style={{background:'transparent',color:C.muted,border:`1px solid ${C.border}`,borderRadius:8,padding:'5px 12px',fontSize:12,cursor:'pointer'}}>Close</button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
export default AssetsModule;

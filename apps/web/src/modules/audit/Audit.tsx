import { useState } from 'react';
import { useAuditLog, type AuditEvent } from '../../hooks/api';
import { Card, DataTable, Avatar, Loading, C, fmtDate, ColDef } from '../../components/ui';

const ACTION_COLORS: Record<string,string> = {
  create:C.success, update:C.warning, delete:C.danger, view:C.dim,
  approve:C.success, reject:C.danger, login:C.info, logout:C.muted,
  upload:C.secondary, download:'#A855F7',
};

export function AuditModule() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAuditLog(page);
  const items = data?.items??[], meta = data?.meta;

  const cols: ColDef<AuditEvent>[] = [
    { key:'user_email', label:'User', render:v=><div style={{display:'flex',alignItems:'center',gap:8}}><Avatar name={v} size={24}/><span style={{fontSize:12}}>{v??'System'}</span></div> },
    { key:'action',     label:'Action', render:v=><span style={{color:ACTION_COLORS[v]??C.muted,fontWeight:700,fontSize:11,textTransform:'uppercase',letterSpacing:'0.05em'}}>{v}</span> },
    { key:'resource',   label:'Resource', render:v=>v?.replace(/_/g,' '), muted:true },
    { key:'resource_id',label:'ID', render:v=><span style={{fontFamily:'monospace',fontSize:11,color:C.dim}}>{v?.slice(0,8)}…</span> },
    { key:'created_at', label:'When', render:v=>fmtDate(v), muted:true },
  ];

  return (
    <div className="animate-fadeIn">
      <div style={{marginBottom:20}}>
        <h2 style={{color:C.text,fontSize:20,fontWeight:800,margin:0}}>Audit Log</h2>
        <p style={{color:C.muted,fontSize:12,margin:'4px 0 0'}}>Immutable record of all platform events</p>
      </div>
      <Card>
        {isLoading ? <Loading /> : <DataTable cols={cols} rows={items} emptyText="No audit events" />}
        {meta && meta.pages>1 && (
          <div style={{display:'flex',justifyContent:'center',gap:8,marginTop:16,paddingTop:16,borderTop:`1px solid ${C.border}`}}>
            <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{background:C.elevated,color:C.muted,border:`1px solid ${C.border}`,borderRadius:8,padding:'6px 14px',fontSize:12,cursor:'pointer'}}>← Prev</button>
            <span style={{color:C.muted,fontSize:12,padding:'6px 10px'}}>Page {page} of {meta.pages}</span>
            <button onClick={()=>setPage(p=>Math.min(meta.pages,p+1))} disabled={page===meta.pages} style={{background:C.elevated,color:C.muted,border:`1px solid ${C.border}`,borderRadius:8,padding:'6px 14px',fontSize:12,cursor:'pointer'}}>Next →</button>
          </div>
        )}
      </Card>
    </div>
  );
}
export default AuditModule;

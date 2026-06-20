import { useState } from 'react';
const API_URL = import.meta.env.VITE_API_URL ?? 'https://api-v2.xavvy.uk';
import { useDocuments, useExpiringDocuments, uploadFile } from '../../hooks/api';
import { useAuth } from '../../context/AuthContext';
import { Card, Loading, Badge, Alert, FormField, selectStyle, inputStyle, C, fmtDate } from '../../components/ui';
import { useQueryClient } from '@tanstack/react-query';

function ExpiryBadge({ expiryDate }: { expiryDate?: string }) {
  if (!expiryDate) return null;
  const days = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400000);
  const color = days < 0 ? C.danger : days <= 14 ? C.danger : days <= 30 ? C.warning : C.success;
  const label = days < 0 ? 'Expired' : `${days}d left`;
  return <span style={{ background:color+'22', color, borderRadius:6, fontSize:9, padding:'2px 8px', fontWeight:700, border:`1px solid ${color}44` }}>{label}</span>;
}

function UploadModal({ onClose }: { onClose: () => void }) {
  const { accessToken } = useAuth();
  const qc = useQueryClient();
  const [file, setFile]         = useState<File | null>(null);
  const [name, setName]         = useState('');
  const [category, setCategory] = useState('general');
  const [expiryDate, setExpiry] = useState('');
  const [docType, setDocType]   = useState('');
  const [uploading, setUploading] = useState(false);
  const [err, setErr]           = useState('');

  const handleUpload = async () => {
    if (!file) { setErr('Select a file'); return; }
    setUploading(true); setErr('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', name || file.name);
      formData.append('category', category);
      if (expiryDate) formData.append('expiryDate', expiryDate);
      const res = await fetch(`\${API_URL}/api/documents`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      const data = await res.json() as any;
      if (!data.ok) throw new Error(data.error ?? 'Upload failed');
      qc.invalidateQueries({ queryKey: ['documents'] });
      onClose();
    } catch (e: any) { setErr(e.message ?? 'Upload failed'); }
    finally { setUploading(false); }
  };

  const overlay: React.CSSProperties = { position:'fixed', inset:0, background:'#00000088', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20 };
  const box: React.CSSProperties = { background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:24, width:'100%', maxWidth:480 };

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={box}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
          <span style={{ fontWeight:800, fontSize:16, color:C.text }}>Upload Document</span>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.dim, fontSize:18, cursor:'pointer' }}>×</button>
        </div>
        {err && <Alert type="error" message={err} />}
        <div style={{ border:`2px dashed ${C.border}`, borderRadius:10, padding:20, textAlign:'center', marginBottom:14, cursor:'pointer', background: file ? C.success+'11' : C.surface }}
          onClick={() => document.getElementById('doc-file-input')?.click()}>
          <input id="doc-file-input" type="file" style={{ display:'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); if (!name) setName(f.name.replace(/\.[^.]+$/, '')); }}} />
          <div style={{ fontSize:28, marginBottom:8 }}>{file ? '✅' : '📂'}</div>
          <div style={{ fontSize:13, color: file ? C.success : C.muted, fontWeight:600 }}>{file ? file.name : 'Click to select file'}</div>
          {file && <div style={{ fontSize:11, color:C.dim }}>{(file.size/1024/1024).toFixed(2)} MB</div>}
        </div>
        <FormField label="Name"><input style={inputStyle} value={name} onChange={e=>setName(e.target.value)} /></FormField>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <FormField label="Category">
            <select style={selectStyle} value={category} onChange={e=>setCategory(e.target.value)}>
              {['general','policy','contract','certificate','id','training','other'].map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </FormField>
          <FormField label="Expiry Date">
            <input style={inputStyle} type="date" value={expiryDate} onChange={e=>setExpiry(e.target.value)} />
          </FormField>
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:20 }}>
          <button onClick={onClose} style={{ background:'transparent', color:C.muted, border:`1px solid ${C.border}`, borderRadius:8, padding:'8px 16px', fontSize:13, cursor:'pointer' }}>Cancel</button>
          <button onClick={handleUpload} disabled={!file||uploading} style={{ background:uploading?C.primary+'99':C.primary, color:'#fff', border:'none', borderRadius:8, padding:'8px 18px', fontSize:13, fontWeight:700, cursor:'pointer' }}>
            {uploading ? 'Uploading...' : '⬆ Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function DocumentsModule() {
  const [tab, setTab]         = useState<'all'|'expiring'>('all');
  const [search, setSearch]   = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const { data:docs,     isLoading }  = useDocuments();
  const { data:expiring, isLoading:eL, error:expError } = useExpiringDocuments();

  const items = (docs ?? []).filter(d => !search || d.name.toLowerCase().includes(search.toLowerCase()));
  const expCount = (expiring ?? []).length;

  return (
    <div className="animate-fadeIn">
      <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h2 style={{color:C.text,fontSize:20,fontWeight:800,margin:0}}>Document Management</h2>
          <p style={{color:C.muted,fontSize:12,margin:'4px 0 0'}}>{docs?.length ?? 0} documents</p>
        </div>
        <button onClick={() => setShowUpload(true)} style={{background:C.primary,color:'#fff',border:'none',borderRadius:8,padding:'8px 18px',fontSize:13,fontWeight:700,cursor:'pointer'}}>+ Upload</button>
      </div>

      <div style={{ display:'flex', gap:6, marginBottom:16 }}>
        <button onClick={()=>setTab('all')} style={{background:tab==='all'?C.primary:C.elevated,color:tab==='all'?'#fff':C.muted,border:`1px solid ${tab==='all'?C.primary:C.border}`,borderRadius:8,padding:'7px 14px',fontSize:12,fontWeight:700,cursor:'pointer'}}>All Documents</button>
        <button onClick={()=>setTab('expiring')} style={{background:tab==='expiring'?C.warning:C.elevated,color:tab==='expiring'?'#fff':C.muted,border:`1px solid ${tab==='expiring'?C.warning:C.border}`,borderRadius:8,padding:'7px 14px',fontSize:12,fontWeight:700,cursor:'pointer'}}>
          ⚠️ Expiring {expCount > 0 && <span style={{background:'#fff4',borderRadius:10,padding:'0px 6px',marginLeft:4,fontSize:10,fontWeight:800}}>{expCount}</span>}
        </button>
      </div>

      {tab==='all' && (
        <>
          <div style={{marginBottom:14}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search documents..."
              style={{background:C.elevated,border:`1px solid ${C.border}`,borderRadius:10,padding:'9px 14px',color:C.text,fontSize:13,outline:'none',width:'100%',boxSizing:'border-box'}} />
          </div>
          {isLoading ? <Loading /> : (
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {items.map(doc=>(
                <Card key={doc.id}>
                  <div style={{display:'flex',alignItems:'center',gap:14}}>
                    <div style={{fontSize:28,flexShrink:0}}>📄</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,color:C.text,fontSize:13}}>{doc.name}</div>
                      <div style={{fontSize:11,color:C.muted,marginTop:2}}>
                        {doc.size_bytes ? `${(doc.size_bytes/1024/1024).toFixed(1)} MB · ` : ''}{fmtDate(doc.created_at)}
                      </div>
                    </div>
                    <div style={{display:'flex',gap:8,alignItems:'center',flexShrink:0}}>
                      <Badge color={C.sky}>{doc.category}</Badge>
                      <ExpiryBadge expiryDate={doc.expiry_date} />
                      <button style={{background:C.elevated,color:C.muted,border:`1px solid ${C.border}`,borderRadius:6,padding:'4px 10px',fontSize:11,fontWeight:600,cursor:'pointer'}}>⬇ Download</button>
                    </div>
                  </div>
                </Card>
              ))}
              {items.length===0 && <div style={{textAlign:'center',padding:'60px 20px',color:C.dim}}><div style={{fontSize:40,marginBottom:12}}>📂</div><div>{search?'No documents match':'No documents uploaded yet'}</div></div>}
            </div>
          )}
        </>
      )}

      {tab==='expiring' && (
        eL ? <Loading /> : expError ? (
          <div style={{textAlign:'center',padding:'40px',color:C.dim}}>
            <div style={{fontSize:32,marginBottom:8}}>⚙️</div>
            <div>Run migration 013_remaining_features.sql to enable expiry tracking</div>
          </div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {(expiring??[]).map((doc:any)=>{
              const days = Math.ceil((new Date(doc.expiry_date).getTime()-Date.now())/86400000);
              const color = days < 0 ? C.danger : days <= 14 ? C.danger : C.warning;
              return (
                <Card key={doc.id} style={{borderLeft:`4px solid ${color}`}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                    <div>
                      <div style={{fontWeight:700,color:C.text,fontSize:13}}>{doc.name}</div>
                      <div style={{fontSize:12,color:C.muted,marginTop:2}}>
                        {doc.employee_name && `${doc.employee_name} · `}{doc.doc_type ?? doc.category}
                      </div>
                    </div>
                    <div style={{textAlign:'right',flexShrink:0}}>
                      <div style={{fontSize:14,fontWeight:900,color}}>{days < 0 ? 'EXPIRED' : `${days} days`}</div>
                      <div style={{fontSize:11,color:C.dim}}>Expires {fmtDate(doc.expiry_date)}</div>
                    </div>
                  </div>
                </Card>
              );
            })}
            {(expiring??[]).length===0 && <div style={{textAlign:'center',padding:'60px 20px',color:C.dim}}><div style={{fontSize:40,marginBottom:12}}>✅</div><div>No documents expiring in the next 90 days</div></div>}
          </div>
        )
      )}

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} />}
    </div>
  );
}
export default DocumentsModule;

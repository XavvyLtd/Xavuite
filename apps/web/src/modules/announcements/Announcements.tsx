import { useState } from 'react';
import { useAnnouncements, useCreateAnnouncement } from '../../hooks/api';
import { Card, Modal, Alert, FormField, inputStyle, selectStyle, Badge, C, fmtDate } from '../../components/ui';
import { useQueryClient } from '@tanstack/react-query';

function AddAnnouncementModal({ onClose }: { onClose:()=>void }) {
  const create = useCreateAnnouncement();
  const qc = useQueryClient();
  const [errMsg, setErrMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title:'', body:'', priority:'medium', audience:'all_staff', pinned:false });
  const set = (k:string,v:any) => setForm(f=>({...f,[k]:v}));
  const handleSave = async () => {
    if (!form.title.trim()||!form.body.trim()) { setErrMsg('Title and body are required'); return; }
    setSaving(true); setErrMsg('');
    try { await create.mutateAsync(form); qc.invalidateQueries({queryKey:['announcements']}); onClose(); }
    catch(e:any) { setErrMsg(e.message??'Failed'); } finally { setSaving(false); }
  };
  return (
    <Modal title="New Announcement" onClose={onClose} wide>
      {errMsg && <Alert type="error" message={errMsg} />}
      <FormField label="Title" required><input style={inputStyle} value={form.title} onChange={e=>set('title',e.target.value)} placeholder="Q3 All-Hands — 15 July" /></FormField>
      <FormField label="Body" required><textarea style={{...inputStyle,height:120,resize:'vertical'}} value={form.body} onChange={e=>set('body',e.target.value)} /></FormField>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <FormField label="Priority">
          <select style={selectStyle} value={form.priority} onChange={e=>set('priority',e.target.value)}>
            <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
          </select>
        </FormField>
        <FormField label="Audience">
          <select style={selectStyle} value={form.audience} onChange={e=>set('audience',e.target.value)}>
            <option value="all_staff">All Staff</option><option value="managers">Managers</option>
          </select>
        </FormField>
      </div>
      <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13,color:C.muted,cursor:'pointer',marginTop:8}}>
        <input type="checkbox" checked={form.pinned} onChange={e=>set('pinned',e.target.checked)} /> 📌 Pin this announcement
      </label>
      <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:24}}>
        <button onClick={onClose} style={{background:'transparent',color:C.muted,border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:600,cursor:'pointer'}}>Cancel</button>
        <button onClick={handleSave} disabled={saving} style={{background:C.primary,color:'#fff',border:'none',borderRadius:8,padding:'8px 18px',fontSize:13,fontWeight:700,cursor:'pointer'}}>{saving?'Posting...':'Post Announcement'}</button>
      </div>
    </Modal>
  );
}

const P_COLORS: Record<string,string> = { high:C.danger, medium:C.warning, low:C.secondary };
const P_ICONS:  Record<string,string> = { high:'🚨', medium:'📢', low:'📌' };

export function AnnouncementsModule() {
  const [showAdd, setShowAdd] = useState(false);
  const { data:announcements, isLoading, refetch } = useAnnouncements();
  const items = announcements??[];

  return (
    <div className="animate-fadeIn">
      <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',marginBottom:20}}>
        <div><h2 style={{color:C.text,fontSize:20,fontWeight:800,margin:0}}>Announcements</h2>
        <p style={{color:C.muted,fontSize:12,margin:'4px 0 0'}}>Company-wide and targeted communications</p></div>
        <button onClick={()=>setShowAdd(true)} style={{background:C.primary,color:'#fff',border:'none',borderRadius:8,padding:'8px 18px',fontSize:13,fontWeight:700,cursor:'pointer'}}>+ New Announcement</button>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        {items.map(a=>(
          <Card key={a.id} style={{borderLeft:`4px solid ${P_COLORS[a.priority]??C.primary}`}}>
            {a.pinned===1 && <div style={{fontSize:10,color:C.primary,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:8}}>📌 Pinned</div>}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
              <div>
                <div style={{fontWeight:800,color:C.text,fontSize:15,marginBottom:6}}>{P_ICONS[a.priority]} {a.title}</div>
                <div style={{display:'flex',gap:8}}>
                  <Badge color={P_COLORS[a.priority]??C.primary}>{a.priority}</Badge>
                  <Badge color={C.info}>{a.audience}</Badge>
                </div>
              </div>
              <div style={{fontSize:11,color:C.dim,textAlign:'right',flexShrink:0,marginLeft:12}}>
                <div>{fmtDate(a.created_at)}</div>
                {a.author_name && <div style={{marginTop:3,color:C.muted}}>{a.author_name}</div>}
              </div>
            </div>
            <p style={{color:C.muted,fontSize:13,lineHeight:1.6,margin:0}}>{a.body}</p>
          </Card>
        ))}
        {items.length===0 && <div style={{textAlign:'center',padding:'60px 20px',color:C.dim}}><div style={{fontSize:40,marginBottom:12}}>📢</div><div>No announcements yet</div></div>}
      </div>
      {showAdd && <AddAnnouncementModal onClose={()=>{setShowAdd(false);refetch();}} />}
    </div>
  );
}
export default AnnouncementsModule;

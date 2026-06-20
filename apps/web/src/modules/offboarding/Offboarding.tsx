import { useState } from 'react';
import { useOffboardingList, useOffboardingDetail, useStartOffboarding, useEmployees, type OffboardingRecord } from '../../hooks/api';;
import { Card, Modal, MetricCard, MetricGrid, StatusBadge, Avatar, Loading, Alert, FormField, inputStyle, selectStyle, ProgressBar, C, fmtDate } from '../../components/ui';
import { useQueryClient } from '@tanstack/react-query';

const REASON_LABELS: Record<string,string> = { resignation:'Resignation', redundancy:'Redundancy', retirement:'Retirement', termination:'Termination', end_of_contract:'End of Contract', other:'Other' };
const CAT_CONFIG: Record<string,{icon:string;color:string}> = { hr:{icon:'👥',color:C.primary}, it:{icon:'💻',color:C.sky}, finance:{icon:'💷',color:C.success}, legal:{icon:'⚖️',color:C.danger}, manager:{icon:'👤',color:'#A855F7'}, facilities:{icon:'🏢',color:C.secondary}, other:{icon:'📦',color:C.dim} };

function StartOffboardingModal({ onClose }: { onClose:()=>void }) {
  const start = useStartOffboarding();
  const { data:employees } = useEmployees();
  const qc = useQueryClient();
  const [errMsg, setErrMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ employeeId:'', reason:'resignation', lastWorkingDay:'', noticeGivenDate:'', notes:'' });
  const set = (k:string,v:string) => setForm(f=>({...f,[k]:v}));

  const handleSave = async () => {
    if (!form.employeeId||!form.lastWorkingDay) { setErrMsg('Employee and last working day are required'); return; }
    setSaving(true); setErrMsg('');
    try { await start.mutateAsync(form); qc.invalidateQueries({queryKey:['offboarding']}); onClose(); }
    catch(e:any) { setErrMsg(e.message??'Failed'); } finally { setSaving(false); }
  };

  return (
    <Modal title="Start Offboarding" onClose={onClose} wide>
      {errMsg && <Alert type="error" message={errMsg} />}
      <FormField label="Employee" required>
        <select style={selectStyle} value={form.employeeId} onChange={e=>set('employeeId',e.target.value)}>
          <option value="">Select employee...</option>
          {(employees?.items??[]).map(e=><option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
        </select>
      </FormField>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <FormField label="Reason" required>
          <select style={selectStyle} value={form.reason} onChange={e=>set('reason',e.target.value)}>
            {Object.entries(REASON_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
          </select>
        </FormField>
        <FormField label="Last Working Day" required><input style={inputStyle} type="date" value={form.lastWorkingDay} onChange={e=>set('lastWorkingDay',e.target.value)} /></FormField>
        <FormField label="Notice Given Date"><input style={inputStyle} type="date" value={form.noticeGivenDate} onChange={e=>set('noticeGivenDate',e.target.value)} /></FormField>
      </div>
      <FormField label="Notes"><textarea style={{...inputStyle,height:60,resize:'vertical'}} value={form.notes} onChange={e=>set('notes',e.target.value)} /></FormField>
      <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:24}}>
        <button onClick={onClose} style={{background:'transparent',color:C.muted,border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:600,cursor:'pointer'}}>Cancel</button>
        <button onClick={handleSave} disabled={saving} style={{background:C.danger,color:'#fff',border:'none',borderRadius:8,padding:'8px 18px',fontSize:13,fontWeight:700,cursor:'pointer'}}>{saving?'Starting...':'Start Offboarding'}</button>
      </div>
    </Modal>
  );
}

function OffboardingDetailModal({ id, onClose }: { id:string; onClose:()=>void }) {
  const { data, isLoading, refetch } = useOffboardingDetail(id);

  const handleComplete = async (taskId:string) => {
    const token = localStorage.getItem('access_token');
    await fetch(`/api/offboarding/${id}/tasks/${taskId}/complete`, { method:'POST', headers:{Authorization:`Bearer ${token}`} });
    refetch();
  };

  if (isLoading) return <Modal title="Offboarding" onClose={onClose}><Loading /></Modal>;
  if (!data) return null;

  const tasks = data.tasks ?? [];
  const done = tasks.filter((t:any)=>t.status==='completed').length;
  const pct  = tasks.length>0 ? Math.round(done/tasks.length*100) : 0;

  const byCategory = tasks.reduce((acc:any, t:any) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {} as Record<string,any[]>);

  return (
    <Modal title={`${data.employee_name} — Offboarding`} onClose={onClose} wide>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:20}}>
        <div style={{background:C.surface,borderRadius:10,padding:14,textAlign:'center'}}>
          <div style={{fontSize:24,fontWeight:900,color:C.danger}}>{pct}%</div>
          <div style={{fontSize:11,color:C.muted}}>Complete</div>
          <div style={{marginTop:6}}><ProgressBar value={pct} color={C.danger} /></div>
        </div>
        <div style={{background:C.surface,borderRadius:10,padding:14,textAlign:'center'}}>
          <div style={{fontSize:18,fontWeight:800,color:C.text}}>{fmtDate(data.last_working_day)}</div>
          <div style={{fontSize:11,color:C.muted}}>Last Working Day</div>
          <div style={{fontSize:10,color:C.dim,marginTop:4}}>{REASON_LABELS[data.reason]??data.reason}</div>
        </div>
        <div style={{background:C.surface,borderRadius:10,padding:14,textAlign:'center'}}>
          <div style={{fontSize:24,fontWeight:900,color:C.success}}>{done}</div>
          <div style={{fontSize:11,color:C.muted}}>Tasks Done</div>
          <div style={{fontSize:10,color:C.dim,marginTop:4}}>of {tasks.length} total</div>
        </div>
      </div>

      <div style={{maxHeight:440,overflowY:'auto'}}>
        {Object.entries(byCategory).map(([cat, catTasks]) => {
          const cfg = CAT_CONFIG[cat]??CAT_CONFIG.other;
          const catDone = (catTasks as any[]).filter((t:any)=>t.status==='completed').length;
          return (
            <div key={cat} style={{marginBottom:16}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,paddingBottom:6,borderBottom:`1px solid ${C.border}`}}>
                <span style={{fontSize:14}}>{cfg.icon}</span>
                <span style={{fontSize:12,fontWeight:700,color:cfg.color,textTransform:'uppercase',letterSpacing:'0.06em'}}>{cat}</span>
                <span style={{background:cfg.color+'22',color:cfg.color,borderRadius:4,fontSize:9,padding:'1px 6px',fontWeight:700,marginLeft:'auto'}}>{catDone}/{(catTasks as any[]).length}</span>
              </div>
              {(catTasks as any[]).map((task:any) => {
                const done = task.status==='completed';
                const overdue = task.due_date&&!done&&new Date(task.due_date)<new Date();
                return (
                  <div key={task.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:`1px solid ${C.border}22`}}>
                    <button onClick={()=>!done&&handleComplete(task.id)} style={{width:20,height:20,borderRadius:'50%',flexShrink:0,background:done?cfg.color:'transparent',border:`2px solid ${done?cfg.color:C.border}`,cursor:done?'default':'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:10,fontWeight:800}}>
                      {done?'✓':''}
                    </button>
                    <div style={{flex:1}}>
                      <div style={{fontSize:12,fontWeight:done?400:600,color:done?C.dim:C.text,textDecoration:done?'line-through':'none'}}>{task.title}</div>
                      {task.due_date && <div style={{fontSize:10,color:overdue?C.danger:C.dim}}>Due {fmtDate(task.due_date)}{overdue?' ⚠️':''}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

export default function OffboardingModule() {
  const [showStart, setShowStart] = useState(false);
  const [selectedId, setSelectedId] = useState<string|null>(null);
  const [filter, setFilter] = useState('all');
  const { data:records, isLoading } = useOffboardingList();
  const all = records??[];
  const active    = all.filter(r=>r.status==='in_progress');
  const completed = all.filter(r=>r.status==='completed');
  const displayed = filter==='all'?all:filter==='active'?active:completed;

  return (
    <div className="animate-fadeIn">
      <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',marginBottom:20}}>
        <div><h2 style={{color:C.text,fontSize:20,fontWeight:800,margin:0}}>Offboarding</h2>
        <p style={{color:C.muted,fontSize:12,margin:'4px 0 0'}}>Departure checklists, equipment retrieval and exit processes</p></div>
        <button onClick={()=>setShowStart(true)} style={{background:C.danger,color:'#fff',border:'none',borderRadius:8,padding:'8px 18px',fontSize:13,fontWeight:700,cursor:'pointer'}}>+ Start Offboarding</button>
      </div>
      <MetricGrid>
        <MetricCard label="Active"    value={active.length}    icon="📤" color={`linear-gradient(135deg,${C.danger},#7F1D1D)`} />
        <MetricCard label="Completed" value={completed.length} icon="✅" color={`linear-gradient(135deg,${C.success},${C.secondary})`} />
        <MetricCard label="Total"     value={all.length}       icon="👤" color={`linear-gradient(135deg,${C.primary},#8B5CF6)`} />
        <MetricCard label="Avg Days"  value="15"               icon="📅" color={`linear-gradient(135deg,${C.secondary},${C.sky})`} />
      </MetricGrid>
      <div style={{display:'flex',gap:6,marginBottom:20}}>
        {[{k:'all',l:`All (${all.length})`},{k:'active',l:`Active (${active.length})`},{k:'completed',l:`Completed (${completed.length})`}].map(f=>(
          <button key={f.k} onClick={()=>setFilter(f.k)} style={{background:filter===f.k?C.danger:C.elevated,color:filter===f.k?'#fff':C.muted,border:`1px solid ${filter===f.k?C.danger:C.border}`,borderRadius:8,padding:'7px 14px',fontSize:12,fontWeight:700,cursor:'pointer'}}>{f.l}</button>
        ))}
      </div>
      {isLoading?<Loading />:(
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {displayed.map(r=>(
            <Card key={r.id} onClick={()=>setSelectedId(r.id)} style={{cursor:'pointer',borderLeft:`4px solid ${r.status==='completed'?C.success:C.danger}`}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                  <Avatar name={r.employee_name} size={40} />
                  <div>
                    <div style={{fontWeight:800,fontSize:14,color:C.text}}>{r.employee_name}</div>
                    <div style={{fontSize:12,color:C.muted,marginTop:2}}>{REASON_LABELS[r.reason]} · Last day: {fmtDate(r.last_working_day)}</div>
                  </div>
                </div>
                <div style={{textAlign:'right'}}>
                  <StatusBadge status={r.status} />
                  <div style={{fontSize:11,color:C.muted,marginTop:6}}>{r.completed_count}/{r.task_count} tasks</div>
                </div>
              </div>
              <div style={{marginTop:12}}>
                <ProgressBar value={r.completion_pct} color={r.status==='completed'?C.success:C.danger} />
              </div>
            </Card>
          ))}
          {displayed.length===0&&<div style={{textAlign:'center',padding:'60px 20px',color:C.dim}}><div style={{fontSize:40,marginBottom:12}}>📤</div><div>No offboarding records</div></div>}
        </div>
      )}
      {showStart  && <StartOffboardingModal onClose={()=>setShowStart(false)} />}
      {selectedId && <OffboardingDetailModal id={selectedId} onClose={()=>setSelectedId(null)} />}
    </div>
  );
}

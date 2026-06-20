import { useState } from 'react';
import { useResourceCapacity, useResourceBench, useResourceForecast, useCreateResourceBooking, useEmployees } from '../../hooks/api';
import { Card, DataTable, MetricCard, MetricGrid, Modal, FormField, inputStyle, selectStyle, Loading, Alert, ProgressBar, Avatar, C, fmtDate } from '../../components/ui';
import { useQueryClient } from '@tanstack/react-query';

function getMonday(weeksAhead=0) {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day===0?-6:1) + (weeksAhead*7);
  return new Date(d.setDate(diff)).toISOString().split('T')[0];
}

function BookingModal({ onClose }: { onClose:()=>void }) {
  const create = useCreateResourceBooking();
  const { data:employees } = useEmployees();
  const { data:projectsRaw } = useProjects();
  const allProjects = (projectsRaw as any) ?? [];
  const { data:projectsData } = useProjects();
  const projects = (projectsData as any) ?? [];
  const qc = useQueryClient();
  const [errMsg, setErrMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ employeeId:'', projectId:'', bookingType:'project', weekStarting:getMonday(), hours:'37.5', notes:'' });
  const set = (k:string,v:string) => setForm(f=>({...f,[k]:v}));

  const handleSave = async () => {
    if (!form.employeeId||!form.weekStarting) { setErrMsg('Employee and week are required'); return; }
    setSaving(true); setErrMsg('');
    try { await create.mutateAsync({...form, hours:Number(form.hours)}); qc.invalidateQueries({queryKey:['resources']}); onClose(); }
    catch(e:any) { setErrMsg(e.message??'Failed'); } finally { setSaving(false); }
  };

  return (
    <Modal title="Create Resource Booking" onClose={onClose} wide>
      {errMsg && <Alert type="error" message={errMsg} />}
      <FormField label="Employee" required>
        <select style={selectStyle} value={form.employeeId} onChange={e=>set('employeeId',e.target.value)}>
          <option value="">Select employee...</option>
          {(employees?.items??[]).map(e=><option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
        </select>
      </FormField>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <FormField label="Week Starting" required><input style={inputStyle} type="date" value={form.weekStarting} onChange={e=>set('weekStarting',e.target.value)} /></FormField>
        <FormField label="Hours"><input style={inputStyle} type="number" min="0" max="37.5" step="0.5" value={form.hours} onChange={e=>set('hours',e.target.value)} /></FormField>
        <FormField label="Booking Type">
          <select style={selectStyle} value={form.bookingType} onChange={e=>set('bookingType',e.target.value)}>
            <option value="project">Project</option><option value="internal">Internal</option>
            <option value="training">Training</option><option value="bench">Bench / Unallocated</option>
          </select>
        </FormField>
        {form.bookingType === 'project' && (
          <FormField label="Project">
            <select style={selectStyle} value={form.projectId} onChange={e=>set('projectId',e.target.value)}>
              <option value="">Select project...</option>
              {allProjects.map((p:any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </FormField>
        )}
      </div>
      <FormField label="Notes"><input style={inputStyle} value={form.notes} onChange={e=>set('notes',e.target.value)} /></FormField>
      <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:24}}>
        <button onClick={onClose} style={{background:'transparent',color:C.muted,border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:600,cursor:'pointer'}}>Cancel</button>
        <button onClick={handleSave} disabled={saving} style={{background:C.primary,color:'#fff',border:'none',borderRadius:8,padding:'8px 18px',fontSize:13,fontWeight:700,cursor:'pointer'}}>{saving?'Saving...':'Create Booking'}</button>
      </div>
    </Modal>
  );
}

export default function ResourcesModule() {
  const [tab, setTab] = useState<'capacity'|'bench'|'forecast'>('capacity');
  const [showBook, setShowBook] = useState(false);
  const [weeks, setWeeks] = useState(8);
  const { data:capacity,  isLoading:cL } = useResourceCapacity();
  const { data:bench,     isLoading:bL } = useResourceBench();
  const { data:forecast,  isLoading:fL } = useResourceForecast(weeks);
  const allCap  = capacity??[];
  const allBench= bench??[];
  const allFore = forecast??[];
  const avgUtil = allCap.length>0 ? Math.round(allCap.reduce((a:number,r:any)=>a+(r.utilisation_pct??0),0)/allCap.length) : 0;

  return (
    <div className="animate-fadeIn">
      <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',marginBottom:20}}>
        <div><h2 style={{color:C.text,fontSize:20,fontWeight:800,margin:0}}>Resource Planning</h2>
        <p style={{color:C.muted,fontSize:12,margin:'4px 0 0'}}>Capacity, utilisation and bench tracking</p></div>
        <button onClick={()=>setShowBook(true)} style={{background:C.primary,color:'#fff',border:'none',borderRadius:8,padding:'8px 18px',fontSize:13,fontWeight:700,cursor:'pointer'}}>+ Book Resource</button>
      </div>
      <MetricGrid>
        <MetricCard label="Avg Utilisation"  value={`${avgUtil}%`}        icon="📊" color={`linear-gradient(135deg,${avgUtil>80?C.success:avgUtil>60?C.warning:C.danger},${C.primary})`} />
        <MetricCard label="On Bench"         value={allBench.length}       icon="🪑" color={`linear-gradient(135deg,${C.warning},${C.danger})`} />
        <MetricCard label="Active Resources" value={allCap.length}         icon="👥" color={`linear-gradient(135deg,${C.primary},#8B5CF6)`} />
        <MetricCard label="Forecast Weeks"   value={weeks}                 icon="🔮" color={`linear-gradient(135deg,${C.secondary},${C.sky})`} />
      </MetricGrid>

      <div style={{display:'flex',gap:6,marginBottom:20}}>
        {[{k:'capacity',l:'📊 Capacity'},{k:'bench',l:`🪑 Bench (${allBench.length})`},{k:'forecast',l:'🔮 Forecast'}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k as any)} style={{background:tab===t.k?C.primary:C.elevated,color:tab===t.k?'#fff':C.muted,border:`1px solid ${tab===t.k?C.primary:C.border}`,borderRadius:8,padding:'7px 14px',fontSize:12,fontWeight:700,cursor:'pointer'}}>{t.l}</button>
        ))}
      </div>

      {tab==='capacity' && (cL?<Loading />:(
        <Card>
          <DataTable cols={[
            { key:'employee_name', label:'Employee', render:(v:any)=><div style={{display:'flex',alignItems:'center',gap:8}}><Avatar name={v} size={28}/><span style={{fontWeight:600}}>{v}</span></div> },
            { key:'department_name', label:'Department', muted:true },
            { key:'projects', label:'Projects', render:(v:any)=><span style={{fontSize:11,color:C.dim}}>{v??'—'}</span> },
            { key:'allocated_hours', label:'Booked', render:(v:any)=>`${v}h`, muted:true },
            { key:'available_hours', label:'Available', render:(v:any)=>`${v}h`, muted:true },
            { key:'utilisation_pct', label:'Utilisation', render:(v:any)=>(
              <div style={{display:'flex',alignItems:'center',gap:8,minWidth:120}}>
                <div style={{flex:1}}><ProgressBar value={v??0} color={(v??0)>90?C.danger:(v??0)>70?C.warning:C.success} height={6} /></div>
                <span style={{fontSize:11,fontWeight:700,color:(v??0)>90?C.danger:(v??0)>70?C.warning:C.success,minWidth:36}}>{v??0}%</span>
              </div>
            )},
          ]} rows={allCap} emptyText="No capacity data — create resource bookings first" />
        </Card>
      ))}

      {tab==='bench' && (bL?<Loading />:(
        <>
          {allBench.length===0 ? (
            <div style={{textAlign:'center',padding:'60px 20px',color:C.dim}}><div style={{fontSize:40,marginBottom:12}}>🎉</div><div>Everyone is allocated this week</div></div>
          ) : (
            <Card>
              <div style={{marginBottom:12,fontSize:12,color:C.muted}}>Employees with &lt; 80% utilisation this week — available for new work</div>
              <DataTable cols={[
                { key:'name',           label:'Employee',    render:(v:any)=><div style={{display:'flex',alignItems:'center',gap:8}}><Avatar name={v} size={28}/><span style={{fontWeight:600}}>{v}</span></div> },
                { key:'department',     label:'Department',  muted:true },
                { key:'bench_hours',    label:'Free Hours',  render:(v:any)=><span style={{color:C.success,fontWeight:700}}>{v}h</span> },
                { key:'booked_hours',   label:'Booked',      render:(v:any)=>`${v}h`, muted:true },
                { key:'utilisation_pct',label:'Utilisation', render:(v:any)=><span style={{color:(v??0)<50?C.danger:C.warning,fontWeight:700}}>{v}%</span> },
              ]} rows={allBench} emptyText="No bench capacity" />
            </Card>
          )}
        </>
      ))}

      {tab==='forecast' && (
        <>
          <div style={{marginBottom:14,display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:12,color:C.muted}}>Weeks ahead:</span>
            {[4,8,12,16].map(w=>(
              <button key={w} onClick={()=>setWeeks(w)} style={{background:weeks===w?C.primary:C.elevated,color:weeks===w?'#fff':C.muted,border:`1px solid ${weeks===w?C.primary:C.border}`,borderRadius:8,padding:'5px 12px',fontSize:11,fontWeight:700,cursor:'pointer'}}>{w}w</button>
            ))}
          </div>
          {fL?<Loading />:(
            allFore.length===0 ? (
              <div style={{textAlign:'center',padding:'60px 20px',color:C.dim}}><div style={{fontSize:40,marginBottom:12}}>📅</div><div>No bookings in forecast window — create resource bookings to see forecast</div></div>
            ) : (
              <Card>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {allFore.map((week:any)=>{
                    const pct = week.utilisation_pct??0;
                    const color = pct>90?C.danger:pct>70?C.warning:C.success;
                    return (
                      <div key={week.week_starting} style={{display:'flex',alignItems:'center',gap:12}}>
                        <div style={{minWidth:80,fontSize:11,color:C.muted}}>{fmtDate(week.week_starting)}</div>
                        <div style={{flex:1}}><ProgressBar value={pct} color={color} /></div>
                        <div style={{minWidth:100,fontSize:11,color:C.muted,textAlign:'right'}}>{week.total_booked}h / {week.total_available}h</div>
                        <div style={{minWidth:44,fontSize:12,fontWeight:700,color,textAlign:'right'}}>{pct}%</div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )
          )}
        </>
      )}

      {showBook && <BookingModal onClose={()=>setShowBook(false)} />}
    </div>
  );
}

import { useState } from 'react';
import {
  useRecruitmentPipeline, useRecruitmentJob, useRecruitmentJobs,
  useCreateRecruitmentJob, usePublishJob,
  useCandidates, useCreateCandidate,
  useCreateApplication, useInterviews, useScheduleInterview,
  useOffers, useCreateOffer, useSendOffer,
  useDepartments, useEmployees,
  type PipelineJob, type Candidate, type Application, type Interview, type Offer,
} from '../../hooks/api';
import {
  Card, Modal, InfoRow, MetricCard, MetricGrid, StatusBadge,
  Avatar, Loading, Alert, FormField, inputStyle, selectStyle,
  Badge, C, fmtDate,
} from '../../components/ui';
import { PermissionGate, PERMISSIONS } from '../../platform/permissions';
import { useQueryClient } from '@tanstack/react-query';

const STAGES = [
  { key: 'applied',      label: 'Applied',       color: C.muted },
  { key: 'screening',    label: 'Screening',      color: C.info },
  { key: 'phone_screen', label: 'Phone Screen',   color: C.warning },
  { key: 'interview',    label: 'Interview',      color: '#A855F7' },
  { key: 'assessment',   label: 'Assessment',     color: C.secondary },
  { key: 'offer',        label: 'Offer',          color: C.success },
  { key: 'hired',        label: 'Hired ✓',        color: '#065F46' },
] as const;

const SOURCE_ICONS: Record<string, string> = { linkedin:'💼', referral:'👥', agency:'🏢', job_board:'📋', website:'🌐', direct:'📧', other:'📦' };

function SaveRow({ onCancel, onSave, saving, label='Save' }: { onCancel:()=>void; onSave:()=>void; saving:boolean; label?:string }) {
  return (
    <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:24 }}>
      <button onClick={onCancel} style={{ background:'transparent', color:C.muted, border:`1px solid ${C.border}`, borderRadius:8, padding:'8px 16px', fontSize:13, fontWeight:600, cursor:'pointer' }}>Cancel</button>
      <button onClick={onSave} disabled={saving} style={{ background:saving ? C.primary+'99' : C.primary, color:'#fff', border:'none', borderRadius:8, padding:'8px 18px', fontSize:13, fontWeight:700, cursor:saving ? 'wait' : 'pointer' }}>{saving ? 'Saving...' : label}</button>
    </div>
  );
}

// ── Add Candidate ─────────────────────────────────────────────────────────────
function AddCandidateModal({ onClose, jobId }: { onClose:()=>void; jobId?:string }) {
  const createCandidate = useCreateCandidate();
  const createApp = useCreateApplication();
  const qc = useQueryClient();
  const [errMsg, setErrMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ firstName:'', lastName:'', email:'', phone:'', location:'', linkedinUrl:'', source:'direct', notes:'' });
  const set = (k:string,v:string) => setForm(f=>({...f,[k]:v}));

  const handleSave = async () => {
    if (!form.firstName || !form.email) { setErrMsg('First name and email are required'); return; }
    setSaving(true); setErrMsg('');
    try {
      const res = await createCandidate.mutateAsync(form) as any;
      if (jobId && res?.data?.id) await createApp.mutateAsync({ jobId, candidateId: res.data.id });
      qc.invalidateQueries({ queryKey: ['recruitment'] });
      onClose();
    } catch(e:any) { setErrMsg(e.message ?? 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <Modal title="Add Candidate" onClose={onClose} wide>
      {errMsg && <Alert type="error" message={errMsg} />}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <FormField label="First Name" required><input style={inputStyle} value={form.firstName} onChange={e=>set('firstName',e.target.value)} placeholder="Sarah" /></FormField>
        <FormField label="Last Name"><input style={inputStyle} value={form.lastName} onChange={e=>set('lastName',e.target.value)} placeholder="Mitchell" /></FormField>
        <FormField label="Email" required><input style={inputStyle} type="email" value={form.email} onChange={e=>set('email',e.target.value)} placeholder="sarah@email.com" /></FormField>
        <FormField label="Phone"><input style={inputStyle} value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="+44 7700 900000" /></FormField>
        <FormField label="Location"><input style={inputStyle} value={form.location} onChange={e=>set('location',e.target.value)} placeholder="London, UK" /></FormField>
        <FormField label="Source">
          <select style={selectStyle} value={form.source} onChange={e=>set('source',e.target.value)}>
            <option value="direct">Direct</option><option value="linkedin">LinkedIn</option>
            <option value="referral">Referral</option><option value="agency">Agency</option>
            <option value="job_board">Job Board</option><option value="website">Website</option>
          </select>
        </FormField>
        <div style={{gridColumn:'1/-1'}}>
          <FormField label="LinkedIn URL"><input style={inputStyle} value={form.linkedinUrl} onChange={e=>set('linkedinUrl',e.target.value)} placeholder="https://linkedin.com/in/..." /></FormField>
        </div>
      </div>
      <FormField label="Notes"><textarea style={{...inputStyle,height:72,resize:'vertical'}} value={form.notes} onChange={e=>set('notes',e.target.value)} /></FormField>
      <SaveRow onCancel={onClose} onSave={handleSave} saving={saving} label={jobId ? 'Add & Apply' : '+ Add Candidate'} />
    </Modal>
  );
}

// ── Schedule Interview ────────────────────────────────────────────────────────
function ScheduleInterviewModal({ applicationId, onClose }: { applicationId:string; onClose:()=>void }) {
  const schedule = useScheduleInterview();
  const { data: employees } = useEmployees();
  const qc = useQueryClient();
  const [errMsg, setErrMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ stageName:'Technical Interview', interviewType:'video', scheduledAt:'', durationMins:60, location:'', notes:'', interviewerIds:[] as string[] });
  const set = (k:string,v:any) => setForm(f=>({...f,[k]:v}));
  const toggleInt = (id:string) => set('interviewerIds', form.interviewerIds.includes(id) ? form.interviewerIds.filter(x=>x!==id) : [...form.interviewerIds,id]);

  const handleSave = async () => {
    if (!form.scheduledAt) { setErrMsg('Date/time required'); return; }
    setSaving(true); setErrMsg('');
    try {
      await schedule.mutateAsync({...form, applicationId});
      qc.invalidateQueries({ queryKey: ['recruitment'] });
      onClose();
    } catch(e:any) { setErrMsg(e.message ?? 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <Modal title="Schedule Interview" onClose={onClose} wide>
      {errMsg && <Alert type="error" message={errMsg} />}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <FormField label="Stage">
          <select style={selectStyle} value={form.stageName} onChange={e=>set('stageName',e.target.value)}>
            <option>Phone Screen</option><option>Technical Interview</option><option>Panel Interview</option><option>Final Interview</option>
          </select>
        </FormField>
        <FormField label="Format">
          <select style={selectStyle} value={form.interviewType} onChange={e=>set('interviewType',e.target.value)}>
            <option value="video">Video Call</option><option value="phone">Phone</option><option value="in_person">In Person</option><option value="panel">Panel</option>
          </select>
        </FormField>
        <FormField label="Date & Time" required><input style={inputStyle} type="datetime-local" value={form.scheduledAt} onChange={e=>set('scheduledAt',e.target.value)} /></FormField>
        <FormField label="Duration">
          <select style={selectStyle} value={form.durationMins} onChange={e=>set('durationMins',Number(e.target.value))}>
            <option value={30}>30 min</option><option value={45}>45 min</option><option value={60}>1 hour</option><option value={90}>90 min</option><option value={120}>2 hours</option>
          </select>
        </FormField>
        <div style={{gridColumn:'1/-1'}}>
          <FormField label="Location / Link"><input style={inputStyle} value={form.location} onChange={e=>set('location',e.target.value)} placeholder="https://meet.google.com/... or Room 2B" /></FormField>
        </div>
      </div>
      <FormField label="Interviewers">
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:4 }}>
          {(employees?.items ?? []).map(e => {
            const sel = form.interviewerIds.includes(e.id);
            return <button key={e.id} onClick={()=>toggleInt(e.id)} style={{ background:sel ? C.primary+'22' : C.elevated, color:sel ? C.primary : C.muted, border:`1px solid ${sel ? C.primary : C.border}`, borderRadius:20, padding:'4px 12px', fontSize:11, fontWeight:600, cursor:'pointer' }}>{e.first_name} {e.last_name}</button>;
          })}
        </div>
      </FormField>
      <SaveRow onCancel={onClose} onSave={handleSave} saving={saving} label="Schedule" />
    </Modal>
  );
}

// ── Create Offer ──────────────────────────────────────────────────────────────
function CreateOfferModal({ application, onClose }: { application:any; onClose:()=>void }) {
  const createOffer = useCreateOffer();
  const qc = useQueryClient();
  const [errMsg, setErrMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ salary:'', currency:'GBP', startDate:'', contractType:'permanent', employmentType:'full_time', location:'' });
  const set = (k:string,v:string) => setForm(f=>({...f,[k]:v}));

  const handleSave = async () => {
    if (!form.salary) { setErrMsg('Salary is required'); return; }
    setSaving(true); setErrMsg('');
    try {
      await createOffer.mutateAsync({ ...form, salary:Number(form.salary), applicationId:application.id, candidateId:application.candidate_id, jobId:application.job_id });
      qc.invalidateQueries({ queryKey: ['recruitment'] });
      onClose();
    } catch(e:any) { setErrMsg(e.message ?? 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={`Create Offer — ${application.first_name} ${application.last_name}`} onClose={onClose} wide>
      {errMsg && <Alert type="error" message={errMsg} />}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <FormField label="Salary (£)" required><input style={inputStyle} type="number" value={form.salary} onChange={e=>set('salary',e.target.value)} placeholder="45000" /></FormField>
        <FormField label="Currency">
          <select style={selectStyle} value={form.currency} onChange={e=>set('currency',e.target.value)}>
            <option value="GBP">GBP £</option><option value="USD">USD $</option><option value="EUR">EUR €</option>
          </select>
        </FormField>
        <FormField label="Start Date"><input style={inputStyle} type="date" value={form.startDate} onChange={e=>set('startDate',e.target.value)} /></FormField>
        <FormField label="Contract">
          <select style={selectStyle} value={form.contractType} onChange={e=>set('contractType',e.target.value)}>
            <option value="permanent">Permanent</option><option value="fixed_term">Fixed Term</option><option value="contractor">Contractor</option>
          </select>
        </FormField>
        <FormField label="Employment Type">
          <select style={selectStyle} value={form.employmentType} onChange={e=>set('employmentType',e.target.value)}>
            <option value="full_time">Full Time</option><option value="part_time">Part Time</option>
          </select>
        </FormField>
        <FormField label="Location"><input style={inputStyle} value={form.location} onChange={e=>set('location',e.target.value)} placeholder="London HQ / Remote" /></FormField>
      </div>
      <SaveRow onCancel={onClose} onSave={handleSave} saving={saving} label="Create Offer" />
    </Modal>
  );
}

// ── Pipeline Board (kanban for a single job) ──────────────────────────────────
function PipelineBoard({ jobId }: { jobId:string }) {
  const { data:job, isLoading, refetch } = useRecruitmentJob(jobId);
  const qc = useQueryClient();
  const [showAdd, setShowAdd]       = useState(false);
  const [schedule, setSchedule]     = useState<string|null>(null);
  const [offerApp, setOfferApp]     = useState<any>(null);

  if (isLoading) return <Loading />;
  if (!job) return null;

  const applications: Application[] = (job as any).applications ?? [];

  const handleMove = async (appId:string, stage:string) => {
    const token = localStorage.getItem('access_token');
    const res = await fetch(`/api/recruitment/applications/${appId}/stage`, { method:'PATCH', headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`}, body: JSON.stringify({ stage }) });
    const data = await res.json();
    if (!data.ok) { alert(data.error); return; }
    qc.invalidateQueries({ queryKey: ['recruitment','jobs',jobId] });
  };

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <span style={{ fontSize:12, color:C.muted }}>{applications.length} candidates in pipeline</span>
        <button onClick={()=>setShowAdd(true)} style={{ background:C.primary, color:'#fff', border:'none', borderRadius:8, padding:'6px 14px', fontSize:11, fontWeight:700, cursor:'pointer' }}>+ Add Candidate</button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:`repeat(${STAGES.length},minmax(150px,1fr))`, gap:8, overflowX:'auto' }}>
        {STAGES.map(stage => {
          const cols = applications.filter(a => a.stage === stage.key);
          const nextStage = STAGES[STAGES.findIndex(s=>s.key===stage.key)+1];
          return (
            <div key={stage.key}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                <span style={{ fontSize:9, fontWeight:700, color:stage.color, textTransform:'uppercase', letterSpacing:'0.05em' }}>{stage.label}</span>
                <span style={{ background:stage.color+'22', color:stage.color, borderRadius:4, fontSize:9, padding:'1px 5px', fontWeight:700 }}>{cols.length}</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6, minHeight:60 }}>
                {cols.map(app => (
                  <div key={app.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:8 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                      <Avatar name={`${app.first_name} ${app.last_name}`} size={20} />
                      <div style={{ fontSize:11, fontWeight:700, color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{app.first_name} {app.last_name}</div>
                    </div>
                    <div style={{ fontSize:9, color:C.dim, marginBottom:6 }}>{SOURCE_ICONS[app.source]??'📧'} {app.source}</div>
                    <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                      {nextStage && stage.key !== 'hired' && (
                        <button onClick={()=>handleMove(app.id, nextStage.key)} style={{ background:C.primary+'22', color:C.primary, border:'none', borderRadius:4, padding:'2px 7px', fontSize:9, fontWeight:700, cursor:'pointer' }}>→ {nextStage.label.replace(' ✓','')}</button>
                      )}
                      {stage.key==='interview' && (
                        <button onClick={()=>setSchedule(app.id)} style={{ background:'#A855F722', color:'#A855F7', border:'none', borderRadius:4, padding:'2px 7px', fontSize:9, fontWeight:700, cursor:'pointer' }}>📅</button>
                      )}
                      {stage.key==='assessment' && (
                        <button onClick={()=>setOfferApp(app)} style={{ background:C.success+'22', color:C.success, border:'none', borderRadius:4, padding:'2px 7px', fontSize:9, fontWeight:700, cursor:'pointer' }}>💼 Offer</button>
                      )}
                    </div>
                  </div>
                ))}
                {cols.length===0 && <div style={{ border:`1.5px dashed ${C.border}`, borderRadius:8, padding:'12px 6px', textAlign:'center', color:C.dim, fontSize:9 }}>Empty</div>}
              </div>
            </div>
          );
        })}
      </div>
      {showAdd  && <AddCandidateModal onClose={()=>{ setShowAdd(false); refetch(); }} jobId={jobId} />}
      {schedule && <ScheduleInterviewModal applicationId={schedule} onClose={()=>{ setSchedule(null); refetch(); }} />}
      {offerApp && <CreateOfferModal application={offerApp} onClose={()=>{ setOfferApp(null); refetch(); }} />}
    </div>
  );
}

// ── Main Module ───────────────────────────────────────────────────────────────
export default function RecruitmentModule() {
  const [tab, setTab]                 = useState<'pipeline'|'jobs'|'candidates'|'interviews'|'offers'>('pipeline');
  const [selectedJobId, setSelectedJobId] = useState<string|null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate|null>(null);
  const [showAddCandidate, setShowAddCandidate] = useState(false);
  const [showNewJob, setShowNewJob]   = useState(false);
  const [search, setSearch]           = useState('');

  const { data:pipeline,   isLoading:pL } = useRecruitmentPipeline();
  const { data:jobs,       isLoading:jL } = useRecruitmentJobs();
  const { data:candidates, isLoading:cL } = useCandidates(search ? { search } : undefined);
  const { data:interviews, isLoading:iL } = useInterviews({ upcoming:'true' });
  const { data:offers,     isLoading:oL } = useOffers();
  const { data:departments }              = useDepartments();
  const createJob = useCreateRecruitmentJob();
  const qc = useQueryClient();

  const allPipeline   = pipeline   ?? [];
  const allJobs       = jobs       ?? [];
  const allCandidates = candidates ?? [];
  const allInterviews = interviews ?? [];
  const allOffers     = offers     ?? [];

  const [newJob, setNewJob] = useState({ title:'', departmentId:'', location:'', locationType:'hybrid', salaryMin:'', salaryMax:'', closingDate:'', description:'', requirements:'' });
  const setNJ = (k:string,v:string) => setNewJob(f=>({...f,[k]:v}));

  const handleCreateJob = async () => {
    if (!newJob.title) return;
    try {
      await createJob.mutateAsync({ ...newJob, salaryMin: newJob.salaryMin ? Number(newJob.salaryMin) : undefined, salaryMax: newJob.salaryMax ? Number(newJob.salaryMax) : undefined });
      qc.invalidateQueries({ queryKey: ['recruitment','jobs'] });
      setShowNewJob(false);
    } catch(e:any) { alert(e.message); }
  };

  const totalHired   = allPipeline.reduce((a,j)=>a+j.hired,0);
  const pendingOffers = allOffers.filter(o=>o.status==='sent').length;

  return (
    <div className="animate-fadeIn">
      <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h2 style={{ color:C.text, fontSize:20, fontWeight:800, margin:0 }}>Recruitment</h2>
          <p style={{ color:C.muted, fontSize:12, margin:'4px 0 0' }}>Pipeline, candidates, interviews and offers</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={()=>setShowAddCandidate(true)} style={{ background:C.elevated, color:C.muted, border:`1px solid ${C.border}`, borderRadius:8, padding:'8px 16px', fontSize:13, fontWeight:700, cursor:'pointer' }}>+ Candidate</button>
          <button onClick={()=>setShowNewJob(true)} style={{ background:C.primary, color:'#fff', border:'none', borderRadius:8, padding:'8px 18px', fontSize:13, fontWeight:700, cursor:'pointer' }}>+ Post Job</button>
        </div>
      </div>

      <MetricGrid>
        <MetricCard label="Open Roles"       value={allJobs.filter(j=>j.status==='open').length}    icon="💼" color={`linear-gradient(135deg,${C.primary},#8B5CF6)`} />
        <MetricCard label="Total Candidates" value={allPipeline.reduce((a,j)=>a+j.total,0)}         icon="👤" color={`linear-gradient(135deg,${C.info},${C.primary})`} />
        <MetricCard label="Hired"            value={totalHired}                                      icon="🎉" color={`linear-gradient(135deg,${C.success},${C.secondary})`} />
        <MetricCard label="Pending Offers"   value={pendingOffers}                                   icon="📋" color={`linear-gradient(135deg,${C.warning},${C.danger})`} />
      </MetricGrid>

      <div style={{ display:'flex', gap:6, marginBottom:20, flexWrap:'wrap' }}>
        {[
          { key:'pipeline',   label:`📊 Pipeline` },
          { key:'jobs',       label:`💼 Jobs (${allJobs.length})` },
          { key:'candidates', label:`👤 Candidates (${allCandidates.length})` },
          { key:'interviews', label:`📅 Upcoming (${allInterviews.length})` },
          { key:'offers',     label:`📋 Offers (${allOffers.length})` },
        ].map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key as any)} style={{ background:tab===t.key ? C.primary : C.elevated, color:tab===t.key ? '#fff' : C.muted, border:`1px solid ${tab===t.key ? C.primary : C.border}`, borderRadius:8, padding:'7px 14px', fontSize:12, fontWeight:700, cursor:'pointer' }}>{t.label}</button>
        ))}
      </div>

      {/* Pipeline */}
      {tab==='pipeline' && (pL ? <Loading /> : (
        <>
          {allPipeline.length===0 && <div style={{ textAlign:'center', padding:'60px 20px', color:C.dim }}><div style={{fontSize:40,marginBottom:12}}>💼</div><div>No active jobs yet — post your first role</div></div>}
          {allPipeline.map(job=>(
            <Card key={job.id} style={{ marginBottom:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                <div>
                  <div style={{ fontWeight:800, color:C.text, fontSize:15 }}>{job.title}</div>
                  <div style={{ color:C.muted, fontSize:12, marginTop:2 }}>{job.total} candidates · {job.hired} hired</div>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <StatusBadge status={job.status} />
                  <button onClick={()=>setSelectedJobId(selectedJobId===job.id ? null : job.id)} style={{ background:C.primary+'22', color:C.primary, border:`1px solid ${C.primary}33`, borderRadius:8, padding:'5px 12px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                    {selectedJobId===job.id ? '▲ Hide' : '▼ Board'}
                  </button>
                </div>
              </div>
              <div style={{ display:'flex', gap:6, marginBottom:14 }}>
                {STAGES.map(s=>{
                  const count = (job as any)[s.key] ?? 0;
                  return <div key={s.key} style={{ flex:1, textAlign:'center', background:s.color+'22', border:`1px solid ${s.color}33`, borderRadius:8, padding:'6px 4px' }}>
                    <div style={{ fontSize:14, fontWeight:800, color:s.color }}>{count}</div>
                    <div style={{ fontSize:8, color:C.dim, textTransform:'uppercase', letterSpacing:'0.04em' }}>{s.label.replace(' ✓','')}</div>
                  </div>;
                })}
              </div>
              {selectedJobId===job.id && <PipelineBoard jobId={job.id} />}
            </Card>
          ))}
        </>
      ))}

      {/* Jobs */}
      {tab==='jobs' && (jL ? <Loading /> : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {allJobs.map(job=>(
            <Card key={job.id} onClick={()=>{ setSelectedJobId(job.id); setTab('pipeline'); }} style={{ cursor:'pointer' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <div style={{ fontWeight:800, color:C.text, fontSize:14, marginBottom:8 }}>{job.title}</div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    {job.department_name && <Badge color={C.info}>{job.department_name}</Badge>}
                    {job.location        && <Badge color={C.secondary}>{job.location}</Badge>}
                    <Badge color={C.muted}>{job.location_type}</Badge>
                  </div>
                </div>
                <StatusBadge status={job.status} />
              </div>
              <div style={{ display:'flex', gap:20, marginTop:12, paddingTop:12, borderTop:`1px solid ${C.border}33`, fontSize:12, color:C.muted }}>
                <span>👤 {(job as any).applicant_count ?? 0} applicants</span>
                {(job as any).closing_date && <span>⏰ Closes {fmtDate((job as any).closing_date)}</span>}
              </div>
            </Card>
          ))}
          {allJobs.length===0 && <div style={{ textAlign:'center', padding:'60px 20px', color:C.dim }}><div style={{fontSize:40,marginBottom:12}}>💼</div><div>No jobs posted yet</div></div>}
        </div>
      ))}

      {/* Candidates */}
      {tab==='candidates' && (
        <>
          <div style={{ marginBottom:14 }}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍  Search candidates..." style={{ background:C.elevated, border:`1px solid ${C.border}`, borderRadius:10, padding:'9px 14px', color:C.text, fontSize:13, outline:'none', width:'100%', boxSizing:'border-box' }} />
          </div>
          {cL ? <Loading /> : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {allCandidates.map(c=>(
                <Card key={c.id} onClick={()=>setSelectedCandidate(c)} style={{ cursor:'pointer' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                    <Avatar name={`${c.first_name} ${c.last_name}`} size={40} />
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:14, color:C.text }}>{c.first_name} {c.last_name}</div>
                      <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>{c.email}{c.location ? ` · ${c.location}` : ''}</div>
                      {c.applied_to && <div style={{ fontSize:11, color:C.dim, marginTop:2 }}>Applied to: {c.applied_to}</div>}
                    </div>
                    <div style={{ display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
                      <Badge color={C.secondary}>{SOURCE_ICONS[c.source]??'📧'} {c.source}</Badge>
                      <StatusBadge status={c.status} />
                    </div>
                  </div>
                </Card>
              ))}
              {allCandidates.length===0 && <div style={{ textAlign:'center', padding:'60px 20px', color:C.dim }}><div style={{fontSize:40,marginBottom:12}}>👤</div><div>{search ? 'No candidates match your search' : 'No candidates yet'}</div></div>}
            </div>
          )}
        </>
      )}

      {/* Upcoming Interviews */}
      {tab==='interviews' && (iL ? <Loading /> : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {allInterviews.map(i=>(
            <Card key={i.id} style={{ borderLeft:`4px solid #A855F7` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                    <Avatar name={i.candidate_name} size={28} />
                    <div>
                      <div style={{ fontWeight:700, fontSize:13, color:C.text }}>{i.candidate_name}</div>
                      <div style={{ fontSize:11, color:C.muted }}>{i.job_title}</div>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:12, fontSize:12, color:C.muted }}>
                    <span>📅 {new Date(i.scheduled_at).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</span>
                    <span>⏱ {i.duration_mins}min</span>
                    <span>🎤 {i.interview_type.replace(/_/g,' ')}</span>
                    {i.location && <span>📍 {i.location}</span>}
                  </div>
                </div>
                <Badge color="#A855F7">{i.stage_name}</Badge>
              </div>
            </Card>
          ))}
          {allInterviews.length===0 && <div style={{ textAlign:'center', padding:'60px 20px', color:C.dim }}><div style={{fontSize:40,marginBottom:12}}>📅</div><div>No upcoming interviews</div></div>}
        </div>
      ))}

      {/* Offers */}
      {tab==='offers' && (oL ? <Loading /> : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {allOffers.map(o=>(
            <Card key={o.id} style={{ borderLeft:`4px solid ${o.status==='accepted' ? C.success : o.status==='declined' ? C.danger : C.warning}` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontWeight:800, fontSize:14, color:C.text, marginBottom:4 }}>{o.candidate_name}</div>
                  <div style={{ fontSize:12, color:C.muted }}>{o.job_title} · {o.currency} {Number(o.salary).toLocaleString()}/yr</div>
                  <div style={{ display:'flex', gap:12, fontSize:11, color:C.dim, marginTop:6 }}>
                    {o.start_date  && <span>📅 Start: {fmtDate(o.start_date)}</span>}
                    {o.sent_at     && <span>📧 Sent: {fmtDate(o.sent_at)}</span>}
                    {o.expires_at && o.status==='sent' && <span style={{color:C.warning}}>⏰ Expires: {fmtDate(o.expires_at)}</span>}
                  </div>
                </div>
                <StatusBadge status={o.status} />
              </div>
            </Card>
          ))}
          {allOffers.length===0 && <div style={{ textAlign:'center', padding:'60px 20px', color:C.dim }}><div style={{fontSize:40,marginBottom:12}}>📋</div><div>No offers yet</div></div>}
        </div>
      ))}

      {/* New Job Modal */}
      {showNewJob && (
        <Modal title="Post New Job" onClose={()=>setShowNewJob(false)} wide>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <FormField label="Job Title" required><input style={inputStyle} value={newJob.title} onChange={e=>setNJ('title',e.target.value)} placeholder="Senior React Developer" /></FormField>
            <FormField label="Department">
              <select style={selectStyle} value={newJob.departmentId} onChange={e=>setNJ('departmentId',e.target.value)}>
                <option value="">Select...</option>
                {(departments??[]).map((d:any)=><option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </FormField>
            <FormField label="Location"><input style={inputStyle} value={newJob.location} onChange={e=>setNJ('location',e.target.value)} placeholder="London HQ" /></FormField>
            <FormField label="Work Type">
              <select style={selectStyle} value={newJob.locationType} onChange={e=>setNJ('locationType',e.target.value)}>
                <option value="office">Office</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option>
              </select>
            </FormField>
            <FormField label="Salary Min (£)"><input style={inputStyle} type="number" value={newJob.salaryMin} onChange={e=>setNJ('salaryMin',e.target.value)} placeholder="40000" /></FormField>
            <FormField label="Salary Max (£)"><input style={inputStyle} type="number" value={newJob.salaryMax} onChange={e=>setNJ('salaryMax',e.target.value)} placeholder="60000" /></FormField>
            <FormField label="Closing Date"><input style={inputStyle} type="date" value={newJob.closingDate} onChange={e=>setNJ('closingDate',e.target.value)} /></FormField>
          </div>
          <FormField label="Description"><textarea style={{...inputStyle,height:80,resize:'vertical'}} value={newJob.description} onChange={e=>setNJ('description',e.target.value)} placeholder="Role overview, responsibilities..." /></FormField>
          <FormField label="Requirements"><textarea style={{...inputStyle,height:60,resize:'vertical'}} value={newJob.requirements} onChange={e=>setNJ('requirements',e.target.value)} placeholder="Required skills..." /></FormField>
          <SaveRow onCancel={()=>setShowNewJob(false)} onSave={handleCreateJob} saving={createJob.isPending} label="Post Job" />
        </Modal>
      )}

      {showAddCandidate && <AddCandidateModal onClose={()=>{ setShowAddCandidate(false); qc.invalidateQueries({queryKey:['recruitment']}); }} />}

      {selectedCandidate && (
        <Modal title={`${selectedCandidate.first_name} ${selectedCandidate.last_name}`} onClose={()=>setSelectedCandidate(null)}>
          <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:20 }}>
            <Avatar name={`${selectedCandidate.first_name} ${selectedCandidate.last_name}`} size={52} />
            <div>
              <div style={{ fontWeight:800, fontSize:18, color:C.text }}>{selectedCandidate.first_name} {selectedCandidate.last_name}</div>
              <div style={{ color:C.muted, fontSize:13 }}>{selectedCandidate.email}</div>
            </div>
          </div>
          {selectedCandidate.location    && <InfoRow label="Location"  value={selectedCandidate.location} />}
          <InfoRow label="Source"   value={`${SOURCE_ICONS[selectedCandidate.source]??''} ${selectedCandidate.source}`} />
          <InfoRow label="Status"   value={<StatusBadge status={selectedCandidate.status} />} />
          <InfoRow label="Applied"  value={`${selectedCandidate.application_count} role${selectedCandidate.application_count!==1?'s':''}`} />
          {selectedCandidate.applied_to  && <InfoRow label="Applied To" value={selectedCandidate.applied_to} />}
          {selectedCandidate.linkedin_url && <InfoRow label="LinkedIn" value={<a href={selectedCandidate.linkedin_url} target="_blank" rel="noopener noreferrer" style={{color:C.info}}>View Profile →</a>} />}
          <div style={{ marginTop:16, display:'flex', gap:8 }}>
            <button onClick={()=>setSelectedCandidate(null)} style={{ background:'transparent', color:C.muted, border:`1px solid ${C.border}`, borderRadius:8, padding:'6px 14px', fontSize:12, fontWeight:600, cursor:'pointer' }}>Close</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

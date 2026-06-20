import { useState } from 'react';
import {
  useHeadcountReport, useLeaveReport, useTimesheetReport,
  useComplianceReport, useProjectReport,
} from '../../hooks/api';
import { Card, Loading, ProgressBar, Avatar, C } from '../../components/ui';

const TAB_LABELS = [
  { key:'headcount',   label:'👥 Headcount',   icon:'👥' },
  { key:'leave',       label:'🌴 Leave',        icon:'🌴' },
  { key:'timesheets',  label:'⏱ Timesheets',   icon:'⏱' },
  { key:'compliance',  label:'🛡 Compliance',   icon:'🛡' },
  { key:'projects',    label:'📂 Projects',     icon:'📂' },
];

function SectionTitle({ children }: { children: any }) {
  return <div style={{ fontSize:13, fontWeight:800, color:C.text, marginBottom:14 }}>{children}</div>;
}

function StatRow({ label, value, sub, color=C.text }: { label:string; value:string|number; sub?:string; color?:string }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:`1px solid ${C.border}33` }}>
      <span style={{ fontSize:12, color:C.muted }}>{label}</span>
      <div style={{ textAlign:'right' }}>
        <span style={{ fontSize:13, fontWeight:700, color }}>{value}</span>
        {sub && <div style={{ fontSize:10, color:C.dim }}>{sub}</div>}
      </div>
    </div>
  );
}

// ── Headcount ─────────────────────────────────────────────────────────────────
function HeadcountReport() {
  const { data, isLoading } = useHeadcountReport();
  const byDept    = (data as any)?.byDept    ?? [];
  const byType    = (data as any)?.byType    ?? [];
  const byLocation= (data as any)?.byLocation?? [];
  const monthly   = (data as any)?.monthly   ?? [];
  const total     = byDept.reduce((a: number, d: any) => a + d.count, 0);

  return isLoading ? <Loading /> : (
    <div>
      <SectionTitle>Headcount Overview</SectionTitle>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
        <Card><div style={{fontSize:28,fontWeight:900,color:C.primary}}>{total}</div><div style={{fontSize:11,color:C.muted}}>Total Active</div></Card>
        <Card><div style={{fontSize:28,fontWeight:900,color:C.text}}>{byDept.length}</div><div style={{fontSize:11,color:C.muted}}>Departments</div></Card>
        <Card><div style={{fontSize:28,fontWeight:900,color:C.success}}>{monthly.reduce((a:number,m:any)=>a+m.new_hires,0)}</div><div style={{fontSize:11,color:C.muted}}>New Hires (12m)</div></Card>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <Card>
          <SectionTitle>By Department</SectionTitle>
          {byDept.length===0 && <div style={{color:C.dim,fontSize:12}}>No data</div>}
          {byDept.map((d: any) => (
            <div key={d.name} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <div style={{ minWidth:100, fontSize:12, color:C.muted }}>{d.name??'Unassigned'}</div>
              <div style={{ flex:1 }}><ProgressBar value={total>0?Math.round(d.count/total*100):0} color={C.primary} height={6} /></div>
              <div style={{ fontSize:12, fontWeight:700, color:C.text, minWidth:24, textAlign:'right' }}>{d.count}</div>
            </div>
          ))}
        </Card>
        <Card>
          <SectionTitle>By Employment Type</SectionTitle>
          {byType.map((d: any) => (
            <div key={d.employment_type} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:`1px solid ${C.border}33` }}>
              <span style={{ fontSize:12, color:C.muted, textTransform:'capitalize' }}>{d.employment_type?.replace(/_/g,' ')}</span>
              <span style={{ fontSize:12, fontWeight:700, color:C.text }}>{d.count}</span>
            </div>
          ))}
          {byType.length===0 && <div style={{color:C.dim,fontSize:12}}>No data</div>}
        </Card>
        <Card>
          <SectionTitle>By Work Location</SectionTitle>
          {byLocation.map((d: any) => (
            <div key={d.work_location_type} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:`1px solid ${C.border}33` }}>
              <span style={{ fontSize:12, color:C.muted, textTransform:'capitalize' }}>{d.work_location_type?.replace(/_/g,' ')}</span>
              <span style={{ fontSize:12, fontWeight:700, color:C.text }}>{d.count}</span>
            </div>
          ))}
          {byLocation.length===0 && <div style={{color:C.dim,fontSize:12}}>No data</div>}
        </Card>
        <Card>
          <SectionTitle>Monthly New Hires (12m)</SectionTitle>
          {monthly.length===0 && <div style={{color:C.dim,fontSize:12}}>No hire data yet</div>}
          {monthly.map((m: any) => (
            <div key={m.month} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
              <div style={{ minWidth:55, fontSize:11, color:C.muted }}>{m.month}</div>
              <div style={{ flex:1 }}><ProgressBar value={Math.max(m.new_hires,0)*20} color={C.success} height={6} /></div>
              <div style={{ fontSize:11, fontWeight:700, color:C.success }}>+{m.new_hires}</div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ── Leave ─────────────────────────────────────────────────────────────────────
function LeaveReport() {
  const year = new Date().getFullYear();
  const { data, isLoading } = useLeaveReport(year);
  const rows = (data as any)?.byType ?? [];
  const maxDays = Math.max(...rows.map((r:any)=>r.total_days), 1);
  return isLoading?<Loading />:(
    <div>
      <SectionTitle>Leave Analysis — {year}</SectionTitle>
      {rows.length===0 && <div style={{textAlign:'center',padding:'40px',color:C.dim}}>No approved leave data for {year}</div>}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        {rows.map((r:any)=>(
          <Card key={r.leave_type}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
              <div style={{ fontWeight:700, color:C.text, fontSize:13, textTransform:'capitalize' }}>{r.leave_type?.replace(/_/g,' ')}</div>
              <span style={{ background:C.primary+'22', color:C.primary, borderRadius:6, fontSize:11, padding:'2px 8px', fontWeight:700 }}>{Number(r.total_days).toFixed(0)}d total</span>
            </div>
            <div style={{ marginBottom:8 }}><ProgressBar value={Math.round(Number(r.total_days)/maxDays*100)} color={C.primary} /></div>
            <StatRow label="Employees" value={r.employee_count} />
            <StatRow label="Avg Days"  value={`${Number(r.avg_days).toFixed(1)}d`} />
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Timesheets ────────────────────────────────────────────────────────────────
function TimesheetReport() {
  const [from, setFrom] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 12); return d.toISOString().split('T')[0]; });
  const [to,   setTo]   = useState(new Date().toISOString().split('T')[0]);
  const { data, isLoading } = useTimesheetReport({ from, to });
  const rows = (data as any)?.utilisation ?? [];
  const sorted = [...rows].sort((a:any,b:any)=>(b.util_pct??0)-(a.util_pct??0));
  const weekly: any[] = (data as any)?.weekly ?? [];
  const maxHours = Math.max(...weekly.map((w:any) => w.hours ?? 0), 1);

  return (
    <div>
      <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:20 }}>
        <SectionTitle>Timesheet Utilisation Report</SectionTitle>
        <input type="date" value={from} onChange={e=>setFrom(e.target.value)} style={{ background:C.elevated, border:`1px solid ${C.border}`, borderRadius:8, padding:'6px 10px', color:C.text, fontSize:12, outline:'none' }} />
        <span style={{ color:C.dim }}>to</span>
        <input type="date" value={to} onChange={e=>setTo(e.target.value)} style={{ background:C.elevated, border:`1px solid ${C.border}`, borderRadius:8, padding:'6px 10px', color:C.text, fontSize:12, outline:'none' }} />
      </div>
      {/* Weekly trend chart */}
      {!isLoading && weekly.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Weekly Hours Trend</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80, overflow: 'hidden' }}>
            {weekly.slice(-24).map((w: any, i: number) => {
              const pct = Math.round((w.hours / maxHours) * 100);
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div title={`${w.week_starting}: ${w.hours}h`} style={{ width: '100%', height: `${pct}%`, minHeight: 2, background: `linear-gradient(180deg, ${C.primary}, ${C.secondary})`, borderRadius: '2px 2px 0 0', transition: 'height 0.3s' }} />
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 9, color: C.dim }}>
            <span>{weekly.slice(-24)[0]?.week_starting?.slice(0,7)}</span>
            <span>{weekly.slice(-24)[weekly.slice(-24).length-1]?.week_starting?.slice(0,7)}</span>
          </div>
        </Card>
      )}

      {isLoading?<Loading />:(
        <Card>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            {rows.length > 0 && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:16 }}>
                {[
                  { label:'Total Hours',    value: rows.reduce((a:number,r:any)=>a+(r.total_hours??0),0).toFixed(0)+'h',    color:C.primary },
                  { label:'Billable Hours', value: rows.reduce((a:number,r:any)=>a+(r.billable_hours??0),0).toFixed(0)+'h', color:C.success },
                  { label:'Avg Utilisation',value: (rows.reduce((a:number,r:any)=>a+(r.util_pct??0),0)/Math.max(rows.length,1)).toFixed(0)+'%', color:C.secondary },
                  { label:'Team Members',   value: rows.length,                                                              color:C.text },
                ].map(s=>(
                  <div key={s.label} style={{ background:C.elevated, borderRadius:10, padding:'10px 14px' }}>
                    <div style={{ fontSize:18, fontWeight:900, color:s.color }}>{s.value}</div>
                    <div style={{ fontSize:10, color:C.dim, marginTop:2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}
            <thead>
              <tr style={{ borderBottom:`2px solid ${C.border}` }}>
                {['Employee','Total Hrs','Billable Hrs','Utilisation','Submitted','Approved'].map(h=>(
                  <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontSize:10, fontWeight:700, color:C.dim, textTransform:'uppercase', letterSpacing:'0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r:any,i)=>(
                <tr key={i} style={{ borderBottom:`1px solid ${C.border}33`, background:i%2===0?'transparent':C.elevated+'44' }}>
                  <td style={{ padding:'10px', fontSize:12 }}><div style={{ display:'flex', alignItems:'center', gap:8 }}><Avatar name={r.name} size={24} />{r.name}</div></td>
                  <td style={{ padding:'10px', fontSize:12, fontWeight:700, color:C.text }}>{Number(r.total_hours ?? 0).toFixed(0)}h</td>
                  <td style={{ padding:'10px', fontSize:12, color:C.secondary }}>{Number(r.billable_hours ?? 0).toFixed(0)}h</td>
                  <td style={{ padding:'10px', minWidth:120 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ flex:1 }}><ProgressBar value={Number(r.util_pct??0)} color={Number(r.util_pct??0)>=80?C.success:Number(r.util_pct??0)>=50?C.warning:C.danger} height={6} /></div>
                      <span style={{ fontSize:11, color:C.muted, flexShrink:0 }}>{Number(r.util_pct??0).toFixed(0)}%</span>
                    </div>
                  </td>
                  <td style={{ padding:'10px', fontSize:12, color:C.muted }}>{r.submitted}</td>
                  <td style={{ padding:'10px', fontSize:12, color:C.success }}>{r.approved}</td>
                </tr>
              ))}
              {sorted.length===0 && <tr><td colSpan={6} style={{ padding:'30px', textAlign:'center', color:C.dim }}>No timesheet data for this period</td></tr>}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ── Compliance ────────────────────────────────────────────────────────────────
function ComplianceDashboard() {
  const { data, isLoading } = useComplianceReport();
  const d = data as any;
  // Build compliance summary array from the object shape
  const rows = d ? [
    { category:'Right to Work', compliance_pct: d.rtwSummary?.total>0?Math.round(d.rtwSummary.valid/d.rtwSummary.total*100):0, compliant:d.rtwSummary?.valid??0, expiring:d.rtwSummary?.expiring??0, expired:d.rtwSummary?.expired??0 },
    { category:'Visa / Immigration', compliance_pct: d.visaSummary?.total>0?Math.round(d.visaSummary.active/d.visaSummary.total*100):0, compliant:d.visaSummary?.active??0, expiring:d.visaSummary?.expiring30??0, expired:d.visaSummary?.expired??0 },
    { category:'Training', compliance_pct: d.trainingCompliance?.total>0?Math.round(d.trainingCompliance.completed/d.trainingCompliance.total*100):0, compliant:d.trainingCompliance?.completed??0, expiring:d.trainingCompliance?.mandatory_incomplete??0, expired:0 },
  ] : [];
  return isLoading?<Loading />:(
    <div>
      <SectionTitle>Compliance Overview</SectionTitle>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:16 }}>
        {rows.map((r:any)=>{
          const pct = r.compliance_pct;
          const color = pct>=90?C.success:pct>=70?C.warning:C.danger;
          return (
            <Card key={r.category} style={{ borderLeft:`4px solid ${color}` }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
                <div style={{ fontWeight:800, color:C.text, fontSize:14 }}>{r.category}</div>
                <div style={{ fontSize:22, fontWeight:900, color }}>{pct}%</div>
              </div>
              <ProgressBar value={pct} color={color} />
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, marginTop:10 }}>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:16, fontWeight:800, color:C.success }}>{r.compliant}</div>
                  <div style={{ fontSize:9, color:C.dim, textTransform:'uppercase' }}>Compliant</div>
                </div>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:16, fontWeight:800, color:C.warning }}>{r.expiring}</div>
                  <div style={{ fontSize:9, color:C.dim, textTransform:'uppercase' }}>Expiring</div>
                </div>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:16, fontWeight:800, color:C.danger }}>{r.expired}</div>
                  <div style={{ fontSize:9, color:C.dim, textTransform:'uppercase' }}>Expired</div>
                </div>
              </div>
            </Card>
          );
        })}
        {rows.length===0 && <div style={{textAlign:'center',padding:'40px',color:C.dim}}>No compliance data</div>}
      </div>
    </div>
  );
}

// ── Projects ──────────────────────────────────────────────────────────────────
function ProjectsReport() {
  const { data, isLoading } = useProjectReport();
  const rows = (data as any)?.budgetUsage ?? [];
  return isLoading?<Loading />:(
    <div>
      <SectionTitle>Project Delivery Report</SectionTitle>
      <Card>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ borderBottom:`2px solid ${C.border}` }}>
              {['Project','Status','Budget','Spent','Budget %','Tasks','Completion'].map(h=>(
                <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontSize:10, fontWeight:700, color:C.dim, textTransform:'uppercase', letterSpacing:'0.06em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r:any,i)=>(
              <tr key={i} style={{ borderBottom:`1px solid ${C.border}33`, background:i%2===0?'transparent':C.elevated+'44' }}>
                <td style={{ padding:'10px', fontSize:12, fontWeight:700, color:C.text }}>{r.name}</td>
                <td style={{ padding:'10px' }}><span style={{ background:r.status==='active'?C.success+'22':C.dim+'22', color:r.status==='active'?C.success:C.dim, borderRadius:6, fontSize:10, padding:'2px 8px', fontWeight:700 }}>{r.status}</span></td>
                <td style={{ padding:'10px', fontSize:12, color:C.muted }}>£{Number(r.budget||0).toLocaleString()}</td>
                <td style={{ padding:'10px', fontSize:12, color:Number(r.budget_pct)>90?C.danger:C.text }}>£{Number(r.spent||0).toLocaleString()}</td>
                <td style={{ padding:'10px', minWidth:100 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <div style={{ flex:1 }}><ProgressBar value={Number(r.budget_pct)||0} color={Number(r.budget_pct)>90?C.danger:C.warning} height={4} /></div>
                    <span style={{ fontSize:10, color:C.dim }}>{Number(r.budget_pct||0).toFixed(0)}%</span>
                  </div>
                </td>
                <td style={{ padding:'10px', fontSize:12, color:C.muted }}>{r.done_count}/{r.task_count}</td>
                <td style={{ padding:'10px', minWidth:100 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <div style={{ flex:1 }}><ProgressBar value={Number(r.completion_pct)||0} color={C.success} height={4} /></div>
                    <span style={{ fontSize:10, color:C.dim }}>{Number(r.completion_pct||0).toFixed(0)}%</span>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length===0 && <tr><td colSpan={7} style={{ padding:'30px', textAlign:'center', color:C.dim }}>No project data</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ReportingModule() {
  const [tab, setTab] = useState('headcount');
  return (
    <div className="animate-fadeIn">
      <div style={{ marginBottom:20 }}>
        <h2 style={{ color:C.text, fontSize:20, fontWeight:800, margin:0 }}>Reporting & Analytics</h2>
        <p style={{ color:C.muted, fontSize:12, margin:'4px 0 0' }}>Live operational dashboards</p>
      </div>
      <div style={{ display:'flex', gap:6, marginBottom:24, flexWrap:'wrap' }}>
        {TAB_LABELS.map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key)} style={{ background:tab===t.key?C.primary:C.elevated, color:tab===t.key?'#fff':C.muted, border:`1px solid ${tab===t.key?C.primary:C.border}`, borderRadius:8, padding:'7px 16px', fontSize:12, fontWeight:700, cursor:'pointer' }}>{t.label}</button>
        ))}
      </div>
      {tab==='headcount'  && <HeadcountReport />}
      {tab==='leave'      && <LeaveReport />}
      {tab==='timesheets' && <TimesheetReport />}
      {tab==='compliance' && <ComplianceDashboard />}
      {tab==='projects'   && <ProjectsReport />}
    </div>
  );
}

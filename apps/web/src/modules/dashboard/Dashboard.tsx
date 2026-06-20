import { useLiveDashboard, useNotifications } from '../../hooks/api';
import { useAppStore } from '../../store/appStore';
import { Loading, C } from '../../components/ui';

function LiveMetricCard({ label, value, icon, color, link, alert }: { label:string; value:number|string; icon:string; color:string; link?:string; alert?:boolean }) {
  const { setModule } = useAppStore();
  return (
    <div onClick={()=>link&&setModule(link as any)} style={{ background:C.card, border:`1px solid ${alert?C.danger+'66':C.border}`, borderRadius:16, padding:'18px 20px', cursor:link?'pointer':'default', position:'relative', overflow:'hidden', transition:'transform 0.15s', boxShadow:alert?`0 0 0 2px ${C.danger}33`:'none' }}
      onMouseEnter={e=>{if(link)e.currentTarget.style.transform='translateY(-2px)';}}
      onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';}}>
      <div style={{position:'absolute',top:0,left:0,right:0,height:3,background:color,borderRadius:'16px 16px 0 0'}} />
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
        <div>
          <div style={{fontSize:10,fontWeight:700,color:C.dim,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:8}}>{label}</div>
          <div style={{fontSize:32,fontWeight:900,color:alert?C.danger:C.text,lineHeight:1}}>{value}</div>
        </div>
        <div style={{fontSize:26,opacity:0.8}}>{icon}</div>
      </div>
      {link&&<div style={{fontSize:10,color:C.dim,marginTop:8}}>Click to view →</div>}
    </div>
  );
}

function ActionItem({ n, ..._ }: { n:any; [k:string]:any }) {
  const { setModule } = useAppStore();
  const COLORS: Record<string,string> = { urgent:C.danger, high:C.warning, medium:C.sky, low:C.dim };
  const color = COLORS[n.priority]??C.dim;
  return (
    <div onClick={()=>setModule(n.link)} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', background:C.surface, borderRadius:10, cursor:'pointer', border:`1px solid ${C.border}`, marginBottom:8, borderLeft:`3px solid ${color}` }}
      onMouseEnter={e=>e.currentTarget.style.borderColor=color}
      onMouseLeave={e=>{e.currentTarget.style.borderLeftColor=color;e.currentTarget.style.borderTopColor=C.border;e.currentTarget.style.borderRightColor=C.border;e.currentTarget.style.borderBottomColor=C.border;}}>
      <span style={{fontSize:20}}>{n.icon}</span>
      <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:C.text}}>{n.title}</div></div>
      <span style={{background:color+'22',color,borderRadius:6,fontSize:9,padding:'2px 7px',fontWeight:700,textTransform:'uppercase',flexShrink:0}}>{n.priority}</span>
      <span style={{color:C.dim,fontSize:12}}>→</span>
    </div>
  );
}

const ACTION_COLORS: Record<string,string> = { create:C.success, update:C.warning, delete:C.danger, approve:C.success, reject:C.danger, login:C.sky };

export default function DashboardModule() {
  const { data, isLoading } = useLiveDashboard();
  const { data:notifications } = useNotifications();
  const { setModule } = useAppStore();
  const m     = data?.metrics;
  const notifs = notifications??[];
  const urgent = notifs.filter(n=>n.priority==='urgent'||n.priority==='high');

  if (isLoading) return <Loading />;

  return (
    <div className="animate-fadeIn">
      <div style={{marginBottom:24}}>
        <div style={{fontSize:9,fontWeight:700,color:C.primary,textTransform:'uppercase',letterSpacing:'0.15em',marginBottom:4}}>XavvySuite</div>
        <h1 style={{color:C.text,fontSize:26,fontWeight:900,margin:'0 0 4px'}}>Operations Overview</h1>
        <p style={{color:C.muted,fontSize:13,margin:0}}>Live snapshot — click any card to dive in.</p>
      </div>

      {urgent.length>0&&(
        <div style={{background:C.danger+'11',border:`1px solid ${C.danger}33`,borderRadius:12,padding:'12px 16px',marginBottom:20,display:'flex',gap:12,alignItems:'center'}}>
          <span style={{fontSize:18}}>🚨</span>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:700,color:C.danger}}>{urgent.length} urgent item{urgent.length>1?'s':''} need attention</div>
            <div style={{fontSize:11,color:C.muted,marginTop:2}}>{urgent.map(n=>n.title).join(' · ')}</div>
          </div>
        </div>
      )}

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:14,marginBottom:28}}>
        <LiveMetricCard label="Active Employees"  value={m?.activeEmployees??0}       icon="👥" color={C.primary}   link="hr" />
        <LiveMetricCard label="On Leave Today"    value={m?.onLeaveToday??0}           icon="🌴" color={C.sky}      link="leave" />
        <LiveMetricCard label="Pending Approvals" value={m?.totalPendingApprovals??0}  icon="⏳" color={C.warning}   link="workflow" alert={(m?.totalPendingApprovals??0)>0} />
        <LiveMetricCard label="Open Roles"        value={m?.openJobs??0}               icon="💼" color={C.secondary} link="recruitment" />
        <LiveMetricCard label="Active Projects"   value={m?.activeProjects??0}         icon="📂" color="#A855F7"    link="pmo" />
        <LiveMetricCard label="Expiring RTW"      value={m?.expiringRTW??0}            icon="🛡" color={C.danger}    link="compliance" alert={(m?.expiringRTW??0)>0} />
        <LiveMetricCard label="Expiring Visas"    value={m?.expiringVisas??0}          icon="🛂" color={C.danger}    link="visa"       alert={(m?.expiringVisas??0)>0} />
        <LiveMetricCard label="In Onboarding"     value={m?.overdueOnboarding??0}      icon="🎯" color={C.success}   link="onboarding" />
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
        <div>
          <div style={{fontSize:11,fontWeight:700,color:C.dim,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:12}}>Action Required</div>
          {notifs.length===0?(
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:'24px 20px',textAlign:'center'}}>
              <div style={{fontSize:28,marginBottom:8}}>✅</div>
              <div style={{fontSize:13,color:C.muted,fontWeight:600}}>All clear</div>
              <div style={{fontSize:11,color:C.dim,marginTop:4}}>No items need attention</div>
            </div>
          ):(
            <div>{notifs.map((n: any, i: number)=><ActionItem key={i} n={n} />)}</div>
          )}
        </div>

        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <div style={{fontSize:11,fontWeight:700,color:C.dim,textTransform:'uppercase',letterSpacing:'0.1em'}}>Recent Activity</div>
            <button onClick={()=>setModule('audit' as any)} style={{background:'transparent',color:C.dim,border:'none',fontSize:11,cursor:'pointer'}}>View all →</button>
          </div>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:'4px 16px'}}>
            {(data?.recentActivity??[]).length===0?(
              <div style={{textAlign:'center',padding:'30px 20px',color:C.dim,fontSize:12}}>No recent activity</div>
            ):(data?.recentActivity??[]).map((item:any,i:number)=>(
              <div key={i} style={{display:'flex',gap:10,padding:'10px 0',borderBottom:`1px solid ${C.border}33`}}>
                <div style={{width:28,height:28,borderRadius:'50%',background:(ACTION_COLORS[item.action]??C.dim)+'22',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <span style={{fontSize:11,fontWeight:800,color:ACTION_COLORS[item.action]??C.dim,textTransform:'uppercase'}}>{item.action[0]}</span>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,color:C.text}}>
                    <span style={{fontWeight:600}}>{item.user_email?.split('@')[0]??'System'}</span>
                    {' '}<span style={{color:ACTION_COLORS[item.action]??C.muted}}>{item.action}</span>
                    {' '}<span style={{color:C.muted}}>{item.resource?.replace(/_/g,' ')}</span>
                  </div>
                  <div style={{fontSize:10,color:C.dim,marginTop:2}}>
                    {new Date(item.created_at).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{marginTop:24,paddingTop:20,borderTop:`1px solid ${C.border}`}}>
        <div style={{fontSize:11,fontWeight:700,color:C.dim,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:12}}>Quick Actions</div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {[
            {label:'+ Add Employee',    link:'hr',          icon:'👤'},
            {label:'+ Request Leave',   link:'leave',       icon:'🌴'},
            {label:'+ Submit Timesheet',link:'timesheets',  icon:'⏱'},
            {label:'+ Submit Expense',  link:'expenses',    icon:'💳'},
            {label:'+ Post Job',        link:'recruitment', icon:'💼'},
            {label:'View Reports',      link:'reporting',   icon:'📊'},
          ].map(q=>(
            <button key={q.link} onClick={()=>setModule(q.link as any)} style={{background:C.elevated,color:C.muted,border:`1px solid ${C.border}`,borderRadius:10,padding:'8px 14px',fontSize:12,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:6,transition:'all 0.12s'}}
              onMouseEnter={e=>{e.currentTarget.style.background=C.primary+'22';e.currentTarget.style.color=C.primary;e.currentTarget.style.borderColor=C.primary+'44';}}
              onMouseLeave={e=>{e.currentTarget.style.background=C.elevated;e.currentTarget.style.color=C.muted;e.currentTarget.style.borderColor=C.border;}}>
              <span>{q.icon}</span>{q.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

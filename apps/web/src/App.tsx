import { useState, ReactNode } from 'react';
const API_URL = import.meta.env.VITE_API_URL ?? '';
import { useAuth, AuthProvider } from './context/AuthContext';
import { TenantProvider, useTenant } from './platform/tenancy/TenantContext';
import { usePermission } from './platform/permissions';
import { useAppStore } from './store/appStore';
import { useNotifications, useDismissNotification } from './hooks/api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { C } from './platform/branding/theme';

// Module pages
import DashboardModule     from './modules/dashboard/Dashboard';
import HRModule            from './modules/hr/HR';
import LeaveModule         from './modules/leave/Leave';
import TimesheetsModule    from './modules/timesheets/Timesheets';
import ExpensesModule      from './modules/expenses/Expenses';
import ComplianceModule    from './modules/compliance/Compliance';
import PMOModule           from './modules/pmo/PMO';
import RecruitmentModule   from './modules/recruitment/Recruitment';
import DocumentsModule     from './modules/documents/Documents';
import AssetsModule        from './modules/assets/Assets';
import TrainingModule      from './modules/training/Training';
import AnnouncementsModule from './modules/announcements/Announcements';
import AuditModule         from './modules/audit/Audit';
import SchedulerModule     from './modules/scheduler/Scheduler';
import WorkflowModule      from './modules/workflow/Workflow';
import OrgChartModule      from './modules/orgchart/OrgChart';
import OnboardingModule    from './modules/onboarding/Onboarding';
import VisaModule          from './modules/visa/Visa';
import {  } from './modules/leave/Leave';
import {  } from './modules/leave/Leave';
import ReportingModule      from './modules/reporting/Reporting';
import ChecklistsModule     from './modules/checklists/Checklists';
import OffboardingNewModule  from './modules/offboarding/Offboarding';
import SOSModule             from './modules/sos/SOS';
import ResourcesModule       from './modules/resources/Resources';
import SettingsModule        from './modules/settings/Settings';
import BillingModule         from './modules/billing/Billing';
import SignupPage             from './modules/auth/SignupPage';

// Module manifests
import dashboardManifest     from './modules/dashboard/manifest';
import hrManifest            from './modules/hr/manifest';
import leaveManifest         from './modules/leave/manifest';
import timesheetsManifest    from './modules/timesheets/manifest';
import expensesManifest      from './modules/expenses/manifest';
import complianceManifest    from './modules/compliance/manifest';
import pmoManifest           from './modules/pmo/manifest';
import recruitmentManifest   from './modules/recruitment/manifest';
import documentsManifest     from './modules/documents/manifest';
import assetsManifest        from './modules/assets/manifest';
import trainingManifest      from './modules/training/manifest';
import announcementsManifest from './modules/announcements/manifest';
import auditManifest         from './modules/audit/manifest';
import schedulerManifest     from './modules/scheduler/manifest';
import workflowManifest      from './modules/workflow/manifest';
import orgchartManifest      from './modules/orgchart/manifest';
import onboardingManifest    from './modules/onboarding/manifest';
import visaManifest          from './modules/visa/manifest';
import reportingManifest      from './modules/reporting/manifest';
import checklistsManifest     from './modules/checklists/manifest';
import offboardingManifest  from './modules/offboarding/manifest';
import sosManifest          from './modules/sos/manifest';
import resourcesManifest    from './modules/resources/manifest';
import settingsManifest     from './modules/settings/manifest';
import billingManifest        from './modules/billing/manifest';
import PayrollReviewModule  from './modules/finance/PayrollReview';
import financePayrollManifest from './modules/finance/manifest';

const qc = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

const MODULE_COMPONENTS: Record<string, React.ComponentType> = {
  dashboard: DashboardModule, hr: HRModule, leave: LeaveModule,
  timesheets: TimesheetsModule, expenses: ExpensesModule,
  compliance: ComplianceModule, pmo: PMOModule,
  recruitment: RecruitmentModule, documents: DocumentsModule,
  assets: AssetsModule, training: TrainingModule,
  announcements: AnnouncementsModule, audit: AuditModule,
  scheduler: SchedulerModule,
  workflow:     WorkflowModule,
  orgchart:     OrgChartModule,
  onboarding:    OnboardingModule,
  visa:          VisaModule,
  reporting:      ReportingModule,
  checklists:     ChecklistsModule,
  offboarding2:   OffboardingNewModule,
  sos:            SOSModule,
  resources:      ResourcesModule,
  settings:       SettingsModule,
  billing:        BillingModule,
  finance_payroll: PayrollReviewModule,
};

const ALL_MANIFESTS = [
  dashboardManifest,
  hrManifest,
  leaveManifest,
  timesheetsManifest,
  expensesManifest,
  complianceManifest,
  pmoManifest,
  recruitmentManifest,
  documentsManifest,
  assetsManifest,
  trainingManifest,
  announcementsManifest,
  auditManifest,
  schedulerManifest,
  workflowManifest,
  orgchartManifest,
  onboardingManifest,
  visaManifest,
  reportingManifest,
  checklistsManifest,
  offboardingManifest,
  sosManifest,
  resourcesManifest,
  settingsManifest,
  billingManifest,,
  financePayrollManifest,
];

const NAV_GROUPS = ['core','people','projects','finance','ops','legal','work','comms','admin'] as const;
const GROUP_LABELS: Record<string, string> = {
  core: '', people: 'People', legal: 'Compliance',
  projects: 'Projects',
  finance: 'Finance',
  ops: 'Reports & Analytics',
  work: 'Work', comms: 'Comms', admin: 'Admin',
};

// ── Notifications Bell ───────────────────────────────────────────────────────
function NotificationsBell() {
  const { data: notifs } = useNotifications();
  const dismiss = useDismissNotification();
  const { setModule } = useAppStore();
  const [open, setOpen] = useState(false);
  const urgent  = (notifs ?? []).filter((n: any) => n.priority === 'urgent' || n.priority === 'high');
  const count   = urgent.length;

  return (
    <div style={{ position: 'relative', padding: '8px 14px', borderBottom: `1px solid ${C.border}` }}>
      <button onClick={() => setOpen(!open)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: C.muted, width: '100%', padding: '4px 0' }}>
        <span style={{ fontSize: 16 }}>🔔</span>
        <span style={{ fontSize: 12, fontWeight: 600 }}>Notifications</span>
        {count > 0 && (
          <span style={{ background: C.danger, color: '#fff', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, marginLeft: 'auto' }}>
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: C.card, border: `1px solid ${C.border}`, borderRadius: '0 0 10px 10px', zIndex: 100, maxHeight: 320, overflowY: 'auto', boxShadow: '0 8px 24px #00000066' }}>
          {(notifs ?? []).length === 0 ? (
            <div style={{ padding: '20px 16px', textAlign: 'center', color: C.dim, fontSize: 12 }}>✅ All clear</div>
          ) : (notifs ?? []).map((n: any) => {
            const COLORS: Record<string,string> = { urgent: C.danger, high: C.warning, medium: C.sky, low: C.dim };
            const color = COLORS[n.priority] ?? C.dim;
            return (
              <div key={n.id} style={{ display: 'flex', gap: 10, padding: '10px 14px', borderBottom: `1px solid ${C.border}33`, alignItems: 'flex-start' }}
                onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => e.currentTarget.style.background = C.elevated}
                onMouseLeave={(e: React.MouseEvent<any>) => e.currentTarget.style.background = 'transparent'}>
                <span onClick={() => { setModule(n.link as any); setOpen(false); }} style={{ fontSize: 14, flexShrink: 0, cursor: 'pointer' }}>{n.icon}</span>
                <div onClick={() => { setModule(n.link as any); setOpen(false); }} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
                  <div style={{ fontSize: 11, color: C.text, fontWeight: 600, lineHeight: 1.3 }}>{n.title}</div>
                </div>
                <span style={{ background: color + '22', color, borderRadius: 4, fontSize: 8, padding: '1px 5px', fontWeight: 700, textTransform: 'uppercase', flexShrink: 0 }}>{n.priority}</span>
                <button onClick={async (e: React.MouseEvent) => { e.stopPropagation(); await dismiss.mutateAsync({ id: n.id }); }} title="Dismiss" style={{ background: 'none', border: 'none', color: C.dim, fontSize: 14, cursor: 'pointer', padding: '0 2px', lineHeight: 1, flexShrink: 0 }}>×</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Shell ─────────────────────────────────────────────────────────────────────
function Shell() {
  const { user, logout } = useAuth();
  const { tenant, isModuleEnabled } = useTenant();
  const { can, isSuperAdmin } = usePermission();
  const { activeModule, setModule } = useAppStore();

  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === '1');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('sidebar_groups') ?? '[]')); }
    catch { return new Set(); }
  });
  const toggleGroup = (group: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      next.has(group) ? next.delete(group) : next.add(group);
      localStorage.setItem('sidebar_groups', JSON.stringify([...next]));
      return next;
    });
  };
  const toggleSidebar = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('sidebar_collapsed', next ? '1' : '0');
  };

  const companyName = tenant?.branding?.company_name ?? 'XavvySuite';
  const logoLetter  = companyName[0].toUpperCase();
  const initials    = user?.email?.slice(0, 2).toUpperCase() ?? '??';
  const roleName    = user?.roles?.[0]?.replace(/_/g, ' ') ?? 'user';

  // Active module component — fall back to dashboard
  const ActiveModule = MODULE_COMPONENTS[activeModule] ?? DashboardModule;

  // Filter nav: module must be enabled for tenant AND user must have at least
  // one of the module's permissions (or be super admin, or module has no perms)
  const visibleManifests = ALL_MANIFESTS.filter((m: any) => {
    if (!isModuleEnabled(m.key) && !['dashboard','audit','scheduler'].includes(m.key)) return false;
    if (isSuperAdmin) return true;
    if (m.permissions.length === 0) return true;
    return m.permissions.some((p: any) => can(p));
  });

  return (
    <div style={{ display:'flex', height:'100vh', background:C.bg, color:C.text, overflow:'hidden', fontFamily:'Inter, system-ui, sans-serif' }}>

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside style={{ width:collapsed?56:200, minWidth:collapsed?56:200, background:C.surface, borderRight:`1px solid ${C.border}`, display:'flex', flexDirection:'column', flexShrink:0, overflowY:'auto', transition:'width 0.2s ease', overflow:'hidden' }}>

        {/* Logo / brand */}
        <div style={{ padding: collapsed ? '12px 0' : '14px 16px 12px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent: collapsed ? 'center' : 'space-between', gap:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
            {/* Logo mark */}
            {(tenant?.branding as any)?.logo_url ? (
              <img
                data-logo="true"
                src={(tenant.branding as any).logo_url}
                alt={companyName}
                style={{ width: collapsed ? 32 : 36, height: collapsed ? 32 : 36, borderRadius:8, objectFit:'contain', flexShrink:0, background:'transparent' }}
                onError={e => { (e.target as HTMLImageElement).style.display='none'; }}
              />
            ) : (
              <div style={{ width: collapsed ? 32 : 36, height: collapsed ? 32 : 36, borderRadius:10, background:`linear-gradient(135deg,${C.primary},#8B5CF6)`, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize: collapsed ? 16 : 18, fontWeight:900, flexShrink:0, boxShadow:`0 2px 8px ${C.primary}44` }}>
                {logoLetter}
              </div>
            )}
            {!collapsed && (
              <div style={{ minWidth:0 }}>
                <div style={{ fontWeight:900, color:C.text, fontSize:13, letterSpacing:'-0.02em', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{companyName}</div>
                <div style={{ fontSize:9, color:C.primary, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em' }}>Platform</div>
              </div>
            )}
          </div>
          {/* Collapse toggle */}
          <button onClick={toggleSidebar} title={collapsed ? 'Expand' : 'Collapse'} style={{ background:'none', border:'none', color:C.dim, cursor:'pointer', fontSize:11, padding:'2px 4px', borderRadius:4, lineHeight:1, flexShrink:0, opacity:0.6 }}>
            {collapsed ? '▶' : '◀'}
          </button>
        </div>

        {/* User pill + Sign Out */}
        <div style={{ padding:'12px 14px', borderBottom:`1px solid ${C.border}` }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:28, height:28, borderRadius:'50%', background:C.primary+'33', border:`1.5px solid ${C.primary}55`, display:'flex', alignItems:'center', justifyContent:'center', color:C.primary, fontSize:10, fontWeight:800, flexShrink:0 }}>
              {initials}
            </div>
            {!collapsed && (
              <div style={{ minWidth:0, flex:1 }}>
                <div style={{ fontSize:11, fontWeight:700, color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {user?.email?.split('@')[0]}
                </div>
                <div style={{ fontSize:9, color:C.primary, textTransform:'uppercase', letterSpacing:'0.06em' }}>{roleName}</div>
                <button onClick={logout} style={{ marginTop:6, background:'none', border:`1px solid ${C.border}`, borderRadius:6, color:C.dim, cursor:'pointer', fontSize:10, fontWeight:700, padding:'3px 8px', width:'100%', textAlign:'left' }}>
                  🚪 Sign Out
                </button>
              </div>
            )}
            {collapsed && (
              <button onClick={logout} title="Sign Out" style={{ background:'none', border:`1px solid ${C.border}`, borderRadius:6, color:C.dim, cursor:'pointer', fontSize:11, padding:'4px 6px' }}>
                🚪
              </button>
            )}
          </div>
        </div>

        {/* Nav — manifest-driven, tenant-filtered, permission-filtered */}
        <nav style={{ padding:'10px 8px', flex:1, overflowY:'auto' }}>
          {NAV_GROUPS.map(group => {
            const items = visibleManifests.filter((m: any) => m.group === group);
            if (items.length === 0) return null;
            const label = GROUP_LABELS[group];
            const isGroupCollapsed = collapsedGroups.has(group);
            const hasActive = items.some((m: any) => activeModule === m.key);
            return (
              <div key={group}>
                {/* Group header — clickable to collapse (hidden when sidebar collapsed) */}
                {label && !collapsed && (
                  <button onClick={() => toggleGroup(group)} style={{
                    width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
                    padding:'10px 10px 4px', background:'none', border:'none', cursor:'pointer',
                  }}>
                    <span style={{ fontSize:9, fontWeight:700, color: hasActive ? C.primary : C.dim, textTransform:'uppercase', letterSpacing:'0.1em' }}>
                      {label}
                    </span>
                    <span style={{ fontSize:9, color:C.dim, opacity:0.6 }}>
                      {isGroupCollapsed ? '▶' : '▼'}
                    </span>
                  </button>
                )}
                {/* Items — hidden when group collapsed (unless sidebar itself is collapsed, always show icons) */}
                {(!isGroupCollapsed || collapsed) && items.map((m: any) => {
                  const isActive = activeModule === m.key;
                  return (
                    <button key={m.key} onClick={() => setModule(m.key as any)} title={collapsed ? m.title : undefined} style={{
                      width:'100%', display:'flex', alignItems:'center',
                      gap: collapsed ? 0 : 9,
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      padding: collapsed ? '9px 0' : '7px 10px',
                      borderRadius:8, marginBottom:2, border:'none',
                      background: isActive ? C.primary+'22' : 'transparent',
                      color:      isActive ? '#818CF8'       : C.muted,
                      cursor:'pointer', fontSize:12,
                      fontWeight: isActive ? 700 : 500,
                      borderLeft: isActive ? `3px solid ${C.primary}` : '3px solid transparent',
                      transition:'all 0.12s', textAlign:'left',
                    }}>
                      <span style={{ fontSize:14, width:18, textAlign:'center', flexShrink:0 }}>{m.icon}</span>
                      {!collapsed && m.title}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>


      </aside>

      {/* ── Main ──────────────────────────────────────────────────────────── */}
      <main style={{ flex:1, overflowY:'auto', background:C.bg }}>
        <div style={{ maxWidth:1200, margin:'0 auto', padding:'24px 32px' }}>
          <ActiveModule />
        </div>
      </main>
    </div>
  );
}

// ── Login ─────────────────────────────────────────────────────────────────────
function LoginPage({ onSignup }: { onSignup?: () => void }) {
  const { login, shell } = useAuth();
  const [mode, setMode]           = useState<'password'|'magic'|'mfa'>('password');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [mfaToken, setMfaToken]   = useState('');
  const [mfaChallenge, setChallenge] = useState('');
  const [magicSent, setMagicSent] = useState(false);
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);
  const companyName  = shell?.branding?.company_name ?? 'XavvySuite';
  const primaryColor = shell?.branding?.primary_color ?? C.primary;
  const inp = { width:'100%', background:C.elevated, border:`1px solid ${C.border}`, borderRadius:10, padding:'10px 14px', color:C.text, fontSize:13, outline:'none', boxSizing:'border-box' as const };
  const lbl = { display:'block' as const, fontSize:10, fontWeight:700, color:C.dim, textTransform:'uppercase' as const, letterSpacing:'0.08em', marginBottom:6 };

  // SSO callback: pick up tokens from URL hash
  if (typeof window !== 'undefined' && window.location.hash.includes('access_token')) {
    const p = new URLSearchParams(window.location.hash.slice(1));
    const at = p.get('access_token'), rt = p.get('refresh_token');
    if (at && rt) { localStorage.setItem('xs_token',at); localStorage.setItem('xs_refresh',rt); window.location.hash=''; window.location.reload(); }
  }

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const result = await login(email, password) as any;
      if (result?.mfaRequired) { setChallenge(result.mfaChallenge); setMode('mfa'); }
    } catch (err: any) { setError(err.message ?? 'Login failed'); }
    finally { setLoading(false); }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try { await fetch(`\${API_URL}/api/auth/magic-link`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})}); setMagicSent(true); }
    catch { setError('Failed to send magic link'); } finally { setLoading(false); }
  };

  const handleMFA = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res  = await fetch(`\${API_URL}/api/auth/mfa/verify`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:mfaToken,challenge:mfaChallenge})});
      const data = await res.json() as any;
      if (!data.ok) throw new Error(data.error ?? 'Invalid code');
      localStorage.setItem('xs_token',data.data.accessToken); localStorage.setItem('xs_refresh',data.data.refreshToken); window.location.reload();
    } catch(err:any) { setError(err.message??'Invalid code'); } finally { setLoading(false); }
  };

  return (
    <div style={{minHeight:'100vh',background:C.bg,display:'flex',alignItems:'center',justifyContent:'center',padding:20,fontFamily:'Inter,system-ui,sans-serif'}}>
      <div style={{width:'100%',maxWidth:380}}>
        <div style={{textAlign:'center',marginBottom:32}}>
          <div style={{width:52,height:52,borderRadius:16,background:`linear-gradient(135deg,${primaryColor},#8B5CF6)`,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:900,fontSize:22,margin:'0 auto 16px',boxShadow:`0 8px 24px ${primaryColor}44`}}>
            {companyName[0]}
          </div>
          <h1 style={{color:C.text,fontSize:24,fontWeight:900,margin:'0 0 4px'}}>{companyName}</h1>
          <p style={{color:C.muted,fontSize:11,margin:0,textTransform:'uppercase',letterSpacing:'0.1em',fontWeight:700}}>Workforce Platform</p>
        </div>

        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:20,padding:24}}>
          {error&&<div style={{background:C.danger+'15',border:`1px solid ${C.danger}33`,borderRadius:10,padding:'10px 14px',marginBottom:16,color:C.danger,fontSize:13,textAlign:'center'}}>{error}</div>}

          {mode==='mfa'&&(
            <form onSubmit={handleMFA}>
              <div style={{textAlign:'center',marginBottom:20}}><div style={{fontSize:32,marginBottom:8}}>📱</div><div style={{fontWeight:700,color:C.text}}>Two-Factor Auth</div><div style={{fontSize:12,color:C.muted,marginTop:4}}>Enter the 6-digit code from your app</div></div>
              <div style={{marginBottom:16}}><input type="text" maxLength={6} value={mfaToken} onChange={(e:any)=>setMfaToken(e.target.value.replace(/\D/g,''))} style={{...inp,letterSpacing:'0.3em',textAlign:'center',fontSize:24,fontWeight:800}} placeholder="000000" autoFocus /></div>
              <button type="submit" disabled={loading||mfaToken.length!==6} style={{width:'100%',background:primaryColor,color:'#fff',border:'none',borderRadius:10,padding:11,fontSize:14,fontWeight:700,cursor:'pointer'}}>{loading?'Verifying...':'Verify →'}</button>
              <div style={{textAlign:'center',marginTop:12}}><button type="button" onClick={()=>setMode('password')} style={{background:'none',border:'none',color:C.dim,fontSize:12,cursor:'pointer'}}>← Back</button></div>
            </form>
          )}

          {mode==='magic'&&magicSent&&(
            <div style={{textAlign:'center',padding:'10px 0'}}>
              <div style={{fontSize:40,marginBottom:12}}>📧</div>
              <div style={{fontWeight:700,color:C.text,fontSize:15,marginBottom:8}}>Check your email</div>
              <div style={{fontSize:13,color:C.muted}}>Sign-in link sent to <strong>{email}</strong>. Expires in 15 minutes.</div>
              <button onClick={()=>{setMagicSent(false);setMode('password');}} style={{background:'transparent',border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 16px',fontSize:12,color:C.muted,cursor:'pointer',marginTop:16}}>← Back</button>
            </div>
          )}

          {mode!=='mfa'&&!magicSent&&(
            <>
              <div style={{display:'flex',gap:6,marginBottom:20}}>
                {[{k:'password',l:'Password'},{k:'magic',l:'Magic Link'}].map(m=>(
                  <button key={m.k} type="button" onClick={()=>setMode(m.k as any)} style={{flex:1,background:mode===m.k?primaryColor:C.elevated,color:mode===m.k?'#fff':C.muted,border:`1px solid ${mode===m.k?primaryColor:C.border}`,borderRadius:8,padding:'7px 0',fontSize:12,fontWeight:700,cursor:'pointer'}}>{m.l}</button>
                ))}
              </div>

              {mode==='password'&&(
                <form onSubmit={handlePassword}>
                  <div style={{marginBottom:14}}><label style={lbl}>Email</label><input type="email" required value={email} onChange={(e:any)=>setEmail(e.target.value)} style={inp} placeholder="you@company.com" /></div>
                  <div style={{marginBottom:20}}><label style={lbl}>Password</label><input type="password" required value={password} onChange={(e:any)=>setPassword(e.target.value)} style={inp} placeholder="••••••••" /></div>
                  <button type="submit" disabled={loading} style={{width:'100%',background:loading?primaryColor+'AA':primaryColor,color:'#fff',border:'none',borderRadius:10,padding:11,fontSize:14,fontWeight:700,cursor:loading?'wait':'pointer'}}>{loading?'Signing in...':'Sign In →'}</button>
                </form>
              )}

              {mode==='magic'&&(
                <form onSubmit={handleMagicLink}>
                  <div style={{marginBottom:20}}><label style={lbl}>Your email</label><input type="email" required value={email} onChange={(e:any)=>setEmail(e.target.value)} style={inp} placeholder="you@company.com" /></div>
                  <button type="submit" disabled={loading||!email} style={{width:'100%',background:primaryColor,color:'#fff',border:'none',borderRadius:10,padding:11,fontSize:14,fontWeight:700,cursor:'pointer'}}>{loading?'Sending...':'Send Magic Link →'}</button>
                  <div style={{fontSize:11,color:C.dim,textAlign:'center',marginTop:8}}>No password needed. We email you a secure link.</div>
                </form>
              )}

              <div style={{marginTop:20,paddingTop:16,borderTop:`1px solid ${C.border}`}}>
                <div style={{fontSize:10,fontWeight:700,color:C.dim,textTransform:'uppercase',letterSpacing:'0.08em',textAlign:'center',marginBottom:10}}>Or continue with</div>
                <div style={{display:'flex',gap:8}}>
                  {[{href:'/api/auth/entra/redirect',label:'🏢 Microsoft'},{href:'/api/auth/google/redirect',label:'🔵 Google'},{href:'/api/auth/saml/redirect',label:'🔐 SAML'}].map(s=>(
                    <a key={s.href} href={s.href} style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:6,background:C.elevated,border:`1px solid ${C.border}`,borderRadius:10,padding:'9px 0',fontSize:11,fontWeight:600,color:C.muted,textDecoration:'none'}}>{s.label}</a>
                  ))}
                </div>
              </div>
              {onSignup && (
                <div style={{marginTop:16,paddingTop:14,borderTop:`1px solid ${C.border}33`,textAlign:'center'}}>
                  <span style={{fontSize:12,color:C.dim}}>Don't have an account? </span>
                  <button type="button" onClick={onSignup} style={{background:'none',border:'none',color:primaryColor,fontSize:12,fontWeight:700,cursor:'pointer',textDecoration:'underline'}}>
                    Start free trial →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
function AppInner() {
  const { user, loading } = useAuth();
  const [page, setPage] = useState<'login'|'signup'>(
    window.location.pathname === '/signup' ? 'signup' : 'login'
  );

  if (loading) return (
    <div style={{ minHeight:'100vh', background:C.bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ color:C.muted, fontSize:13 }}>Loading...</div>
    </div>
  );
  if (user) return <Shell />;
  if (page === 'signup') return <SignupPage onBack={() => setPage('login')} />;
  return <LoginPage onSignup={() => setPage('signup')} />;
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <TenantProvider>
          <AppInner />
        </TenantProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

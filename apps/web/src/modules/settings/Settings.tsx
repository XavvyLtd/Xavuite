import { useState, useEffect } from 'react';
const API_URL = import.meta.env.VITE_API_URL ?? '';
import { useSettings, useUpdateBranding, useModuleSettings,
         useMFAStatus, useMFASetup, useMFAConfirm, useMFADisable,
         useSSORProviders, useSaveSSORProvider } from '../../hooks/api';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { Card, Loading, Alert, FormField, inputStyle, selectStyle, C } from '../../components/ui';

// ── MFA Setup Component ───────────────────────────────────────────────────────
function MFASettings() {
  const { data: mfaStatus, refetch } = useMFAStatus();
  const setup   = useMFASetup();
  const confirm = useMFAConfirm();
  const disable = useMFADisable();
  const [step, setStep]         = useState<'idle'|'setup'|'confirm'|'done'>('idle');
  const [qrUrl, setQrUrl]       = useState('');
  const [secret, setSecret]     = useState('');
  const [token, setToken]       = useState('');
  const [backups, setBackups]   = useState<string[]>([]);
  const [disableToken, setDis]  = useState('');
  const [err, setErr]           = useState('');
  const enabled = mfaStatus?.mfa?.enabled === 1;

  const handleSetup = async () => {
    setErr('');
    const result = await setup.mutateAsync({}) as any;
    setQrUrl(result.data.qrUrl);
    setSecret(result.data.secret);
    setStep('setup');
  };

  const handleConfirm = async () => {
    setErr('');
    try {
      const result = await confirm.mutateAsync({ token }) as any;
      setBackups(result.data.backupCodes);
      setStep('done');
      refetch();
    } catch(e:any) { setErr(e.message ?? 'Invalid code'); }
  };

  const handleDisable = async () => {
    if (!disableToken) { setErr('Enter your current TOTP code'); return; }
    setErr('');
    try { await disable.mutateAsync({ token: disableToken }); refetch(); setDis(''); }
    catch(e:any) { setErr(e.message ?? 'Invalid code'); }
  };

  return (
    <Card>
      <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:4}}>Two-Factor Authentication (MFA)</div>
      <div style={{fontSize:12,color:C.muted,marginBottom:16}}>Secure your account with a TOTP authenticator app (Google Authenticator, Authy, 1Password).</div>

      {err && <Alert type="error" message={err} />}

      {!enabled && step==='idle' && (
        <button onClick={handleSetup} style={{background:C.primary,color:'#fff',border:'none',borderRadius:8,padding:'9px 20px',fontSize:13,fontWeight:700,cursor:'pointer'}}>
          🔐 Set Up MFA
        </button>
      )}

      {step==='setup' && (
        <div>
          <div style={{fontSize:12,color:C.muted,marginBottom:12}}>Scan this QR code with your authenticator app:</div>
          <img src={qrUrl} alt="TOTP QR Code" style={{borderRadius:8,border:`1px solid ${C.border}`,display:'block',marginBottom:12}} />
          <div style={{fontSize:11,color:C.dim,marginBottom:12}}>Manual entry key: <code style={{background:C.elevated,padding:'2px 6px',borderRadius:4,fontSize:12}}>{secret}</code></div>
          <FormField label="Enter the 6-digit code from your app">
            <div style={{display:'flex',gap:8}}>
              <input style={{...inputStyle,maxWidth:160,letterSpacing:'0.2em',textAlign:'center',fontSize:18,fontWeight:700}} maxLength={6} value={token} onChange={e=>setToken(e.target.value.replace(/\D/g,''))} placeholder="000000" />
              <button onClick={handleConfirm} disabled={token.length!==6||confirm.isPending} style={{background:C.success,color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:700,cursor:'pointer'}}>
                Verify →
              </button>
            </div>
          </FormField>
        </div>
      )}

      {step==='done' && (
        <div>
          <Alert type="success" message="MFA enabled successfully!" />
          <div style={{marginTop:12,background:C.surface,borderRadius:10,padding:14,border:`1px solid ${C.border}`}}>
            <div style={{fontSize:12,fontWeight:700,color:C.warning,marginBottom:8}}>⚠️ Save your backup codes — these will only be shown once:</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
              {backups.map(code=>(
                <code key={code} style={{background:C.elevated,padding:'4px 10px',borderRadius:6,fontSize:13,fontWeight:700,letterSpacing:'0.08em',color:C.text}}>{code}</code>
              ))}
            </div>
          </div>
          <button onClick={()=>setStep('idle')} style={{background:C.primary+'22',color:C.primary,border:`1px solid ${C.primary}33`,borderRadius:8,padding:'7px 14px',fontSize:12,fontWeight:700,cursor:'pointer',marginTop:12}}>Done</button>
        </div>
      )}

      {enabled && step==='idle' && (
        <div>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16}}>
            <span style={{background:C.success+'22',color:C.success,borderRadius:20,padding:'4px 12px',fontSize:12,fontWeight:700}}>✓ MFA Enabled</span>
            {mfaStatus?.mfa?.enrolled_at && <span style={{fontSize:11,color:C.dim}}>Enrolled {new Date(mfaStatus.mfa.enrolled_at).toLocaleDateString()}</span>}
          </div>
          <div style={{fontSize:12,color:C.muted,marginBottom:8}}>To disable MFA, enter your current TOTP code:</div>
          <div style={{display:'flex',gap:8}}>
            <input style={{...inputStyle,maxWidth:160,letterSpacing:'0.2em',textAlign:'center',fontSize:18,fontWeight:700}} maxLength={6} value={disableToken} onChange={e=>setDis(e.target.value.replace(/\D/g,''))} placeholder="000000" />
            <button onClick={handleDisable} disabled={disableToken.length!==6} style={{background:C.danger+'22',color:C.danger,border:`1px solid ${C.danger}44`,borderRadius:8,padding:'8px 14px',fontSize:12,fontWeight:700,cursor:'pointer'}}>
              Disable MFA
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

// ── SSO Provider Card ─────────────────────────────────────────────────────────
const SSO_PROVIDERS = [
  { key:'entra',  label:'Microsoft Entra ID', icon:'🏢', fields:['clientId','clientSecret','tenantDomain'] },
  { key:'google', label:'Google Workspace',   icon:'🔵', fields:['clientId','clientSecret','tenantDomain'] },
  { key:'saml',   label:'SAML 2.0',           icon:'🔐', fields:['samlSsoUrl','samlEntityId','samlCert'] },
];

function SSOProviderCard({ providerKey, label, icon, existing }: { providerKey:string; label:string; icon:string; existing?:any }) {
  const save = useSaveSSORProvider();
  const qc   = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const isConfigured = !!(existing?.client_id || existing?.saml_sso_url);
  const [saved, setSaved]       = useState(false);
  const [form, setForm]         = useState({
    enabled: existing?.enabled ?? 0,
    clientId: existing?.client_id ?? '',
    clientSecret: '',
    tenantDomain: existing?.tenant_domain ?? '',
    samlSsoUrl:   existing?.saml_sso_url  ?? '',
    samlEntityId: existing?.saml_entity_id?? '',
    samlCert:     existing?.saml_cert     ?? '',
    autoProvision: existing?.auto_provision ?? 1,
    forceSso:      existing?.force_sso      ?? 0,
    defaultRole:   existing?.default_role   ?? 'role-employee',
  });
  const set = (k:string,v:any) => setForm(f=>({...f,[k]:v}));

  const handleSave = async () => {
    await save.mutateAsync({ ...form, provider:providerKey });
    qc.invalidateQueries({queryKey:['sso']});
    setSaved(true); setTimeout(()=>setSaved(false),3000);
  };

  return (
    <Card style={{borderLeft:`4px solid ${form.enabled?C.success:C.border}`}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:22}}>{icon}</span>
          <div>
            <div style={{fontWeight:700,fontSize:14,color:C.text}}>{label}</div>
            {isConfigured ? (
              <div style={{fontSize:11,color:form.enabled?C.success:C.dim}}>{form.enabled?'● Enabled':'○ Configured but disabled'}</div>
            ) : (
              <div style={{fontSize:11,color:C.dim}}>○ Not configured</div>
            )}
          </div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {!isConfigured && !expanded && (
            <span style={{fontSize:10,color:C.dim,background:C.elevated,border:`1px solid ${C.border}`,borderRadius:6,padding:'3px 8px'}}>Setup required</span>
          )}
          {isConfigured && (
            <button onClick={()=>set('enabled',form.enabled?0:1)} style={{background:form.enabled?C.success+'22':C.dim+'22',color:form.enabled?C.success:C.dim,border:`1px solid ${form.enabled?C.success+'44':C.dim+'33'}`,borderRadius:8,padding:'5px 12px',fontSize:11,fontWeight:700,cursor:'pointer'}}>
              {form.enabled?'● On':'○ Off'}
            </button>
          )}
          <button onClick={()=>setExpanded(!expanded)} style={{background:expanded?C.primary+'22':C.elevated,color:expanded?C.primary:C.muted,border:`1px solid ${expanded?C.primary+'44':C.border}`,borderRadius:8,padding:'5px 12px',fontSize:11,cursor:'pointer',fontWeight:600}}>
            {expanded?'▲ Hide':'▼ Configure'}
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{marginTop:16,paddingTop:16,borderTop:`1px solid ${C.border}`}}>
          {saved && <Alert type="success" message="Configuration saved" />}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            {(providerKey==='entra'||providerKey==='google') && <>
              <FormField label="Client ID"><input style={inputStyle} value={form.clientId} onChange={e=>set('clientId',e.target.value)} placeholder="Application (client) ID" /></FormField>
              <FormField label="Client Secret"><input style={{...inputStyle,fontFamily:'monospace'}} type="password" value={form.clientSecret} onChange={e=>set('clientSecret',e.target.value)} placeholder="••••••••" /></FormField>
              <FormField label={providerKey==='entra'?"Tenant ID / Domain":"Allowed Domain"}>
                <input style={inputStyle} value={form.tenantDomain} onChange={e=>set('tenantDomain',e.target.value)} placeholder={providerKey==='entra'?'your-tenant-id':'yourcompany.com'} />
              </FormField>
            </>}
            {providerKey==='saml' && <>
              <FormField label="IdP SSO URL"><input style={inputStyle} value={form.samlSsoUrl} onChange={e=>set('samlSsoUrl',e.target.value)} placeholder="https://idp.example.com/sso/saml" /></FormField>
              <FormField label="Entity ID"><input style={inputStyle} value={form.samlEntityId} onChange={e=>set('samlEntityId',e.target.value)} placeholder="https://idp.example.com" /></FormField>
              <div style={{gridColumn:'1/-1'}}>
                <FormField label="IdP Certificate (PEM)"><textarea style={{...inputStyle,height:80,resize:'vertical',fontFamily:'monospace',fontSize:11}} value={form.samlCert} onChange={e=>set('samlCert',e.target.value)} placeholder="-----BEGIN CERTIFICATE-----" /></FormField>
              </div>
            </>}
          </div>
          <div style={{display:'flex',gap:16,alignItems:'center',marginTop:8}}>
            <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:C.muted,cursor:'pointer'}}>
              <input type="checkbox" checked={!!form.autoProvision} onChange={e=>set('autoProvision',e.target.checked?1:0)} />
              Auto-provision new users
            </label>
            <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:C.muted,cursor:'pointer'}}>
              <input type="checkbox" checked={!!form.forceSso} onChange={e=>set('forceSso',e.target.checked?1:0)} />
              Force SSO (disable local login)
            </label>
          </div>
          {providerKey==='saml' && (
            <div style={{marginTop:10,background:C.surface,borderRadius:8,padding:'10px 14px',fontSize:11,color:C.dim}}>
              <strong style={{color:C.muted}}>SP Metadata URL:</strong> <code>{window.location.origin}/api/auth/saml/metadata</code><br/>
              <strong style={{color:C.muted}}>ACS URL:</strong> <code>{window.location.origin}/api/auth/saml/callback</code>
            </div>
          )}
          <div style={{display:'flex',justifyContent:'flex-end',marginTop:12}}>
            <button onClick={handleSave} disabled={save.isPending} style={{background:C.primary,color:'#fff',border:'none',borderRadius:8,padding:'8px 18px',fontSize:13,fontWeight:700,cursor:'pointer'}}>
              {save.isPending?'Saving...':'Save Configuration'}
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

// ── Main Settings Module ──────────────────────────────────────────────────────
export default function SettingsModule() {
  const [tab, setTab] = useState<'branding'|'modules'|'sso'|'mfa'>('branding');
  const { data, isLoading } = useSettings();
  const updateBranding = useUpdateBranding();
  const { data:modules } = useModuleSettings();
  const { data:ssoProviders } = useSSORProviders();
  const qc = useQueryClient();
  const [saved, setSaved]   = useState(false);
  const [errMsg, setErrMsg] = useState('');
  const { accessToken } = useAuth();
  const branding = data?.branding;
  const [form, setForm] = useState({ company_name:'', primary_color:'#6366F1', secondary_color:'#14B8A6', logo_url:'' });
  const set = (k:string,v:string) => setForm(f=>({...f,[k]:v}));
  const [logoPreview, setLogoPreview]   = useState('');
  const [logoUploading, setLogoUploading] = useState(false);

  useEffect(()=>{ if(branding) {
    setForm({ company_name:branding.company_name??'', primary_color:branding.primary_color??'#6366F1', secondary_color:branding.secondary_color??'#14B8A6', logo_url:(branding as any).logo_url??'' });
    if ((branding as any).logo_url) setLogoPreview((branding as any).logo_url);
  }},[branding?.company_name, branding?.primary_color]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setLogoUploading(true);
    try {
      // Show local preview immediately
      const reader = new FileReader();
      reader.onload = ev => setLogoPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
      // Upload to storage
      const fd = new FormData(); fd.append('file', file); fd.append('path', 'logos');
      const res = await fetch(`\${API_URL}/api/storage/upload`, { method:'POST', headers:{ Authorization:`Bearer ${accessToken}` }, body:fd });
      const data = await res.json() as any;
      if (data.ok) {
        const publicUrl = `/api/public/logo/${btoa('tenant')}`;
        set('logo_url', data.data.url);
        setLogoPreview(data.data.url);
      }
    } catch {}
    finally { setLogoUploading(false); }
  };

  const handleSave = async () => {
    setErrMsg(''); setSaved(false);
    try {
      await updateBranding.mutateAsync(form);
      qc.invalidateQueries({queryKey:['settings']});
      // Refresh tenant shell so sidebar updates immediately
      const shellRes = await fetch(`\${API_URL}/api/tenant/shell`);
      if (shellRes.ok) {
        // Force AuthContext to pick up new branding by reloading page branding vars
        const shellData = await shellRes.json() as any;
        const b = shellData.data?.branding;
        if (b?.primary_color) document.documentElement.style.setProperty('--color-accent', b.primary_color);
        if (b?.company_name) document.title = b.company_name;
        if (b?.logo_url) {
          // Update sidebar logo immediately without full reload
          const logos = document.querySelectorAll<HTMLImageElement>('img[data-logo]');
          logos.forEach(img => { img.src = b.logo_url; });
        }
      }
      setSaved(true); setTimeout(()=>setSaved(false),3000);
    }
    catch(e:any) { setErrMsg(e.message??'Failed'); }
  };

  const toggleModule = async (moduleKey:string, enabled:number) => {
    const token = localStorage.getItem('access_token');
    await fetch(`/api/settings/modules/${moduleKey}`, { method:'PATCH', headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`}, body:JSON.stringify({enabled:!enabled}) });
    qc.invalidateQueries({queryKey:['settings','modules']});
  };

  if (isLoading) return <Loading />;

  return (
    <div className="animate-fadeIn">
      <div style={{marginBottom:20}}>
        <h2 style={{color:C.text,fontSize:20,fontWeight:800,margin:0}}>Settings</h2>
        <p style={{color:C.muted,fontSize:12,margin:'4px 0 0'}}>White label, SSO, MFA and module configuration</p>
      </div>
      <div style={{display:'flex',gap:6,marginBottom:20,flexWrap:'wrap'}}>
        {[{k:'branding',l:'🎨 Branding'},{k:'modules',l:'🧩 Modules'},{k:'sso',l:'🔐 SSO / Identity'},{k:'mfa',l:'📱 MFA'}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k as any)} style={{background:tab===t.k?C.primary:C.elevated,color:tab===t.k?'#fff':C.muted,border:`1px solid ${tab===t.k?C.primary:C.border}`,borderRadius:8,padding:'7px 16px',fontSize:12,fontWeight:700,cursor:'pointer'}}>{t.l}</button>
        ))}
      </div>

      {tab==='branding' && (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
          <Card>
            <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:16}}>Company Branding</div>
            {errMsg && <Alert type="error" message={errMsg} />}
            {saved  && <Alert type="success" message="Branding saved — reload to see changes in sidebar" />}

            {/* Logo upload */}
            <FormField label="Company Logo">
              <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:4}}>
                {/* Preview */}
                <div style={{width:56,height:56,borderRadius:12,background:form.primary_color+'22',border:`2px dashed ${form.primary_color}44`,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0}}>
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo" style={{width:'100%',height:'100%',objectFit:'contain'}} />
                  ) : (
                    <span style={{fontSize:22,fontWeight:900,color:form.primary_color}}>{form.company_name?.[0]?.toUpperCase()??'X'}</span>
                  )}
                </div>
                <div style={{flex:1}}>
                  <label style={{display:'block',background:C.elevated,border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 14px',fontSize:12,color:C.muted,cursor:'pointer',textAlign:'center',marginBottom:6}}>
                    {logoUploading ? '⏳ Uploading...' : '📁 Upload logo (PNG, SVG, JPG)'}
                    <input type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" style={{display:'none'}} onChange={handleLogoUpload} />
                  </label>
                  <input style={{...inputStyle,fontSize:11}} value={form.logo_url??''} onChange={e=>set('logo_url',e.target.value)} placeholder="Or paste image URL..." />
                </div>
              </div>
            </FormField>

            <FormField label="Company Name"><input style={inputStyle} value={form.company_name} onChange={e=>set('company_name',e.target.value)} /></FormField>
            <FormField label="Primary Colour">
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <input type="color" value={form.primary_color} onChange={e=>set('primary_color',e.target.value)} style={{width:40,height:36,border:`1px solid ${C.border}`,borderRadius:8,cursor:'pointer',padding:2,background:C.elevated}} />
                <input style={{...inputStyle,flex:1}} value={form.primary_color} onChange={e=>set('primary_color',e.target.value)} />
              </div>
            </FormField>
            <FormField label="Secondary Colour">
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <input type="color" value={form.secondary_color} onChange={e=>set('secondary_color',e.target.value)} style={{width:40,height:36,border:`1px solid ${C.border}`,borderRadius:8,cursor:'pointer',padding:2,background:C.elevated}} />
                <input style={{...inputStyle,flex:1}} value={form.secondary_color} onChange={e=>set('secondary_color',e.target.value)} />
              </div>
            </FormField>
            <button onClick={handleSave} disabled={updateBranding.isPending||logoUploading} style={{background:C.primary,color:'#fff',border:'none',borderRadius:8,padding:'9px 20px',fontSize:13,fontWeight:700,cursor:'pointer',width:'100%',marginTop:8}}>
              {updateBranding.isPending?'Saving...':'Save Branding'}
            </button>
          </Card>
          <Card>
            <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:16}}>Live Preview</div>
            <div style={{border:`1px solid ${C.border}`,borderRadius:12,overflow:'hidden'}}>
              <div style={{background:form.primary_color,padding:'14px 18px'}}>
                <div style={{fontWeight:800,color:'#fff',fontSize:15}}>{form.company_name||'Your Company'}</div>
                <div style={{color:'rgba(255,255,255,0.7)',fontSize:11,marginTop:2}}>Workforce Operations Platform</div>
              </div>
              <div style={{padding:14,background:C.surface}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
                  {[['Active Employees','—'],['On Leave','—']].map(([l,v])=>(
                    <div key={l} style={{background:C.card,borderRadius:8,padding:'10px 12px',borderTop:`3px solid ${form.primary_color}`}}>
                      <div style={{fontSize:10,color:C.dim,textTransform:'uppercase'}}>{l}</div>
                      <div style={{fontSize:22,fontWeight:900,color:C.text}}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{background:form.secondary_color,borderRadius:8,padding:'8px 12px'}}>
                  <div style={{fontSize:11,fontWeight:700,color:'#fff'}}>◉ Secondary accent</div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {tab==='modules' && (
        <Card>
          <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:4}}>Module Licensing</div>
          <div style={{fontSize:12,color:C.muted,marginBottom:16}}>Toggle modules on/off for this tenant.</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:10}}>
            {(modules??[]).map((m:any)=>(
              <div key={m.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',background:C.surface,borderRadius:10,border:`1px solid ${m.enabled?C.border:C.border+'44'}`}}>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:m.enabled?C.text:C.dim}}>{m.module_key}</div>
                  <div style={{fontSize:10,color:m.enabled?C.success:C.dim}}>{m.enabled?'Enabled':'Disabled'}</div>
                </div>
                <button onClick={()=>toggleModule(m.module_key,m.enabled)} style={{background:m.enabled?C.success+'22':C.dim+'22',color:m.enabled?C.success:C.dim,border:`1px solid ${m.enabled?C.success+'44':C.dim+'33'}`,borderRadius:20,padding:'4px 12px',fontSize:11,fontWeight:700,cursor:'pointer'}}>
                  {m.enabled?'● On':'○ Off'}
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab==='sso' && (
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div style={{background:C.surface,borderRadius:10,padding:'12px 16px',fontSize:12,color:C.muted,border:`1px solid ${C.border}`}}>
            🔐 Configure Single Sign-On so your team can log in with their existing company accounts. Changes take effect immediately.
          </div>
          {SSO_PROVIDERS.map(p=>(
            <div key={p.key}><SSOProviderCard providerKey={p.key} label={p.label} icon={p.icon}
              existing={(ssoProviders??[]).find((s:any)=>s.provider===p.key)} /></div>
          ))}
        </div>
      )}

      {tab==='mfa' && (
        <div style={{maxWidth:560}}>
          <MFASettings />
        </div>
      )}
    </div>
  );
}

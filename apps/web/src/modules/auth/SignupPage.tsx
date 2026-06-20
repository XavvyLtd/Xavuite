import { useState, useEffect, useRef } from 'react';
const API_URL = import.meta.env.VITE_API_URL ?? 'https://api-v2.xavvy.uk';
import { C } from '../../platform/branding/theme';

const STEPS = ['account','company','setup','done'] as const;
type Step = typeof STEPS[number];

function StepIndicator({ current }: { current: Step }) {
  const labels = ['Account','Company','Setup','Done'];
  const idx = STEPS.indexOf(current);
  return (
    <div style={{ display:'flex', alignItems:'center', gap:4, justifyContent:'center', marginBottom:28 }}>
      {labels.map((l, i) => (
        <div key={l} style={{ display:'flex', alignItems:'center', gap:4 }}>
          <div style={{ width:26, height:26, borderRadius:'50%', background:i<=idx?C.primary:C.elevated, color:i<=idx?'#fff':C.dim, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, border:`2px solid ${i<=idx?C.primary:C.border}` }}>
            {i < idx ? '✓' : i+1}
          </div>
          <span style={{ fontSize:11, color:i<=idx?C.text:C.dim, fontWeight:i===idx?700:400 }}>{l}</span>
          {i < labels.length-1 && <div style={{ width:20, height:1, background:i<idx?C.primary:C.border }} />}
        </div>
      ))}
    </div>
  );
}

export default function SignupPage({ onBack }: { onBack: () => void }) {
  const [step, setStep]           = useState<Step>('account');
  const [err, setErr]             = useState('');
  const [loading, setLoading]     = useState(false);
  const [subAvailable, setSubAvail] = useState<boolean|null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout>|null>(null);

  const [form, setForm] = useState({
    adminEmail: '', adminPassword: '', confirmPassword: '',
    companyName: '', subdomain: '',
    plan: 'starter',
  });
  const [result, setResult] = useState<any>(null);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  // Subdomain availability check (debounced)
  useEffect(() => {
    if (!form.subdomain || form.subdomain.length < 3) { setSubAvail(null); return; }
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      const res  = await fetch(`/api/signup/check?subdomain=${form.subdomain.toLowerCase()}`);
      const data = await res.json() as any;
      setSubAvail(data.data?.available ?? false);
    }, 400);
  }, [form.subdomain]);

  // Auto-generate subdomain from company name
  useEffect(() => {
    if (form.companyName && !form.subdomain) {
      const gen = form.companyName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
      if (gen.length >= 3) set('subdomain', gen);
    }
  }, [form.companyName]);

  const inp: React.CSSProperties = { width:'100%', background:C.elevated, border:`1px solid ${C.border}`, borderRadius:10, padding:'10px 14px', color:C.text, fontSize:13, outline:'none', boxSizing:'border-box' };
  const lbl: React.CSSProperties = { display:'block', fontSize:10, fontWeight:700, color:C.dim, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 };

  const handleAccount = () => {
    if (!form.adminEmail || !form.adminPassword) { setErr('Email and password are required'); return; }
    if (form.adminPassword.length < 8) { setErr('Password must be at least 8 characters'); return; }
    if (form.adminPassword !== form.confirmPassword) { setErr('Passwords do not match'); return; }
    setErr(''); setStep('company');
  };

  const handleCompany = () => {
    if (!form.companyName || !form.subdomain) { setErr('Company name and subdomain are required'); return; }
    if (subAvailable === false) { setErr('This subdomain is not available'); return; }
    setErr(''); setStep('setup');
  };

  const handleSetup = async () => {
    setLoading(true); setErr('');
    try {
      const res  = await fetch(`\${API_URL}/api/signup/register`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(form) });
      const data = await res.json() as any;
      if (!data.ok) throw new Error(data.error ?? 'Registration failed');
      setResult(data.data);
      setStep('done');
    } catch(e: any) { setErr(e.message ?? 'Registration failed'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight:'100vh', background:C.bg, display:'flex', alignItems:'center', justifyContent:'center', padding:20, fontFamily:'Inter,system-ui,sans-serif' }}>
      <div style={{ width:'100%', maxWidth:440 }}>
        {/* Header */}
        <div style={{ textAlign:'center', marginBottom:24 }}>
          <div style={{ width:52, height:52, borderRadius:16, background:`linear-gradient(135deg,${C.primary},#8B5CF6)`, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:900, fontSize:22, margin:'0 auto 14px', boxShadow:`0 8px 24px ${C.primary}44` }}>X</div>
          <h1 style={{ color:C.text, fontSize:22, fontWeight:900, margin:'0 0 4px' }}>Start your free trial</h1>
          <p style={{ color:C.muted, fontSize:12, margin:0 }}>14 days free · No credit card required</p>
        </div>

        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:20, padding:28 }}>
          <StepIndicator current={step} />
          {err && <div style={{ background:C.danger+'15', border:`1px solid ${C.danger}33`, borderRadius:10, padding:'10px 14px', marginBottom:16, color:C.danger, fontSize:12 }}>{err}</div>}

          {/* Step 1: Account */}
          {step==='account' && (
            <>
              <div style={{ fontSize:15, fontWeight:700, color:C.text, marginBottom:16 }}>Create your admin account</div>
              <div style={{ marginBottom:14 }}><label style={lbl}>Work Email</label><input style={inp} type="email" value={form.adminEmail} onChange={e=>set('adminEmail',e.target.value)} placeholder="you@company.com" autoFocus /></div>
              <div style={{ marginBottom:14 }}><label style={lbl}>Password</label><input style={inp} type="password" value={form.adminPassword} onChange={e=>set('adminPassword',e.target.value)} placeholder="Min. 8 characters" /></div>
              <div style={{ marginBottom:20 }}><label style={lbl}>Confirm Password</label><input style={inp} type="password" value={form.confirmPassword} onChange={e=>set('confirmPassword',e.target.value)} placeholder="Repeat password" /></div>
              <button onClick={handleAccount} style={{ width:'100%', background:C.primary, color:'#fff', border:'none', borderRadius:10, padding:11, fontSize:14, fontWeight:700, cursor:'pointer' }}>Continue →</button>
              <div style={{ textAlign:'center', marginTop:14 }}><button onClick={onBack} style={{ background:'none', border:'none', color:C.dim, fontSize:12, cursor:'pointer' }}>Already have an account? Sign in</button></div>
            </>
          )}

          {/* Step 2: Company */}
          {step==='company' && (
            <>
              <div style={{ fontSize:15, fontWeight:700, color:C.text, marginBottom:16 }}>About your company</div>
              <div style={{ marginBottom:14 }}><label style={lbl}>Company Name</label><input style={inp} value={form.companyName} onChange={e=>set('companyName',e.target.value)} placeholder="Acme Ltd" autoFocus /></div>
              <div style={{ marginBottom:20 }}>
                <label style={lbl}>Your URL (subdomain)</label>
                <div style={{ position:'relative' }}>
                  <input style={{ ...inp, paddingRight:100 }} value={form.subdomain} onChange={e=>set('subdomain',e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,''))} placeholder="acme" />
                  <span style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', fontSize:11, color:C.dim, pointerEvents:'none' }}>.xavvysuite.com</span>
                </div>
                {form.subdomain.length >= 3 && (
                  <div style={{ fontSize:11, marginTop:6, color:subAvailable===true?C.success:subAvailable===false?C.danger:C.dim }}>
                    {subAvailable===true ? `✓ ${form.subdomain}.xavvysuite.com is available` : subAvailable===false ? `✗ This subdomain is taken` : 'Checking...'}
                  </div>
                )}
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => setStep('account')} style={{ flex:1, background:C.elevated, color:C.muted, border:`1px solid ${C.border}`, borderRadius:10, padding:11, fontSize:13, fontWeight:600, cursor:'pointer' }}>← Back</button>
                <button onClick={handleCompany} style={{ flex:2, background:C.primary, color:'#fff', border:'none', borderRadius:10, padding:11, fontSize:14, fontWeight:700, cursor:'pointer' }}>Continue →</button>
              </div>
            </>
          )}

          {/* Step 3: Setup / plan */}
          {step==='setup' && (
            <>
              <div style={{ fontSize:15, fontWeight:700, color:C.text, marginBottom:16 }}>Choose your plan</div>
              <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:20 }}>
                {[
                  { key:'starter', name:'Starter', price:'£49/mo', desc:'Up to 25 employees. HR, Leave, Timesheets, Compliance + 6 more modules.' },
                  { key:'professional', name:'Professional', price:'£99/mo', desc:'Up to 100 employees. All modules including Recruitment, Workflows, SSO & more.' },
                ].map(p => (
                  <label key={p.key} style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'12px 14px', border:`2px solid ${form.plan===p.key?C.primary:C.border}`, borderRadius:12, cursor:'pointer', background:form.plan===p.key?C.primary+'11':C.surface }}>
                    <input type="radio" name="plan" value={p.key} checked={form.plan===p.key} onChange={()=>set('plan',p.key)} style={{ marginTop:2, flexShrink:0 }} />
                    <div>
                      <div style={{ fontWeight:700, color:C.text, fontSize:13 }}>{p.name} <span style={{ color:C.primary }}>{p.price}</span></div>
                      <div style={{ fontSize:11, color:C.dim, marginTop:2 }}>{p.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
              <div style={{ background:C.success+'11', border:`1px solid ${C.success}33`, borderRadius:10, padding:'10px 14px', fontSize:12, color:C.success, marginBottom:16, fontWeight:600 }}>
                ✓ 14-day free trial — no credit card needed
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => setStep('company')} style={{ flex:1, background:C.elevated, color:C.muted, border:`1px solid ${C.border}`, borderRadius:10, padding:11, fontSize:13, fontWeight:600, cursor:'pointer' }}>← Back</button>
                <button onClick={handleSetup} disabled={loading} style={{ flex:2, background:loading?C.success+'99':C.success, color:'#fff', border:'none', borderRadius:10, padding:11, fontSize:14, fontWeight:700, cursor:'pointer' }}>
                  {loading ? 'Creating account...' : '🚀 Launch XavvySuite'}
                </button>
              </div>
            </>
          )}

          {/* Step 4: Done */}
          {step==='done' && result && (
            <div style={{ textAlign:'center', padding:'10px 0' }}>
              <div style={{ fontSize:52, marginBottom:12 }}>🎉</div>
              <div style={{ fontSize:18, fontWeight:900, color:C.text, marginBottom:8 }}>Welcome to XavvySuite!</div>
              <div style={{ fontSize:13, color:C.muted, marginBottom:20 }}>
                Your workspace is ready at:<br/>
                <strong style={{ color:C.primary }}>{result.subdomain}.xavvysuite.com</strong>
              </div>
              <div style={{ background:C.surface, borderRadius:10, padding:'14px 16px', marginBottom:20, textAlign:'left', fontSize:12 }}>
                <div style={{ fontWeight:700, color:C.text, marginBottom:8 }}>What's next:</div>
                <div style={{ display:'flex', flexDirection:'column', gap:6, color:C.muted }}>
                  <div>1. ✅ Account created for <strong>{result.adminEmail}</strong></div>
                  <div>2. 🏢 Add your employees in HR module</div>
                  <div>3. ⚙️ Configure branding in Settings</div>
                  <div>4. 🔐 Set up SSO for your team</div>
                  <div>5. 💳 Add payment before trial expires in 14 days</div>
                </div>
              </div>
              <a href={result.redirectUrl} style={{ display:'block', background:C.primary, color:'#fff', borderRadius:12, padding:'12px 0', fontSize:14, fontWeight:800, textDecoration:'none' }}>
                Go to your workspace →
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

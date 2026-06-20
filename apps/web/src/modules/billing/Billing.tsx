import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
const API_URL = import.meta.env.VITE_API_URL ?? 'https://api-v2.xavvy.uk';
import { Card, MetricCard, MetricGrid, Loading, Alert, C } from '../../components/ui';

interface Plan {
  key: string; name: string; price: { monthly: number; annual: number };
  seats: number; features: string[]; highlight: boolean;
}

function formatPrice(pence: number, interval: string) {
  if (pence === -1) return 'Custom';
  const pounds = (pence / 100).toFixed(0);
  return `£${pounds}/${interval === 'annual' ? 'yr' : 'mo'}`;
}

export default function BillingModule() {
  const { accessToken } = useAuth();
  const [sub, setSub]       = useState<any>(null);
  const [plans, setPlans]   = useState<Plan[]>([]);
  const [interval, setInterval] = useState<'monthly'|'annual'>('monthly');
  const [loading, setLoading]   = useState(true);
  const [upgrading, setUpgrading] = useState('');
  const [errMsg, setErrMsg]     = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [subRes, plansRes] = await Promise.all([
          fetch(`${API_URL}/api/billing/subscription`, { headers: { Authorization: `Bearer ${accessToken}` } }),
          fetch(`${API_URL}/api/billing/plans`, { headers: { Authorization: `Bearer ${accessToken}` } }),
        ]);
        const subData   = await subRes.json() as any;
        const plansData = await plansRes.json() as any;
        setSub(subData.data ?? subData);
        setPlans(plansData.data?.plans ?? []);
      } catch (e) { setErrMsg('Failed to load billing info'); }
      finally { setLoading(false); }
    };
    load();
  }, [accessToken]);

  const handleUpgrade = async (planKey: string) => {
    setUpgrading(planKey); setErrMsg('');
    try {
      const res  = await fetch(`\${API_URL}/api/billing/checkout`, { method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${accessToken}`}, body:JSON.stringify({ plan:planKey, interval, seats:5 }) });
      const data = await res.json() as any;
      if (data.data?.url) window.location.href = data.data.url;
      else setErrMsg(data.error ?? 'Failed to create checkout session');
    } catch { setErrMsg('Failed to start checkout'); }
    finally { setUpgrading(''); }
  };

  const handlePortal = async () => {
    try {
      const res  = await fetch(`\${API_URL}/api/billing/portal`, { method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${accessToken}`} });
      const data = await res.json() as any;
      if (data.data?.url) window.location.href = data.data.url;
    } catch { setErrMsg('Failed to open billing portal'); }
  };

  if (loading) return <Loading />;

  const planColors: Record<string,string> = { free:C.dim, starter:C.sky, professional:C.primary, enterprise:'#A855F7' };
  const currentPlan = sub?.plan ?? 'free';
  const trialDaysLeft = sub?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(sub.trial_ends_at).getTime() - Date.now()) / 86400000))
    : 0;

  return (
    <div className="animate-fadeIn">
      <div style={{ marginBottom:20 }}>
        <h2 style={{ color:C.text, fontSize:20, fontWeight:800, margin:0 }}>Billing & Subscription</h2>
        <p style={{ color:C.muted, fontSize:12, margin:'4px 0 0' }}>Manage your plan, seats and payment details</p>
      </div>

      {errMsg && <Alert type="error" message={errMsg} />}

      {/* Current plan banner */}
      <Card style={{ borderLeft:`4px solid ${planColors[currentPlan]??C.primary}`, marginBottom:20 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
              <span style={{ background:planColors[currentPlan]+'22', color:planColors[currentPlan]??C.primary, borderRadius:20, padding:'3px 12px', fontSize:12, fontWeight:800, textTransform:'uppercase' }}>
                {currentPlan}
              </span>
              <span style={{ background:sub?.status==='active'?C.success+'22':C.warning+'22', color:sub?.status==='active'?C.success:C.warning, borderRadius:20, padding:'3px 10px', fontSize:11, fontWeight:700 }}>
                {sub?.status ?? 'active'}
              </span>
            </div>
            <div style={{ fontSize:13, color:C.muted }}>
              {sub?.seat_count} seats · {sub?.employee_count ?? 0} employees active
              {trialDaysLeft > 0 && <span style={{ color:C.warning, marginLeft:8, fontWeight:700 }}>⚡ {trialDaysLeft} days left in trial</span>}
              {sub?.current_period_end && <span style={{ marginLeft:8 }}>· Renews {new Date(sub.current_period_end).toLocaleDateString('en-GB')}</span>}
            </div>
          </div>
          {sub?.stripe_customer_id && (
            <button onClick={handlePortal} style={{ background:C.elevated, color:C.muted, border:`1px solid ${C.border}`, borderRadius:8, padding:'8px 16px', fontSize:12, fontWeight:700, cursor:'pointer' }}>
              Manage Payment →
            </button>
          )}
        </div>
        {sub?.cancel_at_period_end === 1 && (
          <div style={{ marginTop:10, background:C.warning+'22', border:`1px solid ${C.warning}44`, borderRadius:8, padding:'8px 12px', fontSize:12, color:C.warning, fontWeight:600 }}>
            ⚠️ Your subscription is set to cancel at the end of the current period. Use "Manage Payment" to reactivate.
          </div>
        )}
      </Card>

      {/* Interval toggle */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
        <span style={{ fontSize:12, color:C.muted }}>Billing:</span>
        <div style={{ display:'flex', background:C.elevated, borderRadius:20, padding:3 }}>
          {(['monthly','annual'] as const).map(i => (
            <button key={i} onClick={() => setInterval(i)} style={{ background:interval===i?C.primary:'transparent', color:interval===i?'#fff':C.muted, border:'none', borderRadius:16, padding:'5px 14px', fontSize:12, fontWeight:700, cursor:'pointer' }}>
              {i.charAt(0).toUpperCase()+i.slice(1)}{i==='annual' && <span style={{ color:interval==='annual'?'#A5F3FC':C.success, marginLeft:4 }}>-20%</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Plan cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:16 }}>
        {plans.map(plan => {
          const isCurrentPlan = plan.key === currentPlan;
          const color = planColors[plan.key] ?? C.primary;
          return (
            <Card key={plan.key} style={{ borderTop:`3px solid ${color}`, position:'relative', opacity:isCurrentPlan?1:1 }}>
              {plan.highlight && (
                <div style={{ position:'absolute', top:-12, left:'50%', transform:'translateX(-50%)', background:color, color:'#fff', borderRadius:20, padding:'3px 14px', fontSize:10, fontWeight:800, whiteSpace:'nowrap' }}>
                  MOST POPULAR
                </div>
              )}
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:16, fontWeight:800, color:C.text, marginBottom:4 }}>{plan.name}</div>
                <div style={{ fontSize:28, fontWeight:900, color }}>
                  {formatPrice(interval==='annual'?plan.price.annual:plan.price.monthly, interval)}
                </div>
                <div style={{ fontSize:11, color:C.dim }}>
                  {plan.seats === -1 ? 'Unlimited employees' : `Up to ${plan.seats} employees`}
                </div>
              </div>
              <ul style={{ listStyle:'none', padding:0, margin:'0 0 20px', fontSize:12 }}>
                {plan.features.map(f => (
                  <li key={f} style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 0', color:C.muted }}>
                    <span style={{ color:C.success, fontWeight:700, flexShrink:0 }}>✓</span> {f}
                  </li>
                ))}
              </ul>
              {isCurrentPlan ? (
                <div style={{ background:color+'22', color, borderRadius:8, padding:'9px 0', fontSize:13, fontWeight:700, textAlign:'center' }}>
                  ✓ Current Plan
                </div>
              ) : plan.price.monthly === -1 ? (
                <a href="mailto:sales@xavvysuite.com" style={{ display:'block', background:color, color:'#fff', borderRadius:8, padding:'9px 0', fontSize:13, fontWeight:700, textAlign:'center', textDecoration:'none' }}>
                  Contact Sales
                </a>
              ) : (
                <button onClick={() => handleUpgrade(plan.key)} disabled={!!upgrading} style={{ width:'100%', background:upgrading===plan.key?color+'99':color, color:'#fff', border:'none', borderRadius:8, padding:'9px 0', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                  {upgrading===plan.key ? 'Opening Checkout...' : `Upgrade to ${plan.name} →`}
                </button>
              )}
            </Card>
          );
        })}
      </div>

      <div style={{ marginTop:20, fontSize:11, color:C.dim, textAlign:'center' }}>
        All plans include 14-day free trial · Cancel anytime · Prices exclude VAT · Powered by Stripe
      </div>
    </div>
  );
}

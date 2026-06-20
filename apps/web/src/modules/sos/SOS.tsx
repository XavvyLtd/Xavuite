import { useState } from 'react';
import { useSOSAlerts, useRaiseSOS, type SOSAlert } from '../../hooks/api';
import { Card, Modal, InfoRow, MetricCard, MetricGrid, Alert, FormField, inputStyle, selectStyle, C, fmtDate } from '../../components/ui';
import { useQueryClient } from '@tanstack/react-query';

const SEVERITY_CONFIG: Record<string,{color:string;bg:string;icon:string}> = {
  critical: { color:'#7F1D1D', bg:'#FEF2F2', icon:'🚨' },
  high:     { color:C.danger,  bg:'#FEF2F2', icon:'⚠️' },
  medium:   { color:C.warning, bg:'#FFFBEB', icon:'⚡' },
  low:      { color:C.sky,     bg:'#EFF6FF', icon:'ℹ️' },
};
const TYPE_ICONS: Record<string,string> = { fire:'🔥', medical:'🏥', security:'🔒', weather:'🌩️', it_outage:'💻', general:'📢', other:'📦' };

function RaiseAlertModal({ onClose }: { onClose:()=>void }) {
  const raise = useRaiseSOS();
  const qc = useQueryClient();
  const [errMsg, setErrMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title:'', message:'', severity:'high', alertType:'general', audience:'all_staff', location:'', actionRequired:'' });
  const set = (k:string,v:string) => setForm(f=>({...f,[k]:v}));

  const handleSave = async () => {
    if (!form.title||!form.message) { setErrMsg('Title and message are required'); return; }
    setSaving(true); setErrMsg('');
    try {
      const result = await raise.mutateAsync(form) as any;
      qc.invalidateQueries({queryKey:['sos']});
      onClose();
      alert(`✅ Alert raised. ${result?.data?.notified??0} staff notified by email.`);
    } catch(e:any) { setErrMsg(e.message??'Failed'); } finally { setSaving(false); }
  };

  return (
    <Modal title="🚨 Raise Emergency Alert" onClose={onClose} wide>
      {errMsg && <Alert type="error" message={errMsg} />}
      <div style={{background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:10,padding:'10px 14px',marginBottom:16,fontSize:12,color:C.danger,fontWeight:600}}>
        ⚠️ This will immediately send an email notification to all active staff members.
      </div>
      <FormField label="Alert Title" required><input style={inputStyle} value={form.title} onChange={e=>set('title',e.target.value)} placeholder="Fire Alarm — Building Evacuation" /></FormField>
      <FormField label="Message" required><textarea style={{...inputStyle,height:80,resize:'vertical'}} value={form.message} onChange={e=>set('message',e.target.value)} placeholder="Please evacuate the building immediately..." /></FormField>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <FormField label="Severity">
          <select style={selectStyle} value={form.severity} onChange={e=>set('severity',e.target.value)}>
            <option value="critical">🚨 Critical</option><option value="high">⚠️ High</option><option value="medium">⚡ Medium</option><option value="low">ℹ️ Low</option>
          </select>
        </FormField>
        <FormField label="Type">
          <select style={selectStyle} value={form.alertType} onChange={e=>set('alertType',e.target.value)}>
            <option value="general">📢 General</option><option value="fire">🔥 Fire</option><option value="medical">🏥 Medical</option>
            <option value="security">🔒 Security</option><option value="weather">🌩️ Weather</option><option value="it_outage">💻 IT Outage</option>
          </select>
        </FormField>
        <FormField label="Location"><input style={inputStyle} value={form.location} onChange={e=>set('location',e.target.value)} placeholder="Floor 3, Block B" /></FormField>
        <FormField label="Audience">
          <select style={selectStyle} value={form.audience} onChange={e=>set('audience',e.target.value)}>
            <option value="all_staff">All Staff</option><option value="managers">Managers Only</option>
          </select>
        </FormField>
      </div>
      <FormField label="Action Required"><input style={inputStyle} value={form.actionRequired} onChange={e=>set('actionRequired',e.target.value)} placeholder="Evacuate to the car park assembly point" /></FormField>
      <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:24}}>
        <button onClick={onClose} style={{background:'transparent',color:C.muted,border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:600,cursor:'pointer'}}>Cancel</button>
        <button onClick={handleSave} disabled={saving} style={{background:C.danger,color:'#fff',border:'none',borderRadius:8,padding:'8px 18px',fontSize:13,fontWeight:700,cursor:'pointer'}}>{saving?'Sending...':'🚨 Send Alert Now'}</button>
      </div>
    </Modal>
  );
}

export default function SOSModule() {
  const [tab, setTab] = useState<'active'|'all'>('active');
  const [showRaise, setShowRaise] = useState(false);
  const [selected, setSelected] = useState<SOSAlert|null>(null);
  const { data:activeAlerts,  isLoading:aL } = useSOSAlerts('active');
  const { data:allAlerts,     isLoading:allL } = useSOSAlerts('all');
  const qc = useQueryClient();
  const items = tab==='active' ? (activeAlerts??[]) : (allAlerts??[]);
  const critical = (activeAlerts??[]).filter(a=>a.severity==='critical');

  return (
    <div className="animate-fadeIn">
      <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',marginBottom:20}}>
        <div><h2 style={{color:C.text,fontSize:20,fontWeight:800,margin:0}}>SOS Alerts</h2>
        <p style={{color:C.muted,fontSize:12,margin:'4px 0 0'}}>Emergency broadcasts and escalation management</p></div>
        <button onClick={()=>setShowRaise(true)} style={{background:C.danger,color:'#fff',border:'none',borderRadius:8,padding:'8px 18px',fontSize:13,fontWeight:700,cursor:'pointer'}}>🚨 Raise Alert</button>
      </div>

      {critical.length>0 && (
        <div style={{background:'#FEF2F2',border:'2px solid '+C.danger,borderRadius:12,padding:'14px 18px',marginBottom:20,display:'flex',gap:12,alignItems:'center'}}>
          <span style={{fontSize:28}}>🚨</span>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:800,color:C.danger}}>{critical.length} CRITICAL ALERT{critical.length>1?'S':''} ACTIVE</div>
            <div style={{fontSize:12,color:C.muted,marginTop:2}}>{critical.map(a=>a.title).join(' · ')}</div>
          </div>
        </div>
      )}

      <MetricGrid>
        <MetricCard label="Active"   value={(activeAlerts??[]).length}                           icon="🚨" color={`linear-gradient(135deg,${C.danger},#7F1D1D)`} />
        <MetricCard label="Critical" value={critical.length}                                    icon="⚠️" color={`linear-gradient(135deg,${critical.length>0?C.danger:C.dim},${critical.length>0?'#7F1D1D':C.dim})`} />
        <MetricCard label="Resolved" value={(allAlerts??[]).filter(a=>a.status==='resolved').length} icon="✅" color={`linear-gradient(135deg,${C.success},${C.secondary})`} />
        <MetricCard label="Total"    value={(allAlerts??[]).length}                             icon="📊" color={`linear-gradient(135deg,${C.primary},#8B5CF6)`} />
      </MetricGrid>

      <div style={{display:'flex',gap:6,marginBottom:20}}>
        {[{k:'active',l:'Active'},{k:'all',l:'All Alerts'}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k as any)} style={{background:tab===t.k?C.danger:C.elevated,color:tab===t.k?'#fff':C.muted,border:`1px solid ${tab===t.k?C.danger:C.border}`,borderRadius:8,padding:'7px 14px',fontSize:12,fontWeight:700,cursor:'pointer'}}>{t.l}</button>
        ))}
      </div>

      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        {items.map(alert=>{
          const cfg = SEVERITY_CONFIG[alert.severity]??SEVERITY_CONFIG.high;
          return (
            <Card key={alert.id} onClick={()=>setSelected(alert)} style={{cursor:'pointer',borderLeft:`4px solid ${cfg.color}`}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                <div>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                    <span style={{fontSize:20}}>{TYPE_ICONS[alert.alert_type]??'📢'}</span>
                    <span style={{fontWeight:800,fontSize:15,color:C.text}}>{alert.title}</span>
                    <span style={{background:cfg.color+'22',color:cfg.color,borderRadius:6,fontSize:9,padding:'2px 7px',fontWeight:700,textTransform:'uppercase'}}>{alert.severity}</span>
                    <span style={{background:alert.status==='active'?C.danger+'22':C.success+'22',color:alert.status==='active'?C.danger:C.success,borderRadius:6,fontSize:9,padding:'2px 7px',fontWeight:700,textTransform:'uppercase'}}>{alert.status}</span>
                  </div>
                  <div style={{fontSize:12,color:C.muted,marginBottom:6}}>{alert.message}</div>
                  <div style={{display:'flex',gap:12,fontSize:11,color:C.dim}}>
                    {alert.location && <span>📍 {alert.location}</span>}
                    <span>Raised {fmtDate(alert.raised_at)}</span>
                    <span>👥 {alert.ack_count} acknowledged</span>
                  </div>
                </div>
                {alert.status==='active' && (
                  <button onClick={async (e: React.MouseEvent) => {
                    e.stopPropagation();
                    const token = localStorage.getItem('xs_token') ?? '';
                    await fetch(`/api/sos/${alert.id}/resolve`, { method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`}, body:JSON.stringify({note:'Resolved'}) });
                    qc.invalidateQueries({queryKey:['sos']});
                  }} style={{background:C.success,color:'#fff',border:'none',borderRadius:8,padding:'6px 12px',fontSize:11,fontWeight:700,cursor:'pointer',flexShrink:0}}>
                    ✓ Resolve
                  </button>
                )}
              </div>
              {alert.action_required && (
                <div style={{marginTop:10,background:C.warning+'22',border:`1px solid ${C.warning}44`,borderRadius:8,padding:'8px 12px',fontSize:12,color:C.warning,fontWeight:600}}>
                  ⚡ Action Required: {alert.action_required}
                </div>
              )}
            </Card>
          );
        })}
        {items.length===0 && (
          <div style={{textAlign:'center',padding:'60px 20px',color:C.dim}}>
            <div style={{fontSize:48,marginBottom:12}}>✅</div>
            <div style={{fontWeight:700,color:C.muted,fontSize:14}}>No {tab==='active'?'active ':''}alerts</div>
            <div style={{fontSize:12,marginTop:4}}>Use the button above to raise an emergency alert</div>
          </div>
        )}
      </div>
      {showRaise && <RaiseAlertModal onClose={()=>setShowRaise(false)} />}
    </div>
  );
}

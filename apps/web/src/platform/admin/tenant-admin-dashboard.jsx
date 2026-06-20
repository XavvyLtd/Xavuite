import { useState } from "react";

// ── Mock data matching actual schema ──────────────────────────
const TENANTS = [
  {
    id: "xavvy-tenant-001",
    name: "Xavvy Ltd",
    subdomain: "xavvy",
    status: "active",
    plan: "professional",
    created_at: "2025-10-01",
    employees: 7,
    seat_limit: 100,
    storage_used_gb: 2.4,
    storage_limit_gb: 10,
    api_calls_today: 2840,
    api_limit: 10000,
    trial_ends_at: null,
    stripe_status: "active",
    dpo_email: "naveen.dhotre@xavvy.uk",
    gdpr_reviewed: true,
    last_login: "2026-06-14",
    modules_enabled: ["hr","leave","timesheets","expenses","compliance","documents","training","announcements","orgchart","reporting","recruitment","onboarding","visa","pmo","resources","clients","invoicing","gdpr"],
    mrr: 449,
  },
  {
    id: "acme-tenant-001",
    name: "Acme Corp",
    subdomain: "acme",
    status: "active",
    plan: "starter",
    created_at: "2026-01-15",
    employees: 18,
    seat_limit: 25,
    storage_used_gb: 0.8,
    storage_limit_gb: 2,
    api_calls_today: 940,
    api_limit: 2000,
    trial_ends_at: null,
    stripe_status: "active",
    dpo_email: null,
    gdpr_reviewed: false,
    last_login: "2026-06-13",
    modules_enabled: ["hr","leave","timesheets","expenses","compliance","documents","training","announcements","orgchart","reporting"],
    mrr: 199,
  },
  {
    id: "beta-tenant-002",
    name: "TechStart Ltd",
    subdomain: "techstart",
    status: "trial",
    plan: "professional",
    created_at: "2026-06-01",
    employees: 4,
    seat_limit: 100,
    storage_used_gb: 0.1,
    storage_limit_gb: 10,
    api_calls_today: 120,
    api_limit: 10000,
    trial_ends_at: "2026-06-28",
    stripe_status: "trialing",
    dpo_email: null,
    gdpr_reviewed: false,
    last_login: "2026-06-14",
    modules_enabled: ["hr","leave","timesheets","pmo","reporting"],
    mrr: 0,
  },
  {
    id: "suspended-001",
    name: "OldCo Ltd",
    subdomain: "oldco",
    status: "suspended",
    plan: "starter",
    created_at: "2025-05-10",
    employees: 12,
    seat_limit: 25,
    storage_used_gb: 1.2,
    storage_limit_gb: 2,
    api_calls_today: 0,
    api_limit: 2000,
    trial_ends_at: null,
    stripe_status: "past_due",
    dpo_email: null,
    gdpr_reviewed: false,
    last_login: "2026-05-01",
    modules_enabled: ["hr","leave","timesheets"],
    mrr: 0,
  },
];

const PLAN_CONFIG = {
  free:         { color: "#64748B", label: "Free",         max_emp: 5,   price: 0 },
  starter:      { color: "#10B981", label: "Starter",      max_emp: 25,  price: 9 },
  professional: { color: "#6366F1", label: "Professional", max_emp: 100, price: 29 },
  enterprise:   { color: "#F59E0B", label: "Enterprise",   max_emp: -1,  price: 99 },
};

const STATUS_CONFIG = {
  active:    { color: "#10B981", label: "Active" },
  trial:     { color: "#F59E0B", label: "Trial" },
  suspended: { color: "#EF4444", label: "Suspended" },
};

const ALL_MODULES = ["hr","leave","timesheets","expenses","compliance","documents","training","announcements","orgchart","reporting","recruitment","onboarding","offboarding","visa","checklists","sos","pmo","resources","clients","invoicing","gdpr","workflow","scheduler","assets","billing"];

const T = {
  bg: "#020617", surface: "#0B1120", elevated: "#111827",
  card: "#0F172A", border: "#1E293B", text: "#F1F5F9",
  muted: "#94A3B8", dim: "#475569", primary: "#6366F1",
  success: "#10B981", warning: "#F59E0B", danger: "#EF4444",
};

function Bar({ value, max, color }) {
  const pct = max === -1 ? 50 : Math.min(100, Math.round(value / max * 100));
  const c = pct > 85 ? T.danger : pct > 65 ? T.warning : color ?? T.success;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, background: T.border, borderRadius: 99, height: 6 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: c, borderRadius: 99, transition: "width 0.4s" }} />
      </div>
      <span style={{ fontSize: 10, color: c, fontWeight: 700, width: 32, textAlign: "right" }}>{pct}%</span>
    </div>
  );
}

function TenantDetail({ tenant, onClose }) {
  const plan = PLAN_CONFIG[tenant.plan] ?? PLAN_CONFIG.starter;
  const status = STATUS_CONFIG[tenant.status] ?? STATUS_CONFIG.active;
  const trialDays = tenant.trial_ends_at
    ? Math.ceil((new Date(tenant.trial_ends_at) - new Date()) / 86400000)
    : null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={onClose}>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 20, width: "100%", maxWidth: 720, maxHeight: "90vh", overflowY: "auto", padding: 28 }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: plan.color + "33", border: `1px solid ${plan.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 900, color: plan.color }}>
                {tenant.name[0]}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: T.text }}>{tenant.name}</div>
                <div style={{ fontSize: 12, color: T.dim }}>{tenant.subdomain}.xavvysuite.com</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: status.color + "22", color: status.color, fontWeight: 700 }}>{status.label}</span>
              <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: plan.color + "22", color: plan.color, fontWeight: 700 }}>{plan.label}</span>
              {trialDays !== null && <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: T.warning + "22", color: T.warning, fontWeight: 700 }}>{trialDays}d trial left</span>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.dim, fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>

        {/* Stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 24 }}>
          {[
            { l: "Employees", v: `${tenant.employees}/${tenant.seat_limit === -1 ? "∞" : tenant.seat_limit}`, color: T.primary },
            { l: "MRR", v: `£${tenant.mrr}`, color: T.success },
            { l: "API Today", v: tenant.api_calls_today.toLocaleString(), color: T.muted },
            { l: "Last Login", v: tenant.last_login, color: T.dim },
          ].map(s => (
            <div key={s.l} style={{ background: T.elevated, borderRadius: 12, padding: "12px 14px", border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: s.color }}>{s.v}</div>
              <div style={{ fontSize: 10, color: T.dim, marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Usage bars */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.dim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Resource Usage</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { l: "Seats", v: tenant.employees, max: tenant.seat_limit },
              { l: "Storage", v: tenant.storage_used_gb, max: tenant.storage_limit_gb, fmt: v => `${v}GB` },
              { l: "API Calls Today", v: tenant.api_calls_today, max: tenant.api_limit },
            ].map(u => (
              <div key={u.l} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 90, fontSize: 12, color: T.muted }}>{u.l}</div>
                <div style={{ flex: 1 }}><Bar value={u.v} max={u.max} /></div>
                <div style={{ width: 80, fontSize: 11, color: T.dim, textAlign: "right" }}>
                  {u.fmt ? u.fmt(u.v) : u.v}/{u.max === -1 ? "∞" : (u.fmt ? u.fmt(u.max) : u.max)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Enabled modules */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.dim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
            Modules ({tenant.modules_enabled.length}/{ALL_MODULES.length})
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {ALL_MODULES.map(m => {
              const on = tenant.modules_enabled.includes(m);
              return (
                <span key={m} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, background: on ? T.primary + "22" : T.elevated, color: on ? T.primary : T.dim, border: `1px solid ${on ? T.primary + "44" : T.border}`, fontWeight: on ? 700 : 400 }}>
                  {on ? "✓ " : ""}{m}
                </span>
              );
            })}
          </div>
        </div>

        {/* GDPR / Compliance */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.dim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Compliance</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ background: T.elevated, borderRadius: 10, padding: "12px 14px", border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 12, color: T.muted, marginBottom: 4 }}>DPO Email</div>
              <div style={{ fontSize: 13, color: tenant.dpo_email ? T.text : T.danger, fontWeight: 700 }}>{tenant.dpo_email ?? "⚠️ Not set"}</div>
            </div>
            <div style={{ background: T.elevated, borderRadius: 10, padding: "12px 14px", border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 12, color: T.muted, marginBottom: 4 }}>GDPR Review</div>
              <div style={{ fontSize: 13, color: tenant.gdpr_reviewed ? T.success : T.warning, fontWeight: 700 }}>{tenant.gdpr_reviewed ? "✅ Completed" : "⏳ Pending"}</div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
          {[
            { l: "🔧 Impersonate", color: T.primary },
            { l: "📧 Send Email",  color: T.muted },
            { l: "⬆️ Upgrade Plan",color: T.success },
            { l: tenant.status === "suspended" ? "✅ Unsuspend" : "⏸ Suspend", color: tenant.status === "suspended" ? T.success : T.warning },
            { l: "🗑 Delete Tenant", color: T.danger },
          ].map(a => (
            <button key={a.l} style={{ background: a.color + "22", color: a.color, border: `1px solid ${a.color}44`, borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              {a.l}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function TenantAdmin() {
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState("tenants"); // tenants | platform

  const totalMRR = TENANTS.reduce((s, t) => s + t.mrr, 0);
  const active   = TENANTS.filter(t => t.status === "active");
  const trials   = TENANTS.filter(t => t.status === "trial");
  const suspended= TENANTS.filter(t => t.status === "suspended");

  const filtered = TENANTS
    .filter(t => filter === "all" || t.status === filter)
    .filter(t => planFilter === "all" || t.plan === planFilter)
    .filter(t => t.name.toLowerCase().includes(search.toLowerCase()) || t.subdomain.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ background: T.bg, minHeight: "100vh", fontFamily: "Inter, system-ui, sans-serif" }}>

      {/* Top bar */}
      <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg,${T.primary},#8B5CF6)`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 16, fontWeight: 900 }}>X</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 900, color: T.text }}>XavvySuite</div>
            <div style={{ fontSize: 10, color: T.primary, textTransform: "uppercase", letterSpacing: "0.1em" }}>Platform Admin</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {[["tenants","🏢 Tenants"],["platform","📊 Platform"]].map(([k,l]) => (
            <button key={k} onClick={() => setView(k)} style={{ background: view === k ? T.primary : T.elevated, color: view === k ? "#fff" : T.muted, border: `1px solid ${view === k ? T.primary : T.border}`, borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{l}</button>
          ))}
        </div>
      </div>

      {view === "platform" && (
        <div style={{ padding: 24 }}>
          <h2 style={{ color: T.text, fontSize: 20, fontWeight: 900, marginBottom: 24 }}>Platform Overview</h2>
          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 28 }}>
            {[
              { l: "Total Tenants",    v: TENANTS.length,          icon: "🏢", color: T.primary },
              { l: "Active Tenants",   v: active.length,           icon: "✅", color: T.success },
              { l: "On Trial",         v: trials.length,           icon: "⏳", color: T.warning },
              { l: "Monthly Revenue",  v: `£${totalMRR}`,         icon: "💷", color: T.success },
              { l: "Total Employees",  v: TENANTS.reduce((s,t)=>s+t.employees,0), icon: "👥", color: T.primary },
              { l: "Suspended",        v: suspended.length,        icon: "⛔", color: T.danger },
              { l: "GDPR Compliant",   v: TENANTS.filter(t=>t.gdpr_reviewed).length + "/" + TENANTS.length, icon: "🛡️", color: "#10B981" },
              { l: "API Calls Today",  v: TENANTS.reduce((s,t)=>s+t.api_calls_today,0).toLocaleString(), icon: "⚡", color: T.muted },
            ].map(s => (
              <div key={s.l} style={{ background: T.card, borderRadius: 14, padding: "16px 18px", border: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.v}</div>
                <div style={{ fontSize: 11, color: T.dim, marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>

          {/* Plan distribution */}
          <div style={{ background: T.card, borderRadius: 16, padding: 20, border: `1px solid ${T.border}`, marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.dim, textTransform: "uppercase", marginBottom: 16 }}>Plan Distribution</div>
            {Object.entries(PLAN_CONFIG).map(([plan, cfg]) => {
              const count = TENANTS.filter(t => t.plan === plan).length;
              const pct   = Math.round(count / TENANTS.length * 100);
              const rev   = TENANTS.filter(t => t.plan === plan).reduce((s,t)=>s+t.mrr,0);
              return (
                <div key={plan} style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
                  <div style={{ width: 90, fontSize: 12, color: T.muted, fontWeight: 700 }}>{cfg.label}</div>
                  <div style={{ flex: 1, background: T.border, borderRadius: 99, height: 10 }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: cfg.color, borderRadius: 99 }} />
                  </div>
                  <div style={{ width: 40, fontSize: 12, color: T.dim, textAlign: "right" }}>{count}</div>
                  <div style={{ width: 60, fontSize: 12, color: T.success, textAlign: "right", fontWeight: 700 }}>£{rev}/mo</div>
                </div>
              );
            })}
          </div>

          {/* Per-tenant usage alerts */}
          <div style={{ background: T.card, borderRadius: 16, padding: 20, border: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.dim, textTransform: "uppercase", marginBottom: 16 }}>Alerts</div>
            {[
              ...TENANTS.filter(t => t.status === "suspended").map(t => ({ type: "danger", msg: `${t.name} — account suspended (payment overdue)` })),
              ...TENANTS.filter(t => t.trial_ends_at && Math.ceil((new Date(t.trial_ends_at)-new Date())/86400000) < 7).map(t => ({ type: "warning", msg: `${t.name} — trial expires in ${Math.ceil((new Date(t.trial_ends_at)-new Date())/86400000)} days` })),
              ...TENANTS.filter(t => !t.gdpr_reviewed).map(t => ({ type: "warning", msg: `${t.name} — GDPR configuration incomplete (no DPO assigned)` })),
              ...TENANTS.filter(t => t.employees / t.seat_limit > 0.85 && t.seat_limit !== -1).map(t => ({ type: "warning", msg: `${t.name} — approaching seat limit (${t.employees}/${t.seat_limit})` })),
            ].map((a, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", background: (a.type === "danger" ? T.danger : T.warning) + "11", borderRadius: 8, marginBottom: 8, border: `1px solid ${(a.type === "danger" ? T.danger : T.warning)}33` }}>
                <span>{a.type === "danger" ? "🚨" : "⚠️"}</span>
                <span style={{ fontSize: 12, color: a.type === "danger" ? T.danger : T.warning }}>{a.msg}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === "tenants" && (
        <div style={{ padding: 24 }}>
          {/* Summary KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 24 }}>
            {[
              { l: "Total",     v: TENANTS.length,    color: T.primary, k: "all" },
              { l: "Active",    v: active.length,     color: T.success, k: "active" },
              { l: "Trial",     v: trials.length,     color: T.warning, k: "trial" },
              { l: "Suspended", v: suspended.length,  color: T.danger,  k: "suspended" },
              { l: "MRR",       v: `£${totalMRR}`,   color: T.success, k: null },
            ].map(s => (
              <div key={s.l} onClick={() => s.k && setFilter(s.k === filter ? "all" : s.k)}
                style={{ background: filter === s.k ? s.color + "22" : T.card, borderRadius: 12, padding: "14px 16px", border: `1px solid ${filter === s.k ? s.color + "66" : T.border}`, cursor: s.k ? "pointer" : "default", transition: "all 0.15s" }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.v}</div>
                <div style={{ fontSize: 11, color: T.dim, marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "center" }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tenants..."
              style={{ background: T.elevated, border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 14px", color: T.text, fontSize: 13, outline: "none", width: 220 }} />
            <div style={{ display: "flex", gap: 6 }}>
              {["all","free","starter","professional","enterprise"].map(p => (
                <button key={p} onClick={() => setPlanFilter(p)} style={{ background: planFilter === p ? T.primary : T.elevated, color: planFilter === p ? "#fff" : T.muted, border: `1px solid ${planFilter === p ? T.primary : T.border}`, borderRadius: 8, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                  {p === "all" ? "All plans" : PLAN_CONFIG[p]?.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tenant table */}
          <div style={{ background: T.card, borderRadius: 16, border: `1px solid ${T.border}`, overflow: "hidden" }}>
            {/* Header */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 2fr 1fr 1fr", gap: 0, background: T.elevated, padding: "10px 16px", borderBottom: `1px solid ${T.border}` }}>
              {["Tenant","Plan","Status","Employees","Usage","MRR","Last Login"].map(h => (
                <div key={h} style={{ fontSize: 10, fontWeight: 700, color: T.dim, textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</div>
              ))}
            </div>
            {filtered.map((t, i) => {
              const plan   = PLAN_CONFIG[t.plan] ?? PLAN_CONFIG.starter;
              const status = STATUS_CONFIG[t.status] ?? STATUS_CONFIG.active;
              const seatPct= t.seat_limit === -1 ? 20 : Math.round(t.employees / t.seat_limit * 100);
              const apiPct = Math.round(t.api_calls_today / t.api_limit * 100);
              const trialDays = t.trial_ends_at ? Math.ceil((new Date(t.trial_ends_at)-new Date())/86400000) : null;
              return (
                <div key={t.id} onClick={() => setSelected(t)}
                  style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 2fr 1fr 1fr", gap: 0, padding: "14px 16px", borderBottom: i < filtered.length-1 ? `1px solid ${T.border}22` : "none", cursor: "pointer", transition: "background 0.1s", background: "transparent" }}
                  onMouseEnter={e => e.currentTarget.style.background = T.elevated}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  {/* Name */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: plan.color + "33", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, color: plan.color, flexShrink: 0 }}>
                      {t.name[0]}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: T.dim }}>{t.subdomain}.xavvysuite.com</div>
                    </div>
                  </div>
                  {/* Plan */}
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: plan.color + "22", color: plan.color, fontWeight: 700 }}>{plan.label}</span>
                  </div>
                  {/* Status */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: status.color }} />
                    <span style={{ fontSize: 12, color: status.color, fontWeight: 700 }}>{status.label}</span>
                    {trialDays !== null && <span style={{ fontSize: 10, color: T.warning }}>({trialDays}d)</span>}
                  </div>
                  {/* Employees */}
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{t.employees}</div>
                      <div style={{ fontSize: 10, color: T.dim }}>of {t.seat_limit === -1 ? "∞" : t.seat_limit}</div>
                    </div>
                  </div>
                  {/* Usage bars */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, justifyContent: "center" }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ fontSize: 9, color: T.dim, width: 30 }}>Seats</span>
                      <Bar value={t.employees} max={t.seat_limit} />
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ fontSize: 9, color: T.dim, width: 30 }}>API</span>
                      <Bar value={t.api_calls_today} max={t.api_limit} />
                    </div>
                  </div>
                  {/* MRR */}
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: t.mrr > 0 ? T.success : T.dim }}>£{t.mrr}</span>
                  </div>
                  {/* Last login */}
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: T.dim }}>{t.last_login}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: 40, color: T.dim }}>No tenants match your filters</div>
          )}
        </div>
      )}

      {selected && <TenantDetail tenant={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

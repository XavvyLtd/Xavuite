import { useState } from "react";

const ROLES = [
  { id: "super_admin",        label: "Super Admin",        color: "#6366F1", desc: "Full platform access — wildcard *:*:*" },
  { id: "hr_admin",           label: "HR Admin",           color: "#10B981", desc: "HR, Leave, Recruitment, Compliance, Onboarding" },
  { id: "manager",            label: "Manager",            color: "#F59E0B", desc: "Team approvals, project management, resource planning" },
  { id: "finance_admin",      label: "Finance Admin",      color: "#8B5CF6", desc: "Expenses, invoicing, clients, financial reporting" },
  { id: "compliance_officer", label: "Compliance Officer", color: "#EF4444", desc: "RTW, visas, audit log, GDPR" },
  { id: "employee",           label: "Employee",           color: "#94A3B8", desc: "Self-service: submit timesheets, leave, expenses, view tasks" },
];

const MODULES = [
  {
    group: "People",
    items: [
      { module: "HR — View Employees",       perms: { super_admin:"✅ Full", hr_admin:"✅ Full", manager:"👁 View", finance_admin:"—", compliance_officer:"👁 View", employee:"👁 Own only" } },
      { module: "HR — Create/Edit Employees",perms: { super_admin:"✅ Full", hr_admin:"✅ Full", manager:"—",      finance_admin:"—", compliance_officer:"—",      employee:"—" } },
      { module: "HR — Salary/Compensation",  perms: { super_admin:"✅ Full", hr_admin:"✅ Full", manager:"—",      finance_admin:"👁 View", compliance_officer:"—", employee:"—" } },
      { module: "HR — Assign Roles",         perms: { super_admin:"✅ Full", hr_admin:"—",      manager:"—",      finance_admin:"—", compliance_officer:"—",      employee:"—" } },
      { module: "Leave — Submit",            perms: { super_admin:"✅ Full", hr_admin:"✅ Full", manager:"✅",     finance_admin:"✅", compliance_officer:"✅",     employee:"✅" } },
      { module: "Leave — Approve",           perms: { super_admin:"✅ Full", hr_admin:"✅ Full", manager:"✅",     finance_admin:"—", compliance_officer:"—",      employee:"—" } },
      { module: "Leave — Manage Policies",   perms: { super_admin:"✅ Full", hr_admin:"✅ Full", manager:"—",      finance_admin:"—", compliance_officer:"—",      employee:"—" } },
      { module: "Onboarding — View",         perms: { super_admin:"✅ Full", hr_admin:"✅ Full", manager:"👁 View",finance_admin:"—", compliance_officer:"👁 View",employee:"👁 Own" } },
      { module: "Onboarding — Manage",       perms: { super_admin:"✅ Full", hr_admin:"✅ Full", manager:"—",      finance_admin:"—", compliance_officer:"—",      employee:"—" } },
      { module: "Offboarding — View",        perms: { super_admin:"✅ Full", hr_admin:"✅ Full", manager:"👁 View",finance_admin:"—", compliance_officer:"—",      employee:"—" } },
      { module: "Offboarding — Manage",      perms: { super_admin:"✅ Full", hr_admin:"✅ Full", manager:"—",      finance_admin:"—", compliance_officer:"—",      employee:"—" } },
      { module: "Recruitment",               perms: { super_admin:"✅ Full", hr_admin:"✅ Full", manager:"👁 View",finance_admin:"—", compliance_officer:"—",      employee:"—" } },
      { module: "Training",                  perms: { super_admin:"✅ Full", hr_admin:"✅ Full", manager:"✅",     finance_admin:"—", compliance_officer:"—",      employee:"👁+Record" } },
      { module: "Org Chart",                 perms: { super_admin:"✅",      hr_admin:"✅",      manager:"✅",     finance_admin:"✅", compliance_officer:"✅",     employee:"✅" } },
    ]
  },
  {
    group: "Projects",
    items: [
      { module: "PMO — View Projects",       perms: { super_admin:"✅ Full", hr_admin:"—",      manager:"✅ Full",finance_admin:"👁 View", compliance_officer:"—",  employee:"👁 View" } },
      { module: "PMO — Create/Edit Projects",perms: { super_admin:"✅ Full", hr_admin:"—",      manager:"✅",     finance_admin:"—", compliance_officer:"—",      employee:"—" } },
      { module: "PMO — Tasks (own)",         perms: { super_admin:"✅ Full", hr_admin:"—",      manager:"✅",     finance_admin:"—", compliance_officer:"—",      employee:"✅ Edit own" } },
      { module: "Timesheets — Submit",       perms: { super_admin:"✅ Full", hr_admin:"✅",     manager:"✅",     finance_admin:"✅", compliance_officer:"✅",     employee:"✅" } },
      { module: "Timesheets — Approve",      perms: { super_admin:"✅ Full", hr_admin:"✅",     manager:"✅",     finance_admin:"✅", compliance_officer:"—",      employee:"—" } },
      { module: "Timesheets — Export",       perms: { super_admin:"✅ Full", hr_admin:"—",      manager:"—",      finance_admin:"✅", compliance_officer:"—",      employee:"—" } },
      { module: "Resources — View",          perms: { super_admin:"✅ Full", hr_admin:"—",      manager:"✅",     finance_admin:"👁 View", compliance_officer:"—",  employee:"—" } },
      { module: "Resources — Manage Bookings",perms:{ super_admin:"✅ Full", hr_admin:"—",      manager:"✅",     finance_admin:"—", compliance_officer:"—",      employee:"—" } },
    ]
  },
  {
    group: "Finance & Clients",
    items: [
      { module: "Expenses — Submit",         perms: { super_admin:"✅ Full", hr_admin:"✅",     manager:"✅",     finance_admin:"✅", compliance_officer:"✅",     employee:"✅" } },
      { module: "Expenses — Approve",        perms: { super_admin:"✅ Full", hr_admin:"—",      manager:"✅",     finance_admin:"✅", compliance_officer:"—",      employee:"—" } },
      { module: "Clients — View",            perms: { super_admin:"✅ Full", hr_admin:"—",      manager:"—",      finance_admin:"✅", compliance_officer:"—",      employee:"—" } },
      { module: "Clients — Create/Edit",     perms: { super_admin:"✅ Full", hr_admin:"—",      manager:"—",      finance_admin:"✅", compliance_officer:"—",      employee:"—" } },
      { module: "Invoicing — View",          perms: { super_admin:"✅ Full", hr_admin:"—",      manager:"—",      finance_admin:"✅", compliance_officer:"—",      employee:"—" } },
      { module: "Invoicing — Create/Edit",   perms: { super_admin:"✅ Full", hr_admin:"—",      manager:"—",      finance_admin:"✅", compliance_officer:"—",      employee:"—" } },
      { module: "Invoicing — Send/Void",     perms: { super_admin:"✅ Full", hr_admin:"—",      manager:"—",      finance_admin:"✅", compliance_officer:"—",      employee:"—" } },
    ]
  },
  {
    group: "Compliance & Legal",
    items: [
      { module: "RTW Checks",                perms: { super_admin:"✅ Full", hr_admin:"✅ Full", manager:"—",      finance_admin:"—", compliance_officer:"✅ Full", employee:"—" } },
      { module: "Visa Records",              perms: { super_admin:"✅ Full", hr_admin:"✅ Full", manager:"—",      finance_admin:"—", compliance_officer:"✅ Full", employee:"—" } },
      { module: "Checklists",                perms: { super_admin:"✅ Full", hr_admin:"✅ Full", manager:"👁 View",finance_admin:"—", compliance_officer:"✅ Full", employee:"👁 Own" } },
      { module: "SOS / Incidents",           perms: { super_admin:"✅ Full", hr_admin:"✅",     manager:"👁 View",finance_admin:"—", compliance_officer:"✅",      employee:"✅ Submit" } },
      { module: "GDPR — Subject Requests",   perms: { super_admin:"✅ Full", hr_admin:"✅",     manager:"—",      finance_admin:"—", compliance_officer:"✅",      employee:"—" } },
      { module: "GDPR — Breach Log",         perms: { super_admin:"✅ Full", hr_admin:"—",      manager:"—",      finance_admin:"—", compliance_officer:"✅",      employee:"—" } },
      { module: "GDPR — Configuration",      perms: { super_admin:"✅ Full", hr_admin:"—",      manager:"—",      finance_admin:"—", compliance_officer:"—",       employee:"—" } },
      { module: "Audit Log",                 perms: { super_admin:"✅ Full", hr_admin:"—",      manager:"—",      finance_admin:"—", compliance_officer:"✅ View",  employee:"—" } },
    ]
  },
  {
    group: "Reporting",
    items: [
      { module: "Headcount Report",          perms: { super_admin:"✅",      hr_admin:"✅",     manager:"✅",     finance_admin:"—", compliance_officer:"—",       employee:"—" } },
      { module: "Leave Report",              perms: { super_admin:"✅",      hr_admin:"✅",     manager:"✅",     finance_admin:"—", compliance_officer:"—",       employee:"—" } },
      { module: "Timesheet Utilisation",     perms: { super_admin:"✅",      hr_admin:"✅",     manager:"✅",     finance_admin:"✅", compliance_officer:"—",       employee:"—" } },
      { module: "Financial / Invoice Report",perms: { super_admin:"✅",      hr_admin:"—",      manager:"—",      finance_admin:"✅", compliance_officer:"—",       employee:"—" } },
      { module: "Projects Report",           perms: { super_admin:"✅",      hr_admin:"—",      manager:"✅",     finance_admin:"✅", compliance_officer:"—",       employee:"—" } },
      { module: "Compliance Report",         perms: { super_admin:"✅",      hr_admin:"✅",     manager:"—",      finance_admin:"—", compliance_officer:"✅",       employee:"—" } },
    ]
  },
  {
    group: "Platform & Settings",
    items: [
      { module: "Documents",                 perms: { super_admin:"✅ Full", hr_admin:"✅",     manager:"👁",     finance_admin:"—", compliance_officer:"—",       employee:"👁" } },
      { module: "Announcements",             perms: { super_admin:"✅ Full", hr_admin:"✅",     manager:"👁",     finance_admin:"—", compliance_officer:"—",       employee:"👁" } },
      { module: "Workflow Engine",           perms: { super_admin:"✅ Full", hr_admin:"—",      manager:"—",      finance_admin:"—", compliance_officer:"—",       employee:"—" } },
      { module: "Scheduler",                 perms: { super_admin:"✅ Full", hr_admin:"—",      manager:"—",      finance_admin:"—", compliance_officer:"—",       employee:"—" } },
      { module: "Settings — Company Info",   perms: { super_admin:"✅ Full", hr_admin:"✅",     manager:"—",      finance_admin:"✅", compliance_officer:"—",       employee:"—" } },
      { module: "Settings — Branding/SSO",   perms: { super_admin:"✅ Full", hr_admin:"—",      manager:"—",      finance_admin:"—", compliance_officer:"—",       employee:"—" } },
      { module: "Settings — Module Toggles", perms: { super_admin:"✅ Full", hr_admin:"—",      manager:"—",      finance_admin:"—", compliance_officer:"—",       employee:"—" } },
      { module: "Cookie Preferences",        perms: { super_admin:"✅",      hr_admin:"✅",     manager:"✅",     finance_admin:"✅", compliance_officer:"✅",       employee:"✅" } },
    ]
  },
];

const CELL_COLOR = (v) => {
  if (v === "—") return { bg: "transparent", text: "#334155" };
  if (v.startsWith("✅ Full")) return { bg: "#6366F122", text: "#818CF8" };
  if (v.startsWith("✅")) return { bg: "#10B98122", text: "#10B981" };
  if (v.startsWith("👁")) return { bg: "#F59E0B11", text: "#F59E0B" };
  return { bg: "#64748B11", text: "#64748B" };
};

export default function PermissionMatrix() {
  const [activeGroup, setActiveGroup] = useState("All");
  const [search, setSearch] = useState("");
  const [highlight, setHighlight] = useState(null);

  const groups = ["All", ...MODULES.map(m => m.group)];

  const filtered = MODULES
    .filter(m => activeGroup === "All" || m.group === activeGroup)
    .map(m => ({
      ...m,
      items: m.items.filter(i =>
        i.module.toLowerCase().includes(search.toLowerCase())
      )
    }))
    .filter(m => m.items.length > 0);

  const T = {
    bg: "#020617", surface: "#0B1120", elevated: "#111827",
    card: "#0F172A", border: "#1E293B", text: "#F1F5F9",
    muted: "#94A3B8", dim: "#475569", primary: "#6366F1",
  };

  return (
    <div style={{ background: T.bg, minHeight: "100vh", fontFamily: "Inter, system-ui, sans-serif", padding: 0 }}>

      {/* Header */}
      <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, padding: "20px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <h1 style={{ color: T.text, fontSize: 22, fontWeight: 900, margin: 0 }}>🔐 Role-Permission Matrix</h1>
            <p style={{ color: T.muted, fontSize: 13, margin: "4px 0 0" }}>XavvySuite v1.1 — {MODULES.reduce((n, m) => n + m.items.length, 0)} permissions across {MODULES.length} module groups</p>
          </div>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search permissions..."
            style={{ background: T.elevated, border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 14px", color: T.text, fontSize: 13, outline: "none", width: 220 }}
          />
        </div>

        {/* Role legend */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {ROLES.map(r => (
            <div
              key={r.id}
              onClick={() => setHighlight(highlight === r.id ? null : r.id)}
              style={{
                display: "flex", alignItems: "center", gap: 8, padding: "6px 12px",
                background: highlight === r.id ? r.color + "33" : T.elevated,
                border: `1px solid ${highlight === r.id ? r.color : T.border}`,
                borderRadius: 20, cursor: "pointer", transition: "all 0.15s",
              }}
            >
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: r.color }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: highlight === r.id ? r.color : T.muted }}>{r.label}</span>
            </div>
          ))}
        </div>

        {/* Highlight tip */}
        {highlight && (
          <div style={{ fontSize: 12, color: T.dim, marginBottom: 4 }}>
            Highlighting: <strong style={{ color: ROLES.find(r => r.id === highlight)?.color }}>{ROLES.find(r => r.id === highlight)?.label}</strong>
            {" "}— {ROLES.find(r => r.id === highlight)?.desc}
            {" "}<button onClick={() => setHighlight(null)} style={{ background: "none", border: "none", color: T.dim, cursor: "pointer", fontSize: 11 }}>✕ Clear</button>
          </div>
        )}

        {/* Legend */}
        <div style={{ display: "flex", gap: 16, fontSize: 11, color: T.dim }}>
          <span><span style={{ color: "#818CF8" }}>✅ Full</span> = full CRUD access</span>
          <span><span style={{ color: "#10B981" }}>✅</span> = permitted</span>
          <span><span style={{ color: "#F59E0B" }}>👁</span> = view / read only</span>
          <span><span style={{ color: T.dim }}>—</span> = no access</span>
        </div>
      </div>

      {/* Group filter tabs */}
      <div style={{ display: "flex", gap: 4, padding: "12px 24px", background: T.surface, borderBottom: `1px solid ${T.border}`, overflowX: "auto" }}>
        {groups.map(g => (
          <button key={g} onClick={() => setActiveGroup(g)} style={{
            background: activeGroup === g ? T.primary : T.elevated,
            color: activeGroup === g ? "#fff" : T.muted,
            border: `1px solid ${activeGroup === g ? T.primary : T.border}`,
            borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 700,
            cursor: "pointer", whiteSpace: "nowrap",
          }}>{g}</button>
        ))}
      </div>

      {/* Matrix */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
          <thead>
            <tr style={{ background: T.elevated, position: "sticky", top: 0, zIndex: 10 }}>
              <th style={{ padding: "12px 16px", textAlign: "left", color: T.dim, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: `1px solid ${T.border}`, minWidth: 220 }}>
                Permission / Module
              </th>
              {ROLES.map(r => (
                <th key={r.id} style={{
                  padding: "12px 10px", textAlign: "center", borderBottom: `1px solid ${T.border}`,
                  minWidth: 110, cursor: "pointer",
                  background: highlight === r.id ? r.color + "22" : T.elevated,
                }} onClick={() => setHighlight(highlight === r.id ? null : r.id)}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: r.color, margin: "0 auto 4px" }} />
                  <div style={{ fontSize: 10, fontWeight: 700, color: highlight === r.id ? r.color : T.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {r.label}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(group => (
              <>
                {/* Group header row */}
                <tr key={group.group}>
                  <td colSpan={7} style={{ padding: "14px 16px 6px", background: T.bg }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: T.dim, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                      {group.group}
                    </div>
                  </td>
                </tr>
                {/* Permission rows */}
                {group.items.map((item, i) => (
                  <tr key={item.module} style={{ background: i % 2 === 0 ? T.card : T.bg, borderBottom: `1px solid ${T.border}22` }}>
                    <td style={{ padding: "10px 16px", fontSize: 13, color: T.muted, fontWeight: 500 }}>
                      {item.module}
                    </td>
                    {ROLES.map(r => {
                      const val = item.perms[r.id] ?? "—";
                      const { bg, text } = CELL_COLOR(val);
                      const isDimmed = highlight && highlight !== r.id;
                      return (
                        <td key={r.id} style={{
                          padding: "10px 8px", textAlign: "center",
                          background: highlight === r.id ? r.color + "11" : bg,
                          opacity: isDimmed ? 0.3 : 1,
                          transition: "opacity 0.2s",
                        }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: highlight === r.id ? r.color : text }}>
                            {val}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary stats */}
      <div style={{ display: "flex", gap: 12, padding: "16px 24px", background: T.surface, borderTop: `1px solid ${T.border}`, flexWrap: "wrap" }}>
        {ROLES.map(r => {
          const total = MODULES.reduce((n, m) => n + m.items.length, 0);
          const granted = MODULES.reduce((n, m) => n + m.items.filter(i => i.perms[r.id] !== "—").length, 0);
          const pct = Math.round(granted / total * 100);
          return (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", background: T.elevated, borderRadius: 10, border: `1px solid ${T.border}` }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: r.color }} />
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.muted }}>{r.label}</div>
                <div style={{ fontSize: 10, color: T.dim }}>{granted}/{total} permissions ({pct}%)</div>
              </div>
              <div style={{ width: 60, background: T.border, borderRadius: 99, height: 4 }}>
                <div style={{ width: `${pct}%`, height: "100%", background: r.color, borderRadius: 99 }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

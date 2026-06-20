import { useState } from 'react';
import { useEmployees, useDepartments, type Employee } from '../../hooks/api';
import { Card, Loading, C, Avatar } from '../../components/ui';

// ── Build tree from flat employee list ────────────────────────────────────────
interface OrgNode {
  employee: Employee;
  children: OrgNode[];
  depth: number;
}

function buildTree(employees: Employee[]): OrgNode[] {
  const byId = new Map<string, Employee>();
  employees.forEach(e => byId.set(e.id, e));

  const roots: OrgNode[] = [];
  const nodeMap = new Map<string, OrgNode>();

  // First pass — create all nodes
  employees.forEach(e => {
    nodeMap.set(e.id, { employee: e, children: [], depth: 0 });
  });

  // Second pass — assign children
  employees.forEach(e => {
    const node = nodeMap.get(e.id)!;
    if (e.manager_id && nodeMap.has(e.manager_id)) {
      const parent = nodeMap.get(e.manager_id)!;
      node.depth = parent.depth + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

// ── Org node card ─────────────────────────────────────────────────────────────
function OrgNodeCard({ node, onSelect, selectedId }: {
  node: OrgNode;
  onSelect: (emp: Employee) => void;
  selectedId?: string;
}) {
  const [collapsed, setCollapsed] = useState(node.depth > 1);
  const emp = node.employee;
  const isSelected = emp.id === selectedId;
  const hasChildren = node.children.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
      {/* Card */}
      <div
        onClick={() => onSelect(emp)}
        style={{
          background: isSelected ? C.primary + '22' : C.card,
          border: `${isSelected ? 2 : 1}px solid ${isSelected ? C.primary : C.border}`,
          borderRadius: 12,
          padding: '12px 14px',
          cursor: 'pointer',
          minWidth: 160,
          maxWidth: 200,
          textAlign: 'center',
          transition: 'all 0.15s',
          boxShadow: isSelected ? `0 0 0 3px ${C.primary}33` : 'none',
        }}
        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = C.primary + '66'; }}
        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = C.border; }}
      >
        <Avatar name={`${emp.first_name} ${emp.last_name}`} size={36} />
        <div style={{ fontWeight: 700, fontSize: 12, color: C.text, marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {emp.first_name} {emp.last_name}
        </div>
        {emp.designation_title && (
          <div style={{ fontSize: 10, color: C.muted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {emp.designation_title}
          </div>
        )}
        {emp.department_name && (
          <div style={{ fontSize: 9, color: C.primary, marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
            {emp.department_name}
          </div>
        )}
        <div style={{ marginTop: 6 }}>
          <span style={{
            background: emp.status === 'active' ? C.success + '22' : C.dim + '22',
            color: emp.status === 'active' ? C.success : C.dim,
            borderRadius: 4, fontSize: 9, padding: '2px 6px', fontWeight: 700
          }}>{emp.status}</span>
        </div>
      </div>

      {/* Collapse/expand toggle */}
      {hasChildren && (
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            background: C.elevated, color: C.muted, border: `1px solid ${C.border}`,
            borderRadius: '50%', width: 20, height: 20, fontSize: 10, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginTop: 4, flexShrink: 0,
          }}
        >
          {collapsed ? '+' : '−'}
        </button>
      )}

      {/* Children */}
      {!collapsed && hasChildren && (
        <div style={{ position: 'relative', marginTop: 4 }}>
          {/* Vertical line down */}
          <div style={{ width: 2, height: 20, background: C.border, margin: '0 auto' }} />
          {/* Horizontal connector line */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, position: 'relative' }}>
            {node.children.length > 1 && (
              <div style={{
                position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                width: `${(node.children.length - 1) * 210}px`, height: 2, background: C.border,
              }} />
            )}
            {node.children.map((child, i) => (
              <div key={child.employee.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 12px', position: 'relative' }}>
                {/* Vertical line up to connector */}
                <div style={{ width: 2, height: 20, background: C.border, marginBottom: 0 }} />
                <OrgNodeCard node={child} onSelect={onSelect} selectedId={selectedId} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Department filter sidebar ─────────────────────────────────────────────────
function DeptSidebar({ departments, selected, onSelect }: {
  departments: any[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div style={{ width: 200, flexShrink: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Departments</div>
      <button onClick={() => onSelect('')} style={{ display: 'block', width: '100%', background: selected === '' ? C.primary + '22' : 'transparent', color: selected === '' ? C.primary : C.muted, border: `1px solid ${selected === '' ? C.primary : 'transparent'}`, borderRadius: 8, padding: '7px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', textAlign: 'left', marginBottom: 4 }}>
        All Employees
      </button>
      {departments.map(d => (
        <button key={d.id} onClick={() => onSelect(d.id)} style={{ display: 'block', width: '100%', background: selected === d.id ? C.primary + '22' : 'transparent', color: selected === d.id ? C.primary : C.muted, border: `1px solid ${selected === d.id ? C.primary : 'transparent'}`, borderRadius: 8, padding: '7px 10px', fontSize: 12, fontWeight: selected === d.id ? 700 : 500, cursor: 'pointer', textAlign: 'left', marginBottom: 4 }}>
          {d.name}
          {d.employee_count > 0 && <span style={{ float: 'right', fontSize: 10, color: C.dim }}>{d.employee_count}</span>}
        </button>
      ))}
    </div>
  );
}

// ── Selected employee panel ───────────────────────────────────────────────────
function EmployeePanel({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  return (
    <div style={{
      position: 'fixed', right: 20, top: '50%', transform: 'translateY(-50%)',
      width: 260, background: C.card, border: `1px solid ${C.border}`,
      borderRadius: 16, padding: 20, zIndex: 50, boxShadow: '0 20px 60px #00000066',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 11, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Employee</div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
      </div>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <Avatar name={`${employee.first_name} ${employee.last_name}`} size={56} />
        <div style={{ fontWeight: 800, fontSize: 16, color: C.text, marginTop: 10 }}>{employee.first_name} {employee.last_name}</div>
        {employee.designation_title && <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{employee.designation_title}</div>}
      </div>
      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
        {[
          { label: 'Department',  value: employee.department_name },
          { label: 'Status',      value: employee.status },
          { label: 'Type',        value: employee.employment_type?.replace(/_/g, ' ') },
          { label: 'Location',    value: employee.work_location_type?.replace(/_/g, ' ') },
          { label: 'Employee #',  value: employee.employee_number },
        ].filter(r => r.value).map(row => (
          <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${C.border}33` }}>
            <span style={{ fontSize: 11, color: C.dim }}>{row.label}</span>
            <span style={{ fontSize: 11, color: C.text, fontWeight: 600, textTransform: 'capitalize' }}>{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Org Chart Module ─────────────────────────────────────────────────────
export default function OrgChartModule() {
  const [deptFilter, setDeptFilter] = useState('');
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [view, setView] = useState<'tree' | 'list'>('tree');

  const params: Record<string, string> = {};
  if (deptFilter) params.departmentId = deptFilter;

  const { data: employees, isLoading } = useEmployees(params);
  const { data: departments = [] }     = useDepartments();

  const items = employees?.items ?? [];
  const tree  = buildTree(items);

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ color: C.text, fontSize: 20, fontWeight: 800, margin: 0 }}>Org Chart</h2>
          <p style={{ color: C.muted, fontSize: 12, margin: '4px 0 0' }}>{items.length} people · {departments.length} departments</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setView('tree')} style={{ background: view === 'tree' ? C.primary : C.elevated, color: view === 'tree' ? '#fff' : C.muted, border: `1px solid ${view === 'tree' ? C.primary : C.border}`, borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>🌳 Tree</button>
          <button onClick={() => setView('list')} style={{ background: view === 'list' ? C.primary : C.elevated, color: view === 'list' ? '#fff' : C.muted, border: `1px solid ${view === 'list' ? C.primary : C.border}`, borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>📋 List</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20 }}>
        {/* Sidebar */}
        <DeptSidebar departments={departments as any[]} selected={deptFilter} onSelect={setDeptFilter} />

        {/* Chart area */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {isLoading ? <Loading /> : view === 'tree' ? (
            <div style={{ padding: '20px', overflow: 'auto', minHeight: 400, background: C.surface, borderRadius: 12, border: `1px solid ${C.border}` }}>
              {items.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: C.dim }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🏢</div>
                  <div>No employees in this view</div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 40, justifyContent: 'center', flexWrap: 'wrap', paddingBottom: 20 }}>
                  {tree.map(root => (
                    <div key={root.employee.id}><OrgNodeCard node={root} onSelect={setSelectedEmp as any} selectedId={selectedEmp?.id} /></div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            // List view
            <Card>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {items.map((emp, i) => (
                  <div key={emp.id} onClick={() => setSelectedEmp(emp)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: `1px solid ${C.border}33`, cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = C.elevated}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <Avatar name={`${emp.first_name} ${emp.last_name}`} size={32} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{emp.first_name} {emp.last_name}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>{emp.designation_title ?? '—'}</div>
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, minWidth: 120 }}>{emp.department_name ?? '—'}</div>
                    <div style={{ fontSize: 10, color: emp.status === 'active' ? C.success : C.dim, fontWeight: 700, textTransform: 'uppercase', minWidth: 60 }}>{emp.status}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      {selectedEmp && <EmployeePanel employee={selectedEmp} onClose={() => setSelectedEmp(null)} />}
    </div>
  );
}

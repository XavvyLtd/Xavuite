import { useState, ReactNode } from 'react';

// ── Colours — imported from platform theme (single source of truth) ───────────
export { C, STATUS_COLORS } from '../platform/branding/theme';
import { C, STATUS_COLORS } from '../platform/branding/theme';

// ── Badge ─────────────────────────────────────────────────────────────────────
export function Badge({ children, color }: { children: ReactNode; color?: string }) {
  const c = color ?? C.accent;
  return (
    <span style={{
      background: c + '22', color: c, border: `1px solid ${c}33`,
      borderRadius: 6, fontSize: 10, fontWeight: 700,
      padding: '2px 8px', letterSpacing: '0.05em',
      textTransform: 'uppercase', whiteSpace: 'nowrap', display: 'inline-block'
    }}>{children}</span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const key = status?.toLowerCase().replace(/_/g, ' ');
  return <Badge color={STATUS_COLORS[key] ?? C.muted}>{status?.replace(/_/g, ' ')}</Badge>;
}

// ── Card ──────────────────────────────────────────────────────────────────────
export function Card({ children, style, onClick, className = '', ...rest }: {
  children: ReactNode; style?: React.CSSProperties; onClick?: () => void; className?: string; [key: string]: any;
}) {
  const [h, setH] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => onClick && setH(true)}
      onMouseLeave={() => setH(false)}
      className={className}
      style={{
        background: C.card, border: `1px solid ${h ? C.borderB : C.border}`,
        borderRadius: 16, padding: 20, transition: 'all 0.15s',
        cursor: onClick ? 'pointer' : 'default',
        transform: h ? 'translateY(-1px)' : 'none',
        ...style,
      }}
    >{children}</div>
  );
}

// ── MetricCard ────────────────────────────────────────────────────────────────
export function MetricCard({ label, value, sub, color, icon, onClick }: {
  label: string; value: string | number; sub?: string;
  color?: string; icon?: string; onClick?: () => void;
}) {
  return (
    <Card onClick={onClick} style={{ position: 'relative', overflow: 'hidden', padding: '18px 20px' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color ?? C.accent, borderRadius: '16px 16px 0 0' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ color: C.muted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{label}</div>
          <div style={{ color: C.text, fontSize: 28, fontWeight: 800, lineHeight: 1 }}>{value}</div>
          {sub && <div style={{ color: C.dim, fontSize: 11, marginTop: 6 }}>{sub}</div>}
        </div>
        {icon && <div style={{ fontSize: 24, opacity: 0.5 }}>{icon}</div>}
      </div>
    </Card>
  );
}

// ── SectionHeader ─────────────────────────────────────────────────────────────
export function SectionHeader({ title, sub, actions }: {
  title: string; sub?: string; actions?: ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20 }}>
      <div>
        <h2 style={{ color: C.text, fontSize: 20, fontWeight: 800, margin: 0 }}>{title}</h2>
        {sub && <p style={{ color: C.muted, fontSize: 12, margin: '4px 0 0' }}>{sub}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
    </div>
  );
}

// ── Button ────────────────────────────────────────────────────────────────────
export function Btn({ children, onClick, variant = 'primary', small, disabled }: {
  children: ReactNode; onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'danger' | 'success'; small?: boolean; disabled?: boolean;
}) {
  const [h, setH] = useState(false);
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: h ? C.accentH : C.accent, color: '#fff', border: 'none' },
    ghost:   { background: h ? C.elevated : 'transparent', color: C.muted, border: `1px solid ${C.border}` },
    danger:  { background: h ? '#DC2626' : C.red + '22', color: C.red, border: `1px solid ${C.red}33` },
    success: { background: h ? '#059669' : C.green + '22', color: C.green, border: `1px solid ${C.green}33` },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        ...styles[variant], borderRadius: 8,
        padding: small ? '5px 12px' : '8px 18px',
        fontSize: small ? 11 : 13, fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s',
      }}
    >{children}</button>
  );
}

// ── ProgressBar ───────────────────────────────────────────────────────────────
export function ProgressBar({ value, color, height = 6 }: { value: number; color?: string; height?: number }) {
  return (
    <div style={{ background: C.border, borderRadius: 99, height, overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(100, Math.max(0, value))}%`, height: '100%', background: color ?? C.accent, borderRadius: 99, transition: 'width 0.4s' }} />
    </div>
  );
}

// ── Table ─────────────────────────────────────────────────────────────────────
export interface ColDef<T> {
  key: keyof T | string;
  label: string;
  muted?: boolean;
  render?: (value: any, row: T) => ReactNode;
}

export function DataTable<T extends object>({ cols, rows, onRow, emptyText = 'No records found' }: {
  cols: ColDef<T>[]; rows: T[]; onRow?: (row: T) => void; emptyText?: string;
}) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: C.surface }}>
            {cols.map((c: any) => (
              <th key={String(c.key)} style={{
                padding: '10px 14px', textAlign: 'left', color: C.dim,
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.08em', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap'
              }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={cols.length} style={{ textAlign: 'center', padding: '40px', color: C.dim, fontSize: 13 }}>{emptyText}</td></tr>
          ) : rows.map((row, i) => (
            <tr
              key={i}
              onClick={() => onRow?.(row)}
              style={{ borderBottom: `1px solid ${C.border}33`, cursor: onRow ? 'pointer' : 'default', transition: 'background 0.1s' }}
              onMouseEnter={(e: any) => onRow && (e.currentTarget.style.background = C.elevated)}
              onMouseLeave={(e: any) => (e.currentTarget.style.background = 'transparent')}
            >
              {cols.map((c: any) => (
                <td key={String(c.key)} style={{ padding: '12px 14px', color: c.muted ? C.muted : C.text, verticalAlign: 'middle' }}>
                  {c.render ? c.render((row as any)[c.key], row) : String((row as any)[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function Modal({ title, onClose, children, wide }: {
  title: string; onClose: () => void; children: ReactNode; wide?: boolean;
}) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
      onClick={(e: any) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: C.card, border: `1px solid ${C.borderB}`, borderRadius: 20, width: '100%', maxWidth: wide ? 760 : 540, maxHeight: '88vh', overflow: 'auto', boxShadow: '0 25px 80px rgba(0,0,0,0.7)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: `1px solid ${C.border}` }}>
          <h3 style={{ color: C.text, fontWeight: 800, fontSize: 16, margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: C.elevated, border: `1px solid ${C.border}`, color: C.muted, borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  );
}

// ── InfoRow ───────────────────────────────────────────────────────────────────
export function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: `1px solid ${C.border}33`, fontSize: 13 }}>
      <span style={{ color: C.muted, flexShrink: 0, marginRight: 16 }}>{label}</span>
      <span style={{ color: C.text, fontWeight: 600, textAlign: 'right' }}>{value ?? '—'}</span>
    </div>
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────────
export function Avatar({ name, size = 32 }: { name?: string; size?: number }) {
  const initials = name?.split(' ').map((p: any) => p[0]).join('').slice(0, 2).toUpperCase() ?? '??';
  const colors = [C.accent, C.teal, C.purple, C.amber, C.sky];
  const color = colors[(name?.charCodeAt(0) ?? 0) % colors.length];
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: color + '33', border: `1.5px solid ${color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, fontSize: size * 0.35, fontWeight: 800, flexShrink: 0 }}>
      {initials}
    </div>
  );
}

// ── Search ────────────────────────────────────────────────────────────────────
export function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.dim, fontSize: 14 }}>🔍</span>
      <input
        value={value} onChange={(e: any) => onChange(e.target.value)} placeholder={placeholder ?? 'Search...'}
        style={{ background: C.elevated, border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 12px 8px 32px', color: C.text, fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' }}
      />
    </div>
  );
}

// ── Loading / Empty ───────────────────────────────────────────────────────────
export function Loading({ text = 'Loading...' }: { text?: string }) {
  return <div style={{ textAlign: 'center', padding: '60px 20px', color: C.muted, fontSize: 14 }}>{text}</div>;
}

export function Empty({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '50px 20px', color: C.dim }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 13 }}>{text}</div>
    </div>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
export function Tabs({ tabs, active, onChange }: { tabs: { key: string; label: string }[]; active: string; onChange: (k: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
      {tabs.map((t: any) => (
        <button key={t.key} onClick={() => onChange(t.key)} style={{
          background: active === t.key ? C.accent : C.elevated,
          color: active === t.key ? '#fff' : C.muted,
          border: `1px solid ${active === t.key ? C.accent : C.border}`,
          borderRadius: 8, padding: '7px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s'
        }}>{t.label}</button>
      ))}
    </div>
  );
}

// ── Form helpers ──────────────────────────────────────────────────────────────
export function FormField({ label, children, required }: { label: string; children: ReactNode; required?: boolean }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        {label}{required && <span style={{ color: C.red, marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

export const inputStyle: React.CSSProperties = {
  width: '100%', background: C.elevated, border: `1px solid ${C.border}`,
  borderRadius: 8, padding: '9px 12px', color: C.text, fontSize: 13,
  outline: 'none', boxSizing: 'border-box',
};

export const selectStyle: React.CSSProperties = {
  ...inputStyle, cursor: 'pointer',
};

// ── Alert banner ──────────────────────────────────────────────────────────────
export function Alert({ type, message }: { type: 'error' | 'warning' | 'success' | 'info'; message: string }) {
  const config = {
    error:   { bg: C.red   + '11', border: C.red   + '33', color: C.red,   icon: '🚨' },
    warning: { bg: C.amber + '11', border: C.amber + '33', color: C.amber, icon: '⚠️' },
    success: { bg: C.green + '11', border: C.green + '33', color: C.green, icon: '✅' },
    info:    { bg: C.sky   + '11', border: C.sky   + '33', color: C.sky,   icon: 'ℹ️' },
  }[type];
  return (
    <div style={{ background: config.bg, border: `1px solid ${config.border}`, borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 16 }}>{config.icon}</span>
      <span style={{ color: config.color, fontSize: 13 }}>{message}</span>
    </div>
  );
}

// ── Metric grid ───────────────────────────────────────────────────────────────
export function MetricGrid({ children }: { children: ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14, marginBottom: 24 }}>{children}</div>;
}

// ── Date formatter ────────────────────────────────────────────────────────────
export function fmtDate(d?: string | null) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

export function fmtShort(d?: string | null) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }
  catch { return d; }
}

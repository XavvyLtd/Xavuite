/**
 * platform/branding/theme.ts
 *
 * Dark + Light theme tokens.
 * Theme is applied via data-theme="dark|light" on <html>.
 * C object is reactive — reads from CSS variables at runtime.
 *
 * To use: import { C } from './theme'
 * All existing C.primary, C.text etc. references continue to work.
 */

// ── CSS variable injection ─────────────────────────────────────────────────────
const DARK: Record<string, string> = {
  '--c-bg':       '#020617',
  '--c-surface':  '#0B1120',
  '--c-elevated': '#111827',
  '--c-card':     '#0F172A',
  '--c-border':   '#1E293B',
  '--c-borderB':  '#334155',
  '--c-text':     '#F1F5F9',
  '--c-muted':    '#94A3B8',
  '--c-dim':      '#475569',
  '--c-primary':  '#6366F1',
  '--c-primaryH': '#818CF8',
  '--c-secondary':'#14B8A6',
  '--c-success':  '#10B981',
  '--c-warning':  '#F59E0B',
  '--c-danger':   '#EF4444',
  '--c-sky':      '#38BDF8',
  '--c-purple':   '#A855F7',
};

const LIGHT: Record<string, string> = {
  '--c-bg':       '#F8FAFC',
  '--c-surface':  '#FFFFFF',
  '--c-elevated': '#F1F5F9',
  '--c-card':     '#FFFFFF',
  '--c-border':   '#E2E8F0',
  '--c-borderB':  '#CBD5E1',
  '--c-text':     '#0F172A',
  '--c-muted':    '#475569',
  '--c-dim':      '#94A3B8',
  '--c-primary':  '#6366F1',
  '--c-primaryH': '#4F46E5',
  '--c-secondary':'#0D9488',
  '--c-success':  '#059669',
  '--c-warning':  '#D97706',
  '--c-danger':   '#DC2626',
  '--c-sky':      '#0284C7',
  '--c-purple':   '#7C3AED',
};

export function applyTheme(theme: 'dark' | 'light') {
  const tokens = theme === 'dark' ? DARK : LIGHT;
  const root   = document.documentElement;
  Object.entries(tokens).forEach(([k, v]) => root.style.setProperty(k, v));
}

// Apply on import based on current data-theme attr
function resolveTheme(): 'dark' | 'light' {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'light') return 'light';
  if (attr === 'dark')  return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
applyTheme(resolveTheme());

// Watch for theme changes
const observer = new MutationObserver(() => applyTheme(resolveTheme()));
observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

// ── C object — uses CSS variables so it's always in sync ─────────────────────
const cv = (name: string) => `var(${name})`;

export const C = {
  bg:       cv('--c-bg'),
  surface:  cv('--c-surface'),
  elevated: cv('--c-elevated'),
  card:     cv('--c-card'),
  border:   cv('--c-border'),
  borderB:  cv('--c-borderB'),
  text:     cv('--c-text'),
  muted:    cv('--c-muted'),
  dim:      cv('--c-dim'),
  primary:  cv('--c-primary'),
  accent:   cv('--c-primary'),   // alias
  accentH:  cv('--c-primaryH'),
  primaryHover: cv('--c-primaryH'),
  secondary:cv('--c-secondary'),
  teal:     cv('--c-secondary'), // alias
  success:  cv('--c-success'),
  green:    cv('--c-success'),   // alias
  warning:  cv('--c-warning'),
  amber:    cv('--c-warning'),   // alias
  danger:   cv('--c-danger'),
  red:      cv('--c-danger'),    // alias
  sky:      cv('--c-sky'),
  info:     cv('--c-sky'),       // alias
  purple:   cv('--c-purple'),
};

export const STATUS_COLORS: Record<string, string> = {
  active:         C.green,
  approved:       C.green,
  valid:          C.green,
  completed:      C.green,
  open:           C.green,
  available:      C.teal,
  assigned:       C.teal,
  in_progress:    C.amber,
  'in progress':  C.amber,
  pending:        C.amber,
  'expiring soon':C.amber,
  interviewing:   C.sky,
  'on leave':     C.sky,
  planning:       C.sky,
  due:            C.amber,
  rejected:       C.red,
  expired:        C.red,
  suspended:      C.red,
  terminated:     C.red,
  high:           C.red,
  medium:         C.amber,
  low:            C.teal,
  critical:       '#FF4444',
  in_use:         C.purple,
  'in use':       C.purple,
  leaving:        C.amber,
  overdue:        C.red,
  backlog:        C.dim,
  todo:           C.muted,
  done:           C.green,
  upcoming:       C.sky,
  sent:           C.sky,
  void:           C.red,
  paid:           C.green,
  draft:          C.muted,
};

export interface Theme { bg: string; surface: string; elevated: string; card: string; border: string; borderBright: string; primary: string; primaryHover: string; secondary: string; success: string; warning: string; danger: string; info: string; text: string; textMuted: string; textDim: string; }
export const defaultTheme: Theme = { bg:'#020617', surface:'#0B1120', elevated:'#111827', card:'#0F172A', border:'#1E293B', borderBright:'#334155', primary:'#6366F1', primaryHover:'#818CF8', secondary:'#14B8A6', success:'#10B981', warning:'#F59E0B', danger:'#EF4444', info:'#38BDF8', text:'#F1F5F9', textMuted:'#94A3B8', textDim:'#475569' };

import { create } from 'zustand';

export type LayoutMode = 'sidebar' | 'topnav' | 'compact';
export type ThemeMode  = 'dark'    | 'light'  | 'system';

type ModuleKey =
  | 'dashboard' | 'hr' | 'leave' | 'timesheets' | 'expenses'
  | 'compliance' | 'pmo' | 'recruitment' | 'documents'
  | 'assets' | 'training' | 'announcements' | 'audit' | 'config';

interface AppStore {
  activeModule:  ModuleKey;
  sidebarOpen:   boolean;
  layout:        LayoutMode;
  theme:         ThemeMode;
  setModule:     (m: ModuleKey) => void;
  toggleSidebar: () => void;
  setLayout:     (l: LayoutMode) => void;
  setTheme:      (t: ThemeMode) => void;
}

const savedLayout = (localStorage.getItem('xv_layout') as LayoutMode) ?? 'sidebar';
const savedTheme  = (localStorage.getItem('xv_theme')  as ThemeMode)  ?? 'dark';

// Apply theme to <html> immediately on load
document.documentElement.setAttribute('data-theme', savedTheme === 'system'
  ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  : savedTheme
);

export const useAppStore = create<AppStore>((set) => ({
  activeModule:  'dashboard',
  sidebarOpen:   true,
  layout:        savedLayout,
  theme:         savedTheme,
  setModule:     (m) => set({ activeModule: m }),
  toggleSidebar: () => set(s => ({ sidebarOpen: !s.sidebarOpen })),
  setLayout:     (l) => {
    localStorage.setItem('xv_layout', l);
    set({ layout: l });
  },
  setTheme:      (t) => {
    localStorage.setItem('xv_theme', t);
    const resolved = t === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : t;
    document.documentElement.setAttribute('data-theme', resolved);
    set({ theme: t });
  },
}));

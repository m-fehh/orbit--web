import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark' | 'system';

const THEME_KEY = 'orbit.theme';
const SIDEBAR_KEY = 'orbit.sidebar';

function readTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  return (window.localStorage.getItem(THEME_KEY) as ThemeMode) || 'system';
}

/** Resolve o tema efetivo e aplica a classe `.dark` na raiz. */
export function applyThemeClass(mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const prefersDark =
    mode === 'dark' ||
    (mode === 'system' &&
      window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', !!prefersDark);
}

interface UiState {
  theme: ThemeMode;
  sidebarCollapsed: boolean;
  /** Drawer da sidebar no mobile (overlay). */
  mobileNavOpen: boolean;
  setTheme: (theme: ThemeMode) => void;
  toggleSidebar: () => void;
  setMobileNav: (open: boolean) => void;
  hydrate: () => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  theme: 'system',
  sidebarCollapsed: false,
  mobileNavOpen: false,

  setTheme: (theme) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(THEME_KEY, theme);
    applyThemeClass(theme);
    set({ theme });
  },

  toggleSidebar: () => {
    const next = !get().sidebarCollapsed;
    if (typeof window !== 'undefined') window.localStorage.setItem(SIDEBAR_KEY, String(next));
    set({ sidebarCollapsed: next });
  },

  setMobileNav: (open) => set({ mobileNavOpen: open }),

  hydrate: () => {
    const theme = readTheme();
    const collapsed =
      typeof window !== 'undefined' && window.localStorage.getItem(SIDEBAR_KEY) === 'true';
    applyThemeClass(theme);
    set({ theme, sidebarCollapsed: collapsed });
  },
}));

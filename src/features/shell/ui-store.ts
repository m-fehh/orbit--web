import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark' | 'system';

const THEME_KEY = 'orbit.theme';

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
  /** Drawer da sidebar no mobile (overlay). */
  mobileNavOpen: boolean;
  setTheme: (theme: ThemeMode) => void;
  setMobileNav: (open: boolean) => void;
  hydrate: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  theme: 'system',
  mobileNavOpen: false,

  setTheme: (theme) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(THEME_KEY, theme);
    applyThemeClass(theme);
    set({ theme });
  },

  setMobileNav: (open) => set({ mobileNavOpen: open }),

  hydrate: () => {
    const theme = readTheme();
    applyThemeClass(theme);
    set({ theme });
  },
}));

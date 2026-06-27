'use client';

import { create } from 'zustand';

const KEY = 'orbit.a11y.v1';

export type FontScale = 'base' | 'lg' | 'xl';

export interface A11yPrefs {
  fontScale: FontScale;
  highContrast: boolean;
  reduceMotion: boolean;
  underlineLinks: boolean;
  readableSpacing: boolean;
}

const DEFAULTS: A11yPrefs = {
  fontScale: 'base',
  highContrast: false,
  reduceMotion: false,
  underlineLinks: false,
  readableSpacing: false,
};

const FONT_SCALE_VALUE: Record<FontScale, string> = {
  base: '100%',
  lg: '112.5%',
  xl: '125%',
};

function read(): A11yPrefs {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

/** Aplica as preferências de acessibilidade na raiz do documento. */
export function applyA11y(p: A11yPrefs): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.fontSize = FONT_SCALE_VALUE[p.fontScale];
  root.classList.toggle('a11y-high-contrast', p.highContrast);
  root.classList.toggle('a11y-reduce-motion', p.reduceMotion);
  root.classList.toggle('a11y-underline-links', p.underlineLinks);
  root.classList.toggle('a11y-readable-spacing', p.readableSpacing);
}

interface A11yState extends A11yPrefs {
  set: <K extends keyof A11yPrefs>(key: K, value: A11yPrefs[K]) => void;
  reset: () => void;
  hydrate: () => void;
}

export const useA11yStore = create<A11yState>((set, get) => ({
  ...DEFAULTS,

  set: (key, value) => {
    const next = { ...prefs(get()), [key]: value };
    persist(next);
    applyA11y(next);
    set({ [key]: value } as Partial<A11yState>);
  },

  reset: () => {
    persist(DEFAULTS);
    applyA11y(DEFAULTS);
    set({ ...DEFAULTS });
  },

  hydrate: () => {
    const p = read();
    applyA11y(p);
    set({ ...p });
  },
}));

function prefs(s: A11yState): A11yPrefs {
  return {
    fontScale: s.fontScale,
    highContrast: s.highContrast,
    reduceMotion: s.reduceMotion,
    underlineLinks: s.underlineLinks,
    readableSpacing: s.readableSpacing,
  };
}

function persist(p: A11yPrefs): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

import { create } from 'zustand';

/** Tipos de visão que podem ocupar uma aba. */
export type ViewKind =
  | 'tickets'
  | 'ticket'
  | 'dashboard'
  | 'users'
  | 'knowledge'
  | 'knowledge-article'
  | 'investigations'
  | 'analytics'
  | 'admin'
  | 'audit'
  | 'intelligence'
  | 'iterations'
  | 'tags';

/** Chave de ícone (resolvida para um componente lucide no TabBar). */
export type IconKey =
  | 'ticket'
  | 'tickets'
  | 'dashboard'
  | 'users'
  | 'knowledge'
  | 'search'
  | 'analytics'
  | 'admin'
  | 'audit';

/** Uma localização navegável dentro de uma aba (entra no histórico). */
export interface TabLocation {
  kind: ViewKind;
  params: Record<string, string | number>;
  title: string;
  icon: IconKey;
}

/** Uma aba do workspace, com pilha de histórico (back/forward) própria. */
export interface WorkspaceTab {
  id: string;
  pinned: boolean;
  favorite: boolean;
  history: TabLocation[];
  index: number;
}

export interface FavoriteEntry extends TabLocation {
  key: string;
}

interface TabState {
  tabs: WorkspaceTab[];
  activeId: string | null;
  favorites: FavoriteEntry[];
  hydrated: boolean;

  hydrate: () => void;
  openTab: (loc: TabLocation, opts?: { pinned?: boolean; background?: boolean }) => string;
  navigate: (loc: TabLocation) => void; // navega na aba ativa (push no histórico)
  back: (tabId?: string) => void;
  forward: (tabId?: string) => void;
  setActive: (id: string) => void;
  close: (id: string) => void;
  closeOthers: (id: string) => void;
  togglePin: (id: string) => void;
  toggleFavorite: (id: string) => void;
  reorder: (from: number, to: number) => void;
}

const STORAGE_KEY = 'orbit.tabs';
const MAX_TABS = 12;
let seq = 0;
const nextId = () => `tab_${Date.now().toString(36)}_${++seq}`;

export function locationKey(loc: TabLocation): string {
  const p = Object.entries(loc.params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  return `${loc.kind}?${p}`;
}

export function currentLocation(tab: WorkspaceTab): TabLocation {
  return tab.history[tab.index];
}

function persist(state: TabState) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ tabs: state.tabs, activeId: state.activeId, favorites: state.favorites }),
    );
  } catch {
    /* ignore */
  }
}

export const useTabStore = create<TabState>((set, get) => ({
  tabs: [],
  activeId: null,
  favorites: [],
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return;
    let parsed: Partial<TabState> | null = null;
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) parsed = JSON.parse(raw);
      } catch {
        /* ignore */
      }
    }
    const tabs = parsed?.tabs?.length ? parsed.tabs : [];
    set({
      tabs,
      activeId: parsed?.activeId ?? tabs[0]?.id ?? null,
      favorites: parsed?.favorites ?? [],
      hydrated: true,
    });
  },

  openTab: (loc, opts) => {
    const key = locationKey(loc);
    const existing = get().tabs.find((t) => locationKey(currentLocation(t)) === key);
    if (existing) {
      if (!opts?.background) set({ activeId: existing.id });
      persist(get());
      return existing.id;
    }
    const id = nextId();
    const tab: WorkspaceTab = {
      id,
      pinned: opts?.pinned ?? false,
      // Reflete o estado persistido de favoritos para este local.
      favorite: get().favorites.some((f) => f.key === key),
      history: [loc],
      index: 0,
    };
    set((s) => {
      let tabs = [...s.tabs, tab];
      // Limite de abas: ao exceder, fecha a aba mais antiga que não esteja fixada nem ativa.
      if (tabs.length > MAX_TABS) {
        const victim = tabs.find((t) => !t.pinned && t.id !== id && t.id !== s.activeId);
        if (victim) tabs = tabs.filter((t) => t.id !== victim.id);
      }
      return { tabs, activeId: opts?.background ? s.activeId : id };
    });
    persist(get());
    return id;
  },

  navigate: (loc) =>
    set((s) => {
      const tabs = s.tabs.map((t) => {
        if (t.id !== s.activeId) return t;
        const history = t.history.slice(0, t.index + 1);
        history.push(loc);
        return { ...t, history, index: history.length - 1 };
      });
      const next = { ...s, tabs };
      persist(next);
      return { tabs };
    }),

  back: (tabId) =>
    set((s) => {
      const id = tabId ?? s.activeId;
      const tabs = s.tabs.map((t) => (t.id === id && t.index > 0 ? { ...t, index: t.index - 1 } : t));
      persist({ ...s, tabs });
      return { tabs };
    }),

  forward: (tabId) =>
    set((s) => {
      const id = tabId ?? s.activeId;
      const tabs = s.tabs.map((t) =>
        t.id === id && t.index < t.history.length - 1 ? { ...t, index: t.index + 1 } : t,
      );
      persist({ ...s, tabs });
      return { tabs };
    }),

  setActive: (id) => {
    set({ activeId: id });
    persist(get());
  },

  close: (id) =>
    set((s) => {
      const idx = s.tabs.findIndex((t) => t.id === id);
      const tabs = s.tabs.filter((t) => t.id !== id);
      let activeId = s.activeId;
      if (s.activeId === id) {
        const neighbor = tabs[idx] ?? tabs[idx - 1] ?? tabs[tabs.length - 1] ?? null;
        activeId = neighbor?.id ?? null;
      }
      persist({ ...s, tabs, activeId });
      return { tabs, activeId };
    }),

  closeOthers: (id) =>
    set((s) => {
      const tabs = s.tabs.filter((t) => t.id === id || t.pinned);
      persist({ ...s, tabs, activeId: id });
      return { tabs, activeId: id };
    }),

  togglePin: (id) =>
    set((s) => {
      const tabs = s.tabs.map((t) => (t.id === id ? { ...t, pinned: !t.pinned } : t));
      // Mantém fixadas à esquerda.
      tabs.sort((a, b) => Number(b.pinned) - Number(a.pinned));
      persist({ ...s, tabs });
      return { tabs };
    }),

  toggleFavorite: (id) =>
    set((s) => {
      const tab = s.tabs.find((t) => t.id === id);
      if (!tab) return s;
      const loc = currentLocation(tab);
      const key = locationKey(loc);
      const isFav = s.favorites.some((f) => f.key === key);
      const favorites = isFav
        ? s.favorites.filter((f) => f.key !== key)
        : [...s.favorites, { ...loc, key }];
      const tabs = s.tabs.map((t) => (t.id === id ? { ...t, favorite: !isFav } : t));
      persist({ ...s, tabs, favorites });
      return { tabs, favorites };
    }),

  reorder: (from, to) =>
    set((s) => {
      const tabs = s.tabs.slice();
      const [moved] = tabs.splice(from, 1);
      tabs.splice(to, 0, moved);
      persist({ ...s, tabs });
      return { tabs };
    }),
}));

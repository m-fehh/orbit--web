import { create } from 'zustand';
import type { ReactNode } from 'react';

export interface OrbitWindow {
  id: string;
  title: string;
  icon?: ReactNode;
  content: ReactNode;
  /** Modal escurece/desfoca o fundo e bloqueia interação atrás. */
  modal?: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  minimized: boolean;
  maximized: boolean;
  z: number;
}

export interface OpenWindowOptions {
  id?: string;
  title: string;
  icon?: ReactNode;
  content: ReactNode;
  modal?: boolean;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
}

interface WindowState {
  windows: OrbitWindow[];
  topZ: number;
  open: (opts: OpenWindowOptions) => string;
  close: (id: string) => void;
  focus: (id: string) => void;
  update: (id: string, patch: Partial<OrbitWindow>) => void;
  toggleMinimize: (id: string) => void;
  toggleMaximize: (id: string) => void;
  setContent: (id: string, content: ReactNode, title?: string) => void;
}

let seq = 0;
const nextId = () => `win_${++seq}`;

export const useWindowStore = create<WindowState>((set, get) => ({
  windows: [],
  topZ: 10,

  open: (opts) => {
    const id = opts.id ?? nextId();
    const existing = get().windows.find((w) => w.id === id);
    const z = get().topZ + 1;

    if (existing) {
      // Reabrir uma janela já aberta apenas a foca e restaura.
      set((s) => ({
        topZ: z,
        windows: s.windows.map((w) =>
          w.id === id ? { ...w, minimized: false, z, content: opts.content, title: opts.title } : w,
        ),
      }));
      return id;
    }

    const count = get().windows.length;
    const width = opts.width ?? 720;
    const height = opts.height ?? 520;
    const win: OrbitWindow = {
      id,
      title: opts.title,
      icon: opts.icon,
      content: opts.content,
      modal: opts.modal,
      width,
      height,
      x: opts.x ?? Math.max(24, 120 + count * 28),
      y: opts.y ?? Math.max(24, 96 + count * 24),
      minimized: false,
      maximized: false,
      z,
    };
    set((s) => ({ windows: [...s.windows, win], topZ: z }));
    return id;
  },

  close: (id) => set((s) => ({ windows: s.windows.filter((w) => w.id !== id) })),

  focus: (id) =>
    set((s) => {
      const z = s.topZ + 1;
      return { topZ: z, windows: s.windows.map((w) => (w.id === id ? { ...w, z } : w)) };
    }),

  update: (id, patch) =>
    set((s) => ({ windows: s.windows.map((w) => (w.id === id ? { ...w, ...patch } : w)) })),

  toggleMinimize: (id) =>
    set((s) => ({
      windows: s.windows.map((w) => (w.id === id ? { ...w, minimized: !w.minimized } : w)),
    })),

  toggleMaximize: (id) =>
    set((s) => ({
      windows: s.windows.map((w) => (w.id === id ? { ...w, maximized: !w.maximized, minimized: false } : w)),
    })),

  setContent: (id, content, title) =>
    set((s) => ({
      windows: s.windows.map((w) => (w.id === id ? { ...w, content, title: title ?? w.title } : w)),
    })),
}));

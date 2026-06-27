'use client';

import { create } from 'zustand';

const DONE_KEY = 'orbit-tour-done-v1';

interface TourState {
  active: boolean;
  step: number;
  start: () => void;
  stop: (markDone?: boolean) => void;
  setStep: (n: number) => void;
}

/** Estado do product tour (walkthrough). Conclusão persiste em localStorage. */
export const useTourStore = create<TourState>((set) => ({
  active: false,
  step: 0,
  start: () => set({ active: true, step: 0 }),
  stop: (markDone = true) => {
    if (markDone && typeof window !== 'undefined') {
      try { localStorage.setItem(DONE_KEY, '1'); } catch { /* ignore */ }
    }
    set({ active: false, step: 0 });
  },
  setStep: (n) => set({ step: n }),
}));

/** Indica se o usuário já concluiu/dispensou o tour alguma vez. */
export function tourCompleted(): boolean {
  if (typeof window === 'undefined') return true;
  try { return localStorage.getItem(DONE_KEY) === '1'; } catch { return true; }
}

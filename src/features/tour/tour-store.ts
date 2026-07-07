'use client';

import { create } from 'zustand';

const DONE_KEY = 'orbit-tour-done-v1';

/** Um passo do tour. `target` é um seletor CSS; ausente = card centralizado. */
export interface TourStep {
  key: string;
  target?: string;
}

interface TourState {
  active: boolean;
  step: number;
  /** Passos do tour atualmente em execução (global ou da tela). */
  steps: TourStep[];
  start: (steps: TourStep[]) => void;
  stop: (markDone?: boolean) => void;
  setStep: (n: number) => void;
}

/** Estado do tour interativo (walkthrough). Um por vez; conclusão persiste em localStorage. */
export const useTourStore = create<TourState>((set) => ({
  active: false,
  step: 0,
  steps: [],
  start: (steps) => set({ active: steps.length > 0, step: 0, steps }),
  stop: (markDone = true) => {
    if (markDone && typeof window !== 'undefined') {
      try { localStorage.setItem(DONE_KEY, '1'); } catch { /* ignore */ }
    }
    set({ active: false, step: 0, steps: [] });
  },
  setStep: (n) => set({ step: n }),
}));

/** Indica se o usuário já concluiu/dispensou o tour alguma vez. */
export function tourCompleted(): boolean {
  if (typeof window === 'undefined') return true;
  try { return localStorage.getItem(DONE_KEY) === '1'; } catch { return true; }
}

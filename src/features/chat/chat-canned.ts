'use client';

import { useEffect } from 'react';
import { create } from 'zustand';

/** Uma resposta pronta (canned response) do usuário — snippet reutilizável no chat. */
export interface CannedResponse {
  id: string;
  text: string;
}

const KEY = 'orbit.chatCanned';

function load(): CannedResponse[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(window.localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
function persist(list: CannedResponse[]) {
  if (typeof window !== 'undefined') window.localStorage.setItem(KEY, JSON.stringify(list));
}

interface CannedState {
  items: CannedResponse[];
  hydrated: boolean;
  hydrate: () => void;
  add: (text: string) => void;
  remove: (id: string) => void;
}

export const useCannedResponses = create<CannedState>((set, get) => ({
  items: [],
  hydrated: false,
  hydrate: () => { if (!get().hydrated) set({ items: load(), hydrated: true }); },
  add: (text) => {
    const t = text.trim();
    if (!t) return;
    const next = [...get().items, { id: `cr_${Date.now().toString(36)}`, text: t }];
    persist(next);
    set({ items: next });
  },
  remove: (id) => {
    const next = get().items.filter((x) => x.id !== id);
    persist(next);
    set({ items: next });
  },
}));

/** Hidrata o store no cliente (chamar uma vez no componente que usa). */
export function useHydrateCanned() {
  const hydrate = useCannedResponses((s) => s.hydrate);
  useEffect(() => { hydrate(); }, [hydrate]);
}

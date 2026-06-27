'use client';

import { create } from 'zustand';

interface ShortcutsState {
  helpOpen: boolean;
  openHelp: () => void;
  closeHelp: () => void;
}

/** Estado do overlay de atalhos de teclado. */
export const useShortcutsStore = create<ShortcutsState>((set) => ({
  helpOpen: false,
  openHelp: () => set({ helpOpen: true }),
  closeHelp: () => set({ helpOpen: false }),
}));

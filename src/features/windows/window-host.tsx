'use client';

import { useWindowStore } from '@/features/windows/window-store';
import { Portal } from '@/shared/ui/portal';
import { FloatingWindow } from './floating-window';

/** Renderiza todos os modais (drawers laterais) abertos. Montado uma vez no shell. */
export function WindowHost() {
  const windows = useWindowStore((s) => s.windows);
  if (windows.length === 0) return null;
  return (
    <Portal>
      {windows.map((w) => (
        <FloatingWindow key={w.id} win={w} />
      ))}
    </Portal>
  );
}

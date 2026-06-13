'use client';

import { useWindowStore } from '@/features/windows/window-store';
import { FloatingWindow } from './floating-window';
import { cn } from '@/shared/lib/utils';

/**
 * Renderiza todas as janelas abertas, o backdrop desfocado dos modais e a dock
 * de janelas minimizadas. Montado uma única vez no shell.
 */
export function WindowHost() {
  const windows = useWindowStore((s) => s.windows);
  const focus = useWindowStore((s) => s.focus);
  const toggleMinimize = useWindowStore((s) => s.toggleMinimize);

  const visible = windows.filter((w) => !w.minimized);
  const minimized = windows.filter((w) => w.minimized);

  // Backdrop atrás do modal de maior z (escurece + desfoca o fundo).
  const topModal = visible.filter((w) => w.modal).sort((a, b) => a.z - b.z).at(-1);

  return (
    <div className="pointer-events-none fixed inset-0 z-40">
      {topModal && (
        <div
          className="pointer-events-auto absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
          style={{ zIndex: topModal.z - 1 }}
          onClick={() => toggleMinimize(topModal.id)}
          aria-hidden
        />
      )}

      {windows.map((w) => (
        <FloatingWindow key={w.id} win={w} />
      ))}

      {/* Dock de janelas minimizadas */}
      {minimized.length > 0 && (
        <div className="pointer-events-auto absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-sm rounded-full glass px-sm py-1.5 shadow-lg">
          {minimized.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => {
                toggleMinimize(w.id);
                focus(w.id);
              }}
              className={cn(
                'flex max-w-[200px] items-center gap-sm rounded-full border border-border bg-panel-2/70 px-md py-1 text-xs text-muted hover:text-text',
              )}
            >
              {w.icon && <span className="grid h-4 w-4 place-items-center text-primary">{w.icon}</span>}
              <span className="truncate">{w.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

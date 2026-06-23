'use client';

import { X } from 'lucide-react';
import { useWindowStore, type OrbitWindow } from '@/features/windows/window-store';

/**
 * Painel lateral (drawer) à direita — todos os modais seguem este padrão
 * (igual ao Notification Center). Sem minimizar/maximizar/arrastar: apenas fechar.
 */
export function FloatingWindow({ win }: { win: OrbitWindow }) {
  const close = useWindowStore((s) => s.close);

  return (
    <div className="fixed inset-0" role="dialog" aria-modal="true" aria-label={win.title} style={{ zIndex: win.z }}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => close(win.id)} aria-hidden />
      <aside
        className="absolute right-0 top-0 flex h-full w-full flex-col border-l border-border bg-panel shadow-lg animate-slide-in"
        style={{ maxWidth: win.width ? `${win.width}px` : '28rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex h-12 shrink-0 items-center gap-sm border-b border-border px-md">
          {win.icon && <span className="grid h-5 w-5 place-items-center text-primary">{win.icon}</span>}
          <span className="flex-1 truncate text-sm font-semibold">{win.title}</span>
          <button
            type="button"
            onClick={() => close(win.id)}
            className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-panel-2 hover:text-text"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col">{win.content}</div>
      </aside>
    </div>
  );
}

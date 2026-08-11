'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, XCircle, Maximize2, Minimize2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useWindowStore, type OrbitWindow } from '@/features/windows/window-store';
import { cn } from '@/shared/lib/utils';

/**
 * Janela/modal padrão do Orbit: nasce CENTRALIZADA (posição vem do window-store),
 * é ARRASTÁVEL pelo header e tem toggle de FULLSCREEN (maximizar/restaurar).
 * Modal escurece/desfoca o fundo; não-modal deixa interagir atrás.
 */
export function FloatingWindow({ win }: { win: OrbitWindow }) {
  const close = useWindowStore((s) => s.close);
  const closeAll = useWindowStore((s) => s.closeAll);
  const focus = useWindowStore((s) => s.focus);
  const update = useWindowStore((s) => s.update);
  const toggleMaximize = useWindowStore((s) => s.toggleMaximize);
  const windows = useWindowStore((s) => s.windows);
  const tc = useTranslations('common');

  const isTop = windows.length > 0 && win.z === Math.max(...windows.map((w) => w.z));
  const showCloseAll = windows.length > 1 && isTop;

  // Arraste local (não re-renderiza todas as janelas a cada mousemove; comita no fim).
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);

  const onHeaderMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (win.maximized) return;
      if ((e.target as HTMLElement).closest('button')) return; // clicar num botão não arrasta
      focus(win.id);
      const dx = e.clientX - win.x;
      const dy = e.clientY - win.y;
      dragRef.current = { dx, dy };
      const onMove = (ev: MouseEvent) => {
        const nx = Math.max(0, Math.min(window.innerWidth - 120, ev.clientX - dragRef.current!.dx));
        const ny = Math.max(0, Math.min(window.innerHeight - 40, ev.clientY - dragRef.current!.dy));
        setDragPos({ x: nx, y: ny });
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        setDragPos((p) => {
          if (p) update(win.id, { x: p.x, y: p.y });
          return null;
        });
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [win.id, win.x, win.y, win.maximized, focus, update],
  );

  // ESC fecha a janela do topo.
  useEffect(() => {
    if (!isTop) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(win.id); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isTop, close, win.id]);

  const pos = dragPos ?? { x: win.x, y: win.y };
  const frameStyle: React.CSSProperties = win.maximized
    ? { inset: 8 }
    : { left: pos.x, top: pos.y, width: win.width, height: win.height };

  return (
    <div className="pointer-events-none fixed inset-0" style={{ zIndex: win.z }} role="dialog" aria-modal={win.modal ? 'true' : undefined} aria-label={win.title}>
      {win.modal && (
        <div className="pointer-events-auto absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => close(win.id)} aria-hidden />
      )}
      <div
        className="pointer-events-auto absolute flex max-h-[calc(100vh-16px)] max-w-[calc(100vw-16px)] flex-col overflow-hidden rounded-lg border border-border bg-panel shadow-2xl"
        style={frameStyle}
        onMouseDown={() => focus(win.id)}
      >
        <header
          onMouseDown={onHeaderMouseDown}
          onDoubleClick={() => toggleMaximize(win.id)}
          className={cn('flex h-11 shrink-0 select-none items-center gap-sm border-b border-border px-md', !win.maximized && 'cursor-move')}
        >
          {win.icon && <span className="grid h-5 w-5 shrink-0 place-items-center text-primary">{win.icon}</span>}
          <span className="flex-1 truncate text-sm font-semibold">{win.title}</span>
          {showCloseAll && (
            <button
              type="button"
              onClick={() => closeAll()}
              className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs text-muted hover:bg-panel-2 hover:text-text"
              title={tc('closeAll')}
            >
              <XCircle className="h-3.5 w-3.5" aria-hidden /> {tc('closeAll')}
            </button>
          )}
          <button
            type="button"
            onClick={() => toggleMaximize(win.id)}
            className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-panel-2 hover:text-text"
            title={win.maximized ? tc('restore') : tc('maximize')}
            aria-label={win.maximized ? tc('restore') : tc('maximize')}
          >
            {win.maximized ? <Minimize2 className="h-4 w-4" aria-hidden /> : <Maximize2 className="h-4 w-4" aria-hidden />}
          </button>
          <button
            type="button"
            onClick={() => close(win.id)}
            className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-panel-2 hover:text-text"
            aria-label={tc('close')}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-auto">{win.content}</div>
      </div>
    </div>
  );
}

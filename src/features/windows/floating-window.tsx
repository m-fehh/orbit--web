'use client';

import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { Minus, X, Maximize2, Minimize2 } from 'lucide-react';
import { useWindowStore, type OrbitWindow } from '@/features/windows/window-store';
import { cn } from '@/shared/lib/utils';

const HEADER_OFFSET = 56; // altura do header do shell

/** Janela flutuante: arrastável pelo título, redimensionável, minimizável e maximizável. */
export function FloatingWindow({ win }: { win: OrbitWindow }) {
  const { focus, update, close, toggleMinimize, toggleMaximize } = useWindowStore();
  const drag = useRef<{ mode: 'move' | 'resize'; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number } | null>(null);

  function onPointerDown(mode: 'move' | 'resize', e: ReactPointerEvent) {
    if (win.maximized) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    focus(win.id);
    drag.current = { mode, sx: e.clientX, sy: e.clientY, ox: win.x, oy: win.y, ow: win.width, oh: win.height };
  }

  function onPointerMove(e: ReactPointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (d.mode === 'move') {
      update(win.id, {
        x: Math.max(0, Math.min(window.innerWidth - 80, d.ox + dx)),
        y: Math.max(HEADER_OFFSET, Math.min(window.innerHeight - 48, d.oy + dy)),
      });
    } else {
      update(win.id, {
        width: Math.max(360, d.ow + dx),
        height: Math.max(220, d.oh + dy),
      });
    }
  }

  function onPointerUp(e: ReactPointerEvent) {
    drag.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  const style: React.CSSProperties = win.maximized
    ? { left: 12, top: HEADER_OFFSET + 12, right: 12, bottom: 12, width: 'auto', height: 'auto', zIndex: win.z }
    : {
        left: win.x,
        top: win.y,
        width: win.width,
        height: win.minimized ? undefined : win.height,
        zIndex: win.z,
      };

  return (
    <div
      role={win.modal ? 'dialog' : undefined}
      aria-modal={win.modal || undefined}
      aria-label={win.title}
      className="card-surface glass top-hairline animate-rise pointer-events-auto fixed flex flex-col overflow-hidden shadow-lg"
      style={style}
      onPointerDown={() => focus(win.id)}
    >
      {/* Barra de título */}
      <div
        className="flex h-10 shrink-0 cursor-grab items-center gap-sm border-b border-border/60 bg-panel-2/60 px-sm active:cursor-grabbing"
        onPointerDown={(e) => onPointerDown('move', e)}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={() => toggleMaximize(win.id)}
      >
        {win.icon && <span className="grid h-5 w-5 place-items-center text-primary">{win.icon}</span>}
        <span className="flex-1 select-none truncate text-sm font-semibold">{win.title}</span>
        <button
          type="button"
          onClick={() => toggleMinimize(win.id)}
          className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-panel hover:text-text"
          aria-label="Minimizar"
        >
          <Minus className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => toggleMaximize(win.id)}
          className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-panel hover:text-text"
          aria-label={win.maximized ? 'Restaurar' : 'Maximizar'}
        >
          {win.maximized ? <Minimize2 className="h-3.5 w-3.5" aria-hidden /> : <Maximize2 className="h-3.5 w-3.5" aria-hidden />}
        </button>
        <button
          type="button"
          onClick={() => close(win.id)}
          className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-danger hover:text-white"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {/* Corpo */}
      {!win.minimized && (
        <div className="min-h-0 flex-1 overflow-auto bg-panel/95">{win.content}</div>
      )}

      {/* Handle de redimensionamento */}
      {!win.minimized && !win.maximized && (
        <div
          className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize"
          onPointerDown={(e) => onPointerDown('resize', e)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          aria-hidden
        >
          <span className="absolute bottom-1 right-1 h-2 w-2 border-b-2 border-r-2 border-border-strong" />
        </div>
      )}
    </div>
  );
}

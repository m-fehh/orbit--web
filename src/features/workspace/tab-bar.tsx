'use client';

import { useRef, useState } from 'react';
import { Pin, PinOff, Star, X, ChevronDown } from 'lucide-react';
import { useTabStore, currentLocation, type WorkspaceTab } from '@/features/workspace/tab-store';
import { Icon } from './icons';
import { cn } from '@/shared/lib/utils';

/** Barra de abas: drag-reorder, fixar, favoritar, fechar, menu de contexto e favoritos. */
export function TabBar() {
  const { tabs, activeId, favorites, setActive, close, closeOthers, togglePin, toggleFavorite, reorder, openTab } =
    useTabStore();
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [favOpen, setFavOpen] = useState(false);
  const dragFrom = useRef<number | null>(null);

  if (tabs.length === 0) return null;

  return (
    <div className="relative flex h-11 items-stretch gap-1 border-b border-border/60 bg-bg-subtle/60 px-sm">
      {/* Favoritos */}
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setFavOpen((v) => !v)}
          className="grid h-8 w-8 place-items-center rounded text-muted hover:bg-panel-2 hover:text-warning"
          aria-label="Favoritos"
          title="Favoritos"
        >
          <Star className="h-4 w-4" aria-hidden />
        </button>
        {favOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setFavOpen(false)} aria-hidden />
            <div className="absolute left-1 top-10 z-20 w-64 overflow-hidden rounded border border-border bg-panel shadow-lg">
              {favorites.length === 0 ? (
                <p className="px-md py-sm text-xs text-dim">Nenhum favorito ainda.</p>
              ) : (
                favorites.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => {
                      openTab({ kind: f.kind, params: f.params, title: f.title, icon: f.icon });
                      setFavOpen(false);
                    }}
                    className="flex w-full items-center gap-sm px-md py-sm text-left text-sm hover:bg-panel-2"
                  >
                    <Icon name={f.icon} className="h-4 w-4 text-warning" />
                    <span className="truncate">{f.title}</span>
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Abas */}
      <div className="flex flex-1 items-stretch gap-1 overflow-x-auto py-1.5">
        {tabs.map((tab, i) => {
          const loc = currentLocation(tab);
          const active = tab.id === activeId;
          return (
            <div
              key={tab.id}
              draggable
              onDragStart={() => (dragFrom.current = i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragFrom.current !== null && dragFrom.current !== i) reorder(dragFrom.current, i);
                dragFrom.current = null;
              }}
              onClick={() => setActive(tab.id)}
              onAuxClick={(e) => {
                if (e.button === 1) close(tab.id); // middle-click fecha
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu({ id: tab.id, x: e.clientX, y: e.clientY });
              }}
              className={cn(
                'group flex cursor-pointer select-none items-center gap-2 rounded-md border px-3 text-sm transition-colors',
                active
                  ? 'border-primary/40 bg-primary-soft text-text glow-ring'
                  : 'border-transparent text-muted hover:bg-panel-2 hover:text-text',
                tab.pinned && 'px-2',
              )}
              title={loc.title}
            >
              <Icon name={loc.icon} className={cn('h-4 w-4 shrink-0', active && 'text-primary')} />
              {!tab.pinned && <span className="max-w-[160px] truncate">{loc.title}</span>}
              {tab.favorite && <Star className="h-3 w-3 fill-warning text-warning" aria-hidden />}
              {tab.pinned ? (
                <Pin className="h-3 w-3 text-primary" aria-hidden />
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    close(tab.id);
                  }}
                  className="grid h-4 w-4 place-items-center rounded opacity-0 hover:bg-panel group-hover:opacity-100"
                  aria-label={`Fechar ${loc.title}`}
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Menu de contexto */}
      {menu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} aria-hidden />
          <div
            className="fixed z-50 w-48 overflow-hidden rounded border border-border bg-panel py-1 shadow-lg"
            style={{ left: menu.x, top: menu.y }}
          >
            <MenuItem
              icon={tabs.find((t) => t.id === menu.id)?.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
              label={tabs.find((t) => t.id === menu.id)?.pinned ? 'Desafixar' : 'Fixar'}
              onClick={() => {
                togglePin(menu.id);
                setMenu(null);
              }}
            />
            <MenuItem
              icon={<Star className="h-4 w-4" />}
              label={tabs.find((t) => t.id === menu.id)?.favorite ? 'Remover favorito' : 'Favoritar'}
              onClick={() => {
                toggleFavorite(menu.id);
                setMenu(null);
              }}
            />
            <MenuItem
              icon={<X className="h-4 w-4" />}
              label="Fechar outras"
              onClick={() => {
                closeOthers(menu.id);
                setMenu(null);
              }}
            />
            <MenuItem
              icon={<X className="h-4 w-4" />}
              label="Fechar"
              onClick={() => {
                close(menu.id);
                setMenu(null);
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-sm px-md py-1.5 text-left text-sm text-muted hover:bg-panel-2 hover:text-text"
    >
      {icon}
      {label}
    </button>
  );
}

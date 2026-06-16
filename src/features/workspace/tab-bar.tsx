'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { MoreHorizontal, Pin, PinOff, Star, X } from 'lucide-react';
import { useTabStore, currentLocation } from '@/features/workspace/tab-store';
import { Icon } from './icons';
import { cn } from '@/shared/lib/utils';

const MAX_VISIBLE_TABS = 6;

/** Barra de abas: drag-reorder, fixar, favoritar, fechar, menu de contexto e favoritos. */
export function TabBar() {
  const t = useTranslations('workspace');
  const { tabs, activeId, favorites, setActive, close, closeOthers, togglePin, toggleFavorite, reorder, openTab } =
    useTabStore();
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [favOpen, setFavOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const dragFrom = useRef<number | null>(null);
  const tabRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Divide as abas em visíveis e overflow
  const visibleTabs = tabs.slice(0, MAX_VISIBLE_TABS);
  const overflowTabs = tabs.length > MAX_VISIBLE_TABS ? tabs.slice(MAX_VISIBLE_TABS) : [];
  const hasOverflow = overflowTabs.length > 0;

  // Mantém a aba ativa visível: se estiver no overflow, troca com a última visível
  useEffect(() => {
    if (!activeId || !hasOverflow) return;
    
    const activeIndex = tabs.findIndex(t => t.id === activeId);
    if (activeIndex >= MAX_VISIBLE_TABS) {
      // A aba ativa está no overflow, troca com a última visível
      reorder(activeIndex, MAX_VISIBLE_TABS - 1);
    }
  }, [activeId, tabs, hasOverflow, reorder]);

  if (tabs.length === 0) return null;

  return (
    <div className="relative flex items-end gap-1.5 border-b border-border bg-bg-subtle/60 pl-5 pr-sm">
      {/* Abas visíveis (máximo 6) - empurradas para a esquerda */}
      <div className="flex flex-1 items-end gap-0.5">
        {visibleTabs.map((tab, i) => {
          const loc = currentLocation(tab);
          const active = tab.id === activeId;
          return (
            <div
              key={tab.id}
              ref={(el) => { tabRefs.current[tab.id] = el; }}
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
                'group flex h-9 cursor-pointer select-none items-center gap-2 border-b-2 px-3 text-sm transition-colors',
                active
                  ? 'border-primary bg-panel font-medium text-text'
                  : 'border-transparent text-muted hover:bg-panel-2/60 hover:text-text',
                tab.pinned && 'px-2.5',
              )}
              title={loc.title}
            >
              <Icon name={loc.icon} className={cn('h-4 w-4 shrink-0', active && 'text-primary')} />
              {!tab.pinned && <span className="max-w-[160px] truncate">{loc.title}</span>}
              {/* Estrela clicável: favoritar/desfavoritar (visível ao passar o mouse ou quando favoritado) */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFavorite(tab.id);
                }}
                className={cn(
                  'grid h-4 w-4 place-items-center rounded transition-opacity',
                  tab.favorite ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                )}
                aria-label={tab.favorite ? t('unfavorite') : t('favorite')}
                title={tab.favorite ? t('unfavorite') : t('favorite')}
              >
                <Star className={cn('h-3 w-3', tab.favorite ? 'fill-warning text-warning' : 'text-muted')} aria-hidden />
              </button>
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
                  aria-label={`${t('close')} ${loc.title}`}
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Container direito: estrela + overflow */}
      <div className="flex items-center gap-0.5">
        {/* Favoritos */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => setFavOpen((v) => !v)}
            className="grid h-9 w-9 place-items-center rounded-md text-muted hover:text-warning transition-colors"
            aria-label={t('favorites')}
            title={t('favorites')}
          >
            <Star className="h-4 w-4" aria-hidden />
          </button>
          {favOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setFavOpen(false)} aria-hidden />
              <div className="absolute right-0 top-10 z-20 w-64 overflow-hidden rounded border border-border bg-panel shadow-lg">
                {favorites.length === 0 ? (
                  <p className="px-md py-sm text-xs text-dim">{t('noFavorites')}</p>
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

        {/* Overflow menu: abas que não cabem na barra */}
        {hasOverflow && (
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => setOverflowOpen((v) => !v)}
              className="flex h-9 items-center gap-1 rounded-md px-2 text-sm text-muted hover:text-text transition-colors"
              title={`${overflowTabs.length} aba(s) ocultas`}
            >
              <MoreHorizontal className="h-4 w-4" />
              <span className="text-xs font-medium">{overflowTabs.length}</span>
            </button>
            {overflowOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setOverflowOpen(false)} aria-hidden />
                <div className="absolute right-0 top-10 z-40 max-h-80 w-64 overflow-y-auto rounded border border-border bg-panel py-1 shadow-lg">
                  {overflowTabs.map((tab) => {
                    const loc = currentLocation(tab);
                    const active = tab.id === activeId;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => { setActive(tab.id); setOverflowOpen(false); }}
                        className={cn(
                          'flex w-full items-center gap-sm px-md py-1.5 text-left text-sm hover:bg-panel-2',
                          active && 'bg-primary/10 text-primary font-medium'
                        )}
                      >
                        <Icon name={loc.icon} className={cn('h-4 w-4', active ? 'text-primary' : 'text-muted')} />
                        <span className="truncate">{loc.title}</span>
                        {active && <span className="ml-auto text-xs text-primary">Ativo</span>}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
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
              icon={tabs.find((tb) => tb.id === menu.id)?.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
              label={tabs.find((tb) => tb.id === menu.id)?.pinned ? t('unpin') : t('pin')}
              onClick={() => {
                togglePin(menu.id);
                setMenu(null);
              }}
            />
            <MenuItem
              icon={<Star className="h-4 w-4" />}
              label={tabs.find((tb) => tb.id === menu.id)?.favorite ? t('unfavorite') : t('favorite')}
              onClick={() => {
                toggleFavorite(menu.id);
                setMenu(null);
              }}
            />
            <MenuItem
              icon={<X className="h-4 w-4" />}
              label={t('closeOthers')}
              onClick={() => {
                closeOthers(menu.id);
                setMenu(null);
              }}
            />
            <MenuItem
              icon={<X className="h-4 w-4" />}
              label={t('close')}
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
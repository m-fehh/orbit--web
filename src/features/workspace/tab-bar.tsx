'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, Pin, PinOff, Star, X } from 'lucide-react';
import { useTabStore, currentLocation } from '@/features/workspace/tab-store';
import { Icon } from './icons';
import { cn } from '@/shared/lib/utils';

/** Barra de abas: drag-reorder, fixar, favoritar, fechar, menu de contexto e favoritos. */
export function TabBar() {
  const t = useTranslations('workspace');
  const { tabs, activeId, favorites, setActive, close, closeOthers, togglePin, toggleFavorite, reorder, openTab } =
    useTabStore();
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [favOpen, setFavOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const dragFrom = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Detecta quais abas estão fora da área visível para popular o overflow menu.
  // Re-roda quando o tamanho da janela ou a lista de abas muda.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const recompute = () => {
      const containerRect = el.getBoundingClientRect();
      const hidden = new Set<string>();
      tabs.forEach((tb) => {
        const tabEl = tabRefs.current[tb.id];
        if (!tabEl) return;
        const r = tabEl.getBoundingClientRect();
        if (r.right > containerRect.right - 2 || r.left < containerRect.left - 2) hidden.add(tb.id);
      });
      setHiddenIds(hidden);
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tabs]);

  // Mantém a aba ativa visível: scroll automático ao trocar de aba.
  useEffect(() => {
    const tabEl = activeId ? tabRefs.current[activeId] : null;
    tabEl?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [activeId]);

  if (tabs.length === 0) return null;

  return (
    <div className="relative flex h-11 items-stretch gap-1.5 border-b border-border bg-bg-subtle/60 py-1.5 pl-5 pr-sm">
      {/* Favoritos */}
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setFavOpen((v) => !v)}
          className="grid h-8 w-8 place-items-center rounded text-muted hover:bg-panel-2 hover:text-warning"
          aria-label={t('favorites')}
          title={t('favorites')}
        >
          <Star className="h-4 w-4" aria-hidden />
        </button>
        {favOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setFavOpen(false)} aria-hidden />
            <div className="absolute left-1 top-10 z-20 w-64 overflow-hidden rounded border border-border bg-panel shadow-lg">
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

      {/* Abas */}
      <div ref={scrollRef} className="flex flex-1 items-stretch gap-1 overflow-x-auto py-1.5 scrollbar-thin">
        {tabs.map((tab, i) => {
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

      {/* Overflow menu: abas que não cabem na barra */}
      {hiddenIds.size > 0 && (
        <div className="relative flex items-center">
          <button
            type="button"
            onClick={() => setOverflowOpen((v) => !v)}
            className="inline-flex h-8 items-center gap-1 rounded border border-border bg-panel px-2 text-xs text-muted hover:bg-panel-2 hover:text-text"
            title={`${hiddenIds.size} aba(s) ocultas`}
          >
            <ChevronDown className="h-3.5 w-3.5" />
            {hiddenIds.size}
          </button>
          {overflowOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setOverflowOpen(false)} aria-hidden />
              <div className="absolute right-0 top-9 z-40 max-h-80 w-64 overflow-y-auto rounded border border-border bg-panel py-1 shadow-lg">
                {tabs
                  .filter((tb) => hiddenIds.has(tb.id))
                  .map((tb) => {
                    const loc = currentLocation(tb);
                    return (
                      <button
                        key={tb.id}
                        type="button"
                        onClick={() => { setActive(tb.id); setOverflowOpen(false); }}
                        className="flex w-full items-center gap-sm px-md py-1.5 text-left text-sm hover:bg-panel-2"
                      >
                        <Icon name={loc.icon} className="h-4 w-4 text-primary" />
                        <span className="truncate">{loc.title}</span>
                      </button>
                    );
                  })}
              </div>
            </>
          )}
        </div>
      )}

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

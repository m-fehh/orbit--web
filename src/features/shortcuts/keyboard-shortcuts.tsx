'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { X, Keyboard } from 'lucide-react';
import { Portal } from '@/shared/ui/portal';
import { useTabStore, type TabLocation, type ViewKind, type IconKey } from '@/features/workspace/tab-store';
import { useShortcutsStore } from './shortcuts-store';

/** Destinos de navegação por chord (G + tecla). */
const NAV_TARGETS: { char: string; kind: ViewKind; icon: IconKey; navKey: string }[] = [
  { char: 'd', kind: 'dashboard', icon: 'dashboard', navKey: 'dashboard' },
  { char: 't', kind: 'tickets', icon: 'tickets', navKey: 'tickets' },
  { char: 'k', kind: 'knowledge', icon: 'knowledge', navKey: 'knowledge' },
  { char: 'i', kind: 'intelligence', icon: 'analytics', navKey: 'intelligence' },
  { char: 'a', kind: 'analytics', icon: 'analytics', navKey: 'analytics' },
  { char: 'u', kind: 'users', icon: 'users', navKey: 'users' },
];

function isTyping(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null;
  if (!node) return false;
  const tag = node.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || node.isContentEditable;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[1.5rem] items-center justify-center rounded-md border border-border bg-bg-subtle px-1.5 py-0.5 text-[11px] font-semibold text-text shadow-sm">
      {children}
    </kbd>
  );
}

/** Handler global de atalhos de teclado + overlay de ajuda. Montado no AppShell. */
export function KeyboardShortcuts() {
  const router = useRouter();
  const tNav = useTranslations('nav');
  const t = useTranslations('shortcuts');
  const helpOpen = useShortcutsStore((s) => s.helpOpen);
  const openHelp = useShortcutsStore((s) => s.openHelp);
  const closeHelp = useShortcutsStore((s) => s.closeHelp);
  const pendingG = useRef<number>(0);

  useEffect(() => {
    function navigate(target: typeof NAV_TARGETS[number]) {
      const loc: TabLocation = { kind: target.kind, params: {}, title: tNav(target.navKey), icon: target.icon };
      useTabStore.getState().openTab(loc);
      router.push('/workspace');
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (useShortcutsStore.getState().helpOpen) closeHelp();
        pendingG.current = 0;
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping(e.target)) return;

      // "?" abre a ajuda de atalhos.
      if (e.key === '?') {
        e.preventDefault();
        openHelp();
        return;
      }

      // Chord: G e depois a tecla do destino.
      const now = Date.now();
      if (e.key.toLowerCase() === 'g' && now - pendingG.current > 1500) {
        pendingG.current = now;
        return;
      }
      if (pendingG.current && now - pendingG.current <= 1500) {
        const target = NAV_TARGETS.find((n) => n.char === e.key.toLowerCase());
        pendingG.current = 0;
        if (target) {
          e.preventDefault();
          navigate(target);
        }
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router, tNav, openHelp, closeHelp]);

  if (!helpOpen) return null;

  const general = [
    { keys: [isMac ? '⌘' : 'Ctrl', 'K'], label: t('openSearch') },
    { keys: ['?'], label: t('showHelp') },
  ];

  return (
    <Portal>
      <div className="fixed inset-0 z-[9997] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={t('title')}>
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeHelp} aria-hidden />
        <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-panel shadow-2xl animate-rise">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary"><Keyboard className="h-4 w-4" /></span>
              <div>
                <h2 className="text-sm font-bold text-text">{t('title')}</h2>
                <p className="text-xs text-muted">{t('subtitle')}</p>
              </div>
            </div>
            <button type="button" onClick={closeHelp} className="grid h-8 w-8 place-items-center rounded-lg text-dim hover:bg-panel-2 hover:text-text" aria-label={t('close')}>
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-5">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-dim">{t('general')}</p>
            <ul className="mb-5 flex flex-col gap-2">
              {general.map((row) => (
                <li key={row.label} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-text">{row.label}</span>
                  <span className="flex items-center gap-1">{row.keys.map((k) => <Kbd key={k}>{k}</Kbd>)}</span>
                </li>
              ))}
            </ul>

            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-dim">{t('navigation')}</p>
            <ul className="flex flex-col gap-2">
              {NAV_TARGETS.map((n) => (
                <li key={n.char} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-text">{tNav(n.navKey)}</span>
                  <span className="flex items-center gap-1">
                    <Kbd>G</Kbd>
                    <span className="text-[11px] text-dim">{t('then')}</span>
                    <Kbd>{n.char.toUpperCase()}</Kbd>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Portal>
  );
}

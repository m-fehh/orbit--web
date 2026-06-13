'use client';

import { Header } from './header';
import { Sidebar } from './sidebar';
import { WindowHost } from '@/features/windows/window-host';

/**
 * Application Shell: header (topo) + sidebar (esquerda) + área central.
 * O WindowHost (janelas/modais flutuantes) é montado uma única vez aqui.
 *
 * Páginas que usam o sistema de abas (ex.: /workspace) gerenciam o próprio
 * scroll; por isso a área central não força padding/scroll.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main id="main-content" className="relative min-w-0 flex-1 overflow-auto bg-bg">
          {children}
        </main>
      </div>
      <WindowHost />
    </div>
  );
}

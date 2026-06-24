'use client';

import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Portal } from './portal';
import { cn } from '@/shared/lib/utils';

type Size = 'sm' | 'md' | 'lg' | 'xl' | 'full';

const MODAL_SIZE: Record<Size, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[95vw]',
};

const DRAWER_SIZE: Record<Size, string> = {
  sm: 'max-w-sm w-full',
  md: 'max-w-md w-full',
  lg: 'max-w-xl w-full',
  xl: 'max-w-2xl w-full',
  full: 'max-w-[95vw] w-full',
};

interface ShellProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  /** Conteúdo do rodapé (botões). Quando omitido, o footer não é renderizado. */
  footer?: ReactNode;
  size?: Size;
  /** Quando true, fechar pelo overlay/Esc fica bloqueado (uso típico: salvar pendente). */
  preventClose?: boolean;
  closeLabel?: string;
}

/** Hook compartilhado: ESC fecha + bloqueia scroll do body enquanto aberto. */
function useDialog(open: boolean, onClose: () => void, prevent: boolean | undefined) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !prevent) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, prevent]);
}

/**
 * Modal centralizado com estrutura Header / Content / Footer.
 * Footer fica fixo no rodapé; content tem scroll independente.
 */
export function Modal({
  open, onClose, title, subtitle, children, footer, size = 'md', preventClose, closeLabel,
}: ShellProps) {
  const tc = useTranslations('common');
  const resolvedCloseLabel = closeLabel ?? tc('close');
  useDialog(open, onClose, preventClose);
  if (!open) return null;
  return (
    <Portal>
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-md backdrop-blur-sm"
        onClick={() => !preventClose && onClose()}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'flex max-h-[90vh] w-full flex-col overflow-hidden rounded-lg border border-border bg-panel shadow-2xl',
            MODAL_SIZE[size],
          )}
        >
          <ModalHeader title={title} subtitle={subtitle} onClose={onClose} closeLabel={resolvedCloseLabel} />
          <div className="flex-1 overflow-y-auto p-lg">{children}</div>
          {footer && (
            <div className="flex flex-wrap items-center justify-end gap-sm border-t border-border bg-bg-subtle/40 p-md">
              {footer}
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}

/**
 * Drawer lateral (default à direita) — ocupa 100% da altura, com footer fixo.
 * Resolve o bug do botão de colapsar sidebar aparecendo dentro do drawer:
 * o componente é renderizado via Portal direto no body, fora da árvore do shell.
 */
export function Drawer({
  open, onClose, title, subtitle, children, footer, size = 'md', preventClose, side = 'right', closeLabel,
}: ShellProps & { side?: 'left' | 'right' }) {
  const tc = useTranslations('common');
  const resolvedCloseLabel = closeLabel ?? tc('close');
  useDialog(open, onClose, preventClose);
  if (!open) return null;
  return (
    <Portal>
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-[100] flex bg-black/60 backdrop-blur-sm"
        onClick={() => !preventClose && onClose()}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'flex h-full flex-col overflow-hidden border-border bg-panel shadow-2xl',
            DRAWER_SIZE[size],
            side === 'right' ? 'ml-auto border-l' : 'mr-auto border-r',
          )}
        >
          <ModalHeader title={title} subtitle={subtitle} onClose={onClose} closeLabel={resolvedCloseLabel} />
          <div className="flex-1 overflow-y-auto p-lg">{children}</div>
          {footer && (
            <div className="flex flex-wrap items-center justify-end gap-sm border-t border-border bg-bg-subtle/40 p-md">
              {footer}
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}

function ModalHeader({
  title, subtitle, onClose, closeLabel,
}: { title: ReactNode; subtitle?: ReactNode; onClose: () => void; closeLabel: string }) {
  return (
    <div className="flex items-start gap-sm border-b border-border p-lg">
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-base font-semibold text-text">{title}</h2>
        {subtitle && <p className="mt-0.5 truncate text-xs text-muted">{subtitle}</p>}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        className="grid h-8 w-8 place-items-center rounded text-muted hover:bg-panel-2 hover:text-text"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

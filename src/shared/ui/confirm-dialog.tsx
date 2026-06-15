'use client';

import { useState, type ReactNode } from 'react';
import { Modal } from './modal';
import { Button } from './button';

/**
 * Hook para confirmação imperativa: ergonomia parecida com `window.confirm`,
 * mas com UI consistente. Use quando uma ação destrutiva precisa de OK/Cancel.
 *
 *   const confirm = useConfirm()
 *   if (await confirm({ title: 'Excluir?', message: '...' })) doDelete()
 */
interface ConfirmOptions {
  title: ReactNode;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export function useConfirm() {
  // Implementação simples: state local + Promise. Para uma versão global,
  // promover para Context. Mantemos local para evitar dependência transversal.
  const [state, setState] = useState<{ opts: ConfirmOptions; resolve: (ok: boolean) => void } | null>(null);

  const confirm = (opts: ConfirmOptions) =>
    new Promise<boolean>((resolve) => setState({ opts, resolve }));

  const node = state ? (
    <Modal
      open
      onClose={() => { state.resolve(false); setState(null); }}
      title={state.opts.title}
      size="sm"
      footer={(
        <>
          <Button variant="ghost" onClick={() => { state.resolve(false); setState(null); }}>
            {state.opts.cancelLabel ?? 'Cancelar'}
          </Button>
          <Button
            variant={state.opts.danger ? 'danger' : 'primary'}
            onClick={() => { state.resolve(true); setState(null); }}
          >
            {state.opts.confirmLabel ?? 'Confirmar'}
          </Button>
        </>
      )}
    >
      <p className="text-sm text-text">{state.opts.message}</p>
    </Modal>
  ) : null;

  return { confirm, node };
}

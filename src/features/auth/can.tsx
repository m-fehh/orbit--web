'use client';

import type { ReactNode } from 'react';
import { usePermissions } from './use-permissions';

/**
 * Renderiza `children` somente se o usuário tiver a permissão requerida.
 * Use `any`/`all` para múltiplas chaves. `fallback` é opcional (default: nada).
 *
 * Ex.: <Can permission="ticket.create"><Button>Novo</Button></Can>
 */
export function Can({
  permission,
  any,
  all,
  fallback = null,
  children,
}: {
  permission?: string;
  any?: string[];
  all?: string[];
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { can, canAny, canAll } = usePermissions();
  const allowed =
    (permission ? can(permission) : true) &&
    (any ? canAny(any) : true) &&
    (all ? canAll(all) : true);
  return <>{allowed ? children : fallback}</>;
}

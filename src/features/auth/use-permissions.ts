'use client';

import { useMemo } from 'react';
import { useAuthStore } from './auth-store';
import { makeChecker } from './permissions';

/** Hook PBAC: `can`, `canAny`, `canAll`, `isAdmin` a partir das permissões do usuário. */
export function usePermissions() {
  const permissions = useAuthStore((s) => s.permissions);
  return useMemo(() => makeChecker(permissions), [permissions]);
}

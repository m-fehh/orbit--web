'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renderiza os filhos no `document.body`, fora de qualquer ancestral com
 * `transform`/`filter`/`backdrop-filter` — que, do contrário, viram o containing
 * block de elementos `position: fixed` e quebram overlays (modais, drawers).
 */
export function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}

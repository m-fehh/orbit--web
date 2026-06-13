'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Raiz: encaminha para o dashboard (o guard da área logada redireciona ao login se necessário). */
export default function RootPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/workspace');
  }, [router]);
  return null;
}

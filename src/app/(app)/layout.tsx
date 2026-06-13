'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/features/auth/auth-store';
import { AppShell } from '@/features/shell/app-shell';
import { LoadingState } from '@/shared/ui/states';

/** Guarda de rota da área logada: exige sessão e MFA verificado. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
    else if (status === 'mfa_pending') router.replace('/mfa-verify');
  }, [status, router]);

  if (status !== 'authenticated') {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingState />
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}

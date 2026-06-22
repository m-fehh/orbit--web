'use client';

import { Loader2, type LucideIcon, Inbox, AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/shared/ui/button';

export function LoadingState({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-sm py-2xl text-muted" role="status">
      <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  message,
  cta,
}: {
  icon?: LucideIcon;
  message: string;
  cta?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-sm py-2xl text-muted">
      <Icon className="h-8 w-8 opacity-60" aria-hidden />
      <p className="text-sm">{message}</p>
      {cta}
    </div>
  );
}

export function ErrorState({
  title,
  body,
  onRetry,
  retryLabel,
}: {
  title: string;
  body?: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  const tc = useTranslations('common');
  return (
    <div className="flex flex-col items-center justify-center gap-sm py-2xl text-center" role="alert">
      <AlertTriangle className="h-8 w-8 text-danger" aria-hidden />
      <p className="text-sm font-medium text-text">{title}</p>
      {body && <p className="text-sm text-muted">{body}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {retryLabel ?? tc('retry')}
        </Button>
      )}
    </div>
  );
}

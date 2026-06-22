'use client';

import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Loader2, type LucideIcon, Inbox, AlertTriangle, Plus, Search, FileText, BarChart3, Users, BookOpen, Shield, Settings } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';

// ---------------------------------------------------------------------------
// Skeleton Components
// ---------------------------------------------------------------------------

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse rounded-md bg-border/40', className)} />
  );
}

export function SkeletonRow({ cols = 5 }: { cols?: number }) {
  return (
    <div className="flex items-center gap-md px-md py-sm">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className={cn('h-4', i === 0 ? 'w-16' : i === 1 ? 'w-48' : 'w-24')} />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-md border-b border-border px-md py-sm">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-20" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * 0.04, duration: 0.3 }}
        >
          <SkeletonRow cols={cols} />
        </motion.div>
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-lg border border-border bg-panel p-md">
      <div className="mb-md flex items-center gap-sm">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="mb-1.5 h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}

export function SkeletonGrid({ cards = 6 }: { cards?: number }) {
  return (
    <div className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: cards }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06, duration: 0.35 }}
        >
          <SkeletonCard />
        </motion.div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SVG Illustrations
// ---------------------------------------------------------------------------

function EmptyIllustration({ className }: { className?: string }) {
  return (
    <svg className={cn('h-32 w-32', className)} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="100" r="80" className="fill-border/20" />
      <circle cx="100" cy="100" r="60" className="fill-border/10" />
      <rect x="70" y="65" width="60" height="75" rx="6" className="fill-bg-subtle stroke-border" strokeWidth="2" />
      <line x1="82" y1="82" x2="118" y2="82" className="stroke-border/60" strokeWidth="2" strokeLinecap="round" />
      <line x1="82" y1="94" x2="110" y2="94" className="stroke-border/40" strokeWidth="2" strokeLinecap="round" />
      <line x1="82" y1="106" x2="105" y2="106" className="stroke-border/30" strokeWidth="2" strokeLinecap="round" />
      <circle cx="140" cy="55" r="20" className="fill-primary/10 stroke-primary/30" strokeWidth="2" />
      <path d="M133 55 L138 60 L148 50" className="stroke-primary" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function SearchIllustration({ className }: { className?: string }) {
  return (
    <svg className={cn('h-32 w-32', className)} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="90" cy="90" r="80" className="fill-border/15" />
      <circle cx="88" cy="88" r="35" className="stroke-primary/40" strokeWidth="3" fill="none" />
      <circle cx="88" cy="88" r="25" className="fill-primary/5" />
      <line x1="113" y1="113" x2="145" y2="145" className="stroke-primary/50" strokeWidth="4" strokeLinecap="round" />
      <circle cx="145" cy="145" r="8" className="fill-primary/20" />
    </svg>
  );
}

function ErrorIllustration({ className }: { className?: string }) {
  return (
    <svg className={cn('h-32 w-32', className)} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="100" r="80" className="fill-danger/5" />
      <circle cx="100" cy="100" r="45" className="stroke-danger/20" strokeWidth="2" fill="none" />
      <path d="M100 70 L100 110" className="stroke-danger" strokeWidth="4" strokeLinecap="round" />
      <circle cx="100" cy="125" r="3" className="fill-danger" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Loading State (Premium)
// ---------------------------------------------------------------------------

export function LoadingState({ label }: { label?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center gap-sm py-2xl text-muted"
      role="status"
    >
      <div className="relative">
        <motion.div
          className="absolute inset-0 rounded-full bg-primary/10"
          animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
      </div>
      {label && (
        <motion.span
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-sm"
        >
          {label}
        </motion.span>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Empty State (Premium with illustration + animation)
// ---------------------------------------------------------------------------

const CONTEXT_ICONS: Record<string, LucideIcon> = {
  tickets: FileText,
  knowledge: BookOpen,
  analytics: BarChart3,
  users: Users,
  search: Search,
  admin: Shield,
  settings: Settings,
  default: Inbox,
};

export function EmptyState({
  icon: Icon,
  message,
  description,
  cta,
  ctaLabel,
  ctaIcon: CtaIcon = Plus,
  onAction,
  context,
  illustration,
}: {
  icon?: LucideIcon;
  message: string;
  description?: string;
  cta?: ReactNode;
  ctaLabel?: string;
  ctaIcon?: LucideIcon;
  onAction?: () => void;
  context?: string;
  illustration?: 'empty' | 'search' | 'error';
}) {
  const ResolvedIcon = Icon || (context ? CONTEXT_ICONS[context] : undefined) || Inbox;
  const IllComponent = illustration === 'search' ? SearchIllustration
    : illustration === 'error' ? ErrorIllustration
    : EmptyIllustration;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="flex flex-col items-center justify-center gap-md py-2xl text-center"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.5, type: 'spring', stiffness: 200 }}
      >
        {illustration ? (
          <IllComponent />
        ) : (
          <div className="rounded-2xl bg-primary/5 p-lg">
            <ResolvedIcon className="h-10 w-10 text-primary/40" aria-hidden />
          </div>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="space-y-1"
      >
        <p className="text-sm font-medium text-text">{message}</p>
        {description && <p className="max-w-xs text-xs text-muted">{description}</p>}
      </motion.div>

      {(cta || (ctaLabel && onAction)) && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4 }}
        >
          {cta || (
            <Button size="sm" onClick={onAction} className="gap-1.5">
              <CtaIcon className="h-3.5 w-3.5" />
              {ctaLabel}
            </Button>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Error State (Premium with illustration)
// ---------------------------------------------------------------------------

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
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center gap-md py-2xl text-center"
      role="alert"
    >
      <ErrorIllustration />
      <div className="space-y-1">
        <p className="text-sm font-medium text-text">{title}</p>
        {body && <p className="text-xs text-muted">{body}</p>}
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {retryLabel ?? tc('retry')}
        </Button>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Page Transition Wrapper
// ---------------------------------------------------------------------------

export function PageTransition({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Staggered List Animation
// ---------------------------------------------------------------------------

export function StaggeredList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.05 } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggeredItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 8 },
        show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

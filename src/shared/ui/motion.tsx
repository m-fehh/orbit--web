'use client';

import { type ReactNode } from 'react';
import { motion, type Variants, type Transition } from 'framer-motion';
import { cn } from '@/shared/lib/utils';

// ---------------------------------------------------------------------------
// Preset transitions (Linear/Vercel-inspired)
// ---------------------------------------------------------------------------

export const EASE_OUT: Transition = { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] };
export const EASE_SPRING: Transition = { type: 'spring', stiffness: 300, damping: 30 };
export const EASE_BOUNCE: Transition = { type: 'spring', stiffness: 400, damping: 20 };

// ---------------------------------------------------------------------------
// Fade In
// ---------------------------------------------------------------------------

export function FadeIn({
  children,
  className,
  delay = 0,
  duration = 0.3,
  direction,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
}) {
  const offset = 12;
  const initial: Record<string, number> = { opacity: 0 };
  if (direction === 'up') initial.y = offset;
  if (direction === 'down') initial.y = -offset;
  if (direction === 'left') initial.x = offset;
  if (direction === 'right') initial.x = -offset;

  return (
    <motion.div
      initial={initial}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ delay, duration, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Scale In (for modals, popovers)
// ---------------------------------------------------------------------------

export function ScaleIn({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay, ...EASE_OUT }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Slide In (for panels, drawers)
// ---------------------------------------------------------------------------

export function SlideIn({
  children,
  className,
  from = 'right',
  distance = 320,
}: {
  children: ReactNode;
  className?: string;
  from?: 'left' | 'right' | 'top' | 'bottom';
  distance?: number;
}) {
  const axis = from === 'left' || from === 'right' ? 'x' : 'y';
  const sign = from === 'right' || from === 'bottom' ? 1 : -1;
  return (
    <motion.div
      initial={{ [axis]: sign * distance, opacity: 0 }}
      animate={{ [axis]: 0, opacity: 1 }}
      exit={{ [axis]: sign * distance, opacity: 0 }}
      transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Stagger Container + Item
// ---------------------------------------------------------------------------

const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};

const staggerItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } },
};

export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div initial="hidden" animate="show" variants={staggerContainer} className={className}>
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={staggerItem} className={className}>
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Number Ticker (count-up animation)
// ---------------------------------------------------------------------------

export function NumberTicker({
  value,
  className,
  duration = 0.8,
  format,
}: {
  value: number;
  className?: string;
  duration?: number;
  format?: (n: number) => string;
}) {
  return (
    <motion.span
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      key={value}
    >
      <motion.span
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        {format ? format(value) : value}
      </motion.span>
    </motion.span>
  );
}

// ---------------------------------------------------------------------------
// Pulse dot (for live/active indicators)
// ---------------------------------------------------------------------------

export function PulseDot({ className, color = 'bg-success' }: { className?: string; color?: string }) {
  return (
    <span className={cn('relative inline-flex h-2.5 w-2.5', className)}>
      <motion.span
        className={cn('absolute inset-0 rounded-full opacity-75', color)}
        animate={{ scale: [1, 1.8, 1], opacity: [0.75, 0, 0.75] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
      <span className={cn('relative inline-flex h-2.5 w-2.5 rounded-full', color)} />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Shimmer (for loading text/badges)
// ---------------------------------------------------------------------------

export function Shimmer({ className }: { className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-md bg-border/30', className)}>
      <motion.div
        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent"
        animate={{ translateX: ['−100%', '100%'] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confidence Bar (for intelligence scores)
// ---------------------------------------------------------------------------

export function ConfidenceBar({
  value,
  className,
  size = 'md',
}: {
  value: number;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? 'bg-success' : pct >= 40 ? 'bg-warning' : 'bg-danger';
  const h = size === 'sm' ? 'h-1' : 'h-1.5';
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={cn('flex-1 overflow-hidden rounded-full bg-border/30', h)}>
        <motion.div
          className={cn('rounded-full', h, color)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
        />
      </div>
      <span className="text-[10px] font-bold tabular-nums text-muted">{pct}%</span>
    </div>
  );
}

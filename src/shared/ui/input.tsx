'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/shared/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-10 w-full rounded-md border bg-bg-subtle px-md text-sm text-text outline-none transition-all',
        'placeholder:text-dim',
        'focus:border-primary focus:bg-panel focus:ring-4 focus:ring-primary/15',
        invalid
          ? 'border-danger focus:border-danger focus:ring-danger/15'
          : 'border-border hover:border-border-strong',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

'use client';

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: ReactNode;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
  invalid?: boolean;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, description, size = 'md', invalid = false, id: externalId, disabled, ...props }, ref) => {
    const generatedId = useId();
    const id = externalId || generatedId;

    const sizeMap = {
      sm: { box: 'h-3.5 w-3.5', icon: 'h-2.5 w-2.5', text: 'text-xs', gap: 'gap-1.5' },
      md: { box: 'h-4 w-4', icon: 'h-3 w-3', text: 'text-sm', gap: 'gap-2' },
      lg: { box: 'h-5 w-5', icon: 'h-3.5 w-3.5', text: 'text-base', gap: 'gap-2.5' },
    };
    const s = sizeMap[size];

    return (
      <label
        htmlFor={id}
        className={cn(
          'group inline-flex items-start select-none',
          s.gap,
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
          className,
        )}
      >
        <span className="relative flex shrink-0 items-center justify-center pt-0.5">
          <input
            ref={ref}
            id={id}
            type="checkbox"
            disabled={disabled}
            className="peer sr-only"
            aria-invalid={invalid || undefined}
            {...props}
          />
          <span
            className={cn(
              'flex items-center justify-center rounded border-2 transition-all duration-200',
              s.box,
              'peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30 peer-focus-visible:ring-offset-1',
              invalid
                ? 'border-danger peer-checked:border-danger peer-checked:bg-danger'
                : 'border-border-strong peer-checked:border-primary peer-checked:bg-primary',
              !disabled && !invalid && 'group-hover:border-primary/60',
              'peer-checked:[&>svg]:scale-100 peer-checked:[&>svg]:opacity-100',
            )}
          >
            <svg
              className={cn(
                s.icon,
                'scale-0 opacity-0 transition-all duration-200 ease-out',
                invalid ? 'text-danger-fg' : 'text-primary-fg',
              )}
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3.5 8.5L6.5 11.5L12.5 4.5" />
            </svg>
          </span>
        </span>
        {(label || description) && (
          <span className="min-w-0">
            {label && <span className={cn('block font-medium text-text', s.text)}>{label}</span>}
            {description && <span className="block text-xs text-muted">{description}</span>}
          </span>
        )}
      </label>
    );
  },
);

Checkbox.displayName = 'Checkbox';

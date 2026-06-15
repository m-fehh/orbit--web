'use client';

import {
  forwardRef,
  useId,
  useState,
  useRef,
  useEffect,
  type InputHTMLAttributes,
  type ReactNode,
  type CSSProperties,
} from 'react';
import { cn } from '@/shared/lib/utils';

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  invalid?: boolean;
  errorMessage?: string;
  helperText?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
  label?: string;
  variant?: 'default' | 'filled' | 'underlined' | 'glass' | 'neubrutal' | 'cyber';
  inputSize?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  typewriter?: boolean;
  particles?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      invalid = false,
      errorMessage,
      helperText,
      prefix,
      suffix,
      label,
      variant = 'default',
      inputSize = 'md',
      disabled = false,
      loading = false,
      typewriter = false,
      particles = false,
      id: externalId,
      onFocus,
      onBlur,
      value,
      defaultValue,
      placeholder,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const id = externalId || generatedId;
    const [isFocused, setIsFocused] = useState(false);
    const [particleList, setParticleList] = useState<Array<{ id: number; x: number; y: number; size: number; delay: number }>>([]);
    const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
    const containerRef = useRef<HTMLDivElement>(null);
    const particleCounter = useRef(0);

    const hasValue =
      (value !== undefined && value !== '') ||
      (defaultValue !== undefined && defaultValue !== '');

    const isLabelFloating = isFocused || hasValue || placeholder;

    // PARTÍCULAS NINJA
    useEffect(() => {
      if (!particles || !isFocused) {
        setParticleList([]);
        return;
      }

      const interval = setInterval(() => {
        const newParticle = {
          id: particleCounter.current++,
          x: Math.random() * 100,
          y: Math.random() * 100,
          size: Math.random() * 4 + 2,
          delay: Math.random() * 0.5,
        };
        setParticleList((prev) => [...prev.slice(-20), newParticle]);
      }, 150);

      return () => clearInterval(interval);
    }, [particles, isFocused]);

    // MOUSE TRACKER
    const handleMouseMove = (e: React.MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setMousePos({
        x: ((e.clientX - rect.left) / rect.width) * 100,
        y: ((e.clientY - rect.top) / rect.height) * 100,
      });
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      onBlur?.(e);
    };

    const sizeClasses = {
      sm: 'h-8 text-xs',
      md: 'h-10 text-sm',
      lg: 'h-12 text-base',
    };

    const variantClasses = {
      default: cn(
        'rounded-lg border bg-panel',
        'transition-all duration-500 ease-spring',
        invalid
          ? 'border-danger shadow-[0_0_0_4px_var(--orbit-color-danger)/0.1]'
          : 'border-border shadow-sm hover:border-border-strong hover:shadow focus-within:border-primary focus-within:shadow-[0_0_0_6px_var(--orbit-color-primary)/0.1,0_4px_16px_var(--orbit-color-primary)/0.08]',
      ),
      
      filled: cn(
        'rounded-lg border-thick border-transparent bg-bg-subtle',
        'transition-all duration-500 ease-spring',
        'focus-within:bg-panel',
        invalid
          ? 'bg-danger/[0.04] border-danger shadow-[0_0_0_4px_var(--orbit-color-danger)/0.1]'
          : 'shadow-sm hover:shadow focus-within:border-primary focus-within:shadow-[0_0_0_6px_var(--orbit-color-primary)/0.08,0_4px_20px_var(--orbit-color-primary)/0.06]',
      ),
      
      underlined: cn(
        'border-b-[3px] border-border bg-transparent rounded-none',
        'transition-all duration-500 ease-spring',
        invalid
          ? 'border-danger shadow-[0_2px_0_0_var(--orbit-color-danger)/0.2]'
          : 'hover:border-border-strong focus-within:border-primary focus-within:shadow-[0_3px_0_0_var(--orbit-color-primary)/0.3]',
      ),
      
      glass: cn(
        'rounded-xl border border-white/20',
        'backdrop-blur-xl bg-white/5',
        'shadow-[0_8px_32px_rgba(0,0,0,0.1)]',
        'transition-all duration-700 ease-spring',
        invalid
          ? 'border-danger/50 shadow-[0_8px_32px_rgba(239,68,68,0.15)]'
          : 'hover:border-white/30 hover:shadow-[0_8px_32px_rgba(0,0,0,0.15)] focus-within:border-white/40 focus-within:shadow-[0_8px_40px_rgba(0,0,0,0.2)]',
      ),
      
      neubrutal: cn(
        'rounded-md border-[3px] border-text bg-panel',
        'shadow-[6px_6px_0px_0px_var(--orbit-color-text)]',
        'transition-all duration-200 ease-bounce-sm',
        'hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[3px_3px_0px_0px_var(--orbit-color-text)]',
        'focus-within:translate-x-[4px] focus-within:translate-y-[4px] focus-within:shadow-none',
        invalid
          ? 'border-danger shadow-[6px_6px_0px_0px_var(--orbit-color-danger)] hover:shadow-[3px_3px_0px_0px_var(--orbit-color-danger)]'
          : '',
      ),
      
      cyber: cn(
        'rounded-sm bg-bg border-2',
        'transition-all duration-300 ease-out',
        invalid
          ? 'border-danger animate-[neonPulse_2s_ease-in-out_infinite] shadow-[0_0_20px_var(--orbit-color-danger),inset_0_0_20px_var(--orbit-color-danger)/0.1]'
          : 'border-primary animate-[neonPulse_3s_ease-in-out_infinite] shadow-[0_0_15px_var(--orbit-color-primary)/0.3,inset_0_0_15px_var(--orbit-color-primary)/0.05] hover:shadow-[0_0_25px_var(--orbit-color-primary)/0.4,inset_0_0_25px_var(--orbit-color-primary)/0.08] focus-within:shadow-[0_0_40px_var(--orbit-color-primary)/0.5,inset_0_0_40px_var(--orbit-color-primary)/0.1]',
      ),
    };

    return (
      <div className="w-full space-y-2">
        <div
          ref={containerRef}
          className="relative"
          onMouseMove={handleMouseMove}
          style={{
            animation: 'fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          }}
        >
          {/* GLOW TRACKER */}
          {isFocused && !invalid && variant !== 'underlined' && (
            <div
              className="absolute -inset-[3px] rounded-xl opacity-70 pointer-events-none transition-all duration-300"
              style={{
                background: `radial-gradient(circle at ${mousePos.x}% ${mousePos.y}%, var(--orbit-color-primary)/0.2 0%, transparent 60%)`,
              }}
            />
          )}

          {/* SCANLINE CYBERPUNK */}
          {variant === 'cyber' && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-sm">
              <div
                className="absolute w-full h-[2px] bg-gradient-to-r from-transparent via-primary/30 to-transparent"
                style={{
                  animation: 'scanline 3s linear infinite',
                }}
              />
            </div>
          )}

          {/* PARTÍCULAS */}
          {particles && isFocused && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-inherit">
              {particleList.map((particle) => (
                <div
                  key={particle.id}
                  className="absolute rounded-full bg-primary"
                  style={{
                    width: `${particle.size}px`,
                    height: `${particle.size}px`,
                    left: `${particle.x}%`,
                    top: `${particle.y}%`,
                    animation: `particleFloat 2s ease-out ${particle.delay}s forwards`,
                    opacity: 0,
                  }}
                />
              ))}
            </div>
          )}

          <div
            className={cn(
              'group relative flex items-center gap-2 overflow-hidden',
              sizeClasses[inputSize],
              variantClasses[variant],
              disabled && 'opacity-40 cursor-not-allowed pointer-events-none saturate-0',
              loading && 'animate-pulse pointer-events-none',
              variant === 'neubrutal' && 'font-bold',
              variant === 'cyber' && 'font-mono tracking-wider',
              className,
            )}
            style={
              variant === 'glass' && isFocused
                ? {
                    background: `linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.1) 100%)`,
                  }
                : undefined
            }
          >
            {/* PREFIX COM ANIMAÇÃO */}
            {prefix && (
              <span
                className={cn(
                  'flex-shrink-0 pl-3 z-10 transition-all duration-500',
                  isFocused && !invalid
                    ? 'text-primary scale-110 translate-x-0.5'
                    : 'text-muted',
                  invalid && 'text-danger',
                )}
                style={{
                  animation: isFocused && !invalid
                    ? 'iconBounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
                    : 'none',
                }}
              >
                {prefix}
              </span>
            )}

            <div className="relative flex-1 z-10">
              {/* LABEL FLUTUANTE */}
              {label && (
                <label
                  htmlFor={id}
                  className={cn(
                    'absolute left-0 select-none pointer-events-none font-sans font-medium',
                    'transition-all duration-500 ease-spring',
                    isLabelFloating
                      ? '-top-3.5 text-xs'
                      : 'top-1/2 -translate-y-1/2 text-muted',
                    variant === 'underlined' && 'left-0',
                    variant !== 'underlined' && 'left-1',
                    inputSize === 'sm' && isLabelFloating && '-top-2.5 text-[10px]',
                    inputSize === 'lg' && isLabelFloating && '-top-4 text-sm',
                  )}
                  style={{
                    color: isFocused && !invalid
                      ? 'var(--orbit-color-primary)'
                      : invalid
                      ? 'var(--orbit-color-danger)'
                      : isLabelFloating
                      ? 'var(--orbit-color-muted)'
                      : 'var(--orbit-color-dim)',
                    fontWeight: isLabelFloating ? 700 : 500,
                    letterSpacing: isFocused && !invalid ? '0.05em' : '0em',
                  }}
                >
                  {label}
                </label>
              )}

              {/* INPUT */}
              <input
                ref={ref}
                id={id}
                disabled={disabled}
                value={value}
                defaultValue={defaultValue}
                placeholder={label ? ' ' : placeholder}
                onFocus={handleFocus}
                onBlur={handleBlur}
                className={cn(
                  'w-full bg-transparent outline-none text-text font-sans',
                  'placeholder:text-dim/40 placeholder:font-normal',
                  'disabled:cursor-not-allowed',
                  'transition-all duration-300',
                  !prefix && 'pl-3',
                  !suffix && 'pr-3',
                  label && isLabelFloating && 'pt-2',
                  inputSize === 'sm' && 'px-2',
                  isFocused && !invalid && 'tracking-wide',
                  variant === 'cyber' && 'font-mono uppercase tracking-widest',
                  typewriter && 'border-r-2 border-primary animate-blink',
                )}
                aria-invalid={invalid || undefined}
                aria-describedby={
                  errorMessage || helperText ? `${id}-description` : undefined
                }
                {...props}
              />
            </div>

            {/* SUFFIX COM ANIMAÇÃO */}
            {suffix && (
              <span
                className={cn(
                  'flex-shrink-0 pr-3 z-10 transition-all duration-500',
                  isFocused && !invalid
                    ? 'text-primary scale-110 -translate-x-0.5'
                    : 'text-muted',
                  invalid && 'text-danger',
                )}
                style={{
                  animation: isFocused && !invalid
                    ? 'iconBounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s forwards'
                    : 'none',
                }}
              >
                {suffix}
              </span>
            )}

            {/* BARRA UNDERLINED ANIMADA */}
            {variant === 'underlined' && (
              <div
                className={cn(
                  'absolute bottom-0 left-0 h-[3px] bg-gradient-to-r from-primary via-primary-soft to-primary',
                  'transition-all duration-700 ease-spring',
                  isFocused && !invalid ? 'w-full' : 'w-0',
                )}
              />
            )}
          </div>
        </div>

        {/* MENSAGENS */}
        {(errorMessage || helperText) && (
          <div
            id={`${id}-description`}
            className={cn(
              'flex items-center gap-2 px-1 text-xs font-medium font-sans',
              'transition-all duration-300',
              invalid ? 'text-danger' : 'text-dim',
            )}
            style={{
              animation: 'slideIn 0.3s ease-out forwards',
            }}
          >
            {invalid && errorMessage && (
              <>
                <div
                  className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: 'var(--orbit-color-danger)/0.1',
                    animation: 'pulse 1.5s ease-in-out infinite',
                  }}
                >
                  <svg
                    className="h-3 w-3 text-danger"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <span>{errorMessage}</span>
              </>
            )}
            {!invalid && helperText && (
              <span>{helperText}</span>
            )}
          </div>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
'use client';

import { forwardRef, useState, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input, type InputProps } from '@/shared/ui/input';

export interface PasswordInputProps extends Omit<InputProps, 'type' | 'suffix'> {
  /** Ícone exibido à esquerda (ex.: <Lock />). */
  prefix?: ReactNode;
  /** Rótulos acessíveis para o botão de visibilidade. */
  showLabel?: string;
  hideLabel?: string;
}

/**
 * Campo de senha com botão para alternar a visibilidade. Reaproveita o `Input`
 * base (variantes, estados de erro, ícones) e injeta o toggle como sufixo.
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ prefix, showLabel = 'Mostrar senha', hideLabel = 'Ocultar senha', ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    return (
      <Input
        ref={ref}
        type={visible ? 'text' : 'password'}
        prefix={prefix}
        suffix={
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? hideLabel : showLabel}
            title={visible ? hideLabel : showLabel}
            className="grid h-7 w-7 -mr-1 place-items-center rounded-md text-muted transition-colors hover:bg-panel-2 hover:text-text"
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        }
        {...props}
      />
    );
  },
);

PasswordInput.displayName = 'PasswordInput';

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  hint?: string;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  sizeVariant?: 'sm' | 'md' | 'lg';
}

// md = 48px (touch target POS, WCAG/Loyverse mínimo 44px). NO bajar.
// sm = 40px solo para tablas backoffice de alta densidad (NO usar en flow táctil).
// lg = 56px para acciones críticas (apertura/cierre de caja, montos).
const sizeClasses = {
  sm: 'h-10 text-sm',
  md: 'h-12 text-base',
  lg: 'h-14 text-base',
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { error, hint, iconLeft, iconRight, sizeVariant = 'md', className, id, ...rest },
  ref,
) {
  const msgId = id && (error || hint) ? `${id}-msg` : undefined;
  const inputEl = (
    <input
      ref={ref}
      id={id}
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={msgId}
      className={cn(
        'w-full rounded-lg px-3 transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--br-amb)]',
        sizeClasses[sizeVariant],
        iconLeft && 'pl-9',
        iconRight && 'pr-9',
        className,
      )}
      style={{
        background: 'var(--br-sur)',
        color: 'var(--br-txt)',
        border: `1px solid ${error ? 'var(--br-red)' : 'var(--br-bor)'}`,
      }}
      {...rest}
    />
  );

  if (!iconLeft && !iconRight && !error && !hint) return inputEl;

  return (
    <div className="w-full">
      <div className="relative">
        {iconLeft && (
          <span
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--br-txt2)' }}
            aria-hidden="true"
          >
            {iconLeft}
          </span>
        )}
        {inputEl}
        {iconRight && (
          <span
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--br-txt2)' }}
            aria-hidden="true"
          >
            {iconRight}
          </span>
        )}
      </div>
      {(error || hint) && (
        <p
          id={msgId}
          className="mt-1 text-xs"
          role={error ? 'alert' : undefined}
          style={{ color: error ? 'var(--br-red)' : 'var(--br-txt2)' }}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
});

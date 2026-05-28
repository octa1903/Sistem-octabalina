import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';

type Variant = 'primary' | 'secondary' | 'danger' | 'success' | 'info' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
}

// Tamaños calibrados para uso táctil (TPV con guantes / manos sucias):
//   md = 48px (default; cumple WCAG/Loyverse mínimo 44px). NO bajar.
//   sm = 40px (solo permitido en tablas admin/settings, NO en flujos POS).
//   lg = 56px (acciones primarias críticas: cobrar, confirmar venta).
// Antes md=40 y sm=32 — se subió en Fase D del plan de mejoras (2026-05).
const sizeClasses: Record<Size, string> = {
  sm: 'h-10 px-3 text-xs gap-1.5',
  md: 'h-12 px-4 text-sm gap-2',
  lg: 'h-14 px-6 text-base gap-2',
};

const variantStyles: Record<Variant, { className: string; style?: React.CSSProperties }> = {
  primary: {
    className: 'text-white shadow-sm hover:opacity-90 active:opacity-80',
    style: { background: 'var(--br-amb)' },
  },
  secondary: {
    className: 'hover:bg-[var(--br-sur2)]',
    style: {
      background: 'var(--br-sur)',
      color: 'var(--br-txt)',
      border: '1px solid var(--br-bor)',
    },
  },
  danger: {
    className: 'text-white shadow-sm hover:opacity-90 active:opacity-80',
    style: { background: 'var(--br-red)' },
  },
  success: {
    className: 'text-white shadow-sm hover:opacity-90 active:opacity-80',
    style: { background: 'var(--br-grn)' },
  },
  info: {
    className: 'text-white shadow-sm hover:opacity-90 active:opacity-80',
    style: { background: 'var(--br-info)' },
  },
  ghost: {
    className: 'hover:bg-[var(--br-sur2)]',
    style: { background: 'transparent', color: 'var(--br-txt)' },
  },
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled,
    iconLeft,
    iconRight,
    fullWidth,
    className,
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  const v = variantStyles[variant];
  const isDisabled = disabled || loading;
  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-semibold transition-all',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--br-amb)] focus-visible:ring-offset-[var(--br-bg)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        sizeClasses[size],
        v.className,
        fullWidth && 'w-full',
        className,
      )}
      style={v.style}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : iconLeft}
      {children}
      {!loading && iconRight}
    </button>
  );
});

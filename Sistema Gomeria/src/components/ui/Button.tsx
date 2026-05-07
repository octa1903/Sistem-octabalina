import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';

type Variant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
}

const sizeClasses: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
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
        'focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
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

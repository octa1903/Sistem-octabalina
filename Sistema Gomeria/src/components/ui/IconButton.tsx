import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

type Tone = 'neutral' | 'danger' | 'success' | 'primary';
type Size = 'sm' | 'md' | 'lg';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Texto accesible obligatorio: lectores de pantalla y `title` nativo. */
  label: string;
  icon: ReactNode;
  tone?: Tone;
  size?: Size;
  /** Mostrar el borde en estado base. Default true para acciones destructivas en filas. */
  bordered?: boolean;
}

const sizeClasses: Record<Size, string> = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
};

const toneStyle: Record<Tone, React.CSSProperties> = {
  neutral: { color: 'var(--br-txt2)' },
  danger: { color: 'var(--br-red)' },
  success: { color: 'var(--br-grn)' },
  primary: { color: 'var(--br-amb)' },
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, tone = 'neutral', size = 'md', bordered = true, className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center justify-center rounded-lg transition-all',
        'hover:bg-[var(--br-sur2)]',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--br-amb)] focus-visible:ring-offset-[var(--br-bg)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        sizeClasses[size],
        className,
      )}
      style={{
        ...toneStyle[tone],
        border: bordered ? '1px solid var(--br-bor)' : '1px solid transparent',
      }}
      {...rest}
    >
      {icon}
    </button>
  );
});

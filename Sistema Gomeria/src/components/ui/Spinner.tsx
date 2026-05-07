import { cn } from '@/utils/cn';

interface SpinnerProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  /** Color del trazo activo. Default = primary (--br-amb). */
  tone?: 'primary' | 'inherit';
}

export function Spinner({ className, size = 'md', tone = 'primary' }: SpinnerProps) {
  const sizeClasses = { sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-12 w-12' };
  return (
    <div className={cn('flex items-center justify-center', className)} role="status" aria-label="Cargando">
      <div
        className={cn('animate-spin rounded-full', sizeClasses[size])}
        style={{
          borderWidth: 2,
          borderStyle: 'solid',
          borderColor: 'var(--br-bor)',
          borderTopColor: tone === 'primary' ? 'var(--br-amb)' : 'currentColor',
        }}
      />
    </div>
  );
}

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  /** `compact` para listas dentro de cards; `default` para estados vacíos de view completa. */
  density?: 'compact' | 'default';
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  density = 'default',
}: EmptyStateProps) {
  const isCompact = density === 'compact';
  return (
    <div
      role="status"
      className={cn(
        'flex flex-col items-center justify-center text-center',
        isCompact ? 'gap-2 py-6' : 'gap-3 py-12',
        className,
      )}
    >
      {Icon && (
        <div
          className={cn(
            'flex items-center justify-center rounded-full',
            isCompact ? 'h-10 w-10' : 'h-16 w-16',
          )}
          style={{ background: 'var(--br-sur2)', color: 'var(--br-txt2)' }}
        >
          <Icon className={isCompact ? 'h-5 w-5' : 'h-8 w-8'} aria-hidden="true" />
        </div>
      )}
      <h3
        className={cn('font-semibold', isCompact ? 'text-sm' : 'text-base')}
        style={{ color: 'var(--br-txt)' }}
      >
        {title}
      </h3>
      {description && (
        <p
          className={cn('max-w-sm', isCompact ? 'text-xs' : 'text-sm')}
          style={{ color: 'var(--br-txt2)' }}
        >
          {description}
        </p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

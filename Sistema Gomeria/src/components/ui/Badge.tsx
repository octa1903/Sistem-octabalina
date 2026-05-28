import { cn } from '@/utils/cn';
import { STATUS_COLORS, STATUS_LABELS } from '@/constants';

interface BadgeProps {
  status: string;
  className?: string;
  /** Etiqueta accesible. Default usa STATUS_LABELS[status]. */
  ariaLabel?: string;
}

export function Badge({ status, className, ariaLabel }: BadgeProps) {
  const label = STATUS_LABELS[status] || status;
  return (
    <span
      role="img"
      aria-label={ariaLabel ?? `Estado: ${label}`}
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        STATUS_COLORS[status] || 'bg-[var(--br-sur2)] text-[var(--br-txt2)] border-[var(--br-bor)]',
        className,
      )}
    >
      {label}
    </span>
  );
}

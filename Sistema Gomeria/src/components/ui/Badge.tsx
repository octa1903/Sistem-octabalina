import { cn } from '@/utils/cn';
import { STATUS_COLORS, STATUS_LABELS } from '@/constants';

interface BadgeProps {
  status: string;
  className?: string;
}

export function Badge({ status, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        STATUS_COLORS[status] || 'bg-gray-100 text-gray-700 border-gray-300',
        className,
      )}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}

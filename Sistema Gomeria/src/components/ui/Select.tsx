import { forwardRef, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
  sizeVariant?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'h-8 text-xs pr-8',
  md: 'h-10 text-sm pr-9',
  lg: 'h-12 text-base pr-10',
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { error, sizeVariant = 'md', className, children, id, ...rest },
  ref,
) {
  return (
    <div className="relative w-full">
      <select
        ref={ref}
        id={id}
        aria-invalid={error ? 'true' : undefined}
        className={cn(
          'w-full appearance-none rounded-lg pl-3 transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--br-amb)]',
          sizeClasses[sizeVariant],
          className,
        )}
        style={{
          background: 'var(--br-sur)',
          color: 'var(--br-txt)',
          border: `1px solid ${error ? 'var(--br-red)' : 'var(--br-bor)'}`,
        }}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2"
        style={{ color: 'var(--br-txt2)' }}
        aria-hidden="true"
      />
    </div>
  );
});

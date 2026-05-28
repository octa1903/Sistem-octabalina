import type { ReactNode } from 'react';

interface SectionHeaderProps {
  icon?: ReactNode;
  title: string;
  /** Texto auxiliar al lado del título (ej: nombre de tienda activa). */
  subtitle?: string;
  action?: ReactNode;
}

export function SectionHeader({ icon, title, subtitle, action }: SectionHeaderProps) {
  return (
    <div
      className="px-5 py-4 flex items-center justify-between gap-3"
      style={{ borderBottom: '1px solid var(--br-bor)' }}
    >
      <div className="flex items-center gap-2 min-w-0">
        {icon && (
          <span className="flex-shrink-0" style={{ color: 'var(--br-amb)' }} aria-hidden="true">
            {icon}
          </span>
        )}
        <h2 className="font-semibold truncate" style={{ color: 'var(--br-txt)' }}>
          {title}
        </h2>
        {subtitle && (
          <span className="text-xs truncate" style={{ color: 'var(--br-txt2)' }}>
            · {subtitle}
          </span>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

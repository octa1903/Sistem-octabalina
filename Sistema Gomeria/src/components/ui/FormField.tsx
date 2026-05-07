import { useId, type ReactElement, type ReactNode, cloneElement, isValidElement } from 'react';

interface FormFieldProps {
  label: string;
  /** Hijo único que reciba `id` y `aria-describedby` (Input/Select/textarea custom). */
  children: ReactElement<{ id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean | 'true' }>;
  required?: boolean;
  error?: string;
  hint?: string;
  /** Texto adicional al lado del label (ej: "opcional"). */
  badge?: ReactNode;
}

export function FormField({ label, children, required, error, hint, badge }: FormFieldProps) {
  const generatedId = useId();
  const id = children.props.id ?? generatedId;
  const msgId = `${id}-msg`;

  const child = isValidElement(children)
    ? cloneElement(children, {
        id,
        'aria-describedby': error || hint ? msgId : undefined,
        'aria-invalid': error ? true : undefined,
      })
    : children;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="flex items-center gap-2 text-xs font-medium" style={{ color: 'var(--br-txt2)' }}>
        <span>
          {label}
          {required && (
            <span aria-hidden="true" style={{ color: 'var(--br-red)' }}>
              {' *'}
            </span>
          )}
        </span>
        {badge && <span className="text-[10px] uppercase tracking-wide">{badge}</span>}
      </label>
      {child}
      {(error || hint) && (
        <p id={msgId} className="text-xs" style={{ color: error ? 'var(--br-red)' : 'var(--br-txt2)' }}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Building2 } from 'lucide-react';

interface WizardShellProps {
  title: string;
  subtitle?: string;
  /** Pasos visibles en el progreso (ej. ['Datos fiscales', 'Operador admin']). */
  steps: string[];
  /** Índice 0-based del paso actual. */
  currentStep: number;
  children: ReactNode;
  footer: ReactNode;
}

const FOCUSABLE_SELECTOR = [
  'a[href]:not([disabled])',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Shell común del FirstRunWizard: header con título + indicador de pasos
 * + área de contenido scrollable + footer fijo con botones.
 *
 * Separado del wizard concreto para que sea trivial sumar/sacar pasos sin
 * tocar markup ni estilos.
 */
export function WizardShell({ title, subtitle, steps, currentStep, children, footer }: WizardShellProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus trap: bootstrap del primer arranque, no debe poder tabular fuera.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusables = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (!active || !dialogRef.current.contains(active)) {
        e.preventDefault();
        first.focus();
        return;
      }
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ background: 'rgba(26, 24, 20, 0.45)' }}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-2xl overflow-hidden"
        style={{
          background: 'var(--br-sur)',
          border: '1px solid var(--br-bor)',
          borderRadius: 'var(--br-radius-lg)',
          boxShadow: 'var(--br-shadow-lg)',
        }}
      >
        <div
          className="px-6 py-5 flex items-start gap-3"
          style={{ borderBottom: '1px solid var(--br-bor)', background: 'var(--br-dark-amb-bg)' }}
        >
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--br-amb)' }}
          >
            <Building2 className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <h2 id={titleId} className="text-lg font-semibold" style={{ color: 'var(--br-txt)' }}>
              {title}
            </h2>
            {subtitle && (
              <p className="text-sm mt-1" style={{ color: 'var(--br-txt2)' }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {steps.length > 1 && (
          <div
            className="px-6 py-3 flex items-center gap-3 text-xs"
            style={{ borderBottom: '1px solid var(--br-bor)', background: 'var(--br-bg)' }}
          >
            {steps.map((label, i) => {
              const done = i < currentStep;
              const active = i === currentStep;
              return (
                <div key={label} className="flex items-center gap-2">
                  <span
                    aria-current={active ? 'step' : undefined}
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold"
                    style={{
                      background: done || active ? 'var(--br-amb)' : 'var(--br-bg)',
                      color: done || active ? 'var(--br-sur)' : 'var(--br-txt2)',
                      border: `1px solid ${done || active ? 'var(--br-amb)' : 'var(--br-bor)'}`,
                    }}
                  >
                    {done ? '✓' : i + 1}
                  </span>
                  <span style={{ color: active ? 'var(--br-txt)' : 'var(--br-txt2)' }}>{label}</span>
                  {i < steps.length - 1 && <span style={{ color: 'var(--br-txt2)' }}>·</span>}
                </div>
              );
            })}
          </div>
        )}

        <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">{children}</div>

        <div
          className="px-6 py-4 flex justify-end gap-2"
          style={{ borderTop: '1px solid var(--br-bor)', background: 'var(--br-bg)' }}
        >
          {footer}
        </div>
      </div>
    </div>
  );
}

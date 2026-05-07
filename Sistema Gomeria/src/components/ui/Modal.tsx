import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/utils/cn';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  /** Cerrar al hacer click en el overlay. Default true. Poner false para flujos críticos (cobro, cierre caja). */
  closeOnOverlay?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
  className,
  closeOnOverlay = true,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose();
    };
    document.addEventListener('keydown', handleEsc);
    if (open) {
      document.body.style.overflow = 'hidden';
      const previouslyFocused = document.activeElement as HTMLElement | null;
      // Mover foco al primer elemento focusable dentro del modal.
      requestAnimationFrame(() => {
        const focusable = dialogRef.current?.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        focusable?.focus();
      });
      return () => {
        document.removeEventListener('keydown', handleEsc);
        document.body.style.overflow = '';
        previouslyFocused?.focus?.();
      };
    }
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ background: 'rgba(26, 24, 20, 0.45)' }}
      onClick={(e) => {
        if (closeOnOverlay && e.target === overlayRef.current) onClose();
      }}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        className={cn('w-full animate-in', sizeClasses[size], className)}
        style={{
          background: 'var(--br-sur)',
          color: 'var(--br-txt)',
          borderRadius: 'var(--br-radius-lg)',
          boxShadow: 'var(--br-shadow-lg)',
        }}
      >
        {title && (
          <div
            className="flex items-center justify-between px-6 py-4"
            style={{ borderBottom: '1px solid var(--br-bor)' }}
          >
            <h2 id="modal-title" className="text-lg font-semibold" style={{ color: 'var(--br-txt)' }}>
              {title}
            </h2>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="rounded-lg p-1.5 transition-colors hover:bg-[var(--br-sur2)]"
              style={{ color: 'var(--br-txt2)' }}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="max-h-[70vh] overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}

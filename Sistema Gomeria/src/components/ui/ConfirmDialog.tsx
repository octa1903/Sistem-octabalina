import { useEffect } from 'react';
import { AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { useStableCallback } from '@/hooks/useStableCallback';

const variantByType = {
  danger: 'danger',
  warning: 'primary',
  info: 'info',
  success: 'success',
} as const;

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (inputValue?: string) => void;
  title: string;
  message: string;
  type?: 'danger' | 'warning' | 'info' | 'success';
  confirmText?: string;
  cancelText?: string;
  inputField?: boolean;
  inputValue?: string;
  inputPlaceholder?: string;
  onInputChange?: (value: string) => void;
}

const iconMap = {
  danger: XCircle,
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle,
};

const tokenMap = {
  danger: { fg: 'var(--br-red)', bg: 'var(--br-red-bg)', bor: 'var(--br-red-bor)' },
  warning: { fg: 'var(--br-amb)', bg: 'var(--br-amb-bg)', bor: 'var(--br-amb-bor)' },
  info: { fg: 'var(--br-info)', bg: 'var(--br-info-bg)', bor: 'var(--br-info-bor)' },
  success: { fg: 'var(--br-grn)', bg: 'var(--br-grn-bg)', bor: 'var(--br-grn-bor)' },
};

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  type = 'info',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  inputField,
  inputValue = '',
  inputPlaceholder,
  onInputChange,
}: ConfirmDialogProps) {
  const Icon = iconMap[type];
  const palette = tokenMap[type];
  const stableOnConfirm = useStableCallback(onConfirm);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !inputField) {
        e.preventDefault();
        stableOnConfirm();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, inputField, stableOnConfirm]);

  return (
    <Modal open={open} onClose={onClose} size="sm" closeOnOverlay={type !== 'danger'}>
      <div className="text-center">
        <div
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: palette.bg, color: palette.fg }}
        >
          <Icon className="h-7 w-7" aria-hidden="true" />
        </div>
        <h3 className="mb-2 text-lg font-semibold" style={{ color: 'var(--br-txt)' }}>
          {title}
        </h3>
        <p className="mb-6 text-sm" style={{ color: 'var(--br-txt2)' }}>
          {message}
        </p>

        {inputField && onInputChange && (
          <input
            type="text"
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onConfirm(inputValue);
              }
            }}
            placeholder={inputPlaceholder}
            aria-label={inputPlaceholder ?? title}
            className="mb-4 w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--br-amb)]"
            style={{
              border: '1px solid var(--br-bor)',
              background: 'var(--br-sur)',
              color: 'var(--br-txt)',
            }}
            autoFocus
          />
        )}

        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={onClose}>
            {cancelText}
          </Button>
          <Button
            variant={variantByType[type]}
            fullWidth
            onClick={() => onConfirm(inputField ? inputValue : undefined)}
            autoFocus={!inputField}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

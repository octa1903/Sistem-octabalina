import { useEffect } from 'react';
import { AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react';
import { Modal } from './Modal';

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

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !inputField) {
        e.preventDefault();
        onConfirm();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, inputField, onConfirm]);

  return (
    <Modal open={open} onClose={onClose} size="sm" closeOnOverlay={type !== 'danger'}>
      <div className="text-center">
        <div
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: palette.bg, color: palette.fg }}
        >
          <Icon className="h-7 w-7" />
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
            className="mb-4 w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
            style={{
              border: '1px solid var(--br-bor)',
              background: 'var(--br-sur)',
              color: 'var(--br-txt)',
            }}
            autoFocus
          />
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--br-sur2)]"
            style={{
              border: '1px solid var(--br-bor)',
              color: 'var(--br-txt)',
              background: 'var(--br-sur)',
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={() => onConfirm(inputField ? inputValue : undefined)}
            className="flex-1 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: palette.fg }}
            autoFocus={!inputField}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}

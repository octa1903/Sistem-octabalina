import { AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react';
import { Modal } from './Modal';
import { cn } from '@/utils/cn';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (inputValue?: string) => void;
  title: string;
  message: string;
  type?: 'danger' | 'warning' | 'info' | 'success';
  confirmText?: string;
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

const colorMap = {
  danger: 'text-red-600 bg-red-50',
  warning: 'text-amber-600 bg-amber-50',
  info: 'text-blue-600 bg-blue-50',
  success: 'text-green-600 bg-green-50',
};

const btnColorMap = {
  danger: 'bg-red-600 hover:bg-red-700',
  warning: 'bg-amber-600 hover:bg-amber-700',
  info: 'bg-blue-600 hover:bg-blue-700',
  success: 'bg-green-600 hover:bg-green-700',
};

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  type = 'info',
  confirmText = 'Confirmar',
  inputField,
  inputValue = '',
  inputPlaceholder,
  onInputChange,
}: ConfirmDialogProps) {
  const Icon = iconMap[type];

  return (
    <Modal open={open} onClose={onClose} size="sm">
      <div className="text-center">
        <div className={cn('mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full', colorMap[type])}>
          <Icon className="h-7 w-7" />
        </div>
        <h3 className="mb-2 text-lg font-semibold text-slate-800">{title}</h3>
        <p className="mb-6 text-sm text-slate-600">{message}</p>

        {inputField && onInputChange && (
          <input
            type="text"
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder={inputPlaceholder}
            className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            autoFocus
          />
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(inputField ? inputValue : undefined)}
            className={cn('flex-1 rounded-lg px-4 py-2 text-sm font-medium text-white', btnColorMap[type])}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}

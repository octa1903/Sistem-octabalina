import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/utils/cn';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  onClose: () => void;
  duration?: number;
}

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const styleMap: Record<NonNullable<ToastProps['type']>, { bg: string; bor: string; fg: string }> = {
  success: { bg: 'var(--br-grn-bg)', bor: 'var(--br-grn-bor)', fg: 'var(--br-grn)' },
  error: { bg: 'var(--br-red-bg)', bor: 'var(--br-red-bor)', fg: 'var(--br-red)' },
  warning: { bg: 'var(--br-amb-bg)', bor: 'var(--br-amb-bor)', fg: 'var(--br-amb)' },
  info: { bg: 'var(--br-info-bg)', bor: 'var(--br-info-bor)', fg: 'var(--br-info)' },
};

export function Toast({ message, type = 'info', onClose, duration = 4000 }: ToastProps) {
  const [visible, setVisible] = useState(true);
  const Icon = icons[type];
  const palette = styleMap[type];

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      className={cn(
        'fixed bottom-6 right-6 z-[60] flex items-center gap-3 rounded-lg px-4 py-3 transition-all',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
      )}
      style={{
        background: palette.bg,
        border: `1px solid ${palette.bor}`,
        color: palette.fg,
        boxShadow: 'var(--br-shadow-md)',
      }}
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      <p className="text-sm font-medium">{message}</p>
      <button
        onClick={() => {
          setVisible(false);
          setTimeout(onClose, 300);
        }}
        aria-label="Descartar notificación"
        className="ml-2 flex-shrink-0 opacity-70 hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// Toast manager hook
export function useToast() {
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: ToastProps['type'] }>>([]);

  const addToast = (message: string, type: ToastProps['type'] = 'info') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return { toasts, addToast, removeToast };
}

import { WifiOff, RefreshCw, AlertCircle } from 'lucide-react';
import type { OfflineQueueState } from '@/hooks/useOfflineQueue';

interface Props {
  state: OfflineQueueState;
}

/**
 * Banner sticky en el tope de la app cuando:
 *  - El browser está offline (sin red), o
 *  - Hay ops pendientes en la cola (aunque haya red, mientras se flushea).
 *
 * Si todo está sincronizado y online, no se muestra.
 */
export function OfflineBanner({ state }: Props) {
  const { online, pending, flushing } = state;

  if (online && pending === 0 && !flushing) return null;

  const bg = !online ? 'var(--br-amb)' : flushing ? 'var(--br-amb-bg)' : 'var(--br-grn-bg)';
  const fg = !online ? '#fff' : 'var(--br-txt)';

  const Icon = !online ? WifiOff : flushing ? RefreshCw : AlertCircle;

  let message: string;
  if (!online) {
    if (pending > 0) {
      message = `Sin conexión — ${pending} ${pending === 1 ? 'operación pendiente' : 'operaciones pendientes'} se sincronizarán al volver la red.`;
    } else {
      message = 'Sin conexión — las ventas se guardarán localmente hasta que vuelva la red.';
    }
  } else if (flushing) {
    message = `Sincronizando ${pending} ${pending === 1 ? 'operación pendiente' : 'operaciones pendientes'}...`;
  } else {
    message = `${pending} ${pending === 1 ? 'operación pendiente' : 'operaciones pendientes'} de sincronizar.`;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium"
      style={{ background: bg, color: fg, borderBottom: '1px solid rgba(0,0,0,0.1)' }}
    >
      <Icon className={`h-4 w-4 flex-shrink-0 ${flushing ? 'animate-spin' : ''}`} aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

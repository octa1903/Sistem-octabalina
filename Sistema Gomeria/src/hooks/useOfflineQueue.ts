import { useEffect, useState } from 'react';
import { offlineQueue } from '@/services/offlineQueue';
import { useOnlineStatus } from './useOnlineStatus';

export interface OfflineQueueState {
  /** True si el browser cree estar online. */
  online: boolean;
  /** Cantidad de ops esperando en cola. */
  pending: number;
  /** True mientras se está flusheando. */
  flushing: boolean;
  /** Última vez que el flush termino (epoch ms), o null si nunca corrió. */
  lastFlushAt: number | null;
  /** Resultado del último flush (para mostrar toast). */
  lastFlushResult: { processed: number; failed: number; remaining: number } | null;
}

/**
 * Hook centralizado para el estado de la cola offline:
 *  - Observa cambios en la cola (subscribe).
 *  - Cuando vuelve online y hay pendientes, dispara `flush()`.
 *  - Expone el estado para el banner.
 *
 * NO registra handlers — esa responsabilidad es de cada hook de dominio
 * que enqueue (ej. useReceiptCreate registra 'receipt.create' al montar).
 * Acá solo orquestamos el flush al detectar online=true.
 */
export function useOfflineQueue(): OfflineQueueState {
  const online = useOnlineStatus();
  const [pending, setPending] = useState<number>(() => offlineQueue.size());
  const [flushing, setFlushing] = useState(false);
  const [lastFlushAt, setLastFlushAt] = useState<number | null>(null);
  const [lastFlushResult, setLastFlushResult] = useState<
    { processed: number; failed: number; remaining: number } | null
  >(null);

  // Refresh pending count on any queue change
  useEffect(() => {
    const unsub = offlineQueue.subscribe(() => setPending(offlineQueue.size()));
    return unsub;
  }, []);

  // Auto-flush cuando volvemos online y hay pendientes
  useEffect(() => {
    if (!online) return;
    if (pending === 0) return;
    if (flushing) return;
    let cancelled = false;
    setFlushing(true);
    void offlineQueue
      .flush()
      .then((result) => {
        if (cancelled) return;
        setLastFlushAt(Date.now());
        setLastFlushResult(result);
      })
      .catch(() => {
        // El manager ya loggea internamente; nada que hacer acá.
      })
      .finally(() => {
        if (!cancelled) setFlushing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [online, pending, flushing]);

  return { online, pending, flushing, lastFlushAt, lastFlushResult };
}

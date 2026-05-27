/**
 * Cola persistente de operaciones a re-enviar a Supabase cuando vuelve la red.
 *
 * Diseño:
 *  - Las ops se serializan a localStorage para sobrevivir a un reload del POS.
 *  - Cada op tiene `id` (uuid), `kind` (etiqueta del tipo), `payload` (lo que
 *    necesita el sender para replicar la llamada), `enqueuedAt`, `attempts`.
 *  - El processor recibe un dispatcher async por `kind`; si tira error, la
 *    op queda en cola y se reintenta más adelante.
 *  - Cap defensivo: 1000 ops. Si se supera, las nuevas se rechazan con error
 *    visible al operador — significa que algo está mal con la red por
 *    horas/dias y conviene parar a investigar.
 *
 * Esta es la versión "light" del modo offline (sin Dexie). Las ops no son
 * idempotentes server-side por sí solas — el flush debe correr secuencial
 * y el caller tiene que saber que la op puede haber quedado encolada (no
 * romper el flujo con un toast de error inmediato).
 */

const STORAGE_KEY = 'octabalina.offlineQueue.v1';
const MAX_QUEUE = 1000;

export interface QueuedOp<T = unknown> {
  id: string;
  kind: string;
  payload: T;
  enqueuedAt: string;
  attempts: number;
  lastError?: string;
}

function readQueue(): QueuedOp[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedOp[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(ops: QueuedOp[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ops));
  } catch {
    // Storage full o disabled — no podemos hacer mucho. La op se pierde.
  }
}

function uuid(): string {
  // Browser-native; fallback simple si no está
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `op-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export type OpHandler<T = unknown> = (payload: T) => Promise<void>;

class OfflineQueueManager {
  private handlers = new Map<string, OpHandler>();
  private flushing = false;
  private listeners = new Set<() => void>();

  /**
   * Registra cómo procesar un `kind`. Llamar al iniciar la app desde el
   * setup principal (típicamente en App.tsx o en cada hook que use la cola).
   */
  registerHandler<T>(kind: string, handler: OpHandler<T>): void {
    this.handlers.set(kind, handler as OpHandler);
  }

  /**
   * Encola una op. Devuelve el id para que el caller pueda referenciarla.
   * Si la cola está llena, lanza error.
   */
  enqueue<T>(kind: string, payload: T): string {
    const queue = readQueue();
    if (queue.length >= MAX_QUEUE) {
      throw new Error(
        `Cola offline llena (${MAX_QUEUE} ops). Restaurá la conexión para sincronizar antes de hacer más operaciones.`,
      );
    }
    const op: QueuedOp<T> = {
      id: uuid(),
      kind,
      payload,
      enqueuedAt: new Date().toISOString(),
      attempts: 0,
    };
    queue.push(op);
    writeQueue(queue);
    this.notify();
    return op.id;
  }

  /**
   * Cantidad de ops pendientes (útil para el banner).
   */
  size(): number {
    return readQueue().length;
  }

  list(): QueuedOp[] {
    return readQueue();
  }

  /**
   * Suscribe a cambios (enqueue / flush). Devuelve función de desuscripción.
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const l of this.listeners) {
      try {
        l();
      } catch {
        // ignore listener errors
      }
    }
  }

  /**
   * Procesa la cola secuencialmente. Si una op falla, queda con `attempts++`
   * y `lastError`; el flush continúa con las siguientes (no se bloquea por
   * una sola op rota).
   *
   * Devuelve { processed, failed, remaining }.
   */
  async flush(): Promise<{ processed: number; failed: number; remaining: number }> {
    if (this.flushing) return { processed: 0, failed: 0, remaining: this.size() };
    this.flushing = true;
    try {
      let processed = 0;
      let failed = 0;
      const queue = readQueue();
      const survivors: QueuedOp[] = [];

      for (const op of queue) {
        const handler = this.handlers.get(op.kind);
        if (!handler) {
          // Handler no registrado para este kind → la dejamos en cola para
          // que el reload registre el handler y la procese luego.
          survivors.push(op);
          continue;
        }
        try {
          await handler(op.payload);
          processed++;
        } catch (e: unknown) {
          failed++;
          survivors.push({
            ...op,
            attempts: op.attempts + 1,
            lastError: e instanceof Error ? e.message : String(e),
          });
        }
      }
      writeQueue(survivors);
      this.notify();
      return { processed, failed, remaining: survivors.length };
    } finally {
      this.flushing = false;
    }
  }

  /** Elimina una op por id (útil para descartar manualmente). */
  remove(id: string): void {
    const queue = readQueue();
    const filtered = queue.filter((op) => op.id !== id);
    writeQueue(filtered);
    this.notify();
  }

  /** Vacía toda la cola — uso emergencia. */
  clear(): void {
    writeQueue([]);
    this.notify();
  }
}

export const offlineQueue = new OfflineQueueManager();

// ═══════════════════════════════════════════════════
// withTimeout — corta una promesa que tarda demasiado.
//
// Razón de ser: las llamadas de red (Supabase Auth, RPCs) pueden colgarse
// indefinidamente si no hay red o el server no responde. Sin un timeout,
// un `await` colgado deja la UI en un spinner eterno (pantalla "colgada"
// que solo se destraba recargando). Esto garantiza que SIEMPRE resolvemos
// o rechazamos en un tiempo acotado, para poder mostrar un error legible.
// ═══════════════════════════════════════════════════

export class TimeoutError extends Error {
  constructor(message = 'La operación tardó demasiado. Revisá tu conexión.') {
    super(message);
    this.name = 'TimeoutError';
  }
}

/** Default razonable para una llamada de auth/red en una LAN de gomería. */
export const DEFAULT_NETWORK_TIMEOUT_MS = 15_000;

/**
 * Devuelve una promesa que rechaza con TimeoutError si `promise` no
 * resolvió en `ms` milisegundos. La promesa original sigue su curso
 * (no se puede cancelar fetch acá), pero el caller deja de esperarla.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number = DEFAULT_NETWORK_TIMEOUT_MS,
  message?: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer)) as Promise<T>;
}

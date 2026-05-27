// ═══════════════════════════════════════════════════
// supabaseHelpers — utilidades compartidas
// ═══════════════════════════════════════════════════

import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';

/**
 * Lanza con un mensaje claro si Supabase devolvió error.
 * Loguea el detalle (code, hint) para debugging.
 */
export function ensureNoError<T>(
  data: T | null,
  error: PostgrestError | null,
  context: string,
): T {
  if (error) {
     
    console.error(`[supabase] ${context}:`, error.code, error.message, error.hint ?? '');
    throw new Error(`${context}: ${error.message}`);
  }
  if (data === null) {
    throw new Error(`${context}: respuesta vacía`);
  }
  return data;
}

/**
 * Convierte snake_case → camelCase para una clave individual.
 */
function toCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

/**
 * Convierte camelCase → snake_case para una clave individual.
 */
function toSnake(s: string): string {
  return s.replace(/([A-Z])/g, '_$1').toLowerCase();
}

/**
 * Mapea recursivamente las claves de un objeto. JSON values dentro de jsonb
 * se preservan tal cual (no se transforman).
 */
type Mapper = (k: string) => string;
function mapKeysShallow<T extends object>(obj: T, mapper: Mapper): Record<string, unknown> {
  if (Array.isArray(obj)) {
    // No transformar arrays (asumidos ser jsonb arrays o arrays primitivos)
    return obj as unknown as Record<string, unknown>;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[mapper(k)] = v;
  }
  return out;
}

/**
 * Convierte un row de Supabase (snake_case) a un objeto camelCase para el dominio.
 * Solo transforma las claves de primer nivel — los `jsonb` quedan intactos.
 */
export function rowToCamel<T extends object>(row: Record<string, unknown>): T {
  return mapKeysShallow(row, toCamel) as T;
}

/**
 * Convierte un objeto camelCase a snake_case para enviar a Supabase.
 *
 * Retorna `any` deliberadamente: los tipos generados por `supabase gen types`
 * usan `RejectExcessProperties` y cada Insert/Update tiene una forma exacta
 * por tabla. Si tipáramos esto como `Record<string, unknown>`, todos los
 * `.insert(camelToRow(...))` chocarían con la firma exacta. La capa de
 * runtime ya garantiza que las claves matchean (y RLS/Postgres son la
 * fuente de verdad si algo se desvía).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function camelToRow(obj: Record<string, unknown>): any {
  return mapKeysShallow(obj, toSnake);
}

/**
 * Filtra propiedades undefined antes de mandar a Supabase (no sobreescribir
 * columnas con NULL). Retorna `any` por la misma razón que camelToRow.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function stripUndefined<T extends Record<string, unknown>>(obj: T): any {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

// ─── Paginación ───────────────────────────────────────────────────
// PostgREST en Supabase aplica `max-rows = 1000` por defecto. Un
// `.select()` plano de una tabla con >1000 filas devuelve solo las
// primeras 1000, sin error. Para tablas que pueden crecer (tires,
// receipts, customers en cuenta corriente, overrides), usar este
// helper con `.range(from, to)` para traer todo en batches.

const PAGE_SIZE = 1000;

/**
 * Pagina sobre cualquier query builder de Supabase aplicando `.range()`
 * hasta que un batch venga con menos filas que `PAGE_SIZE`. El builder
 * se reconstruye en cada batch via `buildQuery()` porque PostgREST
 * consume el builder en cada `await`.
 *
 * Ejemplo:
 * ```ts
 * const all = await fetchAllPaginated<TireRow>(() =>
 *   supabase.from('tires').select('id, brand, model, size').order('brand'),
 *   'tires.listAll',
 * );
 * ```
 */
export async function fetchAllPaginated<T>(
  // El builder de PostgREST es un thenable con tipos genéricos profundos.
  // No vale la pena replicar su shape exacta acá; el caller infiere T del select().
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildQuery: () => any,
  context: string,
): Promise<T[]> {
  const out: T[] = [];
  let from = 0;
  // Cap defensivo: 100 páginas = 100k filas. Si lo superás, hay algo raro
  // y mejor un timeout que un loop infinito.
  for (let page = 0; page < 100; page++) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await buildQuery().range(from, to);
    if (error) {
       
      console.error(`[supabase paginate] ${context}:`, error.code, error.message, error.hint ?? '');
      throw new Error(`${context}: ${error.message}`);
    }
    const batch = data ?? [];
    out.push(...batch);
    if (batch.length < PAGE_SIZE) return out;
    from += PAGE_SIZE;
  }
  throw new Error(`${context}: superado el límite de paginación (100k filas)`);
}

// ─── RPCs no-tipados ──────────────────────────────────────────────
// El cliente Supabase está tipado con `Database`, que solo conoce las
// RPCs declaradas en `types/database.ts`. Las RPCs nuevas (reports,
// bulk_adjust_tire_prices, customer_create_order, etc.) viven en
// migraciones aún no regeneradas — por eso `supabase.rpc('foo', ...)`
// falla en compile-time. Este helper centraliza el cast pragmático
// con un retorno tipado por el caller, evitando `as any` regado por
// los services.
//
// Cuando regen-types reescriba `database.ts` con las funciones, este
// helper sigue funcionando idéntico pero ya queda redundante para
// las RPCs cubiertas.
 
const untypedRpc = supabase.rpc as unknown as (
  fn: string,
  args?: Record<string, unknown>,
) => Promise<{ data: unknown; error: PostgrestError | null }>;

export async function callUntypedRpc<T>(
  fn: string,
  args: Record<string, unknown>,
  context = fn,
): Promise<T> {
  const { data, error } = await untypedRpc(fn, args);
  if (error) {
     
    console.error(`[supabase rpc] ${context}:`, error.code, error.message, error.hint ?? '');
    throw new Error(`${context}: ${error.message}`);
  }
  return data as T;
}


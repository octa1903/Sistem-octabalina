// ═══════════════════════════════════════════════════
// supabaseHelpers — utilidades compartidas
// ═══════════════════════════════════════════════════

import type { PostgrestError } from '@supabase/supabase-js';

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
    // eslint-disable-next-line no-console
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
 */
export function camelToRow(obj: Record<string, unknown>): Record<string, unknown> {
  return mapKeysShallow(obj, toSnake);
}

/**
 * Filtra propiedades undefined de un objeto antes de mandarlo a Supabase
 * (para no sobreescribir columnas con NULL accidentalmente).
 */
export function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as T;
}

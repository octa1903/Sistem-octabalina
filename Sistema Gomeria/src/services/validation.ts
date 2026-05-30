// ═══════════════════════════════════════════════════
// validation — validación lenient de rows en los bordes (Zod)
// ═══════════════════════════════════════════════════
//
// Los services confían en que Supabase devuelve la forma esperada y hacen
// `rowToCamel<T>(row)` (un cast sin chequeo). Con ~185k filas de data legacy
// importada, un row malformado se propaga en silencio hasta romper la UI lejos
// del origen. Estos helpers validan en el borde — DESPUÉS de camelizar, sobre
// la forma de dominio (camelCase), alineada a los tipos de `types/index.ts`.
//
// ── Estrategia: lenient ──────────────────────────────────────────────
// Coherente con el barrido defensivo (toMoney, ErrorBoundary): un row inválido
// NUNCA tira una pantalla en blanco. `validateRows` filtra los inválidos y sigue
// con los buenos; `validateRow` degrada a undefined. En ambos casos se loguea un
// warning con el detalle del primer issue para que el problema quede visible en
// consola y se arregle después, sin tumbar la vista.
//
// Los schemas usan `.loose()` (preservan props extra): solo validamos los campos
// que la UI realmente consume; columnas nuevas o no schematizadas pasan intactas.

import { z } from 'zod';

/**
 * Resume el primer issue de un ZodError en una línea legible para el log.
 * Ej: "total: expected number, received string".
 */
function describeIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return 'forma inválida';
  const path = issue.path.length > 0 ? issue.path.join('.') : '(raíz)';
  return `${path}: ${issue.message}`;
}

// Los schemas validan un SUBCONJUNTO crítico de campos y usan `.loose()`, por lo
// que su `_output` no equivale al tipo de dominio completo (`TireV2`, `Receipt`,
// …): faltan los campos no schematizados, que igual pasan intactos en runtime.
// Por eso el caller declara la forma de dominio `T` y el cast (justificado por
// `.loose()`) ocurre una sola vez acá, no regado por los services.
import type { ZodTypeAny } from 'zod';

/**
 * Valida un único row ya camelizado contra `schema`. Lenient: si no matchea,
 * loguea un warning y devuelve `undefined` (la vista trata el row como ausente,
 * no crashea). Si `row` es null/undefined, devuelve undefined sin ruido.
 */
export function validateRow<T>(
  schema: ZodTypeAny,
  row: unknown,
  context: string,
): T | undefined {
  if (row === null || row === undefined) return undefined;
  const result = schema.safeParse(row);
  if (result.success) return result.data as T;

  console.warn(`[validation] ${context}: row descartado — ${describeIssue(result.error)}`);
  return undefined;
}

/**
 * Valida un array de rows ya camelizados. Lenient: descarta los inválidos,
 * conserva los válidos, y loguea un único warning con el conteo y el primer
 * detalle (evita inundar la consola cuando hay basura legacy masiva).
 */
export function validateRows<T>(
  schema: ZodTypeAny,
  rows: readonly unknown[],
  context: string,
): T[] {
  const out: T[] = [];
  let firstIssue: string | null = null;
  let dropped = 0;
  for (const row of rows) {
    const result = schema.safeParse(row);
    if (result.success) {
      out.push(result.data as T);
    } else {
      dropped++;
      if (firstIssue === null) firstIssue = describeIssue(result.error);
    }
  }
  if (dropped > 0) {

    console.warn(
      `[validation] ${context}: ${dropped}/${rows.length} rows descartados — primer error: ${firstIssue}`,
    );
  }
  return out;
}

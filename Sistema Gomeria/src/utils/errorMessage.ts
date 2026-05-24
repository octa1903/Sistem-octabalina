// ═══════════════════════════════════════════════════
// errorMessage — extrae mensaje legible de cualquier error.
//
// Existe porque PostgrestError de @supabase/supabase-js es un POJO
// (no `instanceof Error`) con `code`, `message`, `details`, `hint`.
// Sin esto, errores de Supabase caen en el branch genérico y aparecen
// como "Error desconocido" en resúmenes de import o toasts.
// ═══════════════════════════════════════════════════

/**
 * Convierte cualquier valor lanzado (Error, PostgrestError, string, etc.)
 * a un mensaje legible. Para PostgrestError concatena `[code] message (details) hint: ...`.
 */
export function describeError(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object') {
    const obj = e as { code?: string; message?: string; details?: string; hint?: string };
    const parts: string[] = [];
    if (obj.code) parts.push(`[${obj.code}]`);
    if (obj.message) parts.push(obj.message);
    if (obj.details) parts.push(`(${obj.details})`);
    if (obj.hint) parts.push(`hint: ${obj.hint}`);
    if (parts.length > 0) return parts.join(' ');
    try { return JSON.stringify(e); } catch { return 'Error desconocido'; }
  }
  return typeof e === 'string' ? e : 'Error desconocido';
}

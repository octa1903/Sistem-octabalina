// Helpers para gestionar import_batches + bulk inserts con chunks.
import { admin } from './supabaseAdmin';

export async function createBatch(source: string, notes?: string): Promise<string> {
  const { data, error } = await admin
    .from('import_batches')
    .insert({ source, notes, status: 'running' })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function finishBatch(
  batchId: string,
  status: 'completed' | 'failed' | 'rolled_back',
  stats: { total?: number; inserted?: number; skipped?: number; errors?: unknown[] } = {},
): Promise<void> {
  await admin
    .from('import_batches')
    .update({
      status,
      finished_at: new Date().toISOString(),
      total_rows: stats.total ?? 0,
      inserted_rows: stats.inserted ?? 0,
      skipped_rows: stats.skipped ?? 0,
      errors: (stats.errors ?? []) as never,
    })
    .eq('id', batchId);
}

/**
 * Inserta filas en chunks. Devuelve cuántas se insertaron exitosamente
 * y la lista de errores por chunk.
 */
export async function bulkInsert<T extends Record<string, unknown>>(
  table: string,
  rows: T[],
  chunkSize = 500,
): Promise<{ inserted: number; errors: unknown[] }> {
  let inserted = 0;
  const errors: unknown[] = [];
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error, count } = await (admin.from(table) as any).insert(chunk, { count: 'exact' });
    if (error) {
      errors.push({ chunk: i, message: error.message, code: error.code, details: error.details });
      // eslint-disable-next-line no-console
      console.error(`[bulk] ${table} chunk ${i}: ${error.message}`);
    } else {
      inserted += count ?? chunk.length;
    }
  }
  return { inserted, errors };
}

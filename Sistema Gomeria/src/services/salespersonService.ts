import { supabase } from './supabaseClient';
import { ensureNoError, rowToCamel, camelToRow } from './supabaseHelpers';
import type { Salesperson } from '@/types';

const TABLE = 'salespeople';

export const salespersonService = {
  async getAll(opts: { activeOnly?: boolean; storeId?: string } = {}): Promise<Salesperson[]> {
    let q = supabase.from(TABLE).select('*').order('name', { ascending: true });
    if (opts.activeOnly) q = q.eq('active', true);
    if (opts.storeId) q = q.or(`store_id.eq.${opts.storeId},store_id.is.null`);
    const { data, error } = await q;
    return ensureNoError(data, error, 'salespersonService.getAll').map(r =>
      rowToCamel<Salesperson>(r),
    );
  },

  async getById(id: string): Promise<Salesperson | undefined> {
    const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? rowToCamel<Salesperson>(data) : undefined;
  },

  async save(s: Omit<Salesperson, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Salesperson> {
    const payload = camelToRow(s as unknown as Record<string, unknown>);
    const { data, error } = s.id
      ? await supabase.from(TABLE).update(payload).eq('id', s.id).select().single()
      : await supabase.from(TABLE).insert(payload).select().single();
    return rowToCamel<Salesperson>(
      ensureNoError(data, error, 'salespersonService.save'),
    );
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) throw error;
  },
};

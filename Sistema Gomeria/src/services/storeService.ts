import { supabase } from './supabaseClient';
import { ensureNoError, rowToCamel, camelToRow, stripUndefined } from './supabaseHelpers';
import type { Store } from '@/types';

const TABLE = 'stores';

export const storeService = {
  async getAll(): Promise<Store[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('name', { ascending: true });
    return ensureNoError(data, error, 'storeService.getAll').map(r => rowToCamel<Store>(r));
  },

  async getById(id: string): Promise<Store | undefined> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToCamel<Store>(data) : undefined;
  },

  async getActive(): Promise<Store[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('active', true)
      .order('name', { ascending: true });
    return ensureNoError(data, error, 'storeService.getActive').map(r => rowToCamel<Store>(r));
  },

  async save(store: Partial<Store> & { name: string }): Promise<Store> {
    const payload = stripUndefined(camelToRow(store as Record<string, unknown>));
    if (store.id) {
      const { data, error } = await supabase
        .from(TABLE)
        .update(payload)
        .eq('id', store.id)
        .select()
        .single();
      return rowToCamel<Store>(ensureNoError(data, error, 'storeService.save(update)'));
    }
    const { data, error } = await supabase
      .from(TABLE)
      .insert(payload)
      .select()
      .single();
    return rowToCamel<Store>(ensureNoError(data, error, 'storeService.save(insert)'));
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) throw error;
  },
};

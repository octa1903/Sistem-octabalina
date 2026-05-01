import { supabase } from './supabaseClient';
import { ensureNoError, rowToCamel, camelToRow, stripUndefined } from './supabaseHelpers';
import type { Tax } from '@/types';

const TABLE = 'taxes';

export const taxService = {
  async getAll(): Promise<Tax[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('name', { ascending: true });
    return ensureNoError(data, error, 'taxService.getAll').map(r => rowToCamel<Tax>(r));
  },

  async getById(id: string): Promise<Tax | undefined> {
    const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? rowToCamel<Tax>(data) : undefined;
  },

  async save(tax: Partial<Tax> & { name: string; rate: number; inclusion: 'included' | 'added' }): Promise<Tax> {
    const payload = stripUndefined(camelToRow(tax as Record<string, unknown>));
    if (tax.id) {
      const { data, error } = await supabase
        .from(TABLE)
        .update(payload)
        .eq('id', tax.id)
        .select()
        .single();
      return rowToCamel<Tax>(ensureNoError(data, error, 'taxService.save(update)'));
    }
    const { data, error } = await supabase
      .from(TABLE)
      .insert(payload)
      .select()
      .single();
    return rowToCamel<Tax>(ensureNoError(data, error, 'taxService.save(insert)'));
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) throw error;
  },

  /**
   * Devuelve los IDs de impuestos con apply_to_new_tires=true. Usado al crear
   * un tire nuevo para que herede automáticamente los impuestos default.
   */
  async getDefaultsForNewTire(): Promise<string[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('id')
      .eq('apply_to_new_tires', true);
    if (error) throw error;
    return (data ?? []).map(r => r.id);
  },
};

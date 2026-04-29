import { supabase } from './supabaseClient';
import { ensureNoError, rowToCamel, camelToRow, stripUndefined } from './supabaseHelpers';
import type { Category } from '@/types';

const TABLE = 'categories';

export const categoryService = {
  async getAll(): Promise<Category[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('sort_order', { ascending: true });
    return ensureNoError(data, error, 'categoryService.getAll').map(r => rowToCamel<Category>(r));
  },

  async getByName(name: string): Promise<Category | undefined> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('name', name)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToCamel<Category>(data) : undefined;
  },

  async getById(id: string): Promise<Category | undefined> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToCamel<Category>(data) : undefined;
  },

  async save(category: Partial<Category> & { name: string }): Promise<Category> {
    const payload = stripUndefined(camelToRow(category as Record<string, unknown>));
    if (category.id) {
      const { data, error } = await supabase
        .from(TABLE)
        .update(payload)
        .eq('id', category.id)
        .select()
        .single();
      return rowToCamel<Category>(ensureNoError(data, error, 'categoryService.save(update)'));
    }
    const { data, error } = await supabase
      .from(TABLE)
      .insert(payload)
      .select()
      .single();
    return rowToCamel<Category>(ensureNoError(data, error, 'categoryService.save(insert)'));
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) throw error;
  },

  /**
   * Resuelve nombre de categoría legacy (v1) a id de categoría v2.
   * Usado por el migrador y por servicios que mapean v2→v1.
   */
  async resolveLegacyName(legacyName: string): Promise<string> {
    const c = await this.getByName(legacyName);
    if (!c) throw new Error(`Categoría legacy "${legacyName}" no encontrada en v2`);
    return c.id;
  },
};

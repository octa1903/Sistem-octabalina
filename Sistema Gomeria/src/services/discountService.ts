import { supabase } from './supabaseClient';
import { ensureNoError, rowToCamel, camelToRow, stripUndefined } from './supabaseHelpers';
import type { Discount } from '@/types';

const TABLE = 'discounts';

export const discountService = {
  async getAll(): Promise<Discount[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('name', { ascending: true });
    return ensureNoError(data, error, 'discountService.getAll').map(r => rowToCamel<Discount>(r));
  },

  async getForStore(storeId: string): Promise<Discount[]> {
    const all = await this.getAll();
    return all.filter(d => d.storeIds === null || d.storeIds.includes(storeId));
  },

  async getById(id: string): Promise<Discount | undefined> {
    const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? rowToCamel<Discount>(data) : undefined;
  },

  async save(
    discount: Partial<Discount> & { name: string; type: 'percent' | 'amount' },
  ): Promise<Discount> {
    const payload = stripUndefined(camelToRow(discount as Record<string, unknown>));
    if (discount.id) {
      const { data, error } = await supabase
        .from(TABLE)
        .update(payload)
        .eq('id', discount.id)
        .select()
        .single();
      return rowToCamel<Discount>(ensureNoError(data, error, 'discountService.save(update)'));
    }
    const { data, error } = await supabase
      .from(TABLE)
      .insert(payload)
      .select()
      .single();
    return rowToCamel<Discount>(ensureNoError(data, error, 'discountService.save(insert)'));
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) throw error;
  },
};

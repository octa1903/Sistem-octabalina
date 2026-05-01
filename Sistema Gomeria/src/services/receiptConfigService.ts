import { supabase } from './supabaseClient';
import { rowToCamel, camelToRow, stripUndefined } from './supabaseHelpers';
import type { ReceiptConfig } from '@/types';

const TABLE = 'receipt_config';

export const receiptConfigService = {
  async getByStore(storeId: string): Promise<ReceiptConfig | null> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('store_id', storeId)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToCamel<ReceiptConfig>(data) : null;
  },

  async save(config: ReceiptConfig): Promise<ReceiptConfig> {
    const payload = stripUndefined(camelToRow(config as unknown as Record<string, unknown>));
    const { data, error } = await supabase
      .from(TABLE)
      .upsert(payload, { onConflict: 'store_id' })
      .select()
      .single();
    if (error) throw error;
    return rowToCamel<ReceiptConfig>(data);
  },
};

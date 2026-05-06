// ═══════════════════════════════════════════════════
// wholesaleConfigService — singleton de config mayorista (Fase 6).
// Tabla: wholesale_config (singleton con singleton=true, 0001_init.sql).
// ═══════════════════════════════════════════════════

import { supabase } from './supabaseClient';
import type { WholesaleConfig } from '@/types';
import { DEFAULT_WHOLESALE_CONFIG } from '@/constants';

const TABLE = 'wholesale_config';

function rowToConfig(row: Record<string, unknown>): WholesaleConfig {
  return {
    globalDiscount: Number(row.global_discount),
    minUnitsPerItem: row.min_units_per_item as number,
    minOrderAmount: Number(row.min_order_amount),
  };
}

export const wholesaleConfigService = {
  async get(): Promise<WholesaleConfig> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`wholesaleConfigService.get: ${error.message}`);
    if (!data) return { ...DEFAULT_WHOLESALE_CONFIG };
    return rowToConfig(data as unknown as Record<string, unknown>);
  },

  async save(config: WholesaleConfig): Promise<void> {
    const payload = {
      singleton: true,
      global_discount: config.globalDiscount,
      min_units_per_item: config.minUnitsPerItem,
      min_order_amount: config.minOrderAmount,
    };
    const { error } = await supabase
      .from(TABLE)
      .upsert(payload, { onConflict: 'singleton' });
    if (error) throw new Error(`wholesaleConfigService.save: ${error.message}`);
  },
};

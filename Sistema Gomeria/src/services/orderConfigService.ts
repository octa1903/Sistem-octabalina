// ═══════════════════════════════════════════════════
// orderConfigService — singleton de configuración de pedidos online (Fase 6).
// Tabla: order_config (singleton con singleton=true, 0001_init.sql).
// ═══════════════════════════════════════════════════

import { supabase } from './supabaseClient';
import type { OrderConfig } from '@/types';
import { DEFAULT_ORDER_CONFIG } from '@/constants';

const TABLE = 'order_config';

function rowToConfig(row: Record<string, unknown>): OrderConfig {
  return {
    enabled: row.enabled as boolean,
    workDays: row.work_days as boolean[],
    blockedDates: (row.blocked_dates as string[]) ?? [],
    minDaysAhead: row.min_days_ahead as number,
    maxDaysAhead: row.max_days_ahead as number,
    timeSlots: row.time_slots as string[],
    maxOrdersPerDay: row.max_orders_per_day as number,
  };
}

export const orderConfigService = {
  async get(): Promise<OrderConfig> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`orderConfigService.get: ${error.message}`);
    if (!data) return { ...DEFAULT_ORDER_CONFIG };
    return rowToConfig(data as unknown as Record<string, unknown>);
  },

  async save(config: OrderConfig): Promise<void> {
    const payload = {
      singleton: true,
      enabled: config.enabled,
      work_days: config.workDays,
      blocked_dates: config.blockedDates,
      min_days_ahead: config.minDaysAhead,
      max_days_ahead: config.maxDaysAhead,
      time_slots: config.timeSlots,
      max_orders_per_day: config.maxOrdersPerDay,
    };
    const { error } = await supabase
      .from(TABLE)
      .upsert(payload, { onConflict: 'singleton' });
    if (error) throw new Error(`orderConfigService.save: ${error.message}`);
  },
};

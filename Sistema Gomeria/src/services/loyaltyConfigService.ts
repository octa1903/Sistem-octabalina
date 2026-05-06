// ═══════════════════════════════════════════════════
// loyaltyConfigService — singleton de configuración del programa de
// puntos. Tabla: loyalty_config (singleton=true, 0001_init.sql).
//
// Reglas:
//   - earnPercent: % del subtotal neto que se acumula como puntos por venta
//     a un cliente identificado.
//   - Redención: 1 punto = $1 al canjear (regla simple en Fase 5; la
//     UI del POS aplica el monto redimido como descuento previo a IVA y
//     surcharge).
// ═══════════════════════════════════════════════════

import { supabase } from './supabaseClient';
import type { LoyaltyConfig } from '@/types';

const TABLE = 'loyalty_config';

const DEFAULT_LOYALTY: LoyaltyConfig = { enabled: false, earnPercent: 0 };

export const loyaltyConfigService = {
  async get(): Promise<LoyaltyConfig> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .maybeSingle();
    if (error) throw new Error(`loyaltyConfigService.get: ${error.message}`);
    if (!data) return { ...DEFAULT_LOYALTY };
    return {
      enabled: data.enabled,
      earnPercent: Number(data.earn_percent ?? 0),
    };
  },

  async save(config: LoyaltyConfig): Promise<void> {
    const payload = {
      singleton: true,
      enabled: config.enabled,
      earn_percent: config.earnPercent,
    };
    const { error } = await supabase
      .from(TABLE)
      .upsert(payload, { onConflict: 'singleton' });
    if (error) throw new Error(`loyaltyConfigService.save: ${error.message}`);
  },
};

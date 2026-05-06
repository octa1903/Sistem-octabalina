// ═══════════════════════════════════════════════════
// customerSelfService — lecturas del portal cliente.
//
// Wraps los RPCs SECURITY DEFINER definidos en 0009_customer_self_rpcs.sql.
// El cliente del portal no tiene sesión Supabase Auth — todas las lecturas
// pasan por estos RPCs validando un token de sesión emitido por
// customer_login (0008).
// ═══════════════════════════════════════════════════

import { supabase } from './supabaseClient';
import { rowToCamel } from './supabaseHelpers';
import { toLegacyOrder } from './orderService';
import type { Customer, CustomerAccountMovement, Order, Receipt, ReceiptLine } from '@/types';

// Cast pragmático: las RPCs nuevas no están en database.ts hasta regen.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = supabase.rpc as any;

export const customerSelfService = {
  async getProfile(token: string): Promise<Customer | null> {
    const { data, error } = await rpc('customer_self_profile', { p_token: token });
    if (error) throw error;
    const rows = (Array.isArray(data) ? data : data ? [data] : []) as Record<string, unknown>[];
    if (rows.length === 0) return null;
    return rowToCamel<Customer>(rows[0]);
  },

  async getMovements(token: string, limit = 50): Promise<CustomerAccountMovement[]> {
    const { data, error } = await rpc('customer_self_movements', { p_token: token, p_limit: limit });
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map(r => rowToCamel<CustomerAccountMovement>(r));
  },

  async getReceipts(token: string, limit = 50): Promise<Receipt[]> {
    const { data, error } = await rpc('customer_self_receipts', { p_token: token, p_limit: limit });
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map(r => rowToCamel<Receipt>(r));
  },

  async getOrders(token: string, limit = 100): Promise<Order[]> {
    const { data, error } = await rpc('customer_self_orders', { p_token: token, p_limit: limit });
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map(r => toLegacyOrder(r));
  },

  async getReceiptLines(token: string, receiptIds: string[]): Promise<Map<string, ReceiptLine[]>> {
    if (receiptIds.length === 0) return new Map();
    const { data, error } = await rpc('customer_self_receipt_lines', {
      p_token: token,
      p_receipt_ids: receiptIds,
    });
    if (error) throw error;
    const map = new Map<string, ReceiptLine[]>();
    for (const row of (data ?? []) as Record<string, unknown>[]) {
      const line = rowToCamel<ReceiptLine>(row);
      const list = map.get(line.receiptId) ?? [];
      list.push(line);
      map.set(line.receiptId, list);
    }
    return map;
  },
};

// ═══════════════════════════════════════════════════
// supplierInvoiceService — CRUD de facturas a proveedores (Fase 6).
// Tabla: supplier_invoices (definida en 0001_init.sql).
// ═══════════════════════════════════════════════════

import { supabase } from './supabaseClient';
import { ensureNoError, rowToCamel, camelToRow, stripUndefined } from './supabaseHelpers';
import type { SupplierInvoice, SupplierInvoiceItem } from '@/types';

const TABLE = 'supplier_invoices';

export interface SaveSupplierInvoiceInput {
  id?: string;
  type: 'A' | 'B' | 'C' | 'X';
  number: string;
  supplier: string;
  date: string;
  dueDate?: string;
  items: SupplierInvoiceItem[];
  paid: boolean;
  notes?: string;
  storeId?: string;
}

/** Calcula subtotal/iva/total a partir de los ítems y el tipo de factura. */
export function rollupSupplierInvoice(items: SupplierInvoiceItem[], type: 'A' | 'B' | 'C' | 'X'): {
  subtotal: number;
  iva: number;
  total: number;
} {
  const subtotal = items.reduce((s, it) => s + it.subtotal, 0);
  const iva = type === 'A' ? subtotal * 0.21 : 0;
  return { subtotal, iva, total: subtotal + iva };
}

export const supplierInvoiceService = {
  async getAll(): Promise<SupplierInvoice[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('date', { ascending: false });
    return ensureNoError(data, error, 'supplierInvoiceService.getAll').map(r => rowToCamel<SupplierInvoice>(r));
  },

  async save(input: SaveSupplierInvoiceInput): Promise<SupplierInvoice> {
    const items = input.items.map(it => ({ ...it, subtotal: it.quantity * it.unitPrice }));
    const totals = rollupSupplierInvoice(items, input.type);
    const payload = stripUndefined(camelToRow({
      type: input.type,
      number: input.number,
      supplier: input.supplier,
      date: input.date,
      dueDate: input.dueDate ?? null,
      items,
      subtotal: totals.subtotal,
      iva: totals.iva,
      total: totals.total,
      paid: input.paid,
      notes: input.notes ?? null,
      storeId: input.storeId ?? null,
    }));
    if (input.id) {
      const { data, error } = await supabase
        .from(TABLE)
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', input.id)
        .select()
        .single();
      return rowToCamel<SupplierInvoice>(ensureNoError(data, error, 'supplierInvoiceService.save(update)'));
    }
    const { data, error } = await supabase
      .from(TABLE)
      .insert(payload)
      .select()
      .single();
    return rowToCamel<SupplierInvoice>(ensureNoError(data, error, 'supplierInvoiceService.save(insert)'));
  },

  async setPaid(id: string, paid: boolean): Promise<void> {
    const { error } = await supabase
      .from(TABLE)
      .update({ paid, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) throw error;
  },
};

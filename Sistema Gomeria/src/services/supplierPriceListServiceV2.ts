// ═══════════════════════════════════════════════════
// supplierPriceListServiceV2 — snapshots de listas de precios de
// proveedores + histórico de costos.
//
// Tablas: supplier_price_lists, supplier_price_list_items (0032).
// Vista:  tire_latest_cost.
//
// Flujo de import:
//   1. Validar input (moneda USD requiere exchangeRateId).
//   2. Insertar header en supplier_price_lists.
//   3. Para cada item: matchear contra `tires` (size + brand + model
//      fuzzy) → tire_id. Calcular cost_ars (= cost_original si ARS,
//      cost_original * rate si USD).
//   4. Bulk-insert items.
//   5. Actualizar `tires.cost` con el cost_ars de los items matcheados
//      (mantiene compat con UI legacy que lee tires.cost).
//   6. Devolver { listId, matched, unmatched }.
// ═══════════════════════════════════════════════════

import { supabase } from './supabaseClient';
import { ensureNoError } from './supabaseHelpers';
import { exchangeRateService } from './exchangeRateServiceV2';
import type {
  SupplierPriceList,
  SupplierPriceListItem,
  SupplierListCurrency,
  TireLatestCost,
} from '@/types';

// ─── Lógica pura ─────────────────────────────────────────────────────

export interface RawImportItem {
  rawSku?: string;
  rawSize: string;
  rawBrand?: string;
  rawModel?: string;
  costOriginal: number;
  priceSuggested?: number;
  /** Si ya fue matcheado en una capa anterior (bulkInsertTires), pasarlo acá. */
  tireId?: string;
}

/**
 * Calcula el cost_ars de un item según la moneda de la lista.
 * Para ARS, cost_ars = cost_original.
 * Para USD, cost_ars = cost_original * rate (redondeado a centavos).
 */
export function calcCostArs(
  costOriginal: number,
  currency: SupplierListCurrency,
  rate: number | null,
): number {
  if (!Number.isFinite(costOriginal) || costOriginal < 0) {
    throw new Error('calcCostArs: costOriginal debe ser >= 0');
  }
  if (currency === 'ARS') return Math.round(costOriginal * 100) / 100;
  // USD
  if (rate === null || !Number.isFinite(rate) || rate <= 0) {
    throw new Error('calcCostArs: USD requiere rate > 0');
  }
  return Math.round(costOriginal * rate * 100) / 100;
}

/**
 * Valida los inputs antes de tocar la DB. Devuelve los errores como array
 * (vacío si todo OK) para que el caller pueda mostrarlos sin throwear en
 * el medio de un import grande.
 */
export function validateImportInput(input: ImportPriceListInput): string[] {
  const errors: string[] = [];
  if (!input.supplierName.trim()) errors.push('supplierName requerido');
  if (!input.listName.trim()) errors.push('listName requerido');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveDate)) {
    errors.push('effectiveDate inválida (YYYY-MM-DD)');
  }
  if (input.currency === 'USD' && !input.exchangeRateId) {
    errors.push('USD requiere exchangeRateId');
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    errors.push('items vacío');
  } else {
    for (let i = 0; i < input.items.length; i++) {
      const it = input.items[i];
      if (!it.rawSize?.trim()) errors.push(`items[${i}].rawSize requerido`);
      if (!Number.isFinite(it.costOriginal) || it.costOriginal < 0) {
        errors.push(`items[${i}].costOriginal inválido`);
      }
    }
  }
  return errors;
}

// ─── Tipos de row para mapeo ─────────────────────────────────────────

interface SupplierPriceListRow {
  id: string;
  supplier_id: string | null;
  supplier_name: string;
  list_name: string;
  currency: string;
  exchange_rate_id: string | null;
  effective_date: string;
  imported_at: string;
  imported_by: string | null;
  row_count: number;
  notes: string | null;
}

interface SupplierPriceListItemRow {
  id: string;
  price_list_id: string;
  tire_id: string | null;
  raw_sku: string | null;
  raw_size: string;
  raw_brand: string | null;
  raw_model: string | null;
  cost_original: number | string;
  cost_ars: number | string;
  price_suggested: number | string | null;
  created_at: string;
}

interface TireLatestCostRow {
  tire_id: string;
  cost_ars: number | string;
  cost_original: number | string;
  currency: string;
  effective_date: string;
  supplier_name: string;
  list_name: string;
  exchange_rate_id: string | null;
}

function rowToList(row: SupplierPriceListRow): SupplierPriceList {
  return {
    id: row.id,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    listName: row.list_name,
    currency: row.currency as SupplierListCurrency,
    exchangeRateId: row.exchange_rate_id,
    effectiveDate: row.effective_date,
    importedAt: row.imported_at,
    importedBy: row.imported_by,
    rowCount: row.row_count,
    notes: row.notes,
  };
}

function rowToItem(row: SupplierPriceListItemRow): SupplierPriceListItem {
  return {
    id: row.id,
    priceListId: row.price_list_id,
    tireId: row.tire_id,
    rawSku: row.raw_sku,
    rawSize: row.raw_size,
    rawBrand: row.raw_brand,
    rawModel: row.raw_model,
    costOriginal: Number(row.cost_original),
    costArs: Number(row.cost_ars),
    priceSuggested: row.price_suggested === null ? null : Number(row.price_suggested),
    createdAt: row.created_at,
  };
}

function rowToLatestCost(row: TireLatestCostRow): TireLatestCost {
  return {
    tireId: row.tire_id,
    costArs: Number(row.cost_ars),
    costOriginal: Number(row.cost_original),
    currency: row.currency as SupplierListCurrency,
    effectiveDate: row.effective_date,
    supplierName: row.supplier_name,
    listName: row.list_name,
    exchangeRateId: row.exchange_rate_id,
  };
}

// ─── Service ─────────────────────────────────────────────────────────

export interface ImportPriceListInput {
  supplierId?: string;
  supplierName: string;
  listName: string;
  currency: SupplierListCurrency;
  exchangeRateId?: string;
  effectiveDate: string; // YYYY-MM-DD
  notes?: string;
  items: RawImportItem[];
}

export interface ImportPriceListResult {
  listId: string;
  matched: number;
  unmatched: number;
  rowCount: number;
}

export const supplierPriceListService = {
  /**
   * Importa una lista de precios completa.
   * No hace matching de tires por ahora — el matching real se delega a
   * `importService.ts` que ya tiene la lógica fuzzy (size + brand + model).
   * Este método solo persiste el snapshot crudo; los tire_id quedan null
   * y se rellenan en un paso aparte (futuro: matching async).
   */
  async importList(input: ImportPriceListInput): Promise<ImportPriceListResult> {
    const errors = validateImportInput(input);
    if (errors.length > 0) {
      throw new Error(`importList: ${errors.join('; ')}`);
    }

    // Si USD, traer el rate para calcular cost_ars.
    let rate: number | null = null;
    if (input.currency === 'USD') {
      const xr = await exchangeRateService.getById(input.exchangeRateId!);
      if (!xr) throw new Error(`importList: exchangeRateId no encontrado (${input.exchangeRateId})`);
      rate = xr.rate;
    }

    // 1. Header
    const headerPayload = {
      supplier_id: input.supplierId ?? null,
      supplier_name: input.supplierName,
      list_name: input.listName,
      currency: input.currency,
      exchange_rate_id: input.exchangeRateId ?? null,
      effective_date: input.effectiveDate,
      row_count: input.items.length,
      notes: input.notes ?? null,
    };
    const { data: headerData, error: headerErr } = await supabase.from('supplier_price_lists')
      .insert(headerPayload)
      .select()
      .single();
    const header = rowToList(
      ensureNoError(headerData, headerErr, 'supplierPriceListService.importList(header)') as SupplierPriceListRow,
    );

    // 2. Items (bulk insert; tire_id viene del caller si ya matcheó).
    const itemsPayload = input.items.map(it => ({
      price_list_id: header.id,
      tire_id: it.tireId ?? null,
      raw_sku: it.rawSku ?? null,
      raw_size: it.rawSize,
      raw_brand: it.rawBrand ?? null,
      raw_model: it.rawModel ?? null,
      cost_original: it.costOriginal,
      cost_ars: calcCostArs(it.costOriginal, input.currency, rate),
      price_suggested: it.priceSuggested ?? null,
    }));
    const { error: itemsErr } = await supabase.from('supplier_price_list_items').insert(itemsPayload);
    if (itemsErr) {
      // Rollback manual: borrar header. Si esto también falla, queda
      // header huérfano (acceptable — se ve en UI como "0 items").
      await supabase.from('supplier_price_lists').delete().eq('id', header.id);
      throw new Error(`importList(items): ${itemsErr.message}`);
    }

    const matched = input.items.filter(it => it.tireId).length;
    return {
      listId: header.id,
      rowCount: input.items.length,
      matched,
      unmatched: input.items.length - matched,
    };
  },

  /** Último costo importado para un neumático. null si nunca se importó. */
  async getLatestCostForTire(tireId: string): Promise<TireLatestCost | null> {
    const { data, error } = await supabase.from('tire_latest_cost')
      .select('*')
      .eq('tire_id', tireId)
      .maybeSingle();
    if (error) {
      throw new Error(`getLatestCostForTire: ${error.message}`);
    }
    return data ? rowToLatestCost(data as TireLatestCostRow) : null;
  },

  /**
   * Histórico completo de costos para un neumático, ordenado fecha desc.
   * Devuelve hasta `limit` items con su lista/proveedor asociado.
   */
  async getCostHistory(
    tireId: string,
    limit = 50,
  ): Promise<Array<SupplierPriceListItem & { list: SupplierPriceList }>> {
    const { data, error } = await supabase.from('supplier_price_list_items')
      .select('*, list:supplier_price_lists(*)')
      .eq('tire_id', tireId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) {
      throw new Error(`getCostHistory: ${error.message}`);
    }
    const rows = (data ?? []) as Array<SupplierPriceListItemRow & { list: SupplierPriceListRow }>;
    return rows.map(r => ({
      ...rowToItem(r),
      list: rowToList(r.list),
    }));
  },

  /** Lista importaciones recientes filtradas por proveedor o rango de fechas. */
  async listImports(filters: {
    supplierId?: string;
    from?: string;
    to?: string;
    limit?: number;
  } = {}): Promise<SupplierPriceList[]> {
    let q = supabase.from('supplier_price_lists').select('*').order('effective_date', { ascending: false });
    if (filters.supplierId) q = q.eq('supplier_id', filters.supplierId);
    if (filters.from) q = q.gte('effective_date', filters.from);
    if (filters.to) q = q.lte('effective_date', filters.to);
    if (filters.limit) q = q.limit(filters.limit);
    const { data, error } = await q;
    const rows = ensureNoError(data, error, 'supplierPriceListService.listImports') as SupplierPriceListRow[];
    return rows.map(rowToList);
  },

  /** Borra una lista importada y sus items (cascade). */
  async deleteList(id: string): Promise<void> {
    const { error } = await supabase.from('supplier_price_lists').delete().eq('id', id);
    if (error) throw new Error(`deleteList: ${error.message}`);
  },
};

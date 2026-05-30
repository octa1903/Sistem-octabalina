import { supabase } from './supabaseClient';
import { ensureNoError, rowToCamel, camelToRow, stripUndefined, callUntypedRpc, fetchAllPaginated } from './supabaseHelpers';
import { validateRow, validateRows } from './validation';
import { tireSchema, tireOverrideSchema } from './schemas';
import type { TireV2, TireStoreOverride, Tire } from '@/types';

const TIRES = 'tires';
const OVERRIDES = 'tire_store_overrides';

/**
 * Normaliza entradas de carga de stock (pure, testeable):
 * - suma cantidades repetidas del mismo tire,
 * - descarta cantidades no enteras, no finitas o <= 0.
 * Devuelve un Map tireId → cantidad total a sumar.
 */
export function normalizeStockEntries(
  entries: ReadonlyArray<{ tireId: string; quantity: number }>,
): Map<string, number> {
  const byTire = new Map<string, number>();
  for (const e of entries) {
    if (!e.tireId) continue;
    const q = Math.floor(Number(e.quantity));
    if (!Number.isFinite(q) || q <= 0) continue;
    byTire.set(e.tireId, (byTire.get(e.tireId) ?? 0) + q);
  }
  return byTire;
}

export const tireServiceV2 = {
  // ── Tire raíz ──────────────────────────────────────

  async getAll(): Promise<TireV2[]> {
    // Paginar para superar el max-rows=1000 de PostgREST en Supabase.
    const rows = await fetchAllPaginated<Record<string, unknown>>(
      () => supabase.from(TIRES).select('*').order('brand', { ascending: true }),
      'tireServiceV2.getAll',
    );
    return validateRows<TireV2>(tireSchema, rows.map(r => rowToCamel(r)), 'tireServiceV2.getAll');
  },

  async getById(id: string): Promise<TireV2 | undefined> {
    const { data, error } = await supabase
      .from(TIRES)
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ? validateRow<TireV2>(tireSchema, rowToCamel(data), 'tireServiceV2.getById') : undefined;
  },

  async save(tire: Partial<TireV2> & { brand: string; model: string; size: string; categoryId: string }): Promise<TireV2> {
    // default_margin es generated; nunca lo enviamos
    const { defaultMargin: _ignored, ...rest } = tire as TireV2 & { defaultMargin?: number };
    const payload = stripUndefined(camelToRow(rest as Record<string, unknown>));
    if (tire.id) {
      const { data, error } = await supabase
        .from(TIRES)
        .update(payload)
        .eq('id', tire.id)
        .select()
        .single();
      return rowToCamel<TireV2>(ensureNoError(data, error, 'tireServiceV2.save(update)'));
    }
    const { data, error } = await supabase
      .from(TIRES)
      .insert(payload)
      .select()
      .single();
    return rowToCamel<TireV2>(ensureNoError(data, error, 'tireServiceV2.save(insert)'));
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from(TIRES).delete().eq('id', id);
    if (error) throw error;
  },

  // ── Overrides por tienda ──────────────────────────

  async getOverride(tireId: string, storeId: string): Promise<TireStoreOverride | undefined> {
    const { data, error } = await supabase
      .from(OVERRIDES)
      .select('*')
      .eq('tire_id', tireId)
      .eq('store_id', storeId)
      .maybeSingle();
    if (error) throw error;
    return data
      ? validateRow<TireStoreOverride>(tireOverrideSchema, rowToCamel(data), 'tireServiceV2.getOverride')
      : undefined;
  },

  async getOverridesByStore(storeId: string): Promise<TireStoreOverride[]> {
    // Paginar: una tienda con catálogo grande puede pasar el cap de 1000.
    const rows = await fetchAllPaginated<Record<string, unknown>>(
      () => supabase.from(OVERRIDES).select('*').eq('store_id', storeId),
      'tireServiceV2.getOverridesByStore',
    );
    return validateRows<TireStoreOverride>(
      tireOverrideSchema,
      rows.map(r => rowToCamel(r)),
      'tireServiceV2.getOverridesByStore',
    );
  },

  async getOverridesByTire(tireId: string): Promise<TireStoreOverride[]> {
    const { data, error } = await supabase
      .from(OVERRIDES)
      .select('*')
      .eq('tire_id', tireId);
    return validateRows<TireStoreOverride>(
      tireOverrideSchema,
      ensureNoError(data, error, 'tireServiceV2.getOverridesByTire').map(r => rowToCamel(r)),
      'tireServiceV2.getOverridesByTire',
    );
  },

  async upsertOverride(o: TireStoreOverride): Promise<TireStoreOverride> {
    const payload = camelToRow(o as unknown as Record<string, unknown>);
    const { data, error } = await supabase
      .from(OVERRIDES)
      .upsert(payload, { onConflict: 'tire_id,store_id' })
      .select()
      .single();
    return rowToCamel<TireStoreOverride>(ensureNoError(data, error, 'tireServiceV2.upsertOverride'));
  },

  async deleteOverride(tireId: string, storeId: string): Promise<void> {
    const { error } = await supabase
      .from(OVERRIDES)
      .delete()
      .eq('tire_id', tireId)
      .eq('store_id', storeId);
    if (error) throw error;
  },

  // ── Stock bajo (por tienda) ────────────────────────

  async getLowStockByStore(storeId: string): Promise<TireStoreOverride[]> {
    // Postgres no permite WHERE columna_a <= columna_b vía PostgREST de forma simple,
    // así que filtramos en cliente sobre los del store.
    const all = await this.getOverridesByStore(storeId);
    return all.filter(o => o.stock <= o.lowStockThreshold);
  },

  // ── Carga de stock (suma a overrides por tienda) ──────────────────

  /**
   * Suma cantidades de stock a varios tires de una tienda en bloque.
   * Pensado para cargar mercadería (factura de compra / reposición):
   * cada entrada SUMA al stock actual (no lo reemplaza).
   *
   * Si un tire no tiene override en la tienda, se crea uno con el stock
   * inicial (heredando price/threshold del default del tire si hace falta).
   *
   * Defensivo: ignora cantidades no positivas o no enteras. Devuelve el
   * detalle por tire (stock previo → nuevo) para feedback en la UI.
   */
  async addStock(
    storeId: string,
    entries: ReadonlyArray<{ tireId: string; quantity: number }>,
  ): Promise<Array<{ tireId: string; previousStock: number; newStock: number; quantity: number }>> {
    // Normalizar: sumar cantidades por tire y descartar las inválidas.
    const byTire = normalizeStockEntries(entries);
    if (byTire.size === 0) return [];

    // Traer los overrides actuales y los tires (para defaults) de una sola vez.
    const tireIds = [...byTire.keys()];
    const [existingOverrides, { data: tireRows, error: tireErr }] = await Promise.all([
      supabase.from(OVERRIDES).select('*').eq('store_id', storeId).in('tire_id', tireIds),
      supabase.from(TIRES).select('id, default_price').in('id', tireIds),
    ]);
    if (existingOverrides.error) throw existingOverrides.error;
    if (tireErr) throw tireErr;

    const overrideByTire = new Map<string, TireStoreOverride>();
    for (const r of existingOverrides.data ?? []) {
      const o = rowToCamel<TireStoreOverride>(r as Record<string, unknown>);
      overrideByTire.set(o.tireId, o);
    }
    const defaultPriceByTire = new Map<string, number>();
    for (const r of (tireRows ?? []) as Array<{ id: string; default_price: unknown }>) {
      defaultPriceByTire.set(r.id, Number(r.default_price) || 0);
    }

    const result: Array<{ tireId: string; previousStock: number; newStock: number; quantity: number }> = [];
    const payloads = [];
    for (const [tireId, quantity] of byTire) {
      const existing = overrideByTire.get(tireId);
      const previousStock = Math.max(0, Math.floor(Number(existing?.stock ?? 0)) || 0);
      const newStock = previousStock + quantity;
      payloads.push({
        tire_id: tireId,
        store_id: storeId,
        available: existing?.available ?? true,
        price: existing?.price ?? defaultPriceByTire.get(tireId) ?? 0,
        stock: newStock,
        low_stock_threshold: existing?.lowStockThreshold ?? 2,
        location: existing?.location ?? null,
      });
      result.push({ tireId, previousStock, newStock, quantity });
    }

    // Upsert en bloque (un solo round-trip).
    const { error } = await supabase
      .from(OVERRIDES)
      .upsert(payloads, { onConflict: 'tire_id,store_id' });
    if (error) throw error;
    return result;
  },

  // ── Ajuste masivo de precios (RPC bulk_adjust_tire_prices) ────────

  /**
   * Ajusta cost / default_price / overrides en bloque.
   * `pctDelta`: porcentaje (positivo o negativo). Cap ±100% en server.
   * Filtros opcionales: `brand`, `categoryId`. `storeId` requerido si
   * `touchOverrides=true`.
   * `dryRun=true` → no escribe, devuelve sólo el conteo (preview).
   */
  async bulkAdjustPrices(args: {
    pctDelta: number;
    brand?: string | null;
    categoryId?: string | null;
    storeId?: string | null;
    touchCost?: boolean;
    touchDefaultPrice?: boolean;
    touchOverrides?: boolean;
    dryRun?: boolean;
  }): Promise<{ dryRun: boolean; factor: number; tiresCount: number; overridesCount: number }> {
    interface BulkAdjustRow {
      dry_run: boolean;
      factor: number | string;
      tires_count: number;
      overrides_count: number;
    }
    const r = await callUntypedRpc<BulkAdjustRow>('bulk_adjust_tire_prices', {
      p_pct_delta: args.pctDelta,
      p_brand: args.brand ?? null,
      p_category_id: args.categoryId ?? null,
      p_store_id: args.storeId ?? null,
      p_touch_cost: !!args.touchCost,
      p_touch_default_price: !!args.touchDefaultPrice,
      p_touch_overrides: !!args.touchOverrides,
      p_dry_run: args.dryRun ?? true,
    });
    return {
      dryRun: r.dry_run,
      factor: Number(r.factor),
      tiresCount: r.tires_count,
      overridesCount: r.overrides_count,
    };
  },

  // ── Mapeo v2 → v1 ──────────────────────────────────

  /**
   * Mapea TireV2 + override de una tienda → Tire v1 (formato esperado por la UI vieja).
   * Necesario durante la transición Fase 0/1.
   */
  toLegacy(tire: TireV2, override: TireStoreOverride | undefined, categoryName: string): Tire {
    return {
      id: tire.id,
      brand: tire.brand,
      model: tire.model,
      size: tire.size,
      category: categoryName,
      costPrice: tire.cost,
      salePrice: override?.price ?? tire.defaultPrice,
      margin: tire.defaultMargin,
      stock: override?.stock ?? 0,
      minStock: override?.lowStockThreshold ?? 0,
      location: override?.location ?? '',
      notes: tire.notes ?? '',
      createdAt: tire.createdAt,
      updatedAt: tire.updatedAt,
    };
  },
};

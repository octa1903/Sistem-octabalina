import { supabase } from './supabaseClient';
import { ensureNoError, rowToCamel, camelToRow, stripUndefined } from './supabaseHelpers';
import type { TireV2, TireStoreOverride, Tire } from '@/types';

const TIRES = 'tires';
const OVERRIDES = 'tire_store_overrides';

export const tireServiceV2 = {
  // ── Tire raíz ──────────────────────────────────────

  async getAll(): Promise<TireV2[]> {
    const { data, error } = await supabase
      .from(TIRES)
      .select('*')
      .order('brand', { ascending: true });
    return ensureNoError(data, error, 'tireServiceV2.getAll').map(r => rowToCamel<TireV2>(r));
  },

  async getById(id: string): Promise<TireV2 | undefined> {
    const { data, error } = await supabase
      .from(TIRES)
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToCamel<TireV2>(data) : undefined;
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
    return data ? rowToCamel<TireStoreOverride>(data) : undefined;
  },

  async getOverridesByStore(storeId: string): Promise<TireStoreOverride[]> {
    const { data, error } = await supabase
      .from(OVERRIDES)
      .select('*')
      .eq('store_id', storeId);
    return ensureNoError(data, error, 'tireServiceV2.getOverridesByStore').map(r =>
      rowToCamel<TireStoreOverride>(r),
    );
  },

  async getOverridesByTire(tireId: string): Promise<TireStoreOverride[]> {
    const { data, error } = await supabase
      .from(OVERRIDES)
      .select('*')
      .eq('tire_id', tireId);
    return ensureNoError(data, error, 'tireServiceV2.getOverridesByTire').map(r =>
      rowToCamel<TireStoreOverride>(r),
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

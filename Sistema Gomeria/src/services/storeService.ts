import { supabase } from './supabaseClient';
import { ensureNoError, rowToCamel, camelToRow, stripUndefined } from './supabaseHelpers';
import type { Store, FiscalIdentity } from '@/types';
import type { Json } from '@/types/database';

const TABLE = 'stores';

export function validateFiscalIdentity(fi: Partial<FiscalIdentity>): string[] {
  const errors: string[] = [];
  if (!fi.razonSocial?.trim()) errors.push('Razón social es requerida.');
  if (!fi.cuit?.trim()) errors.push('CUIT es requerido.');
  else if (!/^\d{2}-?\d{8}-?\d{1}$|^\d{11}$/.test(fi.cuit.replace(/[\s-]/g, ''))) {
    errors.push('CUIT inválido (formato esperado: 11 dígitos o XX-XXXXXXXX-X).');
  }
  if (fi.inicioActiv && !/^\d{4}-\d{2}-\d{2}$/.test(fi.inicioActiv)) {
    errors.push('Fecha de inicio inválida (YYYY-MM-DD).');
  }
  return errors;
}

export const storeService = {
  async getAll(): Promise<Store[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('name', { ascending: true });
    return ensureNoError(data, error, 'storeService.getAll').map(r => rowToCamel<Store>(r));
  },

  async getById(id: string): Promise<Store | undefined> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToCamel<Store>(data) : undefined;
  },

  async getActive(): Promise<Store[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('active', true)
      .order('name', { ascending: true });
    return ensureNoError(data, error, 'storeService.getActive').map(r => rowToCamel<Store>(r));
  },

  async save(store: Partial<Store> & { name: string }): Promise<Store> {
    const payload = stripUndefined(camelToRow(store as Record<string, unknown>));
    if (store.id) {
      const { data, error } = await supabase
        .from(TABLE)
        .update(payload)
        .eq('id', store.id)
        .select()
        .single();
      return rowToCamel<Store>(ensureNoError(data, error, 'storeService.save(update)'));
    }
    const { data, error } = await supabase
      .from(TABLE)
      .insert(payload)
      .select()
      .single();
    return rowToCamel<Store>(ensureNoError(data, error, 'storeService.save(insert)'));
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) throw error;
  },

  /**
   * Actualiza solo el `fiscal_identity` jsonb sin tocar otras columnas.
   * Valida antes de escribir.
   */
  async updateFiscalIdentity(storeId: string, fi: FiscalIdentity): Promise<Store> {
    const errors = validateFiscalIdentity(fi);
    if (errors.length > 0) {
      throw new Error(errors.join(' '));
    }
    const { data, error } = await supabase
      .from(TABLE)
      .update({ fiscal_identity: fi as unknown as Json })
      .eq('id', storeId)
      .select()
      .single();
    return rowToCamel<Store>(ensureNoError(data, error, 'storeService.updateFiscalIdentity'));
  },
};

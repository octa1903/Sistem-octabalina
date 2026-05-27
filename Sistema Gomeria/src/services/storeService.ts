import { supabase } from './supabaseClient';
import { ensureNoError, rowToCamel, camelToRow, stripUndefined } from './supabaseHelpers';
import type { Store, FiscalIdentity } from '@/types';
import type { Json } from '@/types/database';

const TABLE = 'stores';

export const IVA_OPTIONS = [
  'Responsable Inscripto',
  'Monotributo',
  'Exento',
  'Consumidor Final',
  'No Responsable',
] as const;

export const EMPTY_FISCAL_IDENTITY: FiscalIdentity = {
  razonSocial: '',
  cuit: '',
  iibb: '',
  inicioActiv: '',
  dirTel: '',
  localidad: '',
  ivaCondition: 'Responsable Inscripto',
};

export type FiscalErrors = Partial<Record<keyof FiscalIdentity, string>>;

export function validateFiscalIdentity(fi: Partial<FiscalIdentity>): FiscalErrors {
  const errors: FiscalErrors = {};
  if (!fi.razonSocial?.trim()) {
    errors.razonSocial = 'Razón social es requerida.';
  }
  if (!fi.cuit?.trim()) {
    errors.cuit = 'CUIT es requerido.';
  } else if (!/^\d{2}-?\d{8}-?\d{1}$|^\d{11}$/.test(fi.cuit.replace(/[\s-]/g, ''))) {
    errors.cuit = 'CUIT inválido (formato XX-XXXXXXXX-X).';
  }
  if (fi.inicioActiv && !/^\d{4}-\d{2}-\d{2}$/.test(fi.inicioActiv)) {
    errors.inicioActiv = 'Fecha inválida (YYYY-MM-DD).';
  }
  return errors;
}

export function hasErrors(e: FiscalErrors): boolean {
  return Object.keys(e).length > 0;
}

/**
 * Normaliza un CUIT a `XX-XXXXXXXX-X`. Devuelve el input tal cual si no tiene 11 dígitos.
 * Idempotente con input ya formateado.
 */
export function formatCuit(raw: string): string {
  const digits = raw.replace(/[\s-]/g, '');
  if (!/^\d{11}$/.test(digits)) return raw;
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
}

/** True cuando la tienda todavía no tiene identidad fiscal mínima (razón social + CUIT). */
export function needsFiscalSetup(store: Store | null | undefined): boolean {
  if (!store) return false;
  const fi = store.fiscalIdentity;
  if (!fi) return true;
  return !fi.razonSocial?.trim() || !fi.cuit?.trim();
}

/**
 * Alias retrocompatible. Hoy es equivalente a `needsFiscalSetup`, pero ahora
 * el wizard incluye otros pasos (bootstrap admin) que se evalúan aparte —
 * ver `FirstRunWizard` y `needsAdminBootstrap` en employeeService.
 */
export function needsFirstRunSetup(store: Store | null | undefined): boolean {
  return needsFiscalSetup(store);
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
    if (hasErrors(errors)) {
      throw new Error(Object.values(errors).join(' '));
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

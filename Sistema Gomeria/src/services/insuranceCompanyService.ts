import { supabase } from './supabaseClient';
import { ensureNoError, rowToCamel, camelToRow } from './supabaseHelpers';
import type { InsuranceCompany, InsuranceCompanyMovement } from '@/types';

const TABLE = 'insurance_companies';
const MOVEMENTS = 'insurance_company_movements';

export const insuranceCompanyService = {
  async getAll(opts: { activeOnly?: boolean } = {}): Promise<InsuranceCompany[]> {
    let q = supabase.from(TABLE).select('*').order('name', { ascending: true });
    if (opts.activeOnly) q = q.eq('active', true);
    const { data, error } = await q;
    return ensureNoError(data, error, 'insuranceCompanyService.getAll').map(r =>
      rowToCamel<InsuranceCompany>(r),
    );
  },

  async getById(id: string): Promise<InsuranceCompany | undefined> {
    const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? rowToCamel<InsuranceCompany>(data) : undefined;
  },

  async save(c: Omit<InsuranceCompany, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<InsuranceCompany> {
    const payload = camelToRow(c as unknown as Record<string, unknown>);
    const { data, error } = c.id
      ? await supabase.from(TABLE).update(payload).eq('id', c.id).select().single()
      : await supabase.from(TABLE).insert(payload).select().single();
    return rowToCamel<InsuranceCompany>(
      ensureNoError(data, error, 'insuranceCompanyService.save'),
    );
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) throw error;
  },

  async getMovements(insuranceCompanyId: string, limit = 200): Promise<InsuranceCompanyMovement[]> {
    const { data, error } = await supabase
      .from(MOVEMENTS)
      .select('*')
      .eq('insurance_company_id', insuranceCompanyId)
      .order('at', { ascending: false })
      .limit(limit);
    return ensureNoError(data, error, 'insuranceCompanyService.getMovements').map(r =>
      rowToCamel<InsuranceCompanyMovement>(r),
    );
  },

  async addMovement(
    m: Omit<InsuranceCompanyMovement, 'id' | 'at'> & { at?: string },
  ): Promise<InsuranceCompanyMovement> {
    const payload = camelToRow(m as unknown as Record<string, unknown>);
    const { data, error } = await supabase
      .from(MOVEMENTS)
      .insert(payload)
      .select()
      .single();
    return rowToCamel<InsuranceCompanyMovement>(
      ensureNoError(data, error, 'insuranceCompanyService.addMovement'),
    );
  },
};

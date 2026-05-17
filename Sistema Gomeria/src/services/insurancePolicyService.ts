import { supabase } from './supabaseClient';
import { ensureNoError, rowToCamel, camelToRow } from './supabaseHelpers';
import type { InsurancePolicy } from '@/types';

const TABLE = 'insurance_policies';

export const insurancePolicyService = {
  async getAll(opts: { activeOnly?: boolean; storeId?: string; customerId?: string } = {}): Promise<InsurancePolicy[]> {
    let q = supabase.from(TABLE).select('*').order('policy_number', { ascending: true });
    if (opts.activeOnly) q = q.eq('active', true);
    if (opts.storeId) q = q.eq('store_id', opts.storeId);
    if (opts.customerId) q = q.eq('customer_id', opts.customerId);
    const { data, error } = await q;
    return ensureNoError(data, error, 'insurancePolicyService.getAll').map(r =>
      rowToCamel<InsurancePolicy>(r),
    );
  },

  async getById(id: string): Promise<InsurancePolicy | undefined> {
    const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? rowToCamel<InsurancePolicy>(data) : undefined;
  },

  async save(p: Omit<InsurancePolicy, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<InsurancePolicy> {
    const payload = camelToRow(p as unknown as Record<string, unknown>);
    const { data, error } = p.id
      ? await supabase.from(TABLE).update(payload).eq('id', p.id).select().single()
      : await supabase.from(TABLE).insert(payload).select().single();
    return rowToCamel<InsurancePolicy>(
      ensureNoError(data, error, 'insurancePolicyService.save'),
    );
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) throw error;
  },
};

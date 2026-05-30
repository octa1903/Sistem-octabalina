import { supabase } from './supabaseClient';
import { ensureNoError, rowToCamel } from './supabaseHelpers';
import { toMoney } from '@/utils/currency';

export interface Check {
  id: string;
  checkNumber: string;
  bankId?: string;
  customerId?: string;
  supplierId?: string;
  type: 'incoming' | 'outgoing';
  amount: number;
  emissionDate?: string;
  collectionDate?: string;
  entryDate?: string;
  exitDate?: string;
  givenBy?: string;
  givenTo?: string;
  detail?: string;
  cashed: boolean;
  status?: string;
  receiptId?: string;
  legacyId?: string;
  createdAt: string;
}

export interface CheckWithNames extends Check {
  bankName?: string;
  customerName?: string;
  supplierName?: string;
}

export type CheckFilter = 'all' | 'incoming' | 'outgoing' | 'pending' | 'cashed';

export const checkServiceV2 = {
  async list(opts: { filter?: CheckFilter; search?: string; limit?: number } = {}): Promise<CheckWithNames[]> {
    let q = supabase
      .from('checks')
      .select('*, bank:banks(name), customer:customers(name), supplier:suppliers(name)')
      .order('emission_date', { ascending: false, nullsFirst: false })
      .limit(opts.limit ?? 500);

    if (opts.filter === 'incoming') q = q.eq('type', 'incoming');
    else if (opts.filter === 'outgoing') q = q.eq('type', 'outgoing');
    else if (opts.filter === 'pending') q = q.eq('cashed', false);
    else if (opts.filter === 'cashed') q = q.eq('cashed', true);

    if (opts.search) {
      q = q.or(`check_number.ilike.%${opts.search}%,given_by.ilike.%${opts.search}%,given_to.ilike.%${opts.search}%`);
    }

    const { data, error } = await q;
    const rows = ensureNoError(data, error, 'checkServiceV2.list') as Array<
      Record<string, unknown> & {
        bank: { name: string } | null;
        customer: { name: string } | null;
        supplier: { name: string } | null;
      }
    >;
    return rows.map((r) => {
      const { bank, customer, supplier, ...rest } = r;
      const base = rowToCamel<Check>(rest);
      return {
        ...base,
        bankName: bank?.name,
        customerName: customer?.name,
        supplierName: supplier?.name,
      };
    });
  },

  async summary(): Promise<{
    incoming_pending_count: number;
    incoming_pending_amount: number;
    outgoing_pending_count: number;
    outgoing_pending_amount: number;
  }> {
    const { data, error } = await supabase
      .from('checks')
      .select('type, cashed, amount')
      .eq('cashed', false);
    if (error) throw error;
    const rows = (data ?? []) as Array<{ type: string; cashed: boolean; amount: unknown }>;
    let inC = 0;
    let inA = 0;
    let outC = 0;
    let outA = 0;
    for (const r of rows) {
      const amt = toMoney(r.amount);
      if (r.type === 'incoming') {
        inC++;
        inA += amt;
      } else {
        outC++;
        outA += amt;
      }
    }
    return {
      incoming_pending_count: inC,
      incoming_pending_amount: inA,
      outgoing_pending_count: outC,
      outgoing_pending_amount: outA,
    };
  },
};

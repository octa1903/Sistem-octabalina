import { supabase } from './supabaseClient';
import { ensureNoError, rowToCamel, fetchAllPaginated } from './supabaseHelpers';
import { toMoney } from '@/utils/currency';

export interface Supplier {
  id: string;
  name: string;
  legalName?: string;
  cuit?: string;
  phone?: string;
  cell?: string;
  email?: string;
  address?: string;
  city?: string;
  rubro?: string;
  fiscalPosition?: string;
  retentionPct?: number;
  category?: string;
  contactName?: string;
  notes?: string;
  legacyId?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierMovement {
  id: string;
  supplierId: string;
  at: string;
  type: 'invoice' | 'payment' | 'adjustment' | 'opening_balance';
  amount: number;
  balanceAfter?: number;
  reference?: string;
  notes?: string;
  legacyId?: string;
}

export interface SupplierWithBalance extends Supplier {
  balance: number;
}

export const supplierServiceV2 = {
  /**
   * Lista de proveedores activos con su balance calculado en cliente
   * desde supplier_account_movements. Aceptable para <2000 proveedores
   * porque el query agrupado se hace una vez al cargar la vista.
   */
  async listWithBalance(opts: { search?: string; limit?: number } = {}): Promise<SupplierWithBalance[]> {
    let q = supabase
      .from('suppliers')
      .select('*')
      .eq('active', true)
      .order('name', { ascending: true })
      .limit(opts.limit ?? 500);
    if (opts.search) {
      q = q.or(`name.ilike.%${opts.search}%,cuit.ilike.%${opts.search}%,legacy_id.eq.${opts.search}`);
    }
    const { data, error } = await q;
    const suppliers = ensureNoError(data, error, 'supplierServiceV2.listWithBalance').map((r) =>
      rowToCamel<Supplier>(r),
    );
    if (suppliers.length === 0) return [];

    // Calcular balance neto = sum(amount) where type='invoice' menos sum where type='payment'
    // Hacemos un solo query agrupado.
    const ids = suppliers.map((s) => s.id);
    const { data: movs, error: mErr } = await supabase
      .from('supplier_account_movements')
      .select('supplier_id, type, amount')
      .in('supplier_id', ids);
    if (mErr) throw mErr;
    const balanceBySupplier = new Map<string, number>();
    for (const m of (movs ?? []) as Array<{ supplier_id: string; type: string; amount: unknown }>) {
      const sign = m.type === 'invoice' || m.type === 'adjustment' || m.type === 'opening_balance' ? 1 : -1;
      balanceBySupplier.set(m.supplier_id, (balanceBySupplier.get(m.supplier_id) ?? 0) + sign * toMoney(m.amount));
    }
    return suppliers.map((s) => ({ ...s, balance: balanceBySupplier.get(s.id) ?? 0 }));
  },

  async getMovementsForSupplier(supplierId: string): Promise<SupplierMovement[]> {
    const rows = await fetchAllPaginated<Record<string, unknown>>(
      () =>
        supabase
          .from('supplier_account_movements')
          .select('*')
          .eq('supplier_id', supplierId)
          .order('at', { ascending: false }),
      'supplierServiceV2.getMovementsForSupplier',
    );
    return rows.map((r) => rowToCamel<SupplierMovement>(r));
  },
};

import { supabase } from './supabaseClient';
import { ensureNoError, rowToCamel, camelToRow, stripUndefined } from './supabaseHelpers';
import { toMoney } from '@/utils/currency';
import type { Customer, Client, CustomerAccountMovement } from '@/types';

const TABLE = 'customers';
const MOVEMENTS = 'customer_account_movements';

export const customerServiceV2 = {
  /**
   * Lista de clientes activos (excluye soft-deleted via migration 0023).
   * Para incluir soft-deleted, usar getAllIncludingDeleted().
   */
  async getAll(): Promise<Customer[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .is('deleted_at', null)
      .order('name', { ascending: true });
    return ensureNoError(data, error, 'customerServiceV2.getAll').map(r => rowToCamel<Customer>(r));
  },

  /**
   * Lista clientes con saldo distinto de cero (deudores + a favor).
   * `sign`: 'debt' = balance > 0 (deudores), 'credit' = balance < 0 (a favor),
   * undefined = ambos. Evita traer los 5175 clientes cuando solo importan
   * los ~897 con movimiento real.
   */
  async getWithBalance(
    opts: { sign?: 'debt' | 'credit'; search?: string; limit?: number } = {},
  ): Promise<Customer[]> {
    const { sign, search, limit = 500 } = opts;
    let q = supabase.from(TABLE).select('*').is('deleted_at', null);
    if (sign === 'debt') q = q.gt('account_balance', 0);
    else if (sign === 'credit') q = q.lt('account_balance', 0);
    else q = q.neq('account_balance', 0);
    if (search && search.trim().length > 0) {
      const term = search.trim().replace(/[%,]/g, ' ');
      q = q.or(`name.ilike.%${term}%,phone.ilike.%${term}%`);
    }
    const { data, error } = await q
      .order('account_balance', { ascending: sign === 'credit' })
      .limit(limit);
    return ensureNoError(data, error, 'customerServiceV2.getWithBalance').map(r =>
      rowToCamel<Customer>(r),
    );
  },

  /**
   * Busca clientes por nombre o teléfono (server-side).
   * Útil cuando hay miles de clientes y la búsqueda local no escala.
   */
  async search(term: string, limit = 100): Promise<Customer[]> {
    const t = term.trim();
    if (!t) return [];
    const safe = t.replace(/[%,]/g, ' ');
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .is('deleted_at', null)
      .or(`name.ilike.%${safe}%,phone.ilike.%${safe}%`)
      .order('name', { ascending: true })
      .limit(limit);
    return ensureNoError(data, error, 'customerServiceV2.search').map(r =>
      rowToCamel<Customer>(r),
    );
  },

  /**
   * Totales agregados de cuenta corriente (deuda total, saldo a favor, conteos).
   * Más barato que traer N filas: usa head:true + count.
   */
  async getBalanceSummary(): Promise<{
    totalDebt: number;
    totalCredit: number;
    debtorCount: number;
    creditorCount: number;
  }> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('account_balance')
      .is('deleted_at', null)
      .neq('account_balance', 0);
    const rows = ensureNoError(data, error, 'customerServiceV2.getBalanceSummary');
    let totalDebt = 0;
    let totalCredit = 0;
    let debtorCount = 0;
    let creditorCount = 0;
    for (const r of rows as { account_balance: unknown }[]) {
      // toMoney degrada saldos corruptos (NaN, absurdos de migración) a 0,
      // así un dato malo no infla el total de deuda/favor del encabezado.
      const b = toMoney(r.account_balance);
      if (b > 0) {
        totalDebt += b;
        debtorCount += 1;
      } else if (b < 0) {
        totalCredit += -b;
        creditorCount += 1;
      }
    }
    return { totalDebt, totalCredit, debtorCount, creditorCount };
  },

  /** Incluye también los soft-deleted (uso admin/reportes históricos). */
  async getAllIncludingDeleted(): Promise<Customer[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('name', { ascending: true });
    return ensureNoError(data, error, 'customerServiceV2.getAllIncludingDeleted').map(r =>
      rowToCamel<Customer>(r),
    );
  },

  /** Soft delete: marca deleted_at sin borrar la fila. Migration 0023. */
  async softDelete(id: string): Promise<void> {
    const { error } = await supabase
      .from(TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  /** Restaurar un cliente soft-deleted. */
  async restore(id: string): Promise<void> {
    const { error } = await supabase
      .from(TABLE)
      .update({ deleted_at: null })
      .eq('id', id);
    if (error) throw error;
  },

  async getById(id: string): Promise<Customer | undefined> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToCamel<Customer>(data) : undefined;
  },

  async getWholesale(): Promise<Customer[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('customer_type', 'wholesale')
      .is('deleted_at', null)
      .order('name', { ascending: true });
    return ensureNoError(data, error, 'customerServiceV2.getWholesale').map(r =>
      rowToCamel<Customer>(r),
    );
  },

  async save(customer: Partial<Customer> & { name: string }): Promise<Customer> {
    const payload = stripUndefined(camelToRow(customer as Record<string, unknown>));
    if (customer.id) {
      const { data, error } = await supabase
        .from(TABLE)
        .update(payload)
        .eq('id', customer.id)
        .select()
        .single();
      return rowToCamel<Customer>(ensureNoError(data, error, 'customerServiceV2.save(update)'));
    }
    const { data, error } = await supabase
      .from(TABLE)
      .insert(payload)
      .select()
      .single();
    return rowToCamel<Customer>(ensureNoError(data, error, 'customerServiceV2.save(insert)'));
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) throw error;
  },

  // ── Movimientos de cuenta corriente ───────────────

  async getMovements(customerId: string): Promise<CustomerAccountMovement[]> {
    const { data, error } = await supabase
      .from(MOVEMENTS)
      .select('*')
      .eq('customer_id', customerId)
      .order('at', { ascending: false });
    return ensureNoError(data, error, 'customerServiceV2.getMovements').map(r =>
      rowToCamel<CustomerAccountMovement>(r),
    );
  },

  async addMovement(m: Omit<CustomerAccountMovement, 'id' | 'at'> & { at?: string }): Promise<CustomerAccountMovement> {
    const payload = camelToRow(m as unknown as Record<string, unknown>);
    const { data, error } = await supabase
      .from(MOVEMENTS)
      .insert(payload)
      .select()
      .single();
    if (error) {
      // Migration 0019: trigger trg_credit_limit_check usa errcode 23514 +
      // hint='credit_limit_exceeded' cuando un charge excede el cupo.
      const hint = (error as { hint?: string }).hint;
      if (error.code === '23514' && hint === 'credit_limit_exceeded') {
        throw new Error('El cargo excede el cupo de crédito del cliente.');
      }
    }
    return rowToCamel<CustomerAccountMovement>(
      ensureNoError(data, error, 'customerServiceV2.addMovement'),
    );
  },

  // ── Mapeo v2 → v1 ──────────────────────────────────

  /**
   * Mapea Customer v2 → Client v1 (compat con UI vieja).
   * Las propiedades de v2 que no existen en v1 (label, points, métricas) se descartan.
   * El historial de payments se omite — debe consultarse vía getMovements aparte.
   */
  toLegacy(customer: Customer): Client {
    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone ?? '',
      address: typeof customer.address === 'object'
        ? [customer.address.street, customer.address.city].filter(Boolean).join(', ')
        : '',
      email: customer.email ?? '',
      balance: customer.accountBalance,
      payments: [],
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
      tipoCliente: customer.customerType === 'wholesale' ? 'mayorista' : 'minorista',
      descuentoMayorista: customer.wholesaleDiscount ?? 0,
      pinHash: customer.pinHash ?? '',
      cupoCredito: customer.creditLimit,
    };
  },
};

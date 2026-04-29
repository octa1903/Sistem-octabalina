import { supabase } from './supabaseClient';
import { ensureNoError, rowToCamel, camelToRow, stripUndefined } from './supabaseHelpers';
import type { Customer, Client, CustomerAccountMovement } from '@/types';

const TABLE = 'customers';
const MOVEMENTS = 'customer_account_movements';

export const customerServiceV2 = {
  async getAll(): Promise<Customer[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('name', { ascending: true });
    return ensureNoError(data, error, 'customerServiceV2.getAll').map(r => rowToCamel<Customer>(r));
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

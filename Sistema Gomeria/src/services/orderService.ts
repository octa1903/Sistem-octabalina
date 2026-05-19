// ═══════════════════════════════════════════════════
// orderService — CRUD de pedidos online del portal cliente (Fase 6).
// Tabla: customer_orders (definida en 0001_init.sql).
// INSERT del portal cliente (sin auth Supabase) permitido por la
// policy customer_orders_public_insert (0006_customer_orders_public_insert.sql).
// ═══════════════════════════════════════════════════

import { supabase } from './supabaseClient';
import { ensureNoError, stripUndefined, callUntypedRpc } from './supabaseHelpers';
import type { Order, OrderItem, OrderStatus } from '@/types';

const TABLE = 'customer_orders';

/** Convierte un row de customer_orders al shape legacy Order. */
export function toLegacyOrder(row: Record<string, unknown>): Order {
  return {
    id: row.id as string,
    numero: row.numero as string,
    clientId: (row.customer_id as string | null) ?? '',
    clientName: row.customer_name as string,
    items: (row.items as OrderItem[]) ?? [],
    paymentMethod: (row.payment_method_id as string | null) ?? '',
    status: row.status as OrderStatus,
    tipo: row.tipo as 'retiro' | 'entrega_domicilio',
    scheduledDate: row.scheduled_date as string,
    scheduledTime: (row.scheduled_time as string | null) ?? undefined,
    address: (row.address as string | null) ?? undefined,
    notes: (row.notes as string | null) ?? undefined,
    totalAmount: Number(row.total_amount),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    confirmedBy: (row.confirmed_by_employee_id as string | null) ?? undefined,
    internalNotes: (row.internal_notes as string | null) ?? undefined,
    clientMessage: (row.client_message as string | null) ?? undefined,
  };
}

export interface SaveOrderInput {
  id?: string;
  numero?: string;
  customerId?: string;
  customerName: string;
  storeId?: string;
  items: OrderItem[];
  paymentMethodId?: string;
  status?: OrderStatus;
  tipo: 'retiro' | 'entrega_domicilio';
  scheduledDate: string;
  scheduledTime?: string;
  address?: string;
  notes?: string;
  totalAmount: number;
  confirmedByEmployeeId?: string;
  internalNotes?: string;
  clientMessage?: string;
}

export const orderService = {
  async getAll(): Promise<Order[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('created_at', { ascending: false });
    return ensureNoError(data, error, 'orderService.getAll').map(r => toLegacyOrder(r as unknown as Record<string, unknown>));
  },

  async getByClient(clientId: string): Promise<Order[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('customer_id', clientId)
      .order('created_at', { ascending: false });
    return ensureNoError(data, error, 'orderService.getByClient').map(r => toLegacyOrder(r as unknown as Record<string, unknown>));
  },

  async getByStatus(status: OrderStatus): Promise<Order[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });
    return ensureNoError(data, error, 'orderService.getByStatus').map(r => toLegacyOrder(r as unknown as Record<string, unknown>));
  },

  async save(input: SaveOrderInput): Promise<Order> {
    const payload = stripUndefined({
      numero: input.numero ?? `${Date.now()}`.slice(-6),
      customer_id: input.customerId ?? null,
      customer_name: input.customerName,
      store_id: input.storeId ?? null,
      items: input.items,
      payment_method_id: input.paymentMethodId ?? null,
      status: input.status ?? 'pendiente',
      tipo: input.tipo,
      scheduled_date: input.scheduledDate,
      scheduled_time: input.scheduledTime ?? null,
      address: input.address ?? null,
      notes: input.notes ?? null,
      total_amount: input.totalAmount,
      confirmed_by_employee_id: input.confirmedByEmployeeId ?? null,
      internal_notes: input.internalNotes ?? null,
      client_message: input.clientMessage ?? null,
    });

    if (input.id) {
      const { data, error } = await supabase
        .from(TABLE)
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', input.id)
        .select()
        .single();
      return toLegacyOrder(ensureNoError(data, error, 'orderService.save(update)') as unknown as Record<string, unknown>);
    }
    const { data, error } = await supabase
      .from(TABLE)
      .insert(payload)
      .select()
      .single();
    return toLegacyOrder(ensureNoError(data, error, 'orderService.save(insert)') as unknown as Record<string, unknown>);
  },

  async updateStatus(
    id: string,
    status: OrderStatus,
    extra?: { internalNotes?: string; clientMessage?: string; confirmedByEmployeeId?: string },
  ): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const patch: any = { status, updated_at: new Date().toISOString() };
    if (extra?.internalNotes !== undefined) patch.internal_notes = extra.internalNotes;
    if (extra?.clientMessage !== undefined) patch.client_message = extra.clientMessage;
    if (extra?.confirmedByEmployeeId !== undefined) patch.confirmed_by_employee_id = extra.confirmedByEmployeeId;
    const { error } = await supabase.from(TABLE).update(patch).eq('id', id);
    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) throw error;
  },

  /**
   * Crea un pedido desde el portal cliente (sin auth Supabase).
   * Llama al RPC `customer_create_order` que valida el token de sesión
   * server-side (emitido por `customer_login`), recalcula total + unit_price
   * por item desde tires/tire_store_overrides + customers.wholesale_discount,
   * y bypassea RLS. El total que ve el cliente en la UI es referencial: el
   * server escribe el autoritativo.
   */
  async createPublicOrder(
    token: string,
    input: {
      storeId: string;
      items: OrderItem[];
      paymentMethodId?: string;
      tipo: 'retiro' | 'entrega_domicilio';
      scheduledDate: string;
      scheduledTime?: string;
      address?: string;
      notes?: string;
    },
  ): Promise<string> {
    return callUntypedRpc<string>('customer_create_order', {
      p_token: token,
      p_store_id: input.storeId,
      p_items: input.items,
      p_payment_method_id: input.paymentMethodId ?? null,
      p_tipo: input.tipo,
      p_scheduled_date: input.scheduledDate,
      p_scheduled_time: input.scheduledTime ?? null,
      p_address: input.address ?? null,
      p_notes: input.notes ?? null,
    });
  },
};

import { supabase } from './supabaseClient';
import { ensureNoError, rowToCamel, camelToRow, stripUndefined } from './supabaseHelpers';
import { toMoney } from '@/utils/currency';
import type { CashSession, CashMovement } from '@/types';

const SESSIONS = 'cash_sessions';
const MOVEMENTS = 'cash_movements';

export const cashSessionService = {
  /**
   * Sesión abierta para una tienda, o undefined si no hay.
   * Por la unique index parcial, sólo puede haber una.
   */
  async getOpenForStore(storeId: string): Promise<CashSession | undefined> {
    const { data, error } = await supabase
      .from(SESSIONS)
      .select('*')
      .eq('store_id', storeId)
      .eq('status', 'open')
      .maybeSingle();
    if (error) throw error;
    return data ? rowToCamel<CashSession>(data) : undefined;
  },

  async getById(id: string): Promise<CashSession | undefined> {
    const { data, error } = await supabase
      .from(SESSIONS)
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToCamel<CashSession>(data) : undefined;
  },

  async getByStoreAndDate(storeId: string, dayIso: string): Promise<CashSession[]> {
    // dayIso: 'YYYY-MM-DD'
    const start = `${dayIso}T00:00:00.000Z`;
    const end = `${dayIso}T23:59:59.999Z`;
    const { data, error } = await supabase
      .from(SESSIONS)
      .select('*')
      .eq('store_id', storeId)
      .gte('opened_at', start)
      .lte('opened_at', end)
      .order('opened_at', { ascending: false });
    return ensureNoError(data, error, 'cashSessionService.getByStoreAndDate').map(r =>
      rowToCamel<CashSession>(r),
    );
  },

  /**
   * Apertura de caja. Falla si ya hay una sesión abierta para esa tienda
   * (por la unique index parcial).
   */
  async open(input: {
    storeId: string;
    employeeId: string;
    openingFloat: number;
    notes?: string;
  }): Promise<CashSession> {
    const payload = camelToRow({
      storeId: input.storeId,
      openedByEmployeeId: input.employeeId,
      openingFloat: input.openingFloat,
      notes: input.notes,
      status: 'open',
    });
    const { data, error } = await supabase
      .from(SESSIONS)
      .insert(stripUndefined(payload))
      .select()
      .single();
    return rowToCamel<CashSession>(ensureNoError(data, error, 'cashSessionService.open'));
  },

  /**
   * Cierre de caja vía RPC `close_cash_session` que calcula descuadre en el server.
   */
  async close(input: {
    sessionId: string;
    employeeId: string;
    countedCash: number;
  }): Promise<{ expectedCash: number; countedCash: number; variance: number }> {
    const { data, error } = await supabase.rpc('close_cash_session', {
      p_session_id: input.sessionId,
      p_employee_id: input.employeeId,
      p_counted_cash: input.countedCash,
    });
    if (error) {
       
      console.error('[cashSession] close error:', error);
      throw new Error(error.message);
    }
    if (!data) throw new Error('close_cash_session: respuesta vacía');
    // Supabase devuelve el jsonb tal cual
    const r = data as { expected_cash: unknown; counted_cash: unknown; variance: unknown };
    return {
      expectedCash: toMoney(r.expected_cash),
      countedCash: toMoney(r.counted_cash),
      variance: toMoney(r.variance),
    };
  },

  // ── Movimientos ───────────────────────────────────

  async addMovement(m: Omit<CashMovement, 'id' | 'at'> & { at?: string }): Promise<CashMovement> {
    const payload = camelToRow(m as unknown as Record<string, unknown>);
    const { data, error } = await supabase
      .from(MOVEMENTS)
      .insert(stripUndefined(payload))
      .select()
      .single();
    return rowToCamel<CashMovement>(ensureNoError(data, error, 'cashSessionService.addMovement'));
  },

  async getMovements(sessionId: string): Promise<CashMovement[]> {
    const { data, error } = await supabase
      .from(MOVEMENTS)
      .select('*')
      .eq('cash_session_id', sessionId)
      .order('at', { ascending: false });
    return ensureNoError(data, error, 'cashSessionService.getMovements').map(r =>
      rowToCamel<CashMovement>(r),
    );
  },
};

import { supabase } from './supabaseClient';
import { callUntypedRpc } from './supabaseHelpers';

// ── Tipos del payload del RPC ────────────────────────────────────────

export type ReportKind = 'X' | 'Z';

export interface SessionReportPaymentRow {
  payment_method_id: string;
  method_name: string;
  method_type: string;
  sale_amount: number;
  refund_amount: number;
  net_amount: number;
  sale_count: number;
  refund_count: number;
}

export interface SessionReportTotals {
  subtotal_gross: number;
  total_discounts: number;
  subtotal_net: number;
  total_taxes: number;
  total_cogs: number;
  total: number;
  points_earned: number;
  points_redeemed: number;
}

export interface SessionReportCounts {
  sale_count: number;
  refund_count: number;
  parked_count: number;
}

export interface SessionReportMovement {
  id: string;
  type: 'pay_in' | 'pay_out';
  amount: number;
  reason: string;
  at: string;
  employee_id: string;
}

export interface SessionReportSessionInfo {
  id: string;
  store_id: string;
  opened_at: string;
  closed_at: string | null;
  opened_by: { id: string; name: string };
  closed_by: { id: string; name: string } | null;
  opening_float: number;
  expected_cash: number | null;
  counted_cash: number | null;
  variance: number | null;
  status: 'open' | 'closed';
  notes: string | null;
}

export interface SessionReportStoreInfo {
  id: string;
  name: string;
  fiscal_identity: {
    razonSocial?: string;
    cuit?: string;
    iibb?: string;
    inicioActiv?: string;
    dirTel?: string;
    localidad?: string;
    ivaCondition?: string;
  } | null;
}

export interface SessionReport {
  session: SessionReportSessionInfo;
  store: SessionReportStoreInfo;
  payments: SessionReportPaymentRow[];
  totals: SessionReportTotals;
  counts: SessionReportCounts;
  movements: SessionReportMovement[];
  generated_at: string;
  report_kind: ReportKind;
}

// ── Service ──────────────────────────────────────────────────────────

export const sessionReportServiceV2 = {
  /**
   * Genera el reporte X (sesión abierta, preview) o Z (sesión cerrada,
   * snapshot inmutable) según el `status` actual de la cash_session.
   *
   * El backend decide qué tipo es: si la sesión está abierta devuelve X
   * con los datos actuales; si está cerrada devuelve Z con los datos
   * congelados al momento del cierre (las columnas expected_cash,
   * counted_cash y variance ya quedaron grabadas en la fila).
   */
  async forSession(sessionId: string): Promise<SessionReport> {
    const data = await callUntypedRpc<SessionReport>('build_session_report', { p_session_id: sessionId });
    return data;
  },

  /**
   * Lista de sesiones cerradas en un rango de fechas para una tienda.
   * Útil para el historial de reportes Z (auditoría contable).
   */
  async listClosedByStore(
    storeId: string,
    opts: { fromIso?: string; toIso?: string; limit?: number } = {},
  ): Promise<
    Array<{
      id: string;
      opened_at: string;
      closed_at: string | null;
      opening_float: number;
      expected_cash: number | null;
      counted_cash: number | null;
      variance: number | null;
    }>
  > {
    let q = supabase
      .from('cash_sessions')
      .select('id, opened_at, closed_at, opening_float, expected_cash, counted_cash, variance')
      .eq('store_id', storeId)
      .eq('status', 'closed')
      .order('closed_at', { ascending: false })
      .limit(opts.limit ?? 50);
    if (opts.fromIso) q = q.gte('closed_at', opts.fromIso);
    if (opts.toIso) q = q.lte('closed_at', opts.toIso);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as Array<{
      id: string;
      opened_at: string;
      closed_at: string | null;
      opening_float: number;
      expected_cash: number | null;
      counted_cash: number | null;
      variance: number | null;
    }>;
  },
};

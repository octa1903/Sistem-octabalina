// ═══════════════════════════════════════════════════
// reportService — Wrappers de las RPCs `report_*` (Fase 4).
// Las agregaciones viven en Postgres (migración 0004_reports.sql).
// ═══════════════════════════════════════════════════

import { supabase } from './supabaseClient';
import { rowToCamel } from './supabaseHelpers';

export interface ReportFilters {
  /** ISO datetime (inclusive). */
  from: string;
  /** ISO datetime (exclusive). */
  to: string;
  storeId?: string | null;
  employeeId?: string | null;
}

export interface SalesSummary {
  grossSales: number;
  refunds: number;
  discounts: number;
  netSales: number;
  taxes: number;
  total: number;
  cogs: number;
  grossProfit: number;
  receiptCount: number;
  refundCount: number;
}

export interface SalesByItem {
  tireId: string;
  tireBrand: string;
  tireModel: string;
  tireSize: string;
  quantity: number;
  netSales: number;
  cogs: number;
  profit: number;
}

export interface SalesByCategory {
  categoryId: string;
  categoryName: string;
  quantity: number;
  netSales: number;
  cogs: number;
  profit: number;
}

export interface SalesByEmployee {
  employeeId: string;
  employeeName: string;
  receiptCount: number;
  refundCount: number;
  netSales: number;
  total: number;
  profit: number;
}

export interface SalesByPayment {
  paymentMethodId: string;
  paymentMethodName: string;
  receiptCount: number;
  total: number;
}

export interface SalesByTax {
  taxId: string;
  taxName: string;
  rate: number;
  base: number;
  amount: number;
}

export interface DiscountReportRow {
  discountId: string;
  discountName: string;
  applyCount: number;
  amount: number;
}

export interface ReceiptReportRow {
  id: string;
  receiptNumber: string;
  type: 'sale' | 'refund';
  createdAt: string;
  storeId: string;
  storeName: string;
  employeeId: string;
  employeeName: string;
  customerId: string | null;
  customerName: string | null;
  total: number;
  totalDiscounts: number;
  totalTaxes: number;
  itemCount: number;
}

export interface CashSessionReportRow {
  id: string;
  storeId: string;
  storeName: string;
  openedAt: string;
  closedAt: string | null;
  openedByName: string | null;
  closedByName: string | null;
  openingFloat: number;
  expectedCash: number | null;
  countedCash: number | null;
  variance: number | null;
  status: 'open' | 'closed';
  totalSales: number;
  totalRefunds: number;
  receiptCount: number;
  payIn: number;
  payOut: number;
}

function buildArgs(f: ReportFilters, includeEmployee = true) {
  const args: Record<string, string | null> = {
    p_from: f.from,
    p_to: f.to,
    p_store_id: f.storeId ?? null,
  };
  if (includeEmployee) args.p_employee_id = f.employeeId ?? null;
  return args;
}

async function callRpc<T extends object>(fn: string, args: Record<string, unknown>): Promise<T[]> {
  // Las funciones `report_*` viven en la migración 0004 y no están todavía
  // en `types/database.ts` (regenerar tras aplicarla). Cast pragmático:
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)(fn, args);
  if (error) {
    // eslint-disable-next-line no-console
    console.error(`[reportService] ${fn}:`, error.code, error.message);
    throw new Error(`${fn}: ${error.message}`);
  }
  if (!Array.isArray(data)) return [];
  return (data as Record<string, unknown>[]).map(r => rowToCamel<T>(r));
}

export const reportService = {
  async salesSummary(f: ReportFilters): Promise<SalesSummary> {
    const rows = await callRpc<SalesSummary>('report_sales_summary', buildArgs(f));
    return rows[0] ?? {
      grossSales: 0, refunds: 0, discounts: 0, netSales: 0,
      taxes: 0, total: 0, cogs: 0, grossProfit: 0,
      receiptCount: 0, refundCount: 0,
    };
  },

  salesByItem: (f: ReportFilters) =>
    callRpc<SalesByItem>('report_sales_by_item', buildArgs(f)),

  salesByCategory: (f: ReportFilters) =>
    callRpc<SalesByCategory>('report_sales_by_category', buildArgs(f)),

  salesByEmployee: (f: ReportFilters) =>
    callRpc<SalesByEmployee>('report_sales_by_employee', buildArgs(f, false)),

  salesByPayment: (f: ReportFilters) =>
    callRpc<SalesByPayment>('report_sales_by_payment', buildArgs(f)),

  salesByTax: (f: ReportFilters) =>
    callRpc<SalesByTax>('report_sales_by_tax', buildArgs(f)),

  discounts: (f: ReportFilters) =>
    callRpc<DiscountReportRow>('report_discounts', buildArgs(f)),

  receipts: (f: ReportFilters, limit = 500) =>
    callRpc<ReceiptReportRow>('report_receipts', { ...buildArgs(f), p_limit: limit }),

  cashSessions: (f: ReportFilters) =>
    callRpc<CashSessionReportRow>('report_cash_sessions', buildArgs(f, false)),
};

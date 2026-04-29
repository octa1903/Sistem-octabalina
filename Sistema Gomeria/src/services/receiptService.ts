import { supabase } from './supabaseClient';
import { ensureNoError, rowToCamel } from './supabaseHelpers';
import type {
  Receipt,
  ReceiptLine,
  BuildReceiptInput,
  Discount,
  Tax,
  PaymentMethod,
  TireV2,
  TireStoreOverride,
  Category,
  LineDiscount,
  LineTax,
  AppliedDiscount,
  AppliedTax,
  ReceiptLineModifier,
  LoyaltyConfig,
} from '@/types';

const TABLE = 'receipts';
const LINES = 'receipt_lines';

const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

function sumModifiers(mods: ReceiptLineModifier[]): number {
  return sum(mods.map(m => m.price));
}

/**
 * Lookup helpers — caller debe inyectarlos. En la app real vendrán
 * de los services (categoryService, taxService, discountService, etc.).
 */
export interface ReceiptLookups {
  getTire: (id: string) => TireV2 | undefined;
  getOverride: (tireId: string, storeId: string) => TireStoreOverride | undefined;
  getCategory: (id: string) => Category | undefined;
  getTax: (id: string) => Tax | undefined;
  getDiscount: (id: string) => Discount | undefined;
  getPaymentMethod: (id: string) => PaymentMethod | undefined;
  loyalty: LoyaltyConfig;
  nextReceiptNumber: (storeId: string) => Promise<string>;
}

export const receiptService = {
  // ── Lecturas ──────────────────────────────────────

  async getById(id: string): Promise<Receipt | undefined> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToCamel<Receipt>(data) : undefined;
  },

  async getLines(receiptId: string): Promise<ReceiptLine[]> {
    const { data, error } = await supabase
      .from(LINES)
      .select('*')
      .eq('receipt_id', receiptId);
    return ensureNoError(data, error, 'receiptService.getLines').map(r => rowToCamel<ReceiptLine>(r));
  },

  async getByStore(
    storeId: string,
    opts: { limit?: number; from?: string; to?: string } = {},
  ): Promise<Receipt[]> {
    let q = supabase.from(TABLE).select('*').eq('store_id', storeId);
    if (opts.from) q = q.gte('created_at', opts.from);
    if (opts.to) q = q.lte('created_at', opts.to);
    q = q.order('created_at', { ascending: false });
    if (opts.limit) q = q.limit(opts.limit);
    const { data, error } = await q;
    return ensureNoError(data, error, 'receiptService.getByStore').map(r => rowToCamel<Receipt>(r));
  },

  async getBySession(sessionId: string): Promise<Receipt[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('cash_session_id', sessionId)
      .order('created_at', { ascending: false });
    return ensureNoError(data, error, 'receiptService.getBySession').map(r => rowToCamel<Receipt>(r));
  },

  async getParked(storeId: string): Promise<Receipt[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('store_id', storeId)
      .eq('status', 'parked')
      .order('created_at', { ascending: false });
    return ensureNoError(data, error, 'receiptService.getParked').map(r => rowToCamel<Receipt>(r));
  },

  // ── Construcción y persistencia ───────────────────

  /**
   * Construye Receipt + ReceiptLines y los persiste atómicamente vía RPC.
   * Lógica de cálculo según §7.1 del plan.
   */
  async buildAndSave(input: BuildReceiptInput, lookups: ReceiptLookups): Promise<Receipt> {
    const lines = input.cart.map(cartLine => buildLine(cartLine, input.storeId, lookups));

    const subtotalGross = sum(lines.map(l => l.gross));

    const ticketDiscounts: AppliedDiscount[] = input.ticketDiscountIds.map(id => {
      const d = lookups.getDiscount(id);
      if (!d) throw new Error(`Discount ${id} no encontrado`);
      const value = d.value;
      if (value === null) {
        throw new Error(`Discount ${d.name}: valor a pedir en venta no implementado en buildAndSave`);
      }
      const amount = d.type === 'percent' ? subtotalGross * (value / 100) : value;
      return { discountId: id, amount };
    });

    const totalDiscounts =
      sum(lines.flatMap(l => l.lineDiscounts).map(d => d.amount)) +
      sum(ticketDiscounts.map(d => d.amount));
    const subtotalNet = subtotalGross - totalDiscounts;
    const totalTaxes = sum(
      lines.flatMap(l => l.lineTaxes).filter(t => t.addedToTotal).map(t => t.amount),
    );
    const totalCogs = sum(lines.map(l => l.unitCost * l.quantity));

    // Surcharge de método de pago como recargo final
    const pmSurcharge = sum(
      input.paymentSplits.map(p => {
        const pm = lookups.getPaymentMethod(p.paymentMethodId);
        return p.amount * ((pm?.surchargePercent ?? 0) / 100);
      }),
    );

    const sumLineTotals = sum(lines.map(l => l.total));
    const totalRaw = sumLineTotals - sum(ticketDiscounts.map(d => d.amount)) + pmSurcharge;
    const total = input.type === 'refund' ? -Math.abs(totalRaw) : totalRaw;

    // Validaciones
    const paymentsTotal = sum(input.paymentSplits.map(p => p.amount));
    if (Math.abs(paymentsTotal - Math.abs(total)) > 0.01) {
      throw new Error(
        `Pagos no cuadran: pagos=${paymentsTotal.toFixed(2)} total=${Math.abs(total).toFixed(2)}`,
      );
    }
    if (input.type === 'sale' && total < 0) {
      throw new Error('Total negativo en venta');
    }

    // Lealtad
    const pointsEarned =
      input.customerId && lookups.loyalty.enabled
        ? Math.round(subtotalNet * (lookups.loyalty.earnPercent / 100))
        : 0;

    const appliedTaxes = rollupTaxes(lines);

    const receiptNumber = await lookups.nextReceiptNumber(input.storeId);

    const receiptPayload = {
      receipt_number: receiptNumber,
      store_id: input.storeId,
      cash_session_id: input.cashSessionId,
      employee_id: input.employeeId,
      customer_id: input.customerId ?? null,
      type: input.type,
      status: input.parkedName ? 'parked' : 'completed',
      parked_name: input.parkedName ?? null,
      applied_discounts: ticketDiscounts,
      applied_taxes: appliedTaxes,
      payments: input.paymentSplits,
      subtotal_gross: subtotalGross,
      total_discounts: totalDiscounts,
      subtotal_net: subtotalNet,
      total_taxes: totalTaxes,
      total_cogs: totalCogs,
      total,
      points_earned: pointsEarned,
      points_redeemed: input.pointsRedeemed ?? 0,
      notes: input.notes ?? null,
    };

    const linesPayload = lines.map(l => ({
      tire_id: l.tireId,
      tire_brand: l.tireBrand,
      tire_model: l.tireModel,
      tire_size: l.tireSize,
      category_id: l.categoryId,
      category_name: l.categoryName,
      modifiers: l.modifiers,
      unit_price: l.unitPrice,
      unit_cost: l.unitCost,
      quantity: l.quantity,
      line_discounts: l.lineDiscounts,
      line_taxes: l.lineTaxes,
      gross: l.gross,
      net: l.net,
      total: l.total,
    }));

    const { data, error } = await supabase.rpc('create_receipt_with_lines', {
      p_receipt: receiptPayload as unknown as never,
      p_lines: linesPayload as unknown as never,
    });
    if (error) {
      // eslint-disable-next-line no-console
      console.error('[receipt] create error:', error);
      throw new Error(error.message);
    }
    const receiptId = data as unknown as string;
    const r = await this.getById(receiptId);
    if (!r) throw new Error('Receipt creado pero no se pudo leer');
    return r;
  },
};

// ═══════════════════════════════════════════════════
// Helpers internos (puros — exportados para tests)
// ═══════════════════════════════════════════════════

export function buildLine(
  cartLine: BuildReceiptInput['cart'][number],
  storeId: string,
  lookups: ReceiptLookups,
): Omit<ReceiptLine, 'id' | 'receiptId'> {
  const tire = lookups.getTire(cartLine.tireId);
  if (!tire) throw new Error(`Tire ${cartLine.tireId} no encontrado`);
  const category = lookups.getCategory(tire.categoryId);
  if (!category) throw new Error(`Category ${tire.categoryId} no encontrado`);
  const ovr = lookups.getOverride(cartLine.tireId, storeId);
  const unitPrice = ovr?.price ?? tire.defaultPrice;
  const unitCost = tire.cost;
  const modSum = sumModifiers(cartLine.modifiers);
  const gross = (unitPrice + modSum) * cartLine.quantity;

  const lineDiscounts: LineDiscount[] = [];
  if (cartLine.lineDiscountId) {
    const d = lookups.getDiscount(cartLine.lineDiscountId);
    if (!d) throw new Error(`Discount ${cartLine.lineDiscountId} no encontrado`);
    if (d.value === null) throw new Error(`Discount ${d.name}: valor pedido en venta no soportado`);
    const amount = d.type === 'percent' ? gross * (d.value / 100) : d.value;
    lineDiscounts.push({ discountId: d.id, amount });
  }
  const net = gross - sum(lineDiscounts.map(d => d.amount));

  const lineTaxes: LineTax[] = tire.taxIds
    .map(id => lookups.getTax(id))
    .filter((t): t is Tax => Boolean(t))
    .filter(t => t.storeIds === null || t.storeIds.includes(storeId))
    .map(tax => {
      const amount =
        tax.inclusion === 'included'
          ? net - net / (1 + tax.rate / 100)
          : net * (tax.rate / 100);
      return {
        taxId: tax.id,
        rate: tax.rate,
        amount,
        addedToTotal: tax.inclusion === 'added',
      };
    });

  const total = net + sum(lineTaxes.filter(t => t.addedToTotal).map(t => t.amount));

  return {
    tireId: tire.id,
    tireBrand: tire.brand,
    tireModel: tire.model,
    tireSize: tire.size,
    categoryId: category.id,
    categoryName: category.name,
    modifiers: cartLine.modifiers,
    unitPrice,
    unitCost,
    quantity: cartLine.quantity,
    lineDiscounts,
    lineTaxes,
    gross,
    net,
    total,
  };
}

export function rollupTaxes(lines: Omit<ReceiptLine, 'id' | 'receiptId'>[]): AppliedTax[] {
  const map = new Map<string, AppliedTax>();
  for (const l of lines) {
    for (const t of l.lineTaxes) {
      const prev = map.get(t.taxId);
      const base = prev ? prev.base + l.net : l.net;
      const amount = (prev?.amount ?? 0) + t.amount;
      map.set(t.taxId, { taxId: t.taxId, base, amount });
    }
  }
  return Array.from(map.values());
}

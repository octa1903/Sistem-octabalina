// ═══════════════════════════════════════════════════
// rollupTaxes — agregación de un carrito de líneas a totales.
//
// Extraído de POSView. Toma N líneas (calculadas con `buildLine`),
// aplica descuento global de ticket, canje de puntos y recargo del
// método de pago, y devuelve totales + desglose de impuestos.
//
// El recargo es gross-up: total = base / (1 - rate). Para rate=0
// queda igual. Esto refleja la forma en que se carga el recargo
// en POS de Argentina (cliente paga 100% del recargo).
// ═══════════════════════════════════════════════════

export interface CartLineForRollup {
  /** Subtotal (gross) de la línea: qty * unitPrice. */
  gross: number;
  /** Impuestos por línea (de buildLine). */
  taxes: Array<{
    taxId: string;
    name: string;
    rate: number;
    addedToTotal: boolean;
    amount: number;
  }>;
}

export interface RollupTaxesInput {
  lines: CartLineForRollup[];
  /** Descuento global aplicado al subtotal del ticket. */
  ticketDiscount?:
    | { type: 'percent'; value: number }
    | { type: 'amount'; value: number }
    | null;
  /** Tope de descuento del rol del operador (en %, 100 = sin tope). */
  operatorMaxDiscountPct?: number;
  /** Puntos a canjear (1 punto = $1). Se acotan internamente. */
  pointsToRedeem?: number;
  /** Saldo de puntos disponibles del cliente. */
  customerPointsBalance?: number;
  /** Tasa de recargo del método de pago (0..1; ej 0.05 = 5%). */
  surchargeRate?: number;
}

export interface RollupTaxesResult {
  /** Suma de gross de todas las líneas. */
  subtotal: number;
  /** Monto efectivo de descuento de ticket aplicado (capped por rol). */
  ticketDiscountAmount: number;
  /** true si el descuento configurado excedía el tope del rol. */
  ticketDiscountWasCapped: boolean;
  /** Puntos efectivamente canjeados (capped por balance y subtotal). */
  pointsRedeemed: number;
  /** Base post-descuento + canje, pre-recargo. */
  subtotalAfterRedeem: number;
  /** Recargo del método de pago (>= 0). */
  surchargeAmount: number;
  /** Total final visible al cliente. */
  total: number;
  /** Impuestos incluidos en los precios (informativo, no suman al total). */
  taxesIncluded: Array<{ taxId: string; name: string; amount: number }>;
  /** Impuestos sumados al total (IVA agregado, percepciones). */
  taxesAdded: Array<{ taxId: string; name: string; amount: number }>;
}

export function rollupTaxes(input: RollupTaxesInput): RollupTaxesResult {
  const subtotal = input.lines.reduce((s, l) => s + l.gross, 0);

  const { amount: ticketDiscountAmount, wasCapped: ticketDiscountWasCapped } =
    computeTicketDiscount(subtotal, input.ticketDiscount, input.operatorMaxDiscountPct);

  const subtotalAfterDiscount = Math.max(0, subtotal - ticketDiscountAmount);

  const requested = Math.max(0, Math.floor(input.pointsToRedeem ?? 0));
  const available = Math.max(0, input.customerPointsBalance ?? 0);
  const pointsRedeemed = Math.min(requested, available, subtotalAfterDiscount);
  const subtotalAfterRedeem = Math.max(0, subtotalAfterDiscount - pointsRedeemed);

  const surchargeRate = clamp(input.surchargeRate ?? 0, 0, 0.999_999);
  const totalBeforeSurcharge = subtotalAfterRedeem;
  const total = surchargeRate > 0
    ? totalBeforeSurcharge / (1 - surchargeRate)
    : totalBeforeSurcharge;
  const surchargeAmount = total - totalBeforeSurcharge;

  // Desglose de impuestos: agrupar por taxId, sumando amounts.
  const included = new Map<string, { name: string; amount: number }>();
  const added = new Map<string, { name: string; amount: number }>();
  for (const line of input.lines) {
    for (const t of line.taxes) {
      const bucket = t.addedToTotal ? added : included;
      const cur = bucket.get(t.taxId) ?? { name: t.name, amount: 0 };
      cur.amount += t.amount;
      bucket.set(t.taxId, cur);
    }
  }

  return {
    subtotal,
    ticketDiscountAmount,
    ticketDiscountWasCapped,
    pointsRedeemed,
    subtotalAfterRedeem,
    surchargeAmount,
    total,
    taxesIncluded: Array.from(included, ([taxId, v]) => ({ taxId, ...v })),
    taxesAdded: Array.from(added, ([taxId, v]) => ({ taxId, ...v })),
  };
}

function computeTicketDiscount(
  subtotal: number,
  discount: RollupTaxesInput['ticketDiscount'],
  maxPct: number | undefined,
): { amount: number; wasCapped: boolean } {
  if (!discount || subtotal <= 0) return { amount: 0, wasCapped: false };
  const v = Number(discount.value);
  if (!Number.isFinite(v) || v <= 0) return { amount: 0, wasCapped: false };

  const raw = discount.type === 'percent'
    ? Math.min(subtotal, subtotal * (v / 100))
    : Math.min(subtotal, v);

  const cap = maxPct !== undefined && maxPct < 100
    ? subtotal * (maxPct / 100)
    : Infinity;
  const amount = Math.min(raw, cap);
  // Tolerancia de redondeo para que 100.00000001 no marque truncado.
  const wasCapped = raw > amount + 0.005;
  return { amount, wasCapped };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

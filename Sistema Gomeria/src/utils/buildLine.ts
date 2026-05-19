// ═══════════════════════════════════════════════════
// buildLine — cálculo de una línea de venta (pure function).
//
// Extraído de POSView para que la lógica de precios/impuestos por
// línea sea testeable y reutilizable (Fase B del plan de mejoras).
//
// Convenciones:
//   - `unitPrice` siempre es el precio que ve el cliente en la lista.
//     Si el impuesto es `inclusion: 'included'`, el precio YA contiene
//     el IVA. Si es `inclusion: 'added'`, se suma al total.
//   - El descuento de línea se aplica sobre el gross (qty * unitPrice)
//     antes de calcular los impuestos.
//   - Los redondeos se delegan al consumidor (el server es la fuente
//     de verdad para el total final).
// ═══════════════════════════════════════════════════

import type { Tax } from '@/types';

export interface BuildLineInput {
  /** Precio unitario tal como lo ve el cliente (puede contener IVA si el tax es 'included'). */
  unitPrice: number;
  quantity: number;
  /** Descuento por línea. `null`/`undefined` = sin descuento. */
  lineDiscount?:
    | { type: 'percent'; value: number }
    | { type: 'amount'; value: number }
    | null;
  /** Impuestos asociados al tire (ya filtrados por store). */
  taxes: Tax[];
}

export interface BuildLineResult {
  /** qty * unitPrice (precio de catálogo, sin descuento). */
  gross: number;
  /** Monto descontado (siempre >= 0). */
  discountAmount: number;
  /** gross - discountAmount, mínimo 0. Base para calcular impuestos. */
  net: number;
  /** Total visible al cliente: net + impuestos `added`. */
  total: number;
  /** Detalle por impuesto aplicado (en el orden recibido). */
  taxes: Array<{
    taxId: string;
    name: string;
    rate: number;
    /** true si el impuesto suma al total ('added'); false si está incluido en unitPrice. */
    addedToTotal: boolean;
    amount: number;
  }>;
}

/**
 * Calcula gross/net/total y desglose de impuestos para una línea de venta.
 *
 * Determinístico: misma entrada → misma salida. Sin side effects.
 */
export function buildLine(input: BuildLineInput): BuildLineResult {
  const quantity = Math.max(0, input.quantity);
  const unitPrice = Math.max(0, input.unitPrice);
  const gross = unitPrice * quantity;

  const discountAmount = computeLineDiscount(gross, input.lineDiscount);
  const net = Math.max(0, gross - discountAmount);

  const taxes = input.taxes.map(tax => {
    const amount = tax.inclusion === 'included'
      ? net - net / (1 + tax.rate / 100)
      : net * (tax.rate / 100);
    return {
      taxId: tax.id,
      name: tax.name,
      rate: tax.rate,
      addedToTotal: tax.inclusion === 'added',
      amount,
    };
  });

  const addedTaxes = taxes.reduce((s, t) => s + (t.addedToTotal ? t.amount : 0), 0);
  const total = net + addedTaxes;

  return { gross, discountAmount, net, total, taxes };
}

function computeLineDiscount(
  gross: number,
  discount: BuildLineInput['lineDiscount'],
): number {
  if (!discount) return 0;
  const v = Number(discount.value);
  if (!Number.isFinite(v) || v <= 0 || gross <= 0) return 0;
  const raw = discount.type === 'percent'
    ? gross * (v / 100)
    : v;
  return Math.min(gross, Math.max(0, raw));
}

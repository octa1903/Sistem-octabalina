import { describe, test, expect } from 'vitest';
import { rollupTaxes, type CartLineForRollup } from '../rollupTaxes';

function line(gross: number, taxes: CartLineForRollup['taxes'] = []): CartLineForRollup {
  return { gross, taxes };
}

describe('rollupTaxes', () => {
  test('ticket sin descuento ni puntos ni recargo ni impuestos', () => {
    const r = rollupTaxes({ lines: [line(100), line(50)] });
    expect(r.subtotal).toBe(150);
    expect(r.ticketDiscountAmount).toBe(0);
    expect(r.pointsRedeemed).toBe(0);
    expect(r.surchargeAmount).toBe(0);
    expect(r.total).toBe(150);
    expect(r.taxesIncluded).toEqual([]);
    expect(r.taxesAdded).toEqual([]);
  });

  test('descuento de ticket en porcentaje', () => {
    const r = rollupTaxes({
      lines: [line(200)],
      ticketDiscount: { type: 'percent', value: 10 },
    });
    expect(r.ticketDiscountAmount).toBe(20);
    expect(r.total).toBe(180);
  });

  test('descuento de ticket capped por rol del operador', () => {
    const r = rollupTaxes({
      lines: [line(100)],
      ticketDiscount: { type: 'percent', value: 30 },
      operatorMaxDiscountPct: 10,
    });
    expect(r.ticketDiscountAmount).toBe(10); // cap al 10% del subtotal
    expect(r.ticketDiscountWasCapped).toBe(true);
    expect(r.total).toBe(90);
  });

  test('descuento dentro del cap del rol no se marca como capped', () => {
    const r = rollupTaxes({
      lines: [line(100)],
      ticketDiscount: { type: 'percent', value: 5 },
      operatorMaxDiscountPct: 10,
    });
    expect(r.ticketDiscountAmount).toBe(5);
    expect(r.ticketDiscountWasCapped).toBe(false);
  });

  test('descuento maxPct=100 = sin tope', () => {
    const r = rollupTaxes({
      lines: [line(100)],
      ticketDiscount: { type: 'percent', value: 50 },
      operatorMaxDiscountPct: 100,
    });
    expect(r.ticketDiscountAmount).toBe(50);
    expect(r.ticketDiscountWasCapped).toBe(false);
  });

  test('canje de puntos cap por balance del cliente', () => {
    const r = rollupTaxes({
      lines: [line(500)],
      pointsToRedeem: 1000,
      customerPointsBalance: 200,
    });
    expect(r.pointsRedeemed).toBe(200);
    expect(r.total).toBe(300);
  });

  test('canje de puntos cap por subtotal post-descuento', () => {
    const r = rollupTaxes({
      lines: [line(100)],
      ticketDiscount: { type: 'amount', value: 30 },
      pointsToRedeem: 200,
      customerPointsBalance: 500,
    });
    // subtotal=100, descuento=30, subtotalAfterDiscount=70
    // puntos = min(200, 500, 70) = 70
    expect(r.pointsRedeemed).toBe(70);
    expect(r.total).toBe(0);
  });

  test('recargo del método de pago (gross-up)', () => {
    // base=100, recargo 5% → total = 100 / (1 - 0.05) = 105.2631...
    const r = rollupTaxes({
      lines: [line(100)],
      surchargeRate: 0.05,
    });
    expect(r.total).toBeCloseTo(100 / 0.95, 6);
    expect(r.surchargeAmount).toBeCloseTo(r.total - 100, 6);
  });

  test('recargo 0 no altera el total', () => {
    const r = rollupTaxes({ lines: [line(100)], surchargeRate: 0 });
    expect(r.total).toBe(100);
    expect(r.surchargeAmount).toBe(0);
  });

  test('flujo combinado: descuento + puntos + recargo', () => {
    // subtotal=1000, desc 10% = 100 → 900
    // puntos canjeados = 50 → 850
    // recargo 10% gross-up → 850 / 0.9 = 944.44...
    const r = rollupTaxes({
      lines: [line(1000)],
      ticketDiscount: { type: 'percent', value: 10 },
      pointsToRedeem: 50,
      customerPointsBalance: 500,
      surchargeRate: 0.10,
    });
    expect(r.ticketDiscountAmount).toBe(100);
    expect(r.pointsRedeemed).toBe(50);
    expect(r.subtotalAfterRedeem).toBe(850);
    expect(r.total).toBeCloseTo(850 / 0.90, 6);
  });

  test('agrega impuestos del mismo taxId entre líneas', () => {
    const ivaLine1 = line(121, [
      { taxId: 'iva', name: 'IVA 21%', rate: 21, addedToTotal: false, amount: 21 },
    ]);
    const ivaLine2 = line(242, [
      { taxId: 'iva', name: 'IVA 21%', rate: 21, addedToTotal: false, amount: 42 },
    ]);
    const r = rollupTaxes({ lines: [ivaLine1, ivaLine2] });
    expect(r.taxesIncluded).toHaveLength(1);
    expect(r.taxesIncluded[0].taxId).toBe('iva');
    expect(r.taxesIncluded[0].amount).toBe(63);
  });

  test('separa included y added en buckets diferentes', () => {
    const ln = line(100, [
      { taxId: 'iva', name: 'IVA', rate: 21, addedToTotal: false, amount: 21 },
      { taxId: 'iibb', name: 'IIBB', rate: 3, addedToTotal: true, amount: 3 },
    ]);
    const r = rollupTaxes({ lines: [ln] });
    expect(r.taxesIncluded.map(t => t.taxId)).toEqual(['iva']);
    expect(r.taxesAdded.map(t => t.taxId)).toEqual(['iibb']);
  });

  test('subtotal 0 con descuento configurado no rompe', () => {
    const r = rollupTaxes({
      lines: [],
      ticketDiscount: { type: 'percent', value: 50 },
    });
    expect(r.subtotal).toBe(0);
    expect(r.ticketDiscountAmount).toBe(0);
    expect(r.total).toBe(0);
  });
});

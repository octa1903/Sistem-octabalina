import { describe, test, expect } from 'vitest';
import { buildLine } from '../buildLine';
import type { Tax } from '@/types';

function tax(partial: Partial<Tax> & { id: string; rate: number; inclusion: 'included' | 'added' }): Tax {
  return {
    name: `Tax ${partial.id}`,
    appliesToTireIds: [],
    applyToNewTires: false,
    dependsOnOrderType: false,
    storeIds: null,
    ...partial,
  };
}

describe('buildLine', () => {
  test('caso simple sin descuento ni impuestos', () => {
    const r = buildLine({ unitPrice: 100, quantity: 2, taxes: [] });
    expect(r.gross).toBe(200);
    expect(r.discountAmount).toBe(0);
    expect(r.net).toBe(200);
    expect(r.total).toBe(200);
    expect(r.taxes).toEqual([]);
  });

  test('descuento en porcentaje', () => {
    const r = buildLine({
      unitPrice: 100,
      quantity: 2,
      lineDiscount: { type: 'percent', value: 10 },
      taxes: [],
    });
    expect(r.discountAmount).toBe(20);
    expect(r.net).toBe(180);
    expect(r.total).toBe(180);
  });

  test('descuento en monto fijo', () => {
    const r = buildLine({
      unitPrice: 100,
      quantity: 2,
      lineDiscount: { type: 'amount', value: 50 },
      taxes: [],
    });
    expect(r.discountAmount).toBe(50);
    expect(r.net).toBe(150);
  });

  test('descuento mayor al gross se trunca al gross', () => {
    const r = buildLine({
      unitPrice: 100,
      quantity: 1,
      lineDiscount: { type: 'amount', value: 500 },
      taxes: [],
    });
    expect(r.discountAmount).toBe(100);
    expect(r.net).toBe(0);
  });

  test('descuento negativo o NaN es ignorado', () => {
    const r1 = buildLine({
      unitPrice: 100, quantity: 1,
      lineDiscount: { type: 'percent', value: -5 },
      taxes: [],
    });
    expect(r1.discountAmount).toBe(0);

    const r2 = buildLine({
      unitPrice: 100, quantity: 1,
      lineDiscount: { type: 'amount', value: Number.NaN },
      taxes: [],
    });
    expect(r2.discountAmount).toBe(0);
  });

  test('impuesto INCLUDED — el precio ya contiene IVA', () => {
    // unitPrice=121 (incluye 21% IVA) → net=121, iva_contenido=21, total=121
    const r = buildLine({
      unitPrice: 121, quantity: 1,
      taxes: [tax({ id: 'iva21', rate: 21, inclusion: 'included' })],
    });
    expect(r.net).toBe(121);
    expect(r.total).toBe(121);
    expect(r.taxes).toHaveLength(1);
    expect(r.taxes[0].addedToTotal).toBe(false);
    expect(r.taxes[0].amount).toBeCloseTo(21, 6);
  });

  test('impuesto ADDED — se suma al total', () => {
    // unitPrice=100 (sin IVA) + 21% added → total=121, amount=21
    const r = buildLine({
      unitPrice: 100, quantity: 1,
      taxes: [tax({ id: 'iva21', rate: 21, inclusion: 'added' })],
    });
    expect(r.net).toBe(100);
    expect(r.total).toBeCloseTo(121, 6);
    expect(r.taxes[0].addedToTotal).toBe(true);
    expect(r.taxes[0].amount).toBeCloseTo(21, 6);
  });

  test('mezcla included + added en la misma línea', () => {
    // unitPrice=121 (con 21% IVA included) + 3% percepción IIBB added
    // net=121, iva_contenido=21, percepcion=3.63, total=124.63
    const r = buildLine({
      unitPrice: 121, quantity: 1,
      taxes: [
        tax({ id: 'iva', rate: 21, inclusion: 'included' }),
        tax({ id: 'iibb', rate: 3, inclusion: 'added' }),
      ],
    });
    expect(r.net).toBe(121);
    expect(r.taxes[0].amount).toBeCloseTo(21, 6);
    expect(r.taxes[1].amount).toBeCloseTo(3.63, 6);
    expect(r.total).toBeCloseTo(124.63, 6);
  });

  test('descuento se aplica antes del cálculo de impuestos', () => {
    // unitPrice=121 (con IVA included) - 10% descuento línea = net=108.9
    // iva_contenido = 108.9 - 108.9/1.21 = 18.9
    const r = buildLine({
      unitPrice: 121, quantity: 1,
      lineDiscount: { type: 'percent', value: 10 },
      taxes: [tax({ id: 'iva', rate: 21, inclusion: 'included' })],
    });
    expect(r.net).toBeCloseTo(108.9, 6);
    expect(r.taxes[0].amount).toBeCloseTo(108.9 - 108.9 / 1.21, 6);
    expect(r.total).toBeCloseTo(108.9, 6);
  });

  test('quantity 0 o negativa no produce error', () => {
    const r = buildLine({ unitPrice: 100, quantity: 0, taxes: [] });
    expect(r.gross).toBe(0);
    expect(r.net).toBe(0);
    expect(r.total).toBe(0);
  });

  test('precio unitario negativo se normaliza a 0', () => {
    const r = buildLine({ unitPrice: -50, quantity: 2, taxes: [] });
    expect(r.gross).toBe(0);
  });
});

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { validateRow, validateRows } from '../validation';
import { tireSchema, receiptSchema, cashSessionSchema, customerSchema } from '../schemas';
import type { TireV2, Receipt, CashSession, Customer } from '@/types';

const sampleSchema = z.object({ id: z.string(), amount: z.number() }).loose();

let warnSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
});

describe('validateRow', () => {
  test('devuelve el row cuando matchea el schema', () => {
    const out = validateRow(sampleSchema, { id: 'a', amount: 10 }, 'ctx');
    expect(out).toEqual({ id: 'a', amount: 10 });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test('null/undefined devuelve undefined sin warning (row ausente, no error)', () => {
    expect(validateRow(sampleSchema, null, 'ctx')).toBeUndefined();
    expect(validateRow(sampleSchema, undefined, 'ctx')).toBeUndefined();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test('row inválido degrada a undefined y loguea warning con el path', () => {
    const out = validateRow(sampleSchema, { id: 'a', amount: 'NaN' }, 'tire.getById');
    expect(out).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toContain('tire.getById');
    expect(warnSpy.mock.calls[0][0]).toContain('amount');
  });

  test('.loose() preserva propiedades extra no schematizadas', () => {
    const out = validateRow<{ id: string; amount: number; extra: string }>(
      sampleSchema,
      { id: 'a', amount: 10, extra: 'kept' },
      'ctx',
    );
    expect(out?.extra).toBe('kept');
  });
});

describe('validateRows', () => {
  test('conserva los válidos y descarta los inválidos (lenient)', () => {
    const rows = [
      { id: 'a', amount: 1 },
      { id: 'b', amount: 'bad' },
      { id: 'c', amount: 3 },
    ];
    const out = validateRows(sampleSchema, rows, 'ctx');
    expect(out).toHaveLength(2);
    expect(out.map(r => (r as { id: string }).id)).toEqual(['a', 'c']);
  });

  test('loguea un único warning con conteo cuando hay descartes', () => {
    const rows = [
      { id: 'a', amount: 'x' },
      { id: 'b', amount: 'y' },
    ];
    validateRows(sampleSchema, rows, 'receipt.getByStore');
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toContain('2/2');
    expect(warnSpy.mock.calls[0][0]).toContain('receipt.getByStore');
  });

  test('array vacío devuelve [] sin warning', () => {
    expect(validateRows(sampleSchema, [], 'ctx')).toEqual([]);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test('todos válidos: no loguea', () => {
    const out = validateRows(sampleSchema, [{ id: 'a', amount: 1 }], 'ctx');
    expect(out).toHaveLength(1);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe('schemas de bordes críticos', () => {
  const tire = {
    id: 't1', brand: 'Pirelli', model: 'P1', size: '175/70R13', categoryId: 'c1',
    cost: 100, defaultPrice: 150, defaultMargin: 50, availableInAllStores: true,
    createdAt: '2024-01-01', updatedAt: '2024-01-01', taxIds: [], modifierGroupIds: [],
  };

  test('tireSchema acepta un tire válido y preserva taxIds/modifierGroupIds', () => {
    const out = validateRow<TireV2>(tireSchema, tire, 'tire');
    expect(out?.id).toBe('t1');
    expect(out?.taxIds).toEqual([]);
  });

  test('tireSchema descarta tire con cost no numérico', () => {
    const out = validateRow<TireV2>(tireSchema, { ...tire, cost: 'cien' }, 'tire');
    expect(out).toBeUndefined();
  });

  test('cashSessionSchema degrada status corrupto a "closed" sin descartar la sesión', () => {
    const out = validateRow<CashSession>(
      cashSessionSchema,
      {
        id: 's1', storeId: 'st1', openedAt: '2024-01-01', openedByEmployeeId: 'e1',
        openingFloat: 0, status: 'GARBAGE',
      },
      'session',
    );
    expect(out).toBeDefined();
    expect(out?.status).toBe('closed');
  });

  test('receiptSchema degrada type corrupto a "sale" en vez de tirar el ticket', () => {
    const out = validateRow<Receipt>(
      receiptSchema,
      {
        id: 'r1', receiptNumber: '0001', storeId: 'st1', cashSessionId: 's1', employeeId: 'e1',
        type: '???', status: 'completed', appliedDiscounts: [], appliedTaxes: [], payments: [],
        subtotalGross: 100, totalDiscounts: 0, subtotalNet: 100, totalTaxes: 21, total: 121,
        createdAt: '2024-01-01',
      },
      'receipt',
    );
    expect(out).toBeDefined();
    expect(out?.type).toBe('sale');
  });

  test('receiptSchema descarta ticket con total no numérico', () => {
    const out = validateRow<Receipt>(
      receiptSchema,
      {
        id: 'r1', receiptNumber: '0001', storeId: 'st1', cashSessionId: 's1', employeeId: 'e1',
        type: 'sale', status: 'completed', appliedDiscounts: [], appliedTaxes: [], payments: [],
        subtotalGross: 100, totalDiscounts: 0, subtotalNet: 100, totalTaxes: 21, total: null,
        createdAt: '2024-01-01',
      },
      'receipt',
    );
    expect(out).toBeUndefined();
  });

  test('customerSchema degrada customerType inválido a "retail"', () => {
    const out = validateRow<Customer>(
      customerSchema,
      {
        id: 'c1', name: 'Juan', totalVisits: 0, totalSpent: 0, pointsBalance: 0,
        creditLimit: 0, accountBalance: 0, customerType: 'mayorista', createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      },
      'customer',
    );
    expect(out?.customerType).toBe('retail');
  });
});

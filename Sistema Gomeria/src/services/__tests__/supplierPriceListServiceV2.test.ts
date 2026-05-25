import { describe, expect, it } from 'vitest';
import {
  calcCostArs,
  validateImportInput,
  type ImportPriceListInput,
} from '../supplierPriceListServiceV2';

describe('calcCostArs', () => {
  it('ARS: devuelve el mismo costo', () => {
    expect(calcCostArs(150.65, 'ARS', null)).toBe(150.65);
    expect(calcCostArs(150.65, 'ARS', 1415)).toBe(150.65); // rate ignorado
  });

  it('USD: aplica rate y redondea a 2 decimales', () => {
    // Caso real BULL VIAL: USD 150.65 a cotización informal 1415 → ARS 213,169.75
    expect(calcCostArs(150.65, 'USD', 1415)).toBe(213169.75);
  });

  it('USD requiere rate > 0', () => {
    expect(() => calcCostArs(100, 'USD', null)).toThrow();
    expect(() => calcCostArs(100, 'USD', 0)).toThrow();
    expect(() => calcCostArs(100, 'USD', -1)).toThrow();
  });

  it('Rechaza costo negativo', () => {
    expect(() => calcCostArs(-1, 'ARS', null)).toThrow();
  });

  it('Costo 0 es válido (item gratis / promo)', () => {
    expect(calcCostArs(0, 'ARS', null)).toBe(0);
    expect(calcCostArs(0, 'USD', 1415)).toBe(0);
  });
});

describe('validateImportInput', () => {
  const baseInput: ImportPriceListInput = {
    supplierName: 'BULL VIAL',
    listName: 'BULL VIAL 2026-05',
    currency: 'USD',
    exchangeRateId: 'xr-uuid',
    effectiveDate: '2026-05-24',
    items: [
      { rawSize: '205R16C', costOriginal: 150.65 },
    ],
  };

  it('Input válido: sin errores', () => {
    expect(validateImportInput(baseInput)).toEqual([]);
  });

  it('USD sin exchangeRateId: error', () => {
    const bad = { ...baseInput, exchangeRateId: undefined };
    expect(validateImportInput(bad)).toContain('USD requiere exchangeRateId');
  });

  it('ARS no requiere exchangeRateId', () => {
    const ok: ImportPriceListInput = {
      ...baseInput,
      currency: 'ARS',
      exchangeRateId: undefined,
    };
    expect(validateImportInput(ok)).toEqual([]);
  });

  it('supplierName vacío: error', () => {
    expect(validateImportInput({ ...baseInput, supplierName: '   ' }))
      .toContain('supplierName requerido');
  });

  it('listName vacío: error', () => {
    expect(validateImportInput({ ...baseInput, listName: '' }))
      .toContain('listName requerido');
  });

  it('effectiveDate inválida: error', () => {
    expect(validateImportInput({ ...baseInput, effectiveDate: '24/05/2026' }))
      .toContain('effectiveDate inválida (YYYY-MM-DD)');
  });

  it('items vacío: error', () => {
    expect(validateImportInput({ ...baseInput, items: [] }))
      .toContain('items vacío');
  });

  it('item sin rawSize: error con índice', () => {
    const bad = {
      ...baseInput,
      items: [{ rawSize: '', costOriginal: 100 }],
    };
    expect(validateImportInput(bad)).toContain('items[0].rawSize requerido');
  });

  it('item con costo inválido: error con índice', () => {
    const bad = {
      ...baseInput,
      items: [
        { rawSize: '205R16', costOriginal: 100 },
        { rawSize: '195R15', costOriginal: -5 },
      ],
    };
    expect(validateImportInput(bad)).toContain('items[1].costOriginal inválido');
  });

  it('Acumula múltiples errores', () => {
    const bad: ImportPriceListInput = {
      supplierName: '',
      listName: '',
      currency: 'USD',
      effectiveDate: 'bad',
      items: [],
    };
    const errors = validateImportInput(bad);
    expect(errors.length).toBeGreaterThanOrEqual(4);
  });
});

import { describe, expect, it } from 'vitest';
import {
  equilibriumRate,
  convertUsdToArs,
  convertArsToUsd,
  todayIso,
} from '../exchangeRateServiceV2';

describe('equilibriumRate', () => {
  it('Promedio de compra y venta', () => {
    expect(equilibriumRate(1405, 1425)).toBe(1415);
  });

  it('Acepta decimales', () => {
    expect(equilibriumRate(1000.5, 1001.5)).toBe(1001);
  });

  it('Rechaza valores no positivos', () => {
    expect(() => equilibriumRate(0, 100)).toThrow();
    expect(() => equilibriumRate(100, -5)).toThrow();
    expect(() => equilibriumRate(NaN, 100)).toThrow();
  });
});

describe('convertUsdToArs', () => {
  it('USD 150.65 × 1415 = 213,169.75', () => {
    // 150.65 * 1415 = 213,169.75 — el costo real de un 205R16C BULL VIAL.
    expect(convertUsdToArs(150.65, 1415)).toBe(213169.75);
  });

  it('USD 0 = ARS 0', () => {
    expect(convertUsdToArs(0, 1415)).toBe(0);
  });

  it('Redondea a 2 decimales', () => {
    // 1/3 * 1000 = 333.333... → 333.33
    expect(convertUsdToArs(1 / 3, 1000)).toBe(333.33);
  });

  it('Rechaza rate <= 0', () => {
    expect(() => convertUsdToArs(100, 0)).toThrow();
    expect(() => convertUsdToArs(100, -10)).toThrow();
  });

  it('Rechaza amount negativo', () => {
    expect(() => convertUsdToArs(-1, 1000)).toThrow();
  });
});

describe('convertArsToUsd', () => {
  it('ARS 213,169.75 ÷ 1415 ≈ USD 150.65', () => {
    expect(convertArsToUsd(213169.75, 1415)).toBeCloseTo(150.65, 2);
  });

  it('Round-trip USD→ARS→USD preserva ~2 decimales', () => {
    const usd = 150.65;
    const ars = convertUsdToArs(usd, 1415);
    expect(convertArsToUsd(ars, 1415)).toBeCloseTo(usd, 2);
  });

  it('Rechaza rate <= 0', () => {
    expect(() => convertArsToUsd(1000, 0)).toThrow();
  });
});

describe('todayIso', () => {
  it('Devuelve formato YYYY-MM-DD', () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('Es estable dentro de la misma llamada', () => {
    const a = todayIso();
    const b = todayIso();
    // Pueden diferir solo si cruzamos medianoche entre líneas; aceptamos eso.
    expect(a === b || a.slice(0, 7) === b.slice(0, 7)).toBe(true);
  });
});

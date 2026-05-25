import { describe, expect, it } from 'vitest';
import { variationPct } from '../TireCostHistory';

describe('variationPct', () => {
  it('Sube 10%', () => {
    expect(variationPct(110, 100)).toBe(10);
  });

  it('Baja 5%', () => {
    expect(variationPct(95, 100)).toBe(-5);
  });

  it('Sin cambio: 0%', () => {
    expect(variationPct(100, 100)).toBe(0);
  });

  it('Caso real: USD 150.65 × 1500 vs × 1415 = +6%', () => {
    const nuevo = 150.65 * 1500;
    const viejo = 150.65 * 1415;
    expect(variationPct(nuevo, viejo)).toBeCloseTo(6, 0);
  });

  it('Previous 0 o negativo: null', () => {
    expect(variationPct(100, 0)).toBeNull();
    expect(variationPct(100, -5)).toBeNull();
  });

  it('Previous NaN/Infinity: null', () => {
    expect(variationPct(100, NaN)).toBeNull();
    expect(variationPct(100, Infinity)).toBeNull();
  });

  it('Redondea a 1 decimal', () => {
    // 1234.5 → 1235 con redondeo a entero. Acá: 100 → 133.33 sube 33.33%
    expect(variationPct(133.33, 100)).toBe(33.3);
  });
});

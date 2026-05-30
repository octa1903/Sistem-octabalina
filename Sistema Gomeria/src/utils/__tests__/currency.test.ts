import { describe, test, expect, vi, beforeEach } from 'vitest';
import {
  toMoney,
  sumMoney,
  formatCurrency,
  formatCurrencyAbs,
  formatDecimal,
  calculateMargin,
  MAX_SANE_AMOUNT,
} from '../currency';

beforeEach(() => {
  // Silenciar los warnings esperados de datos corruptos durante los tests.
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('toMoney', () => {
  test('pasa números finitos válidos sin tocarlos', () => {
    expect(toMoney(0)).toBe(0);
    expect(toMoney(1234.5)).toBe(1234.5);
    expect(toMoney(-980)).toBe(-980);
  });

  test('degrada NaN / Infinity / -Infinity a 0', () => {
    expect(toMoney(NaN)).toBe(0);
    expect(toMoney(Infinity)).toBe(0);
    expect(toMoney(-Infinity)).toBe(0);
  });

  test('degrada null / undefined / objetos a 0', () => {
    expect(toMoney(null)).toBe(0);
    expect(toMoney(undefined)).toBe(0);
    expect(toMoney({})).toBe(0);
    expect(toMoney([])).toBe(0);
  });

  test('parsea strings numéricos canónicos', () => {
    expect(toMoney('1234.56')).toBe(1234.56);
    expect(toMoney('-42')).toBe(-42);
  });

  test('parsea strings con formato es-AR (1.234,56)', () => {
    expect(toMoney('1.234,56')).toBe(1234.56);
    expect(toMoney('2.662.722.686')).toBe(2662722686);
  });

  test('degrada strings no numéricos a 0', () => {
    expect(toMoney('abc')).toBe(0);
    expect(toMoney('')).toBe(0);
  });

  test('degrada montos absurdos fuera de rango razonable a 0', () => {
    // El bug reportado: saldos de migración rota tipo $2.662.722.686.
    // 2.662.722.686 < 1e12, así que NO se degrada (es grande pero finito).
    expect(toMoney(2_662_722_686)).toBe(2_662_722_686);
    // Pero un valor verdaderamente fuera de rango sí se degrada.
    expect(toMoney(MAX_SANE_AMOUNT + 1)).toBe(0);
    expect(toMoney(-MAX_SANE_AMOUNT - 1)).toBe(0);
    expect(toMoney(1e20)).toBe(0);
  });
});

describe('sumMoney', () => {
  test('suma una lista de montos válidos', () => {
    expect(sumMoney([10, 20, 30])).toBe(60);
  });

  test('ignora elementos corruptos sin envenenar el total', () => {
    expect(sumMoney([10, NaN, 20, undefined, 30, Infinity])).toBe(60);
  });

  test('lista vacía → 0', () => {
    expect(sumMoney([])).toBe(0);
  });
});

describe('formatCurrency (defensivo)', () => {
  test('nunca produce "NaN" ni "Infinity" en la salida', () => {
    expect(formatCurrency(NaN)).not.toContain('NaN');
    expect(formatCurrency(Infinity)).not.toContain('∞');
    expect(formatCurrency(undefined)).not.toMatch(/nan/i);
  });

  test('un valor corrupto se muestra como $0', () => {
    // Mismo resultado que formatear 0.
    expect(formatCurrency(NaN)).toBe(formatCurrency(0));
    expect(formatCurrency(undefined)).toBe(formatCurrency(0));
  });

  test('formatea montos válidos en ARS', () => {
    const out = formatCurrency(1500);
    expect(out).toMatch(/1\.500/);
  });

  test('formatCurrencyAbs usa valor absoluto', () => {
    expect(formatCurrencyAbs(-1500)).toBe(formatCurrency(1500));
    expect(formatCurrencyAbs(NaN)).toBe(formatCurrency(0));
  });
});

describe('formatDecimal (defensivo)', () => {
  test('degrada valores corruptos a 0,00', () => {
    expect(formatDecimal(NaN)).toBe(formatDecimal(0));
  });
});

describe('calculateMargin', () => {
  test('costo 0 → 0 (evita división por cero)', () => {
    expect(calculateMargin(0, 100)).toBe(0);
  });

  test('entradas corruptas no rompen el cálculo', () => {
    expect(calculateMargin(NaN, 100)).toBe(0);
    expect(calculateMargin(100, NaN)).toBe(-100);
  });
});

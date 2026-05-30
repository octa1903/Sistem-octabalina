import { describe, test, expect } from 'vitest';
import { normalizeStockEntries } from '../tireServiceV2';

describe('normalizeStockEntries', () => {
  test('suma cantidades válidas por tire', () => {
    const r = normalizeStockEntries([
      { tireId: 'a', quantity: 2 },
      { tireId: 'b', quantity: 5 },
    ]);
    expect(r.get('a')).toBe(2);
    expect(r.get('b')).toBe(5);
    expect(r.size).toBe(2);
  });

  test('acumula entradas repetidas del mismo tire', () => {
    const r = normalizeStockEntries([
      { tireId: 'a', quantity: 2 },
      { tireId: 'a', quantity: 3 },
    ]);
    expect(r.get('a')).toBe(5);
    expect(r.size).toBe(1);
  });

  test('descarta cantidades <= 0', () => {
    const r = normalizeStockEntries([
      { tireId: 'a', quantity: 0 },
      { tireId: 'b', quantity: -4 },
      { tireId: 'c', quantity: 1 },
    ]);
    expect(r.has('a')).toBe(false);
    expect(r.has('b')).toBe(false);
    expect(r.get('c')).toBe(1);
  });

  test('descarta NaN / Infinity', () => {
    const r = normalizeStockEntries([
      { tireId: 'a', quantity: NaN },
      { tireId: 'b', quantity: Infinity },
      { tireId: 'c', quantity: 3 },
    ]);
    expect(r.has('a')).toBe(false);
    expect(r.has('b')).toBe(false);
    expect(r.get('c')).toBe(3);
  });

  test('trunca decimales a entero (no se cargan medias cubiertas)', () => {
    const r = normalizeStockEntries([{ tireId: 'a', quantity: 2.9 }]);
    expect(r.get('a')).toBe(2);
  });

  test('ignora entradas sin tireId', () => {
    const r = normalizeStockEntries([
      { tireId: '', quantity: 5 },
      { tireId: 'a', quantity: 1 },
    ]);
    expect(r.size).toBe(1);
    expect(r.get('a')).toBe(1);
  });

  test('lista vacía → map vacío', () => {
    expect(normalizeStockEntries([]).size).toBe(0);
  });
});

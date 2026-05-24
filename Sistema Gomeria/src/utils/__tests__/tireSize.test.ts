import { describe, test, expect } from 'vitest';
import { parseTireSize, compareTireSize } from '../tireSize';

describe('parseTireSize', () => {
  test('métrica radial estándar "205/55 R16"', () => {
    const r = parseTireSize('205/55 R16');
    expect(r.rim).toBe(16);
    expect(r.width).toBe(205);
    expect(r.profile).toBe(55);
  });

  test('métrica radial sin espacio "205/55R16"', () => {
    const r = parseTireSize('205/55R16');
    expect(r.rim).toBe(16);
    expect(r.width).toBe(205);
    expect(r.profile).toBe(55);
  });

  test('camión con rim decimal "295/80 R22.5"', () => {
    const r = parseTireSize('295/80 R22.5');
    expect(r.rim).toBe(22.5);
    expect(r.width).toBe(295);
    expect(r.profile).toBe(80);
  });

  test('imperial "31x10.50 R15"', () => {
    const r = parseTireSize('31X10.50 R15');
    expect(r.rim).toBe(15);
    expect(r.width).toBe(10.5);
    expect(r.profile).toBeNull();
  });

  test('imperial con guión "33X12.5-15"', () => {
    const r = parseTireSize('33X12.5-15');
    expect(r.rim).toBe(15);
    expect(r.width).toBe(12.5);
    expect(r.profile).toBeNull();
  });

  test('diagonal "7.50-16"', () => {
    const r = parseTireSize('7.50-16');
    expect(r.rim).toBe(16);
    expect(r.width).toBe(7.5);
    expect(r.profile).toBeNull();
  });

  test('agrícola "12.4-24"', () => {
    const r = parseTireSize('12.4-24');
    expect(r.rim).toBe(24);
    expect(r.width).toBe(12.4);
  });

  test('implemento con barra y guión "400/60-15.5"', () => {
    const r = parseTireSize('400/60-15.5');
    expect(r.rim).toBe(15.5);
    expect(r.width).toBe(400);
    expect(r.profile).toBe(60);
  });

  test('LT prefix "LT225/75 R15"', () => {
    const r = parseTireSize('LT225/75 R15');
    expect(r.rim).toBe(15);
    expect(r.width).toBe(225);
    expect(r.profile).toBe(75);
  });

  test('formato inválido devuelve Infinity para ir al final', () => {
    const r = parseTireSize('no es una medida');
    expect(r.rim).toBe(Number.POSITIVE_INFINITY);
    expect(r.width).toBe(Number.POSITIVE_INFINITY);
    expect(r.profile).toBeNull();
  });

  test('string vacío devuelve Infinity', () => {
    const r = parseTireSize('');
    expect(r.rim).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('compareTireSize', () => {
  test('R13 antes que R16', () => {
    expect(compareTireSize('175/70 R13', '195/65 R16')).toBeLessThan(0);
  });

  test('dentro del mismo rim, ancho menor primero', () => {
    expect(compareTireSize('195/65 R16', '215/55 R16')).toBeLessThan(0);
  });

  test('dentro del mismo rim+ancho, perfil menor primero', () => {
    expect(compareTireSize('205/55 R16', '205/65 R16')).toBeLessThan(0);
  });

  test('R22.5 después de R20', () => {
    expect(compareTireSize('275/55 R20', '295/80 R22.5')).toBeLessThan(0);
  });

  test('medidas inválidas van al final', () => {
    expect(compareTireSize('basura', '175/70 R13')).toBeGreaterThan(0);
  });

  test('orden estable: ordena una lista mezclada de R13 a R22.5', () => {
    const sizes = ['295/80 R22.5', '175/70 R13', '205/55 R16', '7.50-16', '31X10.50 R15'];
    const sorted = [...sizes].sort(compareTireSize);
    // El orden esperado: R13 < R15 (imperial e impĺementos) < R16 (radial < diagonal por width) < R22.5
    expect(sorted[0]).toBe('175/70 R13');
    expect(sorted[sorted.length - 1]).toBe('295/80 R22.5');
  });
});

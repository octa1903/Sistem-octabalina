import { describe, it, expect } from 'vitest';
import {
  validateFiscalIdentity,
  hasErrors,
  formatCuit,
  needsFirstRunSetup,
  EMPTY_FISCAL_IDENTITY,
} from '../storeService';
import type { Store, FiscalIdentity } from '@/types';

describe('validateFiscalIdentity', () => {
  const valid: FiscalIdentity = {
    ...EMPTY_FISCAL_IDENTITY,
    razonSocial: 'Baliña Ruedas',
    cuit: '30-70154166-5',
  };

  it('marca razón social vacía como error', () => {
    const e = validateFiscalIdentity({ ...valid, razonSocial: '   ' });
    expect(e.razonSocial).toBeDefined();
    expect(hasErrors(e)).toBe(true);
  });

  it('marca CUIT vacío como error', () => {
    const e = validateFiscalIdentity({ ...valid, cuit: '' });
    expect(e.cuit).toBe('CUIT es requerido.');
  });

  it('rechaza CUIT con letras', () => {
    const e = validateFiscalIdentity({ ...valid, cuit: 'abc-123' });
    expect(e.cuit).toContain('inválido');
  });

  it('rechaza CUIT demasiado corto', () => {
    const e = validateFiscalIdentity({ ...valid, cuit: '123' });
    expect(e.cuit).toContain('inválido');
  });

  it('acepta CUIT sin guiones (11 dígitos)', () => {
    const e = validateFiscalIdentity({ ...valid, cuit: '30701541665' });
    expect(e.cuit).toBeUndefined();
  });

  it('acepta CUIT con guiones', () => {
    const e = validateFiscalIdentity({ ...valid, cuit: '30-70154166-5' });
    expect(e.cuit).toBeUndefined();
  });

  it('rechaza fecha de inicio en formato incorrecto', () => {
    const e = validateFiscalIdentity({ ...valid, inicioActiv: '2025/01/01' });
    expect(e.inicioActiv).toContain('inválida');
  });

  it('acepta fecha de inicio en YYYY-MM-DD', () => {
    const e = validateFiscalIdentity({ ...valid, inicioActiv: '2025-01-15' });
    expect(e.inicioActiv).toBeUndefined();
  });

  it('devuelve objeto vacío cuando todos los campos son válidos', () => {
    const e = validateFiscalIdentity(valid);
    expect(e).toEqual({});
    expect(hasErrors(e)).toBe(false);
  });
});

describe('formatCuit', () => {
  it('normaliza 11 dígitos sin separador a XX-XXXXXXXX-X', () => {
    expect(formatCuit('30701541665')).toBe('30-70154166-5');
  });

  it('es idempotente con input ya formateado', () => {
    expect(formatCuit('30-70154166-5')).toBe('30-70154166-5');
  });

  it('devuelve el input tal cual si tiene menos de 11 dígitos', () => {
    expect(formatCuit('123')).toBe('123');
  });

  it('devuelve el input tal cual si tiene letras', () => {
    expect(formatCuit('abc-123')).toBe('abc-123');
  });

  it('limpia espacios y reformatea', () => {
    expect(formatCuit(' 30 70154166 5 ')).toBe('30-70154166-5');
  });
});

describe('needsFirstRunSetup', () => {
  function makeStore(fi: FiscalIdentity | null): Store {
    return {
      id: 's1',
      name: 'Test',
      active: true,
      fiscalIdentity: fi ?? undefined,
    } as Store;
  }

  it('devuelve false si store es null o undefined', () => {
    expect(needsFirstRunSetup(null)).toBe(false);
    expect(needsFirstRunSetup(undefined)).toBe(false);
  });

  it('devuelve true si fiscalIdentity está ausente', () => {
    expect(needsFirstRunSetup(makeStore(null))).toBe(true);
  });

  it('devuelve true si falta razón social', () => {
    expect(needsFirstRunSetup(makeStore({ ...EMPTY_FISCAL_IDENTITY, cuit: '30-70154166-5' }))).toBe(true);
  });

  it('devuelve true si falta CUIT', () => {
    expect(needsFirstRunSetup(makeStore({ ...EMPTY_FISCAL_IDENTITY, razonSocial: 'X' }))).toBe(true);
  });

  it('devuelve false cuando hay razón social + CUIT', () => {
    expect(
      needsFirstRunSetup(
        makeStore({ ...EMPTY_FISCAL_IDENTITY, razonSocial: 'X', cuit: '30-70154166-5' }),
      ),
    ).toBe(false);
  });
});

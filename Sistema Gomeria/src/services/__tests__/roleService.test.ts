import { describe, expect, it } from 'vitest';
import type { Role } from '@/types';
import { hasPermission, maxDiscountFor } from '../roleService';

const cajero: Role = {
  id: 'r-cajero',
  name: 'Cajero',
  isSystem: true,
  maxDiscountPercent: 100,
  permissions: ['pos.sell', 'pos.discount', 'pos.openTickets', 'pos.openCash', 'pos.closeCash', 'customers.view'],
};

const propietario: Role = {
  id: 'r-prop',
  name: 'Propietario',
  isSystem: true,
  maxDiscountPercent: 100,
  permissions: [
    'pos.sell', 'pos.refund', 'pos.discount', 'pos.openTickets',
    'pos.openCash', 'pos.closeCash', 'pos.cashMovement',
    'discounts.unrestricted', 'backoffice.access',
    'tires.view', 'tires.manage', 'reports.view',
    'employees.manage', 'customers.view', 'customers.manage', 'settings.manage',
  ],
};

describe('hasPermission', () => {
  it('retorna false si role es null', () => {
    expect(hasPermission(null, 'pos.sell')).toBe(false);
  });

  it('retorna false si role es undefined', () => {
    expect(hasPermission(undefined, 'pos.sell')).toBe(false);
  });

  it('retorna true cuando el permiso está en la lista', () => {
    expect(hasPermission(cajero, 'pos.sell')).toBe(true);
    expect(hasPermission(propietario, 'employees.manage')).toBe(true);
  });

  it('retorna false cuando el permiso no está en la lista', () => {
    expect(hasPermission(cajero, 'pos.refund')).toBe(false);
    expect(hasPermission(cajero, 'employees.manage')).toBe(false);
    expect(hasPermission(cajero, 'reports.view')).toBe(false);
  });

  it('Propietario tiene permisos de back-office y settings', () => {
    expect(hasPermission(propietario, 'backoffice.access')).toBe(true);
    expect(hasPermission(propietario, 'settings.manage')).toBe(true);
    expect(hasPermission(propietario, 'reports.view')).toBe(true);
  });

  it('Cajero no puede gestionar inventario ni empleados', () => {
    expect(hasPermission(cajero, 'tires.manage')).toBe(false);
    expect(hasPermission(cajero, 'employees.manage')).toBe(false);
    expect(hasPermission(cajero, 'settings.manage')).toBe(false);
  });

  it('reports.audit es un permiso reconocido (migration 0030)', () => {
    // El cajero no tiene reports.audit por default; el propietario sí cuando
    // se lo asignen explícitamente. Este test fija el contrato del tipo.
    expect(hasPermission(cajero, 'reports.audit')).toBe(false);
    const auditor: Role = { ...cajero, permissions: [...cajero.permissions, 'reports.audit'] };
    expect(hasPermission(auditor, 'reports.audit')).toBe(true);
  });
});

describe('maxDiscountFor', () => {
  it('retorna 100 si role es null/undefined (sin tope por defecto)', () => {
    expect(maxDiscountFor(null)).toBe(100);
    expect(maxDiscountFor(undefined)).toBe(100);
  });

  it('retorna 100 si el rol tiene discounts.unrestricted', () => {
    expect(maxDiscountFor(propietario)).toBe(100);
  });

  it('respeta maxDiscountPercent cuando no tiene discounts.unrestricted', () => {
    const limited: Role = { ...cajero, maxDiscountPercent: 15 };
    expect(maxDiscountFor(limited)).toBe(15);
  });

  it('fallback a 100 si maxDiscountPercent es undefined (rol legacy sin migrar)', () => {
    const legacy = { ...cajero, maxDiscountPercent: undefined as unknown as number };
    expect(maxDiscountFor(legacy)).toBe(100);
  });

  it('un cajero con tope 0% no puede aplicar descuento', () => {
    const noDiscount: Role = { ...cajero, maxDiscountPercent: 0 };
    expect(maxDiscountFor(noDiscount)).toBe(0);
  });
});

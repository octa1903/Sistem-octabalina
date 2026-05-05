import { describe, expect, it } from 'vitest';
import type { Role } from '@/types';
import { hasPermission } from '../roleService';

const cajero: Role = {
  id: 'r-cajero',
  name: 'Cajero',
  isSystem: true,
  permissions: ['pos.sell', 'pos.discount', 'pos.openTickets', 'pos.openCash', 'pos.closeCash', 'customers.view'],
};

const propietario: Role = {
  id: 'r-prop',
  name: 'Propietario',
  isSystem: true,
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
});

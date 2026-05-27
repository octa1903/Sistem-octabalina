// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Store } from '@/types';
import { EMPTY_FISCAL_IDENTITY } from '@/services/storeService';
import { FirstRunWizard } from '../FirstRunWizard';

// Mockear roleService.getAll en BootstrapAdminStep para evitar I/O Supabase.
vi.mock('@/services/roleService', () => ({
  roleService: {
    getAll: vi.fn().mockResolvedValue([
      { id: 'r1', name: 'Propietario', permissions: ['settings.manage'], maxDiscountPercent: 100 },
    ]),
  },
  hasPermission: vi.fn(() => true),
}));

vi.mock('@/services/storeService', async () => {
  const actual = await vi.importActual<typeof import('@/services/storeService')>('@/services/storeService');
  return {
    ...actual,
    storeService: {
      updateFiscalIdentity: vi.fn().mockResolvedValue({ id: 's1', name: 'Test' }),
    },
  };
});

vi.mock('@/services/employeeService', () => ({
  employeeService: {
    save: vi.fn().mockResolvedValue({ id: 'e1', name: 'Test admin' }),
  },
  needsAdminBootstrap: vi.fn().mockResolvedValue(false),
}));

const storeMissingFiscal: Store = {
  id: 's1',
  name: 'Baliña Ruedas',
  active: true,
  fiscalIdentity: undefined,
} as Store;

const storeWithFiscal: Store = {
  id: 's1',
  name: 'Baliña Ruedas',
  active: true,
  fiscalIdentity: { ...EMPTY_FISCAL_IDENTITY, razonSocial: 'X', cuit: '30-70154166-5' },
} as Store;

describe('FirstRunWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no renderiza nada si no falta ningún paso', () => {
    const { container } = render(
      <FirstRunWizard store={storeWithFiscal} needsAdmin={false} addToast={vi.fn()} onCompleted={vi.fn()} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renderiza el paso fiscal cuando falta identidad fiscal', () => {
    render(
      <FirstRunWizard store={storeMissingFiscal} needsAdmin={false} addToast={vi.fn()} onCompleted={vi.fn()} />,
    );
    expect(screen.getByText(/Configurá Baliña Ruedas/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Guardar y continuar/i })).toBeDefined();
  });

  it('renderiza el paso admin cuando solo falta admin', () => {
    render(
      <FirstRunWizard store={storeWithFiscal} needsAdmin={true} addToast={vi.fn()} onCompleted={vi.fn()} />,
    );
    expect(
      screen.getByText(/Creá el primer operador con permisos de administración/i),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: /Crear operador/i })).toBeDefined();
  });

  it('muestra ambos pasos en el indicador cuando faltan los dos', () => {
    render(
      <FirstRunWizard
        store={storeMissingFiscal}
        needsAdmin={true}
        addToast={vi.fn()}
        onCompleted={vi.fn()}
      />,
    );
    // El primer paso visible es fiscal (es el primero de la lista).
    expect(screen.getByText(/Datos fiscales/i)).toBeDefined();
    expect(screen.getByText(/Operador admin/i)).toBeDefined();
  });
});

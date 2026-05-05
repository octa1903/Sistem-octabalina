import { describe, expect, it } from 'vitest';
import { rollupSupplierInvoice } from '../supplierInvoiceService';

describe('rollupSupplierInvoice', () => {
  it('Factura A aplica IVA 21% sobre subtotal', () => {
    const items = [
      { description: 'Cubierta', quantity: 4, unitPrice: 100, subtotal: 400 },
      { description: 'Válvula', quantity: 4, unitPrice: 25, subtotal: 100 },
    ];
    const r = rollupSupplierInvoice(items, 'A');
    expect(r.subtotal).toBe(500);
    expect(r.iva).toBeCloseTo(105, 6);
    expect(r.total).toBeCloseTo(605, 6);
  });

  it('Factura B/C/X no agrega IVA explícito (precio final)', () => {
    const items = [{ description: 'X', quantity: 1, unitPrice: 1000, subtotal: 1000 }];
    for (const t of ['B', 'C', 'X'] as const) {
      const r = rollupSupplierInvoice(items, t);
      expect(r.iva).toBe(0);
      expect(r.total).toBe(1000);
    }
  });

  it('Sin ítems devuelve ceros', () => {
    const r = rollupSupplierInvoice([], 'A');
    expect(r).toEqual({ subtotal: 0, iva: 0, total: 0 });
  });
});

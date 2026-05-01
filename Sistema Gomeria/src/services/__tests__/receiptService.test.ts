import { describe, expect, it } from 'vitest';
import type {
  TireV2, TireStoreOverride, Category, Tax, Discount, PaymentMethod, LoyaltyConfig,
  BuildReceiptInput,
} from '@/types';
import { buildLine, rollupTaxes, type ReceiptLookups } from '../receiptService';

const STORE = 'store-1';

const cat: Category = { id: 'cat-1', name: 'Auto', color: '#000', sortOrder: 0 };
const taxIncluded: Tax = {
  id: 'tx-inc', name: 'IVA Incluido', rate: 21, inclusion: 'included',
  appliesToTireIds: [], applyToNewTires: true, dependsOnOrderType: false, storeIds: null,
};
const taxAdded: Tax = {
  id: 'tx-add', name: 'IVA Agregado', rate: 21, inclusion: 'added',
  appliesToTireIds: [], applyToNewTires: true, dependsOnOrderType: false, storeIds: null,
};
const tire = (overrides: Partial<TireV2> = {}): TireV2 => ({
  id: 'tire-1', brand: 'Pirelli', model: 'P1', size: '195/65R15',
  categoryId: cat.id, cost: 50, defaultPrice: 100, defaultMargin: 50,
  taxIds: [], modifierGroupIds: [], availableInAllStores: true,
  createdAt: '2026-05-01T00:00:00Z', updatedAt: '2026-05-01T00:00:00Z',
  ...overrides,
});
const override = (price: number, stock = 10): TireStoreOverride => ({
  tireId: 'tire-1', storeId: STORE, available: true, price, stock, lowStockThreshold: 0,
});

function makeLookups(opts: {
  tire: TireV2;
  override?: TireStoreOverride;
  taxes?: Tax[];
  discounts?: Discount[];
  paymentMethods?: PaymentMethod[];
}): ReceiptLookups {
  const taxMap = new Map((opts.taxes ?? []).map(t => [t.id, t]));
  const discMap = new Map((opts.discounts ?? []).map(d => [d.id, d]));
  const pmMap = new Map((opts.paymentMethods ?? []).map(p => [p.id, p]));
  const loyalty: LoyaltyConfig = { enabled: false, earnPercent: 0 };
  return {
    getTire: id => (id === opts.tire.id ? opts.tire : undefined),
    getOverride: (tid, sid) => (tid === opts.tire.id && sid === STORE ? opts.override : undefined),
    getCategory: id => (id === cat.id ? cat : undefined),
    getTax: id => taxMap.get(id),
    getDiscount: id => discMap.get(id),
    getPaymentMethod: id => pmMap.get(id),
    loyalty,
    nextReceiptNumber: async () => 'TPV-0001',
  };
}

describe('buildLine — IVA incluido', () => {
  it('separa el impuesto del precio (price=100 con IVA 21% → net≈82.64, tax≈17.36)', () => {
    const t = tire({ taxIds: [taxIncluded.id] });
    const lookups = makeLookups({ tire: t, override: override(100), taxes: [taxIncluded] });
    const line = buildLine({ tireId: t.id, quantity: 1, modifiers: [] }, STORE, lookups);

    expect(line.gross).toBe(100);
    expect(line.net).toBe(100); // sin descuentos, net == gross
    expect(line.lineTaxes).toHaveLength(1);
    expect(line.lineTaxes[0].amount).toBeCloseTo(17.355, 2);
    expect(line.lineTaxes[0].addedToTotal).toBe(false);
    // total NO suma el impuesto incluido — ya está dentro del precio
    expect(line.total).toBe(100);
  });

  it('multiplica por cantidad (qty=3, price=100 IVA 21% incl.)', () => {
    const t = tire({ taxIds: [taxIncluded.id] });
    const lookups = makeLookups({ tire: t, override: override(100), taxes: [taxIncluded] });
    const line = buildLine({ tireId: t.id, quantity: 3, modifiers: [] }, STORE, lookups);

    expect(line.gross).toBe(300);
    expect(line.lineTaxes[0].amount).toBeCloseTo(52.066, 2);
    expect(line.total).toBe(300);
  });
});

describe('buildLine — IVA agregado', () => {
  it('suma el impuesto al total (price=100, IVA 21% added → total=121)', () => {
    const t = tire({ taxIds: [taxAdded.id] });
    const lookups = makeLookups({ tire: t, override: override(100), taxes: [taxAdded] });
    const line = buildLine({ tireId: t.id, quantity: 1, modifiers: [] }, STORE, lookups);

    expect(line.gross).toBe(100);
    expect(line.net).toBe(100);
    expect(line.lineTaxes[0].amount).toBeCloseTo(21, 2);
    expect(line.lineTaxes[0].addedToTotal).toBe(true);
    expect(line.total).toBe(121);
  });
});

describe('buildLine — descuento de línea', () => {
  it('aplica descuento porcentual antes del cálculo de IVA agregado', () => {
    const t = tire({ taxIds: [taxAdded.id] });
    const disc: Discount = {
      id: 'd-10', name: 'PROMO 10%', type: 'percent', value: 10,
      pinRestricted: false, storeIds: null,
    };
    const lookups = makeLookups({
      tire: t, override: override(100), taxes: [taxAdded], discounts: [disc],
    });
    const line = buildLine(
      { tireId: t.id, quantity: 1, modifiers: [], lineDiscountId: disc.id },
      STORE,
      lookups,
    );

    expect(line.gross).toBe(100);
    expect(line.lineDiscounts[0].amount).toBe(10);
    expect(line.net).toBe(90); // 100 - 10
    expect(line.lineTaxes[0].amount).toBeCloseTo(18.9, 2); // 90 * 21%
    expect(line.total).toBeCloseTo(108.9, 2);
  });

  it('aplica descuento monto fijo', () => {
    const t = tire();
    const disc: Discount = {
      id: 'd-amt', name: '$15 OFF', type: 'amount', value: 15,
      pinRestricted: false, storeIds: null,
    };
    const lookups = makeLookups({ tire: t, override: override(100), discounts: [disc] });
    const line = buildLine(
      { tireId: t.id, quantity: 1, modifiers: [], lineDiscountId: disc.id },
      STORE,
      lookups,
    );

    expect(line.lineDiscounts[0].amount).toBe(15);
    expect(line.net).toBe(85);
    expect(line.total).toBe(85);
  });
});

describe('buildLine — override de precio por tienda', () => {
  it('usa override.price antes que defaultPrice', () => {
    const t = tire({ defaultPrice: 100 });
    const lookups = makeLookups({ tire: t, override: override(150) });
    const line = buildLine({ tireId: t.id, quantity: 1, modifiers: [] }, STORE, lookups);
    expect(line.unitPrice).toBe(150);
    expect(line.gross).toBe(150);
  });

  it('cae a defaultPrice si no hay override', () => {
    const t = tire({ defaultPrice: 100 });
    const lookups = makeLookups({ tire: t });
    const line = buildLine({ tireId: t.id, quantity: 1, modifiers: [] }, STORE, lookups);
    expect(line.unitPrice).toBe(100);
  });
});

describe('buildLine — modificadores', () => {
  it('suma price de modifiers al precio unitario antes de qty', () => {
    const t = tire();
    const lookups = makeLookups({ tire: t, override: override(100) });
    const line = buildLine(
      {
        tireId: t.id,
        quantity: 2,
        modifiers: [{ groupId: 'g', optionId: 'o', name: 'Balanceo', price: 5 }],
      },
      STORE,
      lookups,
    );
    expect(line.gross).toBe((100 + 5) * 2);
  });
});

describe('buildLine — filtrado de impuestos por tienda', () => {
  it('ignora impuestos cuyo storeIds no incluye el storeId activo', () => {
    const t = tire({ taxIds: [taxAdded.id] });
    const taxOtherStore: Tax = { ...taxAdded, storeIds: ['otra-tienda'] };
    const lookups = makeLookups({
      tire: t, override: override(100),
      taxes: [taxOtherStore],
    });
    const line = buildLine({ tireId: t.id, quantity: 1, modifiers: [] }, STORE, lookups);
    expect(line.lineTaxes).toHaveLength(0);
    expect(line.total).toBe(100);
  });
});

describe('rollupTaxes', () => {
  it('agrupa impuestos por taxId sumando base y amount', () => {
    const t1 = tire({ taxIds: [taxAdded.id] });
    const t2 = tire({ id: 'tire-2', taxIds: [taxAdded.id] });
    const lookups1 = makeLookups({ tire: t1, override: override(100), taxes: [taxAdded] });
    const lookups2 = makeLookups({ tire: t2, override: override(50), taxes: [taxAdded] });

    const l1 = buildLine({ tireId: t1.id, quantity: 1, modifiers: [] }, STORE, lookups1);
    const l2 = buildLine({ tireId: t2.id, quantity: 1, modifiers: [] }, STORE, lookups2);

    const rollup = rollupTaxes([l1, l2]);
    expect(rollup).toHaveLength(1);
    expect(rollup[0].taxId).toBe(taxAdded.id);
    expect(rollup[0].base).toBe(150); // 100 + 50
    expect(rollup[0].amount).toBeCloseTo(31.5, 2); // 21% sobre 150
  });

  it('separa por taxId distintos', () => {
    const t = tire({ taxIds: [taxIncluded.id, taxAdded.id] });
    const lookups = makeLookups({
      tire: t, override: override(100),
      taxes: [taxIncluded, taxAdded],
    });
    const line = buildLine({ tireId: t.id, quantity: 1, modifiers: [] }, STORE, lookups);

    const rollup = rollupTaxes([line]);
    expect(rollup).toHaveLength(2);
    const ids = rollup.map(r => r.taxId).sort();
    expect(ids).toEqual([taxAdded.id, taxIncluded.id].sort());
  });
});

describe('buildLine — errores', () => {
  it('throw si tire no existe', () => {
    const lookups = makeLookups({ tire: tire() });
    expect(() =>
      buildLine({ tireId: 'inexistente', quantity: 1, modifiers: [] }, STORE, lookups),
    ).toThrow(/no encontrado/);
  });

  it('throw si descuento no existe', () => {
    const t = tire();
    const lookups = makeLookups({ tire: t, override: override(100) });
    expect(() =>
      buildLine(
        { tireId: t.id, quantity: 1, modifiers: [], lineDiscountId: 'd-fantasma' },
        STORE,
        lookups,
      ),
    ).toThrow(/Discount/);
  });
});

// Smoke check — el shape de BuildReceiptInput se mantiene.
describe('BuildReceiptInput shape', () => {
  it('admite cart, ticketDiscountIds, paymentSplits, parkedName opcional', () => {
    const input: BuildReceiptInput = {
      storeId: STORE,
      cashSessionId: 'cs',
      employeeId: 'emp',
      cart: [{ tireId: 'tire-1', quantity: 1, modifiers: [] }],
      ticketDiscountIds: [],
      paymentSplits: [],
      type: 'sale',
      parkedName: 'Mesa 3',
    };
    expect(input.parkedName).toBe('Mesa 3');
  });
});

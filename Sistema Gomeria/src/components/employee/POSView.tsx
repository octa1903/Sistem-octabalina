import { useState, useEffect, useMemo, useCallback } from 'react';
import type {
  TireV2, TireStoreOverride, Category, Customer, PaymentMethod, CashSession, Tax, Store, ReceiptConfig,
  Sale, SaleItem, Tire, Receipt, ReceiptLine,
  BuildReceiptInput, LoyaltyConfig,
} from '@/types';
import { tireService, saleService } from '@/services/storageService';
import { tireServiceV2 } from '@/services/tireServiceV2';
import { categoryService } from '@/services/categoryService';
import { customerServiceV2 } from '@/services/customerServiceV2';
import { receiptService } from '@/services/receiptService';
import { taxService } from '@/services/taxService';
import { storeService } from '@/services/storeService';
import { receiptConfigService } from '@/services/receiptConfigService';
import { supabase } from '@/services/supabaseClient';
import { ensureNoError, rowToCamel } from '@/services/supabaseHelpers';
import { formatCurrency } from '@/utils/currency';
import { printReceipt } from '@/utils/printReceipt';
import { Modal } from '@/components/ui/Modal';
import { Search, Plus, Minus, Trash2, ShoppingCart, CheckCircle, Lock, Printer } from 'lucide-react';

interface Props {
  addToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  storeId: string;
  cashSession: CashSession | null;
  employeeId: string | null;
  employeeName?: string;
}

interface LastReceiptData {
  receipt: Receipt;
  lines: ReceiptLine[];
  customer: Customer | null;
}

interface CartItem {
  tire: TireV2;
  override: TireStoreOverride | undefined;
  unitPrice: number;
  unitCost: number;
  stock: number;
  quantity: number;
  subtotal: number;
}

const DEFAULT_LOYALTY: LoyaltyConfig = { enabled: false, earnPercent: 0 };

// Lookup local: cuenta receipts existentes para el store y arma el próximo número
async function nextReceiptNumber(storeId: string): Promise<string> {
  const { count, error } = await supabase
    .from('receipts')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', storeId);
  if (error) throw error;
  const next = (count ?? 0) + 1;
  return `TPV-${String(next).padStart(4, '0')}`;
}

export function POSView({ addToast, storeId, cashSession, employeeId, employeeName }: Props) {
  const [tires, setTires] = useState<TireV2[]>([]);
  const [overridesByTire, setOverridesByTire] = useState<Map<string, TireStoreOverride>>(new Map());
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [store, setStore] = useState<Store | null>(null);
  const [receiptConfig, setReceiptConfig] = useState<ReceiptConfig | null>(null);
  const [loyalty, setLoyalty] = useState<LoyaltyConfig>(DEFAULT_LOYALTY);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<{ number: string; total: number; pmName: string } | null>(null);
  const [lastReceiptData, setLastReceiptData] = useState<LastReceiptData | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [tiresV2, cats, custs, ovr, pms, taxesData, storeData, rConfig, { data: loyaltyData }] = await Promise.all([
        tireServiceV2.getAll(),
        categoryService.getAll(),
        customerServiceV2.getAll(),
        tireServiceV2.getOverridesByStore(storeId),
        supabase.from('payment_methods').select('*').order('sort_order', { ascending: true }).then(r =>
          ensureNoError(r.data, r.error, 'POSView.paymentMethods').map(row => rowToCamel<PaymentMethod>(row)),
        ),
        taxService.getAll(),
        storeService.getById(storeId),
        receiptConfigService.getByStore(storeId).catch(() => null),
        supabase.from('loyalty_config').select('*').maybeSingle(),
      ]);
      const m = new Map<string, TireStoreOverride>();
      ovr.forEach(o => m.set(o.tireId, o));
      setTires(tiresV2);
      setOverridesByTire(m);
      setCategories(cats);
      setCustomers(custs);
      setPaymentMethods(pms);
      setTaxes(taxesData);
      setStore(storeData ?? null);
      setReceiptConfig(rConfig);
      if (loyaltyData) {
        setLoyalty({
          enabled: loyaltyData.enabled,
          earnPercent: Number(loyaltyData.earn_percent ?? 0),
        });
      }
      // Default a "Efectivo" si existe
      if (!paymentMethodId) {
        const cash = pms.find(p => p.type === 'cash');
        if (cash) setPaymentMethodId(cash.id);
        else if (pms.length > 0) setPaymentMethodId(pms[0].id);
      }
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error cargando POS.', 'error');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, addToast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const catNameById = useMemo(() => {
    const m = new Map<string, string>();
    categories.forEach(c => m.set(c.id, c.name));
    return m;
  }, [categories]);

  const tireRows = useMemo(() => {
    return tires
      .map(t => {
        const ovr = overridesByTire.get(t.id);
        return {
          tire: t,
          override: ovr,
          price: ovr?.price ?? t.defaultPrice,
          stock: ovr?.stock ?? 0,
          minStock: ovr?.lowStockThreshold ?? 0,
          categoryName: catNameById.get(t.categoryId) ?? 'Sin categoría',
        };
      })
      .filter(r => r.stock > 0);
  }, [tires, overridesByTire, catNameById]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return tireRows.filter(r => {
      if (filterCat && r.categoryName !== filterCat) return false;
      if (q && !`${r.tire.brand} ${r.tire.model} ${r.tire.size}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tireRows, search, filterCat]);

  const selectedPm = paymentMethods.find(p => p.id === paymentMethodId);
  const subtotal = cart.reduce((s, i) => s + i.subtotal, 0);
  const surchargeRate = (selectedPm?.surchargePercent ?? 0) / 100;
  // Gross-up: total = subtotal / (1 - rate). Para rate=0 → total=subtotal.
  const total = surchargeRate > 0 && surchargeRate < 1
    ? subtotal / (1 - surchargeRate)
    : subtotal;
  const surchargeAmount = total - subtotal;

  // Desglose de IVA: para cada item del carrito, sumar impuestos contenidos
  // (price ya los incluye) y agregados (suman al total).
  const taxesById = useMemo(() => new Map(taxes.map(t => [t.id, t])), [taxes]);
  const taxBreakdown = useMemo(() => {
    const included: Record<string, { name: string; amount: number }> = {};
    const added: Record<string, { name: string; amount: number }> = {};
    for (const ci of cart) {
      const tireTaxIds = ci.tire.taxIds ?? [];
      const net = ci.subtotal;
      for (const tid of tireTaxIds) {
        const tax = taxesById.get(tid);
        if (!tax) continue;
        if (tax.storeIds && !tax.storeIds.includes(storeId)) continue;
        const amount = tax.inclusion === 'included'
          ? net - net / (1 + tax.rate / 100)
          : net * (tax.rate / 100);
        const bucket = tax.inclusion === 'included' ? included : added;
        if (!bucket[tid]) bucket[tid] = { name: tax.name, amount: 0 };
        bucket[tid].amount += amount;
      }
    }
    return {
      included: Object.values(included),
      added: Object.values(added),
    };
  }, [cart, taxesById, storeId]);

  const selectedCustomer = customers.find(c => c.id === customerId);

  function addToCart(row: typeof tireRows[number]) {
    setCart(prev => {
      const idx = prev.findIndex(i => i.tire.id === row.tire.id);
      if (idx >= 0) {
        const cur = prev[idx];
        if (cur.quantity >= cur.stock) {
          addToast(`Stock máximo en esta tienda: ${cur.stock} u.`, 'warning');
          return prev;
        }
        const updated = [...prev];
        updated[idx] = { ...cur, quantity: cur.quantity + 1, subtotal: (cur.quantity + 1) * cur.unitPrice };
        return updated;
      }
      return [...prev, {
        tire: row.tire,
        override: row.override,
        unitPrice: row.price,
        unitCost: row.tire.cost,
        stock: row.stock,
        quantity: 1,
        subtotal: row.price,
      }];
    });
  }

  function updateQty(id: string, delta: number) {
    setCart(prev =>
      prev
        .map(i => {
          if (i.tire.id !== id) return i;
          const q = Math.max(0, Math.min(i.quantity + delta, i.stock));
          return { ...i, quantity: q, subtotal: q * i.unitPrice };
        })
        .filter(i => i.quantity > 0),
    );
  }

  const canCheckout = cart.length > 0 && cashSession !== null && employeeId !== null;

  function checkout() {
    if (!cashSession) {
      addToast('Tenés que abrir la caja primero.', 'warning');
      return;
    }
    if (cart.length === 0) {
      addToast('El carrito está vacío.', 'warning');
      return;
    }
    if (!paymentMethodId) {
      addToast('Seleccioná un método de pago.', 'warning');
      return;
    }
    setCheckoutOpen(true);
  }

  async function confirmSale() {
    if (!cashSession || !employeeId || !selectedPm) return;
    setConfirming(true);
    try {
      const input: BuildReceiptInput = {
        storeId,
        cashSessionId: cashSession.id,
        employeeId,
        customerId: customerId || undefined,
        cart: cart.map(ci => ({ tireId: ci.tire.id, quantity: ci.quantity, modifiers: [] })),
        ticketDiscountIds: [],
        paymentSplits: [{ paymentMethodId: selectedPm.id, amount: total }],
        type: 'sale',
      };

      const tireById = new Map(tires.map(t => [t.id, t]));
      const overrideById = overridesByTire;
      const categoryById = new Map(categories.map(c => [c.id, c]));
      const pmById = new Map(paymentMethods.map(p => [p.id, p]));

      const receipt = await receiptService.buildAndSave(input, {
        getTire: id => tireById.get(id),
        getOverride: (tireId, sId) => sId === storeId ? overrideById.get(tireId) : undefined,
        getCategory: id => categoryById.get(id),
        getTax: id => taxesById.get(id),
        getDiscount: () => undefined,
        getPaymentMethod: id => pmById.get(id),
        loyalty,
        nextReceiptNumber,
      });

      // Mirror legacy: guardar Sale + actualizar stock en localStorage
      // así AnalyticsView/POSView legacy siguen viendo datos hasta que migren.
      const saleItems: SaleItem[] = cart.map(ci => ({
        tireId: ci.tire.id,
        brand: ci.tire.brand,
        model: ci.tire.model,
        size: ci.tire.size,
        quantity: ci.quantity,
        unitPrice: ci.unitPrice,
        subtotal: ci.subtotal,
      }));
      const sale: Sale = {
        id: receipt.id,
        items: saleItems,
        total: receipt.total,
        paymentMethod: selectedPm.name,
        surcharge: selectedPm.surchargePercent,
        clientId: customerId || undefined,
        clientName: selectedCustomer?.name,
        date: receipt.createdAt,
        notes: '',
      };
      saleService.save(sale);
      // El stock real ya bajó en Supabase via RPC apply_receipt_to_stock.
      // Mirror local del nuevo stock:
      for (const ci of cart) {
        const fresh = tireService.getById(ci.tire.id);
        if (fresh) {
          tireService.save({
            ...fresh,
            stock: Math.max(0, fresh.stock - ci.quantity),
            updatedAt: new Date().toISOString(),
          } as Tire);
        }
      }

      // Cargar líneas para el recibo imprimible
      const recLines = await receiptService.getLines(receipt.id);

      setLastReceipt({ number: receipt.receiptNumber, total: receipt.total, pmName: selectedPm.name });
      setLastReceiptData({ receipt, lines: recLines, customer: selectedCustomer ?? null });
      setCart([]);
      setCustomerId('');
      setCheckoutOpen(false);
      setSuccessOpen(true);
      addToast(`Venta ${receipt.receiptNumber} registrada.`, 'success');

      // Recargar overrides para reflejar stock actualizado
      const newOverrides = await tireServiceV2.getOverridesByStore(storeId);
      const m = new Map<string, TireStoreOverride>();
      newOverrides.forEach(o => m.set(o.tireId, o));
      setOverridesByTire(m);
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error registrando venta.', 'error');
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="flex h-full" style={{ minHeight: 0 }}>
      {/* Product panel */}
      <div className="flex-1 flex flex-col p-5 overflow-hidden">
        <h1 className="text-xl font-semibold mb-4" style={{ color: 'var(--br-txt)' }}>Punto de Venta</h1>

        {/* Filters */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--br-txt2)' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar neumático..."
              className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none"
              style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)' }}
            />
          </div>
          <select
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm outline-none"
            style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}
          >
            <option value="">Todas</option>
            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-sm py-10 text-center" style={{ color: 'var(--br-txt2)' }}>Cargando...</p>
          ) : (
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-2">
              {filtered.map((row) => (
                <button
                  key={row.tire.id}
                  onClick={() => addToCart(row)}
                  className="text-left rounded-xl p-3 transition-all"
                  style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}
                  onMouseOver={(e) => (e.currentTarget.style.borderColor = 'var(--br-amb)')}
                  onMouseOut={(e) => (e.currentTarget.style.borderColor = 'var(--br-bor)')}
                >
                  <p className="text-xs font-medium" style={{ color: 'var(--br-txt2)' }}>{row.tire.brand}</p>
                  <p className="font-mono text-sm font-semibold" style={{ color: 'var(--br-txt)' }}>{row.tire.size}</p>
                  <p className="text-xs" style={{ color: 'var(--br-txt2)' }}>{row.tire.model}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-semibold text-sm" style={{ color: 'var(--br-amb)' }}>
                      {formatCurrency(row.price)}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded-full" style={{
                      color: row.stock <= row.minStock ? 'var(--br-red)' : 'var(--br-grn)',
                      background: row.stock <= row.minStock ? 'var(--br-red-bg)' : 'var(--br-grn-bg)',
                    }}>
                      {row.stock} u.
                    </span>
                  </div>
                </button>
              ))}
              {!loading && filtered.length === 0 && (
                <p className="col-span-3 text-sm py-10 text-center" style={{ color: 'var(--br-txt2)' }}>
                  {tires.length === 0 ? 'No hay neumáticos en esta tienda.' : 'Sin resultados.'}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Cart panel */}
      <div className="w-80 flex flex-col" style={{ background: 'var(--br-sur)', borderLeft: '1px solid var(--br-bor)' }}>
        <div className="px-4 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid var(--br-bor)' }}>
          <ShoppingCart className="h-5 w-5" style={{ color: 'var(--br-amb)' }} />
          <span className="font-semibold text-sm" style={{ color: 'var(--br-txt)' }}>Carrito ({cart.length})</span>
        </div>

        {!cashSession && (
          <div className="mx-3 mt-3 p-3 rounded-lg flex items-start gap-2"
               style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.30)', color: 'var(--br-red)' }}>
            <Lock className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span className="text-xs">Abrí la caja para vender. Botón "Abrir caja" arriba.</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--br-txt2)' }}>Seleccioná neumáticos.</p>
          ) : (
            cart.map((ci) => (
              <div key={ci.tire.id} className="rounded-lg p-3" style={{ background: 'var(--br-sur2)', border: '1px solid var(--br-bor)' }}>
                <p className="text-xs font-medium" style={{ color: 'var(--br-txt)' }}>{ci.tire.brand} {ci.tire.model}</p>
                <p className="text-xs font-mono" style={{ color: 'var(--br-txt2)' }}>{ci.tire.size}</p>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQty(ci.tire.id, -1)} className="w-6 h-6 rounded flex items-center justify-center" style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}>
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-6 text-center text-sm font-semibold">{ci.quantity}</span>
                    <button onClick={() => updateQty(ci.tire.id, 1)} className="w-6 h-6 rounded flex items-center justify-center" style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}>
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <span className="text-sm font-semibold font-mono" style={{ color: 'var(--br-amb)' }}>{formatCurrency(ci.subtotal)}</span>
                  <button onClick={() => setCart((p) => p.filter((i) => i.tire.id !== ci.tire.id))} style={{ color: 'var(--br-txt2)' }}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Cart footer */}
        <div className="p-4 space-y-3" style={{ borderTop: '1px solid var(--br-bor)' }}>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>
              Cliente (opcional)
            </label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}
            >
              <option value="">Sin cliente</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>
              Método de pago
            </label>
            <select
              value={paymentMethodId}
              onChange={(e) => setPaymentMethodId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}
            >
              {paymentMethods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.surchargePercent > 0 ? ` (+${p.surchargePercent}%)` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1 text-sm">
            <div className="flex justify-between" style={{ color: 'var(--br-txt2)' }}>
              <span>Subtotal</span>
              <span className="font-mono">{formatCurrency(subtotal)}</span>
            </div>
            {taxBreakdown.included.map(t => (
              <div key={t.name} className="flex justify-between text-xs" style={{ color: 'var(--br-txt2)' }}>
                <span>{t.name} (incluido)</span>
                <span className="font-mono">{formatCurrency(t.amount)}</span>
              </div>
            ))}
            {taxBreakdown.added.map(t => (
              <div key={t.name} className="flex justify-between text-xs" style={{ color: 'var(--br-txt2)' }}>
                <span>+ {t.name}</span>
                <span className="font-mono">{formatCurrency(t.amount)}</span>
              </div>
            ))}
            {surchargeRate > 0 && (
              <div className="flex justify-between text-xs" style={{ color: 'var(--br-txt2)' }}>
                <span>Recargo {(surchargeRate * 100).toFixed(0)}%</span>
                <span className="font-mono">{formatCurrency(surchargeAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-base" style={{ color: 'var(--br-txt)' }}>
              <span>Total</span>
              <span className="font-mono" style={{ color: 'var(--br-amb)' }}>{formatCurrency(total)}</span>
            </div>
          </div>

          <button
            onClick={checkout}
            disabled={!canCheckout}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-40"
            style={{ background: 'var(--br-amb)' }}
            title={!cashSession ? 'Abrí la caja primero' : ''}
          >
            Cobrar {formatCurrency(total)}
          </button>
        </div>
      </div>

      {/* Checkout modal */}
      <Modal open={checkoutOpen} onClose={() => !confirming && setCheckoutOpen(false)} title="Confirmar venta" size="sm">
        <div className="space-y-3">
          {cart.map((ci) => (
            <div key={ci.tire.id} className="flex justify-between text-sm" style={{ color: 'var(--br-txt)' }}>
              <span>{ci.tire.brand} {ci.tire.size} × {ci.quantity}</span>
              <span className="font-mono">{formatCurrency(ci.subtotal)}</span>
            </div>
          ))}
          <div className="pt-2" style={{ borderTop: '1px solid var(--br-bor)' }}>
            <div className="flex justify-between font-semibold">
              <span>Total ({selectedPm?.name})</span>
              <span className="font-mono" style={{ color: 'var(--br-amb)' }}>{formatCurrency(total)}</span>
            </div>
            {selectedCustomer && (
              <p className="text-xs mt-1" style={{ color: 'var(--br-txt2)' }}>Cliente: {selectedCustomer.name}</p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => setCheckoutOpen(false)} disabled={confirming} className="px-4 py-2 rounded-lg text-sm disabled:opacity-50" style={{ border: '1px solid var(--br-bor)', color: 'var(--br-txt2)' }}>
            Cancelar
          </button>
          <button onClick={confirmSale} disabled={confirming} className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ background: 'var(--br-grn)' }}>
            {confirming ? 'Registrando...' : 'Confirmar venta'}
          </button>
        </div>
      </Modal>

      {/* Success modal */}
      <Modal open={successOpen} onClose={() => setSuccessOpen(false)} title="" size="sm">
        <div className="text-center py-4">
          <CheckCircle className="h-12 w-12 mx-auto mb-3" style={{ color: 'var(--br-grn)' }} />
          <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--br-txt)' }}>¡Venta registrada!</h3>
          {lastReceipt && (
            <>
              <p className="text-2xl font-bold font-mono" style={{ color: 'var(--br-amb)' }}>
                {formatCurrency(lastReceipt.total)}
              </p>
              <p className="text-sm mt-1" style={{ color: 'var(--br-txt2)' }}>
                Recibo {lastReceipt.number} · {lastReceipt.pmName}
              </p>
            </>
          )}
        </div>
        <div className="flex justify-center gap-2 mt-2">
          <button
            onClick={() => {
              if (!lastReceiptData || !store) return;
              printReceipt({
                receipt: lastReceiptData.receipt,
                lines: lastReceiptData.lines,
                store,
                config: receiptConfig,
                paymentMethods,
                taxes,
                customer: lastReceiptData.customer,
                employeeName,
              });
            }}
            disabled={!lastReceiptData || !store}
            className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
            style={{ border: '1px solid var(--br-bor)', color: 'var(--br-txt)', background: 'var(--br-sur)' }}
          >
            <Printer className="h-4 w-4" /> Imprimir
          </button>
          <button onClick={() => setSuccessOpen(false)} className="px-6 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: 'var(--br-dark)' }}>
            Continuar
          </button>
        </div>
      </Modal>
    </div>
  );
}

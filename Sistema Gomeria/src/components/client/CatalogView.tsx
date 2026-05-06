import { useState, useMemo, useEffect } from 'react';
import type { Tire, Customer, OrderItem, OrderConfig } from '@/types';
import { orderService } from '@/services/orderService';
import { orderConfigService } from '@/services/orderConfigService';
import { tireServiceV2 } from '@/services/tireServiceV2';
import { customerSelfService } from '@/services/customerSelfService';
import { categoryService } from '@/services/categoryService';
import { storeService } from '@/services/storeService';
import { TIRE_CATEGORIES, PAYMENT_METHODS, DEFAULT_ORDER_CONFIG } from '@/constants';
import { formatCurrency } from '@/utils/currency';
import { Modal } from '@/components/ui/Modal';
import { Search, ShoppingCart, Plus, Minus, Trash2, CheckCircle } from 'lucide-react';

interface Props {
  clientId: string;
  /** Token de sesión emitido por el RPC customer_login. Requerido para crear pedidos. */
  clientToken: string | undefined;
  addToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

interface CartEntry { tire: Tire; quantity: number; }

export function CatalogView({ clientId, clientToken, addToast }: Props) {
  const [tires, setTires] = useState<Tire[]>([]);
  const [client, setClient] = useState<Customer | null>(null);
  const [refStoreId, setRefStoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [orderConfig, setOrderConfig] = useState<OrderConfig>({ ...DEFAULT_ORDER_CONFIG });
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [orderOpen, setOrderOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [orderDate, setOrderDate] = useState('');
  const [orderTime, setOrderTime] = useState('');
  const [orderType, setOrderType] = useState<'retiro' | 'entrega_domicilio'>('retiro');
  const [orderAddress, setOrderAddress] = useState('');
  const [orderPayment, setOrderPayment] = useState('efectivo');

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      try {
        // Catálogo: usamos la primera tienda como tienda de referencia para precios/stock.
        const [stores, oc] = await Promise.all([
          storeService.getAll(),
          orderConfigService.get(),
        ]);
        const storeId = stores[0]?.id ?? null;
        if (!storeId) {
          if (active) {
            setTires([]);
            addToast('No hay tiendas configuradas. Contactá a la gomería.', 'warning');
          }
          return;
        }
        const [tiresV2, cats, overrides, customer] = await Promise.all([
          tireServiceV2.getAll(),
          categoryService.getAll(),
          tireServiceV2.getOverridesByStore(storeId),
          clientToken ? customerSelfService.getProfile(clientToken) : Promise.resolve(null),
        ]);
        if (!active) return;
        const overrideByTire = new Map(overrides.map(o => [o.tireId, o]));
        const catNameById = new Map(cats.map(c => [c.id, c.name]));
        const list = tiresV2
          .map(t => tireServiceV2.toLegacy(t, overrideByTire.get(t.id), catNameById.get(t.categoryId) ?? 'Sin categoría'))
          .filter(t => t.salePrice > 0 && t.stock > 0);
        setTires(list);
        setClient(customer ?? null);
        setRefStoreId(storeId);
        setOrderConfig(oc);
      } catch (e) {
        if (active) addToast(e instanceof Error ? e.message : 'Error cargando catálogo', 'error');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
    // addToast se omite intencionalmente: si el padre lo recrea en cada render
    // el catálogo se recargaría sin parar. Suponemos referencia estable (useToast).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const discountPct = client?.customerType === 'wholesale' ? (client.wholesaleDiscount ?? 0) : 0;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return tires.filter((t) => {
      if (filterCat && t.category !== filterCat) return false;
      if (q && !`${t.brand} ${t.model} ${t.size}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tires, search, filterCat]);

  function priceFor(t: Tire) {
    return discountPct > 0 ? Math.round(t.salePrice * (1 - discountPct / 100)) : t.salePrice;
  }

  function addToCart(t: Tire) {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.tire.id === t.id);
      if (idx >= 0) {
        if (prev[idx].quantity >= t.stock) { addToast(`Máximo ${t.stock} unidades.`, 'warning'); return prev; }
        const updated = [...prev];
        updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + 1 };
        return updated;
      }
      return [...prev, { tire: t, quantity: 1 }];
    });
    addToast('Agregado al pedido.', 'success');
  }

  function updateQty(id: string, delta: number) {
    setCart((prev) => prev
      .map((i) => i.tire.id === id ? { ...i, quantity: Math.max(0, Math.min(i.quantity + delta, i.tire.stock)) } : i)
      .filter((i) => i.quantity > 0),
    );
  }

  const cartTotal = cart.reduce((s, i) => s + priceFor(i.tire) * i.quantity, 0);

  async function submitOrder() {
    if (!orderConfig.enabled) { addToast('Los pedidos están deshabilitados.', 'error'); return; }
    if (!orderDate) { addToast('Seleccioná una fecha.', 'error'); return; }
    if (orderType === 'entrega_domicilio' && !orderAddress) { addToast('Ingresá una dirección.', 'error'); return; }
    if (!refStoreId) { addToast('Error interno: tienda no cargada. Recargá la página.', 'error'); return; }

    const items: OrderItem[] = cart.map((ci) => ({
      tireId: ci.tire.id,
      brand: ci.tire.brand,
      model: ci.tire.model,
      size: ci.tire.size,
      quantity: ci.quantity,
      unitPrice: priceFor(ci.tire),
      subtotal: priceFor(ci.tire) * ci.quantity,
    }));

    if (!clientToken) {
      addToast('Sesión expirada. Volvé a iniciar sesión.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await orderService.createPublicOrder(clientToken, {
        storeId: refStoreId,
        items,
        paymentMethodId: PAYMENT_METHODS.find((p) => p.id === orderPayment)?.id ?? orderPayment,
        tipo: orderType,
        scheduledDate: orderDate,
        scheduledTime: orderTime || undefined,
        address: orderType === 'entrega_domicilio' ? orderAddress : undefined,
      });
      setCart([]);
      setOrderOpen(false);
      setSuccessOpen(true);
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error enviando el pedido.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  // Min date for order
  const minDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + orderConfig.minDaysAhead);
    return d.toISOString().slice(0, 10);
  }, [orderConfig]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--br-txt)' }}>Catálogo</h1>
          {discountPct > 0 && (
            <p className="text-sm font-semibold" style={{ color: 'var(--br-grn)' }}>Precio mayorista: {discountPct}% descuento</p>
          )}
        </div>
        {cart.length > 0 && (
          <button onClick={() => setOrderOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold"
            style={{ background: 'var(--br-amb)' }}>
            <ShoppingCart className="h-4 w-4" /> Pedido ({cart.length}) · {formatCurrency(cartTotal)}
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--br-txt2)' }} />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por marca, modelo, medida..."
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none"
            style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)' }} />
        </div>
        <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}>
          <option value="">Todas</option>
          {TIRE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      {loading && (
        <p className="text-sm text-center py-10" style={{ color: 'var(--br-txt2)' }}>Cargando catálogo…</p>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {!loading && filtered.map((t) => {
          const price = priceFor(t);
          const inCart = cart.find((i) => i.tire.id === t.id);
          return (
            <div key={t.id} className="rounded-xl p-4" style={{ background: 'var(--br-sur)', border: `1px solid ${inCart ? 'var(--br-amb)' : 'var(--br-bor)'}` }}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-xs font-semibold" style={{ color: 'var(--br-txt2)' }}>{t.brand}</p>
                  <p className="font-mono font-semibold text-sm" style={{ color: 'var(--br-txt)' }}>{t.size}</p>
                  <p className="text-xs" style={{ color: 'var(--br-txt2)' }}>{t.model}</p>
                </div>
                <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'var(--br-sur2)', color: 'var(--br-txt2)' }}>{t.category}</span>
              </div>
              <div className="flex items-center justify-between mt-3">
                <div>
                  <p className="font-semibold text-base" style={{ color: 'var(--br-amb)' }}>{formatCurrency(price)}</p>
                  {discountPct > 0 && (
                    <p className="text-xs line-through" style={{ color: 'var(--br-txt2)' }}>{formatCurrency(t.salePrice)}</p>
                  )}
                </div>
                {!inCart ? (
                  <button onClick={() => addToCart(t)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white"
                    style={{ background: 'var(--br-amb)' }}>
                    <Plus className="h-4 w-4" /> Agregar
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQty(t.id, -1)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--br-sur2)', border: '1px solid var(--br-bor)' }}>
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="text-sm font-semibold w-5 text-center">{inCart.quantity}</span>
                    <button onClick={() => updateQty(t.id, 1)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--br-amb)' }}>
                      <Plus className="h-3 w-3 text-white" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {!loading && filtered.length === 0 && (
          <p className="col-span-3 text-sm text-center py-10" style={{ color: 'var(--br-txt2)' }}>Sin productos disponibles.</p>
        )}
      </div>

      {/* Order modal */}
      <Modal open={orderOpen} onClose={() => setOrderOpen(false)} title="Confirmar pedido" size="md">
        <div className="space-y-4">
          {/* Cart items */}
          <div>
            <p className="text-sm font-semibold mb-2" style={{ color: 'var(--br-txt)' }}>Neumáticos seleccionados</p>
            <div className="space-y-2">
              {cart.map((ci) => (
                <div key={ci.tire.id} className="flex items-center justify-between text-sm">
                  <span style={{ color: 'var(--br-txt)' }}>{ci.tire.brand} {ci.tire.size} × {ci.quantity}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono" style={{ color: 'var(--br-amb)' }}>{formatCurrency(priceFor(ci.tire) * ci.quantity)}</span>
                    <button onClick={() => setCart((p) => p.filter((i) => i.tire.id !== ci.tire.id))} style={{ color: 'var(--br-txt2)' }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              <div className="flex justify-between font-semibold pt-2" style={{ borderTop: '1px solid var(--br-bor)' }}>
                <span style={{ color: 'var(--br-txt)' }}>Total</span>
                <span className="font-mono" style={{ color: 'var(--br-amb)' }}>{formatCurrency(cartTotal)}</span>
              </div>
            </div>
          </div>

          {/* Delivery type */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--br-txt2)' }}>Tipo de entrega</label>
            <div className="grid grid-cols-2 gap-2">
              {([['retiro', 'Retiro en local'], ['entrega_domicilio', 'Entrega a domicilio']] as const).map(([val, lbl]) => (
                <button key={val} onClick={() => setOrderType(val)}
                  className="py-2.5 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    border: `1px solid ${orderType === val ? 'var(--br-amb)' : 'var(--br-bor)'}`,
                    background: orderType === val ? 'var(--br-amb-bg)' : 'var(--br-sur)',
                    color: orderType === val ? 'var(--br-amb)' : 'var(--br-txt2)',
                  }}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {orderType === 'entrega_domicilio' && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>Dirección</label>
              <input type="text" value={orderAddress} onChange={(e) => setOrderAddress(e.target.value)}
                placeholder="Calle, número, ciudad..." className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }} />
            </div>
          )}

          {/* Date + time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>Fecha</label>
              <input type="date" value={orderDate} min={minDate} onChange={(e) => setOrderDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>Horario</label>
              <select value={orderTime} onChange={(e) => setOrderTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}>
                <option value="">A coordinar</option>
                {orderConfig.timeSlots.map((ts) => <option key={ts} value={ts}>{ts}</option>)}
              </select>
            </div>
          </div>

          {/* Payment */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>Pago (referencia)</label>
            <select value={orderPayment} onChange={(e) => setOrderPayment(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}>
              {PAYMENT_METHODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => setOrderOpen(false)} disabled={submitting} className="px-4 py-2 rounded-lg text-sm" style={{ border: '1px solid var(--br-bor)', color: 'var(--br-txt2)' }}>Cancelar</button>
          <button onClick={submitOrder} disabled={submitting} className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ background: 'var(--br-amb)' }}>
            {submitting ? 'Enviando…' : 'Confirmar pedido'}
          </button>
        </div>
      </Modal>

      {/* Success modal */}
      <Modal open={successOpen} onClose={() => setSuccessOpen(false)} title="" size="sm">
        <div className="text-center py-4">
          <CheckCircle className="h-12 w-12 mx-auto mb-3" style={{ color: 'var(--br-grn)' }} />
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--br-txt)' }}>¡Pedido enviado!</h3>
          <p className="text-sm" style={{ color: 'var(--br-txt2)' }}>Tu pedido fue recibido. Te contactaremos para confirmar.</p>
        </div>
        <div className="text-center mt-2">
          <button onClick={() => setSuccessOpen(false)} className="px-6 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: 'var(--br-amb)' }}>
            Continuar →
          </button>
        </div>
      </Modal>
    </div>
  );
}

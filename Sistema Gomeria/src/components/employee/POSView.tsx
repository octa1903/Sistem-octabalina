import { useState, useMemo } from 'react';
import type { Tire, CartItem, Sale, SaleItem } from '@/types';
import { tireService, saleService, clientService } from '@/services/storageService';
import { PAYMENT_METHODS, TIRE_CATEGORIES } from '@/constants';
import { formatCurrency, applySurcharge } from '@/utils/currency';
import { Modal } from '@/components/ui/Modal';
import { Search, Plus, Minus, Trash2, ShoppingCart, CheckCircle } from 'lucide-react';

interface Props { addToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void; }

export function POSView({ addToast }: Props) {
  const [tires] = useState<Tire[]>(() => tireService.getAll().filter((t) => t.stock > 0));
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [clientId, setClientId] = useState('');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);

  const clients = useMemo(() => clientService.getAll(), []);
  const selectedClient = clients.find((c) => c.id === clientId);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return tires.filter((t) => {
      if (filterCat && t.category !== filterCat) return false;
      if (q && !`${t.brand} ${t.model} ${t.size}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tires, search, filterCat]);

  const pm = PAYMENT_METHODS.find((p) => p.id === paymentMethod) ?? PAYMENT_METHODS[0];
  const subtotal = cart.reduce((s, i) => s + i.subtotal, 0);
  const total = applySurcharge(subtotal, pm.surcharge);

  function addToCart(t: Tire) {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.tire.id === t.id);
      if (idx >= 0) {
        const updated = [...prev];
        const cur = updated[idx];
        if (cur.quantity >= t.stock) {
          addToast(`Stock máximo: ${t.stock} unidades.`, 'warning');
          return prev;
        }
        updated[idx] = { ...cur, quantity: cur.quantity + 1, subtotal: (cur.quantity + 1) * cur.unitPrice };
        return updated;
      }
      return [...prev, { tire: t, quantity: 1, unitPrice: t.salePrice, subtotal: t.salePrice }];
    });
  }

  function updateQty(id: string, delta: number) {
    setCart((prev) => {
      return prev
        .map((i) => {
          if (i.tire.id !== id) return i;
          const q = Math.max(0, Math.min(i.quantity + delta, i.tire.stock));
          return { ...i, quantity: q, subtotal: q * i.unitPrice };
        })
        .filter((i) => i.quantity > 0);
    });
  }

  function checkout() {
    if (cart.length === 0) { addToast('El carrito está vacío.', 'warning'); return; }
    setCheckoutOpen(true);
  }

  function confirmSale() {
    const now = new Date().toISOString();
    const items: SaleItem[] = cart.map((ci) => ({
      tireId: ci.tire.id,
      brand: ci.tire.brand,
      model: ci.tire.model,
      size: ci.tire.size,
      quantity: ci.quantity,
      unitPrice: ci.unitPrice,
      subtotal: ci.subtotal,
    }));

    const sale: Sale = {
      id: `s${Date.now()}`,
      items,
      total,
      paymentMethod: pm.label,
      surcharge: pm.surcharge,
      clientId: clientId || undefined,
      clientName: selectedClient?.name,
      date: now,
      notes: '',
    };

    // Update stock
    for (const ci of cart) {
      const fresh = tireService.getById(ci.tire.id);
      if (fresh) tireService.save({ ...fresh, stock: fresh.stock - ci.quantity, updatedAt: now });
    }

    saleService.save(sale);
    setLastSale(sale);
    setCart([]);
    setClientId('');
    setCheckoutOpen(false);
    setSuccessOpen(true);
    addToast('Venta registrada.', 'success');
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
            {TIRE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-2">
            {filtered.map((t) => (
              <button
                key={t.id}
                onClick={() => addToCart(t)}
                className="text-left rounded-xl p-3 transition-all"
                style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}
                onMouseOver={(e) => (e.currentTarget.style.borderColor = 'var(--br-amb)')}
                onMouseOut={(e) => (e.currentTarget.style.borderColor = 'var(--br-bor)')}
              >
                <p className="text-xs font-medium" style={{ color: 'var(--br-txt2)' }}>{t.brand}</p>
                <p className="font-mono text-sm font-semibold" style={{ color: 'var(--br-txt)' }}>{t.size}</p>
                <p className="text-xs" style={{ color: 'var(--br-txt2)' }}>{t.model}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-semibold text-sm" style={{ color: 'var(--br-amb)' }}>
                    {formatCurrency(t.salePrice)}
                  </span>
                  <span className="text-xs px-1.5 py-0.5 rounded-full" style={{
                    color: t.stock <= t.minStock ? 'var(--br-red)' : 'var(--br-grn)',
                    background: t.stock <= t.minStock ? 'var(--br-red-bg)' : 'var(--br-grn-bg)',
                  }}>
                    {t.stock} u.
                  </span>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="col-span-3 text-sm py-10 text-center" style={{ color: 'var(--br-txt2)' }}>Sin resultados.</p>
            )}
          </div>
        </div>
      </div>

      {/* Cart panel */}
      <div className="w-80 flex flex-col" style={{ background: 'var(--br-sur)', borderLeft: '1px solid var(--br-bor)' }}>
        <div className="px-4 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid var(--br-bor)' }}>
          <ShoppingCart className="h-5 w-5" style={{ color: 'var(--br-amb)' }} />
          <span className="font-semibold text-sm" style={{ color: 'var(--br-txt)' }}>Carrito ({cart.length})</span>
        </div>

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
          {/* Client selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>
              Cliente (opcional)
            </label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}
            >
              <option value="">Sin cliente</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Payment method */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>
              Método de pago
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}
            >
              {PAYMENT_METHODS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}{p.surcharge > 0 ? ` (+${p.surcharge}%)` : ''}</option>
              ))}
            </select>
          </div>

          {/* Totals */}
          <div className="space-y-1 text-sm">
            <div className="flex justify-between" style={{ color: 'var(--br-txt2)' }}>
              <span>Subtotal</span>
              <span className="font-mono">{formatCurrency(subtotal)}</span>
            </div>
            {pm.surcharge > 0 && (
              <div className="flex justify-between text-xs" style={{ color: 'var(--br-txt2)' }}>
                <span>Recargo {pm.surcharge}%</span>
                <span className="font-mono">{formatCurrency(total - subtotal)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-base" style={{ color: 'var(--br-txt)' }}>
              <span>Total</span>
              <span className="font-mono" style={{ color: 'var(--br-amb)' }}>{formatCurrency(total)}</span>
            </div>
          </div>

          <button
            onClick={checkout}
            disabled={cart.length === 0}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-40"
            style={{ background: 'var(--br-amb)' }}
          >
            Cobrar {formatCurrency(total)}
          </button>
        </div>
      </div>

      {/* Checkout modal */}
      <Modal open={checkoutOpen} onClose={() => setCheckoutOpen(false)} title="Confirmar venta" size="sm">
        <div className="space-y-3">
          {cart.map((ci) => (
            <div key={ci.tire.id} className="flex justify-between text-sm" style={{ color: 'var(--br-txt)' }}>
              <span>{ci.tire.brand} {ci.tire.size} × {ci.quantity}</span>
              <span className="font-mono">{formatCurrency(ci.subtotal)}</span>
            </div>
          ))}
          <div className="pt-2" style={{ borderTop: '1px solid var(--br-bor)' }}>
            <div className="flex justify-between font-semibold">
              <span>Total ({pm.label})</span>
              <span className="font-mono" style={{ color: 'var(--br-amb)' }}>{formatCurrency(total)}</span>
            </div>
            {selectedClient && (
              <p className="text-xs mt-1" style={{ color: 'var(--br-txt2)' }}>Cliente: {selectedClient.name}</p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => setCheckoutOpen(false)} className="px-4 py-2 rounded-lg text-sm" style={{ border: '1px solid var(--br-bor)', color: 'var(--br-txt2)' }}>
            Cancelar
          </button>
          <button onClick={confirmSale} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: 'var(--br-grn)' }}>
            Confirmar venta
          </button>
        </div>
      </Modal>

      {/* Success modal */}
      <Modal open={successOpen} onClose={() => setSuccessOpen(false)} title="" size="sm">
        <div className="text-center py-4">
          <CheckCircle className="h-12 w-12 mx-auto mb-3" style={{ color: 'var(--br-grn)' }} />
          <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--br-txt)' }}>¡Venta registrada!</h3>
          {lastSale && (
            <p className="text-2xl font-bold font-mono" style={{ color: 'var(--br-amb)' }}>
              {formatCurrency(lastSale.total)}
            </p>
          )}
          <p className="text-sm mt-1" style={{ color: 'var(--br-txt2)' }}>{lastSale?.paymentMethod}</p>
        </div>
        <div className="text-center mt-2">
          <button onClick={() => setSuccessOpen(false)} className="px-6 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: 'var(--br-dark)' }}>
            Continuar
          </button>
        </div>
      </Modal>
    </div>
  );
}

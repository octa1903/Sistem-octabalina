// ═══════════════════════════════════════════════════
// CartPanel — panel derecho del POS: items del carrito, selección
// de cliente/método/descuento, resumen de totales, acciones de
// cobrar / guardar ticket / abrir tickets parkeados.
//
// Extraído de POSView en Fase C del plan de mejoras. Recibe estado
// + handlers; no carga datos por sí mismo.
// ═══════════════════════════════════════════════════

import type {
  TireV2,
  TireStoreOverride,
  Customer,
  PaymentMethod,
  Discount,
  Receipt,
  CashSession,
  LoyaltyConfig,
} from '@/types';
import { Button, Select } from '@/components/ui';
import { ShoppingCart, Plus, Minus, Trash2, Lock, Bookmark, Inbox, Tag } from 'lucide-react';
import { formatCurrency } from '@/utils/currency';

export interface CartItem {
  tire: TireV2;
  override: TireStoreOverride | undefined;
  unitPrice: number;
  unitCost: number;
  stock: number;
  quantity: number;
  subtotal: number;
}

interface TaxBreakdownRow {
  taxId: string;
  name: string;
  amount: number;
}

export interface CartPanelProps {
  // Estado del carrito
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  cashSession: CashSession | null;

  // Selectores de cliente/método/descuento
  customers: Customer[];
  customerId: string;
  setCustomerId: (id: string) => void;
  paymentMethods: PaymentMethod[];
  paymentMethodId: string;
  setPaymentMethodId: (id: string) => void;
  selectedPm: PaymentMethod | undefined;
  selectedCustomer: Customer | undefined;
  isAccountPaymentMethod: (pm: PaymentMethod | undefined) => boolean;

  // Loyalty
  loyalty: LoyaltyConfig;
  customerPointsBalance: number;
  pointsToRedeem: string;
  setPointsToRedeem: (v: string) => void;
  pointsRedeemed: number;
  requestedPoints: number;
  subtotalAfterDiscount: number;

  // Descuento
  canDiscount: boolean;
  discounts: Discount[];
  ticketDiscountId: string;
  setTicketDiscountId: (id: string) => void;
  ticketDiscount: Discount | null;
  pendingDiscountValue: string;
  setPendingDiscountValue: (v: string) => void;
  ticketDiscountAmount: number;

  // Totales
  subtotal: number;
  surchargeRate: number;
  surchargeAmount: number;
  total: number;
  taxBreakdown: { included: TaxBreakdownRow[]; added: TaxBreakdownRow[] };

  // Acciones
  updateQty: (tireId: string, delta: number) => void;
  onClearCart: () => void;
  onCheckout: () => void;
  canCheckout: boolean;
  onOpenPark: () => void;
  onOpenParkedList: () => void;
  parkedTickets: Receipt[];
  resumingParkedId: string | null;
}

export function CartPanel(props: CartPanelProps): React.ReactElement {
  const {
    cart, cashSession, setCart,
    customers, customerId, setCustomerId,
    paymentMethods, paymentMethodId, setPaymentMethodId,
    selectedPm, selectedCustomer, isAccountPaymentMethod,
    loyalty, customerPointsBalance, pointsToRedeem, setPointsToRedeem,
    pointsRedeemed, requestedPoints, subtotalAfterDiscount,
    canDiscount, discounts, ticketDiscountId, setTicketDiscountId,
    ticketDiscount, pendingDiscountValue, setPendingDiscountValue,
    ticketDiscountAmount,
    subtotal, surchargeRate, surchargeAmount, total, taxBreakdown,
    updateQty, onClearCart, onCheckout, canCheckout,
    onOpenPark, onOpenParkedList, parkedTickets, resumingParkedId,
  } = props;

  return (
    <div className="w-80 flex flex-col" style={{ background: 'var(--br-sur)', borderLeft: '1px solid var(--br-bor)' }}>
      <div className="px-4 py-4 flex items-center justify-between gap-2" style={{ borderBottom: '1px solid var(--br-bor)' }}>
        <div className="flex items-center gap-2 min-w-0">
          <ShoppingCart className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--br-amb)' }} />
          <span className="font-semibold text-sm" style={{ color: 'var(--br-txt)' }}>Carrito ({cart.length})</span>
        </div>
        {cart.length > 0 && (
          <button
            type="button"
            onClick={onClearCart}
            className="text-xs font-medium px-2 py-1 rounded transition-colors hover:bg-[var(--br-red-bg)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--br-red)]"
            style={{ color: 'var(--br-red)' }}
            aria-label={`Vaciar carrito (${cart.length} ${cart.length === 1 ? 'ítem' : 'ítems'})`}
          >
            Vaciar
          </button>
        )}
      </div>

      {!cashSession && (
        <div
          role="status"
          className="mx-3 mt-3 p-3 rounded-lg flex items-start gap-2"
          style={{ background: 'var(--br-warn-bg)', border: '1px solid var(--br-warn-bor)', color: 'var(--br-warn)' }}
        >
          <Lock className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
          <span className="text-xs">Caja cerrada. Tocá «Abrir caja» arriba para empezar a vender.</span>
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
              <div className="flex items-center justify-between mt-2 gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateQty(ci.tire.id, -1)}
                    aria-label={`Restar ${ci.tire.brand} ${ci.tire.size}`}
                    className="w-12 h-12 rounded flex items-center justify-center transition-colors hover:bg-[var(--br-sur2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--br-amb)] active:bg-[var(--br-bor)]"
                    style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}
                  >
                    <Minus className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <span className="w-8 text-center text-sm font-semibold tabular-nums" aria-live="polite" aria-atomic="true">{ci.quantity}</span>
                  <button
                    type="button"
                    onClick={() => updateQty(ci.tire.id, 1)}
                    aria-label={`Sumar ${ci.tire.brand} ${ci.tire.size}`}
                    className="w-12 h-12 rounded flex items-center justify-center transition-colors hover:bg-[var(--br-sur2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--br-amb)] active:bg-[var(--br-bor)]"
                    style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                <span className="text-sm font-semibold font-mono" style={{ color: 'var(--br-amb)' }}>{formatCurrency(ci.subtotal)}</span>
                <button
                  type="button"
                  onClick={() => setCart((p) => p.filter((i) => i.tire.id !== ci.tire.id))}
                  aria-label={`Quitar ${ci.tire.brand} ${ci.tire.size} del carrito`}
                  className="w-12 h-12 ml-2 rounded flex items-center justify-center transition-colors hover:bg-[var(--br-red-bg)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--br-red)]"
                  style={{ color: 'var(--br-red)' }}
                >
                  <Trash2 className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Cart footer */}
      <div className="p-4 space-y-3" style={{ borderTop: '1px solid var(--br-bor)' }}>
        <div>
          <label htmlFor="pos-customer" className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>
            Cliente {isAccountPaymentMethod(selectedPm) ? '(requerido por Cuenta Corriente)' : '(opcional)'}
          </label>
          <Select
            id="pos-customer"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            <option value="">Sin cliente</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          {isAccountPaymentMethod(selectedPm) && !customerId && (
            <p className="text-[11px] mt-1" style={{ color: 'var(--br-red)' }}>
              Cuenta Corriente exige un cliente: la deuda se asienta a su cuenta.
            </p>
          )}
          {loyalty.enabled && selectedCustomer && customerPointsBalance > 0 && (
            <div className="mt-2">
              <label htmlFor="pos-points-redeem" className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>
                Canjear puntos · saldo {customerPointsBalance.toFixed(0)} pts
              </label>
              <input
                id="pos-points-redeem"
                type="number"
                min={0}
                max={Math.min(customerPointsBalance, subtotalAfterDiscount)}
                step={1}
                value={pointsToRedeem}
                onChange={(e) => setPointsToRedeem(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--br-amb)]"
                style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}
              />
              {requestedPoints > pointsRedeemed && (
                <p className="text-[11px] mt-1" style={{ color: 'var(--br-amb)' }}>
                  Limitado a {pointsRedeemed} pts (saldo o subtotal).
                </p>
              )}
            </div>
          )}
        </div>

        <div>
          <label htmlFor="pos-payment-method" className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>
            Método de pago
          </label>
          <Select
            id="pos-payment-method"
            value={paymentMethodId}
            onChange={(e) => setPaymentMethodId(e.target.value)}
          >
            {paymentMethods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}{p.surchargePercent > 0 ? ` (+${p.surchargePercent}%)` : ''}
              </option>
            ))}
          </Select>
        </div>

        {canDiscount && discounts.length > 0 && (
          <div>
            <label htmlFor="pos-discount" className="text-xs font-semibold uppercase tracking-wide mb-1 flex items-center gap-1" style={{ color: 'var(--br-txt2)' }}>
              <Tag className="h-3 w-3" aria-hidden="true" /> Descuento
            </label>
            <Select
              id="pos-discount"
              value={ticketDiscountId}
              onChange={(e) => { setTicketDiscountId(e.target.value); setPendingDiscountValue(''); }}
            >
              <option value="">Sin descuento</option>
              {discounts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.value !== null
                    ? ` · ${d.type === 'percent' ? `${d.value}%` : formatCurrency(d.value)}`
                    : ' · pedir valor'}
                </option>
              ))}
            </Select>
            {ticketDiscount && ticketDiscount.value === null && (
              <input
                type="number"
                value={pendingDiscountValue}
                onChange={(e) => setPendingDiscountValue(e.target.value)}
                placeholder={ticketDiscount.type === 'percent' ? '% (ej: 10)' : 'Monto $ (ej: 500)'}
                aria-label={ticketDiscount.type === 'percent' ? 'Porcentaje de descuento' : 'Monto de descuento'}
                min="0"
                step="0.01"
                className="w-full mt-2 px-3 py-2 rounded-lg text-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--br-amb)]"
                style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}
              />
            )}
          </div>
        )}

        <div className="space-y-1 text-sm">
          <div className="flex justify-between" style={{ color: 'var(--br-txt2)' }}>
            <span>Subtotal</span>
            <span className="font-mono">{formatCurrency(subtotal)}</span>
          </div>
          {ticketDiscountAmount > 0 && (
            <div className="flex justify-between text-xs" style={{ color: 'var(--br-grn)' }}>
              <span>− {ticketDiscount?.name}</span>
              <span className="font-mono">−{formatCurrency(ticketDiscountAmount)}</span>
            </div>
          )}
          {pointsRedeemed > 0 && (
            <div className="flex justify-between text-xs" style={{ color: 'var(--br-grn)' }}>
              <span>− {pointsRedeemed} puntos canjeados</span>
              <span className="font-mono">−{formatCurrency(pointsRedeemed)}</span>
            </div>
          )}
          {taxBreakdown.included.map(t => (
            <div key={t.taxId} className="flex justify-between text-xs" style={{ color: 'var(--br-txt2)' }}>
              <span>{t.name} (incluido)</span>
              <span className="font-mono">{formatCurrency(t.amount)}</span>
            </div>
          ))}
          {taxBreakdown.added.map(t => (
            <div key={t.taxId} className="flex justify-between text-xs" style={{ color: 'var(--br-txt2)' }}>
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
          <div
            className="flex justify-between items-baseline pt-2 mt-1"
            style={{ borderTop: '2px solid var(--br-bor)' }}
          >
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--br-txt2)' }}>Total</span>
            <span className="text-xl font-bold font-mono tabular-nums" style={{ color: 'var(--br-amb)' }}>{formatCurrency(total)}</span>
          </div>
        </div>

        <Button
          variant="success"
          size="lg"
          fullWidth
          onClick={onCheckout}
          disabled={!canCheckout}
          title={!cashSession ? 'Abrí la caja primero' : undefined}
          className="font-mono tabular-nums"
        >
          <span className="font-semibold not-italic" style={{ fontFamily: 'inherit' }}>Cobrar</span>
          <span className="ml-1">{formatCurrency(total)}</span>
        </Button>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            size="sm"
            iconLeft={<Bookmark className="h-3.5 w-3.5" />}
            onClick={onOpenPark}
            disabled={cart.length === 0 || !cashSession}
            title="Guardar ticket abierto (sin cobrar)"
            fullWidth
          >
            Guardar ticket
          </Button>
          <Button
            variant="secondary"
            size="sm"
            iconLeft={<Inbox className="h-3.5 w-3.5" />}
            onClick={onOpenParkedList}
            title="Ver tickets abiertos"
            fullWidth
          >
            Tickets abiertos
            {parkedTickets.length > 0 && (
              <span
                aria-label={`${parkedTickets.length} ticket(s) abierto(s)`}
                className="ml-1.5 px-1.5 min-w-[18px] inline-flex items-center justify-center rounded-full text-[10px] font-bold tabular-nums"
                style={{ background: 'var(--br-amb)', color: 'var(--br-bg)' }}
              >
                {parkedTickets.length}
              </span>
            )}
          </Button>
        </div>

        {resumingParkedId && (
          <p className="text-[11px] text-center" style={{ color: 'var(--br-amb)' }}>
            Reanudando ticket abierto · al cobrar se elimina
          </p>
        )}
      </div>
    </div>
  );
}

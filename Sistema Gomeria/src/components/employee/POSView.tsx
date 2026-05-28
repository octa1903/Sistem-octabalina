import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type {
  TireV2, TireStoreOverride, Category, Customer, PaymentMethod, CashSession, Tax, Store, ReceiptConfig,
  Receipt, ReceiptLine, Discount,
  BuildReceiptInput, LoyaltyConfig,
} from '@/types';
import { tireServiceV2 } from '@/services/tireServiceV2';
import { categoryService } from '@/services/categoryService';
import { customerServiceV2 } from '@/services/customerServiceV2';
import { receiptService } from '@/services/receiptService';
import { taxService } from '@/services/taxService';
import { discountService } from '@/services/discountService';
import { storeService } from '@/services/storeService';
import { receiptConfigService } from '@/services/receiptConfigService';
import { useCurrentEmployee } from '@/hooks/useCurrentEmployee';
import { hasPermission, maxDiscountFor } from '@/services/roleService';
import { supabase } from '@/services/supabaseClient';
import { ensureNoError, rowToCamel } from '@/services/supabaseHelpers';
import { formatCurrency } from '@/utils/currency';
import { printReceipt } from '@/utils/printReceipt';
import { buildLine } from '@/utils/buildLine';
import { rollupTaxes } from '@/utils/rollupTaxes';
import { CartPanel } from './pos/CartPanel';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Button, Input, Select } from '@/components/ui';
import { Search, Trash2, CheckCircle, Printer } from 'lucide-react';

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

// Cuenta corriente: detectada por nombre normalizado del PaymentMethod, ya que
// el enum `type` no distingue ('other'). Cobrar contra cuenta sin cliente
// seleccionado deja deuda huérfana — bloqueamos el flujo.
function isAccountPaymentMethod(pm: PaymentMethod | undefined): boolean {
  if (!pm) return false;
  const n = pm.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return n.includes('cuenta corriente') || n.includes('cta cte') || n.includes('cta. cte');
}

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
  const current = useCurrentEmployee();
  const canDiscount = hasPermission(current.employee?.role ?? null, 'pos.discount');
  // Tope de descuento del rol del operador (en %). 100 = sin tope.
  // Coordinado con migration 0020: el server valida lo mismo y aborta el RPC.
  const operatorMaxDiscountPct = maxDiscountFor(current.employee?.role ?? null);

  const [tires, setTires] = useState<TireV2[]>([]);
  const [overridesByTire, setOverridesByTire] = useState<Map<string, TireStoreOverride>>(new Map());
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [store, setStore] = useState<Store | null>(null);
  const [receiptConfig, setReceiptConfig] = useState<ReceiptConfig | null>(null);
  const [loyalty, setLoyalty] = useState<LoyaltyConfig>(DEFAULT_LOYALTY);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [ticketDiscountId, setTicketDiscountId] = useState('');
  const [pendingDiscountValue, setPendingDiscountValue] = useState<string>('');
  const [pointsToRedeem, setPointsToRedeem] = useState<string>('');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // Guard sincrónico contra doble-tap: setConfirming(true) recién aplica
  // en el siguiente frame, dejando una ventana donde dos taps rápidos
  // pueden disparar dos ventas. La ref bloquea desde el primer click.
  const confirmingRef = useRef(false);
  const [clearCartConfirm, setClearCartConfirm] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<{ number: string; total: number; pmName: string } | null>(null);
  const [lastReceiptData, setLastReceiptData] = useState<LastReceiptData | null>(null);

  // Tickets abiertos (parked)
  const [parkedTickets, setParkedTickets] = useState<Receipt[]>([]);
  const [parkOpen, setParkOpen] = useState(false);
  const [parkName, setParkName] = useState('');
  const [parking, setParking] = useState(false);
  const [parkedListOpen, setParkedListOpen] = useState(false);
  const [resumingParkedId, setResumingParkedId] = useState<string | null>(null);
  const [parkedToDelete, setParkedToDelete] = useState<Receipt | null>(null);
  const [employeeNameById, setEmployeeNameById] = useState<Map<string, string>>(new Map());

  const reloadParked = useCallback(async () => {
    try {
      const list = await receiptService.getParked(storeId);
      setParkedTickets(list);
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error cargando tickets abiertos.', 'error');
    }
  }, [storeId, addToast]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [tiresV2, cats, custs, ovr, pms, taxesData, discountsData, storeData, rConfig, { data: loyaltyData }, parked, empsRes] = await Promise.all([
        tireServiceV2.getAll(),
        categoryService.getAll(),
        customerServiceV2.getAll(),
        tireServiceV2.getOverridesByStore(storeId),
        supabase.from('payment_methods').select('*').order('sort_order', { ascending: true }).then(r =>
          ensureNoError(r.data, r.error, 'POSView.paymentMethods').map(row => rowToCamel<PaymentMethod>(row)),
        ),
        taxService.getAll(),
        discountService.getForStore(storeId),
        storeService.getById(storeId),
        receiptConfigService.getByStore(storeId).catch(() => null),
        supabase.from('loyalty_config').select('*').maybeSingle(),
        receiptService.getParked(storeId),
        supabase.from('employees').select('id, name'),
      ]);
      setParkedTickets(parked);
      const empMap = new Map<string, string>();
      (empsRes.data ?? []).forEach((e: { id: string; name: string }) => empMap.set(e.id, e.name));
      setEmployeeNameById(empMap);
      const m = new Map<string, TireStoreOverride>();
      ovr.forEach(o => m.set(o.tireId, o));
      setTires(tiresV2);
      setOverridesByTire(m);
      setCategories(cats);
      setCustomers(custs);
      setPaymentMethods(pms);
      setTaxes(taxesData);
      setDiscounts(discountsData);
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
  const selectedCustomer = customers.find(c => c.id === customerId);
  const ticketDiscount = discounts.find(d => d.id === ticketDiscountId) ?? null;
  const surchargeRate = (selectedPm?.surchargePercent ?? 0) / 100;

  // Cálculo de líneas + totales delegado a utils/buildLine + utils/rollupTaxes.
  // Ver tests en utils/__tests__/{buildLine,rollupTaxes}.test.ts.
  const taxesById = useMemo(() => new Map(taxes.map(t => [t.id, t])), [taxes]);
  const cartLines = useMemo(
    () => cart.map(ci => {
      const lineTaxes = (ci.tire.taxIds ?? [])
        .map(tid => taxesById.get(tid))
        .filter((t): t is Tax => Boolean(t))
        .filter(t => !t.storeIds || t.storeIds.includes(storeId));
      return buildLine({
        unitPrice: ci.unitPrice,
        quantity: ci.quantity,
        taxes: lineTaxes,
      });
    }),
    [cart, taxesById, storeId],
  );

  const rollup = useMemo(() => {
    const dv = ticketDiscount?.value ?? Number(pendingDiscountValue);
    const tDiscount = ticketDiscount && Number.isFinite(dv) && dv > 0
      ? { type: ticketDiscount.type, value: dv }
      : null;
    return rollupTaxes({
      lines: cartLines,
      ticketDiscount: tDiscount,
      operatorMaxDiscountPct,
      pointsToRedeem: loyalty.enabled && selectedCustomer ? Math.floor(Number(pointsToRedeem) || 0) : 0,
      customerPointsBalance: Number(selectedCustomer?.pointsBalance ?? 0),
      surchargeRate,
    });
  }, [cartLines, ticketDiscount, pendingDiscountValue, operatorMaxDiscountPct, loyalty.enabled, selectedCustomer, pointsToRedeem, surchargeRate]);

  const subtotal = rollup.subtotal;
  const ticketDiscountAmount = rollup.ticketDiscountAmount;
  const ticketDiscountWasCapped = rollup.ticketDiscountWasCapped;
  const pointsRedeemed = rollup.pointsRedeemed;
  const total = rollup.total;
  const surchargeAmount = rollup.surchargeAmount;
  const taxBreakdown = { included: rollup.taxesIncluded, added: rollup.taxesAdded };

  // Derivados para UI de canje de puntos (input limita por subtotal post-descuento).
  const customerPointsBalance = Number(selectedCustomer?.pointsBalance ?? 0);
  const subtotalAfterDiscount = Math.max(0, subtotal - ticketDiscountAmount);
  const requestedPoints = Math.max(0, Math.floor(Number(pointsToRedeem) || 0));

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

  const accountRequiresCustomer = isAccountPaymentMethod(selectedPm) && !customerId;
  const canCheckout = cart.length > 0 && cashSession !== null && employeeId !== null && !accountRequiresCustomer;

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
    if (isAccountPaymentMethod(selectedPm) && !customerId) {
      addToast('Para cobrar con Cuenta Corriente seleccioná un cliente.', 'warning');
      return;
    }
    // Migration 0019: si paga con cuenta corriente, anticipamos que el server
    // rechaza el charge si supera credit_limit > 0 del cliente.
    if (isAccountPaymentMethod(selectedPm) && selectedCustomer && selectedCustomer.creditLimit > 0) {
      const projected = (selectedCustomer.accountBalance ?? 0) + total;
      if (projected > selectedCustomer.creditLimit + 0.01) {
        addToast(
          `Este cargo dejaría al cliente sobre el cupo ($${projected.toFixed(2)} > $${selectedCustomer.creditLimit.toFixed(2)}).`,
          'warning',
        );
        return;
      }
    }
    if (ticketDiscountWasCapped) {
      addToast(`Descuento truncado al ${operatorMaxDiscountPct}% (tope de tu rol).`, 'info');
    }
    // Express: venta simple (efectivo, sin descuento, sin puntos, ≤3 ítems) salta el modal.
    // PRODUCT.md §1: cada acción frecuente del POS en ≤2 taps. El operador ya leyó el panel.
    const isExpress =
      selectedPm?.type === 'cash' &&
      !ticketDiscount &&
      !pointsToRedeem &&
      cart.length <= 3 &&
      !isAccountPaymentMethod(selectedPm);
    if (isExpress) {
      void confirmSale();
      return;
    }
    setCheckoutOpen(true);
  }

  /**
   * Resuelve el discount con el valor efectivo: si `value` es null el cajero
   * lo ingresó en `pendingDiscountValue`, lo materializamos en un objeto
   * Discount nuevo para que `receiptService` lo aplique sin pedirlo.
   */
  function resolvedTicketDiscount(): Discount | null {
    if (!ticketDiscount) return null;
    if (ticketDiscount.value !== null) return ticketDiscount;
    const v = Number(pendingDiscountValue);
    if (!Number.isFinite(v) || v <= 0) return null;
    return { ...ticketDiscount, value: v };
  }

  async function confirmSale() {
    if (confirmingRef.current) return;
    if (!cashSession || !employeeId || !selectedPm) return;
    const resolvedDiscount = resolvedTicketDiscount();
    if (ticketDiscount && !resolvedDiscount) {
      addToast('Ingresá el valor del descuento.', 'warning');
      return;
    }
    if (isAccountPaymentMethod(selectedPm) && !customerId) {
      addToast('Para cobrar con Cuenta Corriente seleccioná un cliente.', 'warning');
      return;
    }
    confirmingRef.current = true;
    setConfirming(true);
    try {
      const input: BuildReceiptInput = {
        storeId,
        cashSessionId: cashSession.id,
        employeeId,
        customerId: customerId || undefined,
        cart: cart.map(ci => ({ tireId: ci.tire.id, quantity: ci.quantity, modifiers: [] })),
        ticketDiscountIds: resolvedDiscount ? [resolvedDiscount.id] : [],
        paymentSplits: [{ paymentMethodId: selectedPm.id, amount: total }],
        type: 'sale',
        pointsRedeemed: pointsRedeemed || undefined,
      };

      const tireById = new Map(tires.map(t => [t.id, t]));
      const overrideById = overridesByTire;
      const categoryById = new Map(categories.map(c => [c.id, c]));
      const pmById = new Map(paymentMethods.map(p => [p.id, p]));
      const discountById = new Map(discounts.map(d => [d.id, d]));
      if (resolvedDiscount) discountById.set(resolvedDiscount.id, resolvedDiscount);

      const receipt = await receiptService.buildAndSave(input, {
        getTire: id => tireById.get(id),
        getOverride: (tireId, sId) => sId === storeId ? overrideById.get(tireId) : undefined,
        getCategory: id => categoryById.get(id),
        getTax: id => taxesById.get(id),
        getDiscount: id => discountById.get(id),
        getPaymentMethod: id => pmById.get(id),
        loyalty,
        nextReceiptNumber,
      });

      // Stock decrement ocurre atómicamente en RPC apply_receipt_to_stock.
      // Cargar líneas para el recibo imprimible
      const recLines = await receiptService.getLines(receipt.id);

      setLastReceipt({ number: receipt.receiptNumber, total: receipt.total, pmName: selectedPm.name });
      setLastReceiptData({ receipt, lines: recLines, customer: selectedCustomer ?? null });
      setCart([]);
      setCustomerId('');
      setTicketDiscountId('');
      setPendingDiscountValue('');
      setPointsToRedeem('');
      setCheckoutOpen(false);
      setSuccessOpen(true);
      addToast(`Venta ${receipt.receiptNumber} registrada.`, 'success');

      // Si estábamos reanudando un ticket abierto, eliminarlo ahora.
      if (resumingParkedId) {
        try {
          await receiptService.deleteParked(resumingParkedId);
        } catch {
          addToast('Venta registrada. El ticket abierto no se pudo eliminar — borralo desde "Tickets abiertos".', 'warning');
        }
        setResumingParkedId(null);
        await reloadParked();
      }

      // Recargar overrides para reflejar stock actualizado
      const newOverrides = await tireServiceV2.getOverridesByStore(storeId);
      const m = new Map<string, TireStoreOverride>();
      newOverrides.forEach(o => m.set(o.tireId, o));
      setOverridesByTire(m);
    } catch (e) {
      // Errores conocidos del backend (errcode 23514 con hint):
      //   - 'max_discount_exceeded': migration 0020 (tope descuento por rol)
      //   - 'credit_limit_exceeded': migration 0019 (cupo de crédito)
      //   - 'negative_stock': migration 0018 (stock insuficiente)
      const raw = e instanceof Error ? e.message : String(e);
      let msg = raw;
      if (/max_discount_exceeded/i.test(raw)) {
        msg = `Descuento aplicado supera el tope de tu rol (${operatorMaxDiscountPct}%).`;
      } else if (/credit_limit_exceeded/i.test(raw)) {
        msg = 'El cargo excede el cupo de crédito del cliente.';
      } else if (/negative_stock/i.test(raw)) {
        msg = 'Stock insuficiente para una o más cubiertas de esta venta.';
      } else if (!(e instanceof Error)) {
        msg = 'Error registrando venta.';
      }
      addToast(msg, 'error');
    } finally {
      setConfirming(false);
      confirmingRef.current = false;
    }
  }

  function openPark() {
    if (cart.length === 0) {
      addToast('El carrito está vacío.', 'warning');
      return;
    }
    if (!cashSession) {
      addToast('Tenés que abrir la caja primero.', 'warning');
      return;
    }
    setParkName(selectedCustomer?.name ?? '');
    setParkOpen(true);
  }

  async function confirmPark() {
    if (!cashSession || !employeeId) return;
    const name = parkName.trim();
    if (!name) {
      addToast('Poné un nombre para identificar el ticket.', 'warning');
      return;
    }
    setParking(true);
    try {
      const resolvedDiscount = resolvedTicketDiscount();
      const input: BuildReceiptInput = {
        storeId,
        cashSessionId: cashSession.id,
        employeeId,
        customerId: customerId || undefined,
        cart: cart.map(ci => ({ tireId: ci.tire.id, quantity: ci.quantity, modifiers: [] })),
        ticketDiscountIds: resolvedDiscount ? [resolvedDiscount.id] : [],
        paymentSplits: [],
        type: 'sale',
        parkedName: name,
      };
      const tireById = new Map(tires.map(t => [t.id, t]));
      const overrideById = overridesByTire;
      const categoryById = new Map(categories.map(c => [c.id, c]));
      const pmById = new Map(paymentMethods.map(p => [p.id, p]));
      const discountById = new Map(discounts.map(d => [d.id, d]));
      if (resolvedDiscount) discountById.set(resolvedDiscount.id, resolvedDiscount);
      await receiptService.buildAndSave(input, {
        getTire: id => tireById.get(id),
        getOverride: (tireId, sId) => sId === storeId ? overrideById.get(tireId) : undefined,
        getCategory: id => categoryById.get(id),
        getTax: id => taxesById.get(id),
        getDiscount: id => discountById.get(id),
        getPaymentMethod: id => pmById.get(id),
        loyalty,
        nextReceiptNumber,
      });

      // Si estábamos reanudando otro ticket, lo borramos para no duplicar.
      if (resumingParkedId) {
        try { await receiptService.deleteParked(resumingParkedId); } catch {
          addToast('Ticket guardado. El anterior no se pudo eliminar — borralo desde "Tickets abiertos".', 'warning');
        }
        setResumingParkedId(null);
      }

      setCart([]);
      setCustomerId('');
      setTicketDiscountId('');
      setPendingDiscountValue('');
      setParkOpen(false);
      setParkName('');
      addToast(`Ticket "${name}" guardado.`, 'success');
      await reloadParked();
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error guardando ticket.', 'error');
    } finally {
      setParking(false);
    }
  }

  async function resumeParked(receipt: Receipt) {
    try {
      const lines = await receiptService.getLines(receipt.id);
      const newCart: CartItem[] = [];
      const skipped: string[] = [];
      for (const line of lines) {
        const tire = tires.find(t => t.id === line.tireId);
        const override = overridesByTire.get(line.tireId);
        if (!tire) {
          skipped.push(`${line.tireBrand} ${line.tireSize}`);
          continue;
        }
        const stock = override?.stock ?? 0;
        const qty = Math.min(line.quantity, stock);
        if (qty <= 0) {
          skipped.push(`${line.tireBrand} ${line.tireSize} (sin stock)`);
          continue;
        }
        newCart.push({
          tire,
          override,
          unitPrice: line.unitPrice,
          unitCost: line.unitCost,
          stock,
          quantity: qty,
          subtotal: qty * line.unitPrice,
        });
        if (qty < line.quantity) {
          skipped.push(`${line.tireBrand} ${line.tireSize} ajustado a ${qty} u.`);
        }
      }
      if (newCart.length === 0) {
        addToast('No se pudo reanudar: sin items disponibles.', 'error');
        return;
      }
      setCart(newCart);
      setCustomerId(receipt.customerId ?? '');
      setResumingParkedId(receipt.id);
      setParkedListOpen(false);
      if (skipped.length > 0) {
        addToast(`Reanudado con ajustes: ${skipped.join(', ')}.`, 'warning');
      } else {
        addToast(`Ticket "${receipt.parkedName ?? receipt.receiptNumber}" reanudado.`, 'success');
      }
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error reanudando ticket.', 'error');
    }
  }

  async function deleteParked(id: string) {
    try {
      await receiptService.deleteParked(id);
      if (resumingParkedId === id) setResumingParkedId(null);
      await reloadParked();
      addToast('Ticket eliminado.', 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error eliminando ticket.', 'error');
    }
  }

  return (
    <div className="flex h-full" style={{ minHeight: 0 }}>
      {/* Product panel */}
      <div className="flex-1 flex flex-col p-5 overflow-hidden">
        <h1 className="text-xl font-semibold mb-4" style={{ color: 'var(--br-txt)' }}>Punto de Venta</h1>

        {/* Filters */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <div className="flex-1 min-w-48">
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar neumático..."
              aria-label="Buscar neumático por marca, modelo o medida"
              iconLeft={<Search className="h-4 w-4" />}
            />
          </div>
          <Select
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
            className="w-auto"
          >
            <option value="">Todas</option>
            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </Select>
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            // Skeleton: la grilla queda con la misma forma que la final, así
            // el operador percibe respuesta inmediata aunque Supabase tarde.
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-2" aria-busy="true" aria-label="Cargando neumáticos">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl p-3 motion-safe:animate-pulse"
                  style={{ background: 'var(--br-sur2)', border: '1px solid var(--br-bor)', height: '116px' }}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-2">
              {filtered.map((row) => {
                const low = row.stock <= row.minStock;
                return (
                  <button
                    key={row.tire.id}
                    onClick={() => addToCart(row)}
                    aria-label={`Agregar ${row.tire.brand} ${row.tire.size} ${formatCurrency(row.price)}, ${row.stock} en stock`}
                    className="group text-left rounded-xl p-3 transition-all duration-150 border border-[var(--br-bor)] bg-[var(--br-sur)] hover:border-[var(--br-amb)] hover:shadow-[var(--br-shadow-md)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--br-amb)] active:bg-[var(--br-sur2)] motion-safe:active:scale-[0.98]"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wide leading-none mb-1" style={{ color: 'var(--br-txt2)' }}>{row.tire.brand}</p>
                    <p className="font-mono text-base font-bold leading-tight" style={{ color: 'var(--br-txt)' }}>{row.tire.size}</p>
                    <p className="text-xs truncate mt-0.5" style={{ color: 'var(--br-txt2)' }}>{row.tire.model}</p>
                    <div className="flex items-center justify-between mt-2.5">
                      <span className="font-bold text-sm font-mono" style={{ color: 'var(--br-amb)' }}>
                        {formatCurrency(row.price)}
                      </span>
                      <span
                        className="text-[11px] px-1.5 py-0.5 rounded-full font-semibold"
                        style={{
                          color: low ? 'var(--br-red)' : 'var(--br-grn)',
                          background: low ? 'var(--br-red-bg)' : 'var(--br-grn-bg)',
                        }}
                      >
                        {row.stock} u.
                      </span>
                    </div>
                  </button>
                );
              })}
              {!loading && filtered.length === 0 && (
                <p className="col-span-3 text-sm py-10 text-center" style={{ color: 'var(--br-txt2)' }}>
                  {tires.length === 0 ? 'No hay neumáticos en esta tienda.' : 'Sin resultados.'}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <CartPanel
        cart={cart}
        setCart={setCart}
        cashSession={cashSession}
        customers={customers}
        customerId={customerId}
        setCustomerId={setCustomerId}
        paymentMethods={paymentMethods}
        paymentMethodId={paymentMethodId}
        setPaymentMethodId={setPaymentMethodId}
        selectedPm={selectedPm}
        selectedCustomer={selectedCustomer}
        isAccountPaymentMethod={isAccountPaymentMethod}
        loyalty={loyalty}
        customerPointsBalance={customerPointsBalance}
        pointsToRedeem={pointsToRedeem}
        setPointsToRedeem={setPointsToRedeem}
        pointsRedeemed={pointsRedeemed}
        requestedPoints={requestedPoints}
        subtotalAfterDiscount={subtotalAfterDiscount}
        canDiscount={canDiscount}
        discounts={discounts}
        ticketDiscountId={ticketDiscountId}
        setTicketDiscountId={setTicketDiscountId}
        ticketDiscount={ticketDiscount}
        pendingDiscountValue={pendingDiscountValue}
        setPendingDiscountValue={setPendingDiscountValue}
        ticketDiscountAmount={ticketDiscountAmount}
        subtotal={subtotal}
        surchargeRate={surchargeRate}
        surchargeAmount={surchargeAmount}
        total={total}
        taxBreakdown={taxBreakdown}
        updateQty={updateQty}
        onClearCart={() => setClearCartConfirm(true)}
        onCheckout={checkout}
        canCheckout={canCheckout}
        onOpenPark={openPark}
        onOpenParkedList={() => setParkedListOpen(true)}
        parkedTickets={parkedTickets}
        resumingParkedId={resumingParkedId}
      />

      {/* Checkout modal */}
      <Modal open={checkoutOpen} onClose={() => !confirming && setCheckoutOpen(false)} title="Confirmar venta" size="sm">
        {/* Total como hero: lo primero que el operador lee. */}
        <div className="-mx-5 -mt-2 px-5 py-4 mb-4" style={{ background: 'var(--br-sur2)', borderBottom: '1px solid var(--br-bor)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--br-txt2)' }}>
            Total a cobrar
          </p>
          <p className="text-3xl font-bold font-mono tabular-nums mt-0.5" style={{ color: 'var(--br-amb)' }}>
            {formatCurrency(total)}
          </p>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs mt-1.5" style={{ color: 'var(--br-txt2)' }}>
            <span>{selectedPm?.name}</span>
            {selectedCustomer && (
              <>
                <span aria-hidden="true">·</span>
                <span>{selectedCustomer.name}</span>
              </>
            )}
            {ticketDiscount && (
              <>
                <span aria-hidden="true">·</span>
                <span>con descuento</span>
              </>
            )}
          </div>
        </div>

        {/* Items compactos: 4+ ítems se condensan en scroll. */}
        <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {cart.map((ci) => (
            <li key={ci.tire.id} className="flex justify-between gap-3 text-sm" style={{ color: 'var(--br-txt)' }}>
              <span className="truncate">
                <span style={{ color: 'var(--br-txt2)' }}>{ci.quantity}×</span> {ci.tire.brand} {ci.tire.size}
              </span>
              <span className="font-mono tabular-nums flex-shrink-0" style={{ color: 'var(--br-txt2)' }}>
                {formatCurrency(ci.subtotal)}
              </span>
            </li>
          ))}
        </ul>

        <div className="flex justify-end gap-2 mt-5">
          <Button variant="secondary" onClick={() => setCheckoutOpen(false)} disabled={confirming}>
            Cancelar
          </Button>
          <Button variant="success" size="lg" onClick={confirmSale} loading={confirming}>
            Cobrar {formatCurrency(total)}
          </Button>
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
          <Button
            variant="secondary"
            iconLeft={<Printer className="h-4 w-4" />}
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
          >
            Imprimir
          </Button>
          <Button variant="primary" onClick={() => setSuccessOpen(false)}>
            Continuar
          </Button>
        </div>
      </Modal>

      {/* Guardar ticket (park) */}
      <Modal open={parkOpen} onClose={() => !parking && setParkOpen(false)} title="Guardar ticket abierto" size="sm">
        <div className="space-y-3">
          <p className="text-xs" style={{ color: 'var(--br-txt2)' }}>
            El ticket queda en espera. No descuenta stock ni registra pagos hasta que lo reanudes y cobres.
          </p>
          <div>
            <label htmlFor="pos-park-name" className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>
              Nombre / Referencia
            </label>
            <Input
              id="pos-park-name"
              type="text"
              value={parkName}
              onChange={(e) => setParkName(e.target.value)}
              placeholder="Ej: Camioneta blanca, Juan Pérez..."
              autoFocus
              maxLength={60}
              onKeyDown={(e) => { if (e.key === 'Enter') void confirmPark(); }}
            />
          </div>
          <div className="flex justify-between text-sm pt-2" style={{ borderTop: '1px solid var(--br-bor)' }}>
            <span style={{ color: 'var(--br-txt2)' }}>{cart.length} item(s)</span>
            <span className="font-mono font-semibold" style={{ color: 'var(--br-amb)' }}>{formatCurrency(subtotal)}</span>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="secondary" onClick={() => setParkOpen(false)} disabled={parking}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={confirmPark} loading={parking} disabled={parking || !parkName.trim()}>
            Guardar
          </Button>
        </div>
      </Modal>

      {/* Lista de tickets abiertos */}
      <Modal open={parkedListOpen} onClose={() => setParkedListOpen(false)} title="Tickets abiertos" size="md">
        {parkedTickets.length === 0 ? (
          <p className="text-sm py-8 text-center" style={{ color: 'var(--br-txt2)' }}>
            No hay tickets abiertos en esta tienda.
          </p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {parkedTickets.map(p => {
              const cust = customers.find(c => c.id === p.customerId);
              const empName = employeeNameById.get(p.employeeId);
              return (
                <div
                  key={p.id}
                  className="rounded-lg p-3 flex items-center justify-between gap-3"
                  style={{ background: 'var(--br-sur2)', border: '1px solid var(--br-bor)' }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--br-txt)' }}>
                      {p.parkedName ?? p.receiptNumber}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--br-txt2)' }}>
                      {new Date(p.createdAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                      {empName ? ` · ${empName}` : ''}
                      {cust ? ` · ${cust.name}` : ''}
                    </p>
                    <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--br-amb)' }}>
                      {formatCurrency(p.total)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="success"
                      size="sm"
                      onClick={() => void resumeParked(p)}
                    >
                      Reanudar
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setParkedToDelete(p)}
                      aria-label={`Eliminar ticket ${p.parkedName ?? p.receiptNumber}`}
                      title="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" style={{ color: 'var(--br-red)' }} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex justify-end mt-4">
          <Button variant="secondary" onClick={() => setParkedListOpen(false)}>
            Cerrar
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={parkedToDelete !== null}
        onClose={() => setParkedToDelete(null)}
        onConfirm={() => {
          if (parkedToDelete) {
            void deleteParked(parkedToDelete.id);
            setParkedToDelete(null);
          }
        }}
        title="Eliminar ticket abierto"
        message={`Se descartará "${parkedToDelete?.parkedName ?? parkedToDelete?.receiptNumber ?? ''}". Esta acción no se puede deshacer.`}
        type="danger"
        confirmText="Eliminar"
      />

      <ConfirmDialog
        open={clearCartConfirm}
        onClose={() => setClearCartConfirm(false)}
        onConfirm={() => {
          setCart([]);
          setTicketDiscountId('');
          setPendingDiscountValue('');
          setPointsToRedeem('');
          setClearCartConfirm(false);
          if (resumingParkedId) setResumingParkedId(null);
        }}
        title="Vaciar carrito"
        message={`Se quitarán ${cart.length} ${cart.length === 1 ? 'ítem' : 'ítems'} del carrito. No afecta el ticket abierto si lo había.`}
        type="danger"
        confirmText="Vaciar"
      />
    </div>
  );
}

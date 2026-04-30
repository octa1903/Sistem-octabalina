import { useState, useEffect, useMemo } from 'react';
import type { Receipt, ReceiptLine, TireV2, TireStoreOverride, Customer, PaymentMethod } from '@/types';
import { tireServiceV2 } from '@/services/tireServiceV2';
import { customerServiceV2 } from '@/services/customerServiceV2';
import { receiptService } from '@/services/receiptService';
import { supabase } from '@/services/supabaseClient';
import { ensureNoError, rowToCamel } from '@/services/supabaseHelpers';
import { orderService } from '@/services/storageService';
import { formatCurrency } from '@/utils/currency';
import { STATUS_LABELS } from '@/constants';
import { TrendingUp, Package, Users, ShoppingBag, AlertTriangle, BarChart2 } from 'lucide-react';

interface Props {
  storeId: string;
}

interface ReceiptWithStore extends Receipt {}

export function AnalyticsView({ storeId }: Props) {
  const [receipts, setReceipts] = useState<ReceiptWithStore[]>([]);
  const [lines, setLines] = useState<(ReceiptLine & { receiptType: 'sale' | 'refund'; receiptDate: string })[]>([]);
  const [tires, setTires] = useState<TireV2[]>([]);
  const [overrides, setOverrides] = useState<TireStoreOverride[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  // Pedidos siguen en localStorage hasta Phase 6
  const orders = useMemo(() => orderService.getAll(), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [recs, tiresV2, ovr, custs, pms] = await Promise.all([
          receiptService.getByStore(storeId, { limit: 500 }),
          tireServiceV2.getAll(),
          tireServiceV2.getOverridesByStore(storeId),
          customerServiceV2.getAll(),
          supabase.from('payment_methods').select('*').then(r =>
            ensureNoError(r.data, r.error, 'Analytics.pm').map(row => rowToCamel<PaymentMethod>(row)),
          ),
        ]);

        // Cargar líneas de los receipts completados
        const completedIds = recs.filter(r => r.status === 'completed').map(r => r.id);
        const linesData = completedIds.length > 0
          ? await supabase.from('receipt_lines').select('*').in('receipt_id', completedIds).then(r =>
              ensureNoError(r.data, r.error, 'Analytics.lines').map(row => rowToCamel<ReceiptLine>(row)),
            )
          : [];
        const recById = new Map(recs.map(r => [r.id, r]));
        const enrichedLines = linesData.map(l => {
          const rec = recById.get(l.receiptId);
          return {
            ...l,
            receiptType: rec?.type ?? 'sale',
            receiptDate: rec?.createdAt ?? '',
          };
        }) as (ReceiptLine & { receiptType: 'sale' | 'refund'; receiptDate: string })[];

        if (cancelled) return;
        setReceipts(recs);
        setLines(enrichedLines);
        setTires(tiresV2);
        setOverrides(ovr);
        setCustomers(custs);
        setPaymentMethods(pms);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[Analytics] load error', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [storeId]);

  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = new Date().toISOString().slice(0, 7);

  const completed = receipts.filter(r => r.status === 'completed');
  const todayReceipts = completed.filter(r => r.createdAt.startsWith(today));
  const monthReceipts = completed.filter(r => r.createdAt.startsWith(thisMonth));

  const sign = (r: Receipt) => (r.type === 'sale' ? 1 : -1);
  const totalRevenue = completed.reduce((s, r) => s + sign(r) * r.total, 0);
  const todayRevenue = todayReceipts.reduce((s, r) => s + sign(r) * r.total, 0);
  const monthRevenue = monthReceipts.reduce((s, r) => s + sign(r) * r.total, 0);

  // Stock alerts (tienda activa)
  const overrideByTire = useMemo(() => {
    const m = new Map<string, TireStoreOverride>();
    overrides.forEach(o => m.set(o.tireId, o));
    return m;
  }, [overrides]);
  const lowStockEntries = useMemo(() => {
    const list: { id: string; brand: string; size: string; stock: number; min: number }[] = [];
    for (const t of tires) {
      const o = overrideByTire.get(t.id);
      if (!o) continue;
      if (o.stock <= o.lowStockThreshold) {
        list.push({ id: t.id, brand: t.brand, size: t.size, stock: o.stock, min: o.lowStockThreshold });
      }
    }
    return list;
  }, [tires, overrideByTire]);
  const outOfStockCount = lowStockEntries.filter(e => e.stock === 0).length;

  // Active orders (legacy)
  const activeOrders = orders.filter(o => !['entregado', 'cancelado'].includes(o.status));

  // Top tires por revenue (líneas completadas)
  const topTires = useMemo(() => {
    const map: Record<string, { label: string; qty: number; revenue: number }> = {};
    for (const l of lines) {
      const key = l.tireId;
      const sign = l.receiptType === 'sale' ? 1 : -1;
      if (!map[key]) map[key] = { label: `${l.tireBrand} ${l.tireSize}`, qty: 0, revenue: 0 };
      map[key].qty += sign * l.quantity;
      map[key].revenue += sign * l.net;
    }
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [lines]);

  // Payment method breakdown desde receipts.payments
  const pmEntries = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const r of completed) {
      for (const p of r.payments) {
        const sgn = r.type === 'sale' ? 1 : -1;
        acc[p.paymentMethodId] = (acc[p.paymentMethodId] ?? 0) + sgn * p.amount;
      }
    }
    return Object.entries(acc)
      .map(([id, total]) => {
        const pm = paymentMethods.find(p => p.id === id);
        return { id, name: pm?.name ?? 'Desconocido', total };
      })
      .sort((a, b) => b.total - a.total);
  }, [completed, paymentMethods]);

  // Order status breakdown (legacy)
  const orderBreakdown: Record<string, number> = {};
  for (const o of orders) {
    orderBreakdown[o.status] = (orderBreakdown[o.status] ?? 0) + 1;
  }

  const totalDebt = customers.reduce((s, c) => s + Math.max(0, c.accountBalance), 0);
  const wholesaleCount = customers.filter(c => c.customerType === 'wholesale').length;

  const Stat = ({ label, value, sub, color, Icon }: { label: string; value: string; sub?: string; color?: string; Icon: React.ElementType }) => (
    <div className="rounded-xl p-4" style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--br-txt2)' }}>{label}</p>
        <Icon className="h-4 w-4" style={{ color: color ?? 'var(--br-txt2)' }} />
      </div>
      <p className="text-2xl font-bold font-mono" style={{ color: color ?? 'var(--br-txt)' }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: 'var(--br-txt2)' }}>{sub}</p>}
    </div>
  );

  return (
    <div className="p-5 max-w-6xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--br-txt)' }}>Análisis y Métricas</h1>
        <p className="text-sm" style={{ color: 'var(--br-txt2)' }}>
          {new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {loading && (
        <div className="rounded-xl p-4 mb-5 text-center text-sm"
             style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)', color: 'var(--br-txt2)' }}>
          Cargando métricas...
        </div>
      )}

      {/* Main stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat label="Ventas hoy" value={formatCurrency(todayRevenue)} sub={`${todayReceipts.length} recibos`} color="var(--br-amb)" Icon={TrendingUp} />
        <Stat label="Ventas este mes" value={formatCurrency(monthRevenue)} sub={`${monthReceipts.length} recibos`} Icon={BarChart2} />
        <Stat label="Total acumulado" value={formatCurrency(totalRevenue)} sub={`${completed.length} ventas`} Icon={ShoppingBag} />
        <Stat label="Pedidos activos" value={String(activeOrders.length)} sub={`de ${orders.length} totales`} color={activeOrders.length > 0 ? 'var(--br-amb)' : undefined} Icon={Package} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="Neumáticos" value={String(tires.length)} sub="en catálogo" Icon={Package} />
        <Stat label="Stock bajo" value={String(lowStockEntries.length)} sub={`${outOfStockCount} sin stock`} color={lowStockEntries.length > 0 ? 'var(--br-red)' : undefined} Icon={AlertTriangle} />
        <Stat label="Clientes" value={String(customers.length)} sub={`${wholesaleCount} mayoristas`} Icon={Users} />
        <Stat label="Deuda clientes" value={formatCurrency(totalDebt)} sub="saldo deudor total" color="var(--br-red)" Icon={TrendingUp} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Top tires */}
        <div className="lg:col-span-1 rounded-xl overflow-hidden" style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}>
          <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--br-bor)', background: 'var(--br-sur2)' }}>
            <p className="text-sm font-semibold" style={{ color: 'var(--br-txt)' }}>Top neumáticos vendidos</p>
          </div>
          {topTires.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--br-txt2)' }}>Sin ventas registradas.</p>
          ) : (
            topTires.map((t, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--br-bor)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold w-5" style={{ color: 'var(--br-txt2)' }}>#{i + 1}</span>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--br-txt)' }}>{t.label}</p>
                    <p className="text-xs" style={{ color: 'var(--br-txt2)' }}>{t.qty} unidades</p>
                  </div>
                </div>
                <span className="text-sm font-mono font-semibold" style={{ color: 'var(--br-amb)' }}>{formatCurrency(t.revenue)}</span>
              </div>
            ))
          )}
        </div>

        {/* Payment methods */}
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}>
          <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--br-bor)', background: 'var(--br-sur2)' }}>
            <p className="text-sm font-semibold" style={{ color: 'var(--br-txt)' }}>Métodos de pago</p>
          </div>
          {pmEntries.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--br-txt2)' }}>Sin ventas.</p>
          ) : (
            pmEntries.map(pm => (
              <div key={pm.id} className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--br-bor)' }}>
                <p className="text-sm" style={{ color: 'var(--br-txt)' }}>{pm.name}</p>
                <span className="text-sm font-mono font-semibold" style={{ color: 'var(--br-txt)' }}>{formatCurrency(pm.total)}</span>
              </div>
            ))
          )}
        </div>

        {/* Order statuses */}
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}>
          <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--br-bor)', background: 'var(--br-sur2)' }}>
            <p className="text-sm font-semibold" style={{ color: 'var(--br-txt)' }}>Estado de pedidos</p>
          </div>
          {Object.entries(orderBreakdown).length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--br-txt2)' }}>Sin pedidos.</p>
          ) : (
            Object.entries(orderBreakdown).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--br-bor)' }}>
                <p className="text-sm" style={{ color: 'var(--br-txt)' }}>{STATUS_LABELS[status] ?? status}</p>
                <span className="text-sm font-semibold font-mono" style={{ color: 'var(--br-txt)' }}>{count}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Low stock alert */}
      {lowStockEntries.length > 0 && (
        <div className="mt-4 rounded-xl p-4" style={{ background: 'var(--br-red-bg)', border: '1px solid var(--br-red-bor)' }}>
          <p className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: 'var(--br-red)' }}>
            <AlertTriangle className="h-4 w-4" /> Alertas de stock ({lowStockEntries.length})
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {lowStockEntries.slice(0, 9).map(t => (
              <div key={t.id} className="flex justify-between text-xs rounded px-2 py-1.5" style={{ background: 'var(--br-sur)', border: '1px solid var(--br-red-bor)' }}>
                <span className="font-medium" style={{ color: 'var(--br-txt)' }}>{t.brand} {t.size}</span>
                <span className="font-mono" style={{ color: t.stock === 0 ? 'var(--br-red)' : 'var(--br-amb)' }}>{t.stock}/{t.min}</span>
              </div>
            ))}
          </div>
          {lowStockEntries.length > 9 && <p className="text-xs mt-2" style={{ color: 'var(--br-red)' }}>+{lowStockEntries.length - 9} más en Inventario.</p>}
        </div>
      )}
    </div>
  );
}

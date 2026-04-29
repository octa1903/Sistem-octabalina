import { useMemo } from 'react';
import { tireService, saleService, clientService, orderService } from '@/services/storageService';
import { formatCurrency } from '@/utils/currency';
import { STATUS_LABELS } from '@/constants';
import { TrendingUp, Package, Users, ShoppingBag, AlertTriangle, BarChart2 } from 'lucide-react';

export function AnalyticsView() {
  const tires = useMemo(() => tireService.getAll(), []);
  const sales = useMemo(() => saleService.getAll(), []);
  const clients = useMemo(() => clientService.getAll(), []);
  const orders = useMemo(() => orderService.getAll(), []);

  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = new Date().toISOString().slice(0, 7);

  const todaySales = sales.filter((s) => s.date.startsWith(today));
  const monthSales = sales.filter((s) => s.date.startsWith(thisMonth));

  const totalRevenue = sales.reduce((s, v) => s + v.total, 0);
  const todayRevenue = todaySales.reduce((s, v) => s + v.total, 0);
  const monthRevenue = monthSales.reduce((s, v) => s + v.total, 0);

  const lowStock = tires.filter((t) => t.stock <= t.minStock);
  const outOfStock = tires.filter((t) => t.stock === 0);

  const activeOrders = orders.filter((o) => !['entregado', 'cancelado'].includes(o.status));

  // Top 5 best selling tires
  const tireMap: Record<string, { label: string; qty: number; revenue: number }> = {};
  for (const sale of sales) {
    for (const item of sale.items) {
      if (!tireMap[item.tireId]) tireMap[item.tireId] = { label: `${item.brand} ${item.size}`, qty: 0, revenue: 0 };
      tireMap[item.tireId].qty += item.quantity;
      tireMap[item.tireId].revenue += item.subtotal;
    }
  }
  const topTires = Object.values(tireMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  // Payment method breakdown
  const pmBreakdown: Record<string, number> = {};
  for (const s of sales) {
    pmBreakdown[s.paymentMethod] = (pmBreakdown[s.paymentMethod] ?? 0) + s.total;
  }
  const pmEntries = Object.entries(pmBreakdown).sort((a, b) => b[1] - a[1]);

  // Order status breakdown
  const orderBreakdown: Record<string, number> = {};
  for (const o of orders) {
    orderBreakdown[o.status] = (orderBreakdown[o.status] ?? 0) + 1;
  }

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
        <p className="text-sm" style={{ color: 'var(--br-txt2)' }}>{new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      {/* Main stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat label="Ventas hoy" value={formatCurrency(todayRevenue)} sub={`${todaySales.length} transacciones`} color="var(--br-amb)" Icon={TrendingUp} />
        <Stat label="Ventas este mes" value={formatCurrency(monthRevenue)} sub={`${monthSales.length} transacciones`} Icon={BarChart2} />
        <Stat label="Total acumulado" value={formatCurrency(totalRevenue)} sub={`${sales.length} ventas`} Icon={ShoppingBag} />
        <Stat label="Pedidos activos" value={String(activeOrders.length)} sub={`de ${orders.length} totales`} color={activeOrders.length > 0 ? 'var(--br-amb)' : undefined} Icon={Package} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="Neumáticos" value={String(tires.length)} sub="en catálogo" Icon={Package} />
        <Stat label="Stock bajo" value={String(lowStock.length)} sub={`${outOfStock.length} sin stock`} color={lowStock.length > 0 ? 'var(--br-red)' : undefined} Icon={AlertTriangle} />
        <Stat label="Clientes" value={String(clients.length)} sub={`${clients.filter((c) => c.tipoCliente === 'mayorista').length} mayoristas`} Icon={Users} />
        <Stat label="Deuda clientes" value={formatCurrency(clients.reduce((s, c) => s + Math.max(0, c.balance), 0))} sub="saldo deudor total" color="var(--br-red)" Icon={TrendingUp} />
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
            pmEntries.map(([method, total]) => (
              <div key={method} className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--br-bor)' }}>
                <p className="text-sm" style={{ color: 'var(--br-txt)' }}>{method}</p>
                <span className="text-sm font-mono font-semibold" style={{ color: 'var(--br-txt)' }}>{formatCurrency(total)}</span>
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
      {lowStock.length > 0 && (
        <div className="mt-4 rounded-xl p-4" style={{ background: 'var(--br-red-bg)', border: '1px solid var(--br-red-bor)' }}>
          <p className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: 'var(--br-red)' }}>
            <AlertTriangle className="h-4 w-4" /> Alertas de stock ({lowStock.length})
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {lowStock.slice(0, 9).map((t) => (
              <div key={t.id} className="flex justify-between text-xs rounded px-2 py-1.5" style={{ background: 'var(--br-sur)', border: '1px solid var(--br-red-bor)' }}>
                <span className="font-medium" style={{ color: 'var(--br-txt)' }}>{t.brand} {t.size}</span>
                <span className="font-mono" style={{ color: t.stock === 0 ? 'var(--br-red)' : 'var(--br-amb)' }}>{t.stock}/{t.minStock}</span>
              </div>
            ))}
          </div>
          {lowStock.length > 9 && <p className="text-xs mt-2" style={{ color: 'var(--br-red)' }}>+{lowStock.length - 9} más en Inventario.</p>}
        </div>
      )}
    </div>
  );
}

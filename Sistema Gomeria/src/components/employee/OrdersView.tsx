import { useState, useMemo, useEffect, useCallback } from 'react';
import type { Order, OrderStatus } from '@/types';
import { orderService } from '@/services/orderService';
import { STATUS_COLORS, STATUS_LABELS, STATUS_FLOW } from '@/constants';
import { Modal } from '@/components/ui/Modal';
import { formatCurrency } from '@/utils/currency';
import { Search, ChevronRight, Package, Truck, User } from 'lucide-react';

interface Props { addToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void; }

const ALL_STATUSES: OrderStatus[] = ['pendiente', 'confirmado', 'en_preparacion', 'listo', 'entregado', 'cancelado'];

export function OrdersView({ addToast }: Props) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<OrderStatus | ''>('');
  const [selected, setSelected] = useState<Order | null>(null);
  const [internalNote, setInternalNote] = useState('');
  const [clientMessage, setClientMessage] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await orderService.getAll();
      setOrders(data);
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error cargando pedidos.', 'error');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    orderService.getAll()
      .then((data) => { if (active) setOrders(data); })
      .catch((e) => { if (active) addToast(e instanceof Error ? e.message : 'Error cargando pedidos.', 'error'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return orders.filter((o) => {
      if (filterStatus && o.status !== filterStatus) return false;
      if (q && !`${o.numero} ${o.clientName}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [orders, search, filterStatus]);

  const activeCount = orders.filter((o) => !['entregado', 'cancelado'].includes(o.status)).length;

  async function advanceStatus(order: Order, newStatus: OrderStatus) {
    setSaving(true);
    try {
      await orderService.updateStatus(order.id, newStatus, {
        internalNotes: internalNote.trim() || undefined,
        clientMessage: clientMessage.trim() || undefined,
      });
      await refresh();
      setSelected((prev) => {
        const refreshed = orders.find((o) => o.id === order.id);
        return refreshed ? { ...refreshed, status: newStatus } : prev;
      });
      setInternalNote('');
      setClientMessage('');
      addToast(`Pedido ${newStatus}.`, 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error actualizando pedido.', 'error');
    } finally {
      setSaving(false);
    }
  }

  const badge = (status: OrderStatus) => (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );

  return (
    <div className="p-5 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--br-txt)' }}>Pedidos</h1>
          <p className="text-sm" style={{ color: 'var(--br-txt2)' }}>
            {loading ? 'Cargando…' : `${activeCount} activos · ${orders.length} total`}
          </p>
        </div>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--br-txt2)' }} />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por número o cliente..."
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none"
            style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)' }} />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as OrderStatus | '')}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}>
          <option value="">Todos los estados</option>
          {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        {loading ? (
          <p className="text-sm text-center py-12" style={{ color: 'var(--br-txt2)' }}>Cargando pedidos…</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl py-12 text-center" style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}>
            <p className="text-sm" style={{ color: 'var(--br-txt2)' }}>
              {orders.length === 0 ? 'No hay pedidos registrados.' : 'Sin resultados.'}
            </p>
          </div>
        ) : (
          filtered.map((o) => (
            <div key={o.id}
              className="rounded-xl p-4 cursor-pointer transition-all flex items-center gap-4"
              style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}
              onClick={() => setSelected(o)}
              onMouseOver={(e) => (e.currentTarget.style.borderColor = 'var(--br-amb)')}
              onMouseOut={(e) => (e.currentTarget.style.borderColor = 'var(--br-bor)')}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--br-sur2)' }}>
                {o.tipo === 'entrega_domicilio' ? <Truck className="h-5 w-5" style={{ color: 'var(--br-amb)' }} /> : <Package className="h-5 w-5" style={{ color: 'var(--br-txt2)' }} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-semibold text-sm" style={{ color: 'var(--br-txt)' }}>#{o.numero}</span>
                  {badge(o.status)}
                </div>
                <p className="text-sm flex items-center gap-1 mt-0.5" style={{ color: 'var(--br-txt2)' }}>
                  <User className="h-3 w-3" /> {o.clientName}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-semibold font-mono text-sm" style={{ color: 'var(--br-txt)' }}>{formatCurrency(o.totalAmount)}</p>
                <p className="text-xs" style={{ color: 'var(--br-txt2)' }}>{new Date(o.scheduledDate).toLocaleDateString('es-AR')}</p>
              </div>
              <ChevronRight className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--br-txt2)' }} />
            </div>
          ))
        )}
      </div>

      {/* Order detail modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={`Pedido #${selected?.numero}`} size="lg">
        {selected && (
          <div className="space-y-4">
            {/* Status + client */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              {badge(selected.status)}
              <span className="text-sm" style={{ color: 'var(--br-txt2)' }}>
                {selected.tipo === 'entrega_domicilio' ? '🚚 Entrega a domicilio' : '📦 Retiro en local'}
              </span>
            </div>

            <div className="rounded-lg p-3" style={{ background: 'var(--br-sur2)', border: '1px solid var(--br-bor)' }}>
              <p className="text-sm font-semibold" style={{ color: 'var(--br-txt)' }}>{selected.clientName}</p>
              <p className="text-sm" style={{ color: 'var(--br-txt2)' }}>
                Fecha: {new Date(selected.scheduledDate).toLocaleDateString('es-AR')}
                {selected.scheduledTime && ` · ${selected.scheduledTime}`}
              </p>
              {selected.address && <p className="text-sm" style={{ color: 'var(--br-txt2)' }}>Dir: {selected.address}</p>}
            </div>

            {/* Items */}
            <div>
              <p className="text-sm font-semibold mb-2" style={{ color: 'var(--br-txt)' }}>Neumáticos</p>
              <div className="space-y-1">
                {selected.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span style={{ color: 'var(--br-txt)' }}>{item.brand} {item.size} × {item.quantity}</span>
                    <span className="font-mono" style={{ color: 'var(--br-txt2)' }}>{formatCurrency(item.subtotal)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-semibold text-sm pt-2" style={{ borderTop: '1px solid var(--br-bor)', marginTop: 8 }}>
                <span style={{ color: 'var(--br-txt)' }}>Total</span>
                <span className="font-mono" style={{ color: 'var(--br-amb)' }}>{formatCurrency(selected.totalAmount)}</span>
              </div>
            </div>

            {/* Internal notes */}
            {selected.internalNotes && (
              <div className="rounded-lg p-3" style={{ background: 'var(--br-amb-bg)', border: '1px solid var(--br-amb-bor)' }}>
                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--br-amb)' }}>Nota interna</p>
                <p className="text-sm" style={{ color: 'var(--br-txt)' }}>{selected.internalNotes}</p>
              </div>
            )}

            {/* Status transitions */}
            {STATUS_FLOW[selected.status].length > 0 && (
              <div>
                <p className="text-sm font-semibold mb-2" style={{ color: 'var(--br-txt)' }}>Avanzar estado</p>
                <div className="space-y-2">
                  <input type="text" value={internalNote} onChange={(e) => setInternalNote(e.target.value)}
                    placeholder="Nota interna (opcional)..."
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }} />
                  <div className="flex gap-2 flex-wrap">
                    {STATUS_FLOW[selected.status].map((next) => (
                      <button key={next} onClick={() => advanceStatus(selected, next as OrderStatus)}
                        disabled={saving}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold border ${STATUS_COLORS[next]} disabled:opacity-50`}>
                        {saving ? 'Guardando…' : `→ ${STATUS_LABELS[next]}`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

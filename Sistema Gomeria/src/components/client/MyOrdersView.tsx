import { useState, useMemo } from 'react';
import type { Order } from '@/types';
import { orderService } from '@/services/storageService';
import { STATUS_COLORS, STATUS_LABELS } from '@/constants';
import { formatCurrency } from '@/utils/currency';
import { Modal } from '@/components/ui/Modal';
import { Package, Truck, ChevronRight } from 'lucide-react';

interface Props { clientId: string; }

export function MyOrdersView({ clientId }: Props) {
  const [orders] = useState<Order[]>(() =>
    orderService.getByClient(clientId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
  const [selected, setSelected] = useState<Order | null>(null);

  const active = useMemo(() => orders.filter((o) => !['entregado', 'cancelado'].includes(o.status)), [orders]);
  const past = useMemo(() => orders.filter((o) => ['entregado', 'cancelado'].includes(o.status)), [orders]);

  const OrderCard = ({ o }: { o: Order }) => (
    <div className="rounded-xl p-4 cursor-pointer transition-all flex items-center gap-3"
      style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}
      onClick={() => setSelected(o)}
      onMouseOver={(e) => (e.currentTarget.style.borderColor = 'var(--br-amb)')}
      onMouseOut={(e) => (e.currentTarget.style.borderColor = 'var(--br-bor)')}>
      <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--br-sur2)' }}>
        {o.tipo === 'entrega_domicilio'
          ? <Truck className="h-4 w-4" style={{ color: 'var(--br-amb)' }} />
          : <Package className="h-4 w-4" style={{ color: 'var(--br-txt2)' }} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono font-semibold text-sm" style={{ color: 'var(--br-txt)' }}>#{o.numero}</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLORS[o.status]}`}>
            {STATUS_LABELS[o.status]}
          </span>
        </div>
        <p className="text-xs mt-0.5" style={{ color: 'var(--br-txt2)' }}>
          {new Date(o.scheduledDate).toLocaleDateString('es-AR')}
          {o.scheduledTime ? ` · ${o.scheduledTime}` : ''}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm font-semibold" style={{ color: 'var(--br-txt)' }}>{formatCurrency(o.totalAmount)}</span>
        <ChevronRight className="h-4 w-4" style={{ color: 'var(--br-txt2)' }} />
      </div>
    </div>
  );

  return (
    <div>
      <h1 className="text-xl font-semibold mb-4" style={{ color: 'var(--br-txt)' }}>Mis Pedidos</h1>

      {orders.length === 0 ? (
        <div className="text-center py-16 rounded-xl" style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}>
          <Package className="h-10 w-10 mx-auto mb-3" style={{ color: 'var(--br-txt2)' }} />
          <p className="text-sm" style={{ color: 'var(--br-txt2)' }}>No tenés pedidos aún. Hacé un pedido desde el Catálogo.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {active.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-2" style={{ color: 'var(--br-txt)' }}>Pedidos activos ({active.length})</p>
              <div className="space-y-2">{active.map((o) => <OrderCard key={o.id} o={o} />)}</div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-2" style={{ color: 'var(--br-txt2)' }}>Historial</p>
              <div className="space-y-2">{past.map((o) => <OrderCard key={o.id} o={o} />)}</div>
            </div>
          )}
        </div>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title={`Pedido #${selected?.numero}`} size="md">
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${STATUS_COLORS[selected.status]}`}>
                {STATUS_LABELS[selected.status]}
              </span>
              <span className="text-sm" style={{ color: 'var(--br-txt2)' }}>
                {selected.tipo === 'entrega_domicilio' ? '🚚 Entrega a domicilio' : '📦 Retiro en local'}
              </span>
            </div>
            <div className="rounded-lg p-3" style={{ background: 'var(--br-sur2)', border: '1px solid var(--br-bor)' }}>
              <p className="text-sm" style={{ color: 'var(--br-txt2)' }}>
                <strong>Fecha:</strong> {new Date(selected.scheduledDate).toLocaleDateString('es-AR')}
                {selected.scheduledTime ? ` · ${selected.scheduledTime}` : ''}
              </p>
              {selected.address && <p className="text-sm mt-1" style={{ color: 'var(--br-txt2)' }}><strong>Dirección:</strong> {selected.address}</p>}
              <p className="text-sm mt-1" style={{ color: 'var(--br-txt2)' }}><strong>Pago:</strong> {selected.paymentMethod}</p>
            </div>
            <div className="space-y-2">
              {selected.items.map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span style={{ color: 'var(--br-txt)' }}>{item.brand} {item.size} × {item.quantity}</span>
                  <span className="font-mono" style={{ color: 'var(--br-txt2)' }}>{formatCurrency(item.subtotal)}</span>
                </div>
              ))}
              <div className="flex justify-between font-semibold text-sm pt-2" style={{ borderTop: '1px solid var(--br-bor)' }}>
                <span>Total</span>
                <span className="font-mono" style={{ color: 'var(--br-amb)' }}>{formatCurrency(selected.totalAmount)}</span>
              </div>
            </div>
            {selected.clientMessage && (
              <div className="rounded-lg p-3" style={{ background: 'var(--br-amb-bg)', border: '1px solid var(--br-amb-bor)' }}>
                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--br-amb)' }}>Mensaje de la gomería</p>
                <p className="text-sm" style={{ color: 'var(--br-txt)' }}>{selected.clientMessage}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

import { useMemo } from 'react';
import { saleService } from '@/services/storageService';
import { formatCurrency } from '@/utils/currency';
import { ShoppingBag } from 'lucide-react';

interface Props { clientId: string; }

export function HistoryView({ clientId }: Props) {
  const sales = useMemo(() =>
    saleService.getByClient(clientId).sort((a, b) => b.date.localeCompare(a.date)),
    [clientId],
  );

  const total = sales.reduce((s, v) => s + v.total, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--br-txt)' }}>Historial de compras</h1>
        {sales.length > 0 && (
          <div className="text-right">
            <p className="text-xs" style={{ color: 'var(--br-txt2)' }}>Total acumulado</p>
            <p className="font-mono font-semibold" style={{ color: 'var(--br-amb)' }}>{formatCurrency(total)}</p>
          </div>
        )}
      </div>

      {sales.length === 0 ? (
        <div className="text-center py-16 rounded-xl" style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}>
          <ShoppingBag className="h-10 w-10 mx-auto mb-3" style={{ color: 'var(--br-txt2)' }} />
          <p className="text-sm" style={{ color: 'var(--br-txt2)' }}>No hay compras registradas aún.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sales.map((s) => (
            <div key={s.id} className="rounded-xl p-4" style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--br-txt)' }}>
                    {new Date(s.date).toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--br-txt2)' }}>{s.paymentMethod}</p>
                </div>
                <p className="font-mono font-semibold text-base" style={{ color: 'var(--br-amb)' }}>{formatCurrency(s.total)}</p>
              </div>
              <div className="space-y-1">
                {s.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-xs" style={{ color: 'var(--br-txt2)' }}>
                    <span>{item.brand} {item.size} {item.model} × {item.quantity}</span>
                    <span className="font-mono">{formatCurrency(item.subtotal)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

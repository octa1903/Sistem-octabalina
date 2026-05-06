import { useEffect, useState } from 'react';
import type { Receipt, ReceiptLine, PaymentMethod } from '@/types';
import { customerSelfService } from '@/services/customerSelfService';
import { supabase } from '@/services/supabaseClient';
import { rowToCamel } from '@/services/supabaseHelpers';
import { formatCurrency } from '@/utils/currency';
import { ShoppingBag } from 'lucide-react';

interface Props { clientToken: string | undefined; }

interface Row {
  receipt: Receipt;
  lines: ReceiptLine[];
}

export function HistoryView({ clientToken }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [pmById, setPmById] = useState<Map<string, PaymentMethod>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!clientToken) {
      setError('Sesión expirada. Volvé a iniciar sesión.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [receipts, pmRes] = await Promise.all([
          customerSelfService.getReceipts(clientToken, 50),
          supabase.from('payment_methods').select('*'),
        ]);
        const pms: PaymentMethod[] = pmRes.error
          ? []
          : (pmRes.data ?? []).map(r => rowToCamel<PaymentMethod>(r));
        const linesByReceipt = await customerSelfService.getReceiptLines(
          clientToken,
          receipts.map(r => r.id),
        );
        if (!active) return;
        setPmById(new Map(pms.map(p => [p.id, p])));
        setRows(receipts.map(r => ({ receipt: r, lines: linesByReceipt.get(r.id) ?? [] })));
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Error cargando historial');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [clientToken]);

  const total = rows.reduce((s, r) => s + r.receipt.total, 0);

  function paymentLabel(receipt: Receipt): string {
    const names = receipt.payments
      .map(p => pmById.get(p.paymentMethodId)?.name)
      .filter((n): n is string => Boolean(n));
    return names.join(' + ') || '—';
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--br-txt)' }}>Historial de compras</h1>
        {rows.length > 0 && (
          <div className="text-right">
            <p className="text-xs" style={{ color: 'var(--br-txt2)' }}>Total acumulado</p>
            <p className="font-mono font-semibold" style={{ color: 'var(--br-amb)' }}>{formatCurrency(total)}</p>
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-center py-10" style={{ color: 'var(--br-txt2)' }}>Cargando historial…</p>
      ) : error ? (
        <p className="text-sm text-center py-10" style={{ color: 'var(--br-red)' }}>{error}</p>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 rounded-xl" style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}>
          <ShoppingBag className="h-10 w-10 mx-auto mb-3" style={{ color: 'var(--br-txt2)' }} />
          <p className="text-sm" style={{ color: 'var(--br-txt2)' }}>No hay compras registradas aún.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(({ receipt, lines }) => (
            <div key={receipt.id} className="rounded-xl p-4" style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--br-txt)' }}>
                    {new Date(receipt.createdAt).toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--br-txt2)' }}>
                    #{receipt.receiptNumber} · {paymentLabel(receipt)}
                  </p>
                </div>
                <p className="font-mono font-semibold text-base" style={{ color: 'var(--br-amb)' }}>{formatCurrency(receipt.total)}</p>
              </div>
              <div className="space-y-1">
                {lines.map((ln) => (
                  <div key={ln.id} className="flex justify-between text-xs" style={{ color: 'var(--br-txt2)' }}>
                    <span>{ln.tireBrand} {ln.tireSize} {ln.tireModel} × {ln.quantity}</span>
                    <span className="font-mono">{formatCurrency(ln.total)}</span>
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

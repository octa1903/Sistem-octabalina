// ═══════════════════════════════════════════════════
// TireCostHistory — timeline de costos de un neumático.
// Lee de supplier_price_list_items + supplier_price_lists.
//
// Uso:
//   <TireCostHistory tireId={tire.id} />
//
// Muestra fecha · proveedor · costo (con flecha de variación vs anterior).
// Si no hay historial, muestra empty state. Si falla, muestra error inline.
// ═══════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, FileText } from 'lucide-react';
import { supplierPriceListService } from '@/services/supplierPriceListServiceV2';
import { formatCurrency } from '@/utils/currency';
import type { SupplierPriceList, SupplierPriceListItem } from '@/types';

interface Props {
  tireId: string;
  limit?: number;
}

type HistoryRow = SupplierPriceListItem & { list: SupplierPriceList };

/** Variación porcentual entre dos costos. null si no hay base. */
export function variationPct(current: number, previous: number): number | null {
  if (!Number.isFinite(previous) || previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10; // 1 decimal
}

export function TireCostHistory({ tireId, limit = 20 }: Props) {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    supplierPriceListService
      .getCostHistory(tireId, limit)
      .then(data => {
        if (!cancelled) {
          setRows(data);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Error cargando histórico');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tireId, limit]);

  if (loading) {
    return (
      <div className="py-6 text-center text-sm" style={{ color: 'var(--br-txt2)' }}>
        Cargando histórico…
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="text-sm rounded-lg px-3 py-2"
        style={{
          background: 'var(--br-red-bg)',
          color: 'var(--br-red)',
          border: '1px solid var(--br-red-bor)',
        }}
      >
        {error}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div
        className="py-8 text-center rounded-lg"
        style={{ background: 'var(--br-sur2)', border: '1px dashed var(--br-bor)' }}
      >
        <FileText className="h-8 w-8 mx-auto mb-2" style={{ color: 'var(--br-txt2)' }} />
        <p className="text-sm" style={{ color: 'var(--br-txt2)' }}>
          Sin historial de costos.
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--br-txt2)' }}>
          Importá una lista de proveedor desde Inventario → Importar para empezar a registrar.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--br-bor)' }}>
      <table className="w-full text-sm">
        <thead style={{ background: 'var(--br-sur2)' }}>
          <tr style={{ borderBottom: '1px solid var(--br-bor)' }}>
            <th className="text-left px-3 py-2 text-xs uppercase tracking-wide" style={{ color: 'var(--br-txt2)' }}>
              Fecha
            </th>
            <th className="text-left px-3 py-2 text-xs uppercase tracking-wide" style={{ color: 'var(--br-txt2)' }}>
              Proveedor
            </th>
            <th className="text-right px-3 py-2 text-xs uppercase tracking-wide" style={{ color: 'var(--br-txt2)' }}>
              Costo
            </th>
            <th className="text-right px-3 py-2 text-xs uppercase tracking-wide" style={{ color: 'var(--br-txt2)' }}>
              Variación
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const prev = rows[idx + 1]; // siguiente = más viejo
            const pct = prev ? variationPct(row.costArs, prev.costArs) : null;
            return (
              <tr key={row.id} style={{ borderBottom: '1px solid var(--br-bor)' }}>
                <td className="px-3 py-2 font-mono text-xs" style={{ color: 'var(--br-txt)' }}>
                  {row.list.effectiveDate}
                </td>
                <td className="px-3 py-2" style={{ color: 'var(--br-txt)' }}>
                  <div className="font-medium">{row.list.supplierName}</div>
                  {row.list.notes && (
                    <div className="text-xs" style={{ color: 'var(--br-txt2)' }}>
                      {row.list.notes}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-mono" style={{ color: 'var(--br-txt)' }}>
                  {formatCurrency(row.costArs)}
                  {row.list.currency === 'USD' && (
                    <div className="text-xs" style={{ color: 'var(--br-txt2)' }}>
                      USD {row.costOriginal.toFixed(2)}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-right">{renderPct(pct)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function renderPct(pct: number | null) {
  if (pct === null) {
    return <span style={{ color: 'var(--br-txt2)' }}>—</span>;
  }
  if (pct === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--br-txt2)' }}>
        <Minus className="h-3 w-3" />
        0%
      </span>
    );
  }
  if (pct > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--br-red)' }}>
        <TrendingUp className="h-3 w-3" />
        +{pct.toFixed(1)}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--br-grn)' }}>
      <TrendingDown className="h-3 w-3" />
      {pct.toFixed(1)}%
    </span>
  );
}

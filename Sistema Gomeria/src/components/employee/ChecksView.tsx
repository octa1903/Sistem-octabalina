import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, Banknote, ArrowDownLeft, ArrowUpRight, Clock, CheckCircle2 } from 'lucide-react';
import { checkServiceV2, type CheckWithNames, type CheckFilter } from '@/services/checkServiceV2';
import { formatCurrency } from '@/utils/currency';
import { Input, Spinner, EmptyState } from '@/components/ui';

interface Props {
  addToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

/**
 * Vista histórica de cheques (Fase G).
 * Read-only: muestra los 2905 cheques importados con filtros básicos
 * por tipo (recibidos / emitidos) y estado (pendientes / cobrados).
 *
 * El alta/cobro de cheques nuevos vive en el flujo de POS / cuenta corriente
 * (Fase 7 según el plan). Por ahora, solo consulta.
 */
export function ChecksView({ addToast }: Props) {
  const [checks, setChecks] = useState<CheckWithNames[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<CheckFilter>('pending');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [summary, setSummary] = useState({
    incoming_pending_count: 0,
    incoming_pending_amount: 0,
    outgoing_pending_count: 0,
    outgoing_pending_amount: 0,
  });
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, sum] = await Promise.all([
        checkServiceV2.list({ filter, search: debouncedSearch || undefined }),
        checkServiceV2.summary(),
      ]);
      setChecks(list);
      setSummary(sum);
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error cargando cheques.', 'error');
    } finally {
      setLoading(false);
    }
  }, [filter, debouncedSearch, addToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filterTabs: Array<{ id: CheckFilter; label: string }> = useMemo(
    () => [
      { id: 'pending', label: 'Pendientes' },
      { id: 'incoming', label: 'Recibidos' },
      { id: 'outgoing', label: 'Emitidos' },
      { id: 'cashed', label: 'Cobrados' },
      { id: 'all', label: 'Todos' },
    ],
    [],
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Banknote className="h-5 w-5" style={{ color: 'var(--br-amb)' }} />
        <h1 className="text-xl font-semibold" style={{ color: 'var(--br-txt)' }}>
          Cheques
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div
          className="rounded-xl p-4"
          style={{ background: 'var(--br-grn-bg)', border: '1px solid var(--br-grn-bor)' }}
        >
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--br-grn)' }}>
            <ArrowDownLeft className="h-3.5 w-3.5" /> Recibidos pendientes
          </div>
          <p className="text-xl font-semibold mt-1" style={{ color: 'var(--br-grn)' }}>
            {formatCurrency(summary.incoming_pending_amount)}
          </p>
          <p className="text-xs" style={{ color: 'var(--br-txt2)' }}>
            {summary.incoming_pending_count} cheque{summary.incoming_pending_count === 1 ? '' : 's'}
          </p>
        </div>
        <div
          className="rounded-xl p-4"
          style={{ background: 'var(--br-red-bg)', border: '1px solid var(--br-red-bor)' }}
        >
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--br-red)' }}>
            <ArrowUpRight className="h-3.5 w-3.5" /> Emitidos pendientes
          </div>
          <p className="text-xl font-semibold mt-1" style={{ color: 'var(--br-red)' }}>
            {formatCurrency(summary.outgoing_pending_amount)}
          </p>
          <p className="text-xs" style={{ color: 'var(--br-txt2)' }}>
            {summary.outgoing_pending_count} cheque{summary.outgoing_pending_count === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {filterTabs.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{
              background: filter === f.id ? 'var(--br-amb)' : 'var(--br-sur)',
              color: filter === f.id ? '#fff' : 'var(--br-txt)',
              border: '1px solid var(--br-bor)',
            }}
          >
            {f.label}
          </button>
        ))}
        <div className="flex-1 min-w-[200px]">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por número o titular..."
            iconLeft={<Search className="h-4 w-4" />}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : checks.length === 0 ? (
        <EmptyState title="Sin cheques" description="No hay resultados para el filtro actual." />
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}>
          {checks.map((c) => {
            const isIncoming = c.type === 'incoming';
            const TypeIcon = isIncoming ? ArrowDownLeft : ArrowUpRight;
            const StatusIcon = c.cashed ? CheckCircle2 : Clock;
            return (
              <div
                key={c.id}
                className="px-4 py-3 flex items-center gap-3"
                style={{ borderBottom: '1px solid var(--br-bor)' }}
              >
                <TypeIcon
                  className="h-4 w-4 flex-shrink-0"
                  style={{ color: isIncoming ? 'var(--br-grn)' : 'var(--br-red)' }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm" style={{ color: 'var(--br-txt)' }}>
                    <strong>#{c.checkNumber}</strong>
                    {c.bankName ? ` · ${c.bankName}` : ''}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--br-txt2)' }}>
                    {isIncoming
                      ? c.customerName
                        ? `De: ${c.customerName}`
                        : c.givenBy
                          ? `De: ${c.givenBy}`
                          : '—'
                      : c.supplierName
                        ? `A: ${c.supplierName}`
                        : c.givenTo
                          ? `A: ${c.givenTo}`
                          : '—'}
                    {c.emissionDate && ` · Emisión ${new Date(c.emissionDate).toLocaleDateString('es-AR')}`}
                    {c.collectionDate && ` · Cobro ${new Date(c.collectionDate).toLocaleDateString('es-AR')}`}
                  </p>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <span
                    className="font-mono font-semibold text-sm"
                    style={{ color: isIncoming ? 'var(--br-grn)' : 'var(--br-red)' }}
                  >
                    {formatCurrency(c.amount)}
                  </span>
                  <span
                    className="flex items-center gap-1 text-[10px] uppercase tracking-wide"
                    style={{ color: c.cashed ? 'var(--br-grn)' : 'var(--br-amb)' }}
                  >
                    <StatusIcon className="h-3 w-3" />
                    {c.cashed ? 'Cobrado' : 'Pendiente'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

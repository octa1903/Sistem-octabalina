import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, Truck, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { supplierServiceV2, type SupplierWithBalance, type SupplierMovement } from '@/services/supplierServiceV2';
import { formatCurrency } from '@/utils/currency';
import { Input, Spinner, Modal, EmptyState } from '@/components/ui';

interface Props {
  addToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

type Filter = 'debt' | 'credit' | 'all';

/**
 * Vista histórica de cuentas con proveedores (Fase G).
 * Read-only por ahora — los pagos a proveedor se hacen externamente o
 * vía SupplierInvoicesView. Esta vista resuelve la pregunta "cuánto
 * le debo a quién" sobre los 15658 movimientos importados.
 */
export function SuppliersView({ addToast }: Props) {
  const [suppliers, setSuppliers] = useState<SupplierWithBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('debt');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selected, setSelected] = useState<SupplierWithBalance | null>(null);
  const [movements, setMovements] = useState<SupplierMovement[]>([]);
  const [movsLoading, setMovsLoading] = useState(false);
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
      const list = await supplierServiceV2.listWithBalance({ search: debouncedSearch || undefined });
      setSuppliers(list);
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error cargando proveedores.', 'error');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, addToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === 'all') return suppliers;
    if (filter === 'debt') return suppliers.filter((s) => s.balance > 0);
    if (filter === 'credit') return suppliers.filter((s) => s.balance < 0);
    return suppliers;
  }, [suppliers, filter]);

  const summary = useMemo(() => {
    let totalDebt = 0;
    let totalCredit = 0;
    let debtorCount = 0;
    let creditorCount = 0;
    for (const s of suppliers) {
      if (s.balance > 0) {
        totalDebt += s.balance;
        debtorCount++;
      } else if (s.balance < 0) {
        totalCredit += -s.balance;
        creditorCount++;
      }
    }
    return { totalDebt, totalCredit, debtorCount, creditorCount };
  }, [suppliers]);

  async function openDetail(s: SupplierWithBalance) {
    setSelected(s);
    setMovsLoading(true);
    try {
      const movs = await supplierServiceV2.getMovementsForSupplier(s.id);
      setMovements(movs);
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error cargando movimientos.', 'error');
    } finally {
      setMovsLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Truck className="h-5 w-5" style={{ color: 'var(--br-amb)' }} />
        <h1 className="text-xl font-semibold" style={{ color: 'var(--br-txt)' }}>
          Cuentas con proveedores
        </h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div
          className="rounded-xl p-4"
          style={{ background: 'var(--br-red-bg)', border: '1px solid var(--br-red-bor)' }}
        >
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--br-red)' }}>
            <TrendingDown className="h-3.5 w-3.5" /> Le debemos
          </div>
          <p className="text-xl font-semibold mt-1" style={{ color: 'var(--br-red)' }}>
            {formatCurrency(summary.totalDebt)}
          </p>
          <p className="text-xs" style={{ color: 'var(--br-txt2)' }}>
            {summary.debtorCount} proveedor{summary.debtorCount === 1 ? '' : 'es'}
          </p>
        </div>
        <div
          className="rounded-xl p-4"
          style={{ background: 'var(--br-grn-bg)', border: '1px solid var(--br-grn-bor)' }}
        >
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--br-grn)' }}>
            <TrendingUp className="h-3.5 w-3.5" /> Nos deben
          </div>
          <p className="text-xl font-semibold mt-1" style={{ color: 'var(--br-grn)' }}>
            {formatCurrency(summary.totalCredit)}
          </p>
          <p className="text-xs" style={{ color: 'var(--br-txt2)' }}>
            {summary.creditorCount} proveedor{summary.creditorCount === 1 ? '' : 'es'}
          </p>
        </div>
        <div
          className="rounded-xl p-4 col-span-2"
          style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}
        >
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--br-txt2)' }}>
            <Wallet className="h-3.5 w-3.5" /> Balance neto
          </div>
          <p
            className="text-xl font-semibold mt-1"
            style={{
              color:
                summary.totalDebt > summary.totalCredit
                  ? 'var(--br-red)'
                  : summary.totalDebt < summary.totalCredit
                    ? 'var(--br-grn)'
                    : 'var(--br-txt)',
            }}
          >
            {formatCurrency(summary.totalDebt - summary.totalCredit)}
          </p>
        </div>
      </div>

      <div role="group" aria-label="Filtrar proveedores" className="flex items-center gap-2 flex-wrap">
        {(['debt', 'credit', 'all'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className="px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{
              background: filter === f ? 'var(--br-amb)' : 'var(--br-sur)',
              color: filter === f ? 'var(--br-sur)' : 'var(--br-txt)',
              border: '1px solid var(--br-bor)',
            }}
          >
            {f === 'debt' ? 'Le debemos' : f === 'credit' ? 'Nos deben' : 'Todos'}
          </button>
        ))}
        <div className="flex-1 min-w-[200px]">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o CUIT..."
            aria-label="Buscar proveedor por nombre o CUIT"
            iconLeft={<Search className="h-4 w-4" />}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState title="Sin proveedores" description="No hay resultados para el filtro actual." />
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}>
          {filtered.map((s) => (
            <button
              key={s.id}
              onClick={() => void openDetail(s)}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[var(--br-sur2)]"
              style={{ borderBottom: '1px solid var(--br-bor)' }}
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate" style={{ color: 'var(--br-txt)' }}>
                  {s.name}
                  {s.legacyId && (
                    <span
                      className="ml-2 text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wide"
                      style={{ background: 'var(--br-amb-bg)', color: 'var(--br-amb)' }}
                    >
                      Importado
                    </span>
                  )}
                </p>
                <p className="text-xs" style={{ color: 'var(--br-txt2)' }}>
                  {[s.cuit, s.city, s.rubro].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
              <div className="text-right ml-2">
                <p
                  className="font-mono font-semibold text-sm"
                  style={{ color: s.balance > 0 ? 'var(--br-red)' : s.balance < 0 ? 'var(--br-grn)' : 'var(--br-txt2)' }}
                >
                  {s.balance > 0 ? 'Debemos ' : s.balance < 0 ? 'Nos debe ' : ''}
                  {formatCurrency(Math.abs(s.balance))}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <Modal open={!!selected} onClose={() => setSelected(null)} title={selected.name} size="lg">
          <div className="space-y-3">
            <div className="text-xs grid grid-cols-2 gap-2" style={{ color: 'var(--br-txt2)' }}>
              <div>
                <span className="font-semibold">CUIT:</span> {selected.cuit ?? '—'}
              </div>
              <div>
                <span className="font-semibold">Rubro:</span> {selected.rubro ?? '—'}
              </div>
              <div>
                <span className="font-semibold">Teléfono:</span> {selected.phone ?? '—'}
              </div>
              <div>
                <span className="font-semibold">Ciudad:</span> {selected.city ?? '—'}
              </div>
            </div>

            <div
              className="rounded-lg p-3 flex items-center justify-between"
              style={{
                background: selected.balance > 0 ? 'var(--br-red-bg)' : selected.balance < 0 ? 'var(--br-grn-bg)' : 'var(--br-sur2)',
                border: '1px solid var(--br-bor)',
              }}
            >
              <span className="text-sm" style={{ color: 'var(--br-txt)' }}>
                Balance actual
              </span>
              <span
                className="font-mono font-semibold"
                style={{
                  color:
                    selected.balance > 0
                      ? 'var(--br-red)'
                      : selected.balance < 0
                        ? 'var(--br-grn)'
                        : 'var(--br-txt)',
                }}
              >
                {selected.balance > 0 ? 'Debemos ' : selected.balance < 0 ? 'Nos debe ' : 'En cero — '}
                {formatCurrency(Math.abs(selected.balance))}
              </span>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--br-txt2)' }}>
                Movimientos ({movements.length})
              </p>
              {movsLoading ? (
                <div className="flex justify-center py-6">
                  <Spinner />
                </div>
              ) : movements.length === 0 ? (
                <p className="text-sm text-center py-4" style={{ color: 'var(--br-txt2)' }}>
                  Sin movimientos.
                </p>
              ) : (
                <div className="max-h-80 overflow-y-auto rounded-lg" style={{ border: '1px solid var(--br-bor)' }}>
                  {movements.map((m) => {
                    const sign =
                      m.type === 'invoice' || m.type === 'adjustment' || m.type === 'opening_balance' ? 1 : -1;
                    return (
                      <div
                        key={m.id}
                        className="px-3 py-2 text-xs flex items-center justify-between"
                        style={{ borderBottom: '1px solid var(--br-bor)' }}
                      >
                        <div>
                          <p style={{ color: 'var(--br-txt)' }}>
                            {new Date(m.at).toLocaleDateString('es-AR')} · <strong>{m.type}</strong>
                          </p>
                          {m.reference && (
                            <p className="text-[10px]" style={{ color: 'var(--br-txt2)' }}>
                              {m.reference}
                            </p>
                          )}
                        </div>
                        <span
                          className="font-mono font-semibold"
                          style={{ color: sign > 0 ? 'var(--br-red)' : 'var(--br-grn)' }}
                        >
                          {sign > 0 ? '+' : '-'}
                          {formatCurrency(Math.abs(m.amount))}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

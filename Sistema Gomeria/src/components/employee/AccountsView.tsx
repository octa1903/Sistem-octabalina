import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { Customer, CustomerAccountMovement, PaymentMethod } from '@/types';
import { customerServiceV2 } from '@/services/customerServiceV2';
import { supabase } from '@/services/supabaseClient';
import { ensureNoError, rowToCamel } from '@/services/supabaseHelpers';
import { formatCurrency } from '@/utils/currency';
import { Modal, Input, Button } from '@/components/ui';
import { Search, Plus, Minus, TrendingUp, TrendingDown, Wallet } from 'lucide-react';

interface Props {
  addToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  employeeId: string | null;
}

type Filter = 'debt' | 'credit' | 'all';

interface Summary {
  totalDebt: number;
  totalCredit: number;
  debtorCount: number;
  creditorCount: number;
}

const EMPTY_SUMMARY: Summary = { totalDebt: 0, totalCredit: 0, debtorCount: 0, creditorCount: 0 };

export function AccountsView({ addToast, employeeId }: Props) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('debt');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [movements, setMovements] = useState<CustomerAccountMovement[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentType, setPaymentType] = useState<'charge' | 'payment'>('charge');
  const [amount, setAmount] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce de búsqueda (350ms) para no martillar al server.
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [search]);

  const loadCustomers = useCallback(async (f: Filter, term: string) => {
    if (f === 'all' && !term) {
      setCustomers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      if (f === 'all') {
        const list = await customerServiceV2.search(term, 200);
        setCustomers(list);
      } else {
        const list = await customerServiceV2.getWithBalance({
          sign: f,
          search: term || undefined,
        });
        setCustomers(list);
      }
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error cargando cuentas.', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  const loadMeta = useCallback(async () => {
    try {
      const [sum, pms] = await Promise.all([
        customerServiceV2.getBalanceSummary(),
        supabase
          .from('payment_methods')
          .select('*')
          .order('sort_order', { ascending: true })
          .then(r => ensureNoError(r.data, r.error, 'AccountsView.pm').map(row => rowToCamel<PaymentMethod>(row))),
      ]);
      setSummary(sum);
      setPaymentMethods(pms);
      setPaymentMethodId(prev => {
        if (prev) return prev;
        const cash = pms.find(p => p.type === 'cash');
        return cash ? cash.id : pms[0]?.id ?? '';
      });
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error cargando totales.', 'error');
    }
  }, [addToast]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    void loadCustomers(filter, debouncedSearch);
  }, [filter, debouncedSearch, loadCustomers]);

  const loadMovements = useCallback(async (customerId: string) => {
    setMovementsLoading(true);
    try {
      const data = await customerServiceV2.getMovements(customerId);
      setMovements(data);
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error cargando movimientos.', 'error');
    } finally {
      setMovementsLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    if (selectedId) {
      void loadMovements(selectedId);
    } else {
      setMovements([]);
    }
  }, [selectedId, loadMovements]);

  const selected = useMemo(
    () => customers.find(c => c.id === selectedId) ?? null,
    [customers, selectedId],
  );

  async function refreshAll() {
    await Promise.all([
      loadMeta(),
      loadCustomers(filter, debouncedSearch),
      selectedId ? loadMovements(selectedId) : Promise.resolve(),
    ]);
  }

  function openPayment(type: 'charge' | 'payment') {
    if (!selected) return;
    setPaymentType(type);
    setAmount('');
    setNotes('');
    setPaymentOpen(true);
  }

  async function savePayment() {
    if (!selected) return;
    const num = Number(amount);
    if (!amount || num <= 0) {
      addToast('Ingresá un monto válido (>0).', 'error');
      return;
    }
    if (!paymentMethodId) {
      addToast('Seleccioná un método de pago.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      // El trigger customer_account_movements_balance (migración 0007)
      // actualiza customers.account_balance al insertar el movimiento.
      await customerServiceV2.addMovement({
        customerId: selected.id,
        type: paymentType,
        amount: num,
        paymentMethodId,
        notes: notes || undefined,
        employeeId: employeeId ?? undefined,
      });
      await refreshAll();
      setPaymentOpen(false);
      addToast(paymentType === 'charge' ? 'Cargo registrado.' : 'Pago registrado.', 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error guardando movimiento.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const pmName = (id?: string) => paymentMethods.find(p => p.id === id)?.name ?? 'Sin método';

  const tabBtn = (f: Filter, label: string, count?: number) => {
    const active = filter === f;
    return (
      <button
        type="button"
        onClick={() => setFilter(f)}
        aria-pressed={active}
        className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--br-amb)]"
        style={{
          background: active ? 'var(--br-amb-bg)' : 'var(--br-sur)',
          border: `1px solid ${active ? 'var(--br-amb-bor)' : 'var(--br-bor)'}`,
          color: active ? 'var(--br-txt)' : 'var(--br-txt2)',
        }}
      >
        {label}{typeof count === 'number' && <span className="ml-1 tabular-nums opacity-70">· {count}</span>}
      </button>
    );
  };

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--br-txt)' }}>Cuentas Corrientes</h1>
          <div className="flex gap-4 text-sm mt-1">
            <span style={{ color: 'var(--br-txt2)' }}>
              Deuda: <span className="font-semibold font-mono tabular-nums" style={{ color: 'var(--br-red)' }}>{formatCurrency(summary.totalDebt)}</span>
              <span className="ml-1 opacity-60 tabular-nums">({summary.debtorCount})</span>
            </span>
            <span style={{ color: 'var(--br-txt2)' }}>
              A favor: <span className="font-semibold font-mono tabular-nums" style={{ color: 'var(--br-grn)' }}>{formatCurrency(summary.totalCredit)}</span>
              <span className="ml-1 opacity-60 tabular-nums">({summary.creditorCount})</span>
            </span>
          </div>
        </div>
        <div role="tablist" aria-label="Filtrar cuentas" className="flex gap-2">
          {tabBtn('debt', 'Con deuda', summary.debtorCount)}
          {tabBtn('credit', 'A favor', summary.creditorCount)}
          {tabBtn('all', 'Todos')}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Lista de clientes */}
        <div className="lg:col-span-1">
          <div className="mb-3">
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={filter === 'all' ? 'Buscar cliente (requerido)...' : 'Filtrar por nombre o teléfono...'}
              iconLeft={<Search className="h-4 w-4" />}
            />
          </div>
          <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
            {loading ? (
              <div aria-busy="true" aria-label="Cargando clientes" className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-xl h-14 motion-safe:animate-pulse"
                    style={{ background: 'var(--br-sur2)', border: '1px solid var(--br-bor)' }}
                  />
                ))}
              </div>
            ) : customers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ background: 'var(--br-sur2)', color: 'var(--br-txt2)' }}>
                  <Search className="h-5 w-5" aria-hidden="true" />
                </div>
                <p className="text-sm" style={{ color: 'var(--br-txt2)' }}>
                  {filter === 'all' && !debouncedSearch
                    ? 'Escribí un nombre para buscar.'
                    : debouncedSearch
                    ? 'Sin resultados.'
                    : filter === 'debt'
                    ? 'No hay clientes con deuda.'
                    : 'No hay clientes con saldo a favor.'}
                </p>
              </div>
            ) : (
              customers.map((c) => {
                const active = selectedId === c.id;
                const hasDebt = c.accountBalance > 0;
                const hasCredit = c.accountBalance < 0;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    aria-pressed={active}
                    aria-label={`${c.name}, ${hasDebt ? 'debe' : hasCredit ? 'a favor' : 'sin saldo'} ${formatCurrency(Math.abs(c.accountBalance))}`}
                    className="w-full text-left rounded-xl p-3 transition-colors hover:border-[var(--br-amb)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--br-amb)]"
                    style={{
                      background: active ? 'var(--br-amb-bg)' : 'var(--br-sur)',
                      border: `1px solid ${active ? 'var(--br-amb-bor)' : 'var(--br-bor)'}`,
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm truncate" style={{ color: 'var(--br-txt)' }}>
                        {c.name}
                        {c.legacyId && (
                          <span
                            className="ml-2 text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wide font-semibold"
                            style={{ background: 'var(--br-amb-bg)', color: 'var(--br-amb)' }}
                            title={`Importado del sistema legacy (#${c.legacyId})`}
                          >
                            Importado
                          </span>
                        )}
                      </p>
                    </div>
                    <p
                      className="text-sm font-mono tabular-nums font-semibold mt-0.5"
                      style={{ color: hasDebt ? 'var(--br-red)' : hasCredit ? 'var(--br-grn)' : 'var(--br-txt2)' }}
                    >
                      {hasDebt ? 'Debe ' : hasCredit ? 'Favor ' : ''}
                      {formatCurrency(Math.abs(c.accountBalance))}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Detalle de cuenta */}
        <div className="lg:col-span-2">
          {!selected ? (
            <div className="h-full flex flex-col items-center justify-center text-center rounded-xl py-20 px-6 gap-3" style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}>
              <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'var(--br-sur2)', color: 'var(--br-amb)' }}>
                <Wallet className="h-6 w-6" aria-hidden="true" />
              </div>
              <p className="text-sm max-w-[28ch]" style={{ color: 'var(--br-txt2)' }}>
                Elegí un cliente de la izquierda para ver su saldo y movimientos.
              </p>
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}>
              <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--br-bor)' }}>
                <div>
                  <h2 className="font-semibold" style={{ color: 'var(--br-txt)' }}>{selected.name}</h2>
                  <p className="text-sm" style={{ color: 'var(--br-txt2)' }}>
                    {selected.customerType === 'wholesale' ? 'Mayorista' : selected.customerType === 'insured' ? 'Asegurado' : 'Minorista'}
                    {selected.phone && <span> · {selected.phone}</span>}
                    {selected.legacyId && <span className="font-mono opacity-60"> · legacy #{selected.legacyId}</span>}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="danger"
                    size="lg"
                    iconLeft={<Plus className="h-4 w-4" />}
                    onClick={() => openPayment('charge')}
                  >
                    Cargo
                  </Button>
                  <Button
                    variant="success"
                    size="lg"
                    iconLeft={<Minus className="h-4 w-4" />}
                    onClick={() => openPayment('payment')}
                  >
                    Pago
                  </Button>
                </div>
              </div>

              <div className="px-5 py-4" style={{ background: 'var(--br-sur2)', borderBottom: '1px solid var(--br-bor)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--br-txt2)' }}>
                  {selected.accountBalance > 0 ? 'Saldo deudor' : selected.accountBalance < 0 ? 'Saldo a favor' : 'Sin saldo'}
                </p>
                <p
                  className="text-3xl font-bold font-mono tabular-nums mt-0.5"
                  style={{ color: selected.accountBalance > 0 ? 'var(--br-red)' : selected.accountBalance < 0 ? 'var(--br-grn)' : 'var(--br-txt)' }}
                >
                  {formatCurrency(Math.abs(selected.accountBalance))}
                </p>
                {selected.creditLimit > 0 && (
                  <p className="text-xs mt-1" style={{ color: 'var(--br-txt2)' }}>
                    Cupo otorgado: <span className="font-mono tabular-nums">{formatCurrency(selected.creditLimit)}</span>
                    {selected.accountBalance > 0 && (
                      <span> · queda <span className="font-mono tabular-nums">{formatCurrency(Math.max(0, selected.creditLimit - selected.accountBalance))}</span></span>
                    )}
                  </p>
                )}
              </div>

              <div className="px-5 py-4">
                <p className="text-sm font-semibold mb-3" style={{ color: 'var(--br-txt)' }}>
                  Movimientos {movements.length > 0 && <span className="opacity-60 font-normal tabular-nums">({movements.length})</span>}
                </p>
                {movementsLoading ? (
                  <div aria-busy="true" aria-label="Cargando movimientos" className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-12 rounded motion-safe:animate-pulse" style={{ background: 'var(--br-sur2)' }} />
                    ))}
                  </div>
                ) : movements.length === 0 ? (
                  <p className="text-sm py-6 text-center" style={{ color: 'var(--br-txt2)' }}>
                    Sin movimientos. Registrá un cargo o un pago para empezar.
                  </p>
                ) : (
                  <ul className="space-y-1 max-h-[55vh] overflow-y-auto pr-1">
                    {movements.map((m, idx) => {
                      const isCharge = m.type === 'charge';
                      const showDivider = idx > 0;
                      return (
                        <li
                          key={m.id}
                          className="flex items-center justify-between gap-3 py-2.5"
                          style={{ borderTop: showDivider ? '1px solid var(--br-bor)' : 'none' }}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                              style={{
                                background: isCharge ? 'var(--br-red-bg)' : 'var(--br-grn-bg)',
                                color: isCharge ? 'var(--br-red)' : 'var(--br-grn)',
                              }}
                            >
                              {isCharge
                                ? <TrendingUp className="h-4 w-4" aria-hidden="true" />
                                : <TrendingDown className="h-4 w-4" aria-hidden="true" />
                              }
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium" style={{ color: 'var(--br-txt)' }}>
                                {isCharge ? 'Cargo' : 'Pago'} <span className="font-normal" style={{ color: 'var(--br-txt2)' }}>· {pmName(m.paymentMethodId)}</span>
                              </p>
                              <p className="text-xs truncate" style={{ color: 'var(--br-txt2)' }}>
                                {new Date(m.at).toLocaleDateString('es-AR')}
                                {m.notes && <span> · {m.notes}</span>}
                              </p>
                            </div>
                          </div>
                          <span
                            className="font-mono tabular-nums text-sm font-semibold flex-shrink-0"
                            style={{ color: isCharge ? 'var(--br-red)' : 'var(--br-grn)' }}
                          >
                            {isCharge ? '+' : '−'}{formatCurrency(m.amount)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal open={paymentOpen} onClose={() => !submitting && setPaymentOpen(false)} title={paymentType === 'charge' ? 'Registrar cargo' : 'Registrar pago'} size="sm">
        <div className="space-y-3">
          <div>
            <label htmlFor="account-payment-amount" className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>Monto ($)</label>
            <input id="account-payment-amount" type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder="0" autoFocus
              disabled={submitting}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--br-amb)]"
              style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }} />
          </div>
          <div>
            <label htmlFor="account-payment-method" className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>Método</label>
            <select id="account-payment-method" value={paymentMethodId} onChange={(e) => setPaymentMethodId(e.target.value)}
              disabled={submitting}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--br-amb)]"
              style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}>
              {paymentMethods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="account-payment-notes" className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>Notas</label>
            <input id="account-payment-notes" type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Opcional..."
              disabled={submitting}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--br-amb)]"
              style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="secondary" onClick={() => setPaymentOpen(false)} disabled={submitting}>Cancelar</Button>
          <Button
            variant={paymentType === 'charge' ? 'danger' : 'success'}
            onClick={savePayment}
            loading={submitting}
          >
            {paymentType === 'charge' ? 'Registrar cargo' : 'Registrar pago'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

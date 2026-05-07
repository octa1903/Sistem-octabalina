import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Customer, CustomerAccountMovement, PaymentMethod } from '@/types';
import { customerServiceV2 } from '@/services/customerServiceV2';
import { supabase } from '@/services/supabaseClient';
import { ensureNoError, rowToCamel } from '@/services/supabaseHelpers';
import { formatCurrency } from '@/utils/currency';
import { Modal, Input, Button } from '@/components/ui';
import { Search, Plus, Minus, TrendingUp, TrendingDown } from 'lucide-react';

interface Props {
  addToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  employeeId: string | null;
}

export function AccountsView({ addToast, employeeId }: Props) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [movements, setMovements] = useState<CustomerAccountMovement[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentType, setPaymentType] = useState<'charge' | 'payment'>('charge');
  const [amount, setAmount] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [custs, pms] = await Promise.all([
        customerServiceV2.getAll(),
        supabase
          .from('payment_methods')
          .select('*')
          .order('sort_order', { ascending: true })
          .then(r => ensureNoError(r.data, r.error, 'AccountsView.pm').map(row => rowToCamel<PaymentMethod>(row))),
      ]);
      setCustomers(custs);
      setPaymentMethods(pms);
      if (!paymentMethodId) {
        const cash = pms.find(p => p.type === 'cash');
        if (cash) setPaymentMethodId(cash.id);
        else if (pms.length > 0) setPaymentMethodId(pms[0].id);
      }
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error cargando cuentas.', 'error');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addToast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return customers.filter(c =>
      c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(q),
    );
  }, [customers, search]);

  const selected = customers.find(c => c.id === selectedId) ?? null;
  const totalDebt = customers.reduce((s, c) => s + Math.max(0, c.accountBalance), 0);

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
      // El trigger customer_account_movements_balance (migración 0007) actualiza
      // customers.account_balance automáticamente al insertar el movimiento.
      await customerServiceV2.addMovement({
        customerId: selected.id,
        type: paymentType,
        amount: num,
        paymentMethodId,
        notes: notes || undefined,
        employeeId: employeeId ?? undefined,
      });
      await refresh();
      await loadMovements(selected.id);
      setPaymentOpen(false);
      addToast(paymentType === 'charge' ? 'Cargo registrado.' : 'Pago registrado.', 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error guardando movimiento.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const pmName = (id?: string) => paymentMethods.find(p => p.id === id)?.name ?? 'Sin método';

  return (
    <div className="p-5 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--br-txt)' }}>Cuentas Corrientes</h1>
          <p className="text-sm" style={{ color: 'var(--br-txt2)' }}>
            Deuda total: <span className="font-semibold font-mono" style={{ color: 'var(--br-red)' }}>{formatCurrency(totalDebt)}</span>
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Customer list */}
        <div className="lg:col-span-1">
          <div className="mb-3">
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente..."
              iconLeft={<Search className="h-4 w-4" />}
            />
          </div>
          <div className="space-y-2">
            {loading ? (
              <p className="text-sm text-center py-6" style={{ color: 'var(--br-txt2)' }}>Cargando...</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: 'var(--br-txt2)' }}>
                {customers.length === 0 ? 'No hay clientes registrados.' : 'Sin resultados.'}
              </p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className="w-full text-left rounded-xl p-3 transition-all"
                  style={{
                    background: selectedId === c.id ? 'var(--br-amb-bg)' : 'var(--br-sur)',
                    border: `1px solid ${selectedId === c.id ? 'var(--br-amb-bor)' : 'var(--br-bor)'}`,
                  }}
                >
                  <p className="font-medium text-sm" style={{ color: 'var(--br-txt)' }}>{c.name}</p>
                  <p
                    className="text-sm font-mono font-semibold mt-0.5"
                    style={{ color: c.accountBalance > 0 ? 'var(--br-red)' : c.accountBalance < 0 ? 'var(--br-grn)' : 'var(--br-txt2)' }}
                  >
                    {c.accountBalance !== 0 ? (c.accountBalance > 0 ? 'Debe ' : 'Favor ') : ''}
                    {formatCurrency(Math.abs(c.accountBalance))}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Account detail */}
        <div className="lg:col-span-2">
          {!selected ? (
            <div className="h-full flex items-center justify-center rounded-xl py-20" style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}>
              <p className="text-sm" style={{ color: 'var(--br-txt2)' }}>Seleccioná un cliente para ver su cuenta.</p>
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}>
              <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--br-bor)' }}>
                <div>
                  <h2 className="font-semibold" style={{ color: 'var(--br-txt)' }}>{selected.name}</h2>
                  <p className="text-sm" style={{ color: 'var(--br-txt2)' }}>
                    {selected.customerType === 'wholesale' ? 'Mayorista' : 'Minorista'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openPayment('charge')}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white"
                    style={{ background: 'var(--br-red)' }}
                  >
                    <Plus className="h-4 w-4" /> Cargo
                  </button>
                  <button
                    onClick={() => openPayment('payment')}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white"
                    style={{ background: 'var(--br-grn)' }}
                  >
                    <Minus className="h-4 w-4" /> Pago
                  </button>
                </div>
              </div>

              <div className="px-5 py-4" style={{ background: 'var(--br-sur2)', borderBottom: '1px solid var(--br-bor)' }}>
                <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>Saldo actual</p>
                <p
                  className="text-3xl font-bold font-mono"
                  style={{ color: selected.accountBalance > 0 ? 'var(--br-red)' : selected.accountBalance < 0 ? 'var(--br-grn)' : 'var(--br-txt)' }}
                >
                  {formatCurrency(Math.abs(selected.accountBalance))}
                </p>
                <p className="text-sm mt-0.5" style={{ color: 'var(--br-txt2)' }}>
                  {selected.accountBalance > 0 ? 'Saldo deudor' : selected.accountBalance < 0 ? 'Saldo a favor' : 'Sin saldo'}
                  {selected.creditLimit > 0 && (
                    <span> · Cupo: <span className="font-mono">{formatCurrency(selected.creditLimit)}</span></span>
                  )}
                </p>
              </div>

              <div className="px-5 py-4">
                <p className="text-sm font-semibold mb-3" style={{ color: 'var(--br-txt)' }}>Movimientos</p>
                {movementsLoading ? (
                  <p className="text-sm py-4 text-center" style={{ color: 'var(--br-txt2)' }}>Cargando...</p>
                ) : movements.length === 0 ? (
                  <p className="text-sm py-4 text-center" style={{ color: 'var(--br-txt2)' }}>Sin movimientos registrados.</p>
                ) : (
                  <div className="space-y-2">
                    {movements.map((m) => {
                      const isCharge = m.type === 'charge';
                      return (
                        <div key={m.id} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--br-bor)' }}>
                          <div className="flex items-center gap-2">
                            {isCharge
                              ? <TrendingUp className="h-4 w-4" style={{ color: 'var(--br-red)' }} />
                              : <TrendingDown className="h-4 w-4" style={{ color: 'var(--br-grn)' }} />
                            }
                            <div>
                              <p className="text-sm font-medium" style={{ color: 'var(--br-txt)' }}>
                                {isCharge ? 'Cargo' : 'Pago'} · {pmName(m.paymentMethodId)}
                              </p>
                              <p className="text-xs" style={{ color: 'var(--br-txt2)' }}>
                                {new Date(m.at).toLocaleDateString('es-AR')}
                                {m.notes && ` · ${m.notes}`}
                              </p>
                            </div>
                          </div>
                          <span className="font-mono text-sm font-semibold"
                                style={{ color: isCharge ? 'var(--br-red)' : 'var(--br-grn)' }}>
                            {isCharge ? '+' : '−'}{formatCurrency(m.amount)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal open={paymentOpen} onClose={() => !submitting && setPaymentOpen(false)} title={paymentType === 'charge' ? 'Registrar cargo' : 'Registrar pago'} size="sm">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>Monto ($)</label>
            <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder="0" autoFocus
              disabled={submitting}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>Método</label>
            <select value={paymentMethodId} onChange={(e) => setPaymentMethodId(e.target.value)}
              disabled={submitting}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}>
              {paymentMethods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>Notas</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Opcional..."
              disabled={submitting}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
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

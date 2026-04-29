import { useState, useMemo } from 'react';
import type { Client, Payment } from '@/types';
import { clientService } from '@/services/storageService';
import { PAYMENT_METHODS } from '@/constants';
import { formatCurrency } from '@/utils/currency';
import { Modal } from '@/components/ui/Modal';
import { Search, Plus, Minus, TrendingUp, TrendingDown } from 'lucide-react';

interface Props { addToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void; }

export function AccountsView({ addToast }: Props) {
  const [clients, setClients] = useState<Client[]>(() => clientService.getAll());
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Client | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentType, setPaymentType] = useState<'charge' | 'payment'>('charge');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('efectivo');
  const [notes, setNotes] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return clients.filter((c) => c.name.toLowerCase().includes(q) || c.phone?.includes(q));
  }, [clients, search]);

  const totalDebt = clients.reduce((s, c) => s + Math.max(0, c.balance), 0);

  function openPayment(c: Client, type: 'charge' | 'payment') {
    setSelected(c);
    setPaymentType(type);
    setAmount('');
    setMethod('efectivo');
    setNotes('');
    setPaymentOpen(true);
  }

  function savePayment() {
    if (!selected || !amount || Number(amount) <= 0) {
      addToast('Ingrese un monto válido.', 'error');
      return;
    }
    const now = new Date().toISOString();
    const delta = paymentType === 'charge' ? Number(amount) : -Number(amount);
    const payment: Payment = {
      id: `p${Date.now()}`,
      amount: Number(amount),
      date: now,
      method: PAYMENT_METHODS.find((p) => p.id === method)?.label ?? method,
      notes,
    };
    const updated: Client = {
      ...selected,
      balance: selected.balance + delta,
      payments: [...selected.payments, payment],
      updatedAt: now,
    };
    clientService.save(updated);
    setClients(clientService.getAll());
    setSelected(updated);
    setPaymentOpen(false);
    addToast(paymentType === 'charge' ? 'Cargo registrado.' : 'Pago registrado.', 'success');
  }

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
        {/* Client list */}
        <div className="lg:col-span-1">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--br-txt2)' }} />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente..."
              className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none"
              style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)' }} />
          </div>
          <div className="space-y-2">
            {filtered.map((c) => (
              <button key={c.id} onClick={() => setSelected(c)}
                className="w-full text-left rounded-xl p-3 transition-all"
                style={{
                  background: selected?.id === c.id ? 'var(--br-amb-bg)' : 'var(--br-sur)',
                  border: `1px solid ${selected?.id === c.id ? 'var(--br-amb-bor)' : 'var(--br-bor)'}`,
                }}>
                <p className="font-medium text-sm" style={{ color: 'var(--br-txt)' }}>{c.name}</p>
                <p className="text-sm font-mono font-semibold mt-0.5"
                  style={{ color: c.balance > 0 ? 'var(--br-red)' : c.balance < 0 ? 'var(--br-grn)' : 'var(--br-txt2)' }}>
                  {c.balance !== 0 ? (c.balance > 0 ? 'Debe ' : 'Favor ') : ''}{formatCurrency(Math.abs(c.balance))}
                </p>
              </button>
            ))}
            {filtered.length === 0 && <p className="text-sm text-center py-6" style={{ color: 'var(--br-txt2)' }}>Sin clientes.</p>}
          </div>
        </div>

        {/* Account detail */}
        <div className="lg:col-span-2">
          {!selected ? (
            <div className="h-full flex items-center justify-center rounded-xl" style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}>
              <p className="text-sm" style={{ color: 'var(--br-txt2)' }}>Seleccioná un cliente para ver su cuenta.</p>
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}>
              <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--br-bor)' }}>
                <div>
                  <h2 className="font-semibold" style={{ color: 'var(--br-txt)' }}>{selected.name}</h2>
                  <p className="text-sm" style={{ color: 'var(--br-txt2)' }}>{selected.tipoCliente}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openPayment(selected, 'charge')}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white"
                    style={{ background: 'var(--br-red)' }}>
                    <Plus className="h-4 w-4" /> Cargo
                  </button>
                  <button onClick={() => openPayment(selected, 'payment')}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white"
                    style={{ background: 'var(--br-grn)' }}>
                    <Minus className="h-4 w-4" /> Pago
                  </button>
                </div>
              </div>

              {/* Balance */}
              <div className="px-5 py-4" style={{ background: 'var(--br-sur2)', borderBottom: '1px solid var(--br-bor)' }}>
                <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>Saldo actual</p>
                <p className="text-3xl font-bold font-mono" style={{ color: selected.balance > 0 ? 'var(--br-red)' : selected.balance < 0 ? 'var(--br-grn)' : 'var(--br-txt)' }}>
                  {formatCurrency(Math.abs(selected.balance))}
                </p>
                <p className="text-sm mt-0.5" style={{ color: 'var(--br-txt2)' }}>
                  {selected.balance > 0 ? 'Saldo deudor' : selected.balance < 0 ? 'Saldo a favor' : 'Sin saldo'}
                </p>
              </div>

              {/* Payment history */}
              <div className="px-5 py-4">
                <p className="text-sm font-semibold mb-3" style={{ color: 'var(--br-txt)' }}>Movimientos</p>
                {selected.payments.length === 0 ? (
                  <p className="text-sm py-4 text-center" style={{ color: 'var(--br-txt2)' }}>Sin movimientos registrados.</p>
                ) : (
                  <div className="space-y-2">
                    {[...selected.payments].reverse().map((p) => (
                      <div key={p.id} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--br-bor)' }}>
                        <div className="flex items-center gap-2">
                          {p.amount > 0
                            ? <TrendingDown className="h-4 w-4" style={{ color: 'var(--br-grn)' }} />
                            : <TrendingUp className="h-4 w-4" style={{ color: 'var(--br-red)' }} />
                          }
                          <div>
                            <p className="text-sm font-medium" style={{ color: 'var(--br-txt)' }}>{p.method}</p>
                            <p className="text-xs" style={{ color: 'var(--br-txt2)' }}>
                              {new Date(p.date).toLocaleDateString('es-AR')}
                              {p.notes && ` · ${p.notes}`}
                            </p>
                          </div>
                        </div>
                        <span className="font-mono text-sm font-semibold" style={{ color: 'var(--br-grn)' }}>
                          {formatCurrency(p.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Payment modal */}
      <Modal open={paymentOpen} onClose={() => setPaymentOpen(false)} title={paymentType === 'charge' ? 'Registrar cargo' : 'Registrar pago'} size="sm">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>Monto ($)</label>
            <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder="0" autoFocus
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--br-amb)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--br-bor)')} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>Método</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}>
              {PAYMENT_METHODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>Notas</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Opcional..."
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => setPaymentOpen(false)} className="px-4 py-2 rounded-lg text-sm" style={{ border: '1px solid var(--br-bor)', color: 'var(--br-txt2)' }}>Cancelar</button>
          <button onClick={savePayment} className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: paymentType === 'charge' ? 'var(--br-red)' : 'var(--br-grn)' }}>
            {paymentType === 'charge' ? 'Registrar cargo' : 'Registrar pago'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

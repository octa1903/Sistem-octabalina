import { useState, useMemo } from 'react';
import type { Invoice, InvoiceItem } from '@/types';
import { invoiceService } from '@/services/storageService';
import { INVOICE_TYPES } from '@/constants';
import { formatCurrency } from '@/utils/currency';
import { Modal } from '@/components/ui/Modal';
import { Plus, Search, Edit2, Trash2, CheckCircle, XCircle } from 'lucide-react';

interface Props { addToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void; }

type InvoiceForm = Omit<Invoice, 'id' | 'items' | 'subtotal' | 'iva' | 'total'> & {
  items: { description: string; quantity: number; unitPrice: number }[];
};

const EMPTY_FORM: InvoiceForm = {
  type: 'B', number: '', supplier: '', date: new Date().toISOString().slice(0, 10),
  dueDate: '', paid: false, notes: '',
  items: [{ description: '', quantity: 1, unitPrice: 0 }],
};

export function InvoicesView({ addToast }: Props) {
  const [invoices, setInvoices] = useState<Invoice[]>(() => invoiceService.getAll());
  const [search, setSearch] = useState('');
  const [filterPaid, setFilterPaid] = useState<'' | 'paid' | 'unpaid'>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [form, setForm] = useState<InvoiceForm>({ ...EMPTY_FORM });
  const [deleting, setDeleting] = useState<Invoice | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return invoices.filter((inv) => {
      if (filterPaid === 'paid' && !inv.paid) return false;
      if (filterPaid === 'unpaid' && inv.paid) return false;
      if (q && !`${inv.supplier} ${inv.number}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [invoices, search, filterPaid]);

  const totalUnpaid = invoices.filter((i) => !i.paid).reduce((s, i) => s + i.total, 0);

  function openNew() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, date: new Date().toISOString().slice(0, 10) });
    setModalOpen(true);
  }

  function openEdit(inv: Invoice) {
    setEditing(inv);
    setForm({
      type: inv.type, number: inv.number, supplier: inv.supplier,
      date: inv.date.slice(0, 10), dueDate: inv.dueDate?.slice(0, 10) ?? '',
      paid: inv.paid, notes: inv.notes,
      items: inv.items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice })),
    });
    setModalOpen(true);
  }

  function saveInvoice() {
    if (!form.supplier || !form.number) { addToast('Proveedor y número son obligatorios.', 'error'); return; }
    const items: InvoiceItem[] = form.items
      .filter((i) => i.description.trim())
      .map((i) => ({ ...i, subtotal: i.quantity * i.unitPrice }));
    const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
    const iva = form.type === 'A' ? subtotal * 0.21 : 0;
    const total = subtotal + iva;
    if (editing) {
      invoiceService.save({ ...editing, ...form, items, subtotal, iva, total });
    } else {
      invoiceService.save({ id: `inv${Date.now()}`, ...form, items, subtotal, iva, total });
    }
    setInvoices(invoiceService.getAll());
    setModalOpen(false);
    addToast(editing ? 'Factura actualizada.' : 'Factura guardada.', 'success');
  }

  function togglePaid(inv: Invoice) {
    invoiceService.save({ ...inv, paid: !inv.paid });
    setInvoices(invoiceService.getAll());
    addToast(inv.paid ? 'Marcada como impaga.' : 'Marcada como pagada.', 'success');
  }

  function confirmDelete() {
    if (!deleting) return;
    invoiceService.delete(deleting.id);
    setInvoices(invoiceService.getAll());
    setDeleting(null);
    addToast('Factura eliminada.', 'warning');
  }

  function updateItem(idx: number, key: string, value: string | number) {
    setForm((prev) => {
      const items = [...prev.items];
      items[idx] = { ...items[idx], [key]: value };
      return { ...prev, items };
    });
  }

  return (
    <div className="p-5 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--br-txt)' }}>Facturas</h1>
          <p className="text-sm" style={{ color: 'var(--br-txt2)' }}>
            {invoices.filter((i) => !i.paid).length} impagas ·{' '}
            <span className="font-semibold font-mono" style={{ color: 'var(--br-red)' }}>{formatCurrency(totalUnpaid)}</span>
          </p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold" style={{ background: 'var(--br-amb)' }}>
          <Plus className="h-4 w-4" /> Nueva factura
        </button>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--br-txt2)' }} />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar proveedor, número..."
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none"
            style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)' }} />
        </div>
        <select value={filterPaid} onChange={(e) => setFilterPaid(e.target.value as typeof filterPaid)}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}>
          <option value="">Todas</option>
          <option value="unpaid">Impagas</option>
          <option value="paid">Pagadas</option>
        </select>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 600 }}>
            <thead>
              <tr style={{ background: 'var(--br-sur2)', borderBottom: '1px solid var(--br-bor)' }}>
                {['Tipo', 'Número', 'Proveedor', 'Fecha', 'Vence', 'Total', 'Estado', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--br-txt2)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--br-txt2)' }}>Sin facturas.</td></tr>
              ) : (
                filtered.map((inv) => (
                  <tr key={inv.id} style={{ borderBottom: '1px solid var(--br-bor)' }}
                    onMouseOver={(e) => (e.currentTarget.style.background = 'var(--br-sur2)')}
                    onMouseOut={(e) => (e.currentTarget.style.background = '')}>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-xs font-bold" style={{ background: 'var(--br-sur2)', color: 'var(--br-txt)' }}>
                        Fac. {inv.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--br-txt)' }}>{inv.number}</td>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--br-txt)' }}>{inv.supplier}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--br-txt2)' }}>{new Date(inv.date).toLocaleDateString('es-AR')}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--br-txt2)' }}>{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('es-AR') : '—'}</td>
                    <td className="px-4 py-3 font-mono font-semibold" style={{ color: 'var(--br-txt)' }}>{formatCurrency(inv.total)}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => togglePaid(inv)} className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full"
                        style={{
                          color: inv.paid ? 'var(--br-grn)' : 'var(--br-red)',
                          background: inv.paid ? 'var(--br-grn-bg)' : 'var(--br-red-bg)',
                          border: `1px solid ${inv.paid ? 'var(--br-grn-bor)' : 'var(--br-red-bor)'}`,
                        }}>
                        {inv.paid ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        {inv.paid ? 'Pagada' : 'Impaga'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => openEdit(inv)} className="p-1.5 rounded" style={{ color: 'var(--br-txt2)' }}
                          onMouseOver={(e) => (e.currentTarget.style.color = 'var(--br-amb)')}
                          onMouseOut={(e) => (e.currentTarget.style.color = 'var(--br-txt2)')}>
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => setDeleting(inv)} className="p-1.5 rounded" style={{ color: 'var(--br-txt2)' }}
                          onMouseOver={(e) => (e.currentTarget.style.color = 'var(--br-red)')}
                          onMouseOut={(e) => (e.currentTarget.style.color = 'var(--br-txt2)')}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice form modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar factura' : 'Nueva factura'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>Tipo</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Invoice['type'] })}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}>
                {INVOICE_TYPES.map((t) => <option key={t} value={t}>Factura {t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>Número</label>
              <input type="text" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })}
                placeholder="0001-00001234"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>Fecha</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>Proveedor *</label>
              <input type="text" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>Vencimiento</label>
              <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }} />
            </div>
          </div>

          {/* Items */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--br-txt2)' }}>Ítems</label>
            <div className="space-y-2">
              {form.items.map((item, i) => (
                <div key={i} className="flex gap-2">
                  <input type="text" value={item.description} onChange={(e) => updateItem(i, 'description', e.target.value)}
                    placeholder="Descripción" className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }} />
                  <input type="number" value={item.quantity} onChange={(e) => updateItem(i, 'quantity', Number(e.target.value))}
                    min="1" className="w-16 px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }} />
                  <input type="number" value={item.unitPrice} onChange={(e) => updateItem(i, 'unitPrice', Number(e.target.value))}
                    min="0" placeholder="Precio" className="w-28 px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }} />
                  <span className="flex items-center text-sm font-mono w-28" style={{ color: 'var(--br-txt2)' }}>
                    {formatCurrency(item.quantity * item.unitPrice)}
                  </span>
                  {form.items.length > 1 && (
                    <button onClick={() => setForm((p) => ({ ...p, items: p.items.filter((_, j) => j !== i) }))}
                      className="p-2 rounded" style={{ color: 'var(--br-red)' }}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => setForm((p) => ({ ...p, items: [...p.items, { description: '', quantity: 1, unitPrice: 0 }] }))}
              className="mt-2 text-sm font-medium" style={{ color: 'var(--br-amb)' }}>
              + Agregar ítem
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="paid" checked={form.paid} onChange={(e) => setForm({ ...form, paid: e.target.checked })} className="w-4 h-4" />
            <label htmlFor="paid" className="text-sm" style={{ color: 'var(--br-txt)' }}>Marcar como pagada</label>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg text-sm" style={{ border: '1px solid var(--br-bor)', color: 'var(--br-txt2)' }}>Cancelar</button>
          <button onClick={saveInvoice} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: 'var(--br-amb)' }}>Guardar</button>
        </div>
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Eliminar factura" size="sm">
        <p className="text-sm" style={{ color: 'var(--br-txt2)' }}>¿Eliminar factura {deleting?.type} {deleting?.number} de {deleting?.supplier}?</p>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => setDeleting(null)} className="px-4 py-2 rounded-lg text-sm" style={{ border: '1px solid var(--br-bor)', color: 'var(--br-txt2)' }}>Cancelar</button>
          <button onClick={confirmDelete} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: 'var(--br-red)' }}>Eliminar</button>
        </div>
      </Modal>
    </div>
  );
}

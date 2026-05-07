// ═══════════════════════════════════════════════════
// InvoicesView — Facturas a proveedores AFIP (Fase 6).
// Migrada de localStorage a Supabase (tabla supplier_invoices).
// ═══════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SupplierInvoice } from '@/types';
import { supplierInvoiceService } from '@/services/supplierInvoiceService';
import { INVOICE_TYPES } from '@/constants';
import { formatCurrency } from '@/utils/currency';
import { Modal, Button, IconButton, Input, Select, EmptyState } from '@/components/ui';
import { Plus, Search, Edit2, Trash2, CheckCircle, XCircle, FileText } from 'lucide-react';

interface Props { addToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void; }

interface InvoiceForm {
  type: 'A' | 'B' | 'C' | 'X';
  number: string;
  supplier: string;
  date: string;
  dueDate: string;
  paid: boolean;
  notes: string;
  items: { description: string; quantity: number; unitPrice: number }[];
}

const EMPTY_FORM: InvoiceForm = {
  type: 'B', number: '', supplier: '', date: new Date().toISOString().slice(0, 10),
  dueDate: '', paid: false, notes: '',
  items: [{ description: '', quantity: 1, unitPrice: 0 }],
};

export function InvoicesView({ addToast }: Props) {
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPaid, setFilterPaid] = useState<'' | 'paid' | 'unpaid'>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierInvoice | null>(null);
  const [form, setForm] = useState<InvoiceForm>({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<SupplierInvoice | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setInvoices(await supplierInvoiceService.getAll());
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error cargando facturas.', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { void refresh(); }, [refresh]);

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

  function openEdit(inv: SupplierInvoice) {
    setEditing(inv);
    setForm({
      type: inv.type,
      number: inv.number,
      supplier: inv.supplier,
      date: inv.date.slice(0, 10),
      dueDate: inv.dueDate?.slice(0, 10) ?? '',
      paid: inv.paid,
      notes: inv.notes ?? '',
      items: inv.items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice })),
    });
    setModalOpen(true);
  }

  async function saveInvoice() {
    if (!form.supplier.trim() || !form.number.trim()) {
      addToast('Proveedor y número son obligatorios.', 'error');
      return;
    }
    const items = form.items
      .filter((i) => i.description.trim())
      .map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, subtotal: i.quantity * i.unitPrice }));
    if (items.length === 0) {
      addToast('La factura debe tener al menos un ítem con descripción.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await supplierInvoiceService.save({
        id: editing?.id,
        type: form.type,
        number: form.number.trim(),
        supplier: form.supplier.trim(),
        date: form.date,
        dueDate: form.dueDate || undefined,
        items,
        paid: form.paid,
        notes: form.notes.trim() || undefined,
      });
      await refresh();
      setModalOpen(false);
      addToast(editing ? 'Factura actualizada.' : 'Factura guardada.', 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error guardando factura.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function togglePaid(inv: SupplierInvoice) {
    try {
      await supplierInvoiceService.setPaid(inv.id, !inv.paid);
      await refresh();
      addToast(inv.paid ? 'Marcada como impaga.' : 'Marcada como pagada.', 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error actualizando estado.', 'error');
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await supplierInvoiceService.delete(deleting.id);
      await refresh();
      setDeleting(null);
      addToast('Factura eliminada.', 'warning');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error eliminando.', 'error');
    }
  }

  function updateItem(idx: number, key: 'description' | 'quantity' | 'unitPrice', value: string | number) {
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
        <Button variant="primary" onClick={openNew} iconLeft={<Plus className="h-4 w-4" />}>
          Nueva factura
        </Button>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="flex-1 min-w-48">
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar proveedor, número..."
            iconLeft={<Search className="h-4 w-4" />}
          />
        </div>
        <div className="w-40">
          <Select value={filterPaid} onChange={(e) => setFilterPaid(e.target.value as typeof filterPaid)}>
            <option value="">Todas</option>
            <option value="unpaid">Impagas</option>
            <option value="paid">Pagadas</option>
          </Select>
        </div>
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
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--br-txt2)' }}>Cargando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8}><EmptyState icon={FileText} title="Sin facturas." density="compact" /></td></tr>
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
                      <button onClick={() => void togglePaid(inv)} className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full"
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
                        <IconButton
                          label="Editar"
                          icon={<Edit2 className="h-4 w-4" />}
                          tone="primary"
                          size="sm"
                          bordered={false}
                          onClick={() => openEdit(inv)}
                        />
                        <IconButton
                          label="Eliminar"
                          icon={<Trash2 className="h-4 w-4" />}
                          tone="danger"
                          size="sm"
                          bordered={false}
                          onClick={() => setDeleting(inv)}
                        />
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
      <Modal open={modalOpen} onClose={() => !submitting && setModalOpen(false)} title={editing ? 'Editar factura' : 'Nueva factura'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>Tipo</label>
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as InvoiceForm['type'] })}>
                {INVOICE_TYPES.map((t) => <option key={t} value={t}>Factura {t}</option>)}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>Número *</label>
              <Input type="text" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })}
                placeholder="0001-00001234" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>Fecha</label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>Proveedor *</label>
              <Input type="text" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>Vencimiento</label>
              <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
          </div>

          {/* Items */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--br-txt2)' }}>Ítems</label>
            <div className="space-y-2">
              {form.items.map((item, i) => (
                <div key={i} className="flex gap-2">
                  <div className="flex-1">
                    <Input type="text" value={item.description} onChange={(e) => updateItem(i, 'description', e.target.value)}
                      placeholder="Descripción" />
                  </div>
                  <div className="w-16">
                    <Input type="number" value={item.quantity} onChange={(e) => updateItem(i, 'quantity', Number(e.target.value))}
                      min="1" />
                  </div>
                  <div className="w-28">
                    <Input type="number" value={item.unitPrice} onChange={(e) => updateItem(i, 'unitPrice', Number(e.target.value))}
                      min="0" placeholder="Precio" />
                  </div>
                  <span className="flex items-center text-sm font-mono w-28" style={{ color: 'var(--br-txt2)' }}>
                    {formatCurrency(item.quantity * item.unitPrice)}
                  </span>
                  {form.items.length > 1 && (
                    <IconButton
                      label="Quitar ítem"
                      icon={<Trash2 className="h-4 w-4" />}
                      tone="danger"
                      size="sm"
                      bordered={false}
                      onClick={() => setForm((p) => ({ ...p, items: p.items.filter((_, j) => j !== i) }))}
                    />
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
          <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={submitting}>Cancelar</Button>
          <Button variant="primary" onClick={() => void saveInvoice()} loading={submitting}>
            Guardar
          </Button>
        </div>
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Eliminar factura" size="sm">
        <p className="text-sm" style={{ color: 'var(--br-txt2)' }}>¿Eliminar factura {deleting?.type} {deleting?.number} de {deleting?.supplier}?</p>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="secondary" onClick={() => setDeleting(null)}>Cancelar</Button>
          <Button variant="danger" onClick={() => void confirmDelete()}>Eliminar</Button>
        </div>
      </Modal>
    </div>
  );
}

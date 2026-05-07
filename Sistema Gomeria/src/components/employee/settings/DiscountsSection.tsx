import { useState, useEffect, useCallback } from 'react';
import type { Discount } from '@/types';
import { discountService } from '@/services/discountService';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui';
import { Plus, Edit2, Trash2, Tag } from 'lucide-react';

interface Props {
  addToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

interface FormState {
  name: string;
  type: 'percent' | 'amount';
  // '' = pedir en venta; sino el valor fijo.
  value: string;
}

const EMPTY_FORM: FormState = { name: '', type: 'percent', value: '' };

export function DiscountsSection({ addToast }: Props) {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Discount | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<Discount | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await discountService.getAll();
      setDiscounts(data);
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error cargando descuentos.', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function openNew() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setModalOpen(true);
  }

  function openEdit(d: Discount) {
    setEditing(d);
    setForm({
      name: d.name,
      type: d.type,
      value: d.value === null ? '' : String(d.value),
    });
    setModalOpen(true);
  }

  async function save() {
    if (!form.name.trim()) {
      addToast('El nombre es obligatorio.', 'error');
      return;
    }
    let value: number | null = null;
    if (form.value.trim() !== '') {
      const v = Number(form.value);
      if (!Number.isFinite(v) || v <= 0) {
        addToast('El valor debe ser un número positivo o vacío.', 'error');
        return;
      }
      if (form.type === 'percent' && v > 100) {
        addToast('Un porcentaje no puede superar 100.', 'error');
        return;
      }
      value = v;
    }
    setSubmitting(true);
    try {
      await discountService.save({
        id: editing?.id,
        name: form.name.trim(),
        type: form.type,
        value,
      });
      await refresh();
      setModalOpen(false);
      addToast(editing ? 'Descuento actualizado.' : 'Descuento creado.', 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error guardando descuento.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await discountService.delete(deleting.id);
      await refresh();
      setDeleting(null);
      addToast('Descuento eliminado.', 'warning');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error eliminando.', 'error');
    }
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}>
      <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--br-bor)' }}>
        <div className="flex items-center gap-2">
          <Tag className="h-5 w-5" style={{ color: 'var(--br-amb)' }} />
          <h2 className="font-semibold" style={{ color: 'var(--br-txt)' }}>Descuentos</h2>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white"
          style={{ background: 'var(--br-amb)' }}
        >
          <Plus className="h-4 w-4" /> Nuevo descuento
        </button>
      </div>

      <div>
        {loading ? (
          <p className="text-sm py-8 text-center" style={{ color: 'var(--br-txt2)' }}>Cargando...</p>
        ) : discounts.length === 0 ? (
          <p className="text-sm py-8 text-center" style={{ color: 'var(--br-txt2)' }}>
            Sin descuentos configurados. El cajero no verá opciones en el POS hasta que crees al menos uno.
          </p>
        ) : (
          discounts.map(d => (
            <div key={d.id} className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--br-bor)' }}>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm" style={{ color: 'var(--br-txt)' }}>{d.name}</p>
                  <span className="font-mono text-sm font-semibold" style={{ color: 'var(--br-amb)' }}>
                    {d.value === null
                      ? (d.type === 'percent' ? '?% (a pedir)' : '$? (a pedir)')
                      : (d.type === 'percent' ? `${d.value}%` : `$${d.value}`)}
                  </span>
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--br-txt2)' }}>
                  {d.type === 'percent' ? 'Porcentaje sobre subtotal' : 'Monto fijo en pesos'}
                  {d.value === null && ' · el cajero ingresa el valor en cada venta'}
                </p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(d)} className="p-1.5 rounded" style={{ color: 'var(--br-txt2)' }}>
                  <Edit2 className="h-4 w-4" />
                </button>
                <button onClick={() => setDeleting(d)} className="p-1.5 rounded" style={{ color: 'var(--br-txt2)' }}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal open={modalOpen} onClose={() => !submitting && setModalOpen(false)} title={editing ? 'Editar descuento' : 'Nuevo descuento'} size="sm">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>Nombre</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ej: Promo 10%, Descuento manual"
              autoFocus
              disabled={submitting}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>Tipo</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as 'percent' | 'amount' })}
              disabled={submitting}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}
            >
              <option value="percent">Porcentaje (%)</option>
              <option value="amount">Monto fijo ($)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>
              Valor {form.type === 'percent' ? '(0–100)' : '($)'} — vacío = pedir en venta
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
              placeholder={form.type === 'percent' ? '10' : '500'}
              disabled={submitting}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={submitting}>Cancelar</Button>
          <Button variant="primary" onClick={save} loading={submitting}>Guardar</Button>
        </div>
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Eliminar descuento" size="sm">
        <p className="text-sm" style={{ color: 'var(--br-txt2)' }}>
          ¿Eliminar <strong>{deleting?.name}</strong>? No afecta recibos ya emitidos, sólo deja de aparecer en el POS.
        </p>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="secondary" onClick={() => setDeleting(null)}>Cancelar</Button>
          <Button variant="danger" onClick={confirmDelete}>Eliminar</Button>
        </div>
      </Modal>
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import type { Tax } from '@/types';
import { taxService } from '@/services/taxService';
import { Modal } from '@/components/ui/Modal';
import { Button, IconButton, SectionHeader } from '@/components/ui';
import { Plus, Edit2, Trash2, Percent } from 'lucide-react';

interface Props {
  addToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

interface FormState {
  name: string;
  rate: number;
  inclusion: 'included' | 'added';
  applyToNewTires: boolean;
}

const EMPTY_FORM: FormState = { name: '', rate: 21, inclusion: 'included', applyToNewTires: true };

export function TaxesSection({ addToast }: Props) {
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Tax | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<Tax | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await taxService.getAll();
      setTaxes(data);
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error cargando impuestos.', 'error');
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

  function openEdit(tax: Tax) {
    setEditing(tax);
    setForm({
      name: tax.name,
      rate: tax.rate,
      inclusion: tax.inclusion,
      applyToNewTires: tax.applyToNewTires,
    });
    setModalOpen(true);
  }

  async function save() {
    if (!form.name.trim()) {
      addToast('El nombre es obligatorio.', 'error');
      return;
    }
    if (form.rate < 0 || form.rate > 100) {
      addToast('La tasa debe estar entre 0 y 100.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await taxService.save({
        id: editing?.id,
        name: form.name,
        rate: form.rate,
        inclusion: form.inclusion,
        applyToNewTires: form.applyToNewTires,
      });
      await refresh();
      setModalOpen(false);
      addToast(editing ? 'Impuesto actualizado.' : 'Impuesto creado.', 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error guardando impuesto.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await taxService.delete(deleting.id);
      await refresh();
      setDeleting(null);
      addToast('Impuesto eliminado.', 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error eliminando.', 'error');
    }
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}>
      <SectionHeader
        icon={<Percent className="h-5 w-5" />}
        title="Impuestos"
        action={
          <Button variant="primary" size="sm" iconLeft={<Plus className="h-4 w-4" />} onClick={openNew}>
            Nuevo impuesto
          </Button>
        }
      />

      <div>
        {loading ? (
          <p className="text-sm py-8 text-center" style={{ color: 'var(--br-txt2)' }}>Cargando...</p>
        ) : taxes.length === 0 ? (
          <p className="text-sm py-8 text-center" style={{ color: 'var(--br-txt2)' }}>
            No hay impuestos configurados. Creá al menos uno (ej: IVA 21%).
          </p>
        ) : (
          taxes.map(t => (
            <div key={t.id} className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--br-bor)' }}>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm" style={{ color: 'var(--br-txt)' }}>{t.name}</p>
                  <span className="font-mono text-sm font-semibold" style={{ color: 'var(--br-amb)' }}>{t.rate}%</span>
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--br-txt2)' }}>
                  {t.inclusion === 'included' ? 'Incluido en el precio' : 'Agregado al precio'}
                  {t.applyToNewTires && ' · Aplicado por defecto a neumáticos nuevos'}
                </p>
              </div>
              <div className="flex gap-2">
                <IconButton label={`Editar ${t.name}`} icon={<Edit2 className="h-4 w-4" />} tone="neutral" size="sm" bordered={false} onClick={() => openEdit(t)} />
                <IconButton label={`Eliminar ${t.name}`} icon={<Trash2 className="h-4 w-4" />} tone="danger" size="sm" bordered={false} onClick={() => setDeleting(t)} />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Form modal */}
      <Modal open={modalOpen} onClose={() => !submitting && setModalOpen(false)} title={editing ? 'Editar impuesto' : 'Nuevo impuesto'} size="sm">
        <div className="space-y-3">
          <div>
            <label htmlFor="tax-name" className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>Nombre</label>
            <input
              id="tax-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="IVA 21%"
              autoFocus
              disabled={submitting}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--br-amb)]"
              style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}
            />
          </div>
          <div>
            <label htmlFor="tax-rate" className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>Tasa (%)</label>
            <input
              id="tax-rate"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={form.rate}
              onChange={(e) => setForm({ ...form, rate: Number(e.target.value) })}
              disabled={submitting}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--br-amb)]"
              style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}
            />
          </div>
          <div>
            <label htmlFor="tax-inclusion" className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>Inclusión</label>
            <select
              id="tax-inclusion"
              value={form.inclusion}
              onChange={(e) => setForm({ ...form, inclusion: e.target.value as 'included' | 'added' })}
              disabled={submitting}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--br-amb)]"
              style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}
            >
              <option value="included">Incluido en el precio (precio = neto + impuesto)</option>
              <option value="added">Agregado al precio (precio + impuesto)</option>
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.applyToNewTires}
              onChange={(e) => setForm({ ...form, applyToNewTires: e.target.checked })}
              disabled={submitting}
            />
            <span className="text-sm" style={{ color: 'var(--br-txt)' }}>Aplicar por defecto a neumáticos nuevos</span>
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={submitting}>Cancelar</Button>
          <Button variant="primary" onClick={save} loading={submitting}>Guardar</Button>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Eliminar impuesto" size="sm">
        <p className="text-sm" style={{ color: 'var(--br-txt2)' }}>
          ¿Eliminar <strong>{deleting?.name}</strong>? Los neumáticos que lo tengan asignado dejarán de calcularlo en sus recibos.
        </p>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="secondary" onClick={() => setDeleting(null)}>Cancelar</Button>
          <Button variant="danger" onClick={confirmDelete}>Eliminar</Button>
        </div>
      </Modal>
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import type { Salesperson } from '@/types';
import { salespersonService } from '@/services/salespersonService';
import { Modal } from '@/components/ui/Modal';
import { Button, IconButton, SectionHeader } from '@/components/ui';
import { Plus, Edit2, Trash2, UserCog } from 'lucide-react';

interface Props {
  addToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  storeId?: string | null;
}

interface FormState {
  name: string;
  cuit: string;
  email: string;
  phone: string;
  defaultCommissionPct: number;
  active: boolean;
}

const EMPTY_FORM: FormState = { name: '', cuit: '', email: '', phone: '', defaultCommissionPct: 0, active: true };

/**
 * CRUD básico de vendedores. La comisión se asigna al receipt al confirmar la
 * venta (POSView) — esta sección define el catálogo y la comisión default.
 * Coordinado con migration 0022 (RLS scope por store_id).
 */
export function SalespeopleSection({ addToast, storeId }: Props) {
  const [rows, setRows] = useState<Salesperson[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Salesperson | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<Salesperson | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await salespersonService.getAll({ storeId: storeId ?? undefined });
      setRows(data);
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error cargando vendedores.', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast, storeId]);

  useEffect(() => { void refresh(); }, [refresh]);

  function openNew() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setModalOpen(true);
  }

  function openEdit(s: Salesperson) {
    setEditing(s);
    setForm({
      name: s.name,
      cuit: s.cuit ?? '',
      email: s.email ?? '',
      phone: s.phone ?? '',
      defaultCommissionPct: s.defaultCommissionPct,
      active: s.active,
    });
    setModalOpen(true);
  }

  async function save() {
    if (!form.name.trim()) {
      addToast('El nombre es obligatorio.', 'error');
      return;
    }
    if (form.defaultCommissionPct < 0 || form.defaultCommissionPct > 100) {
      addToast('La comisión debe estar entre 0 y 100.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await salespersonService.save({
        id: editing?.id,
        storeId: storeId ?? undefined,
        name: form.name.trim(),
        cuit: form.cuit.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        defaultCommissionPct: form.defaultCommissionPct,
        active: form.active,
      });
      await refresh();
      setModalOpen(false);
      addToast(editing ? 'Vendedor actualizado.' : 'Vendedor creado.', 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error guardando vendedor.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await salespersonService.delete(deleting.id);
      await refresh();
      setDeleting(null);
      addToast('Vendedor eliminado.', 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error eliminando.', 'error');
    }
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}>
      <SectionHeader
        icon={<UserCog className="h-5 w-5" />}
        title="Vendedores"
        action={
          <Button variant="primary" size="sm" iconLeft={<Plus className="h-4 w-4" />} onClick={openNew}>
            Nuevo vendedor
          </Button>
        }
      />

      <div>
        {loading ? (
          <p className="text-sm py-8 text-center" style={{ color: 'var(--br-txt2)' }}>Cargando...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm py-8 text-center" style={{ color: 'var(--br-txt2)' }}>
            Sin vendedores cargados. El campo es opcional en cada venta.
          </p>
        ) : (
          rows.map(s => (
            <div key={s.id} className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--br-bor)' }}>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm" style={{ color: 'var(--br-txt)' }}>{s.name}</p>
                  <span className="font-mono text-xs font-semibold" style={{ color: 'var(--br-amb)' }}>
                    {s.defaultCommissionPct}%
                  </span>
                  {!s.active && <span className="text-xs" style={{ color: 'var(--br-txt2)' }}>(inactivo)</span>}
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--br-txt2)' }}>
                  {[s.cuit, s.phone, s.email].filter(Boolean).join(' · ') || 'sin contacto'}
                </p>
              </div>
              <div className="flex gap-2">
                <IconButton label={`Editar ${s.name}`} icon={<Edit2 className="h-4 w-4" />} tone="neutral" size="sm" bordered={false} onClick={() => openEdit(s)} />
                <IconButton label={`Eliminar ${s.name}`} icon={<Trash2 className="h-4 w-4" />} tone="danger" size="sm" bordered={false} onClick={() => setDeleting(s)} />
              </div>
            </div>
          ))
        )}
      </div>

      <Modal open={modalOpen} onClose={() => !submitting && setModalOpen(false)} title={editing ? 'Editar vendedor' : 'Nuevo vendedor'} size="sm">
        <div className="space-y-3">
          <div>
            <label htmlFor="salesperson-name" className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>Nombre *</label>
            <input
              id="salesperson-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Juan Pérez"
              autoFocus
              disabled={submitting}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--br-amb)]"
              style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="salesperson-cuit" className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>CUIT</label>
              <input
                id="salesperson-cuit"
                type="text"
                value={form.cuit}
                onChange={(e) => setForm({ ...form, cuit: e.target.value })}
                disabled={submitting}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--br-amb)]"
                style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}
              />
            </div>
            <div>
              <label htmlFor="salesperson-commission" className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>Comisión %</label>
              <input
                id="salesperson-commission"
                type="number"
                min={0}
                max={100}
                step="0.5"
                value={form.defaultCommissionPct}
                onChange={(e) => setForm({ ...form, defaultCommissionPct: Number(e.target.value) })}
                disabled={submitting}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--br-amb)]"
                style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="salesperson-email" className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>Email</label>
              <input
                id="salesperson-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                disabled={submitting}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--br-amb)]"
                style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}
              />
            </div>
            <div>
              <label htmlFor="salesperson-phone" className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>Teléfono</label>
              <input
                id="salesperson-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                disabled={submitting}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--br-amb)]"
                style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              disabled={submitting}
            />
            <span className="text-sm" style={{ color: 'var(--br-txt)' }}>Activo</span>
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={submitting}>Cancelar</Button>
          <Button variant="primary" onClick={save} loading={submitting}>Guardar</Button>
        </div>
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Eliminar vendedor" size="sm">
        <p className="text-sm" style={{ color: 'var(--br-txt2)' }}>
          ¿Eliminar <strong>{deleting?.name}</strong>? Las ventas históricas con este vendedor mantendrán el registro,
          pero ya no aparecerá como opción en nuevas ventas.
        </p>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="secondary" onClick={() => setDeleting(null)}>Cancelar</Button>
          <Button variant="danger" onClick={confirmDelete}>Eliminar</Button>
        </div>
      </Modal>
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import type { InsuranceCompany } from '@/types';
import { insuranceCompanyService } from '@/services/insuranceCompanyService';
import { Modal } from '@/components/ui/Modal';
import { Button, IconButton } from '@/components/ui';
import { Plus, Edit2, Trash2, ShieldCheck } from 'lucide-react';

interface Props {
  addToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

interface FormState {
  name: string;
  cuit: string;
  contactName: string;
  phone: string;
  email: string;
  active: boolean;
}

const EMPTY_FORM: FormState = { name: '', cuit: '', contactName: '', phone: '', email: '', active: true };

/**
 * CRUD de aseguradoras (Allianz, San Cristóbal, etc.). El saldo en cuenta
 * (account_balance) se mantiene por trigger en insurance_company_movements
 * (migration 0021). Se muestra read-only.
 */
export function InsuranceCompaniesSection({ addToast }: Props) {
  const [rows, setRows] = useState<InsuranceCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<InsuranceCompany | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<InsuranceCompany | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await insuranceCompanyService.getAll();
      setRows(data);
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error cargando aseguradoras.', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { void refresh(); }, [refresh]);

  function openNew() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setModalOpen(true);
  }

  function openEdit(c: InsuranceCompany) {
    setEditing(c);
    setForm({
      name: c.name,
      cuit: c.cuit ?? '',
      contactName: c.contactName ?? '',
      phone: c.phone ?? '',
      email: c.email ?? '',
      active: c.active,
    });
    setModalOpen(true);
  }

  async function save() {
    if (!form.name.trim()) {
      addToast('El nombre es obligatorio.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await insuranceCompanyService.save({
        id: editing?.id,
        name: form.name.trim(),
        cuit: form.cuit.trim() || undefined,
        contactName: form.contactName.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        accountBalance: editing?.accountBalance ?? 0,
        active: form.active,
      });
      await refresh();
      setModalOpen(false);
      addToast(editing ? 'Aseguradora actualizada.' : 'Aseguradora creada.', 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error guardando aseguradora.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await insuranceCompanyService.delete(deleting.id);
      await refresh();
      setDeleting(null);
      addToast('Aseguradora eliminada.', 'warning');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error eliminando.', 'error');
    }
  }

  function formatMoney(n: number): string {
    return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}>
      <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--br-bor)' }}>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" style={{ color: 'var(--br-amb)' }} />
          <h2 className="font-semibold" style={{ color: 'var(--br-txt)' }}>Aseguradoras</h2>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white"
          style={{ background: 'var(--br-amb)' }}
        >
          <Plus className="h-4 w-4" /> Nueva aseguradora
        </button>
      </div>

      <div>
        {loading ? (
          <p className="text-sm py-8 text-center" style={{ color: 'var(--br-txt2)' }}>Cargando...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm py-8 text-center" style={{ color: 'var(--br-txt2)' }}>
            Sin aseguradoras cargadas. Agregá las cías con las que trabajás (Allianz, San Cristóbal, etc.).
          </p>
        ) : (
          rows.map(c => (
            <div key={c.id} className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--br-bor)' }}>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm" style={{ color: 'var(--br-txt)' }}>{c.name}</p>
                  {!c.active && <span className="text-xs" style={{ color: 'var(--br-txt2)' }}>(inactiva)</span>}
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--br-txt2)' }}>
                  {[c.cuit, c.contactName, c.phone].filter(Boolean).join(' · ') || 'sin contacto'}
                </p>
              </div>
              <div className="text-right mr-3">
                <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--br-txt2)' }}>Saldo</p>
                <p className="font-mono text-sm font-semibold" style={{ color: c.accountBalance > 0 ? 'var(--br-red)' : 'var(--br-txt)' }}>
                  {formatMoney(c.accountBalance)}
                </p>
              </div>
              <div className="flex gap-2">
                <IconButton label={`Editar ${c.name}`} icon={<Edit2 className="h-4 w-4" />} tone="neutral" size="sm" bordered={false} onClick={() => openEdit(c)} />
                <IconButton label={`Eliminar ${c.name}`} icon={<Trash2 className="h-4 w-4" />} tone="danger" size="sm" bordered={false} onClick={() => setDeleting(c)} />
              </div>
            </div>
          ))
        )}
      </div>

      <Modal open={modalOpen} onClose={() => !submitting && setModalOpen(false)} title={editing ? 'Editar aseguradora' : 'Nueva aseguradora'} size="sm">
        <div className="space-y-3">
          <div>
            <label htmlFor="insurance-name" className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>Nombre *</label>
            <input
              id="insurance-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="San Cristóbal Seguros"
              autoFocus
              disabled={submitting}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--br-amb)]"
              style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="insurance-cuit" className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>CUIT</label>
              <input
                id="insurance-cuit"
                type="text"
                value={form.cuit}
                onChange={(e) => setForm({ ...form, cuit: e.target.value })}
                disabled={submitting}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--br-amb)]"
                style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}
              />
            </div>
            <div>
              <label htmlFor="insurance-contact" className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>Contacto</label>
              <input
                id="insurance-contact"
                type="text"
                value={form.contactName}
                onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                disabled={submitting}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--br-amb)]"
                style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="insurance-phone" className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>Teléfono</label>
              <input
                id="insurance-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                disabled={submitting}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--br-amb)]"
                style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}
              />
            </div>
            <div>
              <label htmlFor="insurance-email" className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>Email</label>
              <input
                id="insurance-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
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
            <span className="text-sm" style={{ color: 'var(--br-txt)' }}>Activa</span>
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={submitting}>Cancelar</Button>
          <Button variant="primary" onClick={save} loading={submitting}>Guardar</Button>
        </div>
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Eliminar aseguradora" size="sm">
        <p className="text-sm" style={{ color: 'var(--br-txt2)' }}>
          ¿Eliminar <strong>{deleting?.name}</strong>? Las pólizas asociadas perderán la referencia.
          {(deleting?.accountBalance ?? 0) !== 0 && (
            <span className="block mt-2 font-semibold" style={{ color: 'var(--br-red)' }}>
              ⚠ Saldo en cuenta: {deleting && formatMoney(deleting.accountBalance)}
            </span>
          )}
        </p>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="secondary" onClick={() => setDeleting(null)}>Cancelar</Button>
          <Button variant="danger" onClick={confirmDelete}>Eliminar</Button>
        </div>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// EmployeesSection — CRUD de empleados (Fase 2)
// Solo visible para usuarios con permission `employees.manage`.
// No permite borrar (integridad referencial con receipts/cash_sessions).
// ═══════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react';
import type { Employee, Role, Store } from '@/types';
import { employeeService } from '@/services/employeeService';
import { roleService } from '@/services/roleService';
import { storeService } from '@/services/storeService';
import { hashPin } from '@/utils/hash';
import { Modal } from '@/components/ui/Modal';
import { Button, IconButton, SectionHeader } from '@/components/ui';
import { UserPlus, Edit2, Users, Power, KeyRound } from 'lucide-react';

interface Props {
  addToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

interface FormState {
  name: string;
  email: string;
  phone: string;
  roleId: string;
  /** null = todas las tiendas; array vacío en UI = aún no eligió ninguna específica */
  storeIds: string[] | null;
  pin: string;
  pinConfirm: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  email: '',
  phone: '',
  roleId: '',
  storeIds: null,
  pin: '',
  pinConfirm: '',
};

const PIN_REGEX = /^\d{4,8}$/;

export function EmployeesSection({ addToast }: Props) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [emps, rs, st] = await Promise.all([
        employeeService.getAll(),
        roleService.getAll(),
        storeService.getAll(),
      ]);
      setEmployees(emps);
      setRoles(rs);
      setStores(st);
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error cargando empleados.', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function openNew() {
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      roleId: roles.find(r => r.name === 'Cajero')?.id ?? roles[0]?.id ?? '',
    });
    setModalOpen(true);
  }

  function openEdit(emp: Employee) {
    setEditing(emp);
    setForm({
      name: emp.name,
      email: emp.email ?? '',
      phone: emp.phone ?? '',
      roleId: emp.roleId,
      storeIds: emp.storeIds,
      pin: '',
      pinConfirm: '',
    });
    setModalOpen(true);
  }

  function toggleStore(id: string) {
    setForm(prev => {
      const cur = prev.storeIds ?? [];
      const next = cur.includes(id) ? cur.filter(s => s !== id) : [...cur, id];
      return { ...prev, storeIds: next };
    });
  }

  function setAllStores() {
    setForm(prev => ({ ...prev, storeIds: null }));
  }

  function setSpecificStores() {
    setForm(prev => ({ ...prev, storeIds: prev.storeIds ?? [] }));
  }

  async function save() {
    if (!form.name.trim()) {
      addToast('El nombre es obligatorio.', 'error');
      return;
    }
    if (!form.roleId) {
      addToast('Seleccioná un rol.', 'error');
      return;
    }
    if (form.storeIds !== null && form.storeIds.length === 0) {
      addToast('Elegí al menos una tienda o marcá "Todas".', 'error');
      return;
    }
    const isNew = !editing;
    const wantsPinChange = isNew || form.pin.length > 0;
    if (wantsPinChange) {
      if (!PIN_REGEX.test(form.pin)) {
        addToast('El PIN debe ser numérico de 4 a 8 dígitos.', 'error');
        return;
      }
      if (form.pin !== form.pinConfirm) {
        addToast('Los PIN no coinciden.', 'error');
        return;
      }
    }

    setSubmitting(true);
    try {
      // wantsPinChange === false implica editing !== null (es la única rama
      // donde se permite no enviar PIN), por eso este fallback es seguro.
      const existingHash = editing?.pinHash ?? '';
      const pinHash = wantsPinChange ? await hashPin(form.pin) : existingHash;
      await employeeService.save({
        id: editing?.id,
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        roleId: form.roleId,
        storeIds: form.storeIds,
        pinHash,
        active: editing?.active ?? true,
      });
      await refresh();
      setModalOpen(false);
      addToast(isNew ? 'Empleado creado.' : 'Empleado actualizado.', 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error guardando empleado.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(emp: Employee) {
    try {
      await employeeService.setActive(emp.id, !emp.active);
      addToast(emp.active ? `${emp.name} desactivado.` : `${emp.name} activado.`, 'success');
      await refresh();
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error cambiando estado.', 'error');
    }
  }

  const roleById = (id: string) => roles.find(r => r.id === id);
  const storeName = (id: string) => stores.find(s => s.id === id)?.name ?? id;

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}>
      <SectionHeader
        icon={<Users className="h-5 w-5" />}
        title="Empleados"
        action={
          <Button variant="primary" size="sm" iconLeft={<UserPlus className="h-4 w-4" />} onClick={openNew}>
            Nuevo empleado
          </Button>
        }
      />

      <div>
        {loading ? (
          <p className="text-sm py-8 text-center" style={{ color: 'var(--br-txt2)' }}>Cargando...</p>
        ) : employees.length === 0 ? (
          <p className="text-sm py-8 text-center" style={{ color: 'var(--br-txt2)' }}>
            No hay empleados. Creá al menos uno para que pueda operar el TPV.
          </p>
        ) : (
          employees.map(emp => {
            const role = roleById(emp.roleId);
            return (
              <div key={emp.id} className="px-5 py-3 flex items-center justify-between gap-3" style={{ borderBottom: '1px solid var(--br-bor)' }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm" style={{ color: emp.active ? 'var(--br-txt)' : 'var(--br-txt2)' }}>
                      {emp.name}
                    </p>
                    {role && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'var(--br-amb-bg)', color: 'var(--br-amb)' }}>
                        {role.name}
                      </span>
                    )}
                    {!emp.active && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'var(--br-red-bg)', color: 'var(--br-red)' }}>
                        Inactivo
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--br-txt2)' }}>
                    {emp.email && <span>{emp.email} · </span>}
                    {emp.storeIds === null
                      ? 'Todas las tiendas'
                      : emp.storeIds.length === 0
                        ? 'Sin tiendas'
                        : emp.storeIds.map(storeName).join(', ')}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <IconButton
                    label={`Editar ${emp.name}`}
                    icon={<Edit2 className="h-4 w-4" />}
                    tone="neutral"
                    size="sm"
                    bordered={false}
                    onClick={() => openEdit(emp)}
                  />
                  <IconButton
                    label={emp.active ? `Desactivar ${emp.name}` : `Activar ${emp.name}`}
                    icon={<Power className="h-4 w-4" />}
                    tone={emp.active ? 'danger' : 'success'}
                    size="sm"
                    bordered={false}
                    onClick={() => toggleActive(emp)}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Form modal */}
      <Modal
        open={modalOpen}
        onClose={() => !submitting && setModalOpen(false)}
        title={editing ? `Editar empleado: ${editing.name}` : 'Nuevo empleado'}
        size="sm"
      >
        <div className="space-y-3">
          <div>
            <label htmlFor="employee-name" className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>Nombre *</label>
            <input
              id="employee-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus
              disabled={submitting}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--br-amb)]"
              style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="employee-email" className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>Email</label>
              <input
                id="employee-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                disabled={submitting}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--br-amb)]"
                style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}
              />
            </div>
            <div>
              <label htmlFor="employee-phone" className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>Teléfono</label>
              <input
                id="employee-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                disabled={submitting}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--br-amb)]"
                style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}
              />
            </div>
          </div>

          <div>
            <label htmlFor="employee-role" className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>Rol *</label>
            <select
              id="employee-role"
              value={form.roleId}
              onChange={(e) => setForm({ ...form, roleId: e.target.value })}
              disabled={submitting}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--br-amb)]"
              style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}
            >
              <option value="">Seleccionar rol...</option>
              {roles.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            {form.roleId && (
              <p className="text-xs mt-1" style={{ color: 'var(--br-txt2)' }}>
                {roleById(form.roleId)?.permissions.length ?? 0} permisos asignados.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>Tiendas</label>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={setAllStores}
                disabled={submitting}
                className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                style={{
                  background: form.storeIds === null ? 'var(--br-amb)' : 'var(--br-sur2)',
                  color: form.storeIds === null ? 'var(--br-sur)' : 'var(--br-txt2)',
                  border: '1px solid var(--br-bor)',
                }}
              >
                Todas
              </button>
              <button
                type="button"
                onClick={setSpecificStores}
                disabled={submitting}
                className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                style={{
                  background: form.storeIds !== null ? 'var(--br-amb)' : 'var(--br-sur2)',
                  color: form.storeIds !== null ? 'var(--br-sur)' : 'var(--br-txt2)',
                  border: '1px solid var(--br-bor)',
                }}
              >
                Específicas
              </button>
            </div>
            {form.storeIds !== null && (
              <div className="space-y-1.5 max-h-40 overflow-y-auto rounded-lg p-2" style={{ border: '1px solid var(--br-bor)' }}>
                {stores.length === 0 ? (
                  <p className="text-xs" style={{ color: 'var(--br-txt2)' }}>No hay tiendas creadas.</p>
                ) : (
                  stores.map(s => (
                    <label key={s.id} className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: 'var(--br-txt)' }}>
                      <input
                        type="checkbox"
                        checked={form.storeIds?.includes(s.id) ?? false}
                        onChange={() => toggleStore(s.id)}
                        disabled={submitting}
                      />
                      <span>{s.name}</span>
                      {!s.active && <span className="text-xs" style={{ color: 'var(--br-txt2)' }}>(inactiva)</span>}
                    </label>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="rounded-lg p-3" style={{ background: 'var(--br-sur2)', border: '1px solid var(--br-bor)' }}>
            <div className="flex items-center gap-2 mb-2">
              <KeyRound className="h-4 w-4" style={{ color: 'var(--br-amb)' }} />
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--br-txt2)' }}>
                {editing ? 'Cambiar PIN (opcional)' : 'PIN *'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                id="employee-pin"
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={form.pin}
                onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })}
                placeholder={editing ? 'Dejar vacío' : 'PIN (4-8 dígitos)'}
                aria-label="PIN del empleado"
                autoComplete="new-password"
                disabled={submitting}
                className="px-3 py-2 rounded-lg text-sm outline-none text-center tracking-widest focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--br-amb)]"
                style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}
              />
              <input
                id="employee-pin-confirm"
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={form.pinConfirm}
                onChange={(e) => setForm({ ...form, pinConfirm: e.target.value.replace(/\D/g, '') })}
                placeholder="Confirmar PIN"
                aria-label="Confirmar PIN del empleado"
                autoComplete="new-password"
                disabled={submitting}
                className="px-3 py-2 rounded-lg text-sm outline-none text-center tracking-widest focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--br-amb)]"
                style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}
              />
            </div>
            <p className="text-xs mt-1.5" style={{ color: 'var(--br-txt2)' }}>
              El PIN se usa para identificar al operador del TPV (no es la contraseña web).
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={save} loading={submitting} disabled={submitting}>
            Guardar
          </Button>
        </div>
      </Modal>
    </div>
  );
}

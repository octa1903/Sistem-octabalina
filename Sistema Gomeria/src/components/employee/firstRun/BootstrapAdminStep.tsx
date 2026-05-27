import { useEffect, useState } from 'react';
import type { Role } from '@/types';
import { roleService } from '@/services/roleService';
import { employeeService } from '@/services/employeeService';
import { hashPin } from '@/utils/hash';
import { Button, FormField, Input } from '@/components/ui';
import { UserPlus, AlertCircle } from 'lucide-react';

interface Props {
  /** Llamado tras crear el admin (con su id). El wizard avanza/cierra. */
  onCreated: (employeeId: string) => void;
  addToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

const PIN_REGEX = /^\d{4,8}$/;

/**
 * Paso del wizard que crea el primer empleado con permisos de administración
 * (rol Propietario o Administrador, el primero que se encuentre por orden).
 *
 * Se renderiza únicamente cuando `needsAdminBootstrap(storeId)` devolvió true.
 * Sin este paso, el usuario quedaría bloqueado por el EmployeeSelector sin
 * forma de crear su propio operador.
 */
export function BootstrapAdminStep({ onCreated, addToast }: Props) {
  const [adminRole, setAdminRole] = useState<Role | null>(null);
  const [loadingRole, setLoadingRole] = useState(true);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    roleService
      .getAll()
      .then((roles) => {
        if (!active) return;
        // Preferir Propietario; fallback Administrador; fallback cualquier rol con settings.manage
        const candidate =
          roles.find((r) => r.name === 'Propietario') ??
          roles.find((r) => r.name === 'Administrador') ??
          roles.find((r) => r.permissions.includes('settings.manage'));
        setAdminRole(candidate ?? null);
      })
      .catch((e: unknown) => {
        if (!active) return;
        addToast(e instanceof Error ? e.message : 'Error cargando roles.', 'error');
      })
      .finally(() => active && setLoadingRole(false));
    return () => {
      active = false;
    };
  }, [addToast]);

  function validate(): string | null {
    if (!name.trim()) return 'Nombre es requerido.';
    if (!PIN_REGEX.test(pin)) return 'PIN debe ser 4–8 dígitos.';
    if (pin !== pinConfirm) return 'Los PINs no coinciden.';
    if (!adminRole) return 'No se encontró rol con permiso settings.manage.';
    return null;
  }

  async function submit() {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    if (!adminRole) return;
    setSubmitting(true);
    setError(null);
    try {
      const hash = await hashPin(pin);
      const emp = await employeeService.save({
        name: name.trim(),
        roleId: adminRole.id,
        pinHash: hash,
        // null storeIds = acceso a todas las tiendas (típico para Propietario)
        storeIds: null,
        active: true,
      });
      addToast(`Operador "${emp.name}" creado.`, 'success');
      onCreated(emp.id);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error creando operador.';
      setError(msg);
      addToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--br-amb-bg)', color: 'var(--br-amb)' }}
        >
          <UserPlus className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--br-txt)' }}>
            Creá el primer operador con permisos de administración
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--br-txt2)' }}>
            Sin este operador no podés entrar a Configuración. Después podrás crear cajeros adicionales desde
            Configuración → Empleados.
            {adminRole && (
              <>
                {' '}
                Rol asignado: <strong>{adminRole.name}</strong>.
              </>
            )}
          </p>
        </div>
      </div>

      <FormField label="Nombre del operador" required>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Octavio" autoFocus />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="PIN (4–8 dígitos)" required>
          <Input
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder="••••"
          />
        </FormField>
        <FormField label="Repetir PIN" required>
          <Input
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={pinConfirm}
            onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ''))}
            placeholder="••••"
          />
        </FormField>
      </div>

      {error && (
        <div
          role="alert"
          className="text-sm rounded-lg px-3 py-2 flex items-center gap-2"
          style={{ background: 'var(--br-red-bg)', color: 'var(--br-red)', border: '1px solid var(--br-red-bor)' }}
        >
          <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button
          variant="primary"
          loading={submitting}
          disabled={loadingRole || !adminRole}
          onClick={() => {
            void submit();
          }}
        >
          Crear operador
        </Button>
      </div>
    </div>
  );
}

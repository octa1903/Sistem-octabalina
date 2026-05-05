// ═══════════════════════════════════════════════════
// useCurrentEmployee — operador del TPV
// El "current employee" es el empleado que está OPERANDO el TPV
// (cajero/gerente/dueño identificado por PIN). Es DISTINTO de
// `auth.employeeId`, que es el dueño/admin que abrió la sesión Supabase
// en el navegador. En una sucursal con un único TPV, varios cajeros
// pueden rotar el operador a lo largo del día sin re-loguear web.
// ═══════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react';
import { storageGet, storageSet } from '@/utils/storage';
import { verifyPin } from '@/utils/hash';
import { employeeService, type EmployeeWithRole } from '@/services/employeeService';

const STORAGE_KEY = 'pos_current_employee';
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 min de inactividad

interface PersistedSession {
  employeeId: string;
  expiresAt: number;
}

interface State {
  employee: EmployeeWithRole | null;
  loading: boolean;
  error: string | null;
}

const INITIAL: State = { employee: null, loading: true, error: null };

export function useCurrentEmployee() {
  const [state, setState] = useState<State>(INITIAL);
  const expiryRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const clear = useCallback(() => {
    storageSet<PersistedSession | null>(STORAGE_KEY, null);
    setState({ employee: null, loading: false, error: null });
  }, []);

  const armExpiry = useCallback((expiresAt: number) => {
    if (expiryRef.current) clearTimeout(expiryRef.current);
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) { clear(); return; }
    expiryRef.current = setTimeout(() => clear(), remaining);
  }, [clear]);

  // Hidratar al montar
  useEffect(() => {
    const saved = storageGet<PersistedSession | null>(STORAGE_KEY, null);
    if (!saved || saved.expiresAt <= Date.now()) {
      storageSet<PersistedSession | null>(STORAGE_KEY, null);
      setState({ employee: null, loading: false, error: null });
      return;
    }
    let active = true;
    employeeService
      .getWithRole(saved.employeeId)
      .then((emp) => {
        if (!active) return;
        if (!emp || !emp.active) {
          storageSet<PersistedSession | null>(STORAGE_KEY, null);
          setState({ employee: null, loading: false, error: null });
          return;
        }
        setState({ employee: emp, loading: false, error: null });
        armExpiry(saved.expiresAt);
      })
      .catch((e) => {
        if (!active) return;
        setState({ employee: null, loading: false, error: e instanceof Error ? e.message : 'Error' });
      });
    return () => {
      active = false;
      if (expiryRef.current) clearTimeout(expiryRef.current);
    };
  }, [armExpiry]);

  /** Valida PIN contra `employees.pin_hash` y, si coincide, abre sesión de operador. */
  const loginWithPin = useCallback(
    async (employeeId: string, pin: string): Promise<{ ok: true } | { ok: false; reason: string }> => {
      // Mensaje genérico para evitar enumeración (no revelar si el empleado
      // existe / está activo / tiene PIN antes de verificar el PIN ingresado).
      const GENERIC = 'Credenciales incorrectas.';
      try {
        const emp = await employeeService.getWithRole(employeeId);
        if (!emp || !emp.active || !emp.pinHash) return { ok: false, reason: GENERIC };
        const valid = await verifyPin(pin, emp.pinHash);
        if (!valid) return { ok: false, reason: GENERIC };
        const expiresAt = Date.now() + SESSION_TIMEOUT;
        storageSet<PersistedSession>(STORAGE_KEY, { employeeId: emp.id, expiresAt });
        setState({ employee: emp, loading: false, error: null });
        armExpiry(expiresAt);
        return { ok: true };
      } catch (e) {
        return { ok: false, reason: e instanceof Error ? e.message : 'Error consultando empleado.' };
      }
    },
    [armExpiry],
  );

  const logout = useCallback(() => clear(), [clear]);

  /** Reset del timeout (llamar tras una venta/acción para extender sesión). */
  const touch = useCallback(() => {
    if (!state.employee) return;
    const expiresAt = Date.now() + SESSION_TIMEOUT;
    storageSet<PersistedSession>(STORAGE_KEY, { employeeId: state.employee.id, expiresAt });
    armExpiry(expiresAt);
  }, [state.employee, armExpiry]);

  return {
    employee: state.employee,
    loading: state.loading,
    error: state.error,
    loginWithPin,
    logout,
    touch,
  };
}

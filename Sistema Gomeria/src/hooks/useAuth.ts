// ═══════════════════════════════════════════════════
// Baliña Ruedas — Hook de autenticación
// Empleado: Supabase Auth (email + password) + lookup en tabla employees.
// Cliente: PIN contra customers en Supabase (PIN sigue local — Fase 6
//          migrará a Supabase Auth con magic link / OTP).
// ═══════════════════════════════════════════════════

import { useState, useCallback, useEffect, useRef } from 'react';
import type { SessionType } from '@/types';
import { sessionGet, sessionSet } from '@/utils/storage';
import {
  EMPLOYEE_TIMEOUT,
  MAX_LOGIN_ATTEMPTS,
  LOCKOUT_DURATION,
} from '@/constants';
import { supabase } from '@/services/supabaseClient';

interface AuthState {
  isAuthenticated: boolean;
  sessionType: SessionType;
  employeeId?: string;
  employeeName?: string;
  employeeRole?: string;
  clientId?: string;
  clientName?: string;
  // Token de sesión emitido por el RPC customer_login (sólo sessionType='client').
  clientToken?: string;
  expiresAt: number;
}

const INITIAL: AuthState = { isAuthenticated: false, sessionType: null, expiresAt: 0 };

async function loadEmployeeForUser(userId: string) {
  const { data, error } = await supabase
    .from('employees')
    .select('id, name, role:roles(name)')
    .eq('auth_user_id', userId)
    .eq('active', true)
    .maybeSingle();
  if (error) throw error;
  return data as { id: string; name: string; role: { name: string } | null } | null;
}

export function useAuth() {
  const [auth, setAuth] = useState<AuthState>(INITIAL);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Hidratar sesión al montar:
  // 1) si hay sesión activa de Supabase Auth → empleado
  // 2) si no, ver si hay sesión de cliente persistida en localStorage
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const emp = await loadEmployeeForUser(session.user.id);
          if (mounted && emp) {
            setAuth({
              isAuthenticated: true,
              sessionType: 'employee',
              employeeId: emp.id,
              employeeName: emp.name,
              employeeRole: emp.role?.name,
              expiresAt: Date.now() + EMPLOYEE_TIMEOUT,
            });
            return;
          }
          // Hay sesión Supabase pero no es un empleado activo → cerrar
          if (mounted) await supabase.auth.signOut();
        }

        // El token de cliente vive en sessionStorage: muere con la pestaña
        // para reducir blast-radius de XSS y cookies persistentes.
        const saved = sessionGet<AuthState | null>('auth_session', null);
        if (saved && saved.sessionType === 'client' && saved.expiresAt > Date.now()) {
          if (mounted) setAuth(saved);
        } else {
          sessionSet('auth_session', null);
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[useAuth] hydrate error', e);
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (!mounted) return;
      if (event === 'SIGNED_OUT') {
        setAuth(INITIAL);
        sessionSet('auth_session', null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Persistencia: sólo sesiones de cliente. Las de empleado las maneja Supabase.
  useEffect(() => {
    if (auth.isAuthenticated && auth.sessionType === 'client') {
      sessionSet('auth_session', auth);
    }
  }, [auth]);

  // Auto-logout por inactividad (timeout de UI, no toca Supabase Auth)
  useEffect(() => {
    if (auth.isAuthenticated && auth.expiresAt > 0) {
      const remaining = auth.expiresAt - Date.now();
      if (remaining <= 0) {
        void logout();
        return;
      }
      timeoutRef.current = setTimeout(() => void logout(), remaining);
      return () => clearTimeout(timeoutRef.current);
    }
  }, [auth.expiresAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const logout = useCallback(async () => {
    if (auth.sessionType === 'employee') {
      await supabase.auth.signOut();
    } else if (auth.sessionType === 'client' && auth.clientToken) {
      // Best-effort: invalidar el token server-side. Si falla, igual limpiamos local.
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.rpc as any)('customer_logout', { p_token: auth.clientToken });
      } catch {
        // ignored
      }
    }
    setAuth(INITIAL);
    sessionSet('auth_session', null);
    setError(null);
  }, [auth.sessionType, auth.clientToken]);

  const employeeLogin = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      setError(null);

      if (lockoutUntil > Date.now()) {
        const mins = Math.ceil((lockoutUntil - Date.now()) / 60000);
        setError(`Demasiados intentos. Espere ${mins} minuto(s).`);
        return false;
      }

      const { data, error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signInErr || !data.user) {
        const attempts = loginAttempts + 1;
        setLoginAttempts(attempts);
        if (attempts >= MAX_LOGIN_ATTEMPTS) {
          setLockoutUntil(Date.now() + LOCKOUT_DURATION);
          setError('Cuenta bloqueada por 15 minutos.');
        } else {
          setError(`Credenciales incorrectas. ${MAX_LOGIN_ATTEMPTS - attempts} intentos restantes.`);
        }
        return false;
      }

      let emp;
      try {
        emp = await loadEmployeeForUser(data.user.id);
      } catch (e) {
        await supabase.auth.signOut();
        setError(e instanceof Error ? e.message : 'Error verificando empleado.');
        return false;
      }

      if (!emp) {
        await supabase.auth.signOut();
        setError('Tu usuario no está vinculado a un empleado activo.');
        return false;
      }

      setLoginAttempts(0);
      setAuth({
        isAuthenticated: true,
        sessionType: 'employee',
        employeeId: emp.id,
        employeeName: emp.name,
        employeeRole: emp.role?.name,
        expiresAt: Date.now() + EMPLOYEE_TIMEOUT,
      });
      return true;
    },
    [loginAttempts, lockoutUntil],
  );

  const clientLoginInFlight = useRef(false);
  const clientLogin = useCallback(
    async (clientId: string, pin: string): Promise<boolean> => {
      if (clientLoginInFlight.current) return false;
      clientLoginInFlight.current = true;
      setError(null);
      try {
        // RPC SECURITY DEFINER: verifica PIN server-side (con lockout) y devuelve token.
        // Cast pragmático mientras database.ts no incluya las nuevas RPCs (regen pendiente).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error: rpcErr } = await (supabase.rpc as any)('customer_login', {
          p_customer_id: clientId,
          p_pin: pin,
        });
        if (rpcErr) {
          setError(rpcErr.message || 'Credenciales inválidas.');
          return false;
        }
        // El RPC devuelve un set; tomar la primera fila.
        const row = (Array.isArray(data) ? data[0] : data) as
          | { token: string; customer_id: string; customer_name: string; expires_at: string }
          | undefined;
        if (!row?.token) {
          setError('Credenciales inválidas.');
          return false;
        }
        const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : Date.now() + 24 * 60 * 60 * 1000;
        setAuth({
          isAuthenticated: true,
          sessionType: 'client',
          clientId: row.customer_id,
          clientName: row.customer_name,
          clientToken: row.token,
          expiresAt,
        });
        return true;
      } finally {
        clientLoginInFlight.current = false;
      }
    },
    [],
  );

  const changeEmployeePassword = useCallback(
    async (currentPassword: string, newPassword: string): Promise<boolean> => {
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        setError('No hay sesión activa.');
        return false;
      }
      const { error: verifyErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (verifyErr) {
        setError('Contraseña actual incorrecta.');
        return false;
      }
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updateErr) {
        setError(updateErr.message);
        return false;
      }
      return true;
    },
    [],
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    ...auth,
    error,
    loginAttempts,
    lockoutUntil,
    employeeLogin,
    clientLogin,
    logout,
    changeEmployeePassword,
    clearError,
    isLockedOut: lockoutUntil > Date.now(),
  };
}

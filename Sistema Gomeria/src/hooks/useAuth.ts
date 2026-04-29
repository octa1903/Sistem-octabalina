// ═══════════════════════════════════════════════════
// Baliña Ruedas — Hook de autenticación
// Empleado: Supabase Auth (email + password) + lookup en tabla employees.
// Cliente: PIN contra clientService legacy (localStorage). Migración del
//          login de cliente a Supabase queda para Fase 6 (portal cliente).
// ═══════════════════════════════════════════════════

import { useState, useCallback, useEffect, useRef } from 'react';
import type { SessionType } from '@/types';
import { storageGet, storageSet } from '@/utils/storage';
import { verifyPin } from '@/utils/hash';
import {
  EMPLOYEE_TIMEOUT,
  CLIENT_TIMEOUT,
  MAX_LOGIN_ATTEMPTS,
  LOCKOUT_DURATION,
} from '@/constants';
import { supabase } from '@/services/supabaseClient';
import { clientService } from '@/services/storageService';

interface AuthState {
  isAuthenticated: boolean;
  sessionType: SessionType;
  employeeId?: string;
  employeeName?: string;
  employeeRole?: string;
  clientId?: string;
  clientName?: string;
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

        const saved = storageGet<AuthState | null>('auth_session', null);
        if (saved && saved.sessionType === 'client' && saved.expiresAt > Date.now()) {
          if (mounted) setAuth(saved);
        } else {
          storageSet('auth_session', null);
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
        storageSet('auth_session', null);
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
      storageSet('auth_session', auth);
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
    }
    setAuth(INITIAL);
    storageSet('auth_session', null);
    setError(null);
  }, [auth.sessionType]);

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

  const clientLogin = useCallback(
    async (clientId: string, pin: string): Promise<boolean> => {
      setError(null);
      const client = clientService.getById(clientId);
      if (!client) {
        setError('Cliente no encontrado.');
        return false;
      }
      const valid = await verifyPin(pin, client.pinHash);
      if (!valid) {
        setError('PIN incorrecto.');
        return false;
      }
      setAuth({
        isAuthenticated: true,
        sessionType: 'client',
        clientId: client.id,
        clientName: client.name,
        expiresAt: Date.now() + CLIENT_TIMEOUT,
      });
      return true;
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

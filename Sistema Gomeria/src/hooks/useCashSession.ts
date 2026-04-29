// ═══════════════════════════════════════════════════
// Baliña Ruedas — Hook de sesión de caja
// Carga la sesión abierta para una tienda y expone open/close.
// La unique index parcial en BD garantiza una sola sesión abierta por tienda.
// ═══════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import type { CashSession } from '@/types';
import { cashSessionService } from '@/services/cashSessionService';

interface State {
  session: CashSession | null;
  loading: boolean;
  error: string | null;
}

const INITIAL: State = { session: null, loading: false, error: null };

export interface CloseResult {
  expectedCash: number;
  countedCash: number;
  variance: number;
}

export function useCashSession(storeId: string | null, employeeId: string | null) {
  const [state, setState] = useState<State>(INITIAL);

  const refresh = useCallback(async () => {
    if (!storeId) {
      setState(INITIAL);
      return;
    }
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const session = await cashSessionService.getOpenForStore(storeId);
      setState({ session: session ?? null, loading: false, error: null });
    } catch (e) {
      setState({
        session: null,
        loading: false,
        error: e instanceof Error ? e.message : 'Error cargando caja',
      });
    }
  }, [storeId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const open = useCallback(
    async (openingFloat: number): Promise<CashSession> => {
      if (!storeId || !employeeId) throw new Error('Falta tienda o empleado activo.');
      const session = await cashSessionService.open({ storeId, employeeId, openingFloat });
      setState({ session, loading: false, error: null });
      return session;
    },
    [storeId, employeeId],
  );

  const close = useCallback(
    async (countedCash: number): Promise<CloseResult> => {
      if (!state.session || !employeeId) throw new Error('No hay sesión activa.');
      const result = await cashSessionService.close({
        sessionId: state.session.id,
        employeeId,
        countedCash,
      });
      // Después de cerrar, la sesión deja de estar "abierta"
      setState({ session: null, loading: false, error: null });
      return result;
    },
    [state.session, employeeId],
  );

  return {
    session: state.session,
    isOpen: state.session !== null,
    loading: state.loading,
    error: state.error,
    open,
    close,
    refresh,
  };
}

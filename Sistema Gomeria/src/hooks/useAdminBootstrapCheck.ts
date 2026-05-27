import { useCallback, useEffect, useState } from 'react';
import { needsAdminBootstrap } from '@/services/employeeService';

/**
 * Detecta si la tienda activa carece de empleados con `settings.manage`,
 * lo que dispara el step de bootstrap-admin del FirstRunWizard.
 *
 * Devuelve `null` mientras está cargando (para que el Layout pueda esperar
 * antes de decidir qué mostrar) y `boolean` cuando ya respondió.
 *
 * Re-fetcha cuando cambia el storeId o cuando se llama a `recheck()`.
 */
export function useAdminBootstrapCheck(storeId: string | null): {
  needsAdmin: boolean | null;
  loading: boolean;
  recheck: () => void;
} {
  const [needsAdmin, setNeedsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(0);

  useEffect(() => {
    if (!storeId) {
      setNeedsAdmin(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    needsAdminBootstrap(storeId)
      .then((v) => {
        if (active) setNeedsAdmin(v);
      })
      .catch(() => {
        // Si falla la consulta, ser conservador: NO bloqueamos con bootstrap
        // (no queremos que un error transitorio impida operar). El operador
        // verá el EmployeeSelector y, si efectivamente no hay empleados,
        // el mensaje le indicará qué hacer.
        if (active) setNeedsAdmin(false);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [storeId, token]);

  const recheck = useCallback(() => setToken((t) => t + 1), []);

  return { needsAdmin, loading, recheck };
}

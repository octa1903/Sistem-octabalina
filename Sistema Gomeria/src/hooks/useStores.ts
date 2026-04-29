// ═══════════════════════════════════════════════════
// Baliña Ruedas — Hook de tienda activa
// Lista las tiendas accesibles (RLS ya filtra por employee.store_ids)
// y persiste la selección activa en localStorage.
// ═══════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Store } from '@/types';
import { storeService } from '@/services/storeService';
import { storageGet, storageSet } from '@/utils/storage';

const ACTIVE_KEY = 'active_store_id';

interface State {
  stores: Store[];
  activeStoreId: string | null;
  loading: boolean;
  error: string | null;
}

const INITIAL: State = {
  stores: [],
  activeStoreId: null,
  loading: true,
  error: null,
};

export function useStores(enabled: boolean) {
  const [state, setState] = useState<State>(INITIAL);

  const refresh = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const stores = await storeService.getActive();
      const saved = storageGet<string | null>(ACTIVE_KEY, null);
      let activeStoreId = saved && stores.some(s => s.id === saved) ? saved : null;
      // Auto-select si hay una sola tienda en scope
      if (!activeStoreId && stores.length === 1) {
        activeStoreId = stores[0].id;
        storageSet(ACTIVE_KEY, activeStoreId);
      }
      setState({ stores, activeStoreId, loading: false, error: null });
    } catch (e) {
      setState({
        stores: [],
        activeStoreId: null,
        loading: false,
        error: e instanceof Error ? e.message : 'Error cargando tiendas',
      });
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setState(INITIAL);
      return;
    }
    void refresh();
  }, [enabled, refresh]);

  const selectStore = useCallback((id: string) => {
    setState(s => {
      if (!s.stores.some(store => store.id === id)) return s;
      storageSet(ACTIVE_KEY, id);
      return { ...s, activeStoreId: id };
    });
  }, []);

  const activeStore = useMemo(
    () => state.stores.find(s => s.id === state.activeStoreId) ?? null,
    [state.stores, state.activeStoreId],
  );

  return {
    stores: state.stores,
    activeStoreId: state.activeStoreId,
    activeStore,
    loading: state.loading,
    error: state.error,
    selectStore,
    refresh,
  };
}

// ═══════════════════════════════════════════════════
// useRealtimeOrders — Fase 7
// Suscribe a INSERT/UPDATE/DELETE en customer_orders para la tienda
// activa. Las RLS existentes (0002) ya restringen scope; el filtro
// `store_id=eq.<id>` reduce el ruido en el canal.
// El callback recibe el evento; el caller decide cómo refrescar.
// ═══════════════════════════════════════════════════

import { useEffect, useRef } from 'react';
import { supabase } from '@/services/supabaseClient';
import type { Order } from '@/types';
import { toLegacyOrder } from '@/services/orderService';

type Event =
  | { kind: 'insert'; order: Order }
  | { kind: 'update'; order: Order }
  | { kind: 'delete'; id: string };

export function useRealtimeOrders(storeId: string | null, onEvent: (e: Event) => void) {
  const cb = useRef(onEvent);
  useEffect(() => { cb.current = onEvent; }, [onEvent]);

  useEffect(() => {
    if (!storeId) return;

    const channel = supabase
      .channel(`customer_orders:store=${storeId}`)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'customer_orders', filter: `store_id=eq.${storeId}` },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            cb.current({ kind: 'insert', order: toLegacyOrder(payload.new) });
          } else if (payload.eventType === 'UPDATE') {
            cb.current({ kind: 'update', order: toLegacyOrder(payload.new) });
          } else if (payload.eventType === 'DELETE') {
            const id = (payload.old?.id as string | undefined) ?? '';
            if (id) cb.current({ kind: 'delete', id });
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [storeId]);
}

import { useEffect, useState } from 'react';

/**
 * Hook que devuelve si el browser cree estar online.
 *
 * Limitaciones conocidas:
 *  - `navigator.onLine` solo refleja si hay interfaz de red activa (cable
 *    conectado / wifi asociado). NO garantiza que Supabase sea alcanzable
 *    (un proxy/firewall puede estar bloqueando aunque haya red).
 *  - Para detección "de verdad" se complementaría con un ping periódico
 *    a Supabase health endpoint; por ahora no es necesario porque el
 *    banner reacciona también a fallos reales de `createReceipt` que
 *    caen al offlineQueue.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  useEffect(() => {
    function handleOnline() {
      setOnline(true);
    }
    function handleOffline() {
      setOnline(false);
    }
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return online;
}

import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * Devuelve una versión del callback con identidad estable (la misma referencia
 * durante toda la vida del componente) que internamente delega a la última
 * versión del callback recibido.
 *
 * Why: pasar un callback como prop a un primitivo (Modal, Toast, ConfirmDialog)
 * cuyo useEffect lo tiene en su array de dependencias dispara el efecto en cada
 * render del padre si el callback no está memoizado. En Modal eso reubicaba el
 * foco al primer focusable, sacando el cursor del input mientras el usuario
 * tipeaba (ej. campo Proveedor en ImportModal).
 *
 * useLayoutEffect en vez de useEffect porque la actualización del ref debe
 * ocurrir antes de que cualquier efecto del hijo lea ref.current.
 */
export function useStableCallback<TArgs extends unknown[], TReturn>(
  callback: ((...args: TArgs) => TReturn) | undefined,
): (...args: TArgs) => TReturn | undefined {
  const ref = useRef(callback);
  useLayoutEffect(() => {
    ref.current = callback;
  });
  return useCallback((...args: TArgs) => ref.current?.(...args), []);
}

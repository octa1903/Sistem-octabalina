// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useStableCallback } from '../useStableCallback';

describe('useStableCallback', () => {
  it('devuelve la misma referencia a través de re-renders', () => {
    const { result, rerender } = renderHook(
      ({ cb }: { cb: () => number }) => useStableCallback(cb),
      { initialProps: { cb: () => 1 } },
    );
    const first = result.current;
    rerender({ cb: () => 2 });
    rerender({ cb: () => 3 });
    expect(result.current).toBe(first);
  });

  it('invoca siempre la última versión del callback', () => {
    const cb1 = vi.fn(() => 'a');
    const cb2 = vi.fn(() => 'b');
    const { result, rerender } = renderHook(
      ({ cb }: { cb: () => string }) => useStableCallback(cb),
      { initialProps: { cb: cb1 } },
    );
    expect(result.current()).toBe('a');
    rerender({ cb: cb2 });
    expect(result.current()).toBe('b');
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it('reenvía argumentos posicionales al callback subyacente', () => {
    const cb = vi.fn((a: number, b: number) => a + b);
    const { result } = renderHook(() => useStableCallback(cb));
    expect(result.current(2, 3)).toBe(5);
    expect(cb).toHaveBeenCalledWith(2, 3);
  });

  it('no rompe si el callback es undefined', () => {
    const { result } = renderHook(() => useStableCallback<[], void>(undefined));
    expect(() => result.current()).not.toThrow();
    expect(result.current()).toBeUndefined();
  });
});

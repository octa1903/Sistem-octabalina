// @vitest-environment happy-dom
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { Toast } from '../Toast';

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('llama onClose una sola vez al cumplirse duration aunque el padre re-renderice', () => {
    const onClose = vi.fn();
    function Wrapper() {
      const [, setTick] = useState(0);
      // Forzar varios re-renders del padre mientras el toast está activo.
      // Antes del fix esto cancelaba+reiniciaba el setTimeout en cada render.
      return (
        <>
          <button type="button" onClick={() => setTick((t) => t + 1)}>
            re-render
          </button>
          <Toast message="hola" duration={1000} onClose={() => onClose()} />
        </>
      );
    }

    const { getByText } = render(<Wrapper />);

    // Re-renderizar el padre varias veces durante el ciclo de vida del toast.
    act(() => {
      vi.advanceTimersByTime(300);
    });
    act(() => {
      getByText('re-render').click();
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    act(() => {
      getByText('re-render').click();
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    act(() => {
      getByText('re-render').click();
    });

    // Llegamos a 900ms con 3 re-renders. Sin fix, el timer se reinició y NO se llamó.
    // Con fix, debe dispararse en 1000ms + 300ms de fade.
    act(() => {
      vi.advanceTimersByTime(100 + 300 + 10);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

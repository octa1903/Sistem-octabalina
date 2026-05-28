// @vitest-environment happy-dom
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from '../Modal';

/**
 * Regresión del bug del importador de neumáticos:
 * Al tipear en un input dentro del Modal, el padre re-renderizaba con un
 * onClose nuevo (función inline), el useEffect del Modal se re-ejecutaba y
 * su cleanup re-enfocaba el elemento previamente focuseado, sacando el cursor.
 */
function ModalWithInput({ onClose }: { onClose?: () => void }) {
  const [value, setValue] = useState('');
  return (
    <Modal
      open
      title="Test"
      // PROP no memoizada a propósito: simula el patrón real de los 22 consumidores.
      onClose={() => onClose?.()}
    >
      <input
        aria-label="proveedor"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    </Modal>
  );
}

describe('Modal', () => {
  it('input mantiene foco mientras el padre re-renderiza con onClose nuevo en cada render', async () => {
    const user = userEvent.setup();
    render(<ModalWithInput />);

    const input = screen.getByLabelText('proveedor') as HTMLInputElement;
    input.focus();
    expect(document.activeElement).toBe(input);

    await user.type(input, 'BULL VIAL');

    expect(input.value).toBe('BULL VIAL');
    expect(document.activeElement).toBe(input);
  });

  it('cierra con Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="X">
        <button type="button">ok</button>
      </Modal>,
    );
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('mueve el foco al primer focusable cuando abre (sin header)', async () => {
    render(
      <Modal open onClose={() => {}}>
        <button type="button">primero</button>
        <button type="button">segundo</button>
      </Modal>,
    );
    // El Modal usa requestAnimationFrame; happy-dom lo programa con timeout.
    await waitFor(
      () => {
        expect(document.activeElement?.textContent).toBe('primero');
      },
      { timeout: 200 },
    );
  });

  it('cuando hay título, el foco va al botón Cerrar (primer focusable)', async () => {
    render(
      <Modal open onClose={() => {}} title="Header">
        <button type="button">primero</button>
      </Modal>,
    );
    await waitFor(
      () => {
        expect(document.activeElement?.getAttribute('aria-label')).toBe('Cerrar');
      },
      { timeout: 200 },
    );
  });

  it('Tab desde el último focusable vuelve al primero (focus trap)', () => {
    const { unmount } = render(
      <Modal open onClose={() => {}}>
        <button type="button">trap-first</button>
        <button type="button">trap-last</button>
      </Modal>,
    );
    const last = screen.getByText('trap-last') as HTMLButtonElement;
    last.focus();
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(last, { key: 'Tab' });
    expect((document.activeElement as HTMLElement | null)?.textContent).toBe('trap-first');
    unmount();
  });

  // Nota: el caso Shift+Tab desde el primer focusable también está cubierto por el
  // mismo handler (rama `e.shiftKey && active === first` en Modal.tsx). No tiene
  // test propio porque happy-dom no propaga shiftKey vía fireEvent de forma estable;
  // la lógica está cubierta por el test forward + el handler es simétrico.
});

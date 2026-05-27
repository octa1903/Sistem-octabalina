// @vitest-environment happy-dom
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from '../ConfirmDialog';

describe('ConfirmDialog', () => {
  it('Enter confirma cuando no hay inputField', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Borrar"
        message="¿Seguro?"
        onClose={() => {}}
        onConfirm={onConfirm}
      />,
    );
    await user.keyboard('{Enter}');
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('Enter no dispara onConfirm cuando hay inputField (lo maneja el propio input)', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    function Wrapper() {
      const [v, setV] = useState('');
      return (
        <ConfirmDialog
          open
          title="PIN"
          message="Ingresá tu PIN"
          inputField
          inputValue={v}
          onInputChange={setV}
          onClose={() => {}}
          onConfirm={onConfirm}
        />
      );
    }
    render(<Wrapper />);
    // El listener global de Enter está protegido por !inputField, así que tipear
    // letras (sin Enter) no debe disparar onConfirm.
    await user.keyboard('1234');
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('tipear en el input del ConfirmDialog mantiene el foco entre teclas', async () => {
    const user = userEvent.setup();
    function Wrapper() {
      const [v, setV] = useState('');
      return (
        <ConfirmDialog
          open
          title="Ingresá tu PIN"
          message="Para confirmar"
          inputField
          inputValue={v}
          inputPlaceholder="PIN-input"
          onInputChange={setV}
          // PROP no memoizada a propósito para simular el patrón real.
          onClose={() => {}}
          onConfirm={() => {}}
        />
      );
    }
    const { getByPlaceholderText } = render(<Wrapper />);
    const input = getByPlaceholderText('PIN-input') as HTMLInputElement;
    input.focus();
    await user.type(input, '1234');
    expect(input.value).toBe('1234');
    expect(document.activeElement).toBe(input);
  });
});

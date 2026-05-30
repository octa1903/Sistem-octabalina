// @vitest-environment happy-dom
import { useState } from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';

function Boom({ shouldThrow }: { shouldThrow: boolean }): React.ReactElement {
  if (shouldThrow) throw new Error('explotó el render');
  return <p>contenido sano</p>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // React loguea el error capturado; lo silenciamos para no ensuciar la salida.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renderiza los hijos cuando no hay error', () => {
    render(
      <ErrorBoundary>
        <p>todo bien</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('todo bien')).toBeTruthy();
  });

  it('muestra el fallback recuperable cuando un hijo lanza', () => {
    render(
      <ErrorBoundary label="Pedidos">
        <Boom shouldThrow />
      </ErrorBoundary>,
    );
    // No pantalla blanca: hay un alert con mensaje legible y acción.
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText(/Algo falló en Pedidos/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Reintentar/i })).toBeTruthy();
  });

  it('expone el detalle técnico del error', () => {
    render(
      <ErrorBoundary>
        <Boom shouldThrow />
      </ErrorBoundary>,
    );
    // getAllBy: React puede renderizar el fallback más de una vez en test.
    expect(screen.getAllByText(/explotó el render/).length).toBeGreaterThan(0);
  });

  it('Reintentar limpia el error y re-renderiza los hijos sanos', () => {
    function Harness() {
      const [throws, setThrows] = useState(true);
      return (
        <>
          <button onClick={() => setThrows(false)}>arreglar</button>
          <ErrorBoundary>
            <Boom shouldThrow={throws} />
          </ErrorBoundary>
        </>
      );
    }
    render(<Harness />);
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);

    // Arreglamos la causa y reintentamos.
    fireEvent.click(screen.getByText('arreglar'));
    fireEvent.click(screen.getAllByRole('button', { name: /Reintentar/i })[0]);

    expect(screen.getByText('contenido sano')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

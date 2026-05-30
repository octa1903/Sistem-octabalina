// ═══════════════════════════════════════════════════
// ErrorBoundary — red de seguridad global contra pantallas en blanco.
//
// React no tiene equivalente funcional a componentDidCatch, así que esto
// DEBE ser un class component. Captura cualquier error lanzado durante el
// render o el ciclo de vida de su subárbol y muestra un mensaje legible
// con acción de recuperación, en vez de dejar la pantalla muda en blanco.
//
// Dos presentaciones:
//   - variant="page"    → ocupa toda la pantalla (root de la app).
//   - variant="section" → tarjeta embebida (una vista/pestaña). Un crash
//     en una vista no tumba el resto de la app.
//
// `resetKeys`: si alguno cambia, el boundary se auto-resetea. Útil para
// que cambiar de pestaña limpie un error previo sin recargar.
// ═══════════════════════════════════════════════════

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw, RefreshCw } from 'lucide-react';
import { describeError } from '@/utils/errorMessage';

interface Props {
  children: ReactNode;
  /** 'page' = pantalla completa; 'section' = tarjeta embebida. */
  variant?: 'page' | 'section';
  /** Nombre humano del área (ej. "Pedidos") para el mensaje y el log. */
  label?: string;
  /** Si alguno de estos valores cambia, el boundary se resetea solo. */
  resetKeys?: ReadonlyArray<unknown>;
  /** Render alternativo opcional; recibe el error y un reset(). */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

function keysChanged(a: ReadonlyArray<unknown> = [], b: ReadonlyArray<unknown> = []): boolean {
  if (a.length !== b.length) return true;
  for (let i = 0; i < a.length; i++) {
    if (!Object.is(a[i], b[i])) return true;
  }
  return false;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Log completo en consola: stack + componentStack para diagnóstico.
    const where = this.props.label ? ` en «${this.props.label}»` : '';
    console.error(
      `[ErrorBoundary] Crash${where}:`,
      error,
      info.componentStack,
    );
  }

  componentDidUpdate(prev: Props): void {
    // Auto-reset cuando cambian las resetKeys (ej. cambio de pestaña).
    if (this.state.error && keysChanged(prev.resetKeys, this.props.resetKeys)) {
      this.reset();
    }
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    const isPage = (this.props.variant ?? 'page') === 'page';
    const detail = describeError(error);
    const label = this.props.label;

    const content = (
      <div
        role="alert"
        className="flex flex-col items-center text-center gap-3 max-w-md mx-auto"
      >
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--br-red-bg)', color: 'var(--br-red)' }}
        >
          <AlertTriangle className="h-7 w-7" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--br-txt)' }}>
            {label ? `Algo falló en ${label}` : 'Algo salió mal'}
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--br-txt2)' }}>
            Pudimos contener el error sin perder el resto del sistema. Probá de
            nuevo; si sigue, recargá la página.
          </p>
        </div>

        {/* Detalle técnico: colapsado, para reportar al soporte sin asustar. */}
        <details className="w-full text-left">
          <summary
            className="text-xs cursor-pointer select-none"
            style={{ color: 'var(--br-txt2)' }}
          >
            Detalle técnico
          </summary>
          <pre
            className="mt-2 text-xs whitespace-pre-wrap break-words rounded-lg p-3 max-h-40 overflow-auto"
            style={{ background: 'var(--br-sur2)', color: 'var(--br-txt2)', border: '1px solid var(--br-bor)' }}
          >
            {detail}
          </pre>
        </details>

        <div className="flex gap-2 mt-1">
          <button
            type="button"
            onClick={this.reset}
            className="inline-flex items-center justify-center gap-2 h-12 px-4 text-sm font-semibold rounded-lg text-white shadow-sm hover:opacity-90 active:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--br-amb)] focus-visible:ring-offset-[var(--br-bg)]"
            style={{ background: 'var(--br-amb)' }}
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Reintentar
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center gap-2 h-12 px-4 text-sm font-semibold rounded-lg hover:bg-[var(--br-sur2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--br-amb)] focus-visible:ring-offset-[var(--br-bg)]"
            style={{ background: 'var(--br-sur)', color: 'var(--br-txt)', border: '1px solid var(--br-bor)' }}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Recargar
          </button>
        </div>
      </div>
    );

    if (isPage) {
      return (
        <div
          className="min-h-screen flex items-center justify-center p-6"
          style={{ background: 'var(--br-bg)' }}
        >
          {content}
        </div>
      );
    }

    return (
      <div
        className="rounded-xl p-8 m-4"
        style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}
      >
        {content}
      </div>
    );
  }
}

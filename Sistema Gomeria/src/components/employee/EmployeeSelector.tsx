// ═══════════════════════════════════════════════════
// EmployeeSelector — selector de operador del TPV
// Modal bloqueante: el dueño abrió la sesión web, ahora hay que
// identificar al cajero que va a operar el TPV (PIN 4 dígitos).
// ═══════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react';
import type { Employee } from '@/types';
import { employeeService } from '@/services/employeeService';
import { AlertCircle, LogIn, User } from 'lucide-react';
import { Button } from '@/components/ui';

const FOCUSABLE_SELECTOR = [
  'a[href]:not([disabled])',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

interface Props {
  storeId: string;
  onSelected: (result: { ok: true } | { ok: false; reason: string }) => void;
  loginWithPin: (employeeId: string, pin: string) => Promise<{ ok: true } | { ok: false; reason: string }>;
}

export function EmployeeSelector({ storeId, onSelected, loginWithPin }: Props) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const mountedRef = useRef(true);
  const pinInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => () => { mountedRef.current = false; }, []);

  // Focus trap: el operador no debe poder tabular fuera del diálogo.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusables = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (!active || !dialogRef.current.contains(active)) {
        e.preventDefault();
        first.focus();
        return;
      }
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    employeeService
      .getActiveByStore(storeId)
      .then((list) => active && setEmployees(list))
      .catch((e) => active && setError(e instanceof Error ? e.message : 'Error cargando empleados'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [storeId]);

  const selected = employees.find((e) => e.id === selectedId) ?? null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId || !pin || submitting) return;
    setSubmitting(true);
    setError(null);
    const r = await loginWithPin(selectedId, pin);
    if (!mountedRef.current) return;
    setSubmitting(false);
    if (!r.ok) {
      setError(r.reason);
      setPin('');
      // Devolver foco al input para que el operador pueda reintentar sin levantar la vista.
      setTimeout(() => pinInputRef.current?.focus(), 0);
      return;
    }
    onSelected(r);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(28, 24, 20, 0.85)' }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="employee-selector-title"
        className="w-full max-w-sm rounded-2xl shadow-xl overflow-hidden"
        style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}
      >
        <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--br-bor)' }}>
          <h2 id="employee-selector-title" className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--br-txt)' }}>
            <User className="h-5 w-5" style={{ color: 'var(--br-amb)' }} />
            ¿Quién va a operar el TPV?
          </h2>
          <p className="text-xs mt-1" style={{ color: 'var(--br-txt2)' }}>
            Ingresá tu PIN para identificarte como operador.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {loading ? (
            <p className="text-sm" style={{ color: 'var(--br-txt2)' }}>Cargando empleados…</p>
          ) : employees.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--br-txt2)' }}>
              No hay empleados activos en esta tienda. Pedí al admin que cree uno desde Configuración.
            </p>
          ) : !selectedId ? (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--br-txt2)' }}>
                Empleado
              </label>
              <div className="rounded-lg overflow-hidden max-h-64 overflow-y-auto" style={{ border: '1px solid var(--br-bor)' }}>
                {employees.map((emp) => (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => setSelectedId(emp.id)}
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-[var(--br-sur2)] transition-colors"
                    style={{ borderBottom: '1px solid var(--br-bor)', color: 'var(--br-txt)' }}
                  >
                    <span className="font-medium">{emp.name}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-semibold text-sm" style={{ color: 'var(--br-txt)' }}>{selected?.name}</p>
                  {selected?.email && (
                    <p className="text-xs" style={{ color: 'var(--br-txt2)' }}>{selected.email}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedId(''); setPin(''); setError(null); }}
                  className="text-xs px-2 py-1 rounded"
                  style={{ color: 'var(--br-amb)', background: 'var(--br-amb-bg)' }}
                >
                  Cambiar
                </button>
              </div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--br-txt2)' }}>
                PIN
              </label>
              <input
                ref={pinInputRef}
                type="password"
                inputMode="numeric"
                maxLength={8}
                autoFocus
                value={pin}
                onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setError(null); }}
                placeholder="••••"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'pin-error' : undefined}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none text-center tracking-widest focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--br-amb)]"
                style={{
                  border: `1px solid ${error ? 'var(--br-red)' : 'var(--br-bor)'}`,
                  background: 'var(--br-sur)',
                  color: 'var(--br-txt)',
                }}
              />
            </div>
          )}

          {error && (
            <p
              id="pin-error"
              role="alert"
              className="text-sm rounded-lg px-3 py-2 flex items-center gap-2"
              style={{ background: 'var(--br-red-bg)', color: 'var(--br-red)', border: '1px solid var(--br-red-bor)' }}
            >
              <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}

          {selectedId && (
            <Button
              type="submit"
              variant="primary"
              fullWidth
              disabled={submitting || !pin}
              loading={submitting}
              iconLeft={<LogIn className="h-4 w-4" />}
            >
              Confirmar
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}

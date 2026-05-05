// ═══════════════════════════════════════════════════
// EmployeeSelector — selector de operador del TPV
// Modal bloqueante: el dueño abrió la sesión web, ahora hay que
// identificar al cajero que va a operar el TPV (PIN 4 dígitos).
// ═══════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import type { Employee } from '@/types';
import { employeeService } from '@/services/employeeService';
import { LogIn, User } from 'lucide-react';

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
    setSubmitting(false);
    if (!r.ok) {
      setError(r.reason);
      setPin('');
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
        className="w-full max-w-sm rounded-2xl shadow-xl overflow-hidden"
        style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}
      >
        <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--br-bor)' }}>
          <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--br-txt)' }}>
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
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-stone-50 transition-colors"
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
                type="password"
                inputMode="numeric"
                maxLength={8}
                autoFocus
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none text-center tracking-widest"
                style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}
              />
            </div>
          )}

          {error && (
            <p className="text-sm rounded-lg px-3 py-2" style={{ background: 'var(--br-red-bg)', color: 'var(--br-red)', border: '1px solid var(--br-red-bor)' }}>
              {error}
            </p>
          )}

          {selectedId && (
            <button
              type="submit"
              disabled={submitting || !pin}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-50"
              style={{ background: 'var(--br-dark)' }}
            >
              <LogIn className="h-4 w-4" />
              {submitting ? 'Verificando…' : 'Confirmar'}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

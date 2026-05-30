import { useState, useEffect, useRef } from 'react';
import type { useAuth } from '@/hooks/useAuth';
import { customerServiceV2 } from '@/services/customerServiceV2';
import { Eye, EyeOff, LogIn, Mail } from 'lucide-react';
import { Button, Input } from '@/components/ui';

type AuthReturn = ReturnType<typeof useAuth>;

interface ClientPick {
  id: string;
  name: string;
  tipoCliente: 'minorista' | 'mayorista';
  hasPin: boolean;
}

interface Props {
  auth: AuthReturn;
}

export function LoginScreen({ auth }: Props) {
  const [mode, setMode] = useState<'employee' | 'client'>('employee');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<ClientPick[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientsError, setClientsError] = useState<string | null>(null);
  const clientsLoadedRef = useRef(false);

  // Cargar lista de clientes una sola vez, cuando el usuario abre el tab cliente.
  useEffect(() => {
    if (mode !== 'client' || clientsLoadedRef.current) return;
    clientsLoadedRef.current = true;
    let active = true;
    setClientsLoading(true);
    setClientsError(null);
    customerServiceV2
      .getAll()
      .then((customers) => {
        if (!active) return;
        setClients(
          customers.map((c) => ({
            id: c.id,
            name: c.name,
            tipoCliente: c.customerType === 'wholesale' ? 'mayorista' : 'minorista',
            hasPin: !!c.pinHash,
          })),
        );
      })
      .catch((e) => {
        if (!active) return;
        clientsLoadedRef.current = false; // permitir reintento si falló
        setClientsError(e instanceof Error ? e.message : 'Error cargando clientes');
      })
      .finally(() => active && setClientsLoading(false));
    return () => { active = false; };
  }, [mode]);

  const filteredClients = clients.filter((c) =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase()),
  );
  const selectedClient = clients.find((c) => c.id === selectedClientId);

  async function handleEmployee(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      // employeeLogin maneja sus propios errores (setError) y nunca lanza,
      // pero el try/finally garantiza que el spinner SIEMPRE se libere
      // incluso si algo inesperado revienta — nunca un botón colgado.
      await auth.employeeLogin(email, password);
    } finally {
      setLoading(false);
      setPassword('');
    }
  }

  async function handleClient(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedClientId) return;
    setLoading(true);
    try {
      await auth.clientLogin(selectedClientId, pin);
    } finally {
      setLoading(false);
      setPin('');
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12" style={{ background: 'var(--br-bg)' }}>
      {/* Logo */}
      <div className="mb-8 text-center">
        <div
          aria-hidden="true"
          className="inline-flex items-center justify-center w-14 h-14 rounded-2xl text-2xl font-bold mb-3 shadow-md"
          style={{ background: 'var(--br-dark)', color: 'var(--br-bg)' }}
        >
          B
        </div>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--br-txt)' }}>
          Baliña Ruedas
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--br-txt2)' }}>
          Juan B. Justo 1980, Mar del Plata
        </p>
      </div>

      {/* Card */}
      <div
        className="w-full max-w-sm rounded-2xl shadow-lg overflow-hidden"
        style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}
      >
        {/* Tabs */}
        <div role="tablist" aria-label="Tipo de acceso" className="flex" style={{ borderBottom: '1px solid var(--br-bor)' }}>
          {(['employee', 'client'] as const).map((t) => {
            const active = mode === t;
            return (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => { setMode(t); auth.clearError(); }}
                className="flex-1 py-3 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--br-amb)]"
                style={{
                  color: active ? 'var(--br-amb)' : 'var(--br-txt2)',
                  borderBottom: active ? '2px solid var(--br-amb)' : '2px solid transparent',
                  background: 'none',
                }}
              >
                {t === 'employee' ? 'Empleado' : 'Cliente'}
              </button>
            );
          })}
        </div>

        <div className="p-6">
          {/* Employee login */}
          {mode === 'employee' && (
            <form onSubmit={handleEmployee} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--br-txt2)' }}>
                  Email
                </label>
                <Input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  autoComplete="username"
                  aria-invalid={!!auth.error || undefined}
                  aria-describedby={auth.error ? 'login-employee-error' : undefined}
                  iconLeft={<Mail className="h-4 w-4" />}
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="login-password" className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--br-txt2)' }}>
                  Contraseña
                </label>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Ingrese contraseña"
                    autoComplete="current-password"
                    aria-invalid={!!auth.error || undefined}
                    aria-describedby={auth.error ? 'login-employee-error' : undefined}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    aria-pressed={showPwd}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-80 focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[var(--br-amb)] rounded"
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {auth.error && (
                <p id="login-employee-error" role="alert" className="text-sm rounded-lg px-3 py-2" style={{ background: 'var(--br-red-bg)', color: 'var(--br-red)', border: '1px solid var(--br-red-bor)' }}>
                  {auth.error}
                </p>
              )}

              <Button
                type="submit"
                variant="primary"
                fullWidth
                disabled={loading || !email || !password}
                loading={loading}
                iconLeft={<LogIn className="h-4 w-4" />}
              >
                Ingresar como Empleado
              </Button>
            </form>
          )}

          {/* Client login */}
          {mode === 'client' && (
            <form onSubmit={handleClient} className="space-y-4">
              {!selectedClientId ? (
                <div>
                  <label htmlFor="login-client-search" className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--br-txt2)' }}>
                    Buscar cliente
                  </label>
                  <div className="mb-2">
                    <Input
                      id="login-client-search"
                      type="text"
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      placeholder="Nombre del cliente..."
                      aria-label="Buscar cliente por nombre"
                      autoFocus
                    />
                  </div>
                  <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--br-bor)' }}>
                    {clientsLoading ? (
                      <p className="px-3 py-3 text-sm" style={{ color: 'var(--br-txt2)' }}>Cargando clientes…</p>
                    ) : clientsError ? (
                      <p className="px-3 py-3 text-sm" style={{ color: 'var(--br-red)' }}>{clientsError}</p>
                    ) : filteredClients.length === 0 ? (
                      <p className="px-3 py-3 text-sm" style={{ color: 'var(--br-txt2)' }}>
                        {clients.length === 0
                          ? 'No hay clientes registrados. Un empleado debe crearlos primero.'
                          : 'No se encontraron clientes.'}
                      </p>
                    ) : (
                      filteredClients.slice(0, 6).map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setSelectedClientId(c.id)}
                          className="w-full text-left px-3 py-2.5 text-sm transition-colors hover:bg-[var(--br-sur2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--br-amb)] flex items-center justify-between"
                          style={{ borderBottom: '1px solid var(--br-bor)' }}
                        >
                          <span className="font-medium" style={{ color: 'var(--br-txt)' }}>{c.name}</span>
                          <span className="text-xs" style={{ color: 'var(--br-txt2)' }}>
                            {c.tipoCliente === 'mayorista' ? 'Mayorista' : 'Minorista'}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-semibold text-sm" style={{ color: 'var(--br-txt)' }}>{selectedClient?.name}</p>
                      <p className="text-xs" style={{ color: 'var(--br-txt2)' }}>{selectedClient?.tipoCliente === 'mayorista' ? 'Mayorista' : 'Minorista'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setSelectedClientId(''); setPin(''); }}
                      className="text-xs px-2 py-1 rounded"
                      style={{ color: 'var(--br-amb)', background: 'var(--br-amb-bg)' }}
                    >
                      Cambiar
                    </button>
                  </div>

                  {!selectedClient?.hasPin ? (
                    <p className="text-sm rounded-lg px-3 py-2" style={{ background: 'var(--br-amb-bg)', color: 'var(--br-amb)', border: '1px solid var(--br-amb-bor)' }}>
                      Este cliente no tiene PIN configurado. Solicite uno al empleado.
                    </p>
                  ) : (
                    <>
                      <label htmlFor="login-client-pin" className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--br-txt2)' }}>
                        PIN
                      </label>
                      <Input
                        id="login-client-pin"
                        type="password"
                        inputMode="numeric"
                        maxLength={8}
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                        placeholder="••••"
                        autoComplete="current-password"
                        aria-invalid={!!auth.error || undefined}
                        aria-describedby={auth.error ? 'login-client-error' : undefined}
                        className="text-center tracking-widest"
                        autoFocus
                      />
                    </>
                  )}
                </div>
              )}

              {auth.error && (
                <p id="login-client-error" role="alert" className="text-sm rounded-lg px-3 py-2" style={{ background: 'var(--br-red-bg)', color: 'var(--br-red)', border: '1px solid var(--br-red-bor)' }}>
                  {auth.error}
                </p>
              )}

              {selectedClientId && selectedClient?.hasPin && (
                <Button
                  type="submit"
                  variant="primary"
                  fullWidth
                  disabled={loading || !pin}
                  loading={loading}
                  iconLeft={<LogIn className="h-4 w-4" />}
                >
                  Continuar
                </Button>
              )}
            </form>
          )}
        </div>
      </div>

      <p className="mt-6 text-xs" style={{ color: 'var(--br-txt2)' }}>
        Sistema de Gestión v4.0
      </p>
    </div>
  );
}

import { useState } from 'react';
import type { useAuth } from '@/hooks/useAuth';
import { clientService } from '@/services/storageService';
import { Eye, EyeOff, LogIn, Mail } from 'lucide-react';

type AuthReturn = ReturnType<typeof useAuth>;

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

  const clients = clientService.getAll();
  const filteredClients = clients.filter((c) =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase()),
  );
  const selectedClient = clients.find((c) => c.id === selectedClientId);

  async function handleEmployee(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await auth.employeeLogin(email, password);
    setLoading(false);
    setPassword('');
  }

  async function handleClient(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedClientId) return;
    setLoading(true);
    await auth.clientLogin(selectedClientId, pin);
    setLoading(false);
    setPin('');
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12" style={{ background: 'var(--br-bg)' }}>
      {/* Logo */}
      <div className="mb-8 text-center">
        <div
          className="inline-flex items-center justify-center w-14 h-14 rounded-2xl text-white text-2xl font-bold mb-3 shadow-md"
          style={{ background: 'var(--br-dark)' }}
        >
          B
        </div>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--br-txt)' }}>
          Baliña Ruedas
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--br-txt2)' }}>
          Juan B. Justo 1980 · Mar del Plata
        </p>
      </div>

      {/* Card */}
      <div
        className="w-full max-w-sm rounded-2xl shadow-lg overflow-hidden"
        style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}
      >
        {/* Tabs */}
        <div className="flex" style={{ borderBottom: '1px solid var(--br-bor)' }}>
          {(['employee', 'client'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setMode(t); auth.clearError(); }}
              className="flex-1 py-3 text-sm font-semibold transition-colors"
              style={{
                color: mode === t ? 'var(--br-amb)' : 'var(--br-txt2)',
                borderBottom: mode === t ? '2px solid var(--br-amb)' : '2px solid transparent',
                background: 'none',
              }}
            >
              {t === 'employee' ? 'Empleado' : 'Cliente'}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* Employee login */}
          {mode === 'employee' && (
            <form onSubmit={handleEmployee} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--br-txt2)' }}>
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    autoComplete="username"
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg text-sm outline-none transition-colors"
                    style={{
                      border: '1px solid var(--br-bor)',
                      background: 'var(--br-sur)',
                      color: 'var(--br-txt)',
                    }}
                    onFocus={(e) => (e.target.style.borderColor = 'var(--br-amb)')}
                    onBlur={(e) => (e.target.style.borderColor = 'var(--br-bor)')}
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--br-txt2)' }}>
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Ingrese contraseña"
                    autoComplete="current-password"
                    className="w-full pr-10 pl-3 py-2.5 rounded-lg text-sm outline-none transition-colors"
                    style={{
                      border: '1px solid var(--br-bor)',
                      background: 'var(--br-sur)',
                      color: 'var(--br-txt)',
                    }}
                    onFocus={(e) => (e.target.style.borderColor = 'var(--br-amb)')}
                    onBlur={(e) => (e.target.style.borderColor = 'var(--br-bor)')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-80"
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {auth.error && (
                <p className="text-sm rounded-lg px-3 py-2" style={{ background: 'var(--br-red-bg)', color: 'var(--br-red)', border: '1px solid var(--br-red-bor)' }}>
                  {auth.error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-50"
                style={{ background: 'var(--br-dark)' }}
              >
                <LogIn className="h-4 w-4" />
                {loading ? 'Verificando...' : 'Ingresar como Empleado'}
              </button>
            </form>
          )}

          {/* Client login */}
          {mode === 'client' && (
            <form onSubmit={handleClient} className="space-y-4">
              {!selectedClientId ? (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--br-txt2)' }}>
                    Buscar cliente
                  </label>
                  <input
                    type="text"
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    placeholder="Nombre del cliente..."
                    className="w-full px-3 py-2.5 rounded-lg text-sm outline-none mb-2"
                    style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}
                    onFocus={(e) => (e.target.style.borderColor = 'var(--br-amb)')}
                    onBlur={(e) => (e.target.style.borderColor = 'var(--br-bor)')}
                    autoFocus
                  />
                  <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--br-bor)' }}>
                    {filteredClients.length === 0 ? (
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
                          className="w-full text-left px-3 py-2.5 text-sm transition-colors hover:bg-stone-50 flex items-center justify-between"
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

                  {!selectedClient?.pinHash ? (
                    <p className="text-sm rounded-lg px-3 py-2" style={{ background: 'var(--br-amb-bg)', color: 'var(--br-amb)', border: '1px solid var(--br-amb-bor)' }}>
                      Este cliente no tiene PIN configurado. Solicite uno al empleado.
                    </p>
                  ) : (
                    <>
                      <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--br-txt2)' }}>
                        PIN
                      </label>
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={8}
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                        placeholder="••••"
                        className="w-full px-3 py-2.5 rounded-lg text-sm outline-none text-center tracking-widest"
                        style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}
                        onFocus={(e) => (e.target.style.borderColor = 'var(--br-amb)')}
                        onBlur={(e) => (e.target.style.borderColor = 'var(--br-bor)')}
                        autoFocus
                      />
                    </>
                  )}
                </div>
              )}

              {auth.error && (
                <p className="text-sm rounded-lg px-3 py-2" style={{ background: 'var(--br-red-bg)', color: 'var(--br-red)', border: '1px solid var(--br-red-bor)' }}>
                  {auth.error}
                </p>
              )}

              {selectedClientId && selectedClient?.pinHash && (
                <button
                  type="submit"
                  disabled={loading || !pin}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-50"
                  style={{ background: 'var(--br-dark)' }}
                >
                  <LogIn className="h-4 w-4" />
                  {loading ? 'Verificando...' : 'Continuar →'}
                </button>
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

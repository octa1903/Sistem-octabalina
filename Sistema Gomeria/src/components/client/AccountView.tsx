import { useMemo } from 'react';
import { clientService } from '@/services/storageService';
import { formatCurrency } from '@/utils/currency';
import { Phone, MapPin, Mail, TrendingDown } from 'lucide-react';

interface Props { clientId: string; }

export function AccountView({ clientId }: Props) {
  const client = useMemo(() => clientService.getById(clientId), [clientId]);

  if (!client) return null;

  return (
    <div>
      <h1 className="text-xl font-semibold mb-4" style={{ color: 'var(--br-txt)' }}>Mi Cuenta</h1>

      <div className="space-y-4">
        {/* Profile */}
        <div className="rounded-xl p-5" style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold"
              style={{ background: client.tipoCliente === 'mayorista' ? 'var(--br-amb)' : 'var(--br-dark)' }}>
              {client.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{ color: 'var(--br-txt)' }}>{client.name}</h2>
              <span className="text-sm px-2 py-0.5 rounded-full font-medium"
                style={{ background: client.tipoCliente === 'mayorista' ? 'var(--br-amb-bg)' : 'var(--br-sur2)', color: client.tipoCliente === 'mayorista' ? 'var(--br-amb)' : 'var(--br-txt2)' }}>
                {client.tipoCliente === 'mayorista' ? 'Mayorista' : 'Minorista'}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            {client.phone && (
              <p className="flex items-center gap-2 text-sm" style={{ color: 'var(--br-txt2)' }}>
                <Phone className="h-4 w-4" /> {client.phone}
              </p>
            )}
            {client.address && (
              <p className="flex items-center gap-2 text-sm" style={{ color: 'var(--br-txt2)' }}>
                <MapPin className="h-4 w-4" /> {client.address}
              </p>
            )}
            {client.email && (
              <p className="flex items-center gap-2 text-sm" style={{ color: 'var(--br-txt2)' }}>
                <Mail className="h-4 w-4" /> {client.email}
              </p>
            )}
          </div>
        </div>

        {/* Balance */}
        <div className="rounded-xl p-5" style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--br-txt2)' }}>Cuenta corriente</p>
          <p className="text-3xl font-bold font-mono" style={{ color: client.balance > 0 ? 'var(--br-red)' : client.balance < 0 ? 'var(--br-grn)' : 'var(--br-txt)' }}>
            {formatCurrency(Math.abs(client.balance))}
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--br-txt2)' }}>
            {client.balance > 0 ? 'Saldo deudor — contactá a la gomería para regularizar.' : client.balance < 0 ? 'Saldo a tu favor.' : 'Sin saldo pendiente.'}
          </p>
          {client.cupoCredito > 0 && (
            <p className="text-sm mt-2" style={{ color: 'var(--br-txt2)' }}>Cupo crédito: <strong className="font-mono">{formatCurrency(client.cupoCredito)}</strong></p>
          )}
        </div>

        {/* Benefits */}
        {client.tipoCliente === 'mayorista' && client.descuentoMayorista > 0 && (
          <div className="rounded-xl p-5" style={{ background: 'var(--br-grn-bg)', border: '1px solid var(--br-grn-bor)' }}>
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-5 w-5" style={{ color: 'var(--br-grn)' }} />
              <p className="font-semibold text-sm" style={{ color: 'var(--br-grn)' }}>Beneficio mayorista</p>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'var(--br-grn)' }}>{client.descuentoMayorista}% descuento</p>
            <p className="text-sm mt-1" style={{ color: 'var(--br-grn)' }}>en todos los productos del catálogo.</p>
          </div>
        )}

        {/* Recent payments */}
        {client.payments.length > 0 && (
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}>
            <div className="px-5 py-3" style={{ background: 'var(--br-sur2)', borderBottom: '1px solid var(--br-bor)' }}>
              <p className="text-sm font-semibold" style={{ color: 'var(--br-txt)' }}>Últimos movimientos</p>
            </div>
            {[...client.payments].reverse().slice(0, 5).map((p) => (
              <div key={p.id} className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid var(--br-bor)' }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--br-txt)' }}>{p.method}</p>
                  <p className="text-xs" style={{ color: 'var(--br-txt2)' }}>
                    {new Date(p.date).toLocaleDateString('es-AR')}
                    {p.notes ? ` · ${p.notes}` : ''}
                  </p>
                </div>
                <span className="font-mono text-sm font-semibold" style={{ color: 'var(--br-grn)' }}>
                  {formatCurrency(p.amount)}
                </span>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-center pb-4" style={{ color: 'var(--br-txt2)' }}>
          Para consultas, contactá a Baliña Ruedas — Juan B. Justo 1980, Mar del Plata.
        </p>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import type { Customer, CustomerAccountMovement } from '@/types';
import { customerSelfService } from '@/services/customerSelfService';
import { formatCurrency } from '@/utils/currency';
import { Phone, MapPin, Mail, TrendingDown } from 'lucide-react';

interface Props { clientToken: string | undefined; }

function formatAddress(addr: Customer['address']): string {
  if (!addr) return '';
  if (typeof addr === 'string') return addr;
  return [addr.street, addr.city].filter(Boolean).join(', ');
}

export function AccountView({ clientToken }: Props) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [movements, setMovements] = useState<CustomerAccountMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!clientToken) {
      setError('Sesión expirada. Volvé a iniciar sesión.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    Promise.all([
      customerSelfService.getProfile(clientToken),
      customerSelfService.getMovements(clientToken),
    ])
      .then(([c, m]) => {
        if (!active) return;
        setCustomer(c ?? null);
        setMovements(m);
      })
      .catch((e) => active && setError(e instanceof Error ? e.message : 'Error cargando cuenta'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [clientToken]);

  if (loading) return <p className="text-sm" style={{ color: 'var(--br-txt2)' }}>Cargando cuenta…</p>;
  if (error) return <p className="text-sm" style={{ color: 'var(--br-red)' }}>{error}</p>;
  if (!customer) return null;

  const isMayorista = customer.customerType === 'wholesale';
  const descuentoMayorista = customer.wholesaleDiscount ?? 0;
  const balance = customer.accountBalance;
  const cupo = customer.creditLimit;
  const address = formatAddress(customer.address);

  return (
    <div>
      <h1 className="text-xl font-semibold mb-4" style={{ color: 'var(--br-txt)' }}>Mi Cuenta</h1>

      <div className="space-y-4">
        {/* Profile */}
        <div className="rounded-xl p-5" style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold"
              style={{ background: isMayorista ? 'var(--br-amb)' : 'var(--br-dark)' }}>
              {customer.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{ color: 'var(--br-txt)' }}>{customer.name}</h2>
              <span className="text-sm px-2 py-0.5 rounded-full font-medium"
                style={{ background: isMayorista ? 'var(--br-amb-bg)' : 'var(--br-sur2)', color: isMayorista ? 'var(--br-amb)' : 'var(--br-txt2)' }}>
                {isMayorista ? 'Mayorista' : 'Minorista'}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            {customer.phone && (
              <p className="flex items-center gap-2 text-sm" style={{ color: 'var(--br-txt2)' }}>
                <Phone className="h-4 w-4" /> {customer.phone}
              </p>
            )}
            {address && (
              <p className="flex items-center gap-2 text-sm" style={{ color: 'var(--br-txt2)' }}>
                <MapPin className="h-4 w-4" /> {address}
              </p>
            )}
            {customer.email && (
              <p className="flex items-center gap-2 text-sm" style={{ color: 'var(--br-txt2)' }}>
                <Mail className="h-4 w-4" /> {customer.email}
              </p>
            )}
          </div>
        </div>

        {/* Balance */}
        <div className="rounded-xl p-5" style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--br-txt2)' }}>Cuenta corriente</p>
          <p className="text-3xl font-bold font-mono" style={{ color: balance > 0 ? 'var(--br-red)' : balance < 0 ? 'var(--br-grn)' : 'var(--br-txt)' }}>
            {formatCurrency(Math.abs(balance))}
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--br-txt2)' }}>
            {balance > 0 ? 'Saldo deudor — contactá a la gomería para regularizar.' : balance < 0 ? 'Saldo a tu favor.' : 'Sin saldo pendiente.'}
          </p>
          {cupo > 0 && (
            <p className="text-sm mt-2" style={{ color: 'var(--br-txt2)' }}>Cupo crédito: <strong className="font-mono">{formatCurrency(cupo)}</strong></p>
          )}
        </div>

        {/* Benefits */}
        {isMayorista && descuentoMayorista > 0 && (
          <div className="rounded-xl p-5" style={{ background: 'var(--br-grn-bg)', border: '1px solid var(--br-grn-bor)' }}>
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-5 w-5" style={{ color: 'var(--br-grn)' }} />
              <p className="font-semibold text-sm" style={{ color: 'var(--br-grn)' }}>Beneficio mayorista</p>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'var(--br-grn)' }}>{descuentoMayorista}% descuento</p>
            <p className="text-sm mt-1" style={{ color: 'var(--br-grn)' }}>en todos los productos del catálogo.</p>
          </div>
        )}

        {/* Recent movements */}
        {movements.length > 0 && (
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}>
            <div className="px-5 py-3" style={{ background: 'var(--br-sur2)', borderBottom: '1px solid var(--br-bor)' }}>
              <p className="text-sm font-semibold" style={{ color: 'var(--br-txt)' }}>Últimos movimientos</p>
            </div>
            {movements.slice(0, 5).map((m) => {
              const isPayment = m.type === 'payment';
              return (
                <div key={m.id} className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid var(--br-bor)' }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--br-txt)' }}>
                      {isPayment ? 'Pago' : 'Cargo'}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--br-txt2)' }}>
                      {new Date(m.at).toLocaleDateString('es-AR')}
                      {m.notes ? ` · ${m.notes}` : ''}
                    </p>
                  </div>
                  <span className="font-mono text-sm font-semibold" style={{ color: isPayment ? 'var(--br-grn)' : 'var(--br-red)' }}>
                    {isPayment ? '-' : '+'}{formatCurrency(m.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-xs text-center pb-4" style={{ color: 'var(--br-txt2)' }}>
          Para consultas, contactá a Baliña Ruedas — Juan B. Justo 1980, Mar del Plata.
        </p>
      </div>
    </div>
  );
}

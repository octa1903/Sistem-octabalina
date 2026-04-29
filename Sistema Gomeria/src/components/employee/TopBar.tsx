import type { Store, CashSession } from '@/types';
import { Store as StoreIcon, LockOpen, Lock } from 'lucide-react';
import { formatCurrency } from '@/utils/currency';

interface Props {
  stores: Store[];
  activeStoreId: string | null;
  onSelectStore: (id: string) => void;
  session: CashSession | null;
  cashLoading: boolean;
  onOpenCash: () => void;
  onCloseCash: () => void;
  employeeName?: string;
}

export function TopBar({
  stores,
  activeStoreId,
  onSelectStore,
  session,
  cashLoading,
  onOpenCash,
  onCloseCash,
  employeeName,
}: Props) {
  const activeStore = stores.find(s => s.id === activeStoreId);

  return (
    <div
      className="flex items-center justify-between px-4 py-2.5 gap-3 flex-wrap"
      style={{
        background: 'var(--br-sur)',
        borderBottom: '1px solid var(--br-bor)',
      }}
    >
      {/* Tienda */}
      <div className="flex items-center gap-2">
        <StoreIcon className="h-4 w-4" style={{ color: 'var(--br-txt2)' }} />
        {stores.length <= 1 ? (
          <span className="text-sm font-semibold" style={{ color: 'var(--br-txt)' }}>
            {activeStore?.name ?? 'Sin tienda'}
          </span>
        ) : (
          <select
            value={activeStoreId ?? ''}
            onChange={(e) => onSelectStore(e.target.value)}
            className="text-sm font-semibold px-2 py-1 rounded-lg outline-none"
            style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}
          >
            {!activeStoreId && <option value="">Seleccionar tienda...</option>}
            {stores.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Caja */}
      <div className="flex items-center gap-2">
        {cashLoading ? (
          <span className="text-xs" style={{ color: 'var(--br-txt2)' }}>Cargando caja...</span>
        ) : session ? (
          <>
            <span
              className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold"
              style={{ background: 'rgba(21,128,61,0.10)', color: '#15803d', border: '1px solid rgba(21,128,61,0.30)' }}
            >
              <LockOpen className="h-3 w-3" />
              Caja abierta · {formatCurrency(session.openingFloat)}
            </span>
            <button
              type="button"
              onClick={onCloseCash}
              disabled={!activeStoreId}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-50"
              style={{ background: 'var(--br-red)' }}
            >
              Cerrar caja
            </button>
          </>
        ) : (
          <>
            <span
              className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold"
              style={{ background: 'rgba(220,38,38,0.08)', color: 'var(--br-red)', border: '1px solid rgba(220,38,38,0.30)' }}
            >
              <Lock className="h-3 w-3" />
              Caja cerrada
            </span>
            <button
              type="button"
              onClick={onOpenCash}
              disabled={!activeStoreId}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-50"
              style={{ background: '#15803d' }}
            >
              Abrir caja
            </button>
          </>
        )}
      </div>

      {/* Empleado (decorativo) */}
      {employeeName && (
        <div className="hidden md:flex items-center gap-2 text-xs" style={{ color: 'var(--br-txt2)' }}>
          <span>{employeeName}</span>
        </div>
      )}
    </div>
  );
}

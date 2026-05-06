import { useState } from 'react';
import type { ClientTab } from '@/types';
import type { useAuth } from '@/hooks/useAuth';
import { Toast, useToast } from '@/components/ui/Toast';
import { BookOpen, ClipboardList, Clock, User, LogOut } from 'lucide-react';
import { CatalogView } from './CatalogView';
import { MyOrdersView } from './MyOrdersView';
import { HistoryView } from './HistoryView';
import { AccountView } from './AccountView';

type AuthReturn = ReturnType<typeof useAuth>;
interface Props { auth: AuthReturn; }

const TABS: { id: ClientTab; label: string; Icon: React.ElementType }[] = [
  { id: 'catalog', label: 'Catálogo', Icon: BookOpen },
  { id: 'orders',  label: 'Mis Pedidos', Icon: ClipboardList },
  { id: 'history', label: 'Historial', Icon: Clock },
  { id: 'account', label: 'Mi Cuenta', Icon: User },
];

export function ClientApp({ auth }: Props) {
  const [tab, setTab] = useState<ClientTab>('catalog');
  const { toasts, addToast, removeToast } = useToast();

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--br-bg)' }}>
      {/* Header */}
      <header className="sticky top-0 z-40" style={{ background: 'var(--br-dark)', borderBottom: '1px solid #2a2520' }}>
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ background: 'var(--br-amb)' }}>B</div>
            <div>
              <p className="text-sm font-semibold text-white leading-tight">Baliña Ruedas</p>
              <p className="text-xs" style={{ color: '#9a9590' }}>{auth.clientName}</p>
            </div>
          </div>
          <button onClick={auth.logout} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg" style={{ color: '#9a9590', background: 'rgba(255,255,255,0.08)' }}>
            <LogOut className="h-3.5 w-3.5" /> Salir
          </button>
        </div>

        {/* Tab nav */}
        <div className="max-w-4xl mx-auto px-4 flex" style={{ borderTop: '1px solid #2a2520' }}>
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className="flex items-center gap-1.5 px-4 py-3 text-xs font-semibold transition-colors"
              style={{
                color: tab === id ? 'var(--br-amb)' : '#9a9590',
                borderBottom: tab === id ? '2px solid var(--br-amb)' : '2px solid transparent',
              }}>
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-5">
        {tab === 'catalog' && <CatalogView clientId={auth.clientId!} clientToken={auth.clientToken} addToast={addToast} />}
        {tab === 'orders'  && <MyOrdersView clientId={auth.clientId!} />}
        {tab === 'history' && <HistoryView clientToken={auth.clientToken} />}
        {tab === 'account' && <AccountView clientToken={auth.clientToken} />}
      </main>

      {toasts.map((t) => (
        <Toast key={t.id} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />
      ))}
    </div>
  );
}

import { useState } from 'react';
import type { EmployeeTab } from '@/types';
import type { useAuth } from '@/hooks/useAuth';
import { Toast, useToast } from '@/components/ui/Toast';
import {
  ShoppingCart, Package, Users, CreditCard,
  FileText, ClipboardList, BarChart2, Settings, LogOut,
} from 'lucide-react';
import { InventoryView } from './InventoryView';
import { POSView } from './POSView';
import { ClientsView } from './ClientsView';
import { AccountsView } from './AccountsView';
import { InvoicesView } from './InvoicesView';
import { OrdersView } from './OrdersView';
import { AnalyticsView } from './AnalyticsView';
import { SettingsView } from './SettingsView';

type AuthReturn = ReturnType<typeof useAuth>;
interface Props { auth: AuthReturn; }

const NAV_ITEMS: { id: EmployeeTab; label: string; Icon: React.ElementType }[] = [
  { id: 'pos',       label: 'Ventas',     Icon: ShoppingCart },
  { id: 'inventory', label: 'Inventario', Icon: Package },
  { id: 'clients',   label: 'Clientes',   Icon: Users },
  { id: 'accounts',  label: 'Cuentas',    Icon: CreditCard },
  { id: 'invoices',  label: 'Facturas',   Icon: FileText },
  { id: 'orders',    label: 'Pedidos',    Icon: ClipboardList },
  { id: 'analytics', label: 'Análisis',   Icon: BarChart2 },
  { id: 'settings',  label: 'Config.',    Icon: Settings },
];

export function EmployeeApp({ auth }: Props) {
  const [tab, setTab] = useState<EmployeeTab>('pos');
  const { toasts, addToast, removeToast } = useToast();

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--br-bg)' }}>
      {/* Sidebar */}
      <aside
        className="flex flex-col w-16 lg:w-52 flex-shrink-0 h-full"
        style={{ background: 'var(--br-dark)', borderRight: '1px solid #2a2520' }}
      >
        {/* Logo */}
        <div className="px-3 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid #2a2520' }}>
          <div
            className="w-9 h-9 flex items-center justify-center rounded-lg text-white font-bold text-lg flex-shrink-0"
            style={{ background: 'var(--br-amb)' }}
          >
            B
          </div>
          <div className="hidden lg:block overflow-hidden">
            <p className="text-sm font-semibold text-white truncate leading-tight">Baliña Ruedas</p>
            <p className="text-xs truncate" style={{ color: '#9a9590' }}>Empleado</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {NAV_ITEMS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-left"
              style={{
                color: tab === id ? 'var(--br-amb)' : '#9a9590',
                background: tab === id ? 'rgba(196,123,18,0.12)' : 'transparent',
                borderLeft: tab === id ? '3px solid var(--br-amb)' : '3px solid transparent',
              }}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              <span className="hidden lg:block text-sm font-medium">{label}</span>
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-3" style={{ borderTop: '1px solid #2a2520' }}>
          <button
            onClick={auth.logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors"
            style={{ color: '#9a9590' }}
            onMouseOver={(e) => (e.currentTarget.style.color = '#fff')}
            onMouseOut={(e) => (e.currentTarget.style.color = '#9a9590')}
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            <span className="hidden lg:block text-sm">Salir</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {tab === 'pos'       && <POSView       addToast={addToast} />}
        {tab === 'inventory' && <InventoryView addToast={addToast} />}
        {tab === 'clients'   && <ClientsView   addToast={addToast} />}
        {tab === 'accounts'  && <AccountsView  addToast={addToast} />}
        {tab === 'invoices'  && <InvoicesView  addToast={addToast} />}
        {tab === 'orders'    && <OrdersView    addToast={addToast} />}
        {tab === 'analytics' && <AnalyticsView />}
        {tab === 'settings'  && <SettingsView  auth={auth} addToast={addToast} />}
      </main>

      {/* Toasts */}
      {toasts.map((t) => (
        <Toast key={t.id} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />
      ))}
    </div>
  );
}

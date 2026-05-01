import { useState } from 'react';
import type { EmployeeTab, CashSession } from '@/types';
import type { useAuth } from '@/hooks/useAuth';
import { Toast, useToast } from '@/components/ui/Toast';
import { Spinner } from '@/components/ui/Spinner';
import {
  ShoppingCart, Package, Users, CreditCard,
  FileText, ClipboardList, BarChart2, Settings, LogOut,
} from 'lucide-react';
import { useStores } from '@/hooks/useStores';
import { useCashSession } from '@/hooks/useCashSession';
import { InventoryView } from './InventoryView';
import { POSView } from './POSView';
import { ClientsView } from './ClientsView';
import { AccountsView } from './AccountsView';
import { InvoicesView } from './InvoicesView';
import { OrdersView } from './OrdersView';
import { AnalyticsView } from './AnalyticsView';
import { SettingsView } from './SettingsView';
import { TopBar } from './TopBar';
import { OpenCashModal } from './cash/OpenCashModal';
import { CloseCashModal } from './cash/CloseCashModal';

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
  const [openCashOpen, setOpenCashOpen] = useState(false);
  const [closingSession, setClosingSession] = useState<CashSession | null>(null);
  const { toasts, addToast, removeToast } = useToast();

  const stores = useStores(auth.isAuthenticated);
  const cash = useCashSession(stores.activeStoreId, auth.employeeId ?? null);

  const activeStoreName = stores.activeStore?.name ?? 'Sin tienda';

  async function handleOpenCash(amount: number) {
    try {
      await cash.open(amount);
      addToast(`Caja abierta con ${amount.toLocaleString('es-AR')}`, 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error abriendo caja', 'error');
      throw e;
    }
  }

  async function handleCloseCash(amount: number) {
    const r = await cash.close(amount);
    addToast(
      r.variance === 0
        ? 'Caja cerrada sin descuadre'
        : `Caja cerrada con descuadre ${r.variance > 0 ? '+' : ''}${r.variance.toLocaleString('es-AR')}`,
      r.variance === 0 ? 'success' : 'warning',
    );
    return r;
  }

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
            <p className="text-xs truncate" style={{ color: '#9a9590' }}>{auth.employeeName ?? 'Empleado'}</p>
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

      {/* Main column */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar
          stores={stores.stores}
          activeStoreId={stores.activeStoreId}
          onSelectStore={stores.selectStore}
          session={cash.session}
          cashLoading={cash.loading || stores.loading}
          onOpenCash={() => setOpenCashOpen(true)}
          onCloseCash={() => { if (cash.session) setClosingSession(cash.session); }}
          employeeName={auth.employeeName}
        />

        <main className="flex-1 overflow-y-auto">
          {stores.loading ? (
            <div className="flex h-full items-center justify-center">
              <Spinner />
            </div>
          ) : !stores.activeStoreId ? (
            <div className="flex h-full items-center justify-center p-8">
              <div className="text-center max-w-sm">
                <p className="text-lg font-semibold mb-2" style={{ color: 'var(--br-txt)' }}>
                  {stores.stores.length === 0 ? 'No hay tiendas disponibles' : 'Seleccioná una tienda'}
                </p>
                <p className="text-sm" style={{ color: 'var(--br-txt2)' }}>
                  {stores.stores.length === 0
                    ? 'Pedí al admin que cree una tienda activa.'
                    : 'Elegí una tienda en la barra superior para continuar.'}
                </p>
              </div>
            </div>
          ) : (
            <>
              {tab === 'pos'       && <POSView       addToast={addToast} storeId={stores.activeStoreId} cashSession={cash.session} employeeId={auth.employeeId ?? null} employeeName={auth.employeeName} />}
              {tab === 'inventory' && <InventoryView addToast={addToast} activeStoreId={stores.activeStoreId} />}
              {tab === 'clients'   && <ClientsView   addToast={addToast} />}
              {tab === 'accounts'  && <AccountsView  addToast={addToast} employeeId={auth.employeeId ?? null} />}
              {tab === 'invoices'  && <InvoicesView  addToast={addToast} />}
              {tab === 'orders'    && <OrdersView    addToast={addToast} />}
              {tab === 'analytics' && <AnalyticsView storeId={stores.activeStoreId} />}
              {tab === 'settings'  && <SettingsView  auth={auth} addToast={addToast} activeStoreId={stores.activeStoreId} activeStoreName={stores.activeStore?.name} />}
            </>
          )}
        </main>
      </div>

      {/* Cash modals */}
      <OpenCashModal
        open={openCashOpen}
        storeName={activeStoreName}
        onClose={() => setOpenCashOpen(false)}
        onConfirm={handleOpenCash}
      />
      {closingSession && (
        <CloseCashModal
          open={true}
          session={closingSession}
          storeName={activeStoreName}
          onClose={() => setClosingSession(null)}
          onConfirm={handleCloseCash}
        />
      )}

      {/* Toasts */}
      {toasts.map((t) => (
        <Toast key={t.id} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />
      ))}
    </div>
  );
}

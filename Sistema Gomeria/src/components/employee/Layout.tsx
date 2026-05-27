import { useEffect, useMemo, useState } from 'react';
import type { EmployeeTab, CashSession, Permission } from '@/types';
import type { useAuth } from '@/hooks/useAuth';
import { Toast, useToast } from '@/components/ui/Toast';
import { Spinner } from '@/components/ui/Spinner';
import {
  ShoppingCart, Package, Users, CreditCard,
  FileText, ClipboardList, BarChart2, Settings, LogOut, UserCog,
} from 'lucide-react';
import { useStores } from '@/hooks/useStores';
import { useCashSession } from '@/hooks/useCashSession';
import { sessionReportServiceV2 } from '@/services/sessionReportServiceV2';
import { printSessionReport } from '@/utils/printSessionReport';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { useCurrentEmployee } from '@/hooks/useCurrentEmployee';
import { hasPermission } from '@/services/roleService';
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
import { EmployeeSelector } from './EmployeeSelector';
import { FirstRunWizard } from './FirstRunWizard';
import { needsFiscalSetup } from '@/services/storeService';
import { useAdminBootstrapCheck } from '@/hooks/useAdminBootstrapCheck';

type AuthReturn = ReturnType<typeof useAuth>;
interface Props { auth: AuthReturn; }

interface NavItem {
  id: EmployeeTab;
  label: string;
  Icon: React.ElementType;
  /** Permission requerido para ver este tab. `null` = visible para cualquier operador autenticado. */
  requires: Permission | null;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'pos',       label: 'Ventas',     Icon: ShoppingCart,   requires: 'pos.sell' },
  { id: 'inventory', label: 'Inventario', Icon: Package,        requires: 'tires.view' },
  { id: 'clients',   label: 'Clientes',   Icon: Users,          requires: 'customers.view' },
  { id: 'accounts',  label: 'Cuentas',    Icon: CreditCard,     requires: 'customers.view' },
  { id: 'invoices',  label: 'Facturas',   Icon: FileText,       requires: 'backoffice.access' },
  { id: 'orders',    label: 'Pedidos',    Icon: ClipboardList,  requires: 'backoffice.access' },
  { id: 'analytics', label: 'Análisis',   Icon: BarChart2,      requires: 'reports.view' },
  { id: 'settings',  label: 'Config.',    Icon: Settings,       requires: 'settings.manage' },
];

export function EmployeeApp({ auth }: Props) {
  const [tab, setTab] = useState<EmployeeTab>('pos');
  const [openCashOpen, setOpenCashOpen] = useState(false);
  const [closingSession, setClosingSession] = useState<CashSession | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const { toasts, addToast, removeToast } = useToast();

  const stores = useStores(auth.isAuthenticated);
  const current = useCurrentEmployee();
  const operatorId = current.employee?.id ?? auth.employeeId ?? null;
  const operatorName = current.employee?.name ?? auth.employeeName;
  const cash = useCashSession(stores.activeStoreId, operatorId);
  const adminCheck = useAdminBootstrapCheck(stores.activeStoreId);
  const offlineState = useOfflineQueue();

  const activeStoreName = stores.activeStore?.name ?? 'Sin tienda';

  const visibleNavItems = useMemo(
    () => NAV_ITEMS.filter(n => n.requires === null || hasPermission(current.employee?.role ?? null, n.requires)),
    [current.employee],
  );

  // Si el tab activo no es visible para el operador actual, fallback al primero disponible.
  useEffect(() => {
    if (visibleNavItems.length > 0 && !visibleNavItems.some(n => n.id === tab)) {
      setTab(visibleNavItems[0].id);
    }
  }, [visibleNavItems, tab]);

  async function handleOpenCash(amount: number) {
    try {
      await cash.open(amount);
      addToast(`Caja abierta con ${amount.toLocaleString('es-AR')}`, 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error abriendo caja', 'error');
      throw e;
    }
  }

  async function handleReport() {
    if (!cash.session) {
      addToast('No hay sesión de caja activa', 'warning');
      return;
    }
    setReportLoading(true);
    try {
      const report = await sessionReportServiceV2.forSession(cash.session.id);
      printSessionReport(report);
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error generando reporte', 'error');
    } finally {
      setReportLoading(false);
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
        aria-label="Navegación principal"
        className="flex flex-col w-16 lg:w-56 flex-shrink-0 h-full"
        style={{ background: 'var(--br-dark)', borderRight: '1px solid var(--br-dark-bor)' }}
      >
        {/* Logo */}
        <div className="px-3 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid var(--br-dark-bor)' }}>
          <div
            className="w-9 h-9 flex items-center justify-center rounded-lg text-white font-bold text-lg flex-shrink-0"
            style={{ background: 'var(--br-amb)' }}
          >
            B
          </div>
          <div className="hidden lg:block overflow-hidden">
            <p className="text-sm font-semibold text-white truncate leading-tight">Baliña Ruedas</p>
            <p className="text-xs truncate" style={{ color: 'var(--br-dark-txt2)' }}>
              {current.employee
                ? `${current.employee.name}${current.employee.role ? ` · ${current.employee.role.name}` : ''}`
                : auth.employeeName ?? 'Empleado'}
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {visibleNavItems.map(({ id, label, Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                title={label}
                className="w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-left"
                style={{
                  color: active ? 'var(--br-amb)' : 'var(--br-dark-txt2)',
                  background: active ? 'var(--br-dark-amb-bg)' : 'transparent',
                  borderLeft: active ? '3px solid var(--br-amb)' : '3px solid transparent',
                }}
              >
                <Icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                <span className="hidden lg:block text-sm font-medium truncate">{label}</span>
              </button>
            );
          })}
        </nav>

        {/* Switch operator + Logout */}
        <div className="p-3 space-y-1" style={{ borderTop: '1px solid var(--br-dark-bor)' }}>
          {current.employee && (
            <button
              onClick={current.logout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-[var(--br-dark-txt2)] hover:text-white hover:bg-white/8"
              title="Cambiar operador (no cierra sesión web)"
            >
              <UserCog className="h-5 w-5 flex-shrink-0" />
              <span className="hidden lg:block text-sm">Cambiar operador</span>
            </button>
          )}
          <button
            onClick={() => { current.logout(); auth.logout(); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-[var(--br-dark-txt2)] hover:text-white hover:bg-white/8"
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            <span className="hidden lg:block text-sm">Salir</span>
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <OfflineBanner state={offlineState} />
        <TopBar
          stores={stores.stores}
          activeStoreId={stores.activeStoreId}
          onSelectStore={stores.selectStore}
          session={cash.session}
          cashLoading={cash.loading || stores.loading}
          onOpenCash={() => setOpenCashOpen(true)}
          onCloseCash={() => { if (cash.session) setClosingSession(cash.session); }}
          onReport={cash.session ? () => { void handleReport(); } : undefined}
          reportLoading={reportLoading}
          employeeName={operatorName}
          canOpenCash={hasPermission(current.employee?.role ?? null, 'pos.openCash')}
          canCloseCash={hasPermission(current.employee?.role ?? null, 'pos.closeCash')}
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
              {tab === 'pos'       && <POSView       addToast={addToast} storeId={stores.activeStoreId} cashSession={cash.session} employeeId={operatorId} employeeName={operatorName} />}
              {tab === 'inventory' && <InventoryView addToast={addToast} activeStoreId={stores.activeStoreId} />}
              {tab === 'clients'   && <ClientsView   addToast={addToast} />}
              {tab === 'accounts'  && <AccountsView  addToast={addToast} employeeId={operatorId} />}
              {tab === 'invoices'  && <InvoicesView  addToast={addToast} />}
              {tab === 'orders'    && <OrdersView    addToast={addToast} storeId={stores.activeStoreId} />}
              {tab === 'analytics' && <AnalyticsView storeId={stores.activeStoreId} />}
              {tab === 'settings'  && <SettingsView  auth={auth} addToast={addToast} activeStoreId={stores.activeStoreId} activeStoreName={stores.activeStore?.name} currentRole={current.employee?.role ?? null} />}
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

      {/* Selector de operador: bloquea la UI hasta que el cajero ingrese su PIN.
          Solo visible si: hay tienda activa, no estamos cargando, y no hay operador. */}
      {!current.loading && !current.employee && stores.activeStoreId && (
        <EmployeeSelector
          storeId={stores.activeStoreId}
          loginWithPin={current.loginWithPin}
          onSelected={(r) => {
            if (r.ok) addToast('Operador identificado.', 'success');
            else addToast(r.reason, 'error');
          }}
        />
      )}

      {/* First run: bloquea con wizard mientras falte algo crítico:
          (a) identidad fiscal mínima en la tienda activa, o
          (b) ningún empleado con `settings.manage` (bootstrap admin).
          Caso (b) NO requiere permiso (justamente no hay nadie con permiso).
          Caso (a) sí requiere permiso porque el operador podría no ser admin. */}
      {stores.activeStore && (() => {
        const fiscalPending = needsFiscalSetup(stores.activeStore);
        const adminPending = adminCheck.needsAdmin === true;
        if (!fiscalPending && !adminPending) return null;
        // Si solo falta fiscal y el operador actual no es admin, no mostramos
        // el wizard (el admin lo verá cuando entre). Pero si falta el bootstrap
        // admin, lo mostramos siempre — es el caso "no hay admin todavía".
        if (fiscalPending && !adminPending && !hasPermission(current.employee?.role ?? null, 'settings.manage')) {
          return null;
        }
        return (
          <FirstRunWizard
            store={stores.activeStore}
            needsAdmin={adminPending}
            addToast={addToast}
            onCompleted={() => {
              void stores.refresh();
              adminCheck.recheck();
            }}
          />
        );
      })()}

      {/* Toasts */}
      {toasts.map((t) => (
        <Toast key={t.id} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />
      ))}
    </div>
  );
}

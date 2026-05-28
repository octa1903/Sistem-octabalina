import { useState, useEffect } from 'react';
import type { OrderConfig, WholesaleConfig } from '@/types';
import type { useAuth } from '@/hooks/useAuth';
import { backupService } from '@/services/storageService';
import { orderConfigService } from '@/services/orderConfigService';
import { wholesaleConfigService } from '@/services/wholesaleConfigService';
import { DEFAULT_ORDER_CONFIG, DEFAULT_WHOLESALE_CONFIG } from '@/constants';
import { Modal } from '@/components/ui/Modal';
import { TaxesSection } from './settings/TaxesSection';
import { DiscountsSection } from './settings/DiscountsSection';
import { LoyaltySection } from './settings/LoyaltySection';
import { ReceiptConfigSection } from './settings/ReceiptConfigSection';
import { StoreIdentitySection } from './settings/StoreIdentitySection';
import { EmployeesSection } from './settings/EmployeesSection';
import { BackupSection } from './settings/BackupSection';
import { RolesSection } from './settings/RolesSection';
import { SalespeopleSection } from './settings/SalespeopleSection';
import { InsuranceCompaniesSection } from './settings/InsuranceCompaniesSection';
import { hasPermission } from '@/services/roleService';
import type { Role } from '@/types';
import { Key, Download, Upload, ToggleLeft, ToggleRight, Plus, X } from 'lucide-react';
import { Button, IconButton, Input, FormField } from '@/components/ui';

type AuthReturn = ReturnType<typeof useAuth>;
interface Props {
  auth: AuthReturn;
  addToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  activeStoreId?: string | null;
  activeStoreName?: string;
  /** Rol del operador actual del TPV (para permission gates en secciones admin). */
  currentRole?: Role | null;
}

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

type SettingsTab = 'sales' | 'store' | 'people' | 'system';

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'sales', label: 'Ventas' },
  { id: 'store', label: 'Tienda' },
  { id: 'people', label: 'Personas' },
  { id: 'system', label: 'Sistema' },
];

export function SettingsView({ auth, addToast, activeStoreId, activeStoreName, currentRole }: Props) {
  const canManageEmployees = hasPermission(currentRole ?? null, 'employees.manage');
  const [tab, setTab] = useState<SettingsTab>('sales');
  const [orderConfig, setOrderConfig] = useState<OrderConfig>({ ...DEFAULT_ORDER_CONFIG });
  const [wholesaleConfig, setWholesaleConfig] = useState<WholesaleConfig>({ ...DEFAULT_WHOLESALE_CONFIG });
  const [configLoading, setConfigLoading] = useState(true);
  const [savingOrder, setSavingOrder] = useState(false);
  const [savingWholesale, setSavingWholesale] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdError, setPwdError] = useState('');

  useEffect(() => {
    let active = true;
    setConfigLoading(true);
    Promise.all([orderConfigService.get(), wholesaleConfigService.get()])
      .then(([oc, wc]) => {
        if (!active) return;
        setOrderConfig(oc);
        setWholesaleConfig(wc);
      })
      .catch((e) => { if (active) addToast(e instanceof Error ? e.message : 'Error cargando configuración.', 'error'); })
      .finally(() => { if (active) setConfigLoading(false); });
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveOrderConfig() {
    setSavingOrder(true);
    try {
      await orderConfigService.save(orderConfig);
      addToast('Configuración de pedidos guardada.', 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error guardando configuración de pedidos.', 'error');
    } finally {
      setSavingOrder(false);
    }
  }

  async function saveWholesaleConfig() {
    setSavingWholesale(true);
    try {
      await wholesaleConfigService.save(wholesaleConfig);
      addToast('Configuración mayorista guardada.', 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error guardando configuración mayorista.', 'error');
    } finally {
      setSavingWholesale(false);
    }
  }

  async function changePassword() {
    setPwdError('');
    if (newPwd !== confirmPwd) { setPwdError('Las contraseñas no coinciden.'); return; }
    if (newPwd.length < 4) { setPwdError('Mínimo 4 caracteres.'); return; }
    const ok = await auth.changeEmployeePassword(currentPwd, newPwd);
    if (ok) {
      setPwdOpen(false);
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
      addToast('Contraseña actualizada.', 'success');
    } else {
      setPwdError('Contraseña actual incorrecta.');
    }
  }

  function exportBackup() {
    const data = backupService.exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `balina-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    backupService.setLastBackup();
    addToast('Backup descargado.', 'success');
  }

  function importBackup(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const json = ev.target?.result as string;
      if (backupService.importData(json)) {
        addToast('Backup importado. Recargá la página.', 'info');
        setTimeout(() => window.location.reload(), 1500);
      } else {
        addToast('Archivo inválido.', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function addTimeSlot() {
    setOrderConfig((prev) => ({
      ...prev,
      timeSlots: [...prev.timeSlots, ''],
    }));
  }

  function updateTimeSlot(i: number, value: string) {
    setOrderConfig((prev) => {
      const ts = [...prev.timeSlots];
      ts[i] = value;
      return { ...prev, timeSlots: ts };
    });
  }

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}>
      <div className="px-6 py-3" style={{ background: 'var(--br-sur2)', borderBottom: '1px solid var(--br-bor)' }}>
        <p className="font-semibold text-sm" style={{ color: 'var(--br-txt)' }}>{title}</p>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );

  const label = (text: string, sub?: string) => (
    <div>
      <p className="text-sm font-medium" style={{ color: 'var(--br-txt)' }}>{text}</p>
      {sub && <p className="text-xs" style={{ color: 'var(--br-txt2)' }}>{sub}</p>}
    </div>
  );

  const salesPanel = (
    <div className="space-y-6">
      <TaxesSection addToast={addToast} />
      <DiscountsSection addToast={addToast} />
      <LoyaltySection addToast={addToast} />
      <Section title="Configuración Mayorista">
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Descuento Mayorista (%)', key: 'globalDiscount' as const },
            { label: 'Mín. unidades por ítem', key: 'minUnitsPerItem' as const },
            { label: 'Mín. monto pedido ($)', key: 'minOrderAmount' as const },
          ].map(({ label: l, key }) => (
            <FormField key={key} label={l}>
              <Input
                type="number"
                min="0"
                value={wholesaleConfig[key]}
                onChange={(e) => setWholesaleConfig({ ...wholesaleConfig, [key]: Number(e.target.value) })}
              />
            </FormField>
          ))}
        </div>
        <div className="mt-4">
          <Button
            variant="primary"
            loading={savingWholesale}
            disabled={configLoading}
            onClick={() => { void saveWholesaleConfig(); }}
          >
            Guardar configuración mayorista
          </Button>
        </div>
      </Section>
    </div>
  );

  const storePanel = (
    <div className="space-y-6">
      <StoreIdentitySection
        storeId={activeStoreId ?? null}
        storeName={activeStoreName ?? 'Tienda'}
        addToast={addToast}
      />
      <ReceiptConfigSection
        storeId={activeStoreId ?? null}
        storeName={activeStoreName ?? 'Tienda'}
        addToast={addToast}
      />
      <Section title="Disponibilidad para Pedidos">
        <div className="space-y-4">
          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            {label('Habilitar pedidos online', 'Permite que los clientes hagan pedidos desde su acceso.')}
            <button
              onClick={() => setOrderConfig((p) => ({ ...p, enabled: !p.enabled }))}
              aria-pressed={orderConfig.enabled}
              aria-label={`Pedidos online: ${orderConfig.enabled ? 'habilitados' : 'deshabilitados'}`}
              style={{ color: orderConfig.enabled ? 'var(--br-grn)' : 'var(--br-txt2)' }}
            >
              {orderConfig.enabled
                ? <ToggleRight className="h-8 w-8" aria-hidden="true" />
                : <ToggleLeft className="h-8 w-8" aria-hidden="true" />}
            </button>
          </div>

          {/* Work days */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--br-txt2)' }}>Días hábiles</label>
            <div className="flex gap-2 flex-wrap">
              {DAYS.map((d, i) => (
                <button key={i} onClick={() => {
                  const wd = [...orderConfig.workDays]; wd[i] = !wd[i];
                  setOrderConfig((p) => ({ ...p, workDays: wd }));
                }}
                  className="w-11 py-1.5 rounded-lg text-sm font-semibold transition-colors"
                  style={{
                    background: orderConfig.workDays[i] ? 'var(--br-amb)' : 'var(--br-sur2)',
                    color: orderConfig.workDays[i] ? 'var(--br-sur)' : 'var(--br-txt2)',
                    border: '1px solid var(--br-bor)',
                  }}>
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Days ahead */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Mín. días anticipación', key: 'minDaysAhead' as const },
              { label: 'Máx. días anticipación', key: 'maxDaysAhead' as const },
              { label: 'Máx. pedidos por día', key: 'maxOrdersPerDay' as const },
            ].map(({ label: l, key }) => (
              <FormField key={key} label={l}>
                <Input
                  type="number"
                  min="0"
                  value={orderConfig[key]}
                  onChange={(e) => setOrderConfig({ ...orderConfig, [key]: Number(e.target.value) })}
                />
              </FormField>
            ))}
          </div>

          {/* Time slots */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--br-txt2)' }}>Horarios disponibles</label>
            <div className="space-y-2">
              {orderConfig.timeSlots.map((ts, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    type="text"
                    value={ts}
                    onChange={(e) => updateTimeSlot(i, e.target.value)}
                    className="flex-1"
                  />
                  <IconButton
                    label="Quitar horario"
                    icon={<X className="h-4 w-4" />}
                    tone="danger"
                    size="md"
                    onClick={() => setOrderConfig((p) => ({ ...p, timeSlots: p.timeSlots.filter((_, j) => j !== i) }))}
                  />
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                iconLeft={<Plus className="h-4 w-4" />}
                onClick={addTimeSlot}
              >
                Agregar horario
              </Button>
            </div>
          </div>

          <Button
            variant="primary"
            loading={savingOrder}
            disabled={configLoading}
            onClick={() => { void saveOrderConfig(); }}
          >
            Guardar configuración de pedidos
          </Button>
        </div>
      </Section>
    </div>
  );

  const peoplePanel = (
    <div className="space-y-6">
      {canManageEmployees && <EmployeesSection addToast={addToast} />}
      {canManageEmployees && (
        <Section title="Roles · Tope de descuento">
          <RolesSection addToast={addToast} />
        </Section>
      )}
      <SalespeopleSection addToast={addToast} storeId={activeStoreId ?? null} />
      <InsuranceCompaniesSection addToast={addToast} />
    </div>
  );

  const systemPanel = (
    <div className="space-y-6">
      <Section title="Seguridad">
        <div className="flex items-center justify-between">
          {label('Contraseña de empleado', 'Cambiá la contraseña de acceso al sistema.')}
          <Button
            variant="secondary"
            iconLeft={<Key className="h-4 w-4" />}
            onClick={() => setPwdOpen(true)}
          >
            Cambiar contraseña
          </Button>
        </div>
      </Section>
      <BackupSection addToast={addToast} />
      <Section title="Respaldo local (legacy)">
        <div className="flex items-center justify-between flex-wrap gap-3">
          {label('Exportar / Importar localStorage', 'Solo respalda configuración local (no toca Supabase). Usá esto si moviste datos legacy.')}
          <div className="flex gap-2">
            <Button variant="secondary" iconLeft={<Download className="h-4 w-4" />} onClick={exportBackup}>
              Exportar
            </Button>
            <label className="inline-flex items-center gap-2 h-10 px-4 rounded-lg text-sm font-semibold cursor-pointer transition-colors hover:bg-[var(--br-sur2)]"
              style={{ border: '1px solid var(--br-bor)', color: 'var(--br-txt)', background: 'var(--br-sur)' }}>
              <Upload className="h-4 w-4" /> Importar
              <input type="file" accept=".json" className="hidden" onChange={importBackup} />
            </label>
          </div>
        </div>
      </Section>
    </div>
  );

  const panels: Record<SettingsTab, React.ReactNode> = {
    sales: salesPanel,
    store: storePanel,
    people: peoplePanel,
    system: systemPanel,
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-xl font-semibold" style={{ color: 'var(--br-txt)' }}>Configuración</h1>

      <div
        role="tablist"
        aria-label="Secciones de configuración"
        className="flex gap-1 p-1 rounded-xl"
        style={{ background: 'var(--br-sur2)', border: '1px solid var(--br-bor)' }}
      >
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              aria-controls={`settings-panel-${t.id}`}
              id={`settings-tab-${t.id}`}
              onClick={() => setTab(t.id)}
              className="flex-1 py-2 rounded-lg text-sm font-semibold transition-colors"
              style={{
                background: active ? 'var(--br-sur)' : 'transparent',
                color: active ? 'var(--br-txt)' : 'var(--br-txt2)',
                boxShadow: active ? 'var(--br-shadow-sm)' : 'none',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`settings-panel-${tab}`}
        aria-labelledby={`settings-tab-${tab}`}
      >
        {panels[tab]}
      </div>

      {/* Change password modal */}
      <Modal open={pwdOpen} onClose={() => setPwdOpen(false)} title="Cambiar Contraseña Empleado" size="sm">
        <div className="space-y-3">
          <FormField label="Contraseña actual">
            <Input type="password" value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} />
          </FormField>
          <FormField label="Nueva contraseña">
            <Input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
          </FormField>
          <FormField label="Confirmar contraseña">
            <Input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} />
          </FormField>
          {pwdError && (
            <p role="alert" className="text-sm px-3 py-2 rounded-lg" style={{ background: 'var(--br-red-bg)', color: 'var(--br-red)', border: '1px solid var(--br-red-bor)' }}>
              {pwdError}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" onClick={() => setPwdOpen(false)}>Cancelar</Button>
          <Button variant="primary" onClick={() => { void changePassword(); }}>
            Actualizar contraseña
          </Button>
        </div>
      </Modal>
    </div>
  );
}

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
import { EmployeesSection } from './settings/EmployeesSection';
import { hasPermission } from '@/services/roleService';
import type { Role } from '@/types';
import { Key, Download, Upload, ToggleLeft, ToggleRight } from 'lucide-react';

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

export function SettingsView({ auth, addToast, activeStoreId, activeStoreName, currentRole }: Props) {
  const canManageEmployees = hasPermission(currentRole ?? null, 'employees.manage');
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
      <div className="px-5 py-3" style={{ background: 'var(--br-sur2)', borderBottom: '1px solid var(--br-bor)' }}>
        <p className="font-semibold text-sm" style={{ color: 'var(--br-txt)' }}>{title}</p>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );

  const label = (text: string, sub?: string) => (
    <div>
      <p className="text-sm font-medium" style={{ color: 'var(--br-txt)' }}>{text}</p>
      {sub && <p className="text-xs" style={{ color: 'var(--br-txt2)' }}>{sub}</p>}
    </div>
  );

  return (
    <div className="p-5 max-w-3xl mx-auto space-y-5">
      <h1 className="text-xl font-semibold" style={{ color: 'var(--br-txt)' }}>Configuración</h1>

      {/* Taxes */}
      <TaxesSection addToast={addToast} />

      {/* Discounts */}
      <DiscountsSection addToast={addToast} />

      {/* Loyalty */}
      <LoyaltySection addToast={addToast} />

      {/* Receipt config */}
      <ReceiptConfigSection
        storeId={activeStoreId ?? null}
        storeName={activeStoreName ?? 'Tienda'}
        addToast={addToast}
      />

      {/* Empleados (solo con employees.manage) */}
      {canManageEmployees && <EmployeesSection addToast={addToast} />}

      {/* Security */}
      <Section title="Seguridad">
        <div className="flex items-center justify-between">
          {label('Contraseña de empleado', 'Cambiá la contraseña de acceso al sistema.')}
          <button onClick={() => setPwdOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: 'var(--br-dark)' }}>
            <Key className="h-4 w-4" /> Cambiar contraseña
          </button>
        </div>
      </Section>

      {/* Backup */}
      <Section title="Respaldo de datos">
        <div className="flex items-center justify-between flex-wrap gap-3">
          {label('Exportar / Importar', 'Guardá una copia de todos los datos o restaurá desde un backup.')}
          <div className="flex gap-2">
            <button onClick={exportBackup}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ border: '1px solid var(--br-bor)', color: 'var(--br-txt)' }}>
              <Download className="h-4 w-4" /> Exportar
            </button>
            <label className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer"
              style={{ border: '1px solid var(--br-bor)', color: 'var(--br-txt)' }}>
              <Upload className="h-4 w-4" /> Importar
              <input type="file" accept=".json" className="hidden" onChange={importBackup} />
            </label>
          </div>
        </div>
      </Section>

      {/* Wholesale */}
      <Section title="Configuración Mayorista">
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Descuento Mayorista (%)', key: 'globalDiscount' as const },
            { label: 'Mín. unidades por ítem', key: 'minUnitsPerItem' as const },
            { label: 'Mín. monto pedido ($)', key: 'minOrderAmount' as const },
          ].map(({ label: l, key }) => (
            <div key={key}>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>{l}</label>
              <input type="number" min="0" value={wholesaleConfig[key]}
                onChange={(e) => setWholesaleConfig({ ...wholesaleConfig, [key]: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--br-amb)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--br-bor)')} />
            </div>
          ))}
        </div>
        <button onClick={saveWholesaleConfig} disabled={savingWholesale || configLoading}
          className="mt-4 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ background: 'var(--br-amb)' }}>
          {savingWholesale ? 'Guardando…' : 'Guardar configuración mayorista'}
        </button>
      </Section>

      {/* Order config */}
      <Section title="Disponibilidad para Pedidos">
        <div className="space-y-4">
          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            {label('Habilitar pedidos online', 'Permite que los clientes hagan pedidos desde su acceso.')}
            <button onClick={() => setOrderConfig((p) => ({ ...p, enabled: !p.enabled }))}
              style={{ color: orderConfig.enabled ? 'var(--br-grn)' : 'var(--br-txt2)' }}>
              {orderConfig.enabled
                ? <ToggleRight className="h-8 w-8" />
                : <ToggleLeft className="h-8 w-8" />}
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
                    color: orderConfig.workDays[i] ? '#fff' : 'var(--br-txt2)',
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
              <div key={key}>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>{l}</label>
                <input type="number" min="0" value={orderConfig[key]}
                  onChange={(e) => setOrderConfig({ ...orderConfig, [key]: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }} />
              </div>
            ))}
          </div>

          {/* Time slots */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--br-txt2)' }}>Horarios disponibles</label>
            <div className="space-y-2">
              {orderConfig.timeSlots.map((ts, i) => (
                <div key={i} className="flex gap-2">
                  <input type="text" value={ts} onChange={(e) => updateTimeSlot(i, e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }} />
                  <button onClick={() => setOrderConfig((p) => ({ ...p, timeSlots: p.timeSlots.filter((_, j) => j !== i) }))}
                    className="px-3 py-2 rounded-lg text-sm" style={{ color: 'var(--br-red)', background: 'var(--br-red-bg)', border: '1px solid var(--br-red-bor)' }}>
                    ✕
                  </button>
                </div>
              ))}
              <button onClick={addTimeSlot} className="text-sm font-medium" style={{ color: 'var(--br-amb)' }}>+ Agregar horario</button>
            </div>
          </div>

          <button onClick={saveOrderConfig} disabled={savingOrder || configLoading}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ background: 'var(--br-amb)' }}>
            {savingOrder ? 'Guardando…' : 'Guardar configuración de pedidos'}
          </button>
        </div>
      </Section>

      {/* Change password modal */}
      <Modal open={pwdOpen} onClose={() => setPwdOpen(false)} title="Cambiar Contraseña Empleado" size="sm">
        <div className="space-y-3">
          {['Contraseña actual', 'Nueva contraseña', 'Confirmar contraseña'].map((lbl, i) => {
            const keys = [currentPwd, newPwd, confirmPwd];
            const setters = [setCurrentPwd, setNewPwd, setConfirmPwd];
            return (
              <div key={i}>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>{lbl}</label>
                <input type="password" value={keys[i]} onChange={(e) => setters[i](e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--br-amb)')}
                  onBlur={(e) => (e.target.style.borderColor = 'var(--br-bor)')} />
              </div>
            );
          })}
          {pwdError && <p className="text-sm px-3 py-2 rounded-lg" style={{ background: 'var(--br-red-bg)', color: 'var(--br-red)' }}>{pwdError}</p>}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => setPwdOpen(false)} className="px-4 py-2 rounded-lg text-sm" style={{ border: '1px solid var(--br-bor)', color: 'var(--br-txt2)' }}>Cancelar</button>
          <button onClick={changePassword} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: 'var(--br-dark)' }}>
            Actualizar contraseña
          </button>
        </div>
      </Modal>
    </div>
  );
}

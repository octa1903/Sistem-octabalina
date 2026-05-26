import { useState } from 'react';
import type { FiscalIdentity, Store } from '@/types';
import { storeService, validateFiscalIdentity } from '@/services/storeService';
import { Button, Input, FormField } from '@/components/ui';
import { Building2, ShieldCheck } from 'lucide-react';

interface Props {
  store: Store;
  addToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  onCompleted: () => void;
}

const EMPTY: FiscalIdentity = {
  razonSocial: '',
  cuit: '',
  iibb: '',
  inicioActiv: '',
  dirTel: '',
  localidad: '',
  ivaCondition: 'Responsable Inscripto',
};

const IVA_OPTIONS = [
  'Responsable Inscripto',
  'Monotributo',
  'Exento',
  'Consumidor Final',
  'No Responsable',
];

/**
 * Devuelve true cuando la tienda todavía no tiene identidad fiscal mínima cargada.
 * "Mínimo" = razón social + CUIT, lo único que necesita un recibo legal.
 */
export function needsFirstRunSetup(store: Store | null | undefined): boolean {
  if (!store) return false;
  const fi = store.fiscalIdentity;
  if (!fi) return true;
  return !fi.razonSocial?.trim() || !fi.cuit?.trim();
}

export function FirstRunWizard({ store, addToast, onCompleted }: Props) {
  const [data, setData] = useState<FiscalIdentity>({ ...EMPTY, ...(store.fiscalIdentity ?? {}) });
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof FiscalIdentity>(field: K, value: FiscalIdentity[K]) {
    setData(prev => ({ ...prev, [field]: value }));
    if (errors.length > 0) setErrors([]);
  }

  async function save() {
    const validation = validateFiscalIdentity(data);
    if (validation.length > 0) {
      setErrors(validation);
      return;
    }
    setSaving(true);
    try {
      await storeService.updateFiscalIdentity(store.id, data);
      addToast('Identidad fiscal guardada.', 'success');
      onCompleted();
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error guardando.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-run-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}
      >
        <div
          className="px-6 py-5 flex items-start gap-3"
          style={{ borderBottom: '1px solid var(--br-bor)', background: 'var(--br-dark-amb-bg)' }}
        >
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--br-amb)' }}
          >
            <Building2 className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          <div>
            <h2 id="first-run-title" className="text-lg font-semibold" style={{ color: 'var(--br-txt)' }}>
              Configurá los datos fiscales de {store.name}
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--br-txt2)' }}>
              Estos datos aparecen en cada recibo y factura. Solo razón social y CUIT son obligatorios;
              el resto lo podés completar más adelante desde Configuración.
            </p>
          </div>
        </div>

        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Razón social *">
              <Input
                autoFocus
                value={data.razonSocial}
                onChange={e => update('razonSocial', e.target.value)}
                placeholder="Baliña Ruedas S.A."
              />
            </FormField>
            <FormField label="CUIT *">
              <Input
                value={data.cuit}
                onChange={e => update('cuit', e.target.value)}
                placeholder="30-12345678-9"
              />
            </FormField>
            <FormField label="IIBB">
              <Input
                value={data.iibb ?? ''}
                onChange={e => update('iibb', e.target.value)}
                placeholder="Número de ingresos brutos"
              />
            </FormField>
            <FormField label="Inicio de actividades">
              <Input
                type="date"
                value={data.inicioActiv ?? ''}
                onChange={e => update('inicioActiv', e.target.value)}
              />
            </FormField>
            <FormField label="Domicilio fiscal / teléfono">
              <Input
                value={data.dirTel ?? ''}
                onChange={e => update('dirTel', e.target.value)}
                placeholder="Av. Independencia 1234 · Tel: 0223-..."
              />
            </FormField>
            <FormField label="Localidad">
              <Input
                value={data.localidad ?? ''}
                onChange={e => update('localidad', e.target.value)}
                placeholder="Mar del Plata"
              />
            </FormField>
            <FormField label="Condición frente al IVA">
              <select
                value={data.ivaCondition ?? 'Responsable Inscripto'}
                onChange={e => update('ivaCondition', e.target.value)}
                className="w-full h-10 px-3 rounded-lg text-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--br-amb)]"
                style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}
              >
                {IVA_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </FormField>
          </div>

          {errors.length > 0 && (
            <ul
              role="alert"
              className="mt-4 text-sm px-3 py-2 rounded-lg space-y-1"
              style={{ background: 'var(--br-red-bg)', color: 'var(--br-red)', border: '1px solid var(--br-red-bor)' }}
            >
              {errors.map(e => <li key={e}>{e}</li>)}
            </ul>
          )}
        </div>

        <div
          className="px-6 py-4 flex items-center justify-between gap-3"
          style={{ borderTop: '1px solid var(--br-bor)', background: 'var(--br-bg)' }}
        >
          <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--br-txt2)' }}>
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Estos datos se guardan cifrados en tu base de datos.
          </p>
          <Button
            variant="primary"
            loading={saving}
            onClick={() => { void save(); }}
          >
            Guardar y continuar
          </Button>
        </div>
      </div>
    </div>
  );
}

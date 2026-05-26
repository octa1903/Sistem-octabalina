import { useState, useEffect, useCallback } from 'react';
import type { FiscalIdentity } from '@/types';
import { storeService, validateFiscalIdentity } from '@/services/storeService';
import { Button, Input, FormField } from '@/components/ui';
import { Building2, Save } from 'lucide-react';

interface Props {
  storeId: string | null;
  storeName: string;
  addToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
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

export function StoreIdentitySection({ storeId, storeName, addToast }: Props) {
  const [data, setData] = useState<FiscalIdentity>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const store = await storeService.getById(storeId);
      setData(store?.fiscalIdentity ?? EMPTY);
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error cargando datos fiscales.', 'error');
    } finally {
      setLoading(false);
    }
  }, [storeId, addToast]);

  useEffect(() => { void load(); }, [load]);

  function update<K extends keyof FiscalIdentity>(field: K, value: FiscalIdentity[K]) {
    setData(prev => ({ ...prev, [field]: value }));
    if (errors.length > 0) setErrors([]);
  }

  async function save() {
    if (!storeId) return;
    const validation = validateFiscalIdentity(data);
    if (validation.length > 0) {
      setErrors(validation);
      return;
    }
    setSaving(true);
    try {
      await storeService.updateFiscalIdentity(storeId, data);
      addToast('Identidad fiscal guardada.', 'success');
      setErrors([]);
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error guardando.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}>
      <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid var(--br-bor)' }}>
        <Building2 className="h-5 w-5" style={{ color: 'var(--br-amb)' }} />
        <h2 className="font-semibold" style={{ color: 'var(--br-txt)' }}>Identidad fiscal del negocio</h2>
        <span className="text-xs" style={{ color: 'var(--br-txt2)' }}>· {storeName}</span>
      </div>

      <div className="px-5 py-4">
        {loading ? (
          <p className="text-sm py-4 text-center" style={{ color: 'var(--br-txt2)' }}>Cargando...</p>
        ) : !storeId ? (
          <p className="text-sm py-4 text-center" style={{ color: 'var(--br-txt2)' }}>
            Seleccioná una tienda activa para configurar la identidad fiscal.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Razón social *">
                <Input
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
                className="text-sm px-3 py-2 rounded-lg space-y-1"
                style={{ background: 'var(--br-red-bg)', color: 'var(--br-red)', border: '1px solid var(--br-red-bor)' }}
              >
                {errors.map(e => <li key={e}>{e}</li>)}
              </ul>
            )}

            <div className="flex justify-end">
              <Button
                variant="primary"
                loading={saving}
                iconLeft={<Save className="h-4 w-4" />}
                onClick={() => { void save(); }}
              >
                Guardar identidad fiscal
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

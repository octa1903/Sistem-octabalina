import { useState, useEffect, useCallback, useMemo } from 'react';
import type { FiscalIdentity } from '@/types';
import {
  storeService,
  validateFiscalIdentity,
  hasErrors,
  EMPTY_FISCAL_IDENTITY,
  type FiscalErrors,
} from '@/services/storeService';
import { Button } from '@/components/ui';
import { Building2, Save } from 'lucide-react';
import { FiscalIdentityForm } from './FiscalIdentityForm';

interface Props {
  storeId: string | null;
  storeName: string;
  addToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

function shallowEqual(a: FiscalIdentity, b: FiscalIdentity): boolean {
  const keys = Object.keys(EMPTY_FISCAL_IDENTITY) as (keyof FiscalIdentity)[];
  return keys.every(k => (a[k] ?? '') === (b[k] ?? ''));
}

export function StoreIdentitySection({ storeId, storeName, addToast }: Props) {
  const [data, setData] = useState<FiscalIdentity>(EMPTY_FISCAL_IDENTITY);
  const [loaded, setLoaded] = useState<FiscalIdentity>(EMPTY_FISCAL_IDENTITY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState<Set<keyof FiscalIdentity>>(new Set());

  const errors: FiscalErrors = useMemo(() => validateFiscalIdentity(data), [data]);
  const dirty = !shallowEqual(data, loaded);

  const load = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const store = await storeService.getById(storeId);
      const next = store?.fiscalIdentity ?? EMPTY_FISCAL_IDENTITY;
      setData(next);
      setLoaded(next);
      setTouched(new Set());
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error cargando datos fiscales.', 'error');
    } finally {
      setLoading(false);
    }
  }, [storeId, addToast]);

  useEffect(() => { void load(); }, [load]);

  function markTouched(field: keyof FiscalIdentity) {
    setTouched(prev => {
      if (prev.has(field)) return prev;
      const next = new Set(prev);
      next.add(field);
      return next;
    });
  }

  async function save() {
    if (!storeId) return;
    // Marcar todos los campos como touched para revelar errores pendientes al hacer submit.
    setTouched(new Set(Object.keys(EMPTY_FISCAL_IDENTITY) as (keyof FiscalIdentity)[]));
    if (hasErrors(errors)) return;
    setSaving(true);
    try {
      await storeService.updateFiscalIdentity(storeId, data);
      addToast('Identidad fiscal guardada.', 'success');
      setLoaded(data);
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
            <FiscalIdentityForm
              value={data}
              errors={errors}
              touched={touched}
              onChange={setData}
              onBlurField={markTouched}
            />

            <div className="flex justify-end">
              <Button
                variant="primary"
                loading={saving}
                disabled={!dirty}
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

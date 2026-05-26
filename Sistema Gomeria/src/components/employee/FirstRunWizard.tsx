import { useMemo, useState } from 'react';
import type { FiscalIdentity, Store } from '@/types';
import {
  storeService,
  validateFiscalIdentity,
  hasErrors,
  EMPTY_FISCAL_IDENTITY,
  type FiscalErrors,
} from '@/services/storeService';
import { Button } from '@/components/ui';
import { Building2 } from 'lucide-react';
import { FiscalIdentityForm } from './settings/FiscalIdentityForm';

interface Props {
  store: Store;
  addToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  onCompleted: () => void;
}

export function FirstRunWizard({ store, addToast, onCompleted }: Props) {
  const [data, setData] = useState<FiscalIdentity>({
    ...EMPTY_FISCAL_IDENTITY,
    ...(store.fiscalIdentity ?? {}),
  });
  const [touched, setTouched] = useState<Set<keyof FiscalIdentity>>(new Set());
  const [saving, setSaving] = useState(false);

  const errors: FiscalErrors = useMemo(() => validateFiscalIdentity(data), [data]);

  function markTouched(field: keyof FiscalIdentity) {
    setTouched(prev => {
      if (prev.has(field)) return prev;
      const next = new Set(prev);
      next.add(field);
      return next;
    });
  }

  async function save() {
    setTouched(new Set(Object.keys(EMPTY_FISCAL_IDENTITY) as (keyof FiscalIdentity)[]));
    if (hasErrors(errors)) return;
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ background: 'rgba(26, 24, 20, 0.45)' }}
    >
      <div
        className="w-full max-w-2xl overflow-hidden"
        style={{
          background: 'var(--br-sur)',
          border: '1px solid var(--br-bor)',
          borderRadius: 'var(--br-radius-lg)',
          boxShadow: 'var(--br-shadow-lg)',
        }}
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
          <FiscalIdentityForm
            value={data}
            errors={errors}
            touched={touched}
            onChange={setData}
            onBlurField={markTouched}
            autoFocusFirst
          />
        </div>

        <div
          className="px-6 py-4 flex justify-end"
          style={{ borderTop: '1px solid var(--br-bor)', background: 'var(--br-bg)' }}
        >
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

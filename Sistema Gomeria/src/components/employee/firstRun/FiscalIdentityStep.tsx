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
import { FiscalIdentityForm } from '../settings/FiscalIdentityForm';

interface Props {
  store: Store;
  addToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  onDone: () => void;
}

/**
 * Paso del wizard que captura razón social, CUIT, IIBB, IVA, etc.
 * Se renderiza cuando `needsFiscalSetup(store)` devolvió true.
 */
export function FiscalIdentityStep({ store, addToast, onDone }: Props) {
  const [data, setData] = useState<FiscalIdentity>({
    ...EMPTY_FISCAL_IDENTITY,
    ...(store.fiscalIdentity ?? {}),
  });
  const [touched, setTouched] = useState<Set<keyof FiscalIdentity>>(new Set());
  const [saving, setSaving] = useState(false);

  const errors: FiscalErrors = useMemo(() => validateFiscalIdentity(data), [data]);

  function markTouched(field: keyof FiscalIdentity) {
    setTouched((prev) => {
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
      onDone();
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error guardando.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: 'var(--br-txt2)' }}>
        Estos datos aparecen en cada recibo y factura. Solo razón social y CUIT son obligatorios; el resto lo
        podés completar más adelante desde Configuración.
      </p>
      <FiscalIdentityForm
        value={data}
        errors={errors}
        touched={touched}
        onChange={setData}
        onBlurField={markTouched}
        autoFocusFirst
      />
      <div className="flex justify-end pt-2">
        <Button
          variant="primary"
          loading={saving}
          onClick={() => {
            void save();
          }}
        >
          Guardar y continuar
        </Button>
      </div>
    </div>
  );
}

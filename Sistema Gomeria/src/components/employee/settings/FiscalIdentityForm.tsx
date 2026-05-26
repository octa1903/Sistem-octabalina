import type { FiscalIdentity } from '@/types';
import { Input, Select, FormField } from '@/components/ui';
import { IVA_OPTIONS, formatCuit, type FiscalErrors } from '@/services/storeService';

interface Props {
  value: FiscalIdentity;
  errors: FiscalErrors;
  touched: Set<keyof FiscalIdentity>;
  onChange: (next: FiscalIdentity) => void;
  onBlurField: (field: keyof FiscalIdentity) => void;
  autoFocusFirst?: boolean;
}

export function FiscalIdentityForm({
  value,
  errors,
  touched,
  onChange,
  onBlurField,
  autoFocusFirst,
}: Props) {
  function update<K extends keyof FiscalIdentity>(field: K, fieldValue: FiscalIdentity[K]) {
    onChange({ ...value, [field]: fieldValue });
  }

  function err(field: keyof FiscalIdentity): string | undefined {
    return touched.has(field) ? errors[field] : undefined;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <FormField label="Razón social" required error={err('razonSocial')}>
        <Input
          sizeVariant="lg"
          autoFocus={autoFocusFirst}
          value={value.razonSocial}
          onChange={e => update('razonSocial', e.target.value)}
          onBlur={() => onBlurField('razonSocial')}
          placeholder="Baliña Ruedas S.A."
        />
      </FormField>

      <FormField label="CUIT" required error={err('cuit')}>
        <Input
          sizeVariant="lg"
          value={value.cuit}
          onChange={e => update('cuit', e.target.value)}
          onBlur={() => {
            const normalized = formatCuit(value.cuit);
            if (normalized !== value.cuit) update('cuit', normalized);
            onBlurField('cuit');
          }}
          placeholder="30-12345678-9"
          inputMode="numeric"
        />
      </FormField>

      <FormField label="IIBB">
        <Input
          sizeVariant="lg"
          value={value.iibb ?? ''}
          onChange={e => update('iibb', e.target.value)}
          placeholder="Número de ingresos brutos"
        />
      </FormField>

      <FormField label="Inicio de actividades" error={err('inicioActiv')}>
        <Input
          sizeVariant="lg"
          type="date"
          value={value.inicioActiv ?? ''}
          onChange={e => update('inicioActiv', e.target.value)}
          onBlur={() => onBlurField('inicioActiv')}
        />
      </FormField>

      <FormField label="Domicilio fiscal / teléfono">
        <Input
          sizeVariant="lg"
          value={value.dirTel ?? ''}
          onChange={e => update('dirTel', e.target.value)}
          placeholder="Av. Independencia 1234 · Tel: 0223-..."
        />
      </FormField>

      <FormField label="Localidad">
        <Input
          sizeVariant="lg"
          value={value.localidad ?? ''}
          onChange={e => update('localidad', e.target.value)}
          placeholder="Mar del Plata"
        />
      </FormField>

      <div className="md:col-span-2">
        <FormField label="Condición frente al IVA">
          <Select
            sizeVariant="lg"
            value={value.ivaCondition ?? 'Responsable Inscripto'}
            onChange={e => update('ivaCondition', e.target.value)}
          >
            {IVA_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </Select>
        </FormField>
      </div>
    </div>
  );
}

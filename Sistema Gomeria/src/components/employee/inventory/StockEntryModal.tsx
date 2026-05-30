// ═══════════════════════════════════════════════════
// StockEntryModal — carga de stock de mercadería entrante.
//
// Dos modos, ambos SUMAN al stock actual (nunca lo reemplazan):
//
//   1) "Por lista"    → se elige una marca y aparecen todos sus modelos
//      con su stock actual y un input "Sumar". Pensado para reponer varios
//      modelos de una marca de una sola vez (ajuste masivo manual).
//
//   2) "Por factura"  → se elige una marca y se van agregando renglones
//      (modelo/medida + cantidad), como tipeando una factura de compra.
//      El modelo se elige de un desplegable filtrado por la marca, así
//      no hay que tipear nombres y se evita crear duplicados.
//
// El modelo de datos del proyecto guarda el stock en
// `tire_store_overrides` por tienda — por eso esto opera sobre la tienda
// activa vía tireServiceV2.addStock (upsert en bloque, defensivo).
// ═══════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import type { Tire } from '@/types';
import { tireServiceV2 } from '@/services/tireServiceV2';
import { describeError } from '@/utils/errorMessage';
import { compareTireSize } from '@/utils/tireSize';
import { Modal } from '@/components/ui/Modal';
import { Button, FormField, Input, Select, EmptyState } from '@/components/ui';
import { Plus, Trash2, PackagePlus, Layers, Receipt } from 'lucide-react';

interface Props {
  open: boolean;
  storeId: string;
  tires: Tire[];
  onClose: () => void;
  /** Se llama tras una carga exitosa para refrescar el inventario. */
  onSaved: (summary: { tiresAffected: number; unitsAdded: number }) => void;
}

type Mode = 'list' | 'invoice';
interface InvoiceLine { id: string; tireId: string; quantity: string }

let lineSeq = 0;
const newLine = (): InvoiceLine => ({ id: `l${++lineSeq}`, tireId: '', quantity: '' });

export function StockEntryModal({ open, storeId, tires, onClose, onSaved }: Props) {
  const [mode, setMode] = useState<Mode>('list');
  const [brand, setBrand] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Modo lista: cantidad a sumar por tireId.
  const [listQty, setListQty] = useState<Record<string, string>>({});
  // Modo factura: renglones.
  const [lines, setLines] = useState<InvoiceLine[]>([newLine()]);

  const brands = useMemo(
    () => [...new Set(tires.map(t => t.brand))].sort((a, b) => a.localeCompare(b, 'es')),
    [tires],
  );

  // Modelos de la marca elegida, ordenados por medida (rodado) y modelo.
  const brandTires = useMemo(() => {
    if (!brand) return [];
    return tires
      .filter(t => t.brand === brand)
      .sort((a, b) => {
        const s = compareTireSize(a.size, b.size);
        return s !== 0 ? s : a.model.localeCompare(b.model, 'es');
      });
  }, [tires, brand]);

  function resetAll() {
    setBrand('');
    setListQty({});
    setLines([newLine()]);
    setError(null);
    setSubmitting(false);
  }

  function close() {
    resetAll();
    onClose();
  }

  function changeBrand(b: string) {
    // Cambiar de marca limpia lo cargado para no mezclar marcas en un envío.
    setBrand(b);
    setListQty({});
    setLines([newLine()]);
    setError(null);
  }

  // Cantidades parseadas y validadas según el modo activo.
  const entries = useMemo((): Array<{ tireId: string; quantity: number }> => {
    if (mode === 'list') {
      return Object.entries(listQty)
        .map(([tireId, raw]) => ({ tireId, quantity: Math.floor(Number(raw)) }))
        .filter(e => Number.isFinite(e.quantity) && e.quantity > 0);
    }
    return lines
      .map(l => ({ tireId: l.tireId, quantity: Math.floor(Number(l.quantity)) }))
      .filter(e => e.tireId && Number.isFinite(e.quantity) && e.quantity > 0);
  }, [mode, listQty, lines]);

  const unitsTotal = entries.reduce((s, e) => s + e.quantity, 0);
  const canSubmit = entries.length > 0 && !submitting;

  async function handleSubmit() {
    if (entries.length === 0) {
      setError('Cargá al menos una cantidad (> 0).');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await tireServiceV2.addStock(storeId, entries);
      const unitsAdded = result.reduce((s, r) => s + r.quantity, 0);
      onSaved({ tiresAffected: result.length, unitsAdded });
      resetAll();
    } catch (e) {
      setError(describeError(e));
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={close} title="Cargar stock" size="lg">
      {/* Selector de modo */}
      <div role="tablist" aria-label="Modo de carga" className="flex gap-2 mb-4">
        <ModeTab active={mode === 'list'} onClick={() => setMode('list')} Icon={Layers} label="Por lista" />
        <ModeTab active={mode === 'invoice'} onClick={() => setMode('invoice')} Icon={Receipt} label="Por factura" />
      </div>

      <FormField label="Marca" required>
        <Select value={brand} onChange={(e) => changeBrand(e.target.value)} disabled={submitting}>
          <option value="">Elegí una marca…</option>
          {brands.map(b => <option key={b} value={b}>{b}</option>)}
        </Select>
      </FormField>

      {!brand ? (
        <div className="mt-4">
          <EmptyState
            icon={PackagePlus}
            title="Elegí una marca"
            description="Los pedidos llegan por marca. Seleccioná una para cargar sus modelos."
          />
        </div>
      ) : mode === 'list' ? (
        <ListMode tires={brandTires} listQty={listQty} setListQty={setListQty} disabled={submitting} />
      ) : (
        <InvoiceMode
          tires={brandTires}
          lines={lines}
          setLines={setLines}
          disabled={submitting}
        />
      )}

      {error && (
        <p role="alert" className="text-sm rounded-lg px-3 py-2 mt-4"
           style={{ background: 'var(--br-red-bg)', color: 'var(--br-red)', border: '1px solid var(--br-red-bor)' }}>
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 mt-5 pt-4" style={{ borderTop: '1px solid var(--br-bor)' }}>
        <p className="text-sm" style={{ color: 'var(--br-txt2)' }}>
          {unitsTotal > 0
            ? <>Vas a sumar <strong className="tabular-nums" style={{ color: 'var(--br-txt)' }}>{unitsTotal}</strong> {unitsTotal === 1 ? 'unidad' : 'unidades'} en <strong className="tabular-nums" style={{ color: 'var(--br-txt)' }}>{entries.length}</strong> {entries.length === 1 ? 'modelo' : 'modelos'}.</>
            : 'Cargá cantidades para sumar al stock.'}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={close} disabled={submitting}>Cancelar</Button>
          <Button
            variant="primary"
            size="lg"
            iconLeft={<PackagePlus className="h-4 w-4" />}
            onClick={handleSubmit}
            loading={submitting}
            disabled={!canSubmit}
          >
            Sumar al stock
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ModeTab({ active, onClick, Icon, label }: { active: boolean; onClick: () => void; Icon: React.ElementType; label: string }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className="inline-flex items-center gap-2 px-3 h-10 rounded-lg text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--br-amb)]"
      style={{
        background: active ? 'var(--br-amb-bg)' : 'var(--br-sur)',
        color: active ? 'var(--br-txt)' : 'var(--br-txt2)',
        border: `1px solid ${active ? 'var(--br-amb-bor)' : 'var(--br-bor)'}`,
      }}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}

function ListMode({
  tires, listQty, setListQty, disabled,
}: {
  tires: Tire[];
  listQty: Record<string, string>;
  setListQty: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  disabled: boolean;
}) {
  if (tires.length === 0) {
    return (
      <div className="mt-4">
        <EmptyState icon={Layers} title="Sin modelos" description="Esta marca no tiene modelos cargados todavía." />
      </div>
    );
  }
  return (
    <div className="mt-3 max-h-[45vh] overflow-y-auto pr-1">
      <table className="w-full text-sm">
        <thead className="sticky top-0" style={{ background: 'var(--br-sur)' }}>
          <tr style={{ borderBottom: '1px solid var(--br-bor)' }}>
            <th className="text-left py-2 font-semibold" style={{ color: 'var(--br-txt2)' }}>Modelo</th>
            <th className="text-left py-2 font-semibold" style={{ color: 'var(--br-txt2)' }}>Medida</th>
            <th className="text-right py-2 font-semibold tabular-nums" style={{ color: 'var(--br-txt2)' }}>Stock</th>
            <th className="text-right py-2 font-semibold w-28" style={{ color: 'var(--br-txt2)' }}>Sumar</th>
          </tr>
        </thead>
        <tbody>
          {tires.map(t => (
            <tr key={t.id} style={{ borderBottom: '1px solid var(--br-bor)' }}>
              <td className="py-1.5" style={{ color: 'var(--br-txt)' }}>{t.model}</td>
              <td className="py-1.5 font-mono" style={{ color: 'var(--br-txt2)' }}>{t.size}</td>
              <td className="py-1.5 text-right tabular-nums" style={{ color: 'var(--br-txt2)' }}>{t.stock}</td>
              <td className="py-1.5 text-right">
                <Input
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  sizeVariant="sm"
                  className="w-24 text-right"
                  aria-label={`Sumar stock a ${t.model} ${t.size}`}
                  value={listQty[t.id] ?? ''}
                  onChange={(e) => setListQty(prev => ({ ...prev, [t.id]: e.target.value }))}
                  placeholder="0"
                  disabled={disabled}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InvoiceMode({
  tires, lines, setLines, disabled,
}: {
  tires: Tire[];
  lines: InvoiceLine[];
  setLines: React.Dispatch<React.SetStateAction<InvoiceLine[]>>;
  disabled: boolean;
}) {
  function update(id: string, patch: Partial<InvoiceLine>) {
    setLines(prev => prev.map(l => (l.id === id ? { ...l, ...patch } : l)));
  }
  function remove(id: string) {
    setLines(prev => (prev.length === 1 ? [newLine()] : prev.filter(l => l.id !== id)));
  }

  if (tires.length === 0) {
    return (
      <div className="mt-4">
        <EmptyState icon={Receipt} title="Sin modelos" description="Esta marca no tiene modelos cargados todavía." />
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      {lines.map((l, idx) => (
        <div key={l.id} className="flex gap-2 items-end">
          <div className="flex-1">
            {idx === 0 && <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--br-txt2)' }}>Modelo / medida</label>}
            <Select
              value={l.tireId}
              onChange={(e) => update(l.id, { tireId: e.target.value })}
              disabled={disabled}
              aria-label={`Modelo del renglón ${idx + 1}`}
            >
              <option value="">Elegí modelo…</option>
              {tires.map(t => (
                <option key={t.id} value={t.id}>{t.model} · {t.size}</option>
              ))}
            </Select>
          </div>
          <div className="w-28">
            {idx === 0 && <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--br-txt2)' }}>Cantidad</label>}
            <Input
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              className="text-right"
              aria-label={`Cantidad del renglón ${idx + 1}`}
              value={l.quantity}
              onChange={(e) => update(l.id, { quantity: e.target.value })}
              placeholder="0"
              disabled={disabled}
            />
          </div>
          <Button
            variant="ghost"
            size="md"
            onClick={() => remove(l.id)}
            disabled={disabled}
            aria-label={`Quitar renglón ${idx + 1}`}
            iconLeft={<Trash2 className="h-4 w-4" style={{ color: 'var(--br-red)' }} />}
          >
            <span className="sr-only">Quitar</span>
          </Button>
        </div>
      ))}
      <Button
        variant="secondary"
        onClick={() => setLines(prev => [...prev, newLine()])}
        disabled={disabled}
        iconLeft={<Plus className="h-4 w-4" />}
      >
        Agregar renglón
      </Button>
    </div>
  );
}

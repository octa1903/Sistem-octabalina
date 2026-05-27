import { useState, useRef } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Upload, Download, FileText, AlertTriangle, CheckCircle } from 'lucide-react';
import {
  parseFile, validateTireRows, validateCustomerRows,
  bulkInsertTires, bulkInsertCustomers, downloadTemplate,
  type RawRow, type TireImportResult, type CustomerImportResult, type ImportSummary,
} from '@/services/importService';
import { supplierPriceListService } from '@/services/supplierPriceListServiceV2';
import { todayIso } from '@/services/exchangeRateServiceV2';
import type { Category } from '@/types';

type Kind = 'tires' | 'customers';

interface Props {
  open: boolean;
  kind: Kind;
  onClose: () => void;
  onComplete: (summary: ImportSummary) => void;
  storeId?: string;            // requerido si kind === 'tires'
  categories?: Category[];     // requerido si kind === 'tires'
}

type Stage = 'pick' | 'preview' | 'importing' | 'done';

export function ImportModal({ open, kind, onClose, onComplete, storeId, categories }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>('pick');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<RawRow[]>([]);
  const [tireResults, setTireResults] = useState<TireImportResult[]>([]);
  const [customerResults, setCustomerResults] = useState<CustomerImportResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  // Solo aplica a `kind === 'tires'`: si el usuario completa estos campos
  // además de importar el catálogo se crea un snapshot en
  // `supplier_price_lists` para tener histórico de costos por proveedor.
  const [supplierName, setSupplierName] = useState('');
  const [listDate, setListDate] = useState(todayIso());
  const [listNotes, setListNotes] = useState('');
  const [snapshotInfo, setSnapshotInfo] = useState<{ listId: string; matched: number } | null>(null);

  const validCount = kind === 'tires'
    ? tireResults.filter(r => r.parsed && !r.error).length
    : customerResults.filter(r => r.parsed && !r.error).length;
  const errorCount = kind === 'tires'
    ? tireResults.filter(r => r.error).length
    : customerResults.filter(r => r.error).length;

  function reset() {
    setStage('pick');
    setFileName('');
    setRows([]);
    setTireResults([]);
    setCustomerResults([]);
    setError(null);
    setSummary(null);
    setSupplierName('');
    setListDate(todayIso());
    setListNotes('');
    setSnapshotInfo(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    setFileName(f.name);
    try {
      const { rows: parsed } = await parseFile(f);
      if (parsed.length === 0) {
        setError('El archivo no tiene datos.');
        return;
      }
      setRows(parsed);
      if (kind === 'tires') {
        if (!categories) throw new Error('Faltan categorías para validar.');
        setTireResults(validateTireRows(parsed, categories));
      } else {
        setCustomerResults(validateCustomerRows(parsed));
      }
      setStage('preview');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error parseando archivo.');
    }
  }

  async function doImport() {
    setStage('importing');
    setError(null);
    try {
      let result: ImportSummary;
      if (kind === 'tires') {
        if (!storeId || !categories) throw new Error('Faltan storeId o categorías.');
        const validResults = tireResults.filter(r => r.parsed && !r.error);
        const valid = validResults.map(r => r.parsed!);
        result = await bulkInsertTires(valid, storeId, categories);

        // Si el usuario completó proveedor, además crear snapshot histórico
        // de la lista (supplier_price_lists). Los tireIds vienen del summary
        // (matching por brand+model+size que hace bulkInsertTires).
        if (supplierName.trim() && result.tireIds && result.tireIds.length > 0) {
          try {
            const tireIdByRow = new Map(result.tireIds.map(t => [t.rowIndex, t.tireId]));
            const items = validResults.map((r, idx) => ({
              rawSku: r.parsed!.sku,
              rawSize: r.parsed!.size,
              rawBrand: r.parsed!.brand,
              rawModel: r.parsed!.model,
              costOriginal: r.parsed!.cost,
              priceSuggested: r.parsed!.price,
              tireId: tireIdByRow.get(idx),
            }));
            const snap = await supplierPriceListService.importList({
              supplierName: supplierName.trim(),
              listName: `${supplierName.trim()} ${listDate}`,
              currency: 'ARS',
              effectiveDate: listDate,
              notes: listNotes.trim() || undefined,
              items,
            });
            setSnapshotInfo({ listId: snap.listId, matched: snap.matched });
          } catch (snapErr) {
            // El snapshot es secundario: si falla no rompemos el import principal.
             
            console.error('[ImportModal] snapshot lista proveedor falló:', snapErr);
          }
        }
      } else {
        const valid = customerResults.filter(r => r.parsed && !r.error).map(r => r.parsed!);
        result = await bulkInsertCustomers(valid);
      }
      setSummary(result);
      setStage('done');
      onComplete(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error en la importación.');
      setStage('preview');
    }
  }

  const title = kind === 'tires' ? 'Importar neumáticos desde Excel' : 'Importar clientes desde Excel';

  return (
    <Modal open={open} onClose={stage === 'importing' ? () => {} : handleClose} title={title} size="lg">
      {stage === 'pick' && (
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--br-txt2)' }}>
            Subí un archivo <strong>.xlsx</strong> o <strong>.csv</strong> con tus datos.
          </p>

          <div className="rounded-lg p-3" style={{ background: 'var(--br-sur2)', border: '1px solid var(--br-bor)' }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--br-txt2)' }}>
                Columnas esperadas
              </p>
              <button
                type="button"
                onClick={() => downloadTemplate(kind)}
                className="text-xs flex items-center gap-1 px-2 py-1 rounded"
                style={{ background: 'var(--br-amb-bg)', color: 'var(--br-amb)' }}
              >
                <Download className="h-3 w-3" /> Bajar plantilla
              </button>
            </div>
            <p className="text-xs font-mono" style={{ color: 'var(--br-txt)' }}>
              {kind === 'tires'
                ? 'Marca · Modelo · Medida · Categoría · Costo · Precio · Stock · Mínimo · Ubicación · SKU'
                : 'Nombre · Teléfono · Email · Dirección · Tipo · Cupo · Descuento · PIN'}
            </p>
            <p className="text-xs mt-2" style={{ color: 'var(--br-txt2)' }}>
              {kind === 'tires'
                ? 'La categoría debe existir (Auto, SUV, Camioneta, Camión, Moto, Agrícola, Industrial, Sin categoría). Tires duplicados (misma marca+modelo+medida) se actualizan.'
                : 'Tipo: "minorista" o "mayorista". Si no se especifica PIN, se omite. Cupo en pesos.'}
            </p>
          </div>

          {kind === 'tires' && (
            <div className="rounded-lg p-3 space-y-2"
                 style={{ background: 'var(--br-sur2)', border: '1px solid var(--br-bor)' }}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--br-txt2)' }}>
                Lista de proveedor <span className="font-normal">(opcional — para histórico de costos)</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-xs" style={{ color: 'var(--br-txt2)' }}>Proveedor</span>
                  <input
                    type="text"
                    value={supplierName}
                    onChange={e => setSupplierName(e.target.value)}
                    placeholder="ej: BULL VIAL"
                    className="w-full px-2 py-1.5 text-sm rounded"
                    style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)', color: 'var(--br-txt)' }}
                  />
                </label>
                <label className="block">
                  <span className="text-xs" style={{ color: 'var(--br-txt2)' }}>Fecha de la lista</span>
                  <input
                    type="date"
                    value={listDate}
                    onChange={e => setListDate(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm rounded"
                    style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)', color: 'var(--br-txt)' }}
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-xs" style={{ color: 'var(--br-txt2)' }}>Notas</span>
                <input
                  type="text"
                  value={listNotes}
                  onChange={e => setListNotes(e.target.value)}
                  placeholder="ej: Lista mayo 2026, recibida por mail"
                  className="w-full px-2 py-1.5 text-sm rounded"
                  style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)', color: 'var(--br-txt)' }}
                />
              </label>
              <p className="text-xs" style={{ color: 'var(--br-txt2)' }}>
                Si completás el proveedor, además del catálogo se guarda un snapshot con la fecha
                para ver la evolución de costos en cada neumático.
              </p>
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={onFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full py-8 rounded-lg flex flex-col items-center gap-2 transition-colors"
            style={{ border: '2px dashed var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt2)' }}
            onMouseOver={(e) => (e.currentTarget.style.borderColor = 'var(--br-amb)')}
            onMouseOut={(e) => (e.currentTarget.style.borderColor = 'var(--br-bor)')}
          >
            <Upload className="h-8 w-8" />
            <span className="text-sm font-medium">Click para elegir archivo</span>
            <span className="text-xs">o arrastrá uno acá</span>
          </button>

          {error && (
            <p className="text-sm rounded-lg px-3 py-2" style={{ background: 'var(--br-red-bg)', color: 'var(--br-red)', border: '1px solid var(--br-red-bor)' }}>
              {error}
            </p>
          )}
        </div>
      )}

      {stage === 'preview' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--br-txt2)' }}>
              <FileText className="h-4 w-4" />
              <span className="font-medium">{fileName}</span>
              <span>· {rows.length} filas</span>
            </div>
            <div className="flex gap-3 text-xs">
              <span style={{ color: 'var(--br-grn)' }}>
                <CheckCircle className="h-3 w-3 inline mr-1" />{validCount} válidas
              </span>
              {errorCount > 0 && (
                <span style={{ color: 'var(--br-red)' }}>
                  <AlertTriangle className="h-3 w-3 inline mr-1" />{errorCount} con errores
                </span>
              )}
            </div>
          </div>

          <div className="rounded-lg overflow-hidden max-h-96 overflow-y-auto" style={{ border: '1px solid var(--br-bor)' }}>
            <table className="w-full text-xs">
              <thead className="sticky top-0" style={{ background: 'var(--br-sur2)' }}>
                <tr style={{ borderBottom: '1px solid var(--br-bor)' }}>
                  <th className="text-left px-3 py-2" style={{ color: 'var(--br-txt2)' }}>#</th>
                  {kind === 'tires' ? (
                    <>
                      <th className="text-left px-3 py-2" style={{ color: 'var(--br-txt2)' }}>Marca</th>
                      <th className="text-left px-3 py-2" style={{ color: 'var(--br-txt2)' }}>Modelo</th>
                      <th className="text-left px-3 py-2" style={{ color: 'var(--br-txt2)' }}>Medida</th>
                      <th className="text-left px-3 py-2" style={{ color: 'var(--br-txt2)' }}>Categoría</th>
                      <th className="text-right px-3 py-2" style={{ color: 'var(--br-txt2)' }}>Costo</th>
                      <th className="text-right px-3 py-2" style={{ color: 'var(--br-txt2)' }}>Precio</th>
                      <th className="text-right px-3 py-2" style={{ color: 'var(--br-txt2)' }}>Stock</th>
                    </>
                  ) : (
                    <>
                      <th className="text-left px-3 py-2" style={{ color: 'var(--br-txt2)' }}>Nombre</th>
                      <th className="text-left px-3 py-2" style={{ color: 'var(--br-txt2)' }}>Teléfono</th>
                      <th className="text-left px-3 py-2" style={{ color: 'var(--br-txt2)' }}>Tipo</th>
                      <th className="text-right px-3 py-2" style={{ color: 'var(--br-txt2)' }}>Cupo</th>
                    </>
                  )}
                  <th className="text-left px-3 py-2" style={{ color: 'var(--br-txt2)' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {kind === 'tires' ? tireResults.map(r => (
                  <tr key={r.rowIndex} style={{ borderBottom: '1px solid var(--br-bor)', background: r.error ? 'var(--br-red-bg)' : undefined }}>
                    <td className="px-3 py-1.5 font-mono" style={{ color: 'var(--br-txt2)' }}>{r.rowIndex + 1}</td>
                    <td className="px-3 py-1.5">{r.parsed?.brand}</td>
                    <td className="px-3 py-1.5">{r.parsed?.model}</td>
                    <td className="px-3 py-1.5 font-mono">{r.parsed?.size}</td>
                    <td className="px-3 py-1.5">{r.parsed?.categoryName}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{r.parsed?.cost?.toLocaleString('es-AR')}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{r.parsed?.price?.toLocaleString('es-AR')}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{r.parsed?.stock}</td>
                    <td className="px-3 py-1.5" style={{ color: r.error ? 'var(--br-red)' : 'var(--br-grn)' }}>
                      {r.error ?? 'OK'}
                    </td>
                  </tr>
                )) : customerResults.map(r => (
                  <tr key={r.rowIndex} style={{ borderBottom: '1px solid var(--br-bor)', background: r.error ? 'var(--br-red-bg)' : undefined }}>
                    <td className="px-3 py-1.5 font-mono" style={{ color: 'var(--br-txt2)' }}>{r.rowIndex + 1}</td>
                    <td className="px-3 py-1.5">{r.parsed?.name}</td>
                    <td className="px-3 py-1.5 font-mono">{r.parsed?.phone}</td>
                    <td className="px-3 py-1.5">{r.parsed?.customerType === 'wholesale' ? 'Mayorista' : 'Minorista'}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{r.parsed?.creditLimit?.toLocaleString('es-AR')}</td>
                    <td className="px-3 py-1.5" style={{ color: r.error ? 'var(--br-red)' : 'var(--br-grn)' }}>
                      {r.error ?? 'OK'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {error && (
            <p className="text-sm rounded-lg px-3 py-2" style={{ background: 'var(--br-red-bg)', color: 'var(--br-red)', border: '1px solid var(--br-red-bor)' }}>
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button onClick={() => setStage('pick')} className="px-4 py-2 rounded-lg text-sm" style={{ border: '1px solid var(--br-bor)', color: 'var(--br-txt2)' }}>
              Cambiar archivo
            </button>
            <button
              onClick={doImport}
              disabled={validCount === 0}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: 'var(--br-amb)' }}
            >
              Importar {validCount} {validCount === 1 ? 'fila' : 'filas'}
            </button>
          </div>
        </div>
      )}

      {stage === 'importing' && (
        <div className="py-8 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-stone-200 border-t-amber-500 mx-auto mb-3" />
          <p className="text-sm" style={{ color: 'var(--br-txt2)' }}>Importando {validCount} filas...</p>
        </div>
      )}

      {stage === 'done' && summary && (
        <div className="space-y-4">
          <div className="text-center py-4">
            <CheckCircle className="h-12 w-12 mx-auto mb-3" style={{ color: 'var(--br-grn)' }} />
            <h3 className="text-lg font-semibold" style={{ color: 'var(--br-txt)' }}>Importación completa</h3>
            <p className="text-sm mt-1" style={{ color: 'var(--br-txt2)' }}>
              <span className="font-semibold" style={{ color: 'var(--br-grn)' }}>{summary.inserted}</span> insertadas
              {summary.failed > 0 && <> · <span className="font-semibold" style={{ color: 'var(--br-red)' }}>{summary.failed}</span> con errores</>}
            </p>
            {snapshotInfo && (
              <p className="text-xs mt-2" style={{ color: 'var(--br-txt2)' }}>
                Snapshot guardado en histórico: <span className="font-mono">{snapshotInfo.matched}</span> items
                vinculados a su neumático.
              </p>
            )}
          </div>

          {summary.errors.length > 0 && (
            <div className="rounded-lg p-3 max-h-48 overflow-y-auto"
                 style={{ background: 'var(--br-red-bg)', border: '1px solid var(--br-red-bor)' }}>
              <p className="text-xs font-semibold mb-1" style={{ color: 'var(--br-red)' }}>Filas que fallaron:</p>
              {summary.errors.map(e => (
                <p key={e.rowIndex} className="text-xs" style={{ color: 'var(--br-red)' }}>
                  Fila {e.rowIndex + 1}: {e.error}
                </p>
              ))}
            </div>
          )}

          <div className="flex justify-end">
            <button onClick={handleClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: 'var(--br-dark)' }}>
              Listo
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

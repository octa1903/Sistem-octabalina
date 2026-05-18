import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Tire, TireV2, TireStoreOverride, Category, Tax } from '@/types';
import { tireServiceV2 } from '@/services/tireServiceV2';
import { categoryService } from '@/services/categoryService';
import { taxService } from '@/services/taxService';
import { formatCurrency, calculateSalePrice } from '@/utils/currency';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ImportModal } from '@/components/employee/import/ImportModal';
import { Button, IconButton, FormField, Input, Select, EmptyState } from '@/components/ui';
import { Plus, Search, Edit2, Trash2, AlertTriangle, Upload, TrendingUp, Package } from 'lucide-react';

interface Props {
  addToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  activeStoreId: string;
}

interface FormState {
  brand: string;
  model: string;
  size: string;
  categoryId: string;
  sku: string;
  cost: number;
  margin: number;
  taxIds: string[];
  // Por tienda activa
  price: number;
  stock: number;
  lowStockThreshold: number;
  location: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  brand: '', model: '', size: '', categoryId: '', sku: '',
  cost: 0, margin: 30, price: 0, taxIds: [],
  stock: 0, lowStockThreshold: 2, location: '', notes: '',
};

export function InventoryView({ addToast, activeStoreId }: Props) {
  const [tires, setTires] = useState<Tire[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [tireTaxIdsById, setTireTaxIdsById] = useState<Map<string, string[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [onlyLow, setOnlyLow] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Tire | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<Tire | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState({
    pctDelta: 5,
    brand: '' as string,
    categoryId: '' as string,
    touchCost: false,
    touchDefaultPrice: true,
    touchOverrides: false,
  });
  const [bulkPreview, setBulkPreview] = useState<{ tiresCount: number; overridesCount: number } | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!activeStoreId) return;
    try {
      setLoading(true);
      const [tiresV2, cats, overrides, allTaxes] = await Promise.all([
        tireServiceV2.getAll(),
        categoryService.getAll(),
        tireServiceV2.getOverridesByStore(activeStoreId),
        taxService.getAll(),
      ]);
      const taxMap = new Map<string, string[]>();
      tiresV2.forEach(t => taxMap.set(t.id, t.taxIds ?? []));
      setTaxes(allTaxes);
      setTireTaxIdsById(taxMap);
      const overrideByTire = new Map<string, TireStoreOverride>();
      overrides.forEach(o => overrideByTire.set(o.tireId, o));
      const catNameById = new Map<string, string>();
      cats.forEach(c => catNameById.set(c.id, c.name));

      const legacyList: Tire[] = tiresV2.map(t =>
        tireServiceV2.toLegacy(t, overrideByTire.get(t.id), catNameById.get(t.categoryId) ?? 'Sin categoría'),
      );
      setTires(legacyList);
      setCategories(cats);
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error cargando inventario', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeStoreId, addToast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const brands = useMemo(() => [...new Set(tires.map(t => t.brand))].sort(), [tires]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return tires.filter(t => {
      if (onlyLow && t.stock > t.minStock) return false;
      if (filterCat && t.category !== filterCat) return false;
      if (filterBrand && t.brand !== filterBrand) return false;
      if (q && !`${t.brand} ${t.model} ${t.size}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tires, search, filterCat, filterBrand, onlyLow]);

  const lowCount = tires.filter(t => t.stock <= t.minStock).length;

  function openNew() {
    setEditing(null);
    // Defaults: impuestos con apply_to_new_tires=true
    const defaultTaxIds = taxes.filter(t => t.applyToNewTires).map(t => t.id);
    setForm({
      ...EMPTY_FORM,
      categoryId: categories.find(c => c.name === 'Auto')?.id ?? categories[0]?.id ?? '',
      taxIds: defaultTaxIds,
    });
    setModalOpen(true);
  }

  function openEdit(t: Tire) {
    setEditing(t);
    const cat = categories.find(c => c.name === t.category);
    setForm({
      brand: t.brand,
      model: t.model,
      size: t.size,
      categoryId: cat?.id ?? '',
      sku: '',  // no se exponía en v1, queda en blanco al editar
      cost: t.costPrice,
      margin: t.margin,
      taxIds: tireTaxIdsById.get(t.id) ?? [],
      price: t.salePrice,
      stock: t.stock,
      lowStockThreshold: t.minStock,
      location: t.location,
      notes: t.notes,
    });
    setModalOpen(true);
  }

  async function save() {
    if (!form.brand.trim() || !form.model.trim() || !form.size.trim()) {
      addToast('Marca, modelo y medida son obligatorios.', 'error');
      return;
    }
    if (!form.categoryId) {
      addToast('Seleccioná una categoría.', 'error');
      return;
    }
    if (!activeStoreId) {
      addToast('Sin tienda activa.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      // 1. Save tire (raíz)
      const tireV2: Partial<TireV2> & { brand: string; model: string; size: string; categoryId: string } = {
        id: editing?.id,
        brand: form.brand,
        model: form.model,
        size: form.size,
        categoryId: form.categoryId,
        cost: form.cost,
        defaultPrice: form.price,
        sku: form.sku || undefined,
        notes: form.notes || undefined,
        taxIds: form.taxIds,
        availableInAllStores: true,
      };
      const savedTire = await tireServiceV2.save(tireV2);

      // 2. Upsert override de la tienda activa
      await tireServiceV2.upsertOverride({
        tireId: savedTire.id,
        storeId: activeStoreId,
        available: true,
        price: form.price,
        stock: form.stock,
        lowStockThreshold: form.lowStockThreshold,
        location: form.location || undefined,
      });

      await refresh();
      setModalOpen(false);
      addToast(editing ? 'Neumático actualizado.' : 'Neumático creado.', 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error guardando neumático.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await tireServiceV2.delete(deleting.id);  // overrides cascadean por FK
      await refresh();
      setDeleting(null);
      addToast('Neumático eliminado.', 'warning');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error eliminando.', 'error');
    }
  }

  const stockBadge = (t: Tire) => {
    if (t.stock === 0) return { label: 'Sin stock', color: 'var(--br-red)', bg: 'var(--br-red-bg)', border: 'var(--br-red-bor)' };
    if (t.stock <= t.minStock) return { label: 'Stock bajo', color: 'var(--br-amb)', bg: 'var(--br-amb-bg)', border: 'var(--br-amb-bor)' };
    return { label: 'OK', color: 'var(--br-grn)', bg: 'var(--br-grn-bg)', border: 'var(--br-grn-bor)' };
  };

  // Auto-recalcular precio cuando cambia cost o margin
  function setFormField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => {
      const next = { ...prev, [key]: value };
      if (key === 'cost' || key === 'margin') {
        next.price = calculateSalePrice(
          key === 'cost' ? (value as number) : prev.cost,
          key === 'margin' ? (value as number) : prev.margin,
        );
      }
      return next;
    });
  }

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--br-txt)' }}>Inventario</h1>
          <p className="text-sm" style={{ color: 'var(--br-txt2)' }}>
            <span className="tabular-nums">{tires.length}</span> {tires.length === 1 ? 'neumático' : 'neumáticos'}
            {lowCount > 0 && <span style={{ color: 'var(--br-red)' }}> · <span className="tabular-nums">{lowCount}</span> con stock bajo</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => setImportOpen(true)}
            disabled={loading || categories.length === 0}
            iconLeft={<Upload className="h-4 w-4" />}
          >
            Importar
          </Button>
          <Button
            variant="secondary"
            onClick={() => { setBulkPreview(null); setBulkOpen(true); }}
            disabled={loading || tires.length === 0}
            iconLeft={<TrendingUp className="h-4 w-4" />}
            title="Ajuste masivo de precios o costos"
          >
            Ajuste masivo
          </Button>
          <Button
            variant="primary"
            onClick={openNew}
            disabled={loading || categories.length === 0}
            iconLeft={<Plus className="h-4 w-4" />}
          >
            Nuevo neumático
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex-1 min-w-48">
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar marca, modelo, medida..."
            iconLeft={<Search className="h-4 w-4" />}
          />
        </div>
        <Select
          value={filterBrand}
          onChange={(e) => setFilterBrand(e.target.value)}
          className="w-auto"
        >
          <option value="">Todas las marcas</option>
          {brands.map((b) => <option key={b}>{b}</option>)}
        </Select>
        <Select
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
          className="w-auto"
        >
          <option value="">Todas las categorías</option>
          {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
        </Select>
        <button
          type="button"
          onClick={() => setOnlyLow(!onlyLow)}
          aria-pressed={onlyLow}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--br-amb)]"
          style={{
            border: `1px solid ${onlyLow ? 'var(--br-amb-bor)' : 'var(--br-bor)'}`,
            background: onlyLow ? 'var(--br-amb-bg)' : 'var(--br-sur)',
            color: onlyLow ? 'var(--br-amb)' : 'var(--br-txt2)',
          }}
        >
          <AlertTriangle className="h-4 w-4" aria-hidden="true" /> Solo alertas
          {lowCount > 0 && <span className="tabular-nums">({lowCount})</span>}
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 700 }}>
            <thead>
              <tr style={{ background: 'var(--br-sur2)', borderBottom: '1px solid var(--br-bor)' }}>
                {['Medida / Modelo', 'Marca', 'Categoría', 'Stock', 'Costo', 'Margen', 'Precio', 'Estado', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--br-txt2)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--br-bor)' }}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 rounded motion-safe:animate-pulse" style={{ background: 'var(--br-sur2)' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9}>
                  <EmptyState
                    icon={Package}
                    title={tires.length === 0 ? 'Sin neumáticos' : 'Sin resultados'}
                    description={tires.length === 0 ? 'Creá el primer neumático con el botón "Nuevo neumático".' : 'Probá ajustar los filtros de búsqueda.'}
                    density="compact"
                  />
                </td></tr>
              ) : (
                filtered.map((t) => {
                  const badge = stockBadge(t);
                  return (
                    <tr key={t.id} className="transition-colors" style={{ borderBottom: '1px solid var(--br-bor)' }}>
                      <td className="px-4 py-3">
                        <p className="font-medium" style={{ fontFamily: 'monospace', color: 'var(--br-txt)' }}>{t.size}</p>
                        <p className="text-xs" style={{ color: 'var(--br-txt2)' }}>{t.model}</p>
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--br-txt)' }}>{t.brand}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--br-txt2)' }}>{t.category}</td>
                      <td className="px-4 py-3 font-mono font-semibold" style={{ color: t.stock === 0 ? 'var(--br-red)' : t.stock <= t.minStock ? 'var(--br-amb)' : 'var(--br-grn)' }}>
                        {t.stock}
                        <span className="text-xs font-normal ml-1" style={{ color: 'var(--br-txt2)' }}>/ {t.minStock}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--br-txt2)' }}>{t.costPrice > 0 ? formatCurrency(t.costPrice) : '—'}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--br-txt2)' }}>{t.margin}%</td>
                      <td className="px-4 py-3 font-mono font-semibold" style={{ color: 'var(--br-txt)' }}>{t.salePrice > 0 ? formatCurrency(t.salePrice) : '—'}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ color: badge.color, background: badge.bg, border: `1px solid ${badge.border}` }}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-end">
                          <IconButton
                            label="Editar neumático"
                            icon={<Edit2 className="h-4 w-4" />}
                            tone="neutral"
                            size="sm"
                            bordered={false}
                            onClick={() => openEdit(t)}
                          />
                          <IconButton
                            label="Eliminar neumático"
                            icon={<Trash2 className="h-4 w-4" />}
                            tone="danger"
                            size="sm"
                            bordered={false}
                            onClick={() => setDeleting(t)}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 text-xs text-right" style={{ color: 'var(--br-txt2)', borderTop: '1px solid var(--br-bor)' }}>
          {filtered.length} de {tires.length} neumáticos
        </div>
      </div>

      {/* Form modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar neumático' : 'Nuevo neumático'} size="lg">
        <div className="space-y-5">
          <section>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--br-txt2)' }}>Neumático</p>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Marca" required>
                <Input value={form.brand} onChange={e => setFormField('brand', e.target.value)} />
              </FormField>
              <FormField label="Modelo" required>
                <Input value={form.model} onChange={e => setFormField('model', e.target.value)} />
              </FormField>
              <div className="col-span-2">
                <FormField label="Medida" required>
                  <Input value={form.size} onChange={e => setFormField('size', e.target.value)} placeholder="Ej: 185/65 R15 88H" />
                </FormField>
              </div>
              <FormField label="Categoría" required>
                <Select
                  value={form.categoryId}
                  onChange={(e) => setFormField('categoryId', e.target.value)}
                >
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </FormField>
              <FormField label="SKU" badge="opcional">
                <Input value={form.sku} onChange={e => setFormField('sku', e.target.value)} placeholder="Ej: PIR-175-13" />
              </FormField>
              <FormField label="Costo ($)">
                <Input type="number" value={form.cost} onChange={e => setFormField('cost', Number(e.target.value))} min={0} />
              </FormField>
              <FormField label="Margen (%)">
                <Input type="number" value={form.margin} onChange={e => setFormField('margin', Number(e.target.value))} min={0} max={200} />
              </FormField>
              <div className="col-span-2">
                <FormField label="Notas">
                  <Input value={form.notes} onChange={e => setFormField('notes', e.target.value)} />
                </FormField>
              </div>
              {taxes.length > 0 && (
                <div className="col-span-2">
                  <FormField label="Impuestos aplicados">
                    <div className="space-y-1.5 mt-1">
                      {taxes.map(tax => (
                        <label key={tax.id} className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: 'var(--br-txt)' }}>
                          <input
                            type="checkbox"
                            checked={form.taxIds.includes(tax.id)}
                            onChange={(e) => {
                              setForm(prev => ({
                                ...prev,
                                taxIds: e.target.checked
                                  ? [...prev.taxIds, tax.id]
                                  : prev.taxIds.filter(id => id !== tax.id),
                              }));
                            }}
                          />
                          <span>{tax.name} <span className="font-mono text-xs" style={{ color: 'var(--br-txt2)' }}>{tax.rate}% · {tax.inclusion === 'included' ? 'incluido' : 'agregado'}</span></span>
                        </label>
                      ))}
                    </div>
                  </FormField>
                </div>
              )}
            </div>
          </section>

          <section>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--br-txt2)' }}>En esta tienda</p>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Precio de venta ($)">
                <Input
                  type="number"
                  value={form.price}
                  onChange={(e) => setFormField('price', Number(e.target.value))}
                  min={0}
                  style={{ border: '1px solid var(--br-amb)', background: 'var(--br-amb-bg)' }}
                />
              </FormField>
              <FormField label="Ubicación">
                <Input value={form.location} onChange={e => setFormField('location', e.target.value)} placeholder="Ej: A1" />
              </FormField>
              <FormField label="Stock">
                <Input type="number" value={form.stock} onChange={e => setFormField('stock', Number(e.target.value))} min={0} />
              </FormField>
              <FormField label="Mínimo (alerta stock bajo)">
                <Input type="number" value={form.lowStockThreshold} onChange={e => setFormField('lowStockThreshold', Number(e.target.value))} min={0} />
              </FormField>
            </div>
          </section>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={save} loading={submitting}>
              Guardar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Import modal */}
      <ImportModal
        open={importOpen}
        kind="tires"
        storeId={activeStoreId}
        categories={categories}
        onClose={() => setImportOpen(false)}
        onComplete={(s) => {
          addToast(`${s.inserted} neumáticos importados${s.failed > 0 ? `, ${s.failed} con errores` : ''}.`, s.failed > 0 ? 'warning' : 'success');
          void refresh();
        }}
      />

      {/* Bulk price adjust modal */}
      <Modal open={bulkOpen} onClose={() => setBulkOpen(false)} title="Ajuste masivo de precios" size="md">
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--br-txt2)' }}>
            Aplicá un porcentaje (positivo o negativo) a costo, precio base o precios por tienda.
            Filtrá por marca y/o categoría para limitar el alcance.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Marca">
              <Select
                value={bulkForm.brand}
                onChange={(e) => { setBulkForm(f => ({ ...f, brand: e.target.value })); setBulkPreview(null); }}
              >
                <option value="">Todas las marcas</option>
                {brands.map(b => <option key={b} value={b}>{b}</option>)}
              </Select>
            </FormField>
            <FormField label="Categoría">
              <Select
                value={bulkForm.categoryId}
                onChange={(e) => { setBulkForm(f => ({ ...f, categoryId: e.target.value })); setBulkPreview(null); }}
              >
                <option value="">Todas las categorías</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </FormField>
            <div className="col-span-2">
              <FormField label="Porcentaje (%) — usá negativo para bajar">
                <Input
                  type="number"
                  value={bulkForm.pctDelta}
                  onChange={(e) => { setBulkForm(f => ({ ...f, pctDelta: Number(e.target.value) })); setBulkPreview(null); }}
                  step={0.5}
                />
              </FormField>
            </div>
          </div>

          <div className="rounded-lg p-3 space-y-2" style={{ background: 'var(--br-sur2)', border: '1px solid var(--br-bor)' }}>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--br-txt2)' }}>¿Qué tocar?</p>
            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--br-txt)' }}>
              <input
                type="checkbox"
                checked={bulkForm.touchCost}
                onChange={(e) => { setBulkForm(f => ({ ...f, touchCost: e.target.checked })); setBulkPreview(null); }}
              />
              Costo (por proveedor)
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--br-txt)' }}>
              <input
                type="checkbox"
                checked={bulkForm.touchDefaultPrice}
                onChange={(e) => { setBulkForm(f => ({ ...f, touchDefaultPrice: e.target.checked })); setBulkPreview(null); }}
              />
              Precio de venta base (todas las tiendas)
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--br-txt)' }}>
              <input
                type="checkbox"
                checked={bulkForm.touchOverrides}
                onChange={(e) => { setBulkForm(f => ({ ...f, touchOverrides: e.target.checked })); setBulkPreview(null); }}
              />
              Precios especiales de esta tienda
            </label>
          </div>

          {bulkPreview && (
            <div className="rounded-lg p-3 text-sm" style={{ background: 'var(--br-amb-bg)', border: '1px solid var(--br-amb-bor)', color: 'var(--br-txt)' }}>
              Vas a {bulkForm.pctDelta >= 0 ? 'aumentar' : 'reducir'} <strong>{Math.abs(bulkForm.pctDelta)}%</strong>
              {(bulkForm.touchCost || bulkForm.touchDefaultPrice) && (
                <> · <strong>{bulkPreview.tiresCount}</strong> producto(s)</>
              )}
              {bulkForm.touchOverrides && (
                <> · <strong>{bulkPreview.overridesCount}</strong> precio(s) por tienda</>
              )}
              {bulkPreview.tiresCount === 0 && bulkPreview.overridesCount === 0 && (
                <span style={{ color: 'var(--br-red)' }}> — ningún producto coincide con los filtros.</span>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              onClick={() => setBulkOpen(false)}
              disabled={bulkBusy}
            >
              Cancelar
            </Button>
            <Button
              variant="secondary"
              loading={bulkBusy}
              onClick={async () => {
                setBulkBusy(true);
                try {
                  const r = await tireServiceV2.bulkAdjustPrices({
                    pctDelta: bulkForm.pctDelta,
                    brand: bulkForm.brand || null,
                    categoryId: bulkForm.categoryId || null,
                    storeId: activeStoreId,
                    touchCost: bulkForm.touchCost,
                    touchDefaultPrice: bulkForm.touchDefaultPrice,
                    touchOverrides: bulkForm.touchOverrides,
                    dryRun: true,
                  });
                  setBulkPreview({ tiresCount: r.tiresCount, overridesCount: r.overridesCount });
                } catch (e) {
                  addToast(e instanceof Error ? e.message : 'Error calculando preview.', 'error');
                } finally {
                  setBulkBusy(false);
                }
              }}
            >
              Calcular impacto
            </Button>
            <Button
              variant="primary"
              loading={bulkBusy}
              disabled={bulkBusy || !bulkPreview}
              onClick={() => {
                if (!bulkPreview || (bulkPreview.tiresCount === 0 && bulkPreview.overridesCount === 0)) {
                  addToast('Calculá el impacto primero.', 'warning');
                  return;
                }
                setBulkConfirmOpen(true);
              }}
            >
              Aplicar
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={bulkConfirmOpen}
        onClose={() => setBulkConfirmOpen(false)}
        type={bulkForm.pctDelta >= 0 ? 'warning' : 'danger'}
        title="Confirmar ajuste masivo"
        message={`Vas a ${bulkForm.pctDelta >= 0 ? 'aumentar' : 'reducir'} ${Math.abs(bulkForm.pctDelta)}% sobre ${bulkPreview?.tiresCount ?? 0} producto(s) y ${bulkPreview?.overridesCount ?? 0} precio(s) por tienda. Esta acción no se puede deshacer.`}
        confirmText="Aplicar ajuste"
        onConfirm={async () => {
          setBulkConfirmOpen(false);
          setBulkBusy(true);
          try {
            const r = await tireServiceV2.bulkAdjustPrices({
              pctDelta: bulkForm.pctDelta,
              brand: bulkForm.brand || null,
              categoryId: bulkForm.categoryId || null,
              storeId: activeStoreId,
              touchCost: bulkForm.touchCost,
              touchDefaultPrice: bulkForm.touchDefaultPrice,
              touchOverrides: bulkForm.touchOverrides,
              dryRun: false,
            });
            addToast(`Ajustados ${r.tiresCount} producto(s) y ${r.overridesCount} precio(s) por tienda.`, 'success');
            setBulkOpen(false);
            await refresh();
          } catch (e) {
            addToast(e instanceof Error ? e.message : 'Error aplicando ajuste.', 'error');
          } finally {
            setBulkBusy(false);
          }
        }}
      />

      {/* Delete confirm */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Confirmar eliminación" size="sm">
        <p className="text-sm" style={{ color: 'var(--br-txt2)' }}>
          ¿Eliminar <strong>{deleting?.brand} {deleting?.model} {deleting?.size}</strong>?
          Esta acción no se puede deshacer.
        </p>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="secondary" onClick={() => setDeleting(null)}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={confirmDelete}>
            Eliminar
          </Button>
        </div>
      </Modal>
    </div>
  );
}


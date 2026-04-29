import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Tire, TireV2, TireStoreOverride, Category } from '@/types';
import { tireService } from '@/services/storageService';
import { tireServiceV2 } from '@/services/tireServiceV2';
import { categoryService } from '@/services/categoryService';
import { formatCurrency, calculateSalePrice } from '@/utils/currency';
import { Modal } from '@/components/ui/Modal';
import { Plus, Search, Edit2, Trash2, AlertTriangle } from 'lucide-react';

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
  // Por tienda activa
  price: number;
  stock: number;
  lowStockThreshold: number;
  location: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  brand: '', model: '', size: '', categoryId: '', sku: '',
  cost: 0, margin: 30, price: 0,
  stock: 0, lowStockThreshold: 2, location: '', notes: '',
};

// Espejo legacy: mantiene balina_tires sincronizado con Supabase para
// que POSView/AnalyticsView (todavía legacy) sigan viendo los datos.
// Quitar cuando todo esté migrado.
function mirrorTireToLegacy(t: Tire) {
  tireService.save(t);
}
function unmirrorTire(id: string) {
  tireService.delete(id);
}

export function InventoryView({ addToast, activeStoreId }: Props) {
  const [tires, setTires] = useState<Tire[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
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

  const refresh = useCallback(async () => {
    if (!activeStoreId) return;
    try {
      setLoading(true);
      const [tiresV2, cats, overrides] = await Promise.all([
        tireServiceV2.getAll(),
        categoryService.getAll(),
        tireServiceV2.getOverridesByStore(activeStoreId),
      ]);
      const overrideByTire = new Map<string, TireStoreOverride>();
      overrides.forEach(o => overrideByTire.set(o.tireId, o));
      const catNameById = new Map<string, string>();
      cats.forEach(c => catNameById.set(c.id, c.name));

      const legacyList: Tire[] = tiresV2.map(t =>
        tireServiceV2.toLegacy(t, overrideByTire.get(t.id), catNameById.get(t.categoryId) ?? 'Sin categoría'),
      );
      setTires(legacyList);
      setCategories(cats);

      // Sincronizar mirror local: borrar lo que ya no está, guardar todo el set
      const localIds = new Set(tireService.getAll().map(t => t.id));
      const remoteIds = new Set(legacyList.map(t => t.id));
      for (const id of localIds) {
        if (!remoteIds.has(id)) tireService.delete(id);
      }
      legacyList.forEach(mirrorTireToLegacy);
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
    setForm({
      ...EMPTY_FORM,
      categoryId: categories.find(c => c.name === 'Auto')?.id ?? categories[0]?.id ?? '',
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
        availableInAllStores: true,
      };
      const savedTire = await tireServiceV2.save(tireV2);

      // 2. Upsert override de la tienda activa
      const savedOverride = await tireServiceV2.upsertOverride({
        tireId: savedTire.id,
        storeId: activeStoreId,
        available: true,
        price: form.price,
        stock: form.stock,
        lowStockThreshold: form.lowStockThreshold,
        location: form.location || undefined,
      });

      // 3. Mirror legacy
      const catName = categories.find(c => c.id === form.categoryId)?.name ?? 'Sin categoría';
      mirrorTireToLegacy(tireServiceV2.toLegacy(savedTire, savedOverride, catName));

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
      unmirrorTire(deleting.id);
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
    <div className="p-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--br-txt)' }}>Inventario</h1>
          <p className="text-sm" style={{ color: 'var(--br-txt2)' }}>
            {tires.length} neumáticos
            {lowCount > 0 && <span style={{ color: 'var(--br-red)' }}> · {lowCount} con stock bajo</span>}
          </p>
        </div>
        <button
          onClick={openNew}
          disabled={loading || categories.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
          style={{ background: 'var(--br-amb)' }}
        >
          <Plus className="h-4 w-4" /> Nuevo neumático
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--br-txt2)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar marca, modelo, medida..."
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none"
            style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)' }}
          />
        </div>
        <select
          value={filterBrand}
          onChange={(e) => setFilterBrand(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}
        >
          <option value="">Todas las marcas</option>
          {brands.map((b) => <option key={b}>{b}</option>)}
        </select>
        <select
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}
        >
          <option value="">Todas las categorías</option>
          {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        <button
          onClick={() => setOnlyLow(!onlyLow)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{
            border: `1px solid ${onlyLow ? 'var(--br-amb-bor)' : 'var(--br-bor)'}`,
            background: onlyLow ? 'var(--br-amb-bg)' : 'var(--br-sur)',
            color: onlyLow ? 'var(--br-amb)' : 'var(--br-txt2)',
          }}
        >
          <AlertTriangle className="h-4 w-4" /> Solo alertas {lowCount > 0 && `(${lowCount})`}
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
                <tr><td colSpan={9} className="px-4 py-12 text-center text-sm" style={{ color: 'var(--br-txt2)' }}>Cargando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-sm" style={{ color: 'var(--br-txt2)' }}>
                  {tires.length === 0 ? 'No hay neumáticos en esta tienda.' : 'Sin resultados.'}
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
                          <button onClick={() => openEdit(t)} className="p-1.5 rounded" style={{ color: 'var(--br-txt2)' }} title="Editar">
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button onClick={() => setDeleting(t)} className="p-1.5 rounded" style={{ color: 'var(--br-txt2)' }} title="Eliminar">
                            <Trash2 className="h-4 w-4" />
                          </button>
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
              <Field label="Marca *">
                <Inp value={form.brand} onChange={v => setFormField('brand', v)} />
              </Field>
              <Field label="Modelo *">
                <Inp value={form.model} onChange={v => setFormField('model', v)} />
              </Field>
              <div className="col-span-2">
                <Field label="Medida *">
                  <Inp value={form.size} onChange={v => setFormField('size', v)} placeholder="Ej: 185/65 R15 88H" />
                </Field>
              </div>
              <Field label="Categoría *">
                <select
                  value={form.categoryId}
                  onChange={(e) => setFormField('categoryId', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}
                >
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="SKU (opcional)">
                <Inp value={form.sku} onChange={v => setFormField('sku', v)} placeholder="Ej: PIR-175-13" />
              </Field>
              <Field label="Costo ($)">
                <NumInp value={form.cost} onChange={v => setFormField('cost', v)} />
              </Field>
              <Field label="Margen (%)">
                <NumInp value={form.margin} onChange={v => setFormField('margin', v)} max={200} />
              </Field>
              <div className="col-span-2">
                <Field label="Notas">
                  <Inp value={form.notes} onChange={v => setFormField('notes', v)} />
                </Field>
              </div>
            </div>
          </section>

          <section>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--br-txt2)' }}>En esta tienda</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Precio de venta ($)">
                <input
                  type="number"
                  value={form.price}
                  onChange={(e) => setFormField('price', Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ border: '1px solid var(--br-amb)', background: 'var(--br-amb-bg)', color: 'var(--br-txt)' }}
                  min={0}
                />
              </Field>
              <Field label="Ubicación">
                <Inp value={form.location} onChange={v => setFormField('location', v)} placeholder="Ej: A1" />
              </Field>
              <Field label="Stock">
                <NumInp value={form.stock} onChange={v => setFormField('stock', v)} />
              </Field>
              <Field label="Mínimo (alerta stock bajo)">
                <NumInp value={form.lowStockThreshold} onChange={v => setFormField('lowStockThreshold', v)} />
              </Field>
            </div>
          </section>

          <div className="flex justify-end gap-2">
            <button onClick={() => setModalOpen(false)} disabled={submitting} className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50" style={{ border: '1px solid var(--br-bor)', color: 'var(--br-txt2)' }}>
              Cancelar
            </button>
            <button onClick={save} disabled={submitting} className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ background: 'var(--br-amb)' }}>
              {submitting ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Confirmar eliminación" size="sm">
        <p className="text-sm" style={{ color: 'var(--br-txt2)' }}>
          ¿Eliminar <strong>{deleting?.brand} {deleting?.model} {deleting?.size}</strong>?
          Esta acción no se puede deshacer.
        </p>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => setDeleting(null)} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ border: '1px solid var(--br-bor)', color: 'var(--br-txt2)' }}>
            Cancelar
          </button>
          <button onClick={confirmDelete} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: 'var(--br-red)' }}>
            Eliminar
          </button>
        </div>
      </Modal>
    </div>
  );
}

// ── Inputs reutilizables ────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>{label}</label>
      {children}
    </div>
  );
}

function Inp({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 rounded-lg text-sm outline-none"
      style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}
      onFocus={(e) => (e.target.style.borderColor = 'var(--br-amb)')}
      onBlur={(e) => (e.target.style.borderColor = 'var(--br-bor)')}
    />
  );
}

function NumInp({ value, onChange, max }: { value: number; onChange: (v: number) => void; max?: number }) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      min={0}
      max={max}
      className="w-full px-3 py-2 rounded-lg text-sm outline-none"
      style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}
      onFocus={(e) => (e.target.style.borderColor = 'var(--br-amb)')}
      onBlur={(e) => (e.target.style.borderColor = 'var(--br-bor)')}
    />
  );
}

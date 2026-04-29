import { useState, useMemo } from 'react';
import type { Tire } from '@/types';
import { tireService } from '@/services/storageService';
import { TIRE_CATEGORIES } from '@/constants';
import { formatCurrency, calculateSalePrice } from '@/utils/currency';
import { Modal } from '@/components/ui/Modal';
import { Plus, Search, Edit2, Trash2, AlertTriangle } from 'lucide-react';

interface Props { addToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void; }

const EMPTY: Omit<Tire, 'id' | 'createdAt' | 'updatedAt'> = {
  brand: '', model: '', size: '', category: 'Auto',
  costPrice: 0, margin: 30, salePrice: 0, stock: 0, minStock: 2, location: '', notes: '',
};

function TireForm({
  value, onChange,
}: {
  value: typeof EMPTY;
  onChange: (v: typeof EMPTY) => void;
}) {
  const field = (label: string, node: React.ReactNode) => (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>
        {label}
      </label>
      {node}
    </div>
  );

  const inp = (key: keyof typeof EMPTY, type = 'text', extra?: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      type={type}
      value={value[key] as string | number}
      onChange={(e) => {
        const raw = type === 'number' ? Number(e.target.value) : e.target.value;
        const updated = { ...value, [key]: raw } as typeof EMPTY;
        if (key === 'costPrice' || key === 'margin') {
          updated.salePrice = calculateSalePrice(
            key === 'costPrice' ? (raw as number) : value.costPrice,
            key === 'margin' ? (raw as number) : value.margin,
          );
        }
        onChange(updated);
      }}
      className="w-full px-3 py-2 rounded-lg text-sm outline-none"
      style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}
      onFocus={(e) => (e.target.style.borderColor = 'var(--br-amb)')}
      onBlur={(e) => (e.target.style.borderColor = 'var(--br-bor)')}
      {...extra}
    />
  );

  return (
    <div className="grid grid-cols-2 gap-3">
      {field('Marca *', inp('brand'))}
      {field('Modelo *', inp('model'))}
      {field('Medida *', inp('size', 'text', { placeholder: 'Ej: 185/65 R15 88H', className: 'col-span-2 w-full px-3 py-2 rounded-lg text-sm outline-none' }))}
      {field('Categoría', (
        <select
          value={value.category}
          onChange={(e) => onChange({ ...value, category: e.target.value })}
          className="w-full px-3 py-2 rounded-lg text-sm outline-none"
          style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}
        >
          {TIRE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      ))}
      {field('Ubicación', inp('location', 'text', { placeholder: 'Ej: A1' }))}
      {field('Costo ($)', inp('costPrice', 'number', { min: '0' }))}
      {field('Margen (%)', inp('margin', 'number', { min: '0', max: '200' }))}
      {field('Precio Venta ($)', (
        <input
          type="number"
          value={value.salePrice}
          onChange={(e) => onChange({ ...value, salePrice: Number(e.target.value) })}
          className="w-full px-3 py-2 rounded-lg text-sm outline-none"
          style={{ border: '1px solid var(--br-amb)', background: 'var(--br-amb-bg)', color: 'var(--br-txt)' }}
          min="0"
        />
      ))}
      {field('Stock', inp('stock', 'number', { min: '0' }))}
      {field('Mínimo', inp('minStock', 'number', { min: '0' }))}
      <div className="col-span-2">
        {field('Notas', (
          <input
            type="text"
            value={value.notes}
            onChange={(e) => onChange({ ...value, notes: e.target.value })}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}
          />
        ))}
      </div>
    </div>
  );
}

export function InventoryView({ addToast }: Props) {
  const [tires, setTires] = useState<Tire[]>(() => tireService.getAll());
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [onlyLow, setOnlyLow] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Tire | null>(null);
  const [form, setForm] = useState<typeof EMPTY>({ ...EMPTY });
  const [deleting, setDeleting] = useState<Tire | null>(null);

  const brands = useMemo(() => [...new Set(tires.map((t) => t.brand))].sort(), [tires]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return tires.filter((t) => {
      if (onlyLow && t.stock > t.minStock) return false;
      if (filterCat && t.category !== filterCat) return false;
      if (filterBrand && t.brand !== filterBrand) return false;
      if (q && !`${t.brand} ${t.model} ${t.size}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tires, search, filterCat, filterBrand, onlyLow]);

  const lowCount = tires.filter((t) => t.stock <= t.minStock).length;

  function openNew() {
    setEditing(null);
    setForm({ ...EMPTY });
    setModalOpen(true);
  }

  function openEdit(t: Tire) {
    setEditing(t);
    const { id, createdAt, updatedAt, ...rest } = t;
    void id; void createdAt; void updatedAt;
    setForm(rest);
    setModalOpen(true);
  }

  function save() {
    if (!form.brand || !form.model || !form.size) {
      addToast('Marca, modelo y medida son obligatorios.', 'error');
      return;
    }
    const now = new Date().toISOString();
    if (editing) {
      const updated = { ...editing, ...form, updatedAt: now };
      tireService.save(updated);
      setTires(tireService.getAll());
      addToast('Neumático actualizado.', 'success');
    } else {
      const newTire: Tire = {
        id: `t${Date.now()}`,
        ...form,
        createdAt: now,
        updatedAt: now,
      };
      tireService.save(newTire);
      setTires(tireService.getAll());
      addToast('Neumático agregado.', 'success');
    }
    setModalOpen(false);
  }

  function confirmDelete() {
    if (!deleting) return;
    tireService.delete(deleting.id);
    setTires(tireService.getAll());
    setDeleting(null);
    addToast('Neumático eliminado.', 'warning');
  }

  const stockBadge = (t: Tire) => {
    if (t.stock === 0) return { label: 'Sin stock', color: 'var(--br-red)', bg: 'var(--br-red-bg)', border: 'var(--br-red-bor)' };
    if (t.stock <= t.minStock) return { label: 'Stock bajo', color: 'var(--br-amb)', bg: 'var(--br-amb-bg)', border: 'var(--br-amb-bor)' };
    return { label: 'OK', color: 'var(--br-grn)', bg: 'var(--br-grn-bg)', border: 'var(--br-grn-bor)' };
  };

  return (
    <div className="p-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--br-txt)' }}>Inventario</h1>
          <p className="text-sm" style={{ color: 'var(--br-txt2)' }}>{tires.length} neumáticos · {lowCount > 0 && <span style={{ color: 'var(--br-red)' }}>{lowCount} con stock bajo</span>}</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold"
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
          {TIRE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
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
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-sm" style={{ color: 'var(--br-txt2)' }}>Sin resultados.</td></tr>
              ) : (
                filtered.map((t) => {
                  const badge = stockBadge(t);
                  return (
                    <tr key={t.id} className="transition-colors" style={{ borderBottom: '1px solid var(--br-bor)' }}
                      onMouseOver={(e) => (e.currentTarget.style.background = 'var(--br-sur2)')}
                      onMouseOut={(e) => (e.currentTarget.style.background = '')}
                    >
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
                          <button onClick={() => openEdit(t)} className="p-1.5 rounded" style={{ color: 'var(--br-txt2)' }} title="Editar"
                            onMouseOver={(e) => (e.currentTarget.style.color = 'var(--br-amb)')}
                            onMouseOut={(e) => (e.currentTarget.style.color = 'var(--br-txt2)')}
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button onClick={() => setDeleting(t)} className="p-1.5 rounded" style={{ color: 'var(--br-txt2)' }} title="Eliminar"
                            onMouseOver={(e) => (e.currentTarget.style.color = 'var(--br-red)')}
                            onMouseOut={(e) => (e.currentTarget.style.color = 'var(--br-txt2)')}
                          >
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

      {/* Edit/New modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar neumático' : 'Nuevo neumático'} size="lg">
        <TireForm value={form} onChange={setForm} />
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ border: '1px solid var(--br-bor)', color: 'var(--br-txt2)' }}>
            Cancelar
          </button>
          <button onClick={save} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: 'var(--br-amb)' }}>
            Guardar
          </button>
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

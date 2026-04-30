import { useState, useEffect, useMemo } from 'react';
import type { Client, Customer } from '@/types';
import { clientService } from '@/services/storageService';
import { customerServiceV2 } from '@/services/customerServiceV2';
import { DEFAULT_PIN_HASH } from '@/constants';
import { formatCurrency } from '@/utils/currency';
import { sha256 } from '@/utils/hash';
import { Modal } from '@/components/ui/Modal';
import { ImportModal } from '@/components/employee/import/ImportModal';
import { Plus, Search, Edit2, Trash2, User, Phone, MapPin, Upload } from 'lucide-react';

interface Props { addToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void; }

type ClientForm = Omit<Client, 'id' | 'createdAt' | 'updatedAt' | 'payments' | 'pinHash'> & { pin: string };

const EMPTY_FORM: ClientForm = {
  name: '', phone: '', address: '', email: '',
  balance: 0, tipoCliente: 'minorista', descuentoMayorista: 0,
  cupoCredito: 100000, pin: '1234',
};

// Espejo legacy: mantener localStorage en sync con Supabase mientras
// el resto de las vistas (POS, Accounts, Analytics, etc.) sigan leyendo
// del clientService viejo. Quitar cuando todo Phase 1 esté migrado.
function mirrorToLegacy(customer: Customer) {
  const legacy = customerServiceV2.toLegacy(customer);
  clientService.save(legacy);
}
function unmirrorFromLegacy(id: string) {
  clientService.delete(id);
}

export function ClientsView({ addToast }: Props) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);

  async function refresh() {
    try {
      const customers = await customerServiceV2.getAll();
      const legacy = customers.map(c => customerServiceV2.toLegacy(c));
      setClients(legacy);
      // sincronizar mirror local: borrar lo que ya no está y guardar todo el set
      const localIds = new Set(clientService.getAll().map(c => c.id));
      const remoteIds = new Set(customers.map(c => c.id));
      for (const id of localIds) {
        if (!remoteIds.has(id)) clientService.delete(id);
      }
      legacy.forEach(c => clientService.save(c));
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error cargando clientes', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'' | 'minorista' | 'mayorista'>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState<ClientForm>({ ...EMPTY_FORM });
  const [deleting, setDeleting] = useState<Client | null>(null);
  const [detailClient, setDetailClient] = useState<Client | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return clients.filter((c) => {
      if (filterType && c.tipoCliente !== filterType) return false;
      if (q && !`${c.name} ${c.phone} ${c.email}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [clients, search, filterType]);

  function openNew() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setModalOpen(true);
  }

  function openEdit(c: Client) {
    setEditing(c);
    setForm({
      name: c.name, phone: c.phone, address: c.address, email: c.email,
      balance: c.balance, tipoCliente: c.tipoCliente,
      descuentoMayorista: c.descuentoMayorista, cupoCredito: c.cupoCredito,
      pin: '',
    });
    setModalOpen(true);
  }

  async function save() {
    if (!form.name.trim()) { addToast('El nombre es obligatorio.', 'error'); return; }
    let pinHash: string;

    try {
      if (editing) {
        pinHash = form.pin ? await sha256(form.pin) : editing.pinHash;
        const saved = await customerServiceV2.save({
          id: editing.id,
          name: form.name,
          phone: form.phone || undefined,
          email: form.email || undefined,
          address: form.address ? { street: form.address, city: '', region: '', zip: '', country: '' } : undefined,
          customerType: form.tipoCliente === 'mayorista' ? 'wholesale' : 'retail',
          wholesaleDiscount: form.tipoCliente === 'mayorista' ? form.descuentoMayorista : undefined,
          creditLimit: form.cupoCredito,
          pinHash,
        });
        mirrorToLegacy(saved);
      } else {
        pinHash = form.pin ? await sha256(form.pin) : DEFAULT_PIN_HASH;
        const saved = await customerServiceV2.save({
          name: form.name,
          phone: form.phone || undefined,
          email: form.email || undefined,
          address: form.address ? { street: form.address, city: '', region: '', zip: '', country: '' } : undefined,
          customerType: form.tipoCliente === 'mayorista' ? 'wholesale' : 'retail',
          wholesaleDiscount: form.tipoCliente === 'mayorista' ? form.descuentoMayorista : undefined,
          creditLimit: form.cupoCredito,
          accountBalance: 0,
          pinHash,
        });
        mirrorToLegacy(saved);
      }
      await refresh();
      setModalOpen(false);
      addToast(editing ? 'Cliente actualizado.' : 'Cliente creado.', 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error guardando cliente.', 'error');
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await customerServiceV2.delete(deleting.id);
      unmirrorFromLegacy(deleting.id);
      await refresh();
      setDeleting(null);
      addToast('Cliente eliminado.', 'warning');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error eliminando cliente.', 'error');
    }
  }

  const field = (label: string, node: React.ReactNode) => (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>{label}</label>
      {node}
    </div>
  );

  const inp = (key: keyof ClientForm, type = 'text', placeholder?: string) => (
    <input
      type={type}
      value={form[key] as string | number}
      onChange={(e) => setForm({ ...form, [key]: type === 'number' ? Number(e.target.value) : e.target.value })}
      placeholder={placeholder}
      className="w-full px-3 py-2 rounded-lg text-sm outline-none"
      style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}
      onFocus={(e) => (e.target.style.borderColor = 'var(--br-amb)')}
      onBlur={(e) => (e.target.style.borderColor = 'var(--br-bor)')}
    />
  );

  return (
    <div className="p-5 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--br-txt)' }}>Clientes</h1>
          <p className="text-sm" style={{ color: 'var(--br-txt2)' }}>{clients.length} clientes registrados</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold"
            style={{ border: '1px solid var(--br-bor)', color: 'var(--br-txt)', background: 'var(--br-sur)' }}
          >
            <Upload className="h-4 w-4" /> Importar
          </button>
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold" style={{ background: 'var(--br-amb)' }}>
            <Plus className="h-4 w-4" /> Nuevo cliente
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--br-txt2)' }} />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, teléfono..."
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none"
            style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)' }} />
        </div>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value as typeof filterType)}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}>
          <option value="">Todos</option>
          <option value="minorista">Minorista</option>
          <option value="mayorista">Mayorista</option>
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((c) => (
          <div key={c.id} className="rounded-xl p-4 cursor-pointer transition-all"
            style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}
            onClick={() => setDetailClient(c)}
            onMouseOver={(e) => (e.currentTarget.style.borderColor = 'var(--br-amb)')}
            onMouseOut={(e) => (e.currentTarget.style.borderColor = 'var(--br-bor)')}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0"
                  style={{ background: c.tipoCliente === 'mayorista' ? 'var(--br-amb)' : 'var(--br-dark)' }}>
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-sm" style={{ color: 'var(--br-txt)' }}>{c.name}</p>
                  <span className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                    style={{ background: c.tipoCliente === 'mayorista' ? 'var(--br-amb-bg)' : 'var(--br-sur2)', color: c.tipoCliente === 'mayorista' ? 'var(--br-amb)' : 'var(--br-txt2)' }}>
                    {c.tipoCliente === 'mayorista' ? 'Mayorista' : 'Minorista'}
                  </span>
                </div>
              </div>
              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => openEdit(c)} className="p-1.5 rounded" style={{ color: 'var(--br-txt2)' }}
                  onMouseOver={(e) => (e.currentTarget.style.color = 'var(--br-amb)')}
                  onMouseOut={(e) => (e.currentTarget.style.color = 'var(--br-txt2)')}>
                  <Edit2 className="h-4 w-4" />
                </button>
                <button onClick={() => setDeleting(c)} className="p-1.5 rounded" style={{ color: 'var(--br-txt2)' }}
                  onMouseOver={(e) => (e.currentTarget.style.color = 'var(--br-red)')}
                  onMouseOut={(e) => (e.currentTarget.style.color = 'var(--br-txt2)')}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            {c.phone && <p className="text-xs flex items-center gap-1 mt-1" style={{ color: 'var(--br-txt2)' }}><Phone className="h-3 w-3" /> {c.phone}</p>}
            {c.address && <p className="text-xs flex items-center gap-1 mt-0.5 truncate" style={{ color: 'var(--br-txt2)' }}><MapPin className="h-3 w-3" /> {c.address}</p>}
            {c.balance !== 0 && (
              <p className="text-sm font-semibold mt-2 font-mono" style={{ color: c.balance > 0 ? 'var(--br-red)' : 'var(--br-grn)' }}>
                {c.balance > 0 ? 'Debe: ' : 'Favor: '}{formatCurrency(Math.abs(c.balance))}
              </p>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-3 text-sm py-10 text-center" style={{ color: 'var(--br-txt2)' }}>
            {loading ? 'Cargando clientes...' : clients.length === 0 ? 'No hay clientes registrados.' : 'Sin resultados.'}
          </p>
        )}
      </div>

      {/* Import modal */}
      <ImportModal
        open={importOpen}
        kind="customers"
        onClose={() => setImportOpen(false)}
        onComplete={(s) => {
          addToast(`${s.inserted} clientes importados${s.failed > 0 ? `, ${s.failed} con errores` : ''}.`, s.failed > 0 ? 'warning' : 'success');
          void refresh();
        }}
      />

      {/* Form modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar cliente' : 'Nuevo cliente'} size="md">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">{field('Nombre *', inp('name'))}</div>
          {field('Teléfono', inp('phone', 'tel'))}
          {field('Email', inp('email', 'email'))}
          <div className="col-span-2">{field('Dirección', inp('address'))}</div>
          {field('Tipo', (
            <select value={form.tipoCliente} onChange={(e) => setForm({ ...form, tipoCliente: e.target.value as 'minorista' | 'mayorista' })}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}>
              <option value="minorista">Minorista</option>
              <option value="mayorista">Mayorista</option>
            </select>
          ))}
          {field('Cupo crédito ($)', inp('cupoCredito', 'number'))}
          {form.tipoCliente === 'mayorista' && field('Descuento mayorista (%)', inp('descuentoMayorista', 'number'))}
          {field('PIN ' + (editing ? '(vacío = no cambiar)' : '(por defecto: 1234)'), (
            <input type="password" value={form.pin}
              onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })}
              placeholder={editing ? '••••' : '1234'} maxLength={8}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)' }} />
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg text-sm" style={{ border: '1px solid var(--br-bor)', color: 'var(--br-txt2)' }}>Cancelar</button>
          <button onClick={save} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: 'var(--br-amb)' }}>Guardar</button>
        </div>
      </Modal>

      {/* Detail modal */}
      <Modal open={!!detailClient} onClose={() => setDetailClient(null)} title="Detalle cliente" size="sm">
        {detailClient && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
                style={{ background: detailClient.tipoCliente === 'mayorista' ? 'var(--br-amb)' : 'var(--br-dark)' }}>
                {detailClient.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold" style={{ color: 'var(--br-txt)' }}>{detailClient.name}</p>
                <p className="text-sm" style={{ color: 'var(--br-txt2)' }}>{detailClient.tipoCliente}</p>
              </div>
            </div>
            {detailClient.phone && <p className="text-sm flex items-center gap-2" style={{ color: 'var(--br-txt2)' }}><Phone className="h-4 w-4" /> {detailClient.phone}</p>}
            {detailClient.address && <p className="text-sm flex items-center gap-2" style={{ color: 'var(--br-txt2)' }}><MapPin className="h-4 w-4" /> {detailClient.address}</p>}
            {detailClient.email && <p className="text-sm flex items-center gap-2" style={{ color: 'var(--br-txt2)' }}><User className="h-4 w-4" /> {detailClient.email}</p>}
            <div className="rounded-lg p-3" style={{ background: 'var(--br-sur2)', border: '1px solid var(--br-bor)' }}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>Cuenta corriente</p>
              <p className="text-2xl font-bold font-mono" style={{ color: detailClient.balance > 0 ? 'var(--br-red)' : detailClient.balance < 0 ? 'var(--br-grn)' : 'var(--br-txt)' }}>
                {formatCurrency(Math.abs(detailClient.balance))}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--br-txt2)' }}>
                {detailClient.balance > 0 ? 'Saldo deudor' : detailClient.balance < 0 ? 'Saldo a favor' : 'Sin saldo'}
              </p>
            </div>
            {detailClient.tipoCliente === 'mayorista' && (
              <p className="text-sm" style={{ color: 'var(--br-txt2)' }}>Descuento: {detailClient.descuentoMayorista}%</p>
            )}
          </div>
        )}
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Eliminar cliente" size="sm">
        <p className="text-sm" style={{ color: 'var(--br-txt2)' }}>¿Eliminar a <strong>{deleting?.name}</strong>? Esta acción no se puede deshacer.</p>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => setDeleting(null)} className="px-4 py-2 rounded-lg text-sm" style={{ border: '1px solid var(--br-bor)', color: 'var(--br-txt2)' }}>Cancelar</button>
          <button onClick={confirmDelete} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: 'var(--br-red)' }}>Eliminar</button>
        </div>
      </Modal>
    </div>
  );
}

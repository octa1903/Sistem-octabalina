import { useState, useEffect, useMemo } from 'react';
import type { Client } from '@/types';
import { customerServiceV2 } from '@/services/customerServiceV2';
import { DEFAULT_PIN_HASH } from '@/constants';
import { formatCurrency } from '@/utils/currency';
import { hashPin } from '@/utils/hash';
import { Modal } from '@/components/ui/Modal';
import { ImportModal } from '@/components/employee/import/ImportModal';
import { Plus, Search, Edit2, Trash2, User, Phone, MapPin, Upload } from 'lucide-react';
import { Button, IconButton, Input, Select, FormField, EmptyState, ConfirmDialog } from '@/components/ui';

interface Props { addToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void; }

type ClientForm = Omit<Client, 'id' | 'createdAt' | 'updatedAt' | 'payments' | 'pinHash'> & { pin: string };

const EMPTY_FORM: ClientForm = {
  name: '', phone: '', address: '', email: '',
  balance: 0, tipoCliente: 'minorista', descuentoMayorista: 0,
  cupoCredito: 100000, pin: '1234',
};

export function ClientsView({ addToast }: Props) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);

  async function refresh() {
    try {
      const customers = await customerServiceV2.getAll();
      setClients(customers.map(c => customerServiceV2.toLegacy(c)));
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
  const [saving, setSaving] = useState(false);
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
    setSaving(true);
    try {
      if (editing) {
        pinHash = form.pin ? await hashPin(form.pin) : editing.pinHash;
        await customerServiceV2.save({
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
      } else {
        pinHash = form.pin ? await hashPin(form.pin) : DEFAULT_PIN_HASH;
        await customerServiceV2.save({
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
      }
      await refresh();
      setModalOpen(false);
      addToast(editing ? 'Cliente actualizado.' : 'Cliente creado.', 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error guardando cliente.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await customerServiceV2.delete(deleting.id);
      await refresh();
      setDeleting(null);
      addToast('Cliente eliminado.', 'warning');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error eliminando cliente.', 'error');
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--br-txt)' }}>Clientes</h1>
          <p className="text-sm" style={{ color: 'var(--br-txt2)' }}>
            <span className="tabular-nums">{clients.length}</span> {clients.length === 1 ? 'cliente registrado' : 'clientes registrados'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" iconLeft={<Upload className="h-4 w-4" />} onClick={() => setImportOpen(true)}>
            Importar
          </Button>
          <Button variant="primary" iconLeft={<Plus className="h-4 w-4" />} onClick={openNew}>
            Nuevo cliente
          </Button>
        </div>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="flex-1 min-w-48">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, teléfono..."
            iconLeft={<Search className="h-4 w-4" />}
          />
        </div>
        <Select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as typeof filterType)}
          className="w-auto"
        >
          <option value="">Todos</option>
          <option value="minorista">Minorista</option>
          <option value="mayorista">Mayorista</option>
        </Select>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Cargando clientes">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl h-28 motion-safe:animate-pulse"
              style={{ background: 'var(--br-sur2)', border: '1px solid var(--br-bor)' }}
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="col-span-3">
          <EmptyState
            icon={User}
            title={clients.length === 0 ? 'No hay clientes registrados' : 'Sin resultados'}
            description={
              clients.length === 0
                ? 'Creá el primer cliente con el botón «Nuevo cliente».'
                : 'Probá con otro término de búsqueda o cambiá el filtro.'
            }
            action={
              clients.length === 0 ? (
                <Button variant="primary" iconLeft={<Plus className="h-4 w-4" />} onClick={openNew}>
                  Nuevo cliente
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <div key={c.id} className="relative rounded-xl p-4 transition-all hover:border-[var(--br-amb)] focus-within:border-[var(--br-amb)]"
              style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}
            >
              {/* Overlay button: cubre la card excepto la zona de acciones (acciones arriba en z) */}
              <button
                type="button"
                onClick={() => setDetailClient(c)}
                aria-label={`Ver detalle de ${c.name}`}
                className="absolute inset-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--br-amb)]"
              />
              <div className="relative flex items-start justify-between mb-2 pointer-events-none">
                <div className="flex items-center gap-2">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0"
                    style={{
                      background: c.tipoCliente === 'mayorista' ? 'var(--br-amb)' : 'var(--br-dark)',
                      color: 'var(--br-bg)',
                    }}
                    aria-hidden="true"
                  >
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
                <div className="flex gap-2 pointer-events-auto">
                  <IconButton
                    label={`Editar ${c.name}`}
                    icon={<Edit2 className="h-4 w-4" />}
                    tone="neutral"
                    size="sm"
                    bordered={false}
                    onClick={() => openEdit(c)}
                  />
                  <IconButton
                    label={`Eliminar ${c.name}`}
                    icon={<Trash2 className="h-4 w-4" />}
                    tone="danger"
                    size="sm"
                    bordered={false}
                    onClick={() => setDeleting(c)}
                  />
                </div>
              </div>
              <div className="relative pointer-events-none">
                {c.phone && <p className="text-xs flex items-center gap-1 mt-1" style={{ color: 'var(--br-txt2)' }}><Phone className="h-3 w-3" aria-hidden="true" /> {c.phone}</p>}
                {c.address && <p className="text-xs flex items-center gap-1 mt-0.5 truncate" style={{ color: 'var(--br-txt2)' }}><MapPin className="h-3 w-3" aria-hidden="true" /> {c.address}</p>}
                {c.balance !== 0 && (
                  <p className="text-sm font-semibold mt-2 font-mono tabular-nums" style={{ color: c.balance > 0 ? 'var(--br-red)' : 'var(--br-grn)' }}>
                    {c.balance > 0 ? 'Debe: ' : 'Favor: '}{formatCurrency(Math.abs(c.balance))}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

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
          <div className="col-span-2">
            <FormField label="Nombre" required>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </FormField>
          </div>
          <FormField label="Teléfono">
            <Input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </FormField>
          <FormField label="Email">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </FormField>
          <div className="col-span-2">
            <FormField label="Dirección">
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </FormField>
          </div>
          <FormField label="Tipo">
            <Select
              value={form.tipoCliente}
              onChange={(e) => setForm({ ...form, tipoCliente: e.target.value as 'minorista' | 'mayorista' })}
            >
              <option value="minorista">Minorista</option>
              <option value="mayorista">Mayorista</option>
            </Select>
          </FormField>
          <FormField label="Cupo crédito ($)">
            <Input
              type="number"
              value={form.cupoCredito}
              onChange={(e) => setForm({ ...form, cupoCredito: Number(e.target.value) })}
            />
          </FormField>
          {form.tipoCliente === 'mayorista' && (
            <FormField label="Descuento mayorista (%)">
              <Input
                type="number"
                value={form.descuentoMayorista}
                onChange={(e) => setForm({ ...form, descuentoMayorista: Number(e.target.value) })}
              />
            </FormField>
          )}
          <FormField label={`PIN ${editing ? '(vacío = no cambiar)' : '(por defecto: 1234)'}`}>
            <Input
              type="password"
              value={form.pin}
              onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })}
              placeholder={editing ? '••••' : '1234'}
              maxLength={8}
            />
          </FormField>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
          <Button variant="primary" loading={saving} onClick={() => { void save(); }}>Guardar</Button>
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
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => { void confirmDelete(); }}
        title="Eliminar cliente"
        message={`¿Eliminar a ${deleting?.name ?? ''}? Esta acción no se puede deshacer.`}
        type="danger"
        confirmText="Eliminar"
        cancelText="Cancelar"
      />
    </div>
  );
}

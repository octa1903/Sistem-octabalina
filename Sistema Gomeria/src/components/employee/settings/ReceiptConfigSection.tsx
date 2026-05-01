import { useState, useEffect, useCallback } from 'react';
import type { ReceiptConfig } from '@/types';
import { receiptConfigService } from '@/services/receiptConfigService';
import { Receipt as ReceiptIcon, Save } from 'lucide-react';

interface Props {
  storeId: string | null;
  storeName: string;
  addToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

const EMPTY: ReceiptConfig = {
  storeId: '',
  header: '',
  footer: '¡Gracias por su compra!',
  showCustomerInfo: true,
  showComments: false,
};

export function ReceiptConfigSection({ storeId, storeName, addToast }: Props) {
  const [config, setConfig] = useState<ReceiptConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const data = await receiptConfigService.getByStore(storeId);
      setConfig(data ?? { ...EMPTY, storeId });
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error cargando config de recibos.', 'error');
    } finally {
      setLoading(false);
    }
  }, [storeId, addToast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!config || !storeId) return;
    setSaving(true);
    try {
      await receiptConfigService.save({ ...config, storeId });
      addToast('Configuración de recibo guardada.', 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error guardando.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}>
      <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid var(--br-bor)' }}>
        <ReceiptIcon className="h-5 w-5" style={{ color: 'var(--br-amb)' }} />
        <h2 className="font-semibold" style={{ color: 'var(--br-txt)' }}>Recibos imprimibles</h2>
        <span className="text-xs" style={{ color: 'var(--br-txt2)' }}>· {storeName}</span>
      </div>

      <div className="px-5 py-4 space-y-4">
        {loading || !config ? (
          <p className="text-sm py-4 text-center" style={{ color: 'var(--br-txt2)' }}>Cargando...</p>
        ) : (
          <>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>
                Encabezado del ticket
              </label>
              <textarea
                value={config.header ?? ''}
                onChange={(e) => setConfig({ ...config, header: e.target.value })}
                rows={3}
                placeholder="Texto opcional arriba del ticket (ej: CUIT, condición frente al IVA, etc.)"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
                style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}
              />
              <p className="text-xs mt-1" style={{ color: 'var(--br-txt2)' }}>{(config.header ?? '').length}/500</p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>
                Pie del ticket
              </label>
              <textarea
                value={config.footer ?? ''}
                onChange={(e) => setConfig({ ...config, footer: e.target.value })}
                rows={3}
                placeholder="¡Gracias por su compra!"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
                style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}
              />
              <p className="text-xs mt-1" style={{ color: 'var(--br-txt2)' }}>{(config.footer ?? '').length}/500</p>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.showCustomerInfo ?? false}
                onChange={(e) => setConfig({ ...config, showCustomerInfo: e.target.checked })}
              />
              <span className="text-sm" style={{ color: 'var(--br-txt)' }}>Mostrar datos del cliente en el ticket (cuando aplica)</span>
            </label>

            <div className="flex justify-end">
              <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: 'var(--br-amb)' }}
              >
                <Save className="h-4 w-4" /> {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

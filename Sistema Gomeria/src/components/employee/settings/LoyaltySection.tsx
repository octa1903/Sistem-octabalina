import { useState, useEffect, useCallback } from 'react';
import type { LoyaltyConfig } from '@/types';
import { loyaltyConfigService } from '@/services/loyaltyConfigService';
import { Star } from 'lucide-react';

interface Props {
  addToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export function LoyaltySection({ addToast }: Props) {
  const [config, setConfig] = useState<LoyaltyConfig>({ enabled: false, earnPercent: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setConfig(await loyaltyConfigService.get());
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error cargando lealtad.', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function save() {
    if (config.earnPercent < 0 || config.earnPercent > 100) {
      addToast('El % de acumulación debe estar entre 0 y 100.', 'error');
      return;
    }
    setSaving(true);
    try {
      await loyaltyConfigService.save(config);
      addToast('Configuración de lealtad guardada.', 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error guardando.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}>
      <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid var(--br-bor)' }}>
        <Star className="h-5 w-5" style={{ color: 'var(--br-amb)' }} />
        <h2 className="font-semibold" style={{ color: 'var(--br-txt)' }}>Programa de lealtad</h2>
      </div>

      <div className="p-5 space-y-4">
        {loading ? (
          <p className="text-sm" style={{ color: 'var(--br-txt2)' }}>Cargando...</p>
        ) : (
          <>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                disabled={saving}
              />
              <span className="text-sm" style={{ color: 'var(--br-txt)' }}>
                Habilitar acumulación de puntos por venta
              </span>
            </label>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>
                % del subtotal neto que acumula
              </label>
              <input
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={config.earnPercent}
                onChange={(e) => setConfig({ ...config, earnPercent: Number(e.target.value) })}
                disabled={saving || !config.enabled}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none disabled:opacity-50"
                style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}
              />
              <p className="text-xs mt-1" style={{ color: 'var(--br-txt2)' }}>
                Ej: 2% → cada venta de $10.000 a un cliente identificado suma 200 puntos.
                Al canjear, 1 punto = $1 de descuento.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={save}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: 'var(--br-amb)' }}
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

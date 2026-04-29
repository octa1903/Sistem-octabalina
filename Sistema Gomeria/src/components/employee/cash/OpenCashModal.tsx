import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { formatCurrency } from '@/utils/currency';
import { LockOpen } from 'lucide-react';

interface Props {
  open: boolean;
  storeName: string;
  onClose: () => void;
  onConfirm: (openingFloat: number) => Promise<void>;
}

export function OpenCashModal({ open, storeName, onClose, onConfirm }: Props) {
  const [amount, setAmount] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = Number(amount);
  const valid = !isNaN(parsed) && parsed >= 0;

  function reset() {
    setAmount('');
    setSubmitting(false);
    setError(null);
  }

  async function handleConfirm() {
    if (!valid) {
      setError('Ingresá un monto válido (≥ 0).');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(parsed);
      reset();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error abriendo caja.');
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Abrir caja" size="sm">
      <div className="space-y-4">
        <p className="text-sm" style={{ color: 'var(--br-txt2)' }}>
          Tienda: <strong style={{ color: 'var(--br-txt)' }}>{storeName}</strong>
        </p>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--br-txt2)' }}>
            Monto de apertura
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--br-txt2)' }}>$</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              autoFocus
              disabled={submitting}
              className="w-full pl-7 pr-3 py-2.5 rounded-lg text-sm outline-none"
              style={{ border: '1px solid var(--br-bor)', background: 'var(--br-sur)', color: 'var(--br-txt)' }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--br-amb)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--br-bor)')}
            />
          </div>
          {valid && parsed > 0 && (
            <p className="text-xs mt-1" style={{ color: 'var(--br-txt2)' }}>
              {formatCurrency(parsed)}
            </p>
          )}
        </div>

        {error && (
          <p className="text-sm rounded-lg px-3 py-2"
             style={{ background: 'var(--br-red-bg)', color: 'var(--br-red)', border: '1px solid var(--br-red-bor)' }}>
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => { reset(); onClose(); }}
            disabled={submitting}
            className="px-4 py-2 rounded-lg text-sm disabled:opacity-50"
            style={{ border: '1px solid var(--br-bor)', color: 'var(--br-txt2)' }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting || !valid}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-2 disabled:opacity-50"
            style={{ background: '#15803d' }}
          >
            <LockOpen className="h-4 w-4" />
            {submitting ? 'Abriendo...' : 'Abrir caja'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

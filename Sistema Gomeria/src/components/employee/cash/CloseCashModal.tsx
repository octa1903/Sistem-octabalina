import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button, FormField, Input } from '@/components/ui';
import { formatCurrency } from '@/utils/currency';
import { Lock } from 'lucide-react';
import type { CloseResult } from '@/hooks/useCashSession';
import type { CashSession } from '@/types';

interface Props {
  open: boolean;
  session: CashSession;
  storeName: string;
  onClose: () => void;
  onConfirm: (countedCash: number) => Promise<CloseResult>;
}

export function CloseCashModal({ open, session, storeName, onClose, onConfirm }: Props) {
  const [amount, setAmount] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CloseResult | null>(null);

  const parsed = Number(amount);
  const valid = !isNaN(parsed) && parsed >= 0;

  function reset() {
    setAmount('');
    setSubmitting(false);
    setError(null);
    setResult(null);
  }

  async function handleConfirm() {
    if (!valid) {
      setError('Ingresá un monto válido (≥ 0).');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const r = await onConfirm(parsed);
      setResult(r);
      setSubmitting(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cerrando caja.');
      setSubmitting(false);
    }
  }

  function handleFinish() {
    reset();
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={result ? handleFinish : () => { reset(); onClose(); }}
      title={result ? 'Caja cerrada' : 'Cerrar caja'}
      size="sm"
    >
      {result ? (
        <div className="space-y-3">
          <p className="text-sm" style={{ color: 'var(--br-txt2)' }}>
            Sesión cerrada para <strong style={{ color: 'var(--br-txt)' }}>{storeName}</strong>.
          </p>
          <div className="rounded-lg p-3 space-y-1.5"
               style={{ background: 'var(--br-sur2)', border: '1px solid var(--br-bor)' }}>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--br-txt2)' }}>Efectivo teórico</span>
              <span className="font-mono" style={{ color: 'var(--br-txt)' }}>{formatCurrency(result.expectedCash)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--br-txt2)' }}>Efectivo contado</span>
              <span className="font-mono" style={{ color: 'var(--br-txt)' }}>{formatCurrency(result.countedCash)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold pt-1.5" style={{ borderTop: '1px solid var(--br-bor)' }}>
              <span style={{ color: 'var(--br-txt2)' }}>Descuadre</span>
              <span className="font-mono"
                    style={{ color: result.variance === 0 ? 'var(--br-grn)' : result.variance > 0 ? 'var(--br-amb)' : 'var(--br-red)' }}>
                {result.variance > 0 ? '+' : ''}{formatCurrency(result.variance)}
              </span>
            </div>
          </div>
          {result.variance !== 0 && (
            <p className="text-xs" style={{ color: 'var(--br-txt2)' }}>
              {result.variance > 0
                ? 'Hay menos efectivo del esperado (faltante).'
                : 'Hay más efectivo del esperado (sobrante).'}
            </p>
          )}
          <div className="flex justify-end pt-1">
            <Button type="button" variant="primary" onClick={handleFinish}>
              Listo
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--br-txt2)' }}>
            Tienda: <strong style={{ color: 'var(--br-txt)' }}>{storeName}</strong>
          </p>
          <p className="text-sm" style={{ color: 'var(--br-txt2)' }}>
            Apertura: <span className="font-mono" style={{ color: 'var(--br-txt)' }}>{formatCurrency(session.openingFloat)}</span>
          </p>
          <FormField label="Efectivo contado">
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              autoFocus
              disabled={submitting}
              iconLeft={<span className="text-sm">$</span>}
            />
          </FormField>
          {valid && parsed > 0 && (
            <p className="text-xs mt-1" style={{ color: 'var(--br-txt2)' }}>
              {formatCurrency(parsed)}
            </p>
          )}

          {error && (
            <p className="text-sm rounded-lg px-3 py-2"
               style={{ background: 'var(--br-red-bg)', color: 'var(--br-red)', border: '1px solid var(--br-red-bor)' }}>
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => { reset(); onClose(); }}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="danger"
              size="lg"
              fullWidth
              iconLeft={<Lock className="h-4 w-4" />}
              onClick={handleConfirm}
              loading={submitting}
              disabled={submitting || !valid}
            >
              Cerrar caja
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

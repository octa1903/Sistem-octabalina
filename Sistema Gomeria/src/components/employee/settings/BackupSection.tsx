import { useEffect, useState } from 'react';
import { Download, Database, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui';
import {
  supabaseBackupServiceV2,
  type BackupProgress,
} from '@/services/supabaseBackupServiceV2';

interface Props {
  addToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return iso;
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days === 0) return 'hoy';
  if (days === 1) return 'ayer';
  if (days < 30) return `hace ${days} días`;
  if (days < 365) return `hace ${Math.floor(days / 30)} meses`;
  return `hace ${Math.floor(days / 365)} años`;
}

/**
 * Sección de Settings que permite descargar un backup completo de Supabase
 * en JSON. Incluye:
 *  - Aviso de "backup desactualizado" si hace >7 días del último.
 *  - Progreso en tiempo real durante la descarga (33 tablas).
 *  - Marca local del último backup para el aviso.
 *
 * El restore NO está expuesto en UI — se hace fuera del POS via SQL admin
 * para evitar accidentes. El JSON contiene metadata + datos por tabla.
 */
export function BackupSection({ addToast }: Props) {
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<BackupProgress | null>(null);

  useEffect(() => {
    setLastBackupAt(supabaseBackupServiceV2.getLastBackupAt());
    setStale(supabaseBackupServiceV2.isBackupStale());
  }, []);

  async function runBackup() {
    setRunning(true);
    setProgress(null);
    try {
      const backup = await supabaseBackupServiceV2.createBackup((p) => setProgress(p));
      supabaseBackupServiceV2.downloadBackup(backup);
      supabaseBackupServiceV2.markBackupDone();
      setLastBackupAt(supabaseBackupServiceV2.getLastBackupAt());
      setStale(false);
      const totalRows = Object.values(backup.metadata.table_counts).reduce(
        (s, n) => s + (n > 0 ? n : 0),
        0,
      );
      const failed = Object.entries(backup.metadata.table_counts).filter(([, n]) => n === -1);
      if (failed.length > 0) {
        addToast(
          `Backup descargado (${totalRows} filas). ${failed.length} tablas fallaron: ${failed.map(([t]) => t).join(', ')}`,
          'warning',
        );
      } else {
        addToast(`Backup descargado (${totalRows} filas en ${Object.keys(backup.metadata.table_counts).length} tablas).`, 'success');
      }
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Error generando backup.', 'error');
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}
    >
      <div
        className="px-5 py-4 flex items-center gap-2"
        style={{ borderBottom: '1px solid var(--br-bor)' }}
      >
        <Database className="h-5 w-5" style={{ color: 'var(--br-amb)' }} />
        <h2 className="font-semibold" style={{ color: 'var(--br-txt)' }}>
          Respaldo completo (Supabase)
        </h2>
      </div>

      <div className="px-5 py-4 space-y-3">
        <p className="text-sm" style={{ color: 'var(--br-txt2)' }}>
          Descargá un archivo JSON con todos tus datos: clientes, ventas, neumáticos,
          configuración, caja. Guardalo en un pendrive o en la nube. Es tu última red
          de seguridad si pasa algo con la base de datos.
        </p>

        {lastBackupAt ? (
          <div
            className="flex items-center gap-2 text-sm rounded-lg px-3 py-2"
            style={{
              background: stale ? 'var(--br-amb-bg)' : 'var(--br-grn-bg)',
              color: stale ? 'var(--br-amb)' : 'var(--br-grn)',
              border: `1px solid ${stale ? 'var(--br-amb-bor)' : 'var(--br-grn-bor)'}`,
            }}
          >
            {stale ? (
              <AlertTriangle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
            )}
            <span>
              Último backup: <strong>{formatRelative(lastBackupAt)}</strong>
              {stale && ' — conviene hacer uno nuevo'}
            </span>
          </div>
        ) : (
          <div
            className="flex items-center gap-2 text-sm rounded-lg px-3 py-2"
            style={{
              background: 'var(--br-amb-bg)',
              color: 'var(--br-amb)',
              border: '1px solid var(--br-amb-bor)',
            }}
          >
            <AlertTriangle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <span>Nunca hiciste un backup. Te recomendamos hacer uno ahora.</span>
          </div>
        )}

        {progress && (
          <div className="text-xs space-y-1" style={{ color: 'var(--br-txt2)' }}>
            <div className="flex justify-between">
              <span>
                Descargando: <strong>{progress.table}</strong>
              </span>
              <span>
                {progress.index + 1} / {progress.total}
              </span>
            </div>
            <div
              className="h-2 rounded-full overflow-hidden"
              style={{ background: 'var(--br-bg)', border: '1px solid var(--br-bor)' }}
            >
              <div
                className="h-full transition-all"
                style={{
                  width: `${((progress.index + 1) / progress.total) * 100}%`,
                  background: 'var(--br-amb)',
                }}
              />
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button
            variant="primary"
            loading={running}
            iconLeft={<Download className="h-4 w-4" />}
            onClick={() => {
              void runBackup();
            }}
          >
            Descargar backup completo
          </Button>
        </div>
      </div>
    </div>
  );
}

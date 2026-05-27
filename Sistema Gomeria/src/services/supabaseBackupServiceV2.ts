import { supabase } from './supabaseClient';
import { fetchAllPaginated } from './supabaseHelpers';

/**
 * Backup completo del estado del POS desde Supabase a JSON descargable.
 *
 * Filosofía:
 *  - Lista cerrada de tablas (no `select * from information_schema`) para
 *    que el backup sea predecible y no rompa si se agregan tablas internas.
 *  - Cada tabla se pagina con `fetchAllPaginated` para superar el límite
 *    1000-rows de PostgREST.
 *  - Output JSON con metadata (version del backup, fecha, host) +
 *    `data: { table_name: [rows...] }`.
 *  - El archivo es restorable manualmente (vía SQL admin); la UI solo
 *    permite **descargar**, no restaurar — el restore se hace fuera del
 *    POS para evitar accidentes en producción.
 */

const BACKUP_FORMAT_VERSION = 1;

// Lista cerrada de tablas a respaldar. Orden importa para restore manual
// (catalogo antes que ventas porque hay FKs).
const TABLES_TO_BACKUP = [
  // Catálogo
  'stores',
  'categories',
  'tires',
  'tire_store_overrides',
  'modifier_groups',
  'discounts',
  'taxes',
  'payment_methods',
  // Personas
  'roles',
  'employees',
  'customers',
  // Operativas (movimientos)
  'cash_sessions',
  'cash_movements',
  'receipts',
  'receipt_lines',
  'customer_account_movements',
  // Configuración
  'app_features',
  'loyalty_config',
  'receipt_config',
  'open_tickets_config',
  'wholesale_config',
  'order_config',
  'app_metadata',
  // Pedidos (online)
  'customer_orders',
  // Facturación / proveedores
  'supplier_invoices',
  'suppliers',
  'supplier_account_movements',
  'banks',
  'checks',
  // Aseguradoras / vendedores
  'insurance_companies',
  'insurance_policies',
  'insurance_company_movements',
  'salespeople',
] as const;

export type BackupTable = (typeof TABLES_TO_BACKUP)[number];

export interface BackupMetadata {
  format_version: number;
  generated_at: string;
  generator: string;
  supabase_url: string;
  table_counts: Record<BackupTable, number>;
}

export interface BackupFile {
  metadata: BackupMetadata;
  data: Record<BackupTable, unknown[]>;
}

export interface BackupProgress {
  table: BackupTable;
  index: number; // 0-based
  total: number;
  count: number;
}

export const supabaseBackupServiceV2 = {
  /**
   * Genera un backup completo. Devuelve el objeto JSON listo para serializar.
   * Llama `onProgress` después de cada tabla (útil para UI con barra).
   */
  async createBackup(onProgress?: (p: BackupProgress) => void): Promise<BackupFile> {
    const data = {} as Record<BackupTable, unknown[]>;
    const counts = {} as Record<BackupTable, number>;
    const total = TABLES_TO_BACKUP.length;

    for (let i = 0; i < total; i++) {
      const table = TABLES_TO_BACKUP[i];
      try {
        const rows = await fetchAllPaginated<Record<string, unknown>>(
          () => supabase.from(table).select('*'),
          `supabaseBackup.${table}`,
        );
        data[table] = rows;
        counts[table] = rows.length;
      } catch (e) {
        // Si una tabla falla (típicamente RLS por rol insuficiente),
        // dejamos array vacío y seguimos. El restore manual sabrá qué
        // falta del metadata.
        console.error(`[backup] tabla ${table} falló:`, e);
        data[table] = [];
        counts[table] = -1; // -1 marca "fallo de lectura"
      }
      onProgress?.({ table, index: i, total, count: counts[table] });
    }

    return {
      metadata: {
        format_version: BACKUP_FORMAT_VERSION,
        generated_at: new Date().toISOString(),
        generator: 'Sistema Octabalina',
        supabase_url: (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? 'unknown',
        table_counts: counts,
      },
      data,
    };
  },

  /**
   * Descarga un backup como archivo .json en el navegador.
   * `filenamePrefix` ej. "octabalina" → "octabalina-2026-05-27T14-30-00.json".
   */
  downloadBackup(backup: BackupFile, filenamePrefix = 'octabalina-backup'): void {
    const ts = backup.metadata.generated_at.replace(/[:.]/g, '-');
    const filename = `${filenamePrefix}-${ts}.json`;
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  },

  // ── Recordatorio "hace mucho que no haces backup" ──────────────────

  LAST_BACKUP_KEY: 'sb_lastBackupAt',
  STALE_DAYS: 7,

  getLastBackupAt(): string | null {
    try {
      return localStorage.getItem(this.LAST_BACKUP_KEY);
    } catch {
      return null;
    }
  },

  markBackupDone(): void {
    try {
      localStorage.setItem(this.LAST_BACKUP_KEY, new Date().toISOString());
    } catch {
      // ignore
    }
  },

  isBackupStale(): boolean {
    const last = this.getLastBackupAt();
    if (!last) return true;
    const lastMs = new Date(last).getTime();
    if (!Number.isFinite(lastMs)) return true;
    const ageMs = Date.now() - lastMs;
    return ageMs > this.STALE_DAYS * 24 * 60 * 60 * 1000;
  },
};

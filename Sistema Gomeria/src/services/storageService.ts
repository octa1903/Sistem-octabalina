// ═══════════════════════════════════════════════════
// storageService — sólo queda el backup JSON local.
//
// El resto de la API (tires/clients/sales/invoices/orders/config) vivía en
// localStorage cifrado. Toda la UI ya consume Supabase (servicios v2 y los
// dominios nuevos: orderService, orderConfigService, wholesaleConfigService,
// supplierInvoiceService). Se borraron los CRUD legacy y `initializeSeedData`
// — los datos viven en Supabase y se siembran via `supabase/seed.sql`.
//
// `backupService` es un export/import JSON que aún apunta a localStorage; se
// mantiene como herramienta de soporte mientras no haya backup desde Supabase
// (planificado para Fase 8). SettingsView lo expone con label "backup local".
// ═══════════════════════════════════════════════════

import { storageGet, storageSet, exportAllData, importAllData } from '@/utils/storage';

const LAST_BACKUP_KEY = 'lastBackup';

export const backupService = {
  exportData: exportAllData,
  importData: importAllData,
  getLastBackup: () => storageGet<string | null>(LAST_BACKUP_KEY, null),
  setLastBackup: () => storageSet(LAST_BACKUP_KEY, new Date().toISOString()),
};

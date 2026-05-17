// Loader: salespeople — distinct DVENDEDOR de CLIENTES
//
// El legacy guardaba el vendedor denormalizado como string en
// CLIENTES.DVENDEDOR y FACTURAS.DVENDEDOR. No hay tabla maestra de
// vendedores en el .gdb. Estrategia:
//   1. Escanear los últimos ~200 bytes de cada CLIENTES row buscando
//      runs ASCII >= 4 chars que parezcan nombres.
//   2. Dedupear y filtrar palabras genéricas (ACTIVO, INACTIVO, MOSTRADOR,
//      etc. — estados o tags, no personas).
//   3. Insertar como salespeople con storeId default y commission 0.
//
// Octavio puede después ajustar manualmente comisiones desde
// SettingsView → SalespeopleSection.

import { readTable } from '../lib/gdbReader';
import { bulkInsert } from '../lib/batch';

const RELATION_ID_CLIENTES = 149;

// Strings que aparecen en el campo pero NO son vendedores (ESTADO, etc.)
const BLOCKED = new Set([
  'ACTIVO', 'INACTIVO', 'MOSTRADOR', 'ASEGURADORA',
  'MERCADO LIBRE', 'CUIT', 'EXENTO', 'CONSUMIDOR FINAL',
]);

function looksLikeName(s: string): boolean {
  if (s.length < 4 || s.length > 40) return false;
  if (BLOCKED.has(s)) return false;
  // Requiere al menos una letra mayúscula seguida de minúscula o más mayúsculas
  if (!/^[A-Z]/.test(s)) return false;
  // Rechazar pura dirección con números (e.g., "AV BELGRANO 1500")
  if (/\d{3,}/.test(s)) return false;
  return true;
}

export async function loadSalespeople(
  gdbPath: string,
  storeId: string,
): Promise<{ inserted: number; skipped: number; errors: unknown[] }> {
  const rows = await readTable(gdbPath, RELATION_ID_CLIENTES);
  const names = new Set<string>();

  for (const r of rows) {
    const b = r.buf;
    if (b.length < 900) continue;
    // Buscar runs en últimos 200 bytes
    let start = -1;
    for (let i = 800; i < b.length; i++) {
      const x = b[i];
      const isPrint = x >= 0x20 && x <= 0x7e;
      if (isPrint) { if (start < 0) start = i; }
      else {
        if (start >= 0) {
          const s = b.subarray(start, i).toString('latin1').trim();
          if (looksLikeName(s)) names.add(s);
          start = -1;
        }
      }
    }
  }

  const toInsert = [...names].map(name => ({
    store_id: storeId,
    name,
    default_commission_pct: 0,
    active: true,
  }));

  // eslint-disable-next-line no-console
  console.log(`[salespeople] distinct names found: ${toInsert.length}`);
  const result = await bulkInsert('salespeople', toInsert as unknown as Record<string, unknown>[]);
  return { inserted: result.inserted, skipped: 0, errors: result.errors };
}

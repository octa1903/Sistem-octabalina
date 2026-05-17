// Loader: FACTURAS (78482 filas) → receipts (solo cabeceras minimal)
//
// Layout observado y VERIFICADO 2026-05-16 con _inspectFacturas (row 1170-1378 bytes):
//   off   8: NROFACT      INT32LE         (ej 21314)
//   off  18: MASCF        CHAR(13) fijo   ("0009-00021314" — pto.venta-nro AFIP)
//   off  36: FECHA        INT32LE MJD     (días desde 1858-11-17)
//   off  46: CONDVENTA    CHAR(80) fijo   ("CUENTA CORRIENTE", "CONTADO", etc.)
//   off 368: SRES         CHAR(40) fijo   (nombre denormalizado del cliente)
//   off 410: DIRECCION    CHAR(50) fijo
//   off 462: CUIT         CHAR(15) fijo
//   off 490: LOCALIDAD    CHAR(35) fijo
//
// Los strings son CHAR fijos (no VARCHAR con 2-byte prefix). Hay ~11873 rows
// vacías (len=0) que se filtran. Algunos rows más largos (len≥1300) traen
// un vendedor al final (@1240).
//
// LIMITACIONES:
// - TIPOF, PVENTA, CLIENTE_ID y montos (SUBTOTAL, TOTAL, etc.) no se
//   pueden extraer fiablemente con el parser raw — están en CHAR fijos
//   sin prefix detectable o en doubles que RLE comprime a basura
//   consistente.
// - Importamos solo cabecera para preservar el "qué se facturó" histórico.
//   Si se necesita el detalle de líneas (DETALLEF), eso requiere otro
//   loader con offsets propios.
//
// Para evitar conflictos con receipts del v2 nuevo, usamos:
//   - receipt_number = "LEG-${NROFACT}-${MASCF}" (único partial WHERE legacy_id NULL ya está relajado en 0023)
//   - legacy_id = MASCF (asume único por TPV)
//   - type = 'sale', status = 'completed'
//   - cash_session_id: el modelo requiere FK NOT NULL. Como no tenemos
//     una sesión de caja legacy, creamos una "import-legacy" única al
//     inicio del loader y todos los receipts apuntan a ella.

import { readTable, readChar, readInt32LE } from '../lib/gdbReader';
import { admin } from '../lib/supabaseAdmin';
import { bulkInsert } from '../lib/batch';

const RELATION_ID_FACTURAS = 144;

function fbDate(buf: Buffer, off: number): string | null {
  if (off + 8 > buf.length) return null;
  const days = buf.readInt32LE(off);
  if (days < 47000 || days > 65000) return null;
  const epoch = Date.UTC(1858, 10, 17);
  return new Date(epoch + days * 86400000).toISOString();
}

export async function loadReceiptsHeaders(
  gdbPath: string,
  storeId: string,
  batchId: string,
): Promise<{ inserted: number; skipped: number; errors: unknown[] }> {
  const rows = await readTable(gdbPath, RELATION_ID_FACTURAS);
  // eslint-disable-next-line no-console
  console.log(`[receiptsHeaders] raw rows: ${rows.length}`);

  // Necesitamos un cash_session, employee, customer (opcional) para FK.
  // Buscamos o creamos una sesión "import-legacy" en el store target.
  // employees: buscar el primero del store o admin global.
  const { data: empData } = await admin
    .from('employees')
    .select('id')
    .limit(1);
  const employeeId = empData?.[0]?.id;
  if (!employeeId) {
    return { inserted: 0, skipped: 0, errors: [{ msg: 'No hay employees en el sistema' }] };
  }

  // Buscar cash_session "import-legacy" existente o crear una
  const { data: sessData } = await admin
    .from('cash_sessions')
    .select('id')
    .eq('store_id', storeId)
    .eq('notes', 'import-legacy')
    .limit(1);
  let cashSessionId = sessData?.[0]?.id;
  if (!cashSessionId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newSess, error: sErr } = await (admin.from('cash_sessions') as any)
      .insert({
        store_id: storeId,
        opened_by_employee_id: employeeId,
        opening_float: 0,
        status: 'closed',
        notes: 'import-legacy',
        closed_at: new Date().toISOString(),
        closed_by_employee_id: employeeId,
        counted_cash: 0,
      })
      .select('id')
      .single();
    if (sErr || !newSess) return { inserted: 0, skipped: 0, errors: [sErr ?? 'no session created'] };
    cashSessionId = newSess.id;
  }
  // eslint-disable-next-line no-console
  console.log(`[receiptsHeaders] using cash_session: ${cashSessionId}`);

  const toInsert: Record<string, unknown>[] = [];
  let skipped = 0;
  const seenLegacyIds = new Set<string>();

  for (const r of rows) {
    const b = r.buf;
    if (b.length < 500) { skipped++; continue; }
    const nrofact = readInt32LE(b, 8);
    if (nrofact == null || nrofact <= 0) { skipped++; continue; }
    const mascf = readChar(b, 18, 13);
    if (!mascf) { skipped++; continue; }
    const fecha = fbDate(b, 36);
    if (!fecha) { skipped++; continue; }

    // Dedup intra-batch para evitar duplicados de legacy_id en el mismo insert
    if (seenLegacyIds.has(mascf)) { skipped++; continue; }
    seenLegacyIds.add(mascf);

    // Otros campos opcionales — CHAR fijos
    const condventa = readChar(b, 46, 80);
    const sresName = readChar(b, 368, 40);
    const cuit = readChar(b, 462, 15);

    const notes = [
      condventa ? `Cond: ${condventa}` : null,
      sresName ? `Cliente: ${sresName}` : null,
      cuit ? `CUIT: ${cuit}` : null,
    ].filter(Boolean).join(' · ') || null;

    toInsert.push({
      receipt_number: `LEG-${nrofact}-${mascf}`,
      store_id: storeId,
      cash_session_id: cashSessionId,
      employee_id: employeeId,
      customer_id: null,
      type: 'sale',
      status: 'completed',
      applied_discounts: [],
      applied_taxes: [],
      payments: [],
      subtotal_gross: 0,
      total_discounts: 0,
      subtotal_net: 0,
      total_taxes: 0,
      total_cogs: 0,
      total: 0,
      points_earned: 0,
      points_redeemed: 0,
      notes,
      legacy_id: mascf,
      legacy_number: String(nrofact),
      issued_at: fecha,
      import_batch_id: batchId,
    });
  }

  // eslint-disable-next-line no-console
  console.log(`[receiptsHeaders] válidos: ${toInsert.length}, skipped: ${skipped}`);
  const result = await bulkInsert('receipts', toInsert, 1000);
  return { inserted: result.inserted, skipped, errors: result.errors };
}

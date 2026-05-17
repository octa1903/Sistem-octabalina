// Loader: REMITOS (24559 filas) → supplier_invoices
//
// Layout observado (row 388 bytes):
//   off  4: REMITO    VARCHAR(15) — número del remito legacy
//   off 24: FECHA     TIMESTAMP (días MJD)
//   off 32: PROVEEDOR INTEGER — FK legacy a PROVEEDORES.CODP (mapeo a UUID)
//
// NOTA: los doubles (NETO/IVA/TOTAL) están en 0 en todo el legacy — la
// gomería no usaba los totales de remitos. Importamos solo cabecera.

import { readTable, readSlotVarchar, readInt32LE } from '../lib/gdbReader';
import { admin } from '../lib/supabaseAdmin';
import { bulkInsert } from '../lib/batch';

const RELATION_ID_REMITOS = 138;

function fbDate(buf: Buffer, off: number): string | null {
  if (off + 8 > buf.length) return null;
  const days = buf.readInt32LE(off);
  if (days < 47000 || days > 65000) return null;
  const epoch = Date.UTC(1858, 10, 17);
  return new Date(epoch + days * 86400000).toISOString().slice(0, 10);
}

export async function loadSupplierInvoices(
  gdbPath: string,
  storeId: string,
): Promise<{ inserted: number; skipped: number; errors: unknown[] }> {
  const rows = await readTable(gdbPath, RELATION_ID_REMITOS);
  // eslint-disable-next-line no-console
  console.log(`[supplierInvoices] raw rows: ${rows.length}`);

  // Resolver mapping legacy_id PROVEEDOR → supplier UUID
  const { data: existingSuppliers, error: sErr } = await admin
    .from('suppliers')
    .select('id, name, legacy_id');
  if (sErr) return { inserted: 0, skipped: 0, errors: [sErr] };
  const supplierByLegacyId = new Map<string, { id: string; name: string }>();
  for (const s of existingSuppliers ?? []) {
    if (s.legacy_id) supplierByLegacyId.set(s.legacy_id, { id: s.id, name: s.name });
  }
  // eslint-disable-next-line no-console
  console.log(`[supplierInvoices] suppliers en cache: ${supplierByLegacyId.size}`);

  const toInsert: Record<string, unknown>[] = [];
  let skipped = 0;

  for (const r of rows) {
    const b = r.buf;
    if (b.length < 200) { skipped++; continue; }
    const number = readSlotVarchar(b, 4, 15);
    if (!number) { skipped++; continue; }
    const date = fbDate(b, 24);
    if (!date) { skipped++; continue; }
    const supplierLegacyId = readInt32LE(b, 32);
    if (supplierLegacyId == null || supplierLegacyId <= 0) { skipped++; continue; }
    const supplier = supplierByLegacyId.get(String(supplierLegacyId));

    toInsert.push({
      type: 'A',
      number,
      supplier: supplier?.name ?? `Proveedor legacy #${supplierLegacyId}`,
      supplier_id: supplier?.id ?? null,
      date,
      subtotal: 0,
      iva: 0,
      total: 0,
      paid: false,
      store_id: storeId,
    });
  }

  // eslint-disable-next-line no-console
  console.log(`[supplierInvoices] válidos: ${toInsert.length}, skipped: ${skipped}`);
  const result = await bulkInsert('supplier_invoices', toInsert, 1000);
  return { inserted: result.inserted, skipped, errors: result.errors };
}

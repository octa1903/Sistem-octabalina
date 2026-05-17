// Loader: PROVEEDORES (810 filas) → suppliers
//
// Layout físico observado (row size: 812 bytes):
//   off    4: CODP INTEGER (PK)
//   off    8: PROVEEDOR  VARCHAR(50) — nombre corto (2-byte len prefix + 50 bytes)
//   off   60: RAZONS     VARCHAR(50)
//   off  112: DIR        VARCHAR(50)
//   off  164: TELS       VARCHAR(50)
//   off  216: CELS       VARCHAR(50)
//   off  268: EMAIL      VARCHAR(50)
//   off  320: CIUDAD     VARCHAR(50)
//   off  372: RUBRO      VARCHAR(30)
//   off  404: CUIT       VARCHAR(20)
//   off  426: CONTACTO   VARCHAR(100)
//   off  528: POSFISCAL  VARCHAR(20)
//   off  550: CATEG      VARCHAR(1)
//   RETENCION NUMERIC(?,2) y OBSERVACIONES omitidos (offsets variables).

import { readTable, readSlotVarchar, readInt32LE } from '../lib/gdbReader';
import { bulkInsert } from '../lib/batch';

const RELATION_ID_PROVEEDORES = 140;

export interface SupplierImportRow {
  name: string;
  legal_name: string | null;
  address: string | null;
  phone: string | null;
  cell: string | null;
  email: string | null;
  city: string | null;
  rubro: string | null;
  cuit: string | null;
  contact_name: string | null;
  fiscal_position: string | null;
  category: string | null;
  legacy_id: string;
  active: boolean;
}

export async function loadSuppliers(
  gdbPath: string,
): Promise<{ inserted: number; skipped: number; errors: unknown[] }> {
  const rows = await readTable(gdbPath, RELATION_ID_PROVEEDORES);
  const toInsert: SupplierImportRow[] = [];
  let skipped = 0;

  for (const r of rows) {
    if (r.buf.length < 600) { skipped++; continue; }
    const code = readInt32LE(r.buf, 4);
    if (code == null || code <= 0) { skipped++; continue; }

    const name = readSlotVarchar(r.buf, 8, 50);
    if (!name) { skipped++; continue; }

    toInsert.push({
      name,
      legal_name: readSlotVarchar(r.buf, 60, 50),
      address: readSlotVarchar(r.buf, 112, 50),
      phone: readSlotVarchar(r.buf, 164, 50),
      cell: readSlotVarchar(r.buf, 216, 50),
      email: readSlotVarchar(r.buf, 268, 50),
      city: readSlotVarchar(r.buf, 320, 50),
      rubro: readSlotVarchar(r.buf, 372, 30),
      cuit: readSlotVarchar(r.buf, 404, 20),
      contact_name: readSlotVarchar(r.buf, 426, 100),
      fiscal_position: readSlotVarchar(r.buf, 528, 20),
      category: readSlotVarchar(r.buf, 550, 1),
      legacy_id: String(code),
      active: true,
    });
  }

  // eslint-disable-next-line no-console
  console.log(`[suppliers] total raw: ${rows.length}, valid: ${toInsert.length}, skipped: ${skipped}`);
  const result = await bulkInsert('suppliers', toInsert as unknown as Record<string, unknown>[]);
  return { inserted: result.inserted, skipped, errors: result.errors };
}

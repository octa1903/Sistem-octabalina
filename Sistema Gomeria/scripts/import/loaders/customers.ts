// Loader: CLIENTES (5219 filas) → customers
//
// Layout físico observado (row size: 1022 bytes). El orden FÍSICO difiere
// del declarado en schema_decoded.json (presumiblemente por FORMAT versioning).
// Mapeo verificado con CODC 245 (ALLIANZ), 246 (ASEG. FEDERAL), 249 (BIG SUR):
//
//   off    4: CODC INTEGER (PK)
//   off    8: CLIENTE     VARCHAR(50) — nombre fantasía
//   off   60: DIRECCION   VARCHAR(50)
//   off  112: (slot omitido — quizá ADMINISTRACION INT)
//   off  164: TELS        VARCHAR(50)
//   off  216: CELS        VARCHAR(50)
//   off  268: EMAIL       VARCHAR(50)
//   off  320: CUIT        VARCHAR(15)
//   off  370: POSFISCAL   VARCHAR(25) — condición frente al IVA (literal "CUIT", "MONOTRIBUTO", etc.)
//   off  380: RAZONSOCIAL VARCHAR(50)
//   off  432: LOCALIDAD   VARCHAR(35)
//
// CATEG, GRUPO, FECHACONTRATO, VALORCONTRATO, HABILITACION, FECHAHABILITACION,
// OBSERVACIONES, OBSERVACIONESCONTRATO, LOCAL, ESTADO, PERCEPCION, VENDEDOR,
// DVENDEDOR: offsets variables o tipos no-string. Se omiten en esta primera
// pasada — Octavio puede completarlos manualmente para clientes activos.

import { readTable, readSlotVarchar, readInt32LE } from '../lib/gdbReader';
import { bulkInsert } from '../lib/batch';

const RELATION_ID_CLIENTES = 149;

export interface CustomerImportRow {
  name: string;
  email: string | null;
  phone: string | null;
  address: Record<string, unknown> | null;
  legacy_id: string;
  legacy_cuit: string | null;
  customer_type: 'retail' | 'wholesale' | 'insured';
  import_store_id: string | null;
  import_batch_id: string | null;
  note: string | null;
}

export async function loadCustomers(
  gdbPath: string,
  storeId: string,
  batchId: string,
): Promise<{ inserted: number; skipped: number; errors: unknown[] }> {
  const rows = await readTable(gdbPath, RELATION_ID_CLIENTES);
  const toInsert: CustomerImportRow[] = [];
  let skipped = 0;

  for (const r of rows) {
    if (r.buf.length < 500) { skipped++; continue; }
    const code = readInt32LE(r.buf, 4);
    if (code == null || code <= 0) { skipped++; continue; }

    const name = readSlotVarchar(r.buf, 8, 50);
    if (!name) { skipped++; continue; }

    const direccion = readSlotVarchar(r.buf, 60, 50);
    const tels = readSlotVarchar(r.buf, 164, 50);
    const cels = readSlotVarchar(r.buf, 216, 50);
    const email = readSlotVarchar(r.buf, 268, 50);
    const cuit = readSlotVarchar(r.buf, 320, 15);
    const posfiscal = readSlotVarchar(r.buf, 370, 25);
    const razonsocial = readSlotVarchar(r.buf, 380, 50);
    const localidad = readSlotVarchar(r.buf, 432, 35);

    // Phone: preferir CELS si existe, sino TELS
    const phone = cels || tels;

    // Address jsonb: serializar lo que tengamos
    const address: Record<string, unknown> = {};
    if (direccion) address.street = direccion;
    if (localidad) address.locality = localidad;
    if (razonsocial && razonsocial !== name) address.legalName = razonsocial;
    if (posfiscal) address.fiscalCondition = posfiscal;

    // Notes con info adicional que no entra en columnas dedicadas
    const noteParts: string[] = [];
    if (tels && cels && tels !== cels) noteParts.push(`Tel fijo: ${tels}`);
    const note = noteParts.length ? noteParts.join(' · ') : null;

    toInsert.push({
      name,
      email: email && email.includes('@') ? email : null,
      phone,
      address: Object.keys(address).length ? address : null,
      legacy_id: String(code),
      legacy_cuit: cuit,
      // Default retail — cualquier resta de info (insured/wholesale) la
      // setea Octavio manual o el loader de insurance_policies después.
      customer_type: 'retail',
      import_store_id: storeId,
      import_batch_id: batchId,
      note,
    });
  }

  // eslint-disable-next-line no-console
  console.log(`[customers] total raw: ${rows.length}, valid: ${toInsert.length}, skipped: ${skipped}`);
  const result = await bulkInsert('customers', toInsert as unknown as Record<string, unknown>[]);
  return { inserted: result.inserted, skipped, errors: result.errors };
}

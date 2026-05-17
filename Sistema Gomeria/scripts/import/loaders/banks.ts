// Loader: BANCOS (15 filas legacy) → banks
//
// Schema legacy BANCOS:
//   CODBANCO smallint  (PK)
//   BANCO    varchar(50)
//   SUCURSAL varchar(50)
//   DIRECCION varchar(50)
//
// El offset físico inferido del raw: el row es ~170 bytes. El campo CODBANCO
// es SMALLINT y aparece como int de 2 bytes después del format header. Los
// VARCHAR siguen con prefijo de 2 bytes y slot fijo.
//
// Como BANCOS es pequeño (15 filas) y los nombres son strings reconocibles
// (banco, sucursal, dirección), usamos `findAsciiRun` para extraer texto
// y solo confiamos en el INT pequeño para el CODBANCO.

import { readTable, findAsciiRun, readInt16LE } from '../lib/gdbReader';
import { bulkInsert } from '../lib/batch';

const RELATION_ID_BANCOS = 159;

export interface BankImportRow {
  name: string;
  branch: string | null;
  address: string | null;
  legacy_id: string;
  active: boolean;
}

export async function loadBanks(gdbPath: string): Promise<{ inserted: number; skipped: number; errors: unknown[] }> {
  const rows = await readTable(gdbPath, RELATION_ID_BANCOS);
  const toInsert: BankImportRow[] = [];
  let skipped = 0;

  for (const r of rows) {
    // CODBANCO smallint at offset 4 (post format header)
    const code = readInt16LE(r.buf, 4);
    if (code == null || code <= 0) { skipped++; continue; }

    // Extraer 3 strings consecutivos buscando runs ASCII a partir del campo del CODE
    const name = findAsciiRun(r.buf, 8, 70, 3);
    const branch = findAsciiRun(r.buf, 70, 130, 3);
    const address = findAsciiRun(r.buf, 130, r.buf.length, 3);

    if (!name) { skipped++; continue; }
    toInsert.push({
      name,
      branch,
      address,
      legacy_id: String(code),
      active: true,
    });
  }

  // eslint-disable-next-line no-console
  console.log(`[banks] total raw: ${rows.length}, valid: ${toInsert.length}, skipped: ${skipped}`);
  const result = await bulkInsert('banks', toInsert as unknown as Record<string, unknown>[]);
  return { inserted: result.inserted, skipped, errors: result.errors };
}

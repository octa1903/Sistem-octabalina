// Loader: ASEGURADOS (61491 filas) → insurance_companies (39 placeholders) + insurance_policies
//
// Layout físico observado (row size: 388 bytes):
//   off    4: CODA INTEGER (PK póliza)
//   off    8: ASEGURADO   VARCHAR(80) — nombre del asegurado (puede coincidir con customer)
//   off   90: DIRECCION   VARCHAR(80)
//   off  172: TELS        VARCHAR(100)
//   off  274: NROSEGURO   VARCHAR(25)
//   off  301: MODELO      VARCHAR(60)
//   off  363: PATENTE     VARCHAR(15)
//   off  372: COMPANIA    INTEGER — código de cía (FK a tabla logica externa, ver R3.2)
//
// Estrategia:
//   1. Pasada 1: leer todas las filas, extraer COMPANIA distintos > 0.
//   2. Crear N insurance_companies placeholder (name = "Cía legacy #${code}").
//   3. Pasada 2: leer todas las filas, mapear a insurance_policies con
//      insurance_company_id = id del placeholder, customer_id = NULL
//      (el matcheo customer ↔ póliza por nombre se hace después manual).

import { readTable, readSlotVarchar, readInt32LE } from '../lib/gdbReader';
import { admin } from '../lib/supabaseAdmin';
import { bulkInsert } from '../lib/batch';

const RELATION_ID_ASEGURADOS = 189;

interface PolicyRow {
  coda: number;
  asegurado: string | null;
  direccion: string | null;
  tels: string | null;
  nroseguro: string | null;
  modelo: string | null;
  patente: string | null;
  compania: number;
}

function parsePolicyBuf(buf: Buffer): PolicyRow | null {
  if (buf.length < 376) return null;
  const coda = readInt32LE(buf, 4);
  if (coda == null || coda <= 0) return null;
  return {
    coda,
    asegurado: readSlotVarchar(buf, 8, 80),
    direccion: readSlotVarchar(buf, 90, 80),
    tels: readSlotVarchar(buf, 172, 100),
    nroseguro: readSlotVarchar(buf, 274, 25),
    modelo: readSlotVarchar(buf, 301, 60),
    patente: readSlotVarchar(buf, 363, 15),
    compania: readInt32LE(buf, 372) ?? 0,
  };
}

export async function loadInsurance(
  gdbPath: string,
  storeId: string,
  batchId: string,
): Promise<{ inserted: number; skipped: number; errors: unknown[] }> {
  const rows = await readTable(gdbPath, RELATION_ID_ASEGURADOS);
  // eslint-disable-next-line no-console
  console.log(`[insurance] raw rows: ${rows.length}`);

  const policies: PolicyRow[] = [];
  let skipped = 0;
  for (const r of rows) {
    const p = parsePolicyBuf(r.buf);
    if (!p) { skipped++; continue; }
    policies.push(p);
  }

  // ── Paso 1: insurance_companies placeholders ─────────────────────
  // Solo valores compania > 0 son cías reales. Filtramos outliers (los
  // valores de basura > 1000 son por offset variance, no son cías reales).
  const companyCodes = [...new Set(policies.map(p => p.compania).filter(c => c > 0 && c < 1000))];
  // eslint-disable-next-line no-console
  console.log(`[insurance] distinct company codes: ${companyCodes.length}`);

  // Upsert manual: leer existentes por legacy_id, insertar solo los que faltan.
  // (No usamos onConflict porque el índice uniq de legacy_id es parcial
  // WHERE legacy_id IS NOT NULL — Postgres requiere ese mismo predicate
  // en el ON CONFLICT y supabase-js no lo soporta nativo.)
  const codesAsStr = companyCodes.map(String);
  const { data: existing, error: exErr } = await admin
    .from('insurance_companies')
    .select('id, legacy_id')
    .in('legacy_id', codesAsStr);
  if (exErr) {
    return { inserted: 0, skipped, errors: [exErr] };
  }
  const existingMap = new Map<string, string>();
  for (const e of existing ?? []) {
    if (e.legacy_id) existingMap.set(e.legacy_id, e.id);
  }
  const toInsert = codesAsStr
    .filter(code => !existingMap.has(code))
    .map(code => ({
      name: `Cía legacy #${code}`,
      legacy_id: code,
      active: true,
    }));

  if (toInsert.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inserted, error: insErr } = await (admin.from('insurance_companies') as any)
      .insert(toInsert)
      .select('id, legacy_id');
    if (insErr) {
      // eslint-disable-next-line no-console
      console.error('[insurance] companies insert failed:', insErr.message);
      return { inserted: 0, skipped, errors: [insErr] };
    }
    for (const c of inserted ?? []) {
      if (c.legacy_id) existingMap.set(c.legacy_id, c.id);
    }
  }
  const companyIdByCode = existingMap;
  // eslint-disable-next-line no-console
  console.log(`[insurance] companies ready: ${companyIdByCode.size} (${toInsert.length} new, ${(existing?.length ?? 0)} existed)`);

  // ── Paso 2: insurance_policies ────────────────────────────────────
  const policyPayload = policies.map(p => {
    const companyId = p.compania > 0 && p.compania < 1000
      ? companyIdByCode.get(String(p.compania)) ?? null
      : null;
    return {
      store_id: storeId,
      customer_id: null,
      insurance_company_id: companyId,
      policy_number: p.nroseguro ?? `LEG-${p.coda}`,
      vehicle_model: p.modelo,
      vehicle_plate: p.patente,
      insured_name: p.asegurado,
      insured_address: p.direccion,
      insured_phones: p.tels,
      legacy_id: String(p.coda),
      active: true,
    };
  }).filter(p => p.insurance_company_id !== null);
  // Filtramos pólizas sin cía resoluble — las que tenían COMPANIA=0 quedan
  // fuera (eran las 49.5k sin cía asignada en el legacy). Si querés
  // importarlas igual, sacá el .filter() de arriba; insurance_company_id
  // es NOT NULL en la tabla, así que habría que cambiar schema antes.

  // eslint-disable-next-line no-console
  console.log(`[insurance] policies to insert: ${policyPayload.length} (omitting ${policies.length - policyPayload.length} sin cía)`);

  const result = await bulkInsert('insurance_policies', policyPayload as unknown as Record<string, unknown>[], 1000);
  void batchId;  // batchId reservado para el insurance_policies.import_batch_id futuro
  return { inserted: result.inserted, skipped: skipped + (policies.length - policyPayload.length), errors: result.errors };
}

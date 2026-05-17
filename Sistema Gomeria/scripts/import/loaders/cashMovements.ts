// Loader: ENTRADAS_CAJA + SALIDAS_CAJA + TRANSFERENCIASBANCARIAS
// → cash_sessions (1 por día) + cash_movements.
//
// Conteos verificados con Phase-0 (2026-05-16):
//   ENTRADAS_CAJA           id=132  total 12502 → ~12313 con monto
//   SALIDAS_CAJA            id=133  total  7921 → ~7912 con monto
//   TRANSFERENCIASBANCARIAS id=191  total 11692 → ~11493 con monto
//   ────────────────────────────────────────────────────────────
//   Total esperado: ~31k cash_movements + ~3300 sesiones (1 por día)
//
// OTRAS_CAJA (id=178, 90k filas) se EXCLUYE: son anotaciones de "Factura X"
// (consumidor final) sin MONTO recuperable en el .gdb — el sistema legacy
// no lo guardaba separado, está implícito en la factura asociada. Importarlas
// con amount=0 solo agregaría ruido en reportes de cash flow.
//
// Layout físico de las 3 tablas (verificado en _inspectCash + _dryRunCash):
//   ENTRADAS/SALIDAS    FECHA @4 (INT32 MJD)  MONTO @12 (DOUBLE LE)
//   TRANSFERENCIAS      FECHA @8 (INT32 MJD)  MONTO @128 (DOUBLE LE) — formato distinto
//
// Strategy:
// 1. Lee las 4 tablas en memoria.
// 2. Agrupa por día (YYYY-MM-DD) → 1 cash_session por día.
// 3. Inserta cash_movements con FK a la sesión + legacy_id="<TBL>:<COD>".
//
// FK constraints:
//   - cash_sessions.opened_by_employee_id: reusa el primer employee del store
//     (consistente con receiptsHeaders).
//   - cash_movements.employee_id: idem.
//   - cash_movements.amount: must be > 0 → filtramos monto<=0.
//   - cash_movements.type: 'pay_in' | 'pay_out'.
//   - cash_sessions.status: 'closed' (todas las legacy ya finalizadas).
//
// Mapeo type:
//   ENTRADAS       → pay_in   (ingresos manuales)
//   SALIDAS        → pay_out  (egresos manuales)
//   TRANSFERENCIAS → pay_out  (egreso al banco)
//
// Idempotencia: legacy_id UNIQUE partial. Re-correr el mismo loader
// dispara 23505. El loader filtra antes los legacy_ids ya existentes.
//
// legacy_id: "<SRC>:p<page>:l<line>" — el COD legacy no es único en el
// buffer descomprimido (Firebird RLE lo aplasta), así que usamos la
// dirección física de la página/línea del .gdb que es estable y única
// mientras el archivo no se modifique.

import { readTable } from '../lib/gdbReader';
import { admin } from '../lib/supabaseAdmin';
import { bulkInsert } from '../lib/batch';

const ID_ENTRADAS = 132;
const ID_SALIDAS = 133;
const ID_TRANSF = 191;

interface LegacyMov {
  source: 'ENT' | 'SAL' | 'TRF';
  /** Dirección física en el .gdb (estable, única). */
  page: number;
  line: number;
  date: string;         // YYYY-MM-DD
  amount: number;       // siempre positivo (signo via type)
  type: 'pay_in' | 'pay_out';
  reason: string;
  /** Timestamp full para .at — extrapolado del día (mediodía UTC). */
  at: string;
}

function fbDate(buf: Buffer, off: number): string | null {
  if (off + 4 > buf.length) return null;
  const days = buf.readInt32LE(off);
  if (days < 47000 || days > 70000) return null;
  return new Date(Date.UTC(1858, 10, 17) + days * 86400000)
    .toISOString().slice(0, 10);
}

function readDouble(buf: Buffer, off: number): number | null {
  if (off < 0 || off + 8 > buf.length) return null;
  const v = buf.readDoubleLE(off);
  if (!Number.isFinite(v)) return null;
  return v;
}

/** Encuentra el primer ASCII run de longitud ≥ minLen. Útil para extraer
 *  la descripción del mov (típicamente "Factura A nro …" o "Pago a …"). */
function findAsciiRun(buf: Buffer, start: number, end: number, minLen: number): string | null {
  let runStart = -1;
  const lim = Math.min(end, buf.length);
  for (let i = start; i < lim; i++) {
    const b = buf[i];
    const printable = b >= 0x20 && b <= 0x7e;
    if (printable) { if (runStart < 0) runStart = i; }
    else {
      if (runStart >= 0) {
        const len = i - runStart;
        if (len >= minLen) return buf.subarray(runStart, i).toString('latin1').trim();
        runStart = -1;
      }
    }
  }
  if (runStart >= 0) {
    const s = buf.subarray(runStart, lim).toString('latin1').trim();
    if (s.length >= minLen) return s;
  }
  return null;
}

function extractMov(
  buf: Buffer,
  page: number,
  line: number,
  source: LegacyMov['source'],
  type: LegacyMov['type'],
  fechaOff: number,
  montoOff: number,
  reasonStart: number,
  reasonEnd: number,
): LegacyMov | null {
  const date = fbDate(buf, fechaOff);
  if (!date) return null;
  const amount = readDouble(buf, montoOff);
  if (amount == null || amount <= 0) return null;
  const reason = findAsciiRun(buf, reasonStart, reasonEnd, 4)
    ?? `${source} legacy p${page}:l${line}`;
  // .at: mediodía UTC del día (no tenemos hora real)
  const at = `${date}T12:00:00.000Z`;
  return { source, page, line, date, amount, type, reason: reason.slice(0, 500), at };
}

export async function loadCashMovements(
  gdbPath: string,
  storeId: string,
  batchId: string,
): Promise<{ inserted: number; skipped: number; errors: unknown[] }> {
  // ── 1. Leer las 3 tablas y normalizar ─────────────────────────────────
  const [rowsEnt, rowsSal, rowsTrf] = await Promise.all([
    readTable(gdbPath, ID_ENTRADAS),
    readTable(gdbPath, ID_SALIDAS),
    readTable(gdbPath, ID_TRANSF),
  ]);
  // eslint-disable-next-line no-console
  console.log(`[cashMovements] raw: ENT=${rowsEnt.length} SAL=${rowsSal.length} TRF=${rowsTrf.length}`);

  const movs: LegacyMov[] = [];
  let skippedParse = 0;

  // ENTRADAS_CAJA: FECHA@4, MONTO@12, descr@26..200
  for (const r of rowsEnt) {
    const m = extractMov(r.buf, r.page, r.line, 'ENT', 'pay_in', 4, 12, 26, 200);
    if (m) movs.push(m); else skippedParse++;
  }
  // SALIDAS_CAJA: FECHA@4, MONTO@12, descr@26..200
  for (const r of rowsSal) {
    const m = extractMov(r.buf, r.page, r.line, 'SAL', 'pay_out', 4, 12, 26, 200);
    if (m) movs.push(m); else skippedParse++;
  }
  // TRANSFERENCIASBANCARIAS: FECHA@8, MONTO@128, descr@26..250
  for (const r of rowsTrf) {
    const m = extractMov(r.buf, r.page, r.line, 'TRF', 'pay_out', 8, 128, 26, 250);
    if (m) movs.push(m); else skippedParse++;
  }
  // eslint-disable-next-line no-console
  console.log(`[cashMovements] parsed: ${movs.length}, skippedParse: ${skippedParse}`);

  // ── 2. Dedup intra-batch por (source, page, line) ─────────────────────
  const seenLegacy = new Set<string>();
  const deduped: LegacyMov[] = [];
  let skippedDup = 0;
  for (const m of movs) {
    const lid = `${m.source}:p${m.page}:l${m.line}`;
    if (seenLegacy.has(lid)) { skippedDup++; continue; }
    seenLegacy.add(lid);
    deduped.push(m);
  }
  // eslint-disable-next-line no-console
  console.log(`[cashMovements] deduped: ${deduped.length}, skippedDup: ${skippedDup}`);

  // ── 3. Filtrar legacy_ids ya importados (idempotencia) ────────────────
  // Chunk pequeño (200) porque PostgREST traduce .in() a URL query string
  // y excede el límite de URL (~16KB) con chunks grandes.
  const allLegacyIds = deduped.map(m => `${m.source}:p${m.page}:l${m.line}`);
  const existing = new Set<string>();
  for (let i = 0; i < allLegacyIds.length; i += 200) {
    const chunk = allLegacyIds.slice(i, i + 200);
    const { data, error } = await admin
      .from('cash_movements')
      .select('legacy_id')
      .in('legacy_id', chunk);
    if (error) {
      // eslint-disable-next-line no-console
      console.error(`[cashMovements] error en chequeo idempotencia (i=${i}):`, error.message);
      return { inserted: 0, skipped: 0, errors: [error] };
    }
    for (const r of data ?? []) if (r.legacy_id) existing.add(r.legacy_id);
  }
  const fresh = deduped.filter(m => !existing.has(`${m.source}:p${m.page}:l${m.line}`));
  // eslint-disable-next-line no-console
  console.log(`[cashMovements] fresh: ${fresh.length}, alreadyImported: ${existing.size}`);

  if (fresh.length === 0) {
    return { inserted: 0, skipped: skippedParse + skippedDup + existing.size, errors: [] };
  }

  // ── 4. Resolver employee FK ───────────────────────────────────────────
  const { data: empData } = await admin
    .from('employees').select('id').eq('store_id', storeId).limit(1);
  const employeeId = empData?.[0]?.id
    ?? (await admin.from('employees').select('id').limit(1)).data?.[0]?.id;
  if (!employeeId) {
    return { inserted: 0, skipped: 0, errors: [{ msg: 'No hay employees' }] };
  }

  // ── 5. Agrupar por día y crear/reusar cash_sessions ───────────────────
  const daysSet = new Set<string>();
  for (const m of fresh) daysSet.add(m.date);
  const days = Array.from(daysSet).sort();
  // eslint-disable-next-line no-console
  console.log(`[cashMovements] days to create sessions for: ${days.length}`);

  // Pre-fetch sesiones ya existentes para este store + estos días
  const sessionByDay = new Map<string, string>();
  for (let i = 0; i < days.length; i += 500) {
    const chunk = days.slice(i, i + 500);
    const notes = chunk.map(d => `import-legacy-${d}`);
    const { data, error } = await admin
      .from('cash_sessions')
      .select('id, notes')
      .eq('store_id', storeId)
      .in('notes', notes);
    if (error) return { inserted: 0, skipped: 0, errors: [error] };
    for (const r of data ?? []) {
      const day = (r.notes ?? '').replace('import-legacy-', '');
      if (day) sessionByDay.set(day, r.id);
    }
  }
  // eslint-disable-next-line no-console
  console.log(`[cashMovements] existing sessions reused: ${sessionByDay.size}`);

  // Crear las sesiones faltantes en chunks
  const daysToCreate = days.filter(d => !sessionByDay.has(d));
  if (daysToCreate.length > 0) {
    const toInsertSess = daysToCreate.map(d => ({
      store_id: storeId,
      opened_at: `${d}T08:00:00.000Z`,
      opened_by_employee_id: employeeId,
      opening_float: 0,
      closed_at: `${d}T22:00:00.000Z`,
      closed_by_employee_id: employeeId,
      counted_cash: 0,
      status: 'closed',
      notes: `import-legacy-${d}`,
      import_batch_id: batchId,
    }));
    // El unique partial "one_open_session_per_store WHERE status='open'" no
    // afecta porque todas estas son status='closed'. Insert chunked.
    for (let i = 0; i < toInsertSess.length; i += 500) {
      const chunk = toInsertSess.slice(i, i + 500);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (admin.from('cash_sessions') as any)
        .insert(chunk).select('id, notes');
      if (error) return { inserted: 0, skipped: 0, errors: [error] };
      for (const r of data ?? []) {
        const day = (r.notes ?? '').replace('import-legacy-', '');
        if (day) sessionByDay.set(day, r.id);
      }
    }
  }
  // eslint-disable-next-line no-console
  console.log(`[cashMovements] sessions total: ${sessionByDay.size}`);

  // ── 6. Insertar cash_movements ────────────────────────────────────────
  const toInsert = fresh.map(m => ({
    cash_session_id: sessionByDay.get(m.date)!,
    type: m.type,
    amount: Math.round(m.amount * 100) / 100, // 2 decimales
    reason: m.reason,
    employee_id: employeeId,
    at: m.at,
    legacy_id: `${m.source}:p${m.page}:l${m.line}`,
    import_batch_id: batchId,
  })).filter(x => x.cash_session_id != null);

  // eslint-disable-next-line no-console
  console.log(`[cashMovements] inserting ${toInsert.length} movements...`);
  const result = await bulkInsert('cash_movements', toInsert, 1000);
  return {
    inserted: result.inserted,
    skipped: skippedParse + skippedDup + existing.size,
    errors: result.errors,
  };
}

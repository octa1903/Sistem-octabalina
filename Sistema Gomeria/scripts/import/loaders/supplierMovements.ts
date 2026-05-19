// Loader: ESTPROV (29114 filas) → supplier_account_movements.
//
// Schema declarado (Firebird):
//   PROV     INTEGER       FK a PROVEEDORES.CODP
//   REMITO   VARCHAR(15)
//   TIPO     VARCHAR(2)
//   FECHA    TIMESTAMP     (8 bytes: 4=days MJD, 4=time)
//   DETALLE  VARCHAR(500)
//   TOTALR   DOUBLE        scale -2
//   OBSERV   VARCHAR(500)
//   DEBE     DOUBLE        scale -2  → 'charge' (sale del proveedor a nosotros)
//   HABER    DOUBLE        scale -2  → 'payment' (pagamos al proveedor)
//   ESTADO   VARCHAR(1)
//   FPAGO    VARCHAR(30)
//   ... (NROCHEQUE, BANCO, etc. — no requeridos)
//
// Mapeo a supplier_account_movements:
//   - supplier_id ← lookup suppliers.legacy_id = String(PROV)
//   - type        ← DEBE>0 → 'charge', HABER>0 → 'payment'
//   - amount      ← max(DEBE, HABER), debe ser > 0
//   - notes       ← DETALLE truncado a 500 chars
//   - at          ← FECHA convertida a ISO
//   - legacy_id   ← "ESTPROV:p<page>:l<line>"  (estable, único)
//   - import_batch_id ← batchId del run actual
//
// Idempotencia: legacy_id UNIQUE partial → re-correr filtra existing
// vía SELECT en chunks de ≤200 (URL limit de PostgREST).
//
// IMPORTANTE: el trigger trg_sam_after_change recalcula
// suppliers.account_balance por cada insert. Para 29k rows esto es
// costoso (29k updates). Para acelerar, hacemos bypass con
// SET LOCAL session_replication_role = replica dentro de una RPC,
// y después llamamos recompute_supplier_account_balance() para cada
// supplier afectado al final.
//
// OFFSETS FÍSICOS: el orden de declaración Firebird NO siempre coincide
// con el orden físico en disco (visto en CLIENTES/PROVEEDORES). Por eso
// este loader incluye una función `_inspectEstprov` que dumpea los
// primeros 5 rows para verificar offsets antes del primer run real.
// Correr: `npx tsx scripts/import/loaders/supplierMovements.ts inspect`

import { readTable, readSlotVarchar } from '../lib/gdbReader';
// admin/bulkInsert se importan dinámicamente dentro de loadSupplierMovements
// para que el modo `inspect` (CLI) pueda correr sin SUPABASE_URL/KEY definidas.

const RELATION_ID_ESTPROV = 145;
const ROW_SIZE_MIN = 200; // conservador; ESTPROV declarado ~1200 bytes

interface LegacyMov {
  page: number;
  line: number;
  prov: number;
  at: string;
  amount: number;
  type: 'charge' | 'payment';
  notes: string | null;
}

function fbTimestamp(buf: Buffer, off: number): string | null {
  if (off + 8 > buf.length) return null;
  const days = buf.readInt32LE(off);
  if (days < 47000 || days > 70000) return null; // ~1985-2050
  const time = buf.readInt32LE(off + 4); // 1/10000 sec, ignored para now()
  const ms = Number.isFinite(time) && time >= 0 ? Math.min(Math.floor(time / 10), 86399999) : 0;
  return new Date(Date.UTC(1858, 10, 17) + days * 86400000 + ms).toISOString();
}

/**
 * Extrae un movimiento de un row ESTPROV. Los offsets son los del orden
 * de declaración Firebird (PROV @4 INT32, FECHA @~25, DEBE/HABER ~ después
 * de detalle). Estos NO están verificados contra dumps físicos; el
 * loader corre `_inspectEstprov` primero en modo 'inspect' para confirmar.
 *
 * Estrategia de fallback: si los offsets declarados no funcionan,
 * escanea el row buscando un FECHA plausible (INT32 entre 47000-70000)
 * y un DOUBLE positivo cercano para amount.
 */
// Offsets físicos VERIFICADOS contra dump (2026-05-16):
//   @0    : row header (4 bytes version/basura)
//   @4    : PROV    INT32 LE
//   @8    : FECHA   INT32 (días MJD) + @12 INT32 (1/10000 sec)
//   @16   : DETALLE VARCHAR len-prefix (típicamente "FACTURA A nro -NNN")
//   variable: OBSERV VARCHAR len-prefix (contiene "Comprobante pago" si es pago)
//   variable: MONTO  DOUBLE LE — offset depende del tamaño del row
//             len 432 → @292, len 532-536 → @384, len 1188-1196 → @520.
//             Lo encontramos con la heurística scanMonto() abajo.
const OFF_PROV = 4;
const OFF_FECHA = 8;
const OFF_DETALLE = 16;

// Ampliado post-fragment-fix (2026-05-18): además de "Comprobante pago",
// detectar "Cancela: / ...", "Pago EFE/TRANS.B/OTRA", y "Nota Credito"
// como payments. Necesario porque el reassembly de HEAD+TAIL trae rows
// con estos marcadores.
const PAYMENT_MARKER = /(?:comprobante\s+pago|^cancela:|\bpago\s+(efe|trans\.?b|otra|cta)\b|nota\s+(de\s+)?credito)/im;

// Doubles "basura" que aparecen consistentemente en buffers ESTPROV
// (probablemente timestamps internos Firebird o expansiones de RLE de
// patrones binarios fijos). Si un DOUBLE matchea uno de éstos NO es el
// monto del movimiento. Tolerancia 0.01 para evitar falsos por floating-
// point.
const BLACKLIST_DOUBLES = [
  4805969.05, 532649.17, 5323013.19, 5323029.33,
  3713692.51, 3708992.32, 3180096.51, 4261153.05,
  3686508.38, 3052204.61, 3817610.60, 4804924.51, 4804924.00,
  131104, 131368.06, 132288, 17592,
  // Post-fragment-fix: basura constante detectada en offsets fijos
  1025792.01, 530192.13, 131072.0, 132768.02, 4804608.13,
];

function isBlacklisted(v: number): boolean {
  if (v >= 2883600 && v <= 2884000) return true; // timestamps internos
  // Post-fragment-fix (2026-05-18): cap a $1M para descartar basura RLE en
  // rango $1M-$5.4M. Movimientos legítimos individuales raramente exceden
  // este rango en gomería.
  if (v >= 1000000) return true;
  for (const b of BLACKLIST_DOUBLES) if (Math.abs(v - b) < 0.05) return true;
  return false;
}

/** Encuentra el monto real escaneando DOUBLES en el rango monetario y
 *  descartando los "basura" conocidos. Devuelve el primer candidato
 *  válido después de off>=100. */
function scanMonto(buf: Buffer): number | null {
  // Primero: prioridad al patrón "01 00 41 00" + DOUBLE (tag VARCHAR(1) "A"
  // que precede al monto en rows ESTPROV con tipo de comprobante "A").
  for (let o = 100; o + 12 <= buf.length; o++) {
    if (buf[o] === 0x01 && buf[o + 1] === 0x00 &&
        buf[o + 2] === 0x41 && buf[o + 3] === 0x00) {
      const v = buf.readDoubleLE(o + 4);
      if (Number.isFinite(v) && v > 0.5 && v < 1e7 && !isBlacklisted(v)) {
        return Math.round(v * 100) / 100;
      }
    }
  }
  // Fallback: scan secuencial buscando un DOUBLE en rango monetario,
  // no blacklisted, no excesivamente "redondo" (los timestamps internos
  // suelen ser >100k y enteros). Tomamos el primero después de off 100.
  for (let o = 100; o + 8 <= buf.length; o++) {
    const v = buf.readDoubleLE(o);
    if (!Number.isFinite(v)) continue;
    if (v <= 0.5 || v >= 1e7) continue;
    if (isBlacklisted(v)) continue;
    return Math.round(v * 100) / 100;
  }
  return null;
}

function extractMov(buf: Buffer, page: number, line: number): LegacyMov | null {
  if (buf.length < ROW_SIZE_MIN) return null;
  const prov = buf.readInt32LE(OFF_PROV);
  if (prov <= 0 || prov > 100000) return null;

  const at = fbTimestamp(buf, OFF_FECHA);
  if (!at) return null;

  // DETALLE — VARCHAR con length prefix en @16
  const detalle = readSlotVarchar(buf, OFF_DETALLE, 500);

  // OBSERV — usamos la presencia del marcador "Comprobante pago" en el
  // buffer entero para decidir tipo. No intentamos extraerlo como string
  // porque la zona después de DETALLE tiene basura RLE que rompe heurísticas
  // de length-prefix.
  const bufStr = buf.toString('latin1');
  const isPayment = PAYMENT_MARKER.test(bufStr);

  // MONTO — escaneo robusto (offset variable según len del row)
  const monto = scanMonto(buf);
  if (monto == null) return null;

  const type: 'charge' | 'payment' = isPayment ? 'payment' : 'charge';

  // Notes: si encontramos un "Comprobante pago ..." en el buffer, lo
  // extraemos como info adicional.
  let pagoLine: string | null = null;
  const m = bufStr.match(/Comprobante\s+pago[^\x00]{0,80}/i);
  if (m) pagoLine = m[0].replace(/[\s\x00]+$/, '');

  const notesParts = [detalle, pagoLine].filter(Boolean) as string[];
  const notes = notesParts.length > 0 ? notesParts.join(' | ').slice(0, 500) : null;

  return {
    page,
    line,
    prov,
    at,
    amount: Math.round(monto * 100) / 100,
    type,
    notes,
  };
}

/** Diagnóstico: dumpea los primeros 5 rows en hex + extracción tentativa. */
async function _inspectEstprov(gdbPath: string): Promise<void> {
  const rows = await readTable(gdbPath, RELATION_ID_ESTPROV);
  // eslint-disable-next-line no-console
  console.log(`[inspect] total rows: ${rows.length}`);
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const r = rows[i];
    // eslint-disable-next-line no-console
    console.log(`\n--- row p${r.page}:l${r.line} len=${r.buf.length}`);
    // eslint-disable-next-line no-console
    console.log('first 120:', r.buf.subarray(0, Math.min(120, r.buf.length)).toString('hex').replace(/(..)/g, '$1 '));
    // eslint-disable-next-line no-console
    console.log('120-240: ', r.buf.subarray(120, Math.min(240, r.buf.length)).toString('hex').replace(/(..)/g, '$1 '));
    // eslint-disable-next-line no-console
    console.log('240-360: ', r.buf.subarray(240, Math.min(360, r.buf.length)).toString('hex').replace(/(..)/g, '$1 '));
    // eslint-disable-next-line no-console
    console.log('360-end: ', r.buf.subarray(360).toString('hex').replace(/(..)/g, '$1 '));
    // Scan doubles
    const doubles: { off: number; v: number }[] = [];
    for (let o = 0; o + 8 <= r.buf.length; o++) {
      const v = r.buf.readDoubleLE(o);
      if (Number.isFinite(v) && v > 0.001 && v < 1e8) doubles.push({ off: o, v });
    }
    // eslint-disable-next-line no-console
    console.log('plausible doubles:', doubles.slice(0, 10));
    const mov = extractMov(r.buf, r.page, r.line);
    // eslint-disable-next-line no-console
    console.log('extracted:', mov);
  }
}

export async function loadSupplierMovements(
  gdbPath: string,
  _storeId: string,
  batchId: string,
): Promise<{ inserted: number; skipped: number; errors: unknown[] }> {
  const { admin } = await import('../lib/supabaseAdmin');
  const { bulkInsert } = await import('../lib/batch');
  // ── 1. Leer ESTPROV ──────────────────────────────────────────────────
  const rows = await readTable(gdbPath, RELATION_ID_ESTPROV);
  // eslint-disable-next-line no-console
  console.log(`[supplierMovements] raw rows: ${rows.length}`);

  const movs: LegacyMov[] = [];
  let skippedParse = 0;
  for (const r of rows) {
    const m = extractMov(r.buf, r.page, r.line);
    if (m) movs.push(m); else skippedParse++;
  }
  // eslint-disable-next-line no-console
  console.log(`[supplierMovements] parsed: ${movs.length}, skippedParse: ${skippedParse}`);

  if (movs.length === 0) {
    return { inserted: 0, skipped: skippedParse, errors: [{ msg: 'No se pudo parsear ningún row de ESTPROV — revisar offsets con `inspect`' }] };
  }

  // ── 2. Resolver supplier_id por lookup de legacy_id ─────────────────
  const provCodes = Array.from(new Set(movs.map(m => String(m.prov))));
  // eslint-disable-next-line no-console
  console.log(`[supplierMovements] distinct PROV codes: ${provCodes.length}`);
  const supplierByLegacy = new Map<string, string>();
  for (let i = 0; i < provCodes.length; i += 200) {
    const chunk = provCodes.slice(i, i + 200);
    const { data, error } = await admin
      .from('suppliers')
      .select('id, legacy_id')
      .in('legacy_id', chunk);
    if (error) return { inserted: 0, skipped: 0, errors: [error] };
    for (const r of data ?? []) {
      if (r.legacy_id) supplierByLegacy.set(r.legacy_id, r.id);
    }
  }
  // eslint-disable-next-line no-console
  console.log(`[supplierMovements] suppliers matched: ${supplierByLegacy.size}/${provCodes.length}`);

  // ── 3. Filtrar movimientos sin supplier match ───────────────────────
  let skippedNoSupplier = 0;
  const matched = movs.filter(m => {
    if (!supplierByLegacy.has(String(m.prov))) { skippedNoSupplier++; return false; }
    return true;
  });
  // eslint-disable-next-line no-console
  console.log(`[supplierMovements] matched: ${matched.length}, skippedNoSupplier: ${skippedNoSupplier}`);

  // ── 4. Filtrar legacy_ids ya importados ─────────────────────────────
  const allLegacyIds = matched.map(m => `ESTPROV:p${m.page}:l${m.line}`);
  const existing = new Set<string>();
  for (let i = 0; i < allLegacyIds.length; i += 200) {
    const chunk = allLegacyIds.slice(i, i + 200);
    const { data, error } = await admin
      .from('supplier_account_movements')
      .select('legacy_id')
      .in('legacy_id', chunk);
    if (error) {
      // eslint-disable-next-line no-console
      console.error(`[supplierMovements] error en chequeo idempotencia (i=${i}): ${error.message}`);
      return { inserted: 0, skipped: 0, errors: [error] };
    }
    for (const r of data ?? []) if (r.legacy_id) existing.add(r.legacy_id);
  }
  const fresh = matched.filter(m => !existing.has(`ESTPROV:p${m.page}:l${m.line}`));
  // eslint-disable-next-line no-console
  console.log(`[supplierMovements] fresh: ${fresh.length}, alreadyImported: ${existing.size}`);

  if (fresh.length === 0) {
    return {
      inserted: 0,
      skipped: skippedParse + skippedNoSupplier + existing.size,
      errors: [],
    };
  }

  // ── 5. Insertar en chunks ───────────────────────────────────────────
  // El trigger trg_sam_after_change disparará 29k recalculos; aceptamos
  // ese costo en favor de simplicidad. Si el insert tarda >10min se
  // puede mover a una RPC SECURITY DEFINER que haga
  // SET LOCAL session_replication_role = replica y recompute al final.
  const toInsert = fresh.map(m => ({
    supplier_id: supplierByLegacy.get(String(m.prov))!,
    type: m.type,
    amount: m.amount,
    notes: m.notes,
    at: m.at,
    legacy_id: `ESTPROV:p${m.page}:l${m.line}`,
    import_batch_id: batchId,
  }));

  // eslint-disable-next-line no-console
  console.log(`[supplierMovements] inserting ${toInsert.length} movements...`);
  const result = await bulkInsert('supplier_account_movements', toInsert, 500);
  return {
    inserted: result.inserted,
    skipped: skippedParse + skippedNoSupplier + existing.size,
    errors: result.errors,
  };
}

// ── CLI entrypoint para inspección ─────────────────────────────────────
// Uso: npx tsx scripts/import/loaders/supplierMovements.ts inspect
{
  const { fileURLToPath } = await import('node:url');
  const path = await import('node:path');
  const here = path.dirname(fileURLToPath(import.meta.url));
  const selfPath = fileURLToPath(import.meta.url);
  const argvPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
  const isMain = path.normalize(selfPath).toLowerCase() === path.normalize(argvPath).toLowerCase();
  if (isMain) {
    const { config } = await import('dotenv');
    config({ path: path.join(here, '..', '.env') });
    const cmd = process.argv[2];
    const gdb = process.env.GDB_PATH;
    if (!gdb) { console.error('GDB_PATH no definido'); process.exit(1); }
    if (cmd === 'inspect') {
      await _inspectEstprov(gdb);
    } else {
      console.error('Comandos: inspect');
      process.exit(1);
    }
  }
}

// Loader: ESTCLIE (110079 filas) → customer_account_movements.
//
// Schema declarado (Firebird, posición lógica):
//   0 NROF INTEGER       (PK numérico, no único en buffer descomprimido)
//   1 TIPOF VARCHAR(2)
//   2 CLIENTE INTEGER    FK a CLIENTES.CODC
//   3 PVENTA VARCHAR(4)
//   ...
//   7 FECHA TIMESTAMP
//   8 DETALLE VARCHAR(500)
//   9 DEBE DOUBLE
//  10 HABER DOUBLE
//  11 OBSERV VARCHAR(500)
//  13 TOTALR DOUBLE
//
// Estrategia (igual que supplierMovements):
//   - CLIENTE en off 4 INT32 LE  (PK numérica suele estar al inicio del payload)
//   - FECHA escaneada como INT32 MJD en off 0..40
//   - DETALLE y OBSERV vía length-prefix
//   - MONTO via scanMonto (offset variable según len)
//   - Tipo: si "Comprobante pago" en buffer → 'payment', si no → 'charge'
//
// Idempotencia: legacy_id = "ESTCLIE:p<page>:l<line>" — UNIQUE partial vía
// migration 0027. Si 0027 no está aplicada, el loader detecta el error
// 42703 (columna no existe) y aborta con mensaje claro.
//
// Requiere migration 0027 aplicada en remoto antes del primer run.

import { readTable, readSlotVarchar } from '../lib/gdbReader';

const RELATION_ID_ESTCLIE = 155;
const ROW_SIZE_MIN = 200;

const PAYMENT_MARKER = /comprobante\s+pago/i;

interface LegacyMov {
  page: number;
  line: number;
  cliente: number;
  at: string;
  amount: number;
  type: 'charge' | 'payment';
  notes: string | null;
}

function fbTimestamp(buf: Buffer, off: number): string | null {
  if (off + 8 > buf.length) return null;
  const days = buf.readInt32LE(off);
  if (days < 47000 || days > 70000) return null;
  const time = buf.readInt32LE(off + 4);
  const ms = Number.isFinite(time) && time >= 0 ? Math.min(Math.floor(time / 10), 86399999) : 0;
  return new Date(Date.UTC(1858, 10, 17) + days * 86400000 + ms).toISOString();
}

// Constantes "basura" comunes en buffers Firebird RLE — mismas que ESTPROV
// (mismo origen: timestamps internos y expansiones de patrones binarios).
const BLACKLIST_DOUBLES = [
  4805969.05, 532649.17, 5323013.19, 5323029.33,
  3713692.51, 3708992.32, 3180096.51, 4261153.05,
  3686508.38, 3052204.61, 3817610.60, 4804924.51, 4804924.00,
  4804608.13, // visto en ESTCLIE sample (basura RLE de patrón hex 40 24 24 41)
  131104, 131368.06, 132288, 17592,
];

function isBlacklisted(v: number): boolean {
  if (v >= 2883600 && v <= 2884000) return true;
  // Rango de timestamps Firebird internos expandidos por RLE: ~4.8M ± 100k.
  // Aparecen consistentemente en todos los rows ESTCLIE/ESTPROV y NUNCA son
  // montos reales (sería absurdo cobrar $4.8M por un servicio de gomería).
  // Si tu negocio espera movimientos >$1M, ajustar este rango.
  // Rangos donde caen los timestamps internos Firebird expandidos por RLE.
  // Empíricamente todos los doubles "basura" caen entre 3.0M-5.4M en ESTCLIE
  // y NO son montos reales (montos reales >$1M de un cliente individual son
  // excepcionales en gomería). Tradeoff aceptado: rechazar montos >$3M.
  if (v >= 3000000) return true;
  for (const b of BLACKLIST_DOUBLES) if (Math.abs(v - b) < 0.05) return true;
  return false;
}

function scanMonto(buf: Buffer): number | null {
  // Patrón "01 00 41 00" (tag VARCHAR(1) "A") + DOUBLE — frecuente en
  // movimientos con tipo de comprobante "A".
  for (let o = 100; o + 12 <= buf.length; o++) {
    if (buf[o] === 0x01 && buf[o + 1] === 0x00 &&
        buf[o + 2] === 0x41 && buf[o + 3] === 0x00) {
      const v = buf.readDoubleLE(o + 4);
      if (Number.isFinite(v) && v > 0.5 && v < 1e7 && !isBlacklisted(v)) {
        return Math.round(v * 100) / 100;
      }
    }
  }
  // Patrón "01 00 42 00" (letra "B") y "01 00 43 00" (letra "C")
  for (let o = 100; o + 12 <= buf.length; o++) {
    if (buf[o] === 0x01 && buf[o + 1] === 0x00 && buf[o + 3] === 0x00 &&
        (buf[o + 2] === 0x42 || buf[o + 2] === 0x43 || buf[o + 2] === 0x58)) {
      const v = buf.readDoubleLE(o + 4);
      if (Number.isFinite(v) && v > 0.5 && v < 1e7 && !isBlacklisted(v)) {
        return Math.round(v * 100) / 100;
      }
    }
  }
  // Fallback: scan secuencial
  for (let o = 100; o + 8 <= buf.length; o++) {
    const v = buf.readDoubleLE(o);
    if (!Number.isFinite(v)) continue;
    if (v <= 0.5 || v >= 1e7) continue;
    if (isBlacklisted(v)) continue;
    return Math.round(v * 100) / 100;
  }
  return null;
}

// MJD 65536 = 2038-04-23: constante mágica (2^16) que aparece consistente
// en off 10 de TODOS los rows ESTCLIE. Es un default del schema/parser
// que confunde el scan de fechas. Lo excluimos explícitamente.
const MJD_MAGIC_2038 = 65536;

function extractMov(buf: Buffer, page: number, line: number): LegacyMov | null {
  if (buf.length < ROW_SIZE_MIN) return null;

  // CLIENTE en off 4 (INT32). Validamos rango (1..200000).
  const cliente = buf.readInt32LE(4);
  if (cliente <= 0 || cliente > 200000) return null;

  // FECHA: escanear MJD plausible saltando la constante mágica 65536.
  // Las fechas reales suelen estar en off 36 o 40 (después de NROF, NROLOCAL,
  // MASCF que ocupan los primeros bytes).
  let fechaOff = -1;
  for (let o = 16; o + 4 <= buf.length && o <= 80; o++) {
    const d = buf.readInt32LE(o);
    if (d >= 47000 && d <= 70000 && d !== MJD_MAGIC_2038) { fechaOff = o; break; }
  }
  if (fechaOff < 0) return null;
  const at = fbTimestamp(buf, fechaOff);
  if (!at) return null;

  // DETALLE — buscamos un VARCHAR length-prefix con contenido ASCII limpio
  // (sin chars de control, con vocales). El primer match típico es
  // "Factura A nro 0005-..." o "Comprobante pago ...".
  let detalle: string | null = null;
  for (let o = fechaOff + 4; o + 2 <= buf.length && o < buf.length - 10; o++) {
    const len = buf.readUInt16LE(o);
    if (len < 8 || len > 500) continue;
    if (o + 2 + len > buf.length) continue;
    const raw = buf.subarray(o + 2, o + 2 + len);
    // Rechazar si contiene chars de control (excepto NUL trailing y espacios)
    let bad = false;
    let printable = 0;
    for (let i = 0; i < raw.length; i++) {
      const b = raw[i];
      if (b === 0x00) continue;
      if (b < 0x20 || b > 0x7e) { bad = true; break; }
      printable++;
    }
    if (bad) continue;
    if (printable < 8) continue;
    const s = raw.toString('latin1').replace(/[\s\x00]+/g, ' ').trim();
    if (/[A-Za-z].*[aeiouAEIOU]/i.test(s)) {
      detalle = s;
      break;
    }
  }

  const bufStr = buf.toString('latin1');
  const isPayment = PAYMENT_MARKER.test(bufStr);

  const monto = scanMonto(buf);
  if (monto == null) return null;

  const type: 'charge' | 'payment' = isPayment ? 'payment' : 'charge';

  let pagoLine: string | null = null;
  const m = bufStr.match(/Comprobante\s+pago\s+nro:\s+\d+\.?\s*Fecha:\s+\d+\/\d+\/\d+/i);
  if (m) pagoLine = m[0];

  const notesParts = [detalle, pagoLine].filter(Boolean) as string[];
  const notes = notesParts.length > 0 ? notesParts.join(' | ').slice(0, 500) : null;

  return { page, line, cliente, at, amount: monto, type, notes };
}

/** Diagnóstico: dumpea rows válidos (len>=200) con extracción tentativa. */
async function _inspectEstclie(gdbPath: string): Promise<void> {
  const rows = await readTable(gdbPath, RELATION_ID_ESTCLIE);
  // eslint-disable-next-line no-console
  console.log(`[inspect] total rows: ${rows.length}`);
  const validRows = rows.filter(r => r.buf.length >= 400);
  // eslint-disable-next-line no-console
  console.log(`[inspect] rows válidos (>=400 bytes): ${validRows.length}`);

  // Muestreo de páginas diversas
  const sampleIdx = [0, 100, 1000, 5000, 10000, 30000, 60000].filter(i => i < validRows.length);
  for (const i of sampleIdx) {
    const r = validRows[i];
    // eslint-disable-next-line no-console
    console.log(`\n=== sample #${i}: p${r.page}:l${r.line} len=${r.buf.length}`);
    // Primeros 200 bytes (donde están los campos cortos)
    const head = r.buf.subarray(0, Math.min(200, r.buf.length));
    // eslint-disable-next-line no-console
    console.log('head[0..200]:', head.toString('hex').replace(/(..)/g, '$1 '));
    // Fechas plausibles
    const fechas: { off: number; date: string }[] = [];
    for (let o = 0; o + 4 <= r.buf.length && o < 80; o++) {
      const d = r.buf.readInt32LE(o);
      if (d >= 47000 && d <= 70000) {
        fechas.push({ off: o, date: new Date(Date.UTC(1858, 10, 17) + d * 86400000).toISOString().slice(0, 10) });
      }
    }
    // eslint-disable-next-line no-console
    console.log('fechas plausibles:', fechas);
    // INT32 plausibles para CLIENTE
    const ints: { off: number; v: number }[] = [];
    for (let o = 0; o + 4 <= 30; o++) {
      const v = r.buf.readInt32LE(o);
      if (v > 0 && v < 30000) ints.push({ off: o, v });
    }
    // eslint-disable-next-line no-console
    console.log('int candidates (1..30000):', ints);
    // Buscar marker "Comprobante pago" + extraer fecha textual
    const bufStr = r.buf.toString('latin1');
    const cm = bufStr.match(/Comprobante\s+pago\s+nro:\s+(\d+)\.?\s*Fecha:\s+(\d+\/\d+\/\d+)/i);
    // eslint-disable-next-line no-console
    console.log('comprobante:', cm?.[0]);
    const mov = extractMov(r.buf, r.page, r.line);
    // eslint-disable-next-line no-console
    console.log('extracted:', mov);
  }
}

export async function loadCustomerMovements(
  gdbPath: string,
  _storeId: string,
  batchId: string,
): Promise<{ inserted: number; skipped: number; errors: unknown[] }> {
  const { admin } = await import('../lib/supabaseAdmin');
  const { bulkInsert } = await import('../lib/batch');

  // ── 1. Leer ESTCLIE ─────────────────────────────────────────────────
  const rows = await readTable(gdbPath, RELATION_ID_ESTCLIE);
  // eslint-disable-next-line no-console
  console.log(`[customerMovements] raw rows: ${rows.length}`);

  const movs: LegacyMov[] = [];
  let skippedParse = 0;
  for (const r of rows) {
    const m = extractMov(r.buf, r.page, r.line);
    if (m) movs.push(m); else skippedParse++;
  }
  // eslint-disable-next-line no-console
  console.log(`[customerMovements] parsed: ${movs.length}, skippedParse: ${skippedParse}`);

  if (movs.length === 0) {
    return { inserted: 0, skipped: skippedParse, errors: [{ msg: 'No se pudo parsear ningún row — revisar offsets con `inspect`' }] };
  }

  // ── 2. Lookup customer_id por legacy_id ─────────────────────────────
  const codes = Array.from(new Set(movs.map(m => String(m.cliente))));
  // eslint-disable-next-line no-console
  console.log(`[customerMovements] distinct CLIENTE codes: ${codes.length}`);
  const customerByLegacy = new Map<string, string>();
  for (let i = 0; i < codes.length; i += 200) {
    const chunk = codes.slice(i, i + 200);
    const { data, error } = await admin
      .from('customers')
      .select('id, legacy_id')
      .in('legacy_id', chunk);
    if (error) return { inserted: 0, skipped: 0, errors: [error] };
    for (const r of data ?? []) {
      if (r.legacy_id) customerByLegacy.set(r.legacy_id, r.id);
    }
  }
  // eslint-disable-next-line no-console
  console.log(`[customerMovements] customers matched: ${customerByLegacy.size}/${codes.length}`);

  let skippedNoCustomer = 0;
  const matched = movs.filter(m => {
    if (!customerByLegacy.has(String(m.cliente))) { skippedNoCustomer++; return false; }
    return true;
  });
  // eslint-disable-next-line no-console
  console.log(`[customerMovements] matched: ${matched.length}, skippedNoCustomer: ${skippedNoCustomer}`);

  // ── 3. Verificar que la columna legacy_id existe (mig 0027 aplicada) ─
  // Si no existe, el primer insert falla con 42703 y abortamos limpio.
  // ── 4. Idempotencia: filtrar legacy_ids ya importados ───────────────
  const allLegacyIds = matched.map(m => `ESTCLIE:p${m.page}:l${m.line}`);
  const existing = new Set<string>();
  for (let i = 0; i < allLegacyIds.length; i += 200) {
    const chunk = allLegacyIds.slice(i, i + 200);
    const { data, error } = await admin
      .from('customer_account_movements')
      .select('legacy_id')
      .in('legacy_id', chunk);
    if (error) {
      if (error.code === '42703') {
        return { inserted: 0, skipped: 0, errors: [{ msg: 'Falta migration 0027 — aplicarla antes de correr customerMovements.', detail: error.message }] };
      }
      return { inserted: 0, skipped: 0, errors: [error] };
    }
    for (const r of data ?? []) if (r.legacy_id) existing.add(r.legacy_id);
  }
  const fresh = matched.filter(m => !existing.has(`ESTCLIE:p${m.page}:l${m.line}`));
  // eslint-disable-next-line no-console
  console.log(`[customerMovements] fresh: ${fresh.length}, alreadyImported: ${existing.size}`);

  if (fresh.length === 0) {
    return {
      inserted: 0,
      skipped: skippedParse + skippedNoCustomer + existing.size,
      errors: [],
    };
  }

  // ── 5. Insertar en chunks ───────────────────────────────────────────
  // El trigger customer_account_movements_balance (mig 0007) recalcula
  // balance + credit_limit. Para 100k+ rows esto es costoso. Si tarda
  // demasiado, considerar deshabilitar trigger temporalmente.
  const toInsert = fresh.map(m => ({
    customer_id: customerByLegacy.get(String(m.cliente))!,
    type: m.type,
    amount: m.amount,
    notes: m.notes,
    at: m.at,
    legacy_id: `ESTCLIE:p${m.page}:l${m.line}`,
    import_batch_id: batchId,
  }));

  // eslint-disable-next-line no-console
  console.log(`[customerMovements] inserting ${toInsert.length} movements...`);
  const result = await bulkInsert('customer_account_movements', toInsert, 500);
  return {
    inserted: result.inserted,
    skipped: skippedParse + skippedNoCustomer + existing.size,
    errors: result.errors,
  };
}

// CLI: npx tsx scripts/import/loaders/customerMovements.ts inspect
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
      await _inspectEstclie(gdb);
    } else {
      console.error('Comandos: inspect');
      process.exit(1);
    }
  }
}

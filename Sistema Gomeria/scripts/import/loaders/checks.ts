// Loader: CHEQUES (3488 filas) → checks
//
// Schema declarado:
//   0 NRO VARCHAR(20)         — número de cheque (PK lógica)
//   1 BANCO INTEGER           — FK a BANCOS.CODBANCO
//   2 CLIEPROV INTEGER        — FK polimórfico: si TIPO='I' → customer, si TIPO='E' → supplier
//   3 FECHAEMISION TIMESTAMP
//   4 MONTO DOUBLE
//   5 FECHACOBRO TIMESTAMP
//   6 ENTREGADO_POR VARCHAR(50)
//   7 ENTREGADO_A VARCHAR(50)
//   8 TIPO VARCHAR(1)         — 'I'=incoming (de cliente), 'E'=outgoing (a proveedor)
//   9 DETALLE VARCHAR(150)
//  10 COBRADO VARCHAR(1)      — 'S'/'N'
//  11 FECHAENTRADA TIMESTAMP
//  12 FECHASALIDA TIMESTAMP
//  13 COD_PAGO_FACT INTEGER
//  14 ESTADO VARCHAR(1)
//
// Mapeo a `checks` (mig 0023):
//   check_number   ← NRO (text)
//   bank_id        ← lookup banks.legacy_id = String(BANCO)
//   customer_id    ← si TIPO='I': lookup customers.legacy_id = String(CLIEPROV)
//   supplier_id    ← si TIPO='E': lookup suppliers.legacy_id = String(CLIEPROV)
//   type           ← 'incoming' | 'outgoing'
//   amount         ← MONTO
//   emission_date  ← FECHAEMISION
//   collection_date← FECHACOBRO
//   entry_date     ← FECHAENTRADA
//   exit_date      ← FECHASALIDA
//   given_by       ← ENTREGADO_POR
//   given_to       ← ENTREGADO_A
//   detail         ← DETALLE
//   cashed         ← COBRADO='S'
//   legacy_id      ← "CHEQUES:p<page>:l<line>"
//
// Idempotencia: legacy_id UNIQUE partial (definido en 0023).

import { readTable, readSlotVarchar } from '../lib/gdbReader';

const RELATION_ID_CHEQUES = 158;
const ROW_SIZE_MIN = 100;

interface LegacyCheck {
  page: number;
  line: number;
  nro: string;
  banco: number;
  clieprov: number;
  tipo: 'I' | 'E' | null;
  monto: number;
  emisionAt: string | null;
  cobroAt: string | null;
  entradaAt: string | null;
  salidaAt: string | null;
  entregadoPor: string | null;
  entregadoA: string | null;
  detalle: string | null;
  cobrado: boolean;
}

function fbTimestamp(buf: Buffer, off: number): string | null {
  if (off + 8 > buf.length) return null;
  const days = buf.readInt32LE(off);
  if (days < 47000 || days > 70000) return null;
  if (days === 65536) return null; // constante mágica
  return new Date(Date.UTC(1858, 10, 17) + days * 86400000).toISOString();
}

const BLACKLIST_DOUBLES = [
  4805969.05, 532649.17, 5323013.19, 5323029.33,
  3713692.51, 3708992.32, 3180096.51, 4261153.05,
  3686508.38, 3052204.61, 3817610.60, 4804924.51, 4804924.00, 4804608.13,
  131104, 131368.06, 132288, 17592,
];

function isBlacklisted(v: number): boolean {
  if (v >= 2883600 && v <= 2884000) return true;
  if (v >= 3000000) return true; // mismo tradeoff que customerMovements
  for (const b of BLACKLIST_DOUBLES) if (Math.abs(v - b) < 0.05) return true;
  return false;
}

function scanMonto(buf: Buffer): number | null {
  // CHEQUES tiene rows cortos (~352 bytes), el MONTO suele estar @36-44.
  // Empezamos en 30 (después del NRO+padding).
  for (let o = 30; o + 8 <= buf.length; o++) {
    const v = buf.readDoubleLE(o);
    if (!Number.isFinite(v)) continue;
    if (v <= 0.5 || v >= 1e7) continue;
    if (isBlacklisted(v)) continue;
    return Math.round(v * 100) / 100;
  }
  return null;
}

function extractCheck(buf: Buffer, page: number, line: number): LegacyCheck | null {
  if (buf.length < ROW_SIZE_MIN) return null;

  // NRO VARCHAR(20) — primer slot, len-prefix después del header
  // Probamos offsets típicos: 4, 6, 8 (NRO es campo 0, debería estar al inicio)
  let nro: string | null = null;
  for (let o = 4; o <= 30; o++) {
    const s = readSlotVarchar(buf, o, 20);
    if (s && /^[A-Za-z0-9\-/\.]{3,20}$/.test(s.trim())) { nro = s.trim(); break; }
  }
  if (!nro) return null;

  // Escanear INT32 plausibles para BANCO y CLIEPROV (códigos chicos)
  // BANCO suele ser <100, CLIEPROV puede ser hasta ~200k
  let banco = 0;
  let clieprov = 0;
  for (let o = 8; o + 4 <= 60; o++) {
    const v = buf.readInt32LE(o);
    if (banco === 0 && v >= 1 && v <= 999) banco = v;
    else if (clieprov === 0 && v >= 1 && v <= 200000 && v !== banco) clieprov = v;
    if (banco && clieprov) break;
  }

  // TIPO 'I'/'E': no podemos detectarlo confiablemente del buffer porque
  // el CHAR(1) sin length-prefix se confunde con otro byte cualquiera.
  // Resolución: dejamos tipo=null y el loader principal hace lookup en
  // ambas tablas (customers/suppliers) para resolver CLIEPROV.
  const tipo: 'I' | 'E' | null = null;

  const monto = scanMonto(buf);
  if (monto == null) return null;

  // Fechas: escanear todos los MJD plausibles y asignar por orden de aparición
  // Orden esperado en schema: FECHAEMISION, FECHACOBRO, (skip text), FECHAENTRADA, FECHASALIDA
  const fechas: string[] = [];
  for (let o = 8; o + 4 <= buf.length; o++) {
    const d = buf.readInt32LE(o);
    if (d >= 47000 && d <= 70000 && d !== 65536) {
      const date = new Date(Date.UTC(1858, 10, 17) + d * 86400000).toISOString();
      if (!fechas.includes(date)) fechas.push(date);
      if (fechas.length >= 4) break;
    }
  }

  // Strings ENTREGADO_POR/A y DETALLE: buscar VARCHARs limpios
  const strings: string[] = [];
  for (let o = 30; o + 2 <= buf.length && strings.length < 3; o++) {
    const len = buf.readUInt16LE(o);
    if (len < 4 || len > 150) continue;
    if (o + 2 + len > buf.length) continue;
    const raw = buf.subarray(o + 2, o + 2 + len);
    let printable = 0;
    let bad = false;
    for (let i = 0; i < raw.length; i++) {
      const b = raw[i];
      if (b === 0x00) continue;
      if (b < 0x20 || b > 0x7e) { bad = true; break; }
      printable++;
    }
    if (bad || printable < 4) continue;
    const s = raw.toString('latin1').replace(/[\s\x00]+/g, ' ').trim();
    if (/[A-Za-z].*[aeiouAEIOU]/i.test(s)) strings.push(s);
  }

  // COBRADO: 'S' o 'N' (CHAR(1)) — heurística laxa
  const bufStr = buf.toString('latin1');
  const cobrado = /\bcobrado\b|\b[Ss]\b/.test(bufStr) && !/no\s*cobrado/i.test(bufStr);

  return {
    page, line, nro,
    banco, clieprov, tipo,
    monto,
    emisionAt: fechas[0] ?? null,
    cobroAt: fechas[1] ?? null,
    entradaAt: fechas[2] ?? null,
    salidaAt: fechas[3] ?? null,
    entregadoPor: strings[0] ?? null,
    entregadoA: strings[1] ?? null,
    detalle: strings[2] ?? null,
    cobrado,
  };
}

async function _inspectCheques(gdbPath: string): Promise<void> {
  const rows = await readTable(gdbPath, RELATION_ID_CHEQUES);
  // eslint-disable-next-line no-console
  console.log(`[inspect] total rows: ${rows.length}`);
  const valid = rows.filter(r => r.buf.length >= ROW_SIZE_MIN);
  // eslint-disable-next-line no-console
  console.log(`[inspect] válidos (>=${ROW_SIZE_MIN}): ${valid.length}`);
  const sampleIdx = [0, 100, 500, 1000, 2000, 3000].filter(i => i < valid.length);
  for (const i of sampleIdx) {
    const r = valid[i];
    // eslint-disable-next-line no-console
    console.log(`\n=== #${i} p${r.page}:l${r.line} len=${r.buf.length}`);
    // eslint-disable-next-line no-console
    console.log('head[0..120]:', r.buf.subarray(0, Math.min(120, r.buf.length)).toString('hex').replace(/(..)/g, '$1 '));
    const c = extractCheck(r.buf, r.page, r.line);
    // eslint-disable-next-line no-console
    console.log('extracted:', c);
  }
}

export async function loadChecks(
  gdbPath: string,
  _storeId: string,
  batchId: string,
): Promise<{ inserted: number; skipped: number; errors: unknown[] }> {
  const { admin } = await import('../lib/supabaseAdmin');
  const { bulkInsert } = await import('../lib/batch');

  const rows = await readTable(gdbPath, RELATION_ID_CHEQUES);
  // eslint-disable-next-line no-console
  console.log(`[checks] raw rows: ${rows.length}`);

  const checks: LegacyCheck[] = [];
  let skippedParse = 0;
  for (const r of rows) {
    const c = extractCheck(r.buf, r.page, r.line);
    if (c) checks.push(c); else skippedParse++;
  }
  // eslint-disable-next-line no-console
  console.log(`[checks] parsed: ${checks.length}, skippedParse: ${skippedParse}`);

  if (checks.length === 0) {
    return { inserted: 0, skipped: skippedParse, errors: [{ msg: 'No se pudo parsear ningún row' }] };
  }

  // Lookups: banks, y CLIEPROV en ambas tablas (customers + suppliers).
  // Como no detectamos TIPO del buffer, hacemos lookup en ambos lados y
  // resolvemos por presencia (preferimos customer si está en ambos).
  const bancoCodes = Array.from(new Set(checks.map(c => String(c.banco)))).filter(c => c !== '0');
  const cliCodes = Array.from(new Set(checks.map(c => String(c.clieprov)))).filter(c => c !== '0');

  const bankByLegacy = new Map<string, string>();
  for (let i = 0; i < bancoCodes.length; i += 200) {
    const { data } = await admin.from('banks').select('id, legacy_id').in('legacy_id', bancoCodes.slice(i, i + 200));
    for (const r of data ?? []) if (r.legacy_id) bankByLegacy.set(r.legacy_id, r.id);
  }
  const custByLegacy = new Map<string, string>();
  for (let i = 0; i < cliCodes.length; i += 200) {
    const { data } = await admin.from('customers').select('id, legacy_id').in('legacy_id', cliCodes.slice(i, i + 200));
    for (const r of data ?? []) if (r.legacy_id) custByLegacy.set(r.legacy_id, r.id);
  }
  const suppByLegacy = new Map<string, string>();
  for (let i = 0; i < cliCodes.length; i += 200) {
    const { data } = await admin.from('suppliers').select('id, legacy_id').in('legacy_id', cliCodes.slice(i, i + 200));
    for (const r of data ?? []) if (r.legacy_id) suppByLegacy.set(r.legacy_id, r.id);
  }
  // eslint-disable-next-line no-console
  console.log(`[checks] banks matched: ${bankByLegacy.size}/${bancoCodes.length}, customers: ${custByLegacy.size}/${cliCodes.length}, suppliers: ${suppByLegacy.size}/${cliCodes.length}`);

  // Idempotencia
  const allLegacyIds = checks.map(c => `CHEQUES:p${c.page}:l${c.line}`);
  const existing = new Set<string>();
  for (let i = 0; i < allLegacyIds.length; i += 200) {
    const { data } = await admin.from('checks').select('legacy_id').in('legacy_id', allLegacyIds.slice(i, i + 200));
    for (const r of data ?? []) if (r.legacy_id) existing.add(r.legacy_id);
  }
  const fresh = checks.filter(c => !existing.has(`CHEQUES:p${c.page}:l${c.line}`));
  // eslint-disable-next-line no-console
  console.log(`[checks] fresh: ${fresh.length}, already: ${existing.size}`);

  if (fresh.length === 0) return { inserted: 0, skipped: skippedParse + existing.size, errors: [] };

  const toInsert = fresh.map(c => {
    const code = String(c.clieprov);
    const custId = custByLegacy.get(code);
    const suppId = suppByLegacy.get(code);
    // Resolución de polimorfismo:
    // - Si solo matchea uno, ese gana.
    // - Si matchean ambos (mismo código en customers y suppliers), preferimos
    //   customer (cheques entrantes son más comunes en gomería).
    // - Si no matchea ninguno, dejamos los dos null y type='incoming' por default.
    let customer_id: string | null = null;
    let supplier_id: string | null = null;
    let type: 'incoming' | 'outgoing' = 'incoming';
    if (custId && !suppId) { customer_id = custId; type = 'incoming'; }
    else if (suppId && !custId) { supplier_id = suppId; type = 'outgoing'; }
    else if (custId && suppId) { customer_id = custId; type = 'incoming'; }
    return {
    check_number: c.nro,
    bank_id: bankByLegacy.get(String(c.banco)) ?? null,
    customer_id,
    supplier_id,
    type,
    amount: c.monto,
    emission_date: c.emisionAt,
    collection_date: c.cobroAt,
    entry_date: c.entradaAt,
    exit_date: c.salidaAt,
    given_by: c.entregadoPor,
    given_to: c.entregadoA,
    detail: c.detalle,
    cashed: c.cobrado,
    legacy_id: `CHEQUES:p${c.page}:l${c.line}`,
    import_batch_id: batchId,
    };
  });

  // eslint-disable-next-line no-console
  console.log(`[checks] inserting ${toInsert.length}...`);
  const result = await bulkInsert('checks', toInsert, 500);
  return {
    inserted: result.inserted,
    skipped: skippedParse + existing.size,
    errors: result.errors,
  };
}

// CLI
{
  const { fileURLToPath } = await import('node:url');
  const path = await import('node:path');
  const here = path.dirname(fileURLToPath(import.meta.url));
  const selfPath = fileURLToPath(import.meta.url);
  const argvPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
  if (path.normalize(selfPath).toLowerCase() === path.normalize(argvPath).toLowerCase()) {
    const { config } = await import('dotenv');
    config({ path: path.join(here, '..', '.env') });
    const cmd = process.argv[2];
    const gdb = process.env.GDB_PATH;
    if (!gdb) { console.error('GDB_PATH no definido'); process.exit(1); }
    if (cmd === 'inspect') await _inspectCheques(gdb);
    else { console.error('Comandos: inspect'); process.exit(1); }
  }
}

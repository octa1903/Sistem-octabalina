// Loader: PAGOS (36209 filas) → enriquecer customer_account_movements
// y supplier_account_movements con payment_method_id.
//
// Schema PAGOS:
//   0 NROCOMPR INTEGER     — número de comprobante de pago (PK lógica)
//   1 TIPOPAGO VARCHAR(1)  — 'C'=customer, 'P'=provider/supplier
//   2 CLIEPROV INTEGER     — código del actor
//   3 FECHA TIMESTAMP
//   4 DETALLE VARCHAR(500)
//   5 MONTO DOUBLE
//   6 FPAGO VARCHAR(15)    — método de pago textual: "EFECTIVO", "CHEQUE", etc.
//
// Mapeo FPAGO → payment_method.name:
//   EFECTIVO     → "Efectivo"
//   CHEQUE       → "Cheque"
//   TRANSFER..   → "Transferencia"
//   TARJETA/DEB. → "Débito"
//   TARJETA C..  → "Crédito 1 cuota" (default si no especifica cuotas)
//   CTA CTE      → "Cuenta Corriente"
//   default      → "Efectivo"
//
// Strategy de enriquecimiento:
// Para cada PAGO con NROCOMPR=N y FPAGO=method:
//   UPDATE customer/supplier_account_movements
//   SET payment_method_id = <method_id>
//   WHERE type = 'payment'
//     AND notes ILIKE '%Comprobante pago nro: N.%'  (LIKE con escape de números)
//
// El match es por nrocompr + texto en notes (Comprobante pago nro: NN).
// Esos textos ya están en customer_account_movements por nuestro
// loader customerMovements.
//
// No insertamos rows nuevas: solo UPDATE existing.

import { readTable } from '../lib/gdbReader';

const RELATION_ID_PAGOS = 179;
const ROW_SIZE_MIN = 100;

interface LegacyPago {
  nrocompr: number;
  tipopago: 'C' | 'P' | null;
  fpago: string | null;
}

function extractPago(buf: Buffer): LegacyPago | null {
  if (buf.length < ROW_SIZE_MIN) return null;
  const nrocompr = buf.readInt32LE(4);
  if (nrocompr <= 0 || nrocompr > 1000000) return null;

  // FPAGO VARCHAR(15) — está en un offset variable después del MONTO
  // (DOUBLE @ off ~128). El formato visto:
  //   ... <monto:double> 05 00 4f 54 52 41 20 ...
  //                       └─ len 5 ─┘ "OTRA "
  // El segundo VARCHAR con length 3..15 que aparezca DESPUÉS del monto
  // (offset > 120) es FPAGO. Si tiene keyword de método lo usamos, si es
  // "OTRA" o desconocido lo dejamos como label crudo para mapear.
  let fpago: string | null = null;
  for (let o = 120; o + 2 <= buf.length; o++) {
    const len = buf.readUInt16LE(o);
    if (len < 3 || len > 15) continue;
    if (o + 2 + len > buf.length) continue;
    const raw = buf.subarray(o + 2, o + 2 + len);
    let bad = false;
    let printable = 0;
    for (let i = 0; i < raw.length; i++) {
      const b = raw[i];
      if (b === 0x00) continue;
      if (b < 0x20 || b > 0x7e) { bad = true; break; }
      printable++;
    }
    if (bad || printable < 3) continue;
    const s = raw.toString('latin1').replace(/[\s\x00]+/g, ' ').trim().toUpperCase();
    // Aceptar tokens conocidos (uppercase, letras+espacios+punto)
    if (/^[A-Z][A-Z\.\s]{2,14}$/.test(s)) {
      fpago = s;
      break;
    }
  }

  // TIPOPAGO 'C' o 'P' — no se puede leer confiablemente del buffer.
  // Lo dejamos null y aplicamos el UPDATE a ambas tablas.
  const tipopago: 'C' | 'P' | null = null;

  return { nrocompr, tipopago, fpago };
}

/** Mapa keyword → nombre de payment_method existente */
function mapFpagoToMethodName(fpago: string | null): string {
  if (!fpago) return 'Efectivo';
  const s = fpago.toUpperCase();
  if (/CHEQ/.test(s)) return 'Cheque';
  if (/TRANSF|TRANS\.?B/.test(s)) return 'Transferencia';
  if (/EFECT|EFVO|EFE\b/.test(s)) return 'Efectivo';
  if (/D[ÉE]BIT|DEBIT/.test(s)) return 'Débito';
  if (/CR[ÉE]DIT|TARJ/.test(s)) return 'Crédito 1 cuota';
  if (/CTA|CUENTA|CORRIENTE|OTRA/.test(s)) return 'Cuenta Corriente';
  // "OTRA" en gomería legacy usualmente significa depósito/transferencia/CC
  return 'Cuenta Corriente';
}

async function _inspectPagos(gdbPath: string): Promise<void> {
  const rows = await readTable(gdbPath, RELATION_ID_PAGOS);
  // eslint-disable-next-line no-console
  console.log(`[inspect] total rows: ${rows.length}`);
  const valid = rows.filter(r => r.buf.length >= ROW_SIZE_MIN);
  // eslint-disable-next-line no-console
  console.log(`[inspect] válidos (>=${ROW_SIZE_MIN}): ${valid.length}`);
  // Dump completo de unos rows
  for (const i of [0, 1, 50, 100]) {
    const r = valid[i];
    if (!r) continue;
    // eslint-disable-next-line no-console
    console.log(`\n=== #${i} p${r.page}:l${r.line} len=${r.buf.length}`);
    // eslint-disable-next-line no-console
    console.log('head[0..200]:', r.buf.subarray(0, Math.min(200, r.buf.length)).toString('hex').replace(/(..)/g, '$1 '));
    // ASCII visible
    const ascii = [];
    for (const b of r.buf.subarray(0, Math.min(200, r.buf.length))) {
      ascii.push(b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.');
    }
    // eslint-disable-next-line no-console
    console.log('ascii:', ascii.join(''));
    // eslint-disable-next-line no-console
    console.log('extracted:', extractPago(r.buf));
  }
  // Distribución sobre 1000 rows
  const fpagoCounts = new Map<string, number>();
  for (const r of valid.slice(0, 1000)) {
    const p = extractPago(r.buf);
    const k = p?.fpago ?? '(null)';
    fpagoCounts.set(k, (fpagoCounts.get(k) ?? 0) + 1);
  }
  // eslint-disable-next-line no-console
  console.log('\nFPAGO distribution (sample 1000):');
  for (const [k, v] of [...fpagoCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    // eslint-disable-next-line no-console
    console.log(`  ${k} → ${v} (maps to "${mapFpagoToMethodName(k === '(null)' ? null : k)}")`);
  }
}

export async function loadPayments(
  gdbPath: string,
  _storeId: string,
  _batchId: string,
): Promise<{ inserted: number; skipped: number; errors: unknown[] }> {
  const { admin } = await import('../lib/supabaseAdmin');

  // ── 1. Cargar payment_methods → name → id ────────────────────────────
  const { data: methods, error: mErr } = await admin
    .from('payment_methods')
    .select('id, name');
  if (mErr || !methods) return { inserted: 0, skipped: 0, errors: [mErr] };
  const methodByName = new Map<string, string>();
  for (const m of methods) methodByName.set(m.name, m.id);
  // eslint-disable-next-line no-console
  console.log(`[payments] payment_methods cargados: ${methodByName.size}`);
  if (!methodByName.has('Cheque')) {
    return { inserted: 0, skipped: 0, errors: [{ msg: 'Falta payment_method "Cheque" — aplicar mig 0029 primero' }] };
  }

  // ── 2. Leer PAGOS y extraer (nrocompr, fpago) ────────────────────────
  const rows = await readTable(gdbPath, RELATION_ID_PAGOS);
  // eslint-disable-next-line no-console
  console.log(`[payments] raw rows: ${rows.length}`);
  const pagos: LegacyPago[] = [];
  let skippedParse = 0;
  for (const r of rows) {
    const p = extractPago(r.buf);
    if (p) pagos.push(p); else skippedParse++;
  }
  // eslint-disable-next-line no-console
  console.log(`[payments] parsed: ${pagos.length}, skippedParse: ${skippedParse}`);

  // ── 3. Build mapa nrocompr → methodId ────────────────────────────────
  const methodByNroCompr = new Map<number, string>();
  const fpagoDist = new Map<string, number>();
  for (const p of pagos) {
    const methodName = mapFpagoToMethodName(p.fpago);
    const methodId = methodByName.get(methodName);
    if (!methodId) continue;
    methodByNroCompr.set(p.nrocompr, methodId);
    fpagoDist.set(methodName, (fpagoDist.get(methodName) ?? 0) + 1);
  }
  // eslint-disable-next-line no-console
  console.log(`[payments] NROCOMPR → method mapeados: ${methodByNroCompr.size}`);
  // eslint-disable-next-line no-console
  console.log('[payments] distribución:', Object.fromEntries(fpagoDist));

  // ── 4. UPDATE customer + supplier account movements ─────────────────
  // Estrategia: agrupar nrocompr por methodId, luego ejecutar UPDATE batched
  // con un OR de patterns. Pero SQL OR con 36k patterns es prohibitivo.
  // Alternativa práctica: iteramos por NROCOMPR y hacemos UPDATE individual
  // con .ilike('notes', `%Comprobante pago nro: ${n}.%`). 36k queries.
  //
  // Optimización: usar update con .or() de hasta 50 patterns por query.
  let totalUpdated = 0;
  const errors: unknown[] = [];
  let processed = 0;
  // Agrupar por methodId para procesar en batches
  const byMethod = new Map<string, number[]>();
  for (const [nro, mid] of methodByNroCompr) {
    if (!byMethod.has(mid)) byMethod.set(mid, []);
    byMethod.get(mid)!.push(nro);
  }
  for (const [methodId, nros] of byMethod) {
    // Procesar de a chunks de 50 (OR limit razonable)
    for (let i = 0; i < nros.length; i += 50) {
      const chunk = nros.slice(i, i + 50);
      const orFilter = chunk
        .map(n => `notes.ilike.%Comprobante pago nro: ${n}.%`)
        .join(',');
      // customer_account_movements
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: e1, count: c1 } = await (admin
        .from('customer_account_movements')
        .update({ payment_method_id: methodId }, { count: 'exact' }) as any)
        .eq('type', 'payment')
        .is('payment_method_id', null)
        .or(orFilter);
      if (e1) errors.push(e1);
      else totalUpdated += c1 ?? 0;
      // supplier_account_movements
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: e2, count: c2 } = await (admin
        .from('supplier_account_movements')
        .update({ payment_method_id: methodId }, { count: 'exact' }) as any)
        .eq('type', 'payment')
        .is('payment_method_id', null)
        .or(orFilter);
      if (e2) errors.push(e2);
      else totalUpdated += c2 ?? 0;
      processed += chunk.length;
      if (processed % 500 === 0) {
        // eslint-disable-next-line no-console
        console.log(`  [payments] processed ${processed}/${methodByNroCompr.size}, updated so far: ${totalUpdated}`);
      }
    }
  }

  // eslint-disable-next-line no-console
  console.log(`[payments] total movements updated: ${totalUpdated}`);
  return {
    inserted: totalUpdated,
    skipped: skippedParse + (pagos.length - methodByNroCompr.size),
    errors,
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
    if (cmd === 'inspect') await _inspectPagos(gdb);
    else { console.error('Comandos: inspect'); process.exit(1); }
  }
}

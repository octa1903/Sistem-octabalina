// Loader: NROS (singleton config) → stores.fiscal_identity jsonb
//
// El legacy tenía 1 fila grande (624 bytes) con la identidad fiscal del
// negocio + 7 filas pequeñas (legados/indices). Solo nos interesa la fila
// grande con los strings de razón social, CUIT, dirección, cert AFIP.

import { readTable } from '../lib/gdbReader';
import { admin } from '../lib/supabaseAdmin';

const RELATION_ID_NROS = 153;

/**
 * Lee bytes en latin1 desde un offset fijo. Corta en el primer byte 0x00
 * o de control. Útil para slots VARCHAR físicos cuando el length prefix
 * no funciona (porque caracteres latinos como ñ rompen heurísticas ASCII).
 */
function readSlot(buf: Buffer, off: number, maxLen: number): string | null {
  if (off < 0 || off + maxLen > buf.length) return null;
  const slice = buf.subarray(off, off + maxLen);
  let end = slice.length;
  for (let i = 0; i < slice.length; i++) {
    const b = slice[i];
    if (b === 0 || (b < 0x20 && b !== 0x09)) { end = i; break; }
  }
  const s = slice.subarray(0, end).toString('latin1').trim();
  return s || null;
}

export async function loadFiscalIdentity(
  gdbPath: string,
  storeId: string,
): Promise<{ inserted: number; skipped: number; errors: unknown[] }> {
  const rows = await readTable(gdbPath, RELATION_ID_NROS);
  // Buscar el row más grande (config completa, 624 bytes)
  const configRow = rows
    .map(r => r.buf)
    .sort((a, b) => b.length - a.length)[0];

  if (!configRow || configRow.length < 500) {
    // eslint-disable-next-line no-console
    console.log('[fiscalIdentity] no se encontró el row de configuración');
    return { inserted: 0, skipped: rows.length, errors: [] };
  }

  // Offsets observados con findAsciiRun en la fila de 624 bytes:
  //   170: razonSocial — "Baliña Luis A. - Baliña Sebastian D. SH"
  //   252: cuit
  //   288: inicioActiv
  //   306: dirTel
  //   388: localidad
  //   470: ivaCondition
  //   522: certAfipPath
  //   574: claveAfipPath
  const fiscalIdentity: Record<string, string> = {};
  const razonSocial = readSlot(configRow, 170, 80);
  const cuit = readSlot(configRow, 252, 15);
  const inicioActiv = readSlot(configRow, 288, 15);
  const dirTel = readSlot(configRow, 306, 80);
  const localidad = readSlot(configRow, 388, 80);
  const ivaCondition = readSlot(configRow, 470, 50);
  const certAfipPath = readSlot(configRow, 522, 50);
  const claveAfipPath = readSlot(configRow, 574, 50);

  if (razonSocial) fiscalIdentity.razonSocial = razonSocial;
  if (cuit) fiscalIdentity.cuit = cuit;
  if (inicioActiv) fiscalIdentity.inicioActiv = inicioActiv;
  if (dirTel) fiscalIdentity.dirTel = dirTel;
  if (localidad) fiscalIdentity.localidad = localidad;
  if (ivaCondition) fiscalIdentity.ivaCondition = ivaCondition;
  if (certAfipPath) fiscalIdentity.certAfipPath = certAfipPath;
  if (claveAfipPath) fiscalIdentity.claveAfipPath = claveAfipPath;

  if (!fiscalIdentity.razonSocial && !fiscalIdentity.cuit) {
    // eslint-disable-next-line no-console
    console.log('[fiscalIdentity] no se pudo extraer razonSocial ni cuit');
    return { inserted: 0, skipped: 1, errors: [] };
  }

  // eslint-disable-next-line no-console
  console.log('[fiscalIdentity] extraído:', fiscalIdentity);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin.from('stores') as any)
    .update({ fiscal_identity: fiscalIdentity })
    .eq('id', storeId);

  if (error) return { inserted: 0, skipped: 1, errors: [error] };
  return { inserted: 1, skipped: 0, errors: [] };
}

// Lee rows raw del .gdb (Firebird ODS 10) sin engine externo.
//
// Layout de page/record según `src/jrd/ods.h` branch B1_5_Release del repo
// upstream FirebirdSQL/firebird:
//
//   Data Page (header type 0x05):
//     0x00  pag_type   (u8)   = 0x05
//     0x14  dpg_relation (u16) = relation id
//     0x16  dpg_count    (u16) = number of TOC entries
//     0x18  TOC[i] = { offset:u16, length:u16 } por cada record
//
//   Record header `rhd` (NORMAL, 17 bytes) — `rhdf` (FRAGMENTED HEAD, 22 bytes):
//     0x00  rhd_transaction (u32)
//     0x04  rhd_b_page      (u32)   back pointer prev version
//     0x08  rhd_b_line      (u16)
//     0x0a  rhd_flags       (u16)
//     0x0c  rhd_format      (u8)
//     0x0d  padding (3 bytes, alineamiento C)
//     0x10  rhdf_f_page     (u32)   solo si flag INCOMPLETE
//     0x14  rhdf_f_line     (u16)   solo si flag INCOMPLETE
//     0x16  payload RLE start (HEAD)
//   En rows NORMAL (sin INCOMPLETE) el payload empieza nominalmente en 0x11,
//   pero el parser legacy lo arrancaba en 0x0d (3 bytes de header consumidos
//   como control RLE inocuo) y los loaders calibraron sus offsets contra ese
//   layout. Para no romper esa calibración, **mantenemos el 0x0d para NORMAL**.
//
//   Flags rhd_* (constantes):
//     0x01  rhd_deleted
//     0x02  rhd_chain      versión MVCC vieja (raro)
//     0x04  rhd_fragment   este record es un TAIL (continuación)
//     0x08  rhd_incomplete este record es un HEAD con f_page/f_line
//     0x10  rhd_blob
//     0x20  rhd_delta      delta record (raro)
//
//   Fragment reassembly: SQZ_fast comprime cada fragment independientemente.
//   Algoritmo correcto = decodificar RLE de HEAD y TAIL por separado, después
//   concatenar los bytes uncompressed. Concatenar RLE crudo rompe en el borde.
//
// Refs:
//   https://github.com/FirebirdSQL/firebird/blob/B1_5_Release/src/jrd/ods.h
//   https://ibexpert.com/docu/doku.php?id=01-documentation:01-08-firebird-documentation:firebird-internals:data-page-type0x05

import { promises as fs } from 'node:fs';

// ── Flags ────────────────────────────────────────────────────────────
const RHD_DELETED = 0x01;
const RHD_CHAIN = 0x02;
const RHD_FRAGMENT = 0x04;
const RHD_INCOMPLETE = 0x08;
const RHD_BLOB = 0x10;
const RHD_DELTA = 0x20;

// Offset donde el parser legacy arrancaba el RLE para rows NORMAL. Los
// loaders están calibrados contra este layout — no modificar sin auditar
// loaders.
const RHD_NORMAL_PAYLOAD_OFF = 0x0d;

// Offset real del payload para HEADs fragmented (después del rhdf de 22 bytes).
const RHDF_HEAD_PAYLOAD_OFF = 0x16;

// Offset del payload para TAILs (continuación). El TAIL es un record con
// flag RHD_FRAGMENT pero estructura `rhd` simple — sin f_page/f_line.
// Payload arranca tras los 17 bytes de rhd. Empíricamente en ODS 10 algunos
// TAILs traen 3 bytes de padding extras antes del payload comprimido; los
// trataremos como 0x11 (post-rhd) por defecto y dejamos margen para tunear
// si los samples reales muestran shift.
const RHD_TAIL_PAYLOAD_OFF = 0x11;

// HEADs reensamblados quedan auto-alineados con NORMAL sin padding:
// el RLE decoder consume los primeros bytes de control del NORMAL (que
// caen en rhd[0x0d..0x10]) y del HEAD (que arrancan en rhd[0x16]) de
// modo equivalente, dejando el byte 0 del output como el primer dato
// real del row en ambos casos. Verificado empíricamente con NORMAL
// p281:l4 (cliente=248 en off 4) y HEAD p281:l0 (cliente=254 en off 4).
const HEAD_PAD_BYTES = 0;

function decodeRLE(buf: Buffer): Buffer {
  const out: number[] = [];
  let i = 0;
  while (i < buf.length && out.length < 65536) {
    const ctrl = buf.readInt8(i++);
    if (ctrl === 0) break;
    if (ctrl > 0) {
      for (let k = 0; k < ctrl && i < buf.length; k++) out.push(buf[i++]);
    } else {
      if (i >= buf.length) break;
      const b = buf[i++];
      for (let k = 0; k < -ctrl; k++) out.push(b);
    }
  }
  return Buffer.from(out);
}

export interface RawRow {
  page: number;
  line: number;
  buf: Buffer;
}

interface PendingHead {
  page: number;
  line: number;
  headDecoded: Buffer;
  fPage: number;
  fLine: number;
}

interface ReadStats {
  normals: number;
  heads: number;
  tails: number;
  assembled: number;
  orphanHeads: number;
  unusedTails: number;
  deleted: number;
  blobs: number;
  other: number;
}

/**
 * Extrae todas las filas válidas de la tabla con `relationId`. Maneja
 * record fragmentation: HEAD (flag 0x08) + TAIL (flag 0x04) se reensamblan
 * en un único buffer "calibrado" estilo legacy (9 bytes de padding inicial)
 * para mantener compatibilidad con los offsets de los loaders.
 *
 * Si se pasa `stats`, se popula con contadores de diagnóstico.
 */
export async function readTable(
  gdbPath: string,
  relationId: number,
  stats?: ReadStats,
): Promise<RawRow[]> {
  const fh = await fs.open(gdbPath, 'r');
  try {
    const hdr = Buffer.alloc(1024);
    await fh.read(hdr, 0, 1024, 0);
    const pageSize = hdr.readUInt16LE(0x10);
    const stat = await fh.stat();
    const totalPages = Math.floor(stat.size / pageSize);

    const buf = Buffer.alloc(pageSize);
    const dataPages: number[] = [];
    for (let p = 0; p < totalPages; p++) {
      await fh.read(buf, 0, pageSize, p * pageSize);
      if (buf[0] !== 0x05) continue;
      if (buf.readUInt16LE(0x14) !== relationId) continue;
      dataPages.push(p);
    }

    const normals: RawRow[] = [];
    const heads: PendingHead[] = [];
    const tailIndex = new Map<string, Buffer>();

    const localStats: ReadStats = {
      normals: 0,
      heads: 0,
      tails: 0,
      assembled: 0,
      orphanHeads: 0,
      unusedTails: 0,
      deleted: 0,
      blobs: 0,
      other: 0,
    };

    for (const pageIdx of dataPages) {
      await fh.read(buf, 0, pageSize, pageIdx * pageSize);
      const dpgCount = buf.readUInt16LE(0x16);
      for (let i = 0; i < dpgCount; i++) {
        const tocOff = 0x18 + i * 4;
        if (tocOff + 4 > pageSize) break;
        const recOff = buf.readUInt16LE(tocOff);
        const recLen = buf.readUInt16LE(tocOff + 2);
        if (recOff === 0 || recLen === 0) continue;
        if (recOff + recLen > pageSize) continue;
        const rhd = buf.subarray(recOff, recOff + recLen);
        if (rhd.length < 0x0c) continue;
        const flags = rhd.readUInt16LE(0x0a);

        if (flags & RHD_DELETED) {
          localStats.deleted++;
          continue;
        }
        if (flags & RHD_BLOB) {
          localStats.blobs++;
          continue;
        }
        if (flags & (RHD_CHAIN | RHD_DELTA)) {
          localStats.other++;
          continue;
        }

        if (flags & RHD_INCOMPLETE) {
          // HEAD — rhdf de 22 bytes. Lee f_page/f_line y RLE desde 0x16.
          if (rhd.length < RHDF_HEAD_PAYLOAD_OFF) continue;
          const fPage = rhd.readUInt32LE(0x10);
          const fLine = rhd.readUInt16LE(0x14);
          try {
            const decoded = decodeRLE(rhd.subarray(RHDF_HEAD_PAYLOAD_OFF));
            heads.push({ page: pageIdx, line: i, headDecoded: decoded, fPage, fLine });
            localStats.heads++;
          } catch {
            // ignore malformed
          }
        } else if (flags & RHD_FRAGMENT) {
          // TAIL — rhd simple. Payload desde 0x11.
          if (rhd.length < RHD_TAIL_PAYLOAD_OFF) continue;
          try {
            const decoded = decodeRLE(rhd.subarray(RHD_TAIL_PAYLOAD_OFF));
            tailIndex.set(`${pageIdx}:${i}`, decoded);
            localStats.tails++;
          } catch {
            // ignore malformed
          }
        } else {
          // NORMAL — comportamiento legacy: subarray(0x0d) para no romper loaders.
          if (rhd.length < RHD_NORMAL_PAYLOAD_OFF) continue;
          try {
            const decoded = decodeRLE(rhd.subarray(RHD_NORMAL_PAYLOAD_OFF));
            normals.push({ page: pageIdx, line: i, buf: decoded });
            localStats.normals++;
          } catch {
            // ignore malformed
          }
        }
      }
    }

    // Reensamblar HEADs con sus TAILs
    const assembled: RawRow[] = [];
    const pad = Buffer.alloc(HEAD_PAD_BYTES);
    const usedTails = new Set<string>();
    for (const h of heads) {
      const key = `${h.fPage}:${h.fLine}`;
      const tail = tailIndex.get(key);
      if (!tail) {
        localStats.orphanHeads++;
        continue;
      }
      usedTails.add(key);
      assembled.push({
        page: h.page,
        line: h.line,
        buf: Buffer.concat([pad, h.headDecoded, tail]),
      });
      localStats.assembled++;
    }
    localStats.unusedTails = tailIndex.size - usedTails.size;

    if (stats) Object.assign(stats, localStats);

    return [...normals, ...assembled];
  } finally {
    await fh.close();
  }
}

/** Stats opcional para diagnóstico. Pasar un objeto vacío y leerlo después. */
export function makeReadStats(): ReadStats {
  return {
    normals: 0,
    heads: 0,
    tails: 0,
    assembled: 0,
    orphanHeads: 0,
    unusedTails: 0,
    deleted: 0,
    blobs: 0,
    other: 0,
  };
}

export type { ReadStats };

// ── Helpers de extracción ────────────────────────────────────────────

/** Lee un INT32 little-endian con bounds check. */
export function readInt32LE(buf: Buffer, off: number): number | null {
  if (off < 0 || off + 4 > buf.length) return null;
  return buf.readInt32LE(off);
}

/** Lee un INT16 little-endian con bounds check. */
export function readInt16LE(buf: Buffer, off: number): number | null {
  if (off < 0 || off + 2 > buf.length) return null;
  return buf.readInt16LE(off);
}

/**
 * Lee un CHAR/VARCHAR de longitud máxima `maxLen` desde `off`. Trim de
 * espacios y nulls trailing. Devuelve null si fuera de rango o solo
 * whitespace.
 */
export function readChar(buf: Buffer, off: number, maxLen: number): string | null {
  if (off < 0 || off + maxLen > buf.length) return null;
  const s = buf.subarray(off, off + maxLen).toString('latin1').replace(/[\s\x00]+$/, '');
  return s || null;
}

/** Igual a readChar pero asume 2-byte length prefix antes del slot. */
export function readVarchar(buf: Buffer, off: number, maxLen: number): string | null {
  if (off < 0 || off + 2 > buf.length) return null;
  const len = buf.readUInt16LE(off);
  const dataOff = off + 2;
  const effLen = Math.min(len, maxLen, buf.length - dataOff);
  if (effLen <= 0) return null;
  const s = buf.subarray(dataOff, dataOff + effLen).toString('latin1').replace(/[\s\x00]+$/, '');
  return s || null;
}

/**
 * Lee un string desde un slot fijo con 2-byte length prefix (formato VARCHAR
 * físico de Firebird ODS 10). Devuelve null si está vacío.
 *
 * @param buf row buffer
 * @param off offset del 2-byte length prefix
 * @param maxLen declared max length del VARCHAR (sin contar los 2 bytes prefix)
 */
export function readSlotVarchar(buf: Buffer, off: number, maxLen: number): string | null {
  if (off < 0 || off + 2 > buf.length) return null;
  const len = buf.readUInt16LE(off);
  if (len === 0 || len > maxLen + 1) return null;
  const dataOff = off + 2;
  const effLen = Math.min(len, maxLen, buf.length - dataOff);
  if (effLen <= 0) return null;
  const s = buf.subarray(dataOff, dataOff + effLen).toString('latin1').replace(/[\s\x00]+$/, '');
  return s || null;
}

/**
 * Encuentra el primer ASCII run de longitud >= `minLen` en `[start, end)`.
 * Útil para extraer nombres de rows con offset desconocido.
 */
export function findAsciiRun(buf: Buffer, start: number, end: number, minLen: number): string | null {
  let runStart = -1;
  const lim = Math.min(end, buf.length);
  for (let i = start; i < lim; i++) {
    const b = buf[i];
    const isPrintable = b >= 0x20 && b <= 0x7e;
    if (isPrintable) {
      if (runStart < 0) runStart = i;
    } else if (runStart >= 0) {
      const len = i - runStart;
      if (len >= minLen) return buf.subarray(runStart, i).toString('latin1').trim();
      runStart = -1;
    }
  }
  if (runStart >= 0) {
    const s = buf.subarray(runStart, lim).toString('latin1').trim();
    if (s.length >= minLen) return s;
  }
  return null;
}

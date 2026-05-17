// Lee rows raw del .gdb (Firebird ODS 10) sin engine externo.
// Reusa la lógica del parser raw en tools/gdb-parser/extractAll.mjs pero
// devuelve los buffers en memoria para que los loaders extraigan campos
// con offset/strategy específica por tabla.

import { promises as fs } from 'node:fs';

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

/**
 * Extrae todas las filas válidas de la tabla con `relationId`. No filtra
 * basura — el caller decide si una fila es válida (típicamente: longitud
 * mínima + PK no nula).
 */
export async function readTable(gdbPath: string, relationId: number): Promise<RawRow[]> {
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

    const rows: RawRow[] = [];
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
        const flags = rhd.readUInt16LE(0x0a);
        if (flags & 0x01) continue; // deleted
        if (flags & 0x04) continue; // fragmented (omitido — TODO si hace falta)
        if (flags & 0x10) continue; // blob
        const compressed = rhd.subarray(0x0d);
        try {
          rows.push({ page: pageIdx, line: i, buf: decodeRLE(compressed) });
        } catch {
          // ignore bad row
        }
      }
    }
    return rows;
  } finally {
    await fh.close();
  }
}

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

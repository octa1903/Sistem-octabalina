// ═══════════════════════════════════════════════════
// Utilities para reportes Loyverse — period presets + CSV export.
// ═══════════════════════════════════════════════════

export type PeriodPreset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'last_30d' | 'custom';

export interface DateRange {
  /** ISO datetime, inicio inclusive. */
  from: string;
  /** ISO datetime, fin exclusive. */
  to: string;
}

/** Devuelve un rango [from, to) en zona local del navegador para el preset dado. */
export function rangeForPreset(preset: PeriodPreset, ref: Date = new Date()): DateRange {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
  const today = startOfDay(ref);

  switch (preset) {
    case 'today':
      return { from: today.toISOString(), to: addDays(today, 1).toISOString() };
    case 'yesterday':
      return { from: addDays(today, -1).toISOString(), to: today.toISOString() };
    case 'this_week': {
      // Semana ISO (lunes a domingo).
      const day = (today.getDay() + 6) % 7; // lunes = 0
      const monday = addDays(today, -day);
      return { from: monday.toISOString(), to: addDays(monday, 7).toISOString() };
    }
    case 'this_month': {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      const next  = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      return { from: first.toISOString(), to: next.toISOString() };
    }
    case 'last_month': {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const next  = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: first.toISOString(), to: next.toISOString() };
    }
    case 'last_30d':
      return { from: addDays(today, -29).toISOString(), to: addDays(today, 1).toISOString() };
    case 'custom':
    default:
      return { from: today.toISOString(), to: addDays(today, 1).toISOString() };
  }
}

/** "YYYY-MM-DD" → ISO al inicio del día local. Si el input es inválido, cae a hoy. */
export function dateInputToIso(input: string, endOfDay = false): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  const fallback = new Date();
  const dt = m
    ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0)
    : new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate(), 0, 0, 0, 0);
  if (endOfDay) dt.setDate(dt.getDate() + 1);
  return dt.toISOString();
}

/** ISO → "YYYY-MM-DD" en zona local. */
export function isoToDateInput(iso: string): string {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Escapea un valor para CSV (RFC 4180) + protege contra CSV injection en Excel.
 * Si el campo empieza con uno de los caracteres "fórmula" (=,+,-,@,\t,\r),
 * lo prefijamos con apóstrofo para que Excel/LibreOffice lo trate como texto.
 */
export function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s = typeof v === 'string' ? v : typeof v === 'number' ? String(v) : String(v);
  if (s.length > 0 && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export interface CsvColumn<T> {
  header: string;
  /** Devuelve el valor de la columna para una fila. */
  value: (row: T) => unknown;
}

/** Convierte un array de objetos a CSV con BOM UTF-8 (Excel-friendly). */
export function rowsToCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const head = columns.map(c => csvEscape(c.header)).join(',');
  const body = rows.map(r => columns.map(c => csvEscape(c.value(r))).join(','));
  return '﻿' + [head, ...body].join('\r\n');
}

/** Dispara descarga del CSV. Revocamos el ObjectURL con delay para que Firefox alcance a iniciar la descarga. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

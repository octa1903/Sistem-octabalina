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

/** "YYYY-MM-DD" → ISO al inicio del día local. */
export function dateInputToIso(input: string, endOfDay = false): string {
  const [y, m, d] = input.split('-').map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
  if (endOfDay) dt.setDate(dt.getDate() + 1); // fin exclusivo
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

/** Escapea un valor para CSV (RFC 4180). */
export function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'string' ? v : typeof v === 'number' ? String(v) : String(v);
  // Si tiene coma, comilla o salto de línea — envolver y escapar comillas.
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

/** Dispara descarga del CSV. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

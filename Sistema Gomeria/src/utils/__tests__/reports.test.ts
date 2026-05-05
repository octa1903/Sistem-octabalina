import { describe, expect, it } from 'vitest';
import { csvEscape, rowsToCsv, rangeForPreset, dateInputToIso, isoToDateInput } from '../reports';

describe('csvEscape', () => {
  it('escapa valores con coma, comilla o salto de línea', () => {
    expect(csvEscape('hola')).toBe('hola');
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('a"b')).toBe('"a""b"');
    expect(csvEscape('a\nb')).toBe('"a\nb"');
  });

  it('serializa números y nulos', () => {
    expect(csvEscape(123.45)).toBe('123.45');
    expect(csvEscape(null)).toBe('');
    expect(csvEscape(undefined)).toBe('');
  });
});

describe('rowsToCsv', () => {
  it('genera CSV con BOM y headers', () => {
    const rows = [
      { name: 'A', total: 100 },
      { name: 'B, with comma', total: 200 },
    ];
    const csv = rowsToCsv(rows, [
      { header: 'Nombre', value: r => r.name },
      { header: 'Total',  value: r => r.total },
    ]);
    expect(csv.startsWith('﻿')).toBe(true);
    const lines = csv.replace('﻿', '').split('\r\n');
    expect(lines[0]).toBe('Nombre,Total');
    expect(lines[1]).toBe('A,100');
    expect(lines[2]).toBe('"B, with comma",200');
  });
});

describe('rangeForPreset', () => {
  const ref = new Date(2026, 4, 15, 10, 30); // 2026-05-15 10:30 local

  it('today: [00:00 hoy, 00:00 mañana)', () => {
    const r = rangeForPreset('today', ref);
    expect(new Date(r.from).getHours()).toBe(0);
    expect(new Date(r.to).getDate() - new Date(r.from).getDate()).toBe(1);
  });

  it('this_month: primer día del mes hasta primer día del próximo', () => {
    const r = rangeForPreset('this_month', ref);
    expect(new Date(r.from).getDate()).toBe(1);
    expect(new Date(r.from).getMonth()).toBe(4);
    expect(new Date(r.to).getDate()).toBe(1);
    expect(new Date(r.to).getMonth()).toBe(5);
  });

  it('last_30d incluye hoy + 29 días previos', () => {
    const r = rangeForPreset('last_30d', ref);
    const days = (new Date(r.to).getTime() - new Date(r.from).getTime()) / (24 * 60 * 60 * 1000);
    expect(days).toBe(30);
  });
});

describe('dateInputToIso / isoToDateInput', () => {
  it('roundtrip preserva la fecha local', () => {
    const original = '2026-05-15';
    const iso = dateInputToIso(original);
    expect(isoToDateInput(iso)).toBe(original);
  });

  it('endOfDay avanza un día (rango exclusivo)', () => {
    const start = dateInputToIso('2026-05-15');
    const end   = dateInputToIso('2026-05-15', true);
    const diffH = (new Date(end).getTime() - new Date(start).getTime()) / 3600000;
    expect(diffH).toBe(24);
  });
});

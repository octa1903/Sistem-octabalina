// ═══════════════════════════════════════════════════════════════════
// Tests para los parsers críticos del script de normalización de listas
// de proveedores. NO testea I/O — solo la lógica pura por marca.
//
// El script vive en `scripts/` porque corre una sola vez para generar
// los CSV staging, pero los parsers tienen reglas no obvias por
// proveedor (FATE col 7 NO col 3, FIREMAX precio/costo invertidos,
// XBRI sin costo) que valen la pena fijar con tests.
// ═══════════════════════════════════════════════════════════════════
import { describe, test, expect } from 'vitest';
import {
  asNumberAr,
  extractSize,
  classifyCategory,
  parseFate,
  parseSeccionPerfilCsv,
} from '../normalizeTireCsvs';

describe('asNumberAr', () => {
  test('formato AR con punto miles y coma decimal', () => {
    expect(asNumberAr('1.234,56')).toBeCloseTo(1234.56, 2);
    expect(asNumberAr('99.999,00')).toBeCloseTo(99999, 2);
  });

  test('número simple', () => {
    expect(asNumberAr('500')).toBe(500);
  });

  test('vacío o NaN → 0', () => {
    expect(asNumberAr('')).toBe(0);
    expect(asNumberAr('abc')).toBe(0);
  });

  test('signo negativo', () => {
    expect(asNumberAr('-100,50')).toBeCloseTo(-100.5, 2);
  });
});

describe('extractSize', () => {
  test('métrica radial', () => {
    expect(extractSize('205/55 R16 PIRELLI P1')).toBe('205/55 R16');
  });

  test('imperial', () => {
    expect(extractSize('31x10.50 R15 GENERAL GRABBER')).toBe('31x10.50 R15');
  });

  test('camión decimal', () => {
    expect(extractSize('295/80 R22.5 BRIDGESTONE M729')).toBe('295/80 R22.5');
  });

  test('agrícola con guión', () => {
    // El primer patrón que matchea es "X/Y-Z" → toma "12.4-24" como diagonal con guión
    expect(extractSize('12.4-24 PIRELLI TM700')).toBe('12.4-24');
  });

  test('sin medida → string vacío', () => {
    expect(extractSize('NO HAY MEDIDA')).toBe('');
  });
});

describe('classifyCategory', () => {
  test('rim 22.5 → Camión', () => {
    expect(classifyCategory('295/80 R22.5', 'BRIDGESTONE M729')).toBe('Camión');
  });

  test('A/T en descripción → Camioneta', () => {
    expect(classifyCategory('245/70 R16', 'GENERAL GRABBER A/T 3')).toBe('Camioneta');
  });

  test('LT prefix en la descripción → Camioneta', () => {
    // El check de LT mira la descripción (no el size), porque el size ya
    // viene normalizado sin prefijo en muchos parsers.
    expect(classifyCategory('225/75 R16', 'FIRESTONE LT225/75 R16 DESTINATION')).toBe('Camioneta');
  });

  test('R1 / agrícola palabra clave → Agrícola', () => {
    expect(classifyCategory('18.4-30', 'PIRELLI TM700 R1 TRACTOR')).toBe('Agrícola');
  });

  test('formato diagonal X-Y → Agrícola', () => {
    expect(classifyCategory('7.50-16', 'NEUMÁTICO AGRÍCOLA')).toBe('Agrícola');
  });

  test('industrial SD600 con medida radial → Industrial', () => {
    // Medidas con formato "X-Y" caen primero en Agrícola; para que Industrial gane,
    // la medida tiene que ser radial (sin guión) y la descripción tener el código.
    expect(classifyCategory('17.5 R25', 'ARMOUR SD600')).toBe('Industrial');
  });

  test('auto regular → Auto', () => {
    expect(classifyCategory('195/65 R15', 'BRIDGESTONE TURANZA')).toBe('Auto');
  });

  test('NO confundir ATREZZO con A/T', () => {
    expect(classifyCategory('205/55 R16', 'SAILUN ATREZZO ELITE')).toBe('Auto');
  });
});

describe('parseFate — col 7 COSTO real, col 11 MOSTRADOR', () => {
  test('fila válida usa col 7 para costo y col 11 para precio', () => {
    // Layout FATE: ['', 'F12345', 'DESCRIPCION...', BASICO, IVA, TOTAL, '%', COSTO, '%', REVENTA, '%', MOSTRADOR, ...]
    // La medida tiene que estar AL INICIO de la descripción para que extractSize la tome.
    const rows = [
      ['header', 'CODIGO', 'DESCRIPCION'],
      ['', 'F100', '195/65 R15 PIRELLI P1', '100000', '21000', '121000', '38', '75000', '20', '90000', '15', '103500'],
    ];
    const out = parseFate(rows);
    expect(out).toHaveLength(1);
    expect(out[0].sku).toBe('F100');
    expect(out[0].marca).toBe('FATE');
    expect(out[0].medida).toBe('195/65 R15');
    expect(out[0].costo).toBe(75000);   // col 7
    expect(out[0].precio).toBe(103500); // col 11
  });

  test('si MOSTRADOR (col 11) falta, cae a REVENTA (col 9)', () => {
    const rows = [
      ['', 'F200', '205/55 R16 BRIDGESTONE TURANZA', '100000', '21000', '121000', '38', '75000', '20', '90000', '', ''],
    ];
    const out = parseFate(rows);
    expect(out).toHaveLength(1);
    expect(out[0].precio).toBe(90000);
  });

  test('código que no empieza con F se descarta', () => {
    const rows = [
      ['', 'X100', 'DESC', '', '', '', '', '50000'],
    ];
    expect(parseFate(rows)).toHaveLength(0);
  });

  test('sin medida detectable → se descarta', () => {
    const rows = [
      ['', 'F300', 'PRODUCTO SIN MEDIDA AL INICIO', '', '', '', '', '50000', '', '', '', '70000'],
    ];
    expect(parseFate(rows)).toHaveLength(0);
  });
});

describe('parseSeccionPerfilCsv — FIREMAX/KUMHO/TRIANGLE (precio col 7, costo col 8)', () => {
  test('precio en col 7, costo en col 8 (invertidos vs FATE)', () => {
    const parser = parseSeccionPerfilCsv('FIREMAX');
    // cols: 0=codigo, 1=ancho, 2=perfil, 3=tipo, 4=llanta, 5=diseño, 6=telas, 7=PRECIO, 8=COSTO
    const rows = [
      ['F100', '205', '55', 'HR', '16', 'FM316', '4', '80000', '50000'],
    ];
    const out = parser(rows, []);
    expect(out).toHaveLength(1);
    expect(out[0].marca).toBe('FIREMAX');
    expect(out[0].medida).toBe('205/55 R16');
    expect(out[0].precio).toBe(80000); // col 7 = PRECIO PÚBLICO
    expect(out[0].costo).toBe(50000);  // col 8 = COSTO
    expect(out[0].sku).toBe('F100');
  });

  test('header CAMIONETA AT cambia la categoría del bloque siguiente', () => {
    const parser = parseSeccionPerfilCsv('TRIANGLE');
    const rows = [
      ['', 'CAMIONETA AT', '', '', '', '', '', '', ''],
      ['T200', '245', '70', '', '16', 'TR292', '8', '120000', '80000'],
    ];
    const out = parser(rows, []);
    expect(out).toHaveLength(1);
    expect(out[0].categoria).toBe('Camioneta');
  });

  test('precio en 0 → fila se descarta', () => {
    const parser = parseSeccionPerfilCsv('KUMHO');
    const rows = [
      ['K100', '205', '55', 'HR', '16', 'KH27', '4', '', '50000'],
    ];
    expect(parser(rows, [])).toHaveLength(0);
  });
});

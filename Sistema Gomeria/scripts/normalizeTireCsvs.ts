/**
 * normalizeTireCsvs — script one-shot que toma los 9 CSV crudos de
 * proveedores (BULL VIAL, CORRAL, FATE, FIREMAX, KUMHO, LING LONG,
 * MAXI-TANGO, TRIANGLE, XBRI) y produce 9 CSV "staging" con headers
 * estándar (Marca, Modelo, Medida, Categoría, Costo, Precio, Stock,
 * Mínimo, Ubicación, SKU) compatibles con `importService.validateTireRows`.
 *
 * Uso:
 *   npx tsx scripts/normalizeTireCsvs.ts
 *
 * Lee de:   tmp/tires-raw/*.csv     (UTF-8 o latin-1)
 * Escribe:  tmp/tires-staging/*.csv (UTF-8 con BOM, separador `,`)
 *
 * No toca Supabase. La carga real se hace desde la UI con ImportModal.
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, basename, extname } from 'node:path';

// ── Constantes ────────────────────────────────────────────────────────

const INPUT_DIR = join(process.cwd(), 'tmp', 'tires-raw');
const OUTPUT_DIR = join(process.cwd(), 'tmp', 'tires-staging');

const STANDARD_HEADERS = [
  'Marca', 'Modelo', 'Medida', 'Categoría',
  'Costo', 'Precio', 'Stock', 'Mínimo', 'Ubicación', 'SKU',
] as const;

interface StagingRow {
  marca: string;
  modelo: string;
  medida: string;
  categoria: string;
  costo: number;
  precio: number;
  stock: number;
  minimo: number;
  ubicacion: string;
  sku: string;
}

// ── Encoding y parsing CSV ────────────────────────────────────────────

/**
 * Detecta si el buffer parece latin-1 (presencia del char `0xBF` = `¿`
 * o secuencias con bytes altos sin estructura UTF-8 válida).
 * Si lo es, decodifica con latin1; si no, asume utf-8.
 */
function decodeBuffer(buf: Buffer): string {
  // Heurística: probar UTF-8 primero; si tiene reemplazos `�` (FFFD)
  // significa que probablemente era latin-1.
  const utf8 = buf.toString('utf-8');
  if (utf8.includes('�')) {
    return buf.toString('latin1');
  }
  return utf8;
}

/**
 * Parser CSV minimalista con soporte para separador `;` y comillas.
 * Las listas vienen sin quoting complejo, así que esto basta.
 */
function parseCsv(text: string, sep = ';'): string[][] {
  const rows: string[][] = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) {
      rows.push([]);
      continue;
    }
    const cells: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === sep && !inQuotes) {
        cells.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    cells.push(cur);
    rows.push(cells);
  }
  return rows;
}

function detectSeparator(firstLine: string): ';' | ',' {
  const semi = (firstLine.match(/;/g) ?? []).length;
  const comma = (firstLine.match(/,/g) ?? []).length;
  return semi >= comma ? ';' : ',';
}

// ── Helpers de limpieza ───────────────────────────────────────────────

export function asNumberAr(v: string): number {
  if (!v) return 0;
  const cleaned = v.replace(/\./g, '').replace(',', '.').replace(/[^\d.\-]/g, '');
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? 0 : n;
}

function clean(s: string): string {
  return (s ?? '').trim().replace(/\s+/g, ' ');
}

/** Quita la medida del inicio de una descripción para dejar solo el modelo. */
function stripSizeFromDescription(desc: string): string {
  const m = desc.match(
    /^\s*(?:LT\s*)?\d+(?:\.\d+)?(?:[/x]\d+(?:\.\d+)?)?\s*[xX]?\s*[ZWVHRSPMCLT]*\s*[R-]?\s*\d+(?:\.\d+)?\s*[CRT]?\s*/,
  );
  return m ? desc.slice(m[0].length).trim() : desc.trim();
}

/** Extrae una medida desde el principio de una descripción. */
export function extractSize(desc: string): string {
  const patterns = [
    /^(LT\s*)?\d+\s*\/\s*\d+\s*[ZWVHRSPMC]*\s*R\s*\d+(?:\.\d+)?\s*[CRT]?/i, // 205/55 R16
    /^\d+(?:\.\d+)?\s*[xX]\s*\d+(?:\.\d+)?\s*[R-]?\s*\d+(?:\.\d+)?/,         // 31x10.50 R15
    /^\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?\s*-\s*\d+(?:\.\d+)?/,               // 400/60-15.5
    /^\d+(?:\.\d+)?\s*[L]?\s*-\s*\d+(?:\.\d+)?/,                             // 7.50-16
    /^\d+\s*R\s*\d+(?:\.\d+)?/,                                              // 205 R16
  ];
  for (const p of patterns) {
    const m = desc.match(p);
    if (m) return clean(m[0]);
  }
  return '';
}

// ── Clasificación de categoría ────────────────────────────────────────

export function classifyCategory(size: string, description: string): string {
  const desc = description.toUpperCase();
  // Camión (rim ≥ 17.5 con formato R22.5 / R17.5)
  if (/R\s*(17\.5|19\.5|22\.5|24\.5)/i.test(size)) return 'Camión';
  // Agrícola: códigos R1/R3/R4, palabras clave, o medida diagonal con guión
  // (cualquier "X-Y" o "X/Y-Z" donde Y/Z son decimales o enteros).
  if (
    /\bR[134]\b|AGRIC|TRACTOR|SEMBRAD|CARRETERA|TRIPLE\s*GUIA|GAUCHA/i.test(desc) ||
    /^\d+(?:\.\d+)?-\d+(?:\.\d+)?$/.test(size.trim()) ||
    /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?-\d+(?:\.\d+)?$/.test(size.trim())
  ) {
    return 'Agrícola';
  }
  // Industrial: SD600, SP900, MAC, GL-80, SK300, L5 etc.
  if (/\b(SD\d+|SP9\d+|MAC|GL-?\d+|SK\d+|L[235][AB]?|MPT|F-?\d|I-?[13])\b/i.test(desc)) {
    return 'Industrial';
  }
  // SUV/Camioneta: marcadores claros — A/T, M/T, H/T (con barra),
  // LT prefix de medida, 4x4, SUV, Range Runner (FATE), TERRAMAX, CROSSWIND.
  // OJO: NO usar `AT` libre porque matchea ATREZZO/ATRACT/etc.
  if (
    /\b(A\/T|M\/T|H\/T|MTP|MT-R|AT\/R|R\/T)\b/i.test(desc) ||
    /\bLT\s*\d/i.test(desc) ||
    /\b(4X4|SUV|RANGE\s*RUNNER|TERRAMAX|CROSSWIND|GRIP\s*MASTER|GREENMAX\s*4X4)\b/i.test(desc) ||
    /\bRR\s+(AT|MT|HT)/i.test(desc)
  ) {
    if (/SUV/i.test(desc)) return 'SUV';
    return 'Camioneta';
  }
  // Default: Auto
  return 'Auto';
}

// ── Marca: extracción / normalización ────────────────────────────────

// Solo marcas REALES. FASTWAY/ECOLOGY/ENZO/FORZA/BRUTUS NO van acá —
// son modelos de XBRI (ver scripts/fixTireData.ts para el catálogo
// completo). MILEVER sí es marca real (china).
const BRAND_PATTERNS: Array<{ regex: RegExp; brand: string }> = [
  { regex: /\bARMOUR\b/i, brand: 'ARMOUR' },
  { regex: /\bMRL\b/i, brand: 'MRL' },
  { regex: /\bROADGUIDER\b|^ROA-/i, brand: 'ROADGUIDER' },
  { regex: /\bROADHIKER\b/i, brand: 'ROADHIKER' },
  { regex: /\bMARCHER\b|^MR-/i, brand: 'MARCHER' },
  { regex: /\bSAILUN\b/i, brand: 'SAILUN' },
  { regex: /\bKAPSEN\b/i, brand: 'KAPSEN' },
  { regex: /\bMILEVER\b/i, brand: 'MILEVER' },
];

// Modelos que XBRI revende bajo su listado pero NO son marcas
// independientes. Si aparecen sin XBRI explícito en la descripción,
// igual son modelos de XBRI.
const XBRI_MODEL_PATTERNS: RegExp[] = [
  /\bFASTWAY\b/i,
  /\bECOLOGY\b/i,
  /\bENZO\b/i,
  /\bFORZA\b/i,
  /\bBRUTUS\b/i,
];

function extractBrandFromDescription(desc: string, fallback: string): string {
  for (const { regex, brand } of BRAND_PATTERNS) {
    if (regex.test(desc)) return brand;
  }
  return fallback;
}

// ── Parsers por marca/archivo ─────────────────────────────────────────

export type ParserFn = (rows: string[][], headers: string[]) => StagingRow[];
export type { StagingRow };

/** BULL VIAL: cols 0=MEDIDA, 1=MARCA, 2=COSTO, 6=PUBLICO. */
function parseBullVial(rows: string[][]): StagingRow[] {
  const out: StagingRow[] = [];
  // Skip primera fila (headers)
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 3) continue;
    const medidaCol = clean(r[0] ?? '');
    if (!medidaCol) continue;
    const marcaCol = clean(r[1] ?? '') || 'BULL VIAL';
    const costo = asNumberAr(r[2] ?? '');
    const precio = asNumberAr(r[6] ?? r[2] ?? ''); // PUBLICO o fallback a COSTO
    if (!costo && !precio) continue;
    const size = extractSize(medidaCol) || medidaCol.split(' ')[0];
    const model = stripSizeFromDescription(medidaCol) || 'GENÉRICO';
    out.push({
      marca: marcaCol,
      modelo: model,
      medida: size,
      categoria: classifyCategory(size, medidaCol),
      costo,
      precio,
      stock: 0,
      minimo: 2,
      ubicacion: '',
      sku: '',
    });
  }
  return out;
}

/** CORRAL: 0=Softland(sku), 1=Medida, 2=Descripción, 3=Costo, 5=Reventa. */
function parseCorral(rows: string[][]): StagingRow[] {
  const out: StagingRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 4) continue;
    const sku = clean(r[0] ?? '');
    const medida = clean(r[1] ?? '');
    const desc = clean(r[2] ?? '');
    if (!medida || !desc) continue;
    const costo = asNumberAr(r[3] ?? '');
    const precio = asNumberAr(r[5] ?? '');
    if (!costo && !precio) continue;
    // En CORRAL la marca puede estar en la descripción O implícita en el SKU
    // (ej. "MRL-100016F210" → MRL; "ARM-1016512PRL5A" → ARMOUR).
    const skuPrefix = sku.match(/^([A-Z]+)-/i)?.[1]?.toUpperCase() ?? '';
    const skuBrand = skuPrefix === 'MRL' ? 'MRL'
      : skuPrefix === 'ARM' ? 'ARMOUR'
      : skuPrefix === 'MR' ? 'MARCHER'
      : skuPrefix === 'ROA' ? 'ROADHIKER'
      : '';
    const brand = extractBrandFromDescription(desc, skuBrand || 'CORRAL');
    const model = stripSizeFromDescription(desc.replace(new RegExp(`^${brand}\\s*`, 'i'), '')) || desc;
    out.push({
      marca: brand,
      modelo: model,
      medida,
      categoria: classifyCategory(medida, desc),
      costo,
      precio,
      stock: 0,
      minimo: 2,
      ubicacion: '',
      sku,
    });
  }
  return out;
}

/**
 * FATE: leading `;` → cols: 1=CODIGO, 2=DESCRIPCION, 3=BASICO, 4=IVA, 5=TOTAL,
 * 6=%, 7=COSTO, 8=%, 9=REVENTA, 10=%, 11=MOSTRADOR, ...
 * El header secundario (línea 8 del CSV) es `;;;;;;COSTO;;REVENTA;;MOSTRADOR;...`
 * o sea: las columnas 3..5 son BASICO/IVA/TOTAL (PVP del proveedor), y a partir
 * de col 7 vienen pares (%, $) hasta MOSTRADOR.
 * Costo = COSTO real (col 7, ~38% off TOTAL — lo que paga al proveedor).
 * Precio = MOSTRADOR (col 11, contado mostrador).
 */
export function parseFate(rows: string[][]): StagingRow[] {
  const out: StagingRow[] = [];
  for (const r of rows) {
    if (!r || r.length < 8) continue;
    const code = clean(r[1] ?? '');
    const desc = clean(r[2] ?? '');
    if (!code || !desc || !code.startsWith('F')) continue;
    // Filtrar headers/separadores que también empiezan con F (raro pero por las dudas).
    const costo = asNumberAr(r[7] ?? '');
    let precio = asNumberAr(r[11] ?? '');
    if (!precio) precio = asNumberAr(r[9] ?? '');
    if (!precio && !costo) continue;
    const size = extractSize(desc);
    if (!size) continue;
    const model = stripSizeFromDescription(desc) || 'FATE';
    out.push({
      marca: 'FATE',
      modelo: model,
      medida: size,
      categoria: classifyCategory(size, desc),
      costo,
      precio,
      stock: 0,
      minimo: 2,
      ubicacion: '',
      sku: code,
    });
  }
  return out;
}

/**
 * FIREMAX / KUMHO / TRIANGLE: estructura similar.
 * Cols: 0=Codigo, 1=Sección(ancho), 2=Perfil, 3=Tipo, 4=Llanta, 5=Diseño, 6=Telas,
 *       7=PRECIO (público), 8=COSTO (sin header en el CSV, segunda columna de precio).
 * Hay secciones (categorías) que se intercalan como filas de encabezado.
 */
export function parseSeccionPerfilCsv(brand: string): ParserFn {
  return (rows: string[][]): StagingRow[] => {
    const out: StagingRow[] = [];
    let currentCat = 'Auto';
    for (const r of rows) {
      if (!r || r.length === 0) continue;
      const c0 = clean(r[0] ?? '');
      // Header de sección
      if (/CAMIONETA.*AT/i.test(c0) || /CAMIONETA.*AT/i.test(r[1] ?? '')) { currentCat = 'Camioneta'; continue; }
      if (/CAMIONETA.*MT/i.test(c0) || /CAMIONETA.*MT/i.test(r[1] ?? '')) { currentCat = 'Camioneta'; continue; }
      if (/CAMIONETA.*HT/i.test(c0) || /CAMIONETA.*HT/i.test(r[1] ?? '')) { currentCat = 'Camioneta'; continue; }
      if (/CAMIONETA\s+COMERCIAL/i.test(c0) || /CAMIONETA\s+COMERCIAL/i.test(r[1] ?? '')) { currentCat = 'Camioneta'; continue; }
      if (/CARGA.*LT/i.test(c0) || /CARGA.*LT/i.test(r[1] ?? '')) { currentCat = 'Camioneta'; continue; }
      if (/^AUTOMOVIL/i.test(c0) || /AUTOMOVIL/i.test(r[1] ?? '')) { currentCat = 'Auto'; continue; }
      if (/CAMION/i.test(c0) && !/CAMIONETA/i.test(c0)) { currentCat = 'Camión'; continue; }
      // Headers de columnas
      if (/^codigo$/i.test(c0)) continue;
      // Filas de datos
      const code = c0;
      const ancho = clean(r[1] ?? '');
      const perfil = clean(r[2] ?? '');
      const tipo = clean(r[3] ?? '');
      const llanta = clean(r[4] ?? '');
      const diseno = clean(r[5] ?? '');
      const precio = asNumberAr(r[7] ?? '');
      const costo = asNumberAr(r[8] ?? '');
      if (!code || !ancho || !llanta || !precio) continue;
      // Reconstruir medida. Las letras del campo "tipo" (TR/HR/VR/WR/etc.)
      // son índices de carga/velocidad — las descartamos del size canónico
      // (quedan implícitas en el modelo via diseño).
      let medida: string;
      if (/^\d/.test(ancho) && !/[xX]/.test(ancho)) {
        medida = perfil
          ? `${ancho}/${perfil} R${llanta}`
          : `${ancho} R${llanta}`;
      } else {
        // Imperial "31X10.50" sin perfil
        medida = `${ancho} R${llanta}`;
      }
      medida = medida.replace(/\s+/g, ' ').trim();
      out.push({
        marca: brand,
        modelo: diseno || tipo || brand,
        medida,
        categoria: currentCat,
        costo,
        precio,
        stock: 0,
        minimo: 2,
        ubicacion: '',
        sku: code,
      });
    }
    return out;
  };
}

/** LING LONG: 0=Codigo, 1=Descripción, 2=Cantidad, 3=COSTO, 5=PUBLICO. */
function parseLingLong(rows: string[][]): StagingRow[] {
  const out: StagingRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 6) continue;
    const code = clean(r[0] ?? '');
    const desc = clean(r[1] ?? '').replace(/�/g, ' '); // remove broken chars
    if (!desc) continue;
    const costo = asNumberAr(r[3] ?? '');
    const precio = asNumberAr(r[5] ?? r[3] ?? '');
    if (!precio) continue;
    const size = extractSize(desc);
    if (!size) continue;
    const model = stripSizeFromDescription(desc).replace(/LINGLONG.*$/i, '').trim() || 'LINGLONG';
    out.push({
      marca: 'LINGLONG',
      modelo: model,
      medida: size,
      categoria: classifyCategory(size, desc),
      costo,
      precio,
      stock: 0,
      minimo: 2,
      ubicacion: '',
      sku: code,
    });
  }
  return out;
}

/**
 * MAXI-TANGO: sin leading `;`. Cols: 0=CODIGO, 1=DESCRIPCION, 2=BASICO,
 * 3=IVA, 4=TOTAL, 5=%, 6=COSTO, 7=%, 8=REVENTA, 9=%, 10=MOSTRADOR, ...
 * Header secundario (línea 7): `;;;;;;COSTO;;REVENTA;;MOSTRADOR;...`
 * Costo = COSTO real (col 6, lo que paga al proveedor).
 * Precio = MOSTRADOR (col 10, contado mostrador).
 */
function parseMaxiTango(rows: string[][]): StagingRow[] {
  const out: StagingRow[] = [];
  let currentBrand = 'MAXISPORT';
  for (const r of rows) {
    if (!r || r.length < 7) continue;
    const c0 = clean(r[0] ?? '');
    if (/^MAXISPORT/i.test(c0)) { currentBrand = c0.replace(/[;:].*$/, ''); continue; }
    if (/^TANGO/i.test(c0)) { currentBrand = 'TANGO'; continue; }
    if (!c0 || !c0.startsWith('F')) continue;
    const desc = clean(r[1] ?? '');
    const costo = asNumberAr(r[6] ?? '');
    let precio = asNumberAr(r[10] ?? '');
    if (!precio) precio = asNumberAr(r[8] ?? '');
    if (!precio && !costo) continue;
    const size = extractSize(desc);
    if (!size) continue;
    const model = stripSizeFromDescription(desc) || currentBrand;
    out.push({
      marca: currentBrand,
      modelo: model,
      medida: size,
      categoria: classifyCategory(size, desc),
      costo,
      precio,
      stock: 0,
      minimo: 2,
      ubicacion: '',
      sku: c0,
    });
  }
  return out;
}

/** XBRI: 0=DESCRIP, 1=COD, varios precios, col CONTADO (~6) es el de mostrador. */
function parseXbri(rows: string[][]): StagingRow[] {
  const out: StagingRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 7) continue;
    const desc = clean(r[0] ?? '');
    const code = clean(r[1] ?? '');
    if (!desc || !code) continue;
    // Columnas: 2=0-30-60, 3=0-30-60-90, 4=0-30-60-90-120, 5=NEGRO,
    // 6=%, 7=CONTADO (precio mostrador real). Las % impares (6,8,10,...) son
    // recargos por modalidad y NO precios.
    const precio = asNumberAr(r[7] ?? '');
    if (!precio) continue;
    // La descripción XBRI viene tipo "R15- 205/65 FORZA XBRI" o "R16 -205/55 FASTWAY"
    const sizeMatch = desc.match(/R(\d+(?:\.\d+)?)\s*[-,]?\s*(\d+(?:[\/x]\d+)?)/i);
    let size = '';
    let modelTail = desc;
    if (sizeMatch) {
      const rim = sizeMatch[1];
      const widthRaw = sizeMatch[2];
      // widthRaw puede ser "205/65" o "31x10.50"
      if (widthRaw.includes('/')) {
        size = `${widthRaw} R${rim}`;
      } else if (widthRaw.toLowerCase().includes('x')) {
        size = `${widthRaw} R${rim}`;
      } else {
        size = `${widthRaw} R${rim}`;
      }
      modelTail = desc.slice(sizeMatch.index! + sizeMatch[0].length).trim();
    }
    if (!size) {
      // intentar otro formato "R22..5-295/80" etc
      const alt = desc.match(/R(\d+(?:\.\d+)?)\s*[-.]+\s*(\d+\/\d+)/i);
      if (alt) size = `${alt[2]} R${alt[1]}`;
    }
    if (!size) continue;
    // El listado XBRI revende marcas chinas reales (MILEVER, KAPSEN, etc.)
    // Y también incluye sus propios modelos (FASTWAY, ECOLOGY, ENZO, FORZA,
    // BRUTUS). Regla:
    //   - Si la descripción matchea una marca china real → esa es la brand.
    //   - Si matchea un modelo XBRI conocido → brand=XBRI, modelo el nombre.
    //   - Sino → brand=XBRI (default), modelo = lo que quedó tras la medida.
    const realBrand = extractBrandFromDescription(modelTail || desc, '');
    let marca: string;
    let modelo: string;
    if (realBrand) {
      marca = realBrand;
      modelo = modelTail || realBrand;
    } else if (XBRI_MODEL_PATTERNS.some(re => re.test(modelTail || desc))) {
      marca = 'XBRI';
      modelo = modelTail || 'XBRI';
    } else {
      marca = 'XBRI';
      modelo = modelTail || 'XBRI';
    }
    out.push({
      marca,
      modelo,
      medida: size,
      categoria: classifyCategory(size, desc),
      costo: 0,
      precio,
      stock: 0,
      minimo: 2,
      ubicacion: '',
      sku: code,
    });
  }
  return out;
}

// ── Mapeo archivo → parser ────────────────────────────────────────────

const PARSERS: Record<string, ParserFn> = {
  'BULL VIAL': parseBullVial,
  'CORRAL': parseCorral,
  'FATE': parseFate,
  'FIREMAX': parseSeccionPerfilCsv('FIREMAX'),
  'KUMHO': parseSeccionPerfilCsv('KUMHO'),
  'LING LONG': parseLingLong,
  'MAXI-TANGO': parseMaxiTango,
  'TRIANGLE': parseSeccionPerfilCsv('TRIANGLE'),
  'XBRI': parseXbri,
};

// ── Salida CSV ────────────────────────────────────────────────────────

function escapeCsv(v: string | number): string {
  const s = String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(rows: StagingRow[]): string {
  const lines: string[] = [STANDARD_HEADERS.join(',')];
  for (const r of rows) {
    lines.push([
      escapeCsv(r.marca),
      escapeCsv(r.modelo),
      escapeCsv(r.medida),
      escapeCsv(r.categoria),
      escapeCsv(r.costo),
      escapeCsv(r.precio),
      escapeCsv(r.stock),
      escapeCsv(r.minimo),
      escapeCsv(r.ubicacion),
      escapeCsv(r.sku),
    ].join(','));
  }
  return '﻿' + lines.join('\r\n') + '\r\n'; // BOM para Excel
}

// ── Main ──────────────────────────────────────────────────────────────

function main(): void {
  if (!existsSync(INPUT_DIR)) {
    console.error(`[normalize] No existe carpeta de entrada: ${INPUT_DIR}`);
    console.error(`[normalize] Mové los 9 CSV crudos ahí y volvé a correr.`);
    process.exit(1);
  }
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

  const files = readdirSync(INPUT_DIR).filter(f => f.toLowerCase().endsWith('.csv'));
  if (files.length === 0) {
    console.error(`[normalize] No se encontraron CSVs en ${INPUT_DIR}`);
    process.exit(1);
  }

  let totalRows = 0;
  for (const file of files) {
    const stem = basename(file, extname(file));
    const parser = PARSERS[stem];
    if (!parser) {
      console.warn(`[normalize] SKIP "${file}" — no hay parser para "${stem}"`);
      continue;
    }
    const buf = readFileSync(join(INPUT_DIR, file));
    const text = decodeBuffer(buf);
    const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
    const sep = detectSeparator(firstLine);
    const rawRows = parseCsv(text, sep);
    const staging = parser(rawRows, []);
    const csv = rowsToCsv(staging);
    const outPath = join(OUTPUT_DIR, `${stem}.csv`);
    writeFileSync(outPath, csv, 'utf-8');
    console.log(`[normalize] ${stem.padEnd(12)} → ${staging.length.toString().padStart(4)} filas (${outPath})`);
    totalRows += staging.length;
  }
  console.log(`\n[normalize] Total: ${totalRows} SKUs en ${OUTPUT_DIR}`);
}

// Solo corre cuando se ejecuta directo, no cuando se importa desde tests.
// `import.meta.url` y `process.argv[1]` apuntan al mismo path solo en el entry.
const isEntry = typeof process !== 'undefined'
  && process.argv[1]
  && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href;
if (isEntry) main();

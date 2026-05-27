// ═══════════════════════════════════════════════════════════════════
// Tests para la lógica pura de fixTireData (normalizeSize, extractSpecs,
// stripBrandFromModel, computeFix). No tocan DB.
// ═══════════════════════════════════════════════════════════════════
import { describe, test, expect } from 'vitest';
import {
  normalizeSize,
  extractSpecs,
  extractSizeAltFromModel,
  stripBrandFromModel,
  cleanSizeFragmentsFromModel,
  computeFix,
  type TireRow,
} from '../fixTireData';

describe('normalizeSize', () => {
  test('XBRI invertido "R13- 165/70" → ETRTO', () => {
    expect(normalizeSize('R13- 165/70')).toEqual({ main: '165/70 R13', alt: null });
  });

  test('XBRI invertido sin espacio "R14-185/60"', () => {
    expect(normalizeSize('R14-185/60')).toEqual({ main: '185/60 R14', alt: null });
  });

  test('XBRI con espacio raro "R14 -175/65"', () => {
    expect(normalizeSize('R14 -175/65')).toEqual({ main: '175/65 R14', alt: null });
  });

  test('ETRTO ya canónico "205/55 R16" se conserva', () => {
    expect(normalizeSize('205/55 R16')).toEqual({ main: '205/55 R16', alt: null });
  });

  test('ETRTO pegado "205/55R16" → canónico con espacio', () => {
    expect(normalizeSize('205/55R16')).toEqual({ main: '205/55 R16', alt: null });
  });

  test('equivalencia métrica/imperial entre paréntesis → alt', () => {
    expect(normalizeSize('320/85R24 (12.4-24)')).toEqual({
      main: '320/85 R24',
      alt: '12.4-24',
    });
  });

  test('agrícola diagonal puro "12.4-24"', () => {
    expect(normalizeSize('12.4-24')).toEqual({ main: '12.4-24', alt: null });
  });

  test('agrícola con perfil "400/60-15.5"', () => {
    expect(normalizeSize('400/60-15.5')).toEqual({ main: '400/60-15.5', alt: null });
  });

  test('imperial 4x4 "31x10.50 R15"', () => {
    expect(normalizeSize('31x10.50 R15')).toEqual({ main: '31x10.50 R15', alt: null });
  });

  test('camión "295/80 R22.5"', () => {
    expect(normalizeSize('295/80 R22.5')).toEqual({ main: '295/80 R22.5', alt: null });
  });

  test('size con L (carga reforzada) "19.5L-24"', () => {
    expect(normalizeSize('19.5L-24')).toEqual({ main: '19.5L-24', alt: null });
  });

  test('vacío devuelve vacío', () => {
    expect(normalizeSize('')).toEqual({ main: '', alt: null });
  });
});

describe('extractSpecs', () => {
  test('"8PR MRT331 TT" → cleanModel=MRT331, ply=8PR, tube=TT', () => {
    const r = extractSpecs('8PR MRT331 TT');
    expect(r.cleanModel).toBe('MRT331');
    expect(r.plyRating).toBe('8PR');
    expect(r.tubeType).toBe('TT');
    expect(r.loadSpeedIndex).toBeNull();
  });

  test('"82H FASTWAY" → cleanModel=FASTWAY, lsi=82H', () => {
    const r = extractSpecs('82H FASTWAY');
    expect(r.cleanModel).toBe('FASTWAY');
    expect(r.loadSpeedIndex).toBe('82H');
    expect(r.plyRating).toBeNull();
    expect(r.tubeType).toBeNull();
  });

  test('"149/146 K HS268" → lsi=149/146K', () => {
    const r = extractSpecs('149/146 K HS268');
    expect(r.cleanModel).toBe('HS268');
    expect(r.loadSpeedIndex).toBe('149/146K');
  });

  test('"122A8/B QZ702" → lsi=122A8/B', () => {
    const r = extractSpecs('122A8/B QZ702');
    expect(r.cleanModel).toBe('QZ702');
    expect(r.loadSpeedIndex).toBe('122A8/B');
  });

  test('"Y86H MILEVER" → lsi=Y86H', () => {
    const r = extractSpecs('Y86H MILEVER');
    expect(r.cleanModel).toBe('MILEVER');
    expect(r.loadSpeedIndex).toBe('Y86H');
  });

  test('modelo limpio sin specs se mantiene', () => {
    const r = extractSpecs('FASTWAY');
    expect(r.cleanModel).toBe('FASTWAY');
    expect(r.plyRating).toBeNull();
    expect(r.tubeType).toBeNull();
    expect(r.loadSpeedIndex).toBeNull();
  });

  test('"10PR TTF QH201 PACK" → ply=10PR, tube=TTF, model="QH201 PACK"', () => {
    const r = extractSpecs('10PR TTF QH201 PACK');
    expect(r.plyRating).toBe('10PR');
    expect(r.tubeType).toBe('TTF');
    expect(r.cleanModel).toBe('QH201 PACK');
  });

  test('vacío devuelve vacío sin specs', () => {
    const r = extractSpecs('');
    expect(r.cleanModel).toBe('');
    expect(r.plyRating).toBeNull();
  });
});

describe('stripBrandFromModel', () => {
  test('"XBRI FASTWAY" con brand=XBRI → "FASTWAY"', () => {
    expect(stripBrandFromModel('XBRI', 'XBRI FASTWAY')).toBe('FASTWAY');
  });

  test('"MARCHER QZ702" con brand=MARCHER → "QZ702"', () => {
    expect(stripBrandFromModel('MARCHER', 'MARCHER QZ702')).toBe('QZ702');
  });

  test('case-insensitive: "xbri fastway" con brand=XBRI → "fastway"', () => {
    expect(stripBrandFromModel('XBRI', 'xbri fastway')).toBe('fastway');
  });

  test('strip global: brand al final también se quita', () => {
    // Antes el strip era solo prefix; ahora es global porque vimos casos
    // reales como "BRUTUS XBRI" donde la marca quedó al final.
    expect(stripBrandFromModel('XBRI', 'FASTWAY XBRI')).toBe('FASTWAY');
  });

  test('model que es solo la marca → conserva original', () => {
    expect(stripBrandFromModel('XBRI', 'XBRI')).toBe('XBRI');
  });

  test('brand vacía no rompe', () => {
    expect(stripBrandFromModel('', 'FASTWAY')).toBe('FASTWAY');
  });
});

describe('computeFix — caso XBRI con brand falsa', () => {
  test('fila XBRI cargada con brand=FASTWAY se corrige a brand=XBRI, model=FASTWAY', () => {
    const row: TireRow = {
      id: 'uuid-1',
      sku: '00800196',
      brand: 'FASTWAY',
      model: 'R13-175/70 FASTWAY', // como vino del parser viejo (sucio)
      size: 'R13-175/70',
    };
    const r = computeFix(row);
    expect(r.fix.brand).toBe('XBRI');
    // El strip de marca XBRI del model + dedupe deja solo "FASTWAY"
    expect(r.fix.model.toUpperCase()).toContain('FASTWAY');
    expect(r.fix.size).toBe('175/70 R13');
    expect(r.unknownBrand).toBe(false);
    expect(r.changes.length).toBeGreaterThan(0);
  });

  test('fila XBRI brand=ENZO con índice 82H → brand=XBRI, model=ENZO, lsi=82H', () => {
    const row: TireRow = {
      id: 'uuid-2',
      sku: '00800225',
      brand: 'ENZO',
      model: '82H ENZO',
      size: 'R14- 185/60',
    };
    const r = computeFix(row);
    expect(r.fix.brand).toBe('XBRI');
    expect(r.fix.model).toBe('ENZO');
    expect(r.fix.size).toBe('185/60 R14');
    expect(r.fix.load_speed_index).toBe('82H');
  });
});

describe('computeFix — caso marca real preservada', () => {
  test('MILEVER (marca china real) NO se toca como brand', () => {
    const row: TireRow = {
      id: 'uuid-3',
      sku: 'ML-001',
      brand: 'MILEVER',
      model: 'Y86H MILEVER',
      size: '185/65 R14',
    };
    const r = computeFix(row);
    expect(r.fix.brand).toBe('MILEVER');
    expect(r.fix.model).toBe('MILEVER'); // strip de "Y86H" + strip de brand duplicada
    expect(r.fix.load_speed_index).toBe('Y86H');
    expect(r.fix.size).toBe('185/65 R14');
    expect(r.unknownBrand).toBe(false);
  });

  test('MARCHER con modelo QZ702 y ply 8PR', () => {
    const row: TireRow = {
      id: 'uuid-4',
      sku: 'MR-18430R1',
      brand: 'MARCHER',
      model: '8PR MRT331 TT',
      size: '18.4-30',
    };
    const r = computeFix(row);
    expect(r.fix.brand).toBe('MARCHER');
    expect(r.fix.model).toBe('MRT331');
    expect(r.fix.ply_rating).toBe('8PR');
    expect(r.fix.tube_type).toBe('TT');
    expect(r.fix.size).toBe('18.4-30');
    expect(r.unknownBrand).toBe(false);
  });
});

describe('computeFix — caso size con equivalencia paréntesis', () => {
  test('"320/85R24 (12.4-24)" → size=320/85 R24, size_alt=12.4-24', () => {
    const row: TireRow = {
      id: 'uuid-5',
      sku: 'MR-X',
      brand: 'MRL',
      model: 'RRT 885',
      size: '320/85R24 (12.4-24)',
    };
    const r = computeFix(row);
    expect(r.fix.size).toBe('320/85 R24');
    expect(r.fix.size_alt).toBe('12.4-24');
  });
});

describe('extractSizeAltFromModel — equivalencias entre paréntesis', () => {
  test('"(14.9R30) TR1W" → cleanModel=TR1W, sizeAlt=14.9R30', () => {
    const r = extractSizeAltFromModel('(14.9R30) TR1W');
    expect(r.cleanModel).toBe('TR1W');
    expect(r.sizeAlt).toBe('14.9R30');
  });

  test('"R1W (9.5R24)" → cleanModel=R1W, sizeAlt=9.5R24', () => {
    const r = extractSizeAltFromModel('R1W (9.5R24)');
    expect(r.cleanModel).toBe('R1W');
    expect(r.sizeAlt).toBe('9.5R24');
  });

  test('"101D (6.50R16)" → cleanModel=101D, sizeAlt=6.50R16', () => {
    const r = extractSizeAltFromModel('101D (6.50R16)');
    expect(r.cleanModel).toBe('101D');
    expect(r.sizeAlt).toBe('6.50R16');
  });

  test('sin paréntesis con medida → modelo intacto', () => {
    const r = extractSizeAltFromModel('FASTWAY');
    expect(r.cleanModel).toBe('FASTWAY');
    expect(r.sizeAlt).toBeNull();
  });

  test('paréntesis con contenido NO-medida no se extrae como sizeAlt', () => {
    const r = extractSizeAltFromModel('F2 (3RIB)');
    expect(r.cleanModel).toBe('F2 (3RIB)');
    expect(r.sizeAlt).toBeNull();
  });
});

describe('extractSpecs — bugs reportados en primer dry-run', () => {
  test('LSI NO matchea fragmento dentro de paréntesis "(6.50R16)"', () => {
    // Bug: matcheaba `50R16` como LSI dentro de "(6.50R16)".
    // Después del fix, los paréntesis se enmascaran antes de buscar LSI.
    const r = extractSpecs('101D (6.50R16)');
    expect(r.loadSpeedIndex).toBe('101D');
    expect(r.cleanModel).toContain('(6.50R16)');
  });

  test('limpia prefijos chatarra "**", "*", "-", "/"', () => {
    expect(extractSpecs('** L3 TL').cleanModel).toBe('L3');
    expect(extractSpecs('-16 10PR M9 TT').cleanModel).toBe('16 M9');
    expect(extractSpecs('/12 R1 TT SET').cleanModel).toBe('12 R1 SET');
    // El asterisco al inicio se limpia, pero los del medio (como en "*10-12")
    // se conservan porque son parte del nombre histórico del modelo
    expect(extractSpecs('*10-12 14PR SD6000').cleanModel).toBe('10-12 SD6000');
  });

  test('LSI con 3 dígitos + A + dígito ("107A8") sin perder model', () => {
    const r = extractSpecs('107A8 R1W');
    expect(r.loadSpeedIndex).toBe('107A8');
    expect(r.cleanModel).toBe('R1W');
  });
});

describe('computeFix — MAXISPORT 2/3 normalización', () => {
  test('brand="MAXISPORT 2" → brand=MAXISPORT, model prefix=S2', () => {
    const row: TireRow = {
      id: 'uuid-mx2',
      sku: 'MX-001',
      brand: 'MAXISPORT 2',
      model: 'FASTRADE',
      size: '205/55 R16',
    };
    const r = computeFix(row);
    expect(r.fix.brand).toBe('MAXISPORT');
    expect(r.fix.model).toBe('S2 FASTRADE');
    expect(r.unknownBrand).toBe(false);
  });

  test('brand="MAXISPORT 3" → brand=MAXISPORT, model prefix=S3', () => {
    const row: TireRow = {
      id: 'uuid-mx3',
      sku: 'MX-002',
      brand: 'MAXISPORT 3',
      model: 'X100',
      size: '195/65 R15',
    };
    const r = computeFix(row);
    expect(r.fix.brand).toBe('MAXISPORT');
    expect(r.fix.model).toBe('S3 X100');
    expect(r.unknownBrand).toBe(false);
  });
});

describe('computeFix — equivalencia (NN.NRMM) en model → size_alt', () => {
  test('ARMOUR con "(14.9R30) TR1W" → size_alt=14.9R30, model=TR1W', () => {
    const row: TireRow = {
      id: 'uuid-arm-alt',
      sku: 'ARM-38085R30R1',
      brand: 'ARMOUR',
      model: '(14.9R30) 135A8 TR1W',
      size: '380/85R30',
    };
    const r = computeFix(row);
    expect(r.fix.brand).toBe('ARMOUR');
    expect(r.fix.size).toBe('380/85 R30');
    expect(r.fix.size_alt).toBe('14.9R30');
    expect(r.fix.load_speed_index).toBe('135A8');
    expect(r.fix.model).toBe('TR1W');
  });

  test('ARMOUR con "101D (6.50R16)" → size_alt=6.50R16, lsi=101D', () => {
    const row: TireRow = {
      id: 'uuid-arm-101d',
      sku: 'ARM-2607016',
      brand: 'ARMOUR',
      model: '101D (6.50R16)',
      size: '260/70R16',
    };
    const r = computeFix(row);
    expect(r.fix.brand).toBe('ARMOUR');
    expect(r.fix.size).toBe('260/70 R16');
    expect(r.fix.size_alt).toBe('6.50R16');
    expect(r.fix.load_speed_index).toBe('101D');
    // El model queda vacío post-extracción → fallback al original sin la equiv
    expect(r.fix.model).not.toContain('6.50R16');
    expect(r.fix.model).not.toContain('101D');
  });
});

describe('stripBrandFromModel — strip global (no solo prefijo)', () => {
  test('brand=XBRI en medio: "BRUTUS XBRI" → "BRUTUS"', () => {
    expect(stripBrandFromModel('XBRI', 'BRUTUS XBRI')).toBe('BRUTUS');
  });

  test('brand=XBRI repetida: "XBRI BRUTUS XBRI" → "BRUTUS"', () => {
    expect(stripBrandFromModel('XBRI', 'XBRI BRUTUS XBRI')).toBe('BRUTUS');
  });

  test('brand parcial NO matchea: brand=XBR no toca XBRI', () => {
    // \b previene matches parciales: "XBR" no matchea "XBRI"
    expect(stripBrandFromModel('XBR', 'XBRI BRUTUS')).toBe('XBRI BRUTUS');
  });
});

describe('cleanSizeFragmentsFromModel', () => {
  test('decimal suelto al inicio ".50 BRUTUS" → "BRUTUS"', () => {
    expect(cleanSizeFragmentsFromModel('.50 BRUTUS')).toBe('BRUTUS');
  });

  test('R<rim> suelto "R15 109S FORZA" → "109S FORZA"', () => {
    expect(cleanSizeFragmentsFromModel('R15 109S FORZA')).toBe('109S FORZA');
  });

  test('R<rim> con decimal "R22.5 X" → "X"', () => {
    expect(cleanSizeFragmentsFromModel('R22.5 X')).toBe('X');
  });

  test('R1W NO se toca (es nombre de modelo)', () => {
    expect(cleanSizeFragmentsFromModel('R1W (9.5R24)')).toBe('R1W (9.5R24)');
  });

  test('R<rim> en el medio "BRUTUS R16 BRUTUS" → "BRUTUS BRUTUS"', () => {
    expect(cleanSizeFragmentsFromModel('BRUTUS R16 BRUTUS')).toBe('BRUTUS BRUTUS');
  });
});

describe('computeFix — bugs detectados en segundo dry-run', () => {
  test('BRUTUS/BRUTUS XBRI/205/60 R16 → XBRI/BRUTUS/205/60 R16', () => {
    const row: TireRow = {
      id: 'uuid-b1',
      sku: '00800202',
      brand: 'BRUTUS',
      model: 'BRUTUS XBRI',
      size: '205/60 R16',
    };
    const r = computeFix(row);
    expect(r.fix.brand).toBe('XBRI');
    expect(r.fix.model).toBe('BRUTUS');
  });

  test('BRUTUS/R16 BRUTUS/215/65 R16 → XBRI/BRUTUS/215/65 R16', () => {
    const row: TireRow = {
      id: 'uuid-b2',
      sku: '00000031',
      brand: 'BRUTUS',
      model: 'R16 BRUTUS',
      size: '215/65 R16',
    };
    const r = computeFix(row);
    expect(r.fix.brand).toBe('XBRI');
    expect(r.fix.model).toBe('BRUTUS');
  });

  test('BRUTUS/.50 BRUTUS/33X12 R18 → XBRI/BRUTUS/33x12 R18', () => {
    const row: TireRow = {
      id: 'uuid-b3',
      sku: '00800205',
      brand: 'BRUTUS',
      model: '.50 BRUTUS',
      size: '33X12 R18',
    };
    const r = computeFix(row);
    expect(r.fix.brand).toBe('XBRI');
    expect(r.fix.model).toBe('BRUTUS');
    expect(r.fix.size).toBe('33x12 R18');
  });

  test('FORZA/R15 109S FORZA/235/75 R15 → XBRI/FORZA/235/75 R15, lsi=109S', () => {
    const row: TireRow = {
      id: 'uuid-f1',
      sku: '00800230',
      brand: 'FORZA',
      model: 'R15 109S FORZA',
      size: '235/75 R15',
    };
    const r = computeFix(row);
    expect(r.fix.brand).toBe('XBRI');
    expect(r.fix.model).toBe('FORZA');
    expect(r.fix.load_speed_index).toBe('109S');
  });

  test('ARMOUR modelo vaciado por extracción NO queda en blanco', () => {
    // ARM-2607016: model "101D (6.50R16)" → todo se extrae, model vacío
    // → safeModel fallback al original.
    const row: TireRow = {
      id: 'uuid-arm',
      sku: 'ARM-2607016',
      brand: 'ARMOUR',
      model: '101D (6.50R16)',
      size: '260/70R16',
    };
    const r = computeFix(row);
    expect(r.fix.brand).toBe('ARMOUR');
    expect(r.fix.model).not.toBe('');
    expect(r.fix.model.length).toBeGreaterThan(0);
  });
});

describe('computeFix — flag de marca desconocida', () => {
  test('brand fuera de REAL_BRANDS levanta flag', () => {
    const row: TireRow = {
      id: 'uuid-6',
      sku: 'X-1',
      brand: 'MARCA_INVENTADA',
      model: 'X',
      size: '205/55 R16',
    };
    const r = computeFix(row);
    expect(r.unknownBrand).toBe(true);
  });

  test('brand XBRI (real) NO levanta flag', () => {
    const row: TireRow = {
      id: 'uuid-7',
      sku: 'X-2',
      brand: 'XBRI',
      model: 'FORZA',
      size: '205/65 R15',
    };
    const r = computeFix(row);
    expect(r.unknownBrand).toBe(false);
  });
});

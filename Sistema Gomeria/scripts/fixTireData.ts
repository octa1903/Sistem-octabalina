/**
 * fixTireData — script one-shot que corrige datos sucios en `tires`
 * cargados por la primera importación (Fase A, 1086 filas).
 *
 * Problemas que resuelve:
 *  1. Brand falsa: filas con brand ∈ {FASTWAY, ECOLOGY, ENZO, FORZA, BRUTUS}
 *     son en realidad MODELOS de XBRI — se mueven a `model`, brand pasa
 *     a `XBRI`.
 *  2. Size sucio: equivalencias `320/85R24 (12.4-24)` o concatenaciones
 *     `R13 -205/55 R13` → canonicaliza a ETRTO `205/55 R13` y guarda la
 *     imperial en `size_alt`.
 *  3. Specs embebidas en model: `8PR MRT331 TT`, `82H FASTWAY`, `149/146 K HS268`
 *     → extrae `ply_rating`, `tube_type`, `load_speed_index` a sus columnas
 *     dedicadas y deja `model` con el nombre comercial puro.
 *  4. Marca duplicada dentro de model: si `model` empieza con `brand`,
 *     se hace strip.
 *
 * Uso:
 *   npx tsx scripts/fixTireData.ts --dry-run     # imprime tabla y diff
 *   npx tsx scripts/fixTireData.ts --apply       # ejecuta UPDATEs
 *
 * Llave de UPDATE: `sku` (unique). Filas sin SKU caen a `id`.
 */

// supabaseAdmin se importa lazy en main() para que los tests puedan
// consumir las funciones puras sin necesitar SUPABASE_URL/SERVICE_ROLE.

// ── Catálogo de marcas ────────────────────────────────────────────────

/**
 * Marcas que XBRI revende y aparecen embebidas en el listado XBRI pero
 * son MODELOS de XBRI, no marcas independientes.
 */
const XBRI_MODELS = new Set([
  'FASTWAY',
  'ECOLOGY',
  'ENZO',
  'FORZA',
  'BRUTUS',
]);

/**
 * Marcas reales (van en columna `brand`). Lista cerrada — cualquier
 * brand fuera de esta lista se loguea como "marca desconocida" para
 * revisar a mano antes de aplicar.
 */
const REAL_BRANDS = new Set([
  // Proveedor directo
  'XBRI', 'MRL', 'FATE', 'FIREMAX', 'KUMHO', 'TRIANGLE',
  'LINGLONG', 'BULL VIAL', 'CORRAL',
  // Marcas chinas embebidas
  'MILEVER', 'KAPSEN', 'ROADGUIDER', 'OVATION',
  'MARCHER', 'ROADHIKER', 'ARMOUR', 'SAILUN',
  'MAXISPORT', 'TANGO',
]);

// ── Tipos ─────────────────────────────────────────────────────────────

export interface TireRow {
  id: string;
  sku: string | null;
  brand: string;
  model: string;
  size: string;
}

export interface TireFix {
  brand: string;
  model: string;
  size: string;
  size_alt: string | null;
  load_speed_index: string | null;
  ply_rating: string | null;
  tube_type: string | null;
}

export interface FixResult {
  row: TireRow;
  fix: TireFix;
  /** Lista de cambios concretos (para reporte) */
  changes: string[];
  /** Si la brand resultante no está en REAL_BRANDS */
  unknownBrand: boolean;
}

// ── Normalizadores puros ──────────────────────────────────────────────

/**
 * Canonicaliza el size a formato ETRTO `WIDTH/PROFILE R RIM` cuando
 * es posible. Devuelve la medida principal y opcionalmente la alternativa.
 *
 * Ejemplos:
 *   `R13- 165/70`          → { main: '165/70 R13', alt: null }
 *   `R13-165/70`           → { main: '165/70 R13', alt: null }
 *   `R15 -235/75 R15`      → { main: '235/75 R15', alt: null }  (dedupe rim)
 *   `320/85R24 (12.4-24)`  → { main: '320/85 R24', alt: '12.4-24' }
 *   `205/55 R16`           → { main: '205/55 R16', alt: null }  (ya canónico)
 *   `31x10.50 R15`         → { main: '31x10.50 R15', alt: null }
 *   `18.4-30`              → { main: '18.4-30', alt: null }     (agrícola diagonal)
 */
export function normalizeSize(raw: string): { main: string; alt: string | null } {
  const s = (raw ?? '').trim();
  if (!s) return { main: s, alt: null };

  // Detectar alt entre paréntesis: "320/85R24 (12.4-24)"
  let alt: string | null = null;
  const parenMatch = s.match(/\(([^)]+)\)/);
  if (parenMatch) {
    alt = parenMatch[1].trim();
  }

  // Sacar todo lo que esté entre paréntesis y los guiones colgando
  let work = s.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();

  // Patrón 1: "R<rim>[-, ]<width>/<profile>"  → reordenar a "<width>/<profile> R<rim>"
  let m = work.match(/^R\s*(\d+(?:\.\d+)?)\s*[-, ]+\s*(\d+)\s*\/\s*(\d+)/i);
  if (m) {
    return { main: `${m[2]}/${m[3]} R${m[1]}`, alt };
  }

  // Patrón 2: "R<rim> <width>" (sin profile, raro) → "<width> R<rim>"
  m = work.match(/^R\s*(\d+(?:\.\d+)?)\s*[-, ]+\s*(\d+(?:\.\d+)?)\s*$/i);
  if (m) {
    return { main: `${m[2]} R${m[1]}`, alt };
  }

  // Patrón 3: "<width>/<profile> R<rim>" o "<width>/<profile>R<rim>" — ya canónico
  m = work.match(/^(\d+)\s*\/\s*(\d+)\s*R\s*(\d+(?:\.\d+)?)/i);
  if (m) {
    return { main: `${m[1]}/${m[2]} R${m[3]}`, alt };
  }

  // Patrón 4: "<width>/<profile>R<rim> <width>/<profile>R<rim>" duplicado
  m = work.match(/^(\d+)\s*\/\s*(\d+)\s*R\s*(\d+(?:\.\d+)?)/i);
  if (m) {
    return { main: `${m[1]}/${m[2]} R${m[3]}`, alt };
  }

  // Patrón 5: Imperial "31x10.50 R15" o "31x10.50R15"
  m = work.match(/^(\d+(?:\.\d+)?)\s*[xX]\s*(\d+(?:\.\d+)?)\s*R\s*(\d+(?:\.\d+)?)/i);
  if (m) {
    return { main: `${m[1]}x${m[2]} R${m[3]}`, alt };
  }

  // Patrón 6: Agrícola diagonal "12.4-24" o "12.4 - 24"
  m = work.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*$/);
  if (m) {
    return { main: `${m[1]}-${m[2]}`, alt };
  }

  // Patrón 7: Agrícola con perfil "320/85-24" o "400/60-15.5"
  m = work.match(/^(\d+)\s*\/\s*(\d+)\s*-\s*(\d+(?:\.\d+)?)/);
  if (m) {
    return { main: `${m[1]}/${m[2]}-${m[3]}`, alt };
  }

  // Patrón 8: Con prefijo L (carga reforzada) "19.5L-24"
  m = work.match(/^(\d+(?:\.\d+)?L?)\s*-\s*(\d+(?:\.\d+)?)/i);
  if (m) {
    return { main: `${m[1]}-${m[2]}`, alt };
  }

  // Sin match → devolver tal cual (limpio de paréntesis y dobles espacios)
  return { main: work, alt };
}

/**
 * Extrae las equivalencias de medida que vienen entre paréntesis dentro
 * del modelo. Ejemplos:
 *   "(14.9R30)" o "(6.50R16)" o "(9.5R24)" → size_alt
 *
 * Devuelve la primera equivalencia encontrada y el modelo sin ella.
 * Si no hay paréntesis con formato de medida, deja el modelo intacto.
 */
export function extractSizeAltFromModel(rawModel: string): {
  cleanModel: string;
  sizeAlt: string | null;
} {
  if (!rawModel) return { cleanModel: rawModel, sizeAlt: null };
  // Patrón: "(NN.NRMM)" — número (con o sin decimal), R, número rim
  const m = rawModel.match(/\(([\d.]+\s*R\s*[\d.]+)\)/i);
  if (!m) return { cleanModel: rawModel, sizeAlt: null };
  const alt = m[1].replace(/\s+/g, '');
  const clean = rawModel.replace(m[0], ' ').replace(/\s+/g, ' ').trim();
  return { cleanModel: clean, sizeAlt: alt };
}

/**
 * Extrae specs del model y devuelve { cleanModel, specs }.
 *
 * Specs que reconoce:
 *  - ply_rating: `8PR`, `10PR`, `16PR` (con espacios o pegado)
 *  - tube_type: `TT` o `TL` como palabra suelta al inicio/fin
 *  - load_speed_index: combos `82H`, `91V`, `122A8/B`, `149/146 K`, `Y86H`
 *
 * Reglas:
 *  - El nombre comercial se asume que es la primera "palabra-modelo" no spec
 *    (palabra de 2+ letras que no es spec puro). Si el modelo viene como
 *    `8PR MRT331 TT` → cleanModel=`MRT331`, plyRating=`8PR`, tubeType=`TT`.
 *  - Si el modelo es solo specs (`82H`), cleanModel queda vacío y se conserva
 *    el original como fallback.
 *  - NO matchea LSI dentro de paréntesis (esos son alt-sizes que se extraen
 *    aparte con extractSizeAltFromModel).
 */
export function extractSpecs(rawModel: string): {
  cleanModel: string;
  plyRating: string | null;
  tubeType: string | null;
  loadSpeedIndex: string | null;
} {
  let work = (rawModel ?? '').trim().replace(/\s+/g, ' ');
  if (!work) return { cleanModel: '', plyRating: null, tubeType: null, loadSpeedIndex: null };

  // Aislar contenido entre paréntesis para que los specs no se busquen ahí
  // dentro. Lo guardamos y lo restauramos al final.
  const parenSegments: string[] = [];
  work = work.replace(/\([^)]*\)/g, (m) => {
    parenSegments.push(m);
    return ` ${parenSegments.length - 1} `;
  });

  // ply rating
  let plyRating: string | null = null;
  const plyMatch = work.match(/\b(\d+PR)\b/i);
  if (plyMatch) {
    plyRating = plyMatch[1].toUpperCase();
    work = work.replace(plyMatch[0], ' ').trim();
  }

  // tube type
  let tubeType: string | null = null;
  const ttMatch = work.match(/\b(TT|TL|TTF)\b/i);
  if (ttMatch) {
    tubeType = ttMatch[1].toUpperCase();
    work = work.replace(new RegExp(`\\b${ttMatch[1]}\\b`, 'i'), ' ').trim();
  }

  // load+speed index. Patrones (en orden de especificidad):
  //   - "149/146 K"  (camión: dual load + speed)
  //   - "122A8/B"    (agrícola: load index + dos speed symbols)
  //   - "107A8", "135A8" (agrícola: 3 dígitos + A + dígito)
  //   - "82H", "91V", "82T", "109S", "86H" (estándar)
  //   - "Y86H"       (Y prefix raro de XBRI)
  // NOTA: requerimos que no estén pegados a `R<dígito>` (eso sería un size),
  // ni dentro de paréntesis (ya enmascarados arriba).
  let loadSpeedIndex: string | null = null;
  const lsiPatterns: RegExp[] = [
    /\b(\d{2,3}\/\d{2,3}\s*[A-Z])\b/,           // 149/146 K
    /\b(\d{2,3}[A-Z]\d+(?:\/[A-Z]\d*)?)\b/,     // 122A8 o 122A8/B o 107A8
    /\b([YZ]?\d{2,3}[A-Z])(?![A-Z0-9])/,        // 82H, Y86H — no seguido de letra/dígito
  ];
  for (const re of lsiPatterns) {
    const m = work.match(re);
    if (m) {
      loadSpeedIndex = m[1].replace(/\s+/g, '');
      work = work.replace(m[0], ' ').trim();
      break;
    }
  }

  // Restaurar paréntesis enmascarados
  work = work.replace(/ (\d+) /g, (_, i) => parenSegments[Number(i)]);

  // Limpiar prefijos chatarra (`**`, `*`, `-`, `/`, ` ,`, etc.) y dobles espacios
  const cleanModel = work
    .replace(/\s+/g, ' ')
    .replace(/^[*\-/,\s]+|[*\-/,\s]+$/g, '')
    .trim();

  // Si extrajimos alguna spec, NO hacer fallback al original — el cleanModel
  // vacío es válido (significa que el modelo era solo specs). Solo fallback
  // si no extrajimos nada y el original tenía algo.
  const extractedSomething = !!(plyRating || tubeType || loadSpeedIndex);
  const finalCleanModel = extractedSomething
    ? cleanModel
    : (cleanModel || rawModel.trim());

  return {
    cleanModel: finalCleanModel,
    plyRating,
    tubeType,
    loadSpeedIndex,
  };
}

/**
 * Si el modelo contiene la marca (al inicio, al final o repetida en el
 * medio), la elimina dejando solo el resto. Útil para casos como:
 *   brand=XBRI, model="XBRI FASTWAY" → "FASTWAY"
 *   brand=XBRI, model="BRUTUS XBRI"  → "BRUTUS"
 *   brand=MARCHER, model="MARCHER QZ702" → "QZ702"
 * Si tras el strip queda vacío, devuelve el modelo original (fallback).
 */
export function stripBrandFromModel(brand: string, model: string): string {
  if (!brand || !model) return model;
  const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\b${escaped}\\b`, 'gi');
  const stripped = model.replace(re, ' ').replace(/\s+/g, ' ').trim();
  return stripped || model;
}

/**
 * Limpia tokens chatarra que son fragmentos de medida colados en el modelo:
 *  - `R\d+` o `R\d+.\d+` (rim suelto): `R15`, `R22.5`
 *  - decimales sueltos al inicio: `.50`, `.75`
 *
 * No toca otros tokens (specs ya fueron extraídos antes).
 */
export function cleanSizeFragmentsFromModel(model: string): string {
  if (!model) return model;
  return model
    // Decimales sueltos (`.50`, `.75`) en cualquier posición — son
    // fragmentos de tamaño que se desbordaron al model.
    .replace(/(^|\s)\.\d+(\s|$)/g, ' ')
    // R<rim> como palabra suelta (`R15 109S` → `109S`, no toca `R1W`)
    .replace(/\bR\d+(?:\.\d+)?\b(?!\w)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Deduplica tokens contiguos repetidos. Caso típico: cuando una marca
 * falsa se prepende al modelo y la palabra ya estaba al final,
 * `ENZO 82H ENZO` → tras extraer 82H queda `ENZO ENZO` → `ENZO`.
 * Comparación case-insensitive, conserva el primero.
 */
export function dedupeRepeatedTokens(model: string): string {
  if (!model) return model;
  const tokens = model.split(/\s+/).filter(t => t.length > 0);
  const out: string[] = [];
  for (const t of tokens) {
    const prev = out[out.length - 1];
    if (!prev || prev.toUpperCase() !== t.toUpperCase()) {
      out.push(t);
    }
  }
  return out.join(' ');
}

// ── Lógica principal de fix ───────────────────────────────────────────

/**
 * Toma una fila tal como vino de la DB y devuelve el fix propuesto.
 * Es pura — no toca DB.
 */
export function computeFix(row: TireRow): FixResult {
  const changes: string[] = [];

  // Paso 1 — Brand falsa: si está en XBRI_MODELS, brand real es XBRI y
  // el valor anterior va al inicio del model (será el modelo después
  // de extractSpecs).
  let brand = (row.brand ?? '').trim().toUpperCase();
  let workingModel = (row.model ?? '').trim();

  const upperBrand = brand;
  if (XBRI_MODELS.has(upperBrand)) {
    changes.push(`brand "${row.brand}" → XBRI (era modelo de XBRI)`);
    workingModel = `${upperBrand} ${workingModel}`.trim();
    brand = 'XBRI';
  }

  // Normalizar variantes de MAXISPORT (`MAXISPORT 2`, `MAXISPORT 3`)
  // a marca canónica `MAXISPORT`. El sufijo se prepende al modelo
  // para no perder la variante.
  const maxisportMatch = brand.match(/^MAXISPORT\s+(\d+)$/);
  if (maxisportMatch) {
    changes.push(`brand "${row.brand}" → MAXISPORT (era ${row.brand}, variante ${maxisportMatch[1]})`);
    workingModel = `S${maxisportMatch[1]} ${workingModel}`.trim();
    brand = 'MAXISPORT';
  }

  // Paso 2 — Size canonicalization
  const sizeResult = normalizeSize(row.size ?? '');
  if (sizeResult.main !== (row.size ?? '').trim()) {
    changes.push(`size "${row.size}" → "${sizeResult.main}"`);
  }
  if (sizeResult.alt) {
    changes.push(`size_alt = "${sizeResult.alt}"`);
  }

  // Paso 3a — Extraer equivalencia de medida entre paréntesis del modelo
  // (ej. "(14.9R30)" → size_alt) ANTES de extractSpecs para que no
  // interfiera con la búsqueda de LSI.
  const sizeAltFromModel = extractSizeAltFromModel(workingModel);
  workingModel = sizeAltFromModel.cleanModel;

  // Paso 3b — Extract specs del modelo
  const specs = extractSpecs(workingModel);
  const beforeStripModel = specs.cleanModel;

  // Paso 4 — Strip brand del modelo (global) + limpia fragmentos de size
  // + dedupe de tokens repetidos.
  const stripped = stripBrandFromModel(brand, beforeStripModel);
  const noSizeFrags = cleanSizeFragmentsFromModel(stripped);
  const finalModel = dedupeRepeatedTokens(noSizeFrags);
  if (finalModel !== beforeStripModel) {
    changes.push(`model strip brand: "${beforeStripModel}" → "${finalModel}"`);
  }

  // Si tras limpieza el modelo quedó vacío, usar un fallback razonable.
  // No dejamos string vacío porque la columna es NOT NULL.
  // Prioridad:
  //   1. modelo limpio
  //   2. si extrajimos specs (el original era solo specs+ruido), usar la marca
  //   3. modelo original sin tocar
  //   4. "—" como último recurso
  const extractedSpecs = !!(specs.plyRating || specs.tubeType || specs.loadSpeedIndex || sizeAltFromModel.sizeAlt);
  const safeModel = finalModel
    || (extractedSpecs ? brand : (row.model ?? '').trim())
    || '—';

  if (safeModel !== (row.model ?? '').trim()) {
    if (!changes.some(c => c.startsWith('model strip'))) {
      changes.push(`model "${row.model}" → "${safeModel}"`);
    }
  }

  if (specs.plyRating) changes.push(`ply_rating = "${specs.plyRating}"`);
  if (specs.tubeType) changes.push(`tube_type = "${specs.tubeType}"`);
  if (specs.loadSpeedIndex) changes.push(`load_speed_index = "${specs.loadSpeedIndex}"`);

  // Resolver size_alt final: prioridad al que vino del size (paréntesis
  // dentro del size original), fallback al extraído del model.
  const finalSizeAlt = sizeResult.alt ?? sizeAltFromModel.sizeAlt;
  if (sizeAltFromModel.sizeAlt && !sizeResult.alt) {
    changes.push(`size_alt = "${sizeAltFromModel.sizeAlt}" (extraído del model)`);
  }

  const unknownBrand = !REAL_BRANDS.has(brand);

  return {
    row,
    fix: {
      brand,
      model: safeModel,
      size: sizeResult.main,
      size_alt: finalSizeAlt,
      load_speed_index: specs.loadSpeedIndex,
      ply_rating: specs.plyRating,
      tube_type: specs.tubeType,
    },
    changes,
    unknownBrand,
  };
}

// ── Main: lee DB, dry-run o apply ─────────────────────────────────────

interface RunOptions {
  apply: boolean;
  limit?: number;
}

// Tipo mínimo del cliente Supabase para las operaciones que necesitamos.
// Evita arrastrar @supabase/supabase-js al scope global del módulo.
interface DbClient {
  from(table: string): {
    select(cols: string): {
      order(col: string, opts: { ascending: boolean }): {
        range(from: number, to: number): Promise<{ data: unknown[] | null; error: { message: string } | null }>;
      };
    };
    update(payload: Record<string, unknown>): {
      eq(col: string, val: string): Promise<{ error: { message: string } | null }>;
    };
  };
}

async function fetchAllTires(admin: DbClient): Promise<TireRow[]> {
  const out: TireRow[] = [];
  const pageSize = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await admin
      .from('tires')
      .select('id, sku, brand, model, size')
      .order('brand', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    for (const r of data as Array<Record<string, unknown>>) {
      out.push({
        id: r.id as string,
        sku: (r.sku as string | null) ?? null,
        brand: (r.brand as string) ?? '',
        model: (r.model as string) ?? '',
        size: (r.size as string) ?? '',
      });
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

function summarizeBrandTransitions(fixes: FixResult[]): Map<string, number> {
  const transitions = new Map<string, number>();
  for (const f of fixes) {
    const before = f.row.brand;
    const after = f.fix.brand;
    if (before !== after) {
      const key = `${before} → ${after}`;
      transitions.set(key, (transitions.get(key) ?? 0) + 1);
    }
  }
  return transitions;
}

function printDryRun(fixes: FixResult[]): void {
  const changed = fixes.filter(f => f.changes.length > 0);
  const unchanged = fixes.length - changed.length;
  const unknown = fixes.filter(f => f.unknownBrand);

  console.log(`\n=== Resumen ===`);
  console.log(`Total filas:       ${fixes.length}`);
  console.log(`Con cambios:       ${changed.length}`);
  console.log(`Sin cambios:       ${unchanged}`);
  console.log(`Marca desconocida: ${unknown.length}`);

  console.log(`\n=== Transiciones de marca ===`);
  const transitions = summarizeBrandTransitions(fixes);
  for (const [k, v] of [...transitions.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${v.toString().padStart(4)}  ${k}`);
  }

  if (unknown.length > 0) {
    console.log(`\n=== Marcas desconocidas (revisar antes de --apply) ===`);
    const byBrand = new Map<string, number>();
    for (const f of unknown) {
      byBrand.set(f.fix.brand, (byBrand.get(f.fix.brand) ?? 0) + 1);
    }
    for (const [b, n] of [...byBrand.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${n.toString().padStart(4)}  ${b || '(vacío)'}`);
    }
  }

  console.log(`\n=== Muestra de 20 filas con cambios ===`);
  for (const f of changed.slice(0, 20)) {
    const sku = f.row.sku ?? '(sin sku)';
    console.log(`\n[${sku}]  ${f.row.brand} / ${f.row.model} / ${f.row.size}`);
    console.log(`      → ${f.fix.brand} / ${f.fix.model} / ${f.fix.size}`);
    for (const c of f.changes) {
      console.log(`        - ${c}`);
    }
  }
}

async function applyFixes(admin: DbClient, fixes: FixResult[]): Promise<void> {
  const changed = fixes.filter(f => f.changes.length > 0);
  console.log(`\nAplicando ${changed.length} updates...`);
  let done = 0;
  for (const f of changed) {
    const payload = {
      brand: f.fix.brand,
      model: f.fix.model,
      size: f.fix.size,
      size_alt: f.fix.size_alt,
      load_speed_index: f.fix.load_speed_index,
      ply_rating: f.fix.ply_rating,
      tube_type: f.fix.tube_type,
    };
    const { error } = await admin
      .from('tires')
      .update(payload)
      .eq('id', f.row.id);
    if (error) {
      console.error(`  ✗ id=${f.row.id} sku=${f.row.sku ?? '-'}: ${error.message}`);
      continue;
    }
    done++;
    if (done % 50 === 0) console.log(`  ... ${done}/${changed.length}`);
  }
  console.log(`Hechos ${done}/${changed.length}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const opts: RunOptions = {
    apply: args.includes('--apply'),
  };
  const limitArg = args.find(a => a.startsWith('--limit='));
  if (limitArg) opts.limit = parseInt(limitArg.split('=')[1], 10);

  if (!opts.apply && !args.includes('--dry-run')) {
    console.error('Uso: npx tsx scripts/fixTireData.ts --dry-run | --apply [--limit=N]');
    process.exit(1);
  }

  // Cargar .env de scripts/import/ antes de importar supabaseAdmin (que
  // lee process.env al evaluarse).
  const { config } = await import('dotenv');
  const { fileURLToPath } = await import('node:url');
  const path = await import('node:path');
  const here = path.dirname(fileURLToPath(import.meta.url));
  config({ path: path.join(here, 'import', '.env') });

  // Lazy import — solo cuando se ejecuta como entry, no en tests.
  const { admin } = await import('./import/lib/supabaseAdmin');

  console.log('Leyendo tires...');
  const rows = await fetchAllTires(admin as unknown as DbClient);
  const slice = opts.limit ? rows.slice(0, opts.limit) : rows;
  console.log(`Leídas ${rows.length} filas${opts.limit ? ` (procesando ${slice.length})` : ''}.`);

  const fixes = slice.map(computeFix);

  printDryRun(fixes);

  if (opts.apply) {
    const unknown = fixes.filter(f => f.unknownBrand);
    if (unknown.length > 0) {
      console.error(`\n✗ Hay ${unknown.length} filas con marca desconocida. Revisar y agregar a REAL_BRANDS antes de --apply.`);
      process.exit(2);
    }
    await applyFixes(admin as unknown as DbClient, fixes);
  } else {
    console.log(`\n(dry-run — no se aplicaron cambios. Volvé a correr con --apply cuando lo apruebes.)`);
  }
}

// Solo corre cuando se ejecuta directo, no cuando se importa desde tests.
const isEntry = typeof process !== 'undefined'
  && process.argv[1]
  && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href;
if (isEntry) {
  main().catch(e => {
    console.error(e);
    process.exit(1);
  });
}

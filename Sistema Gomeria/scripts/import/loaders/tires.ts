// Loader de neumáticos desde CSVs normalizados en tmp/tires-staging/.
//
// Por cada CSV en tmp/tires-staging/ (ej. CORRAL.csv):
//   1. Lee filas (Marca,Modelo,Medida,Categoría,Costo,Precio,Stock,Mínimo,Ubicación,SKU).
//   2. Resuelve category_id por nombre (categories ya sembradas en 0031).
//   3. Para cada (brand,model,size):
//        - si existe en `tires` → UPDATE cost, default_price.
//        - si no            → INSERT con cost, default_price, category_id, sku.
//   4. Crea un `supplier_price_lists` (header) + bulk `supplier_price_list_items`
//      con tire_id resuelto (para histórico).
//
// Asume: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en env.
// Convenciones del CSV: ver scripts/normalizeTireCsvs.ts.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { admin } from '../lib/supabaseAdmin';

const STAGING_DIR = join(process.cwd(), 'tmp', 'tires-staging');

interface StagingRow {
  brand: string;
  model: string;
  size: string;
  category: string;
  cost: number;
  price: number;
  sku: string;
}

function parseNumber(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function parseCsv(content: string): StagingRow[] {
  // Saca BOM si vino
  const text = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
  const lines = text.split(/\r?\n/).filter(l => l.length > 0);
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map(h => h.trim());
  const col = (name: string) => header.indexOf(name);
  const i = {
    brand: col('Marca'),
    model: col('Modelo'),
    size: col('Medida'),
    category: col('Categoría'),
    cost: col('Costo'),
    price: col('Precio'),
    sku: col('SKU'),
  };
  for (const [k, v] of Object.entries(i)) {
    if (v < 0) throw new Error(`columna faltante: ${k}`);
  }
  const rows: StagingRow[] = [];
  for (let l = 1; l < lines.length; l++) {
    // CSV escapado simple: los normalizados no tienen comas dentro de campos.
    const f = lines[l].split(',');
    rows.push({
      brand: (f[i.brand] ?? '').trim(),
      model: (f[i.model] ?? '').trim(),
      size: (f[i.size] ?? '').trim(),
      category: (f[i.category] ?? '').trim(),
      cost: parseNumber(f[i.cost] ?? '0'),
      price: parseNumber(f[i.price] ?? '0'),
      sku: (f[i.sku] ?? '').trim() || '',
    });
  }
  return rows;
}

function normalizeKey(brand: string, model: string, size: string): string {
  return `${brand.toUpperCase()}|${model.toUpperCase()}|${size.toUpperCase()}`;
}

async function loadCategoryMap(): Promise<Map<string, string>> {
  const { data, error } = await admin.from('categories').select('id, name');
  if (error) throw error;
  const map = new Map<string, string>();
  for (const r of data ?? []) map.set(r.name, r.id);
  return map;
}

async function loadExistingTires(): Promise<Map<string, string>> {
  // Paginar por si hay >1000
  const map = new Map<string, string>();
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await admin
      .from('tires')
      .select('id, brand, model, size')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const batch = data ?? [];
    for (const r of batch) {
      map.set(normalizeKey(r.brand, r.model, r.size), r.id);
    }
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  return map;
}

interface SupplierResult {
  supplier: string;
  total: number;
  inserted: number;
  updated: number;
  errors: string[];
  listId: string | null;
}

async function processSupplier(
  filename: string,
  categoryMap: Map<string, string>,
  existingTires: Map<string, string>,
  fallbackCategoryId: string,
): Promise<SupplierResult> {
  const supplierName = filename.replace(/\.csv$/i, '');
  const filepath = join(STAGING_DIR, filename);
  const content = readFileSync(filepath, 'utf8');
  const rows = parseCsv(content);
  const result: SupplierResult = {
    supplier: supplierName,
    total: rows.length,
    inserted: 0,
    updated: 0,
    errors: [],
    listId: null,
  };

  // 1. Insert/update tires uno a uno (las cantidades son chicas, <300 por CSV).
  //    Bulk upsert con onConflict requiere unique constraint sobre (brand,model,size)
  //    que no existe — más rápido usar update si existe, insert si no.
  const tireIdsForItems: Array<{ row: StagingRow; tireId: string }> = [];

  for (const row of rows) {
    if (!row.brand || !row.model || !row.size) {
      result.errors.push(`fila vacía: ${JSON.stringify(row)}`);
      continue;
    }
    const key = normalizeKey(row.brand, row.model, row.size);
    const categoryId = categoryMap.get(row.category) ?? fallbackCategoryId;
    const existingId = existingTires.get(key);

    if (existingId) {
      const { error } = await admin
        .from('tires')
        .update({
          cost: row.cost,
          default_price: row.price,
          category_id: categoryId,
          sku: row.sku || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingId);
      if (error) {
        result.errors.push(`update ${key}: ${error.message}`);
        continue;
      }
      result.updated++;
      tireIdsForItems.push({ row, tireId: existingId });
    } else {
      const { data, error } = await admin
        .from('tires')
        .insert({
          brand: row.brand,
          model: row.model,
          size: row.size,
          category_id: categoryId,
          cost: row.cost,
          default_price: row.price,
          sku: row.sku || null,
        })
        .select('id')
        .single();
      if (error || !data) {
        result.errors.push(`insert ${key}: ${error?.message ?? 'no data'}`);
        continue;
      }
      result.inserted++;
      existingTires.set(key, data.id);
      tireIdsForItems.push({ row, tireId: data.id });
    }
  }

  // 2. Crear el snapshot supplier_price_lists.
  const today = new Date().toISOString().slice(0, 10);
  const { data: header, error: headerErr } = await admin
    .from('supplier_price_lists')
    .insert({
      supplier_name: supplierName,
      list_name: `${supplierName} ${today}`,
      currency: 'ARS',
      effective_date: today,
      row_count: rows.length,
      notes: `Carga inicial desde scripts/import/loaders/tires.ts`,
    })
    .select('id')
    .single();
  if (headerErr || !header) {
    result.errors.push(`snapshot header: ${headerErr?.message ?? 'no data'}`);
    return result;
  }
  result.listId = header.id;

  // 3. Bulk insert de items (cost_ars = cost_original porque es ARS).
  const itemsPayload = tireIdsForItems.map(({ row, tireId }) => ({
    price_list_id: header.id,
    tire_id: tireId,
    raw_sku: row.sku || null,
    raw_size: row.size,
    raw_brand: row.brand,
    raw_model: row.model,
    cost_original: row.cost,
    cost_ars: row.cost,
    price_suggested: row.price,
  }));
  const chunkSize = 500;
  for (let i = 0; i < itemsPayload.length; i += chunkSize) {
    const chunk = itemsPayload.slice(i, i + chunkSize);
    const { error } = await admin.from('supplier_price_list_items').insert(chunk);
    if (error) result.errors.push(`items chunk ${i}: ${error.message}`);
  }

  return result;
}

async function main(): Promise<void> {
  const files = readdirSync(STAGING_DIR).filter(f => f.toLowerCase().endsWith('.csv'));
  if (files.length === 0) {
    console.error(`[tires-loader] No hay CSVs en ${STAGING_DIR}. Corré primero: npx tsx scripts/normalizeTireCsvs.ts`);
    process.exit(1);
  }

  console.log(`[tires-loader] Procesando ${files.length} archivos: ${files.join(', ')}`);

  const categoryMap = await loadCategoryMap();
  console.log(`[tires-loader] Categorías: ${categoryMap.size} en DB`);
  const fallback = categoryMap.get('Sin categoría');
  if (!fallback) throw new Error('Falta la categoría "Sin categoría" en DB (revisar migration 0031).');

  const existingTires = await loadExistingTires();
  console.log(`[tires-loader] Tires existentes: ${existingTires.size}`);

  const results: SupplierResult[] = [];
  for (const file of files) {
    console.log(`\n[tires-loader] >>> ${file}`);
    const r = await processSupplier(file, categoryMap, existingTires, fallback);
    console.log(`[tires-loader]    total=${r.total} inserted=${r.inserted} updated=${r.updated} errors=${r.errors.length} listId=${r.listId ?? '-'}`);
    if (r.errors.length > 0) {
      console.log(`[tires-loader]    primeros errores:`);
      for (const e of r.errors.slice(0, 5)) console.log(`      - ${e}`);
    }
    results.push(r);
  }

  console.log('\n[tires-loader] === RESUMEN ===');
  let totIn = 0, totUp = 0, totErr = 0;
  for (const r of results) {
    console.log(`  ${r.supplier.padEnd(14)} inserted=${String(r.inserted).padStart(4)}  updated=${String(r.updated).padStart(4)}  errors=${r.errors.length}`);
    totIn += r.inserted; totUp += r.updated; totErr += r.errors.length;
  }
  console.log(`  ${'TOTAL'.padEnd(14)} inserted=${String(totIn).padStart(4)}  updated=${String(totUp).padStart(4)}  errors=${totErr}`);
}

main().catch(err => {
  console.error('[tires-loader] FATAL:', err);
  process.exit(1);
});

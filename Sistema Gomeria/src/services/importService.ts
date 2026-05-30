// ═══════════════════════════════════════════════════
// importService — bulk import desde Excel/CSV a Supabase
// Usa SheetJS (xlsx) para parsear; soporta .xlsx y .csv.
// ═══════════════════════════════════════════════════

import * as XLSX from 'xlsx';
import { supabase } from './supabaseClient';
import { ensureNoError, fetchAllPaginated } from './supabaseHelpers';
import { hashPin } from '@/utils/hash';
import { describeError } from '@/utils/errorMessage';
import { parseAmount } from '@/utils/currency';
import type { Category } from '@/types';

export type RawRow = Record<string, unknown>;

export interface ParsedFile {
  rows: RawRow[];
  headers: string[];
}

export async function parseFile(file: File): Promise<ParsedFile> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('El archivo no tiene hojas.');
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: '' });
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  return { rows, headers };
}

// ── Tires ──────────────────────────────────────────────

export interface TireImportRow {
  brand: string;
  model: string;
  size: string;
  categoryName: string;
  cost: number;
  price: number;
  stock: number;
  lowStockThreshold: number;
  location?: string;
  sku?: string;
}

export interface TireImportResult {
  rowIndex: number;
  raw: RawRow;
  parsed?: TireImportRow;
  error?: string;
}

const TIRE_HEADERS_ALIASES: Record<keyof TireImportRow, string[]> = {
  brand:             ['marca', 'brand'],
  model:             ['modelo', 'model'],
  size:              ['medida', 'size', 'rodado'],
  categoryName:      ['categoria', 'categoría', 'category'],
  cost:              ['costo', 'cost'],
  price:             ['precio', 'price', 'precio venta', 'precio de venta'],
  stock:             ['stock', 'cantidad'],
  lowStockThreshold: ['minimo', 'mínimo', 'min stock', 'low stock'],
  location:          ['ubicacion', 'ubicación', 'location'],
  sku:               ['sku', 'codigo', 'código'],
};

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function pickField<T = unknown>(row: RawRow, aliases: string[]): T | undefined {
  for (const a of aliases) {
    const an = normalize(a);
    for (const k of Object.keys(row)) {
      if (normalize(k) === an) return row[k] as T;
    }
  }
  return undefined;
}

/**
 * Parsea un número de una celda de CSV. Distingue tres casos:
 *   - celda ausente / vacía → null (el caller decide el default).
 *   - celda con número válido (es-AR o canónico) → el número.
 *   - celda PRESENTE pero no parseable ("12.5O", "abc") → NaN.
 *
 * Antes devolvía 0 ante basura, lo que metía costos/precios en $0 sin
 * avisar. Ahora el caller puede tratar NaN como error de fila visible.
 */
function asNumberOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  const s = String(v).trim();
  if (!s) return null;
  // Reusa el parser de currency (maneja es-AR "1.234,56" y "50.000" miles).
  return parseAmount(s);
}

function asString(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

/**
 * Dada una lista de [label, valor|null], devuelve un mensaje de error para
 * el primer valor inválido (NaN = celda basura, o negativo), o null si
 * todos son válidos o ausentes. null = ausente (legítimo, usa default).
 */
function firstInvalidNumber(fields: ReadonlyArray<[string, number | null]>): string | null {
  for (const [label, value] of fields) {
    if (value === null) continue; // ausente → default, no es error
    if (Number.isNaN(value)) return `El ${label} no es un número válido.`;
    if (value < 0) return `El ${label} no puede ser negativo.`;
  }
  return null;
}

export function validateTireRows(rows: RawRow[], categories: Category[]): TireImportResult[] {
  const catNames = new Set(categories.map(c => normalize(c.name)));
  return rows.map((raw, i) => {
    const brand = asString(pickField(raw, TIRE_HEADERS_ALIASES.brand));
    const model = asString(pickField(raw, TIRE_HEADERS_ALIASES.model));
    const size = asString(pickField(raw, TIRE_HEADERS_ALIASES.size));
    const categoryName = asString(pickField(raw, TIRE_HEADERS_ALIASES.categoryName)) || 'Sin categoría';
    const costRaw = asNumberOrNull(pickField(raw, TIRE_HEADERS_ALIASES.cost));
    const priceRaw = asNumberOrNull(pickField(raw, TIRE_HEADERS_ALIASES.price));
    const stockRaw = asNumberOrNull(pickField(raw, TIRE_HEADERS_ALIASES.stock));
    const thresholdRaw = asNumberOrNull(pickField(raw, TIRE_HEADERS_ALIASES.lowStockThreshold));
    const location = asString(pickField(raw, TIRE_HEADERS_ALIASES.location)) || undefined;
    const sku = asString(pickField(raw, TIRE_HEADERS_ALIASES.sku)) || undefined;

    if (!brand || !model || !size) {
      return { rowIndex: i, raw, error: 'Faltan marca, modelo o medida.' };
    }
    if (!catNames.has(normalize(categoryName))) {
      return { rowIndex: i, raw, error: `Categoría "${categoryName}" no existe en el sistema.` };
    }
    // Un valor PRESENTE pero no numérico es un error de fila visible, no un 0
    // silencioso. Ausente (null) usa default seguro.
    const numErr = firstInvalidNumber([
      ['costo', costRaw], ['precio', priceRaw], ['stock', stockRaw], ['stock mínimo', thresholdRaw],
    ]);
    if (numErr) return { rowIndex: i, raw, error: numErr };

    const cost = costRaw ?? 0;
    const price = priceRaw ?? 0;
    const stock = stockRaw ?? 0;
    const lowStockThreshold = thresholdRaw ?? 2;

    const parsed: TireImportRow = {
      brand, model, size, categoryName, cost, price, stock, lowStockThreshold, location, sku,
    };
    return { rowIndex: i, raw, parsed };
  });
}

export interface ImportSummary {
  inserted: number;
  failed: number;
  errors: { rowIndex: number; error: string }[];
  /**
   * (Solo tires) mapping rowIndex → tireId persistido. Permite al caller
   * crear un snapshot de lista de proveedor (`supplier_price_lists`) con
   * los tire_id ya matcheados, sin re-hacer la búsqueda.
   */
  tireIds?: { rowIndex: number; tireId: string }[];
}

/**
 * Inserta tires + overrides para la tienda activa. Tires duplicados
 * (misma marca+modelo+medida) se actualizan en lugar de re-crearse.
 */
export async function bulkInsertTires(
  parsed: TireImportRow[],
  storeId: string,
  categories: Category[],
): Promise<ImportSummary> {
  const catByName = new Map(categories.map(c => [normalize(c.name), c.id]));
  const summary: ImportSummary = { inserted: 0, failed: 0, errors: [], tireIds: [] };

  // Cargar tires existentes para detectar duplicados (por brand+model+size case-insensitive).
  // Paginar: con >1000 tires, un select plano devuelve solo los primeros 1000 y
  // el resto se intenta insertar → falla por unique constraint o crea duplicados.
  const existing = await fetchAllPaginated<{ id: string; brand: string; model: string; size: string }>(
    () => supabase.from('tires').select('id, brand, model, size'),
    'bulkInsertTires.loadExisting',
  );
  const existingByKey = new Map<string, string>();
  for (const t of existing) {
    const key = `${normalize(t.brand)}|${normalize(t.model)}|${normalize(t.size)}`;
    existingByKey.set(key, t.id);
  }

  for (let i = 0; i < parsed.length; i++) {
    const r = parsed[i];
    try {
      const categoryId = catByName.get(normalize(r.categoryName));
      if (!categoryId) throw new Error(`Categoría "${r.categoryName}" no encontrada`);

      const key = `${normalize(r.brand)}|${normalize(r.model)}|${normalize(r.size)}`;
      const existingId = existingByKey.get(key);

      let tireId: string;
      if (existingId) {
        const { error } = await supabase
          .from('tires')
          .update({
            category_id: categoryId,
            cost: r.cost,
            default_price: r.price,
            sku: r.sku,
          })
          .eq('id', existingId);
        if (error) throw error;
        tireId = existingId;
      } else {
        const { data, error } = await supabase
          .from('tires')
          .insert({
            brand: r.brand,
            model: r.model,
            size: r.size,
            category_id: categoryId,
            cost: r.cost,
            default_price: r.price,
            sku: r.sku,
          })
          .select('id')
          .single();
        if (error) throw error;
        tireId = data.id;
        // Registrar para que duplicados intra-archivo se traten como update
        existingByKey.set(key, tireId);
      }

      // Override por tienda
      const { error: ovErr } = await supabase
        .from('tire_store_overrides')
        .upsert({
          tire_id: tireId,
          store_id: storeId,
          available: true,
          price: r.price,
          stock: r.stock,
          low_stock_threshold: r.lowStockThreshold,
          location: r.location,
        }, { onConflict: 'tire_id,store_id' });
      if (ovErr) throw ovErr;

      summary.inserted++;
      summary.tireIds!.push({ rowIndex: i, tireId });
    } catch (e) {
       
      console.error(`[import tires] fila ${i + 1}:`, e);
      summary.failed++;
      summary.errors.push({ rowIndex: i, error: describeError(e) });
    }
  }
  return summary;
}

// ── Customers ──────────────────────────────────────────

export interface CustomerImportRow {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  customerType: 'retail' | 'wholesale';
  creditLimit: number;
  wholesaleDiscount?: number;
  pin?: string;
}

export interface CustomerImportResult {
  rowIndex: number;
  raw: RawRow;
  parsed?: CustomerImportRow;
  error?: string;
}

const CUSTOMER_HEADERS_ALIASES: Record<keyof CustomerImportRow, string[]> = {
  name:               ['nombre', 'name', 'cliente'],
  phone:              ['telefono', 'teléfono', 'phone', 'celular'],
  email:              ['email', 'mail', 'correo'],
  address:            ['direccion', 'dirección', 'address', 'domicilio'],
  customerType:       ['tipo', 'type', 'tipo cliente'],
  creditLimit:        ['cupo', 'credito', 'crédito', 'cupo credito', 'credit limit', 'cupo de credito'],
  wholesaleDiscount:  ['descuento', 'descuento mayorista', 'discount'],
  pin:                ['pin', 'codigo', 'código'],
};

export function validateCustomerRows(rows: RawRow[]): CustomerImportResult[] {
  return rows.map((raw, i) => {
    const name = asString(pickField(raw, CUSTOMER_HEADERS_ALIASES.name));
    if (!name) return { rowIndex: i, raw, error: 'Falta nombre.' };

    const phone = asString(pickField(raw, CUSTOMER_HEADERS_ALIASES.phone)) || undefined;
    const email = asString(pickField(raw, CUSTOMER_HEADERS_ALIASES.email)) || undefined;
    const address = asString(pickField(raw, CUSTOMER_HEADERS_ALIASES.address)) || undefined;
    const typeRaw = normalize(asString(pickField(raw, CUSTOMER_HEADERS_ALIASES.customerType)));
    const customerType: 'retail' | 'wholesale' =
      typeRaw === 'mayorista' || typeRaw === 'wholesale' ? 'wholesale' : 'retail';
    const creditLimitRaw = asNumberOrNull(pickField(raw, CUSTOMER_HEADERS_ALIASES.creditLimit));
    const wholesaleDiscountRaw = asNumberOrNull(pickField(raw, CUSTOMER_HEADERS_ALIASES.wholesaleDiscount));
    const pin = asString(pickField(raw, CUSTOMER_HEADERS_ALIASES.pin)) || undefined;

    const numErr = firstInvalidNumber([
      ['cupo de crédito', creditLimitRaw], ['descuento mayorista', wholesaleDiscountRaw],
    ]);
    if (numErr) return { rowIndex: i, raw, error: numErr };

    const creditLimit = creditLimitRaw ?? 0;
    const wholesaleDiscount = wholesaleDiscountRaw ?? undefined;

    return {
      rowIndex: i,
      raw,
      parsed: { name, phone, email, address, customerType, creditLimit, wholesaleDiscount, pin },
    };
  });
}

export async function bulkInsertCustomers(parsed: CustomerImportRow[]): Promise<ImportSummary> {
  const summary: ImportSummary = { inserted: 0, failed: 0, errors: [] };

  for (let i = 0; i < parsed.length; i++) {
    const r = parsed[i];
    try {
      const pinHash = r.pin ? await hashPin(r.pin) : null;
      const { error } = await supabase.from('customers').insert({
        name: r.name,
        phone: r.phone ?? null,
        email: r.email ?? null,
        address: r.address ? { street: r.address, city: '', region: '', zip: '', country: '' } : null,
        customer_type: r.customerType,
        credit_limit: r.creditLimit,
        wholesale_discount: r.wholesaleDiscount ?? null,
        pin_hash: pinHash,
        account_balance: 0,
      });
      if (error) throw error;
      summary.inserted++;
    } catch (e) {
       
      console.error(`[import customers] fila ${i + 1}:`, e);
      summary.failed++;
      summary.errors.push({ rowIndex: i, error: describeError(e) });
    }
  }
  return summary;
}

// ── Helpers para mostrar plantillas/columnas esperadas ────

export const TIRE_TEMPLATE_HEADERS = ['Marca', 'Modelo', 'Medida', 'Categoría', 'Costo', 'Precio', 'Stock', 'Mínimo', 'Ubicación', 'SKU'];
export const TIRE_TEMPLATE_EXAMPLE = ['Pirelli', 'P1 Cinturato', '175/70 R13', 'Auto', 40000, 60000, 10, 2, 'A1', 'PIR-175-13'];

export const CUSTOMER_TEMPLATE_HEADERS = ['Nombre', 'Teléfono', 'Email', 'Dirección', 'Tipo', 'Cupo', 'Descuento', 'PIN'];
export const CUSTOMER_TEMPLATE_EXAMPLE = ['Juan Pérez', '223-555-0001', 'juan@ej.com', 'Calle 123', 'minorista', 100000, 0, '1234'];

export function downloadTemplate(kind: 'tires' | 'customers'): void {
  const headers = kind === 'tires' ? TIRE_TEMPLATE_HEADERS : CUSTOMER_TEMPLATE_HEADERS;
  const example = kind === 'tires' ? TIRE_TEMPLATE_EXAMPLE : CUSTOMER_TEMPLATE_EXAMPLE;
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Datos');
  XLSX.writeFile(wb, `plantilla-${kind}.xlsx`);
}

// Re-export para que el helper interno se use desde ImportModal
export { ensureNoError };

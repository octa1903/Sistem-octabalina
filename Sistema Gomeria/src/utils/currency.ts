// ═══════════════════════════════════════════════════
// Baliña Ruedas — Utilidades de moneda (ARS)
//
// Capa DEFENSIVA centralizada. Los datos migrados del sistema legacy
// pueden traer montos corruptos (NaN, undefined, Infinity, o valores
// absurdos producto de movimientos duplicados). La regla de oro:
//   nunca mostrar basura — un dato malo se degrada a $0 (o '—' en un
//   formateo) y se avisa por consola, pero la UI NO se rompe.
//
// `toMoney()` es el único punto por donde debe pasar cualquier valor
// monetario antes de sumarse, restarse o mostrarse.
// ═══════════════════════════════════════════════════

/**
 * Límite de cordura. Ningún monto legítimo de una gomería supera esto.
 * Un valor más grande (ej. $2.662.722.686 de la migración rota) es señal
 * de dato corrupto: se degrada a 0 con aviso, en vez de propagar basura.
 * 1e12 = un billón de pesos. Holgado pero finito.
 */
export const MAX_SANE_AMOUNT = 1e12;

const formatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * Normaliza cualquier valor a un número de dinero seguro y finito.
 * - number finito en rango → tal cual.
 * - string numérico ("1234.5", "1.234,50") → parseado.
 * - NaN / Infinity / null / undefined / objeto → 0 (con warning).
 * - fuera de ±MAX_SANE_AMOUNT → 0 (con warning de dato corrupto).
 *
 * Es la frontera única: todo monto que entra al sistema desde la DB,
 * un input o un cálculo debe pasar por acá antes de acumularse/mostrarse.
 */
export function toMoney(value: unknown): number {
  let n: number;

  if (typeof value === 'number') {
    n = value;
  } else if (typeof value === 'string') {
    n = parseAmount(value);
  } else {
    n = NaN;
  }

  if (!Number.isFinite(n)) {
    if (value !== null && value !== undefined && value !== '') {
      console.warn('[money] valor no numérico degradado a 0:', value);
    }
    return 0;
  }
  if (Math.abs(n) > MAX_SANE_AMOUNT) {
    console.warn('[money] monto fuera de rango razonable, degradado a 0:', n);
    return 0;
  }
  return n;
}

/**
 * Parsea un string numérico tolerando formato es-AR ("1.234,56" /
 * "2.662.722.686") y formato canónico ("1234.56"). Devuelve NaN si no
 * es parseable. Exportada para reusar en el importador de CSV, que
 * necesita distinguir "celda basura" (NaN) de "número válido".
 *
 * Reglas de desambiguación del punto (es el caso espinoso):
 *   - Si hay coma → la coma es decimal y los puntos son miles.
 *   - Si NO hay coma pero hay ≥2 puntos → todos son separadores de miles.
 *   - Si NO hay coma y hay 1 solo punto seguido de exactamente 3 dígitos
 *     (ej. "1.234") → es separador de miles es-AR, no decimal.
 *   - En cualquier otro caso el punto es decimal canónico.
 */
export function parseAmount(raw: string): number {
  const s = raw.trim();
  if (!s) return NaN;
  const cleaned = s.replace(/[^\d.,-]/g, '');
  if (cleaned === '') return NaN;

  const hasComma = cleaned.includes(',');
  let normalized: string;

  if (hasComma) {
    // es-AR: punto = miles, coma = decimal.
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    const dotCount = (cleaned.match(/\./g) ?? []).length;
    const looksLikeThousands =
      dotCount >= 2 || /\.\d{3}(?:\D|$)/.test(cleaned + ' ');
    normalized = looksLikeThousands ? cleaned.replace(/\./g, '') : cleaned;
  }

  return normalized === '' ? NaN : Number(normalized);
}

/**
 * Suma una lista de montos de forma segura: cada elemento pasa por
 * toMoney(), así un dato corrupto en el medio no envenena el total.
 */
export function sumMoney(values: ReadonlyArray<unknown>): number {
  let total = 0;
  for (const v of values) total += toMoney(v);
  return total;
}

/**
 * Formatea un monto en ARS. DEFENSIVO: cualquier valor inválido se
 * muestra como $0 en vez de "NaN" o "$ Infinity". Acepta `unknown`
 * para que ningún call site pueda colarse con un dato corrupto.
 */
export function formatCurrency(amount: unknown): string {
  return formatter.format(toMoney(amount));
}

/** Igual que formatCurrency pero con valor absoluto (saldos deuda/favor). */
export function formatCurrencyAbs(amount: unknown): string {
  return formatter.format(Math.abs(toMoney(amount)));
}

export function formatDecimal(value: unknown, decimals = 2): string {
  return toMoney(value).toLocaleString('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function calculateMargin(cost: unknown, salePrice: unknown): number {
  const c = toMoney(cost);
  const p = toMoney(salePrice);
  if (c === 0) return 0;
  return Math.round(((p - c) / c) * 100);
}

export function calculateSalePrice(cost: unknown, marginPercent: unknown): number {
  const c = toMoney(cost);
  const m = toMoney(marginPercent);
  return Math.round(c * (1 + m / 100));
}

export function applySurcharge(amount: unknown, surchargePercent: unknown): number {
  const a = toMoney(amount);
  const s = toMoney(surchargePercent);
  return Math.round(a * (1 + s / 100));
}

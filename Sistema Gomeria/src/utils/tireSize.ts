// ═══════════════════════════════════════════════════════════════════
// tireSize — parsea strings de medida de neumático para ordenarlos.
//
// Soporta los formatos que aparecen en las listas de proveedores:
//   - Métrica radial: "205/55 R16", "205/55R16", "215 55 17"
//   - Métrica radial decimal (camión): "295/80 R22.5", "385/65R22.5"
//   - Diagonal con guión: "7.50-16", "12.4-24", "10.00-20"
//   - Imperial (campo/4x4): "31x10.50 R15", "33X12.5-15"
//   - Implementos con barra: "10.5/80-18", "400/60-15.5"
//
// El resultado se usa SOLO para ordenar en la UI (no se persiste).
// Si no parsea, devuelve rim/width = Infinity para que vaya al final.
// ═══════════════════════════════════════════════════════════════════

export interface ParsedTireSize {
  /** Diámetro de la llanta en pulgadas (13, 15, 22.5, etc.). Infinity si no parsea. */
  rim: number;
  /** Ancho de la banda (en mm para métricas, pulgadas para imperiales). Infinity si no parsea. */
  width: number;
  /** Perfil/relación de aspecto en %. null cuando la medida no lo expresa (ej: "31x10.50 R15"). */
  profile: number | null;
  /** String original (para debug y desempate estable). */
  raw: string;
}

const FALLBACK: Omit<ParsedTireSize, 'raw'> = {
  rim: Number.POSITIVE_INFINITY,
  width: Number.POSITIVE_INFINITY,
  profile: null,
};

/**
 * Parsea una medida de neumático. Tolerante a espacios, mayúsculas y separadores.
 * Probado contra los 9 CSV de proveedores cargados al sistema.
 */
export function parseTireSize(input: string): ParsedTireSize {
  const raw = input ?? '';
  const s = raw.trim().toUpperCase().replace(/\s+/g, ' ');
  if (!s) return { ...FALLBACK, raw };

  // 1. Imperial: "31X10.50 R15" o "33X12.5-15" → width=10.50, rim=15
  const imperial = s.match(/^(\d+(?:\.\d+)?)\s*X\s*(\d+(?:\.\d+)?)\s*[R-]?\s*(\d+(?:\.\d+)?)/);
  if (imperial) {
    return {
      rim: Number(imperial[3]),
      width: Number(imperial[2]),
      profile: null,
      raw,
    };
  }

  // 2. Implemento/agrícola con barra y guión: "400/60-15.5", "10.5/80-18".
  //    Tiene que ir antes del bloque métrico radial para no confundirse.
  const slashDash = s.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
  if (slashDash) {
    return {
      rim: Number(slashDash[3]),
      width: Number(slashDash[1]),
      profile: Number(slashDash[2]),
      raw,
    };
  }

  // 3. Métrica radial con barra y perfil: "205/55 R16", "295/80R22.5", "LT225/75 R15".
  //    Acepta prefijo opcional "LT" y letras de índice de velocidad entre perfil y R.
  const metric = s.match(/^(?:LT\s*)?(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*[ZWVHRSPMC]*\s*R\s*(\d+(?:\.\d+)?)/);
  if (metric) {
    return {
      rim: Number(metric[3]),
      width: Number(metric[1]),
      profile: Number(metric[2]),
      raw,
    };
  }

  // 4. Métrica radial sin perfil explícito: "205 R16", "275 R22.5" (poco común).
  const noProfile = s.match(/^(\d+(?:\.\d+)?)\s*R\s*(\d+(?:\.\d+)?)/);
  if (noProfile) {
    return {
      rim: Number(noProfile[2]),
      width: Number(noProfile[1]),
      profile: null,
      raw,
    };
  }

  // 5. Diagonal con guión: "7.50-16", "12.4-24", "11L-15".
  const dash = s.match(/^(\d+(?:\.\d+)?)\s*[L]?\s*-\s*(\d+(?:\.\d+)?)/);
  if (dash) {
    return {
      rim: Number(dash[2]),
      width: Number(dash[1]),
      profile: null,
      raw,
    };
  }

  return { ...FALLBACK, raw };
}

/**
 * Compara dos medidas para `Array.prototype.sort()`:
 * primero rim ascendente, luego width ascendente, luego profile, luego raw.
 */
export function compareTireSize(a: string, b: string): number {
  const pa = parseTireSize(a);
  const pb = parseTireSize(b);
  if (pa.rim !== pb.rim) return pa.rim - pb.rim;
  if (pa.width !== pb.width) return pa.width - pb.width;
  const ap = pa.profile ?? Number.POSITIVE_INFINITY;
  const bp = pb.profile ?? Number.POSITIVE_INFINITY;
  if (ap !== bp) return ap - bp;
  return pa.raw.localeCompare(pb.raw);
}

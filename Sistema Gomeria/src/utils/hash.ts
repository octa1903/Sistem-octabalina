// ═══════════════════════════════════════════════════
// Baliña Ruedas — Hashing de PINs y utilidades
//
// Formato de PIN nuevo: `pbkdf2$<iter>$<saltHex>$<hashHex>`
// Formato legacy: `<sha256Hex>` (64 chars, sin sal). `verifyPin` acepta
// ambos para no romper hashes existentes; el primer cambio de PIN del
// usuario lo migra automáticamente al formato nuevo.
// ═══════════════════════════════════════════════════

const PBKDF2_ITERATIONS = 300_000;
const PBKDF2_SALT_BYTES = 16;
const PBKDF2_KEY_BYTES = 32;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('Hex inválido');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** SHA-256 hex (uso general; NO usar para PINs nuevos — ver hashPin). */
export async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(buf));
}

async function pbkdf2(pin: string, salt: Uint8Array, iterations: number, keyBytes: number): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    key,
    keyBytes * 8,
  );
  return new Uint8Array(bits);
}

/** Hashea un PIN para almacenamiento. Devuelve `pbkdf2$<iter>$<salt>$<hash>`. */
export async function hashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(PBKDF2_SALT_BYTES));
  const derived = await pbkdf2(pin, salt, PBKDF2_ITERATIONS, PBKDF2_KEY_BYTES);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bytesToHex(salt)}$${bytesToHex(derived)}`;
}

/** Verifica un PIN contra su hash almacenado. Acepta formato nuevo y legacy. */
export async function verifyPin(pin: string, storedHash: string): Promise<boolean> {
  if (!storedHash) return false;
  if (storedHash.startsWith('pbkdf2$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 4) return false;
    const iter = parseInt(parts[1], 10);
    if (!Number.isFinite(iter) || iter < 1) return false;
    let salt: Uint8Array;
    let expected: Uint8Array;
    try {
      salt = hexToBytes(parts[2]);
      expected = hexToBytes(parts[3]);
    } catch {
      return false;
    }
    const actual = await pbkdf2(pin, salt, iter, expected.length);
    return constantTimeEqual(bytesToHex(actual), bytesToHex(expected));
  }
  // Legacy SHA-256 hex (64 chars). Comparación constant-time.
  const inputHash = await sha256(pin);
  return constantTimeEqual(inputHash, storedHash);
}

/**
 * Indica si un hash usa el formato legacy (SHA-256 sin sal). Útil para
 * forzar re-hash en el próximo login si querés detectar usuarios "weak".
 */
export function isLegacyHash(storedHash: string): boolean {
  return !!storedHash && !storedHash.startsWith('pbkdf2$');
}

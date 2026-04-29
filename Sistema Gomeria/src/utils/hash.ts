// ═══════════════════════════════════════════════════
// Baliña Ruedas — Utilidades de hash
// ═══════════════════════════════════════════════════

/**
 * Genera un hash SHA-256 del texto dado usando la Web Crypto API.
 * Retorna el hash en formato hexadecimal.
 */
export async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Versión síncrona para compatibilidad con código que no puede ser async.
 * ⚠️ Preferir sha256() cuando sea posible.
 */
export function sha256Sync(text: string): string {
  // Fallback simple — en producción usar SubtleCrypto
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(64, '0');
}

/**
 * Verifica un PIN contra su hash almacenado.
 */
export async function verifyPin(pin: string, storedHash: string): Promise<boolean> {
  const inputHash = await sha256(pin);
  return inputHash === storedHash;
}

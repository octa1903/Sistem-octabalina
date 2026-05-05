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
 * Verifica un PIN contra su hash almacenado.
 */
export async function verifyPin(pin: string, storedHash: string): Promise<boolean> {
  const inputHash = await sha256(pin);
  return inputHash === storedHash;
}

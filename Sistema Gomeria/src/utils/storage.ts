// ═══════════════════════════════════════════════════
// Baliña Ruedas — Capa de persistencia en localStorage
// con cifrado AES-GCM para datos sensibles
// ═══════════════════════════════════════════════════

const STORAGE_PREFIX = 'balina_';
const ENCRYPTION_KEY = 'balina_storage_key_v1';

/**
 * Deriva una clave de cifrado desde una contraseña maestra.
 */
async function deriveKey(password: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode('balina-ruedas-salt'),
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function getCryptoKey(): Promise<CryptoKey> {
  return deriveKey(ENCRYPTION_KEY);
}

/**
 * Cifra un string con AES-GCM.
 */
async function encrypt(plaintext: string): Promise<string> {
  const key = await getCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext),
  );
  // Formato: iv:base64 + ciphertext:base64
  const ivB64 = btoa(String.fromCharCode(...iv));
  const ctB64 = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));
  return `${ivB64}.${ctB64}`;
}

/**
 * Descifra un string cifrado con AES-GCM.
 */
async function decrypt(encrypted: string): Promise<string> {
  const key = await getCryptoKey();
  const [ivB64, ctB64] = encrypted.split('.');
  const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
  const ct = Uint8Array.from(atob(ctB64), (c) => c.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return new TextDecoder().decode(decrypted);
}

// ─── Public API ─────────────────────────────────────

export function storageGet<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return defaultValue;
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

export function storageSet<T>(key: string, value: T): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.error(`[Storage] Failed to write key "${key}":`, e);
  }
}

export function storageRemove(key: string): void {
  localStorage.removeItem(STORAGE_PREFIX + key);
}

export function storageKeys(): string[] {
  return Object.keys(localStorage)
    .filter((k) => k.startsWith(STORAGE_PREFIX))
    .map((k) => k.slice(STORAGE_PREFIX.length));
}

/**
 * Guarda datos cifrados (para información sensible).
 */
export async function secureSet<T>(key: string, value: T): Promise<void> {
  const plaintext = JSON.stringify(value);
  const encrypted = await encrypt(plaintext);
  localStorage.setItem(STORAGE_PREFIX + 'secure_' + key, encrypted);
}

/**
 * Lee datos cifrados.
 */
export async function secureGet<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const encrypted = localStorage.getItem(STORAGE_PREFIX + 'secure_' + key);
    if (!encrypted) return defaultValue;
    const plaintext = await decrypt(encrypted);
    return JSON.parse(plaintext) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * Exporta todos los datos como JSON para backup.
 */
export function exportAllData(): string {
  const data: Record<string, unknown> = {};
  for (const key of storageKeys()) {
    data[key] = storageGet(key, null);
  }
  return JSON.stringify(data, null, 2);
}

/**
 * Importa datos desde un backup JSON.
 */
export function importAllData(json: string): boolean {
  try {
    const data = JSON.parse(json) as Record<string, unknown>;
    for (const [key, value] of Object.entries(data)) {
      storageSet(key, value);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Verifica espacio disponible en localStorage (aprox).
 */
export function getStorageUsage(): { used: number; total: number; percent: number } {
  let used = 0;
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(STORAGE_PREFIX)) {
      used += (localStorage.getItem(key)?.length ?? 0) * 2; // UTF-16
    }
  }
  const total = 5 * 1024 * 1024; // 5MB típico
  return { used, total, percent: Math.round((used / total) * 100) };
}

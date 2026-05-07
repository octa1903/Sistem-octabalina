// ═══════════════════════════════════════════════════
// Baliña Ruedas — Capa de persistencia en Web Storage
//
// localStorage para datos no sensibles (preferencias, snapshots).
// sessionStorage para datos sensibles que no deben sobrevivir al cierre
// de la pestaña (tokens de sesión de cliente, PINs cacheados).
// ═══════════════════════════════════════════════════

const STORAGE_PREFIX = 'balina_';

// ─── localStorage ──────────────────────────────────

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

// ─── sessionStorage (para datos sensibles) ─────────

export function sessionGet<T>(key: string, defaultValue: T): T {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return defaultValue;
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

export function sessionSet<T>(key: string, value: T): void {
  try {
    sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.error(`[Session] Failed to write key "${key}":`, e);
  }
}

export function sessionRemove(key: string): void {
  sessionStorage.removeItem(STORAGE_PREFIX + key);
}

// ─── Backups ───────────────────────────────────────

export function exportAllData(): string {
  const data: Record<string, unknown> = {};
  for (const key of storageKeys()) {
    data[key] = storageGet(key, null);
  }
  return JSON.stringify(data, null, 2);
}

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

import { describe, it, expect } from 'vitest';
import { sha256, hashPin, verifyPin, isLegacyHash } from '../hash';

describe('hashPin / verifyPin', () => {
  it('produce un hash con formato versionado pbkdf2$iter$salt$hash', async () => {
    const h = await hashPin('1234');
    expect(h.startsWith('pbkdf2$300000$')).toBe(true);
    const parts = h.split('$');
    expect(parts).toHaveLength(4);
    expect(parts[2]).toMatch(/^[0-9a-f]{32}$/); // 16 bytes = 32 hex chars
    expect(parts[3]).toMatch(/^[0-9a-f]{64}$/); // 32 bytes = 64 hex chars
  });

  it('genera salt distinto en cada hash (no determinístico)', async () => {
    const a = await hashPin('1234');
    const b = await hashPin('1234');
    expect(a).not.toBe(b);
  });

  it('verifyPin acepta el PIN correcto', async () => {
    const h = await hashPin('4321');
    expect(await verifyPin('4321', h)).toBe(true);
  });

  it('verifyPin rechaza PIN incorrecto', async () => {
    const h = await hashPin('4321');
    expect(await verifyPin('4322', h)).toBe(false);
    expect(await verifyPin('', h)).toBe(false);
  });

  it('verifyPin acepta hash legacy SHA-256 hex (backward-compat)', async () => {
    // PIN "1234" → SHA-256 conocido (mismo que está en initialData.json)
    const legacy = await sha256('1234');
    expect(legacy).toBe('03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4');
    expect(await verifyPin('1234', legacy)).toBe(true);
    expect(await verifyPin('5678', legacy)).toBe(false);
  });

  it('verifyPin rechaza hashes mal formados sin tirar', async () => {
    expect(await verifyPin('1234', '')).toBe(false);
    expect(await verifyPin('1234', 'pbkdf2$abc')).toBe(false);
    expect(await verifyPin('1234', 'pbkdf2$300000$xx$yy')).toBe(false);
  });

  it('isLegacyHash distingue formatos', async () => {
    const legacy = await sha256('1234');
    const modern = await hashPin('1234');
    expect(isLegacyHash(legacy)).toBe(true);
    expect(isLegacyHash(modern)).toBe(false);
    expect(isLegacyHash('')).toBe(false);
  });
});

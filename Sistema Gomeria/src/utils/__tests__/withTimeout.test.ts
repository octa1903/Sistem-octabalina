import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { withTimeout, TimeoutError, DEFAULT_NETWORK_TIMEOUT_MS } from '../withTimeout';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('withTimeout', () => {
  test('resuelve con el valor si la promesa gana al timeout', async () => {
    const p = withTimeout(Promise.resolve(42), 1000);
    await expect(p).resolves.toBe(42);
  });

  test('rechaza con TimeoutError si la promesa tarda más que ms', async () => {
    const never = new Promise<number>(() => {});
    const p = withTimeout(never, 5000);
    const assertion = expect(p).rejects.toBeInstanceOf(TimeoutError);
    await vi.advanceTimersByTimeAsync(5001);
    await assertion;
  });

  test('propaga el rechazo original si la promesa falla antes del timeout', async () => {
    const failing = Promise.reject(new Error('boom'));
    const p = withTimeout(failing, 5000);
    await expect(p).rejects.toThrow('boom');
  });

  test('usa el mensaje custom en el TimeoutError', async () => {
    const never = new Promise<number>(() => {});
    const p = withTimeout(never, 1000, 'Sin conexión al servidor');
    const assertion = expect(p).rejects.toThrow('Sin conexión al servidor');
    await vi.advanceTimersByTimeAsync(1001);
    await assertion;
  });

  test('expone un timeout default razonable', () => {
    expect(DEFAULT_NETWORK_TIMEOUT_MS).toBeGreaterThan(0);
    expect(DEFAULT_NETWORK_TIMEOUT_MS).toBeLessThanOrEqual(30_000);
  });
});

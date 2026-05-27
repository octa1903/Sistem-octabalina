// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { offlineQueue } from '../offlineQueue';

beforeEach(() => {
  localStorage.clear();
  offlineQueue.clear();
});

describe('offlineQueue.enqueue', () => {
  it('agrega ops y las persiste a localStorage', () => {
    const id = offlineQueue.enqueue('receipt.create', { receiptNumber: 'R-001' });
    expect(id).toBeTruthy();
    expect(offlineQueue.size()).toBe(1);
    const list = offlineQueue.list();
    expect(list[0].kind).toBe('receipt.create');
    expect(list[0].payload).toEqual({ receiptNumber: 'R-001' });
    expect(list[0].attempts).toBe(0);
  });

  it('sobrevive a un read fresh (simulado por leer JSON desde localStorage)', () => {
    offlineQueue.enqueue('test.kind', { hello: 'world' });
    const raw = localStorage.getItem('octabalina.offlineQueue.v1');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].kind).toBe('test.kind');
  });
});

describe('offlineQueue.flush', () => {
  it('procesa ops con handler registrado', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    offlineQueue.registerHandler('test.process', handler);
    offlineQueue.enqueue('test.process', { x: 1 });
    offlineQueue.enqueue('test.process', { x: 2 });

    const result = await offlineQueue.flush();
    expect(result.processed).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.remaining).toBe(0);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('mantiene ops cuyo handler tiró error, con attempts++', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('boom'));
    offlineQueue.registerHandler('test.fail', handler);
    offlineQueue.enqueue('test.fail', { x: 1 });

    const r1 = await offlineQueue.flush();
    expect(r1.processed).toBe(0);
    expect(r1.failed).toBe(1);
    expect(r1.remaining).toBe(1);

    const list = offlineQueue.list();
    expect(list[0].attempts).toBe(1);
    expect(list[0].lastError).toBe('boom');

    const r2 = await offlineQueue.flush();
    expect(r2.failed).toBe(1);
    expect(offlineQueue.list()[0].attempts).toBe(2);
  });

  it('deja en cola ops sin handler registrado', async () => {
    offlineQueue.enqueue('unknown.kind', { x: 1 });
    const result = await offlineQueue.flush();
    expect(result.processed).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.remaining).toBe(1);
  });

  it('mezcla procesa exitosos y deja fallos', async () => {
    let count = 0;
    const handler = vi.fn().mockImplementation(async () => {
      count++;
      if (count % 2 === 0) throw new Error('par-falla');
    });
    offlineQueue.registerHandler('test.mix', handler);
    offlineQueue.enqueue('test.mix', { i: 1 });
    offlineQueue.enqueue('test.mix', { i: 2 });
    offlineQueue.enqueue('test.mix', { i: 3 });
    offlineQueue.enqueue('test.mix', { i: 4 });

    const result = await offlineQueue.flush();
    expect(result.processed).toBe(2); // i=1 y i=3
    expect(result.failed).toBe(2);    // i=2 y i=4
    expect(result.remaining).toBe(2);
  });
});

describe('offlineQueue.subscribe', () => {
  it('notifica a los listeners en enqueue y flush', async () => {
    const listener = vi.fn();
    const unsub = offlineQueue.subscribe(listener);

    offlineQueue.enqueue('test.notify', { x: 1 });
    expect(listener).toHaveBeenCalledTimes(1);

    offlineQueue.registerHandler('test.notify', () => Promise.resolve());
    await offlineQueue.flush();
    expect(listener).toHaveBeenCalledTimes(2);

    unsub();
    offlineQueue.enqueue('test.notify', { x: 2 });
    expect(listener).toHaveBeenCalledTimes(2); // no debería incrementar tras unsub
  });
});

describe('offlineQueue.remove / clear', () => {
  it('remove elimina por id', () => {
    const a = offlineQueue.enqueue('test.r', { v: 'a' });
    offlineQueue.enqueue('test.r', { v: 'b' });
    expect(offlineQueue.size()).toBe(2);
    offlineQueue.remove(a);
    expect(offlineQueue.size()).toBe(1);
    expect((offlineQueue.list()[0].payload as { v: string }).v).toBe('b');
  });

  it('clear vacía toda la cola', () => {
    offlineQueue.enqueue('test.c', {});
    offlineQueue.enqueue('test.c', {});
    expect(offlineQueue.size()).toBe(2);
    offlineQueue.clear();
    expect(offlineQueue.size()).toBe(0);
  });
});

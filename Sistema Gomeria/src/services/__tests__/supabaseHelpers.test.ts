import { describe, test, expect, vi, beforeEach } from 'vitest';
import { fetchAllPaginated } from '../supabaseHelpers';

// Mock console.error para que los tests negativos no llenen el output.
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

/**
 * Helper: crea un builder mock que devuelve N filas, paginando con .range().
 * Cada call a buildQuery() crea un builder nuevo (igual que el real, que se
 * "consume" en cada await).
 */
function makeMockSupabase(totalRows: number) {
  const allData = Array.from({ length: totalRows }, (_, i) => ({ id: i }));
  return () => ({
    range(from: number, to: number) {
      const batch = allData.slice(from, to + 1);
      return Promise.resolve({ data: batch, error: null });
    },
  });
}

describe('fetchAllPaginated', () => {
  test('tabla vacía → array vacío', async () => {
    const out = await fetchAllPaginated<{ id: number }>(makeMockSupabase(0), 'test.empty');
    expect(out).toEqual([]);
  });

  test('menos de 1000 filas → un solo batch', async () => {
    const out = await fetchAllPaginated<{ id: number }>(makeMockSupabase(50), 'test.small');
    expect(out).toHaveLength(50);
    expect(out[0]).toEqual({ id: 0 });
    expect(out[49]).toEqual({ id: 49 });
  });

  test('exactamente 1000 filas → dos batches (1000 + 0)', async () => {
    let buildCount = 0;
    const builder = makeMockSupabase(1000);
    const build = () => {
      buildCount++;
      return builder();
    };
    const out = await fetchAllPaginated<{ id: number }>(build, 'test.exact1000');
    expect(out).toHaveLength(1000);
    // El loop pide página 2 (vacía) para confirmar el final.
    expect(buildCount).toBe(2);
  });

  test('2500 filas → 3 batches (1000+1000+500)', async () => {
    const out = await fetchAllPaginated<{ id: number }>(makeMockSupabase(2500), 'test.large');
    expect(out).toHaveLength(2500);
    expect(out[0]).toEqual({ id: 0 });
    expect(out[2499]).toEqual({ id: 2499 });
  });

  test('error de Supabase → throw con contexto', async () => {
    const buildErr = () => ({
      range: () => Promise.resolve({
        data: null,
        error: { code: '42P01', message: 'relation does not exist', hint: '' },
      }),
    });
    await expect(fetchAllPaginated(buildErr, 'tires.list'))
      .rejects.toThrow('tires.list: relation does not exist');
  });

  test('data: null sin error → trata como batch vacío y termina', async () => {
    const buildNull = () => ({
      range: () => Promise.resolve({ data: null, error: null }),
    });
    const out = await fetchAllPaginated(buildNull, 'test.null');
    expect(out).toEqual([]);
  });
});

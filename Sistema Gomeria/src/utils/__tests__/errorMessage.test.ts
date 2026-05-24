import { describe, test, expect } from 'vitest';
import { describeError } from '../errorMessage';

describe('describeError', () => {
  test('Error nativo → e.message', () => {
    expect(describeError(new Error('boom'))).toBe('boom');
  });

  test('PostgrestError completo → "[code] message (details) hint: ..."', () => {
    const pgErr = {
      code: '23505',
      message: 'duplicate key value',
      details: 'Key (name)=(Auto) already exists',
      hint: 'Use ON CONFLICT',
    };
    expect(describeError(pgErr)).toBe(
      '[23505] duplicate key value (Key (name)=(Auto) already exists) hint: Use ON CONFLICT',
    );
  });

  test('PostgrestError mínimo (solo code+message)', () => {
    expect(describeError({ code: '42P01', message: 'relation does not exist' }))
      .toBe('[42P01] relation does not exist');
  });

  test('objeto sin campos conocidos → JSON.stringify', () => {
    expect(describeError({ foo: 'bar' })).toBe('{"foo":"bar"}');
  });

  test('string crudo → string', () => {
    expect(describeError('error literal')).toBe('error literal');
  });

  test('null/undefined → "Error desconocido"', () => {
    expect(describeError(null)).toBe('Error desconocido');
    expect(describeError(undefined)).toBe('Error desconocido');
  });

  test('número → "Error desconocido" (no es string ni objeto útil)', () => {
    expect(describeError(42)).toBe('Error desconocido');
  });

  test('objeto con referencia circular no rompe', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    // Sin code/message/details/hint cae al JSON.stringify, que tira en circular → catch
    expect(describeError(circular)).toBe('Error desconocido');
  });
});

import { describe, test, expect } from 'vitest';
import { validateTireRows, validateCustomerRows } from '../importService';
import type { Category } from '@/types';

const cats: Category[] = [
  { id: 'c-auto', name: 'Auto', color: '#000', sortOrder: 0 },
  { id: 'c-camio', name: 'Camioneta', color: '#000', sortOrder: 1 },
];

describe('validateTireRows', () => {
  test('parsea fila válida con aliases en español', () => {
    const rows = [
      { Marca: 'Pirelli', Modelo: 'P1', Medida: '175/70 R13', Categoría: 'Auto', Costo: 40000, Precio: 60000, Stock: 10, Mínimo: 2 },
    ];
    const out = validateTireRows(rows, cats);
    expect(out).toHaveLength(1);
    expect(out[0].error).toBeUndefined();
    expect(out[0].parsed).toMatchObject({
      brand: 'Pirelli',
      model: 'P1',
      size: '175/70 R13',
      categoryName: 'Auto',
      cost: 40000,
      price: 60000,
      stock: 10,
      lowStockThreshold: 2,
    });
  });

  test('costo presente sin ningún dígito → error de fila (no 0 silencioso)', () => {
    const rows = [
      { Marca: 'Pirelli', Modelo: 'P1', Medida: '175 R13', Categoría: 'Auto', Costo: 'N/A', Precio: 60000, Stock: 5 },
    ];
    const out = validateTireRows(rows, cats);
    expect(out[0].parsed).toBeUndefined();
    expect(out[0].error).toMatch(/costo/i);
  });

  test('número negativo → error de fila', () => {
    const rows = [
      { Marca: 'Pirelli', Modelo: 'P1', Medida: '175 R13', Categoría: 'Auto', Costo: 40000, Precio: 60000, Stock: -3 },
    ];
    const out = validateTireRows(rows, cats);
    expect(out[0].parsed).toBeUndefined();
    expect(out[0].error).toMatch(/stock/i);
  });

  test('costo ausente usa default 0 sin marcar error', () => {
    const rows = [
      { Marca: 'Pirelli', Modelo: 'P1', Medida: '175 R13', Categoría: 'Auto', Precio: 60000, Stock: 5 },
    ];
    const out = validateTireRows(rows, cats);
    expect(out[0].error).toBeUndefined();
    expect(out[0].parsed?.cost).toBe(0);
  });

  test('formato es-AR de miles "50.000" se parsea como 50000', () => {
    const rows = [
      { Marca: 'Pirelli', Modelo: 'P1', Medida: '175 R13', Categoría: 'Auto', Costo: '50.000', Precio: '80.000', Stock: 4 },
    ];
    const out = validateTireRows(rows, cats);
    expect(out[0].error).toBeUndefined();
    expect(out[0].parsed?.cost).toBe(50000);
    expect(out[0].parsed?.price).toBe(80000);
  });

  test('acepta headers en inglés', () => {
    const rows = [{ brand: 'Bridgestone', model: 'B250', size: '185/65 R14', category: 'Auto', cost: 1, price: 2, stock: 5 }];
    const out = validateTireRows(rows, cats);
    expect(out[0].error).toBeUndefined();
    expect(out[0].parsed?.brand).toBe('Bridgestone');
  });

  test('parsea números con separador de miles y coma decimal (formato AR)', () => {
    const rows = [{ Marca: 'X', Modelo: 'Y', Medida: 'Z', Categoría: 'Auto', Costo: '1.234,56', Precio: '99.999,00', Stock: '10' }];
    const out = validateTireRows(rows, cats);
    expect(out[0].parsed?.cost).toBeCloseTo(1234.56, 2);
    expect(out[0].parsed?.price).toBeCloseTo(99999, 2);
    expect(out[0].parsed?.stock).toBe(10);
  });

  test('lowStockThreshold por defecto = 2', () => {
    const rows = [{ Marca: 'X', Modelo: 'Y', Medida: 'Z', Categoría: 'Auto', Costo: 1, Precio: 2, Stock: 0 }];
    const out = validateTireRows(rows, cats);
    expect(out[0].parsed?.lowStockThreshold).toBe(2);
  });

  test('falta marca/modelo/medida → error', () => {
    const rows = [
      { Marca: '', Modelo: 'Y', Medida: 'Z', Categoría: 'Auto', Costo: 1, Precio: 2, Stock: 0 },
      { Marca: 'X', Modelo: '', Medida: 'Z', Categoría: 'Auto', Costo: 1, Precio: 2, Stock: 0 },
      { Marca: 'X', Modelo: 'Y', Medida: '', Categoría: 'Auto', Costo: 1, Precio: 2, Stock: 0 },
    ];
    const out = validateTireRows(rows, cats);
    expect(out.every(r => r.error)).toBe(true);
    expect(out.every(r => r.parsed === undefined)).toBe(true);
  });

  test('categoría desconocida → error con mensaje claro', () => {
    const rows = [{ Marca: 'X', Modelo: 'Y', Medida: 'Z', Categoría: 'Tractor', Costo: 1, Precio: 2, Stock: 0 }];
    const out = validateTireRows(rows, cats);
    expect(out[0].error).toMatch(/Tractor/);
    expect(out[0].error).toMatch(/no existe/);
  });

  test('matchea categoría case-insensitive y con acentos', () => {
    const rows = [{ Marca: 'X', Modelo: 'Y', Medida: 'Z', Categoría: 'CAMIONETA', Costo: 1, Precio: 2, Stock: 0 }];
    const out = validateTireRows(rows, cats);
    expect(out[0].error).toBeUndefined();
    expect(out[0].parsed?.categoryName).toBe('CAMIONETA');
  });

  test('preserva el rowIndex y el raw original', () => {
    const rows = [
      { Marca: 'A', Modelo: 'B', Medida: 'C', Categoría: 'Auto', Costo: 1, Precio: 2, Stock: 0 },
      { Marca: '', Modelo: 'B', Medida: 'C', Categoría: 'Auto', Costo: 1, Precio: 2, Stock: 0 },
    ];
    const out = validateTireRows(rows, cats);
    expect(out[0].rowIndex).toBe(0);
    expect(out[1].rowIndex).toBe(1);
    expect(out[1].raw).toBe(rows[1]);
  });

  test('valor vacío en stock se interpreta como 0 (no rompe)', () => {
    const rows = [{ Marca: 'X', Modelo: 'Y', Medida: 'Z', Categoría: 'Auto', Costo: 1, Precio: 2, Stock: '' }];
    const out = validateTireRows(rows, cats);
    expect(out[0].error).toBeUndefined();
    expect(out[0].parsed?.stock).toBe(0);
  });
});

describe('validateCustomerRows', () => {
  test('parsea fila mínima (solo nombre)', () => {
    const rows = [{ Nombre: 'Juan Pérez' }];
    const out = validateCustomerRows(rows);
    expect(out[0].error).toBeUndefined();
    expect(out[0].parsed).toMatchObject({
      name: 'Juan Pérez',
      customerType: 'retail',
      creditLimit: 0,
    });
  });

  test('falta nombre → error', () => {
    const rows = [{ Teléfono: '223-555-0001' }];
    const out = validateCustomerRows(rows);
    expect(out[0].error).toMatch(/nombre/i);
  });

  test('mapea tipo "mayorista" → customerType="wholesale"', () => {
    const rows = [{ Nombre: 'Comercial SA', Tipo: 'mayorista' }];
    const out = validateCustomerRows(rows);
    expect(out[0].parsed?.customerType).toBe('wholesale');
  });

  test('cualquier otro tipo → retail por defecto', () => {
    const rows = [
      { Nombre: 'A', Tipo: 'minorista' },
      { Nombre: 'B', Tipo: '' },
      { Nombre: 'C', Tipo: 'particular' },
    ];
    const out = validateCustomerRows(rows);
    expect(out.every(r => r.parsed?.customerType === 'retail')).toBe(true);
  });

  test('campos opcionales se preservan o quedan undefined', () => {
    const rows = [{
      Nombre: 'A',
      Teléfono: '223',
      Email: 'a@b.com',
      Dirección: 'X 123',
      Cupo: '50.000',
      PIN: '1234',
    }];
    const out = validateCustomerRows(rows);
    expect(out[0].parsed).toMatchObject({
      phone: '223',
      email: 'a@b.com',
      address: 'X 123',
      creditLimit: 50000,
      pin: '1234',
    });
  });

  test('headers en inglés también funcionan', () => {
    const rows = [{ name: 'Bob', email: 'b@b.com', type: 'wholesale', 'credit limit': '10000' }];
    const out = validateCustomerRows(rows);
    expect(out[0].error).toBeUndefined();
    expect(out[0].parsed?.name).toBe('Bob');
    expect(out[0].parsed?.customerType).toBe('wholesale');
    expect(out[0].parsed?.creditLimit).toBe(10000);
  });

  test('preserva rowIndex y raw', () => {
    const rows = [{ Nombre: 'A' }, { Nombre: '' }, { Nombre: 'B' }];
    const out = validateCustomerRows(rows);
    expect(out[0].rowIndex).toBe(0);
    expect(out[1].rowIndex).toBe(1);
    expect(out[1].error).toBeDefined();
    expect(out[2].rowIndex).toBe(2);
    expect(out[2].error).toBeUndefined();
  });
});

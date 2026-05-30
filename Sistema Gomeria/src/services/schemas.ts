// ═══════════════════════════════════════════════════
// schemas — schemas Zod para los bordes críticos (forma camelCase de dominio)
// ═══════════════════════════════════════════════════
//
// Validan el row YA camelizado (salida de rowToCamel), no el row crudo de
// Postgres. Por eso las claves son camelCase y matchean los tipos de
// `types/index.ts`. Ver `validation.ts` para la estrategia lenient.
//
// Reglas de diseño (lenient, anti falso-positivo sobre data legacy):
//  - IDs/claves: z.string() pelado (los legacy no siempre son UUID canónico).
//  - Montos: z.number() — atrapa strings/null que romperían cálculos aguas abajo.
//  - status/type: unión literal con `.catch(default)` → un valor corrupto NO
//    descarta el row entero, degrada a un default seguro y visible.
//  - jsonb anidado (payments, descuentos, splits): z.array(z.unknown()) — no
//    validamos en profundidad para no descartar tickets por basura interna;
//    la UI ya recorre estos arrays defensivamente.
//  - `.loose()` en validateRow/Rows: props extra (columnas nuevas) pasan intactas.

import { z } from 'zod';

// ─── Tires ────────────────────────────────────────────────────────────

export const tireSchema = z
  .object({
    id: z.string(),
    brand: z.string(),
    model: z.string(),
    size: z.string(),
    categoryId: z.string(),
    cost: z.number(),
    defaultPrice: z.number(),
    defaultMargin: z.number(),
    availableInAllStores: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .loose();

export const tireOverrideSchema = z
  .object({
    tireId: z.string(),
    storeId: z.string(),
    available: z.boolean(),
    price: z.number(),
    stock: z.number(),
    lowStockThreshold: z.number(),
  })
  .loose();

// ─── Customers ────────────────────────────────────────────────────────

export const customerSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    totalVisits: z.number(),
    totalSpent: z.number(),
    pointsBalance: z.number(),
    creditLimit: z.number(),
    accountBalance: z.number(),
    customerType: z
      .enum(['retail', 'wholesale', 'insured'])
      .catch('retail'),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .loose();

// ─── Cash sessions ────────────────────────────────────────────────────

export const cashSessionSchema = z
  .object({
    id: z.string(),
    storeId: z.string(),
    openedAt: z.string(),
    openedByEmployeeId: z.string(),
    openingFloat: z.number(),
    status: z.enum(['open', 'closed']).catch('closed'),
  })
  .loose();

// ─── Receipts ─────────────────────────────────────────────────────────

export const receiptSchema = z
  .object({
    id: z.string(),
    receiptNumber: z.string(),
    storeId: z.string(),
    cashSessionId: z.string(),
    employeeId: z.string(),
    type: z.enum(['sale', 'refund']).catch('sale'),
    status: z.enum(['completed', 'parked']).catch('completed'),
    // jsonb arrays — no validamos en profundidad (ver cabecera)
    appliedDiscounts: z.array(z.unknown()),
    appliedTaxes: z.array(z.unknown()),
    payments: z.array(z.unknown()),
    subtotalGross: z.number(),
    totalDiscounts: z.number(),
    subtotalNet: z.number(),
    totalTaxes: z.number(),
    total: z.number(),
    createdAt: z.string(),
  })
  .loose();

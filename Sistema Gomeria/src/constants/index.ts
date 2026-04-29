// ═══════════════════════════════════════════════════
// Baliña Ruedas — Constantes
// ═══════════════════════════════════════════════════

import type { OrderConfig, WholesaleConfig } from '@/types';

// ─── Auth ───────────────────────────────────────────
/** Hash SHA-256 de la contraseña de empleado por defecto */
export const EMPLOYEE_HASH_DEFAULT =
  'f115e91ac5f0482b3553cd14532efdb48f1d42df16787c3f0710f30483484886';
export const EMPLOYEE_TIMEOUT = 30 * 60 * 1000; // 30 min
export const CLIENT_TIMEOUT = 60 * 60 * 1000; // 60 min
export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 min
export const DEFAULT_PIN_HASH =
  '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4'; // '1234'

// ─── Payment Methods ────────────────────────────────
export const PAYMENT_METHODS = [
  { id: 'efectivo', label: 'Efectivo', surcharge: 0 },
  { id: 'debito', label: 'Débito', surcharge: 0 },
  { id: 'credito_1', label: 'Crédito 1 cuota', surcharge: 0 },
  { id: 'credito_3', label: 'Crédito 3 cuotas', surcharge: 15 },
  { id: 'credito_6', label: 'Crédito 6 cuotas', surcharge: 25 },
  { id: 'credito_12', label: 'Crédito 12 cuotas', surcharge: 40 },
  { id: 'transferencia', label: 'Transferencia', surcharge: 0 },
  { id: 'cuenta_corriente', label: 'Cuenta Corriente', surcharge: 0 },
] as const;

export type PaymentMethodId = (typeof PAYMENT_METHODS)[number]['id'];

// ─── Order Status ───────────────────────────────────
export const STATUS_COLORS: Record<string, string> = {
  pendiente: 'bg-gray-100 text-gray-700 border-gray-300',
  confirmado: 'bg-blue-100 text-blue-700 border-blue-300',
  en_preparacion: 'bg-amber-100 text-amber-700 border-amber-300',
  listo: 'bg-green-100 text-green-700 border-green-300',
  entregado: 'bg-emerald-200 text-emerald-800 border-emerald-400',
  cancelado: 'bg-red-100 text-red-700 border-red-300',
};

export const STATUS_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  en_preparacion: 'En Preparación',
  listo: 'Listo',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

export const STATUS_FLOW: Record<string, string[]> = {
  pendiente: ['confirmado', 'cancelado'],
  confirmado: ['en_preparacion', 'cancelado'],
  en_preparacion: ['listo', 'cancelado'],
  listo: ['entregado', 'cancelado'],
  entregado: [],
  cancelado: [],
};

// ─── Default Configs ────────────────────────────────
export const DEFAULT_ORDER_CONFIG: OrderConfig = {
  enabled: true,
  workDays: [false, true, true, true, true, true, true], // Mon-Sat
  blockedDates: [],
  minDaysAhead: 1,
  maxDaysAhead: 30,
  timeSlots: ['Mañana 09:00-12:00', 'Tarde 14:00-18:00', 'A coordinar'],
  maxOrdersPerDay: 10,
};

export const DEFAULT_WHOLESALE_CONFIG: WholesaleConfig = {
  globalDiscount: 10,
  minUnitsPerItem: 4,
  minOrderAmount: 0,
};

// ─── Categories ─────────────────────────────────────
export const TIRE_CATEGORIES = [
  'Auto',
  'SUV',
  'Camioneta',
  'Camión',
  'Moto',
  'Agrícola',
  'Industrial',
] as const;

// ─── Invoice Types ──────────────────────────────────
export const INVOICE_TYPES = ['A', 'B', 'C', 'X'] as const;

// ─── Currency ───────────────────────────────────────
export const CURRENCY_LOCALE = 'es-AR';
export const CURRENCY_CODE = 'ARS';

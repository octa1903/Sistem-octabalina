// ═══════════════════════════════════════════════════
// Baliña Ruedas — Validación de inputs
// ═══════════════════════════════════════════════════

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPhone(phone: string): boolean {
  return /^[\d\s\-+()]{7,20}$/.test(phone);
}

export function isValidPin(pin: string): boolean {
  return /^\d{4,8}$/.test(pin);
}

export function isPositiveNumber(value: number): boolean {
  return !isNaN(value) && value > 0;
}

export function isNonNegativeNumber(value: number): boolean {
  return !isNaN(value) && value >= 0;
}

export function isNonEmptyString(value: string): boolean {
  return value.trim().length > 0;
}

export function isValidStock(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

export function sanitizeInput(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
}

export interface ValidationError {
  field: string;
  message: string;
}

export function validateTire(data: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!isNonEmptyString(data.brand as string)) errors.push({ field: 'brand', message: 'La marca es requerida' });
  if (!isNonEmptyString(data.model as string)) errors.push({ field: 'model', message: 'El modelo es requerido' });
  if (!isNonEmptyString(data.size as string)) errors.push({ field: 'size', message: 'La medida es requerida' });
  if (!isPositiveNumber(data.costPrice as number)) errors.push({ field: 'costPrice', message: 'El costo debe ser mayor a 0' });
  if (!isNonNegativeNumber(data.margin as number)) errors.push({ field: 'margin', message: 'El margen no puede ser negativo' });
  if (!isValidStock(data.stock as number)) errors.push({ field: 'stock', message: 'Stock inválido' });
  return errors;
}

export function validateClient(data: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!isNonEmptyString(data.name as string)) errors.push({ field: 'name', message: 'El nombre es requerido' });
  if (data.email && !isValidEmail(data.email as string)) errors.push({ field: 'email', message: 'Email inválido' });
  if (data.phone && !isValidPhone(data.phone as string)) errors.push({ field: 'phone', message: 'Teléfono inválido' });
  return errors;
}

// ═══════════════════════════════════════════════════
// Baliña Ruedas — Utilidades de moneda (ARS)
// ═══════════════════════════════════════════════════

const formatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatCurrency(amount: number): string {
  return formatter.format(amount);
}

export function formatDecimal(value: number, decimals = 2): string {
  return value.toLocaleString('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function calculateMargin(cost: number, salePrice: number): number {
  if (cost === 0) return 0;
  return Math.round(((salePrice - cost) / cost) * 100);
}

export function calculateSalePrice(cost: number, marginPercent: number): number {
  return Math.round(cost * (1 + marginPercent / 100));
}

export function applySurcharge(amount: number, surchargePercent: number): number {
  return Math.round(amount * (1 + surchargePercent / 100));
}

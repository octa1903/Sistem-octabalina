import type {
  Receipt, ReceiptLine, Store, ReceiptConfig, PaymentMethod, Tax, Customer,
} from '@/types';
import { formatCurrency } from './currency';

export interface PrintReceiptInput {
  receipt: Receipt;
  lines: ReceiptLine[];
  store: Store;
  config?: ReceiptConfig | null;
  paymentMethods: PaymentMethod[];
  taxes: Tax[];
  customer?: Customer | null;
  employeeName?: string;
}

function escapeHtml(s: string | undefined | null): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function addrLine(address: unknown): string {
  if (!address || typeof address !== 'object') return '';
  const a = address as Record<string, string>;
  return [a.street, a.city, a.region].filter(Boolean).join(', ');
}

export function buildReceiptHtml(input: PrintReceiptInput): string {
  const { receipt, lines, store, config, paymentMethods, taxes, customer, employeeName } = input;

  const pmById = new Map(paymentMethods.map(p => [p.id, p]));
  const taxById = new Map(taxes.map(t => [t.id, t]));

  const linesHtml = lines.map(l => {
    const desc = `${l.tireBrand} ${l.tireModel} ${l.tireSize}`.trim();
    return `
      <tr>
        <td class="qty">${l.quantity}</td>
        <td class="desc">${escapeHtml(desc)}</td>
        <td class="price">${formatCurrency(l.unitPrice)}</td>
        <td class="amount">${formatCurrency(l.total)}</td>
      </tr>
    `;
  }).join('');

  const taxRows = (receipt.appliedTaxes ?? []).map(at => {
    const t = taxById.get(at.taxId);
    if (!t) return '';
    const label = t.inclusion === 'included' ? `${t.name} (incluido)` : t.name;
    return `<tr><td>${escapeHtml(label)}</td><td class="amount">${formatCurrency(at.amount)}</td></tr>`;
  }).join('');

  const paymentsRows = (receipt.payments ?? []).map(p => {
    const pm = pmById.get(p.paymentMethodId);
    return `<tr><td>${escapeHtml(pm?.name ?? 'Pago')}</td><td class="amount">${formatCurrency(p.amount)}</td></tr>`;
  }).join('');

  const headerLines = (config?.header ?? '').split('\n').filter(Boolean).map(escapeHtml).join('<br>');
  const footerLines = (config?.footer ?? '¡Gracias por su compra!').split('\n').filter(Boolean).map(escapeHtml).join('<br>');
  const showCustomer = (config?.showCustomerInfo ?? true) && customer;

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Recibo ${escapeHtml(receipt.receiptNumber)}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 12px;
    line-height: 1.4;
    color: #000;
    background: #fff;
    padding: 16px;
  }
  .ticket { max-width: 320px; margin: 0 auto; }
  .center { text-align: center; }
  .right { text-align: right; }
  .bold { font-weight: 700; }
  .big { font-size: 16px; }
  .sep { border-top: 1px dashed #000; margin: 8px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 1px 0; vertical-align: top; }
  .qty { width: 8%; }
  .desc { width: 52%; word-break: break-word; }
  .price { width: 18%; text-align: right; }
  .amount { width: 22%; text-align: right; }
  .small { font-size: 10px; color: #444; }
  .footer { margin-top: 12px; text-align: center; font-size: 11px; }
  .logo { display: block; max-width: 60mm; max-height: 24mm; margin: 0 auto 6px; object-fit: contain; }
  @media print {
    body { padding: 0; }
    .no-print { display: none; }
    @page { size: 80mm auto; margin: 4mm; }
  }
  .toolbar {
    position: fixed; top: 8px; right: 8px;
    display: flex; gap: 8px;
  }
  .toolbar button {
    padding: 6px 12px; border: 1px solid #888;
    background: #f5f5f5; cursor: pointer; font-size: 11px;
    border-radius: 4px;
  }
  .toolbar button:hover { background: #e5e5e5; }
</style>
</head>
<body>
<div class="toolbar no-print">
  <button onclick="window.print()">Imprimir</button>
  <button onclick="window.close()">Cerrar</button>
</div>
<div class="ticket">
  ${config?.printedLogoUrl ? `<img class="logo" src="${escapeHtml(config.printedLogoUrl)}" alt="${escapeHtml(store.name)}">` : ''}
  <div class="center bold big">${escapeHtml(store.name)}</div>
  <div class="center small">${escapeHtml(addrLine(store.address))}</div>
  ${store.phone ? `<div class="center small">Tel: ${escapeHtml(store.phone)}</div>` : ''}
  ${headerLines ? `<div class="center small" style="margin-top:6px">${headerLines}</div>` : ''}

  <div class="sep"></div>

  <div><span class="bold">Recibo:</span> ${escapeHtml(receipt.receiptNumber)}</div>
  <div><span class="bold">Fecha:</span> ${escapeHtml(fmtDate(receipt.createdAt))}</div>
  ${employeeName ? `<div><span class="bold">Cajero:</span> ${escapeHtml(employeeName)}</div>` : ''}
  ${showCustomer ? `<div><span class="bold">Cliente:</span> ${escapeHtml(customer!.name)}</div>` : ''}

  <div class="sep"></div>

  <table>
    <tr class="bold small">
      <td class="qty">Cant</td>
      <td class="desc">Descripción</td>
      <td class="price">P.Unit</td>
      <td class="amount">Total</td>
    </tr>
    ${linesHtml}
  </table>

  <div class="sep"></div>

  <table>
    <tr><td>Subtotal</td><td class="amount">${formatCurrency(receipt.subtotalGross)}</td></tr>
    ${receipt.totalDiscounts > 0 ? `<tr><td>Descuentos</td><td class="amount">-${formatCurrency(receipt.totalDiscounts)}</td></tr>` : ''}
    ${taxRows}
  </table>

  <div class="sep"></div>

  <table>
    <tr class="bold big">
      <td>TOTAL</td>
      <td class="amount">${formatCurrency(Math.abs(receipt.total))}${receipt.type === 'refund' ? ' (DEV)' : ''}</td>
    </tr>
  </table>

  ${paymentsRows ? `<div class="sep"></div><table>${paymentsRows}</table>` : ''}

  ${receipt.pointsEarned > 0 ? `<div class="small" style="margin-top:6px">Puntos ganados: ${receipt.pointsEarned}</div>` : ''}

  <div class="footer">${footerLines}</div>
  <div class="footer small">${escapeHtml(receipt.receiptNumber)}</div>
</div>
<script>
  // Auto-abrir el diálogo de impresión cuando carga
  window.addEventListener('load', () => setTimeout(() => window.print(), 250));
</script>
</body>
</html>`;
}

export function printReceipt(input: PrintReceiptInput): void {
  const html = buildReceiptHtml(input);
  const w = window.open('', '_blank', 'width=420,height=720');
  if (!w) {
    // Popup blocker — fallback: abrir blob URL
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

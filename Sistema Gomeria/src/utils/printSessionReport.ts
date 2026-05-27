import type { SessionReport } from '@/services/sessionReportServiceV2';
import { formatCurrency } from './currency';

function escapeHtml(s: string | undefined | null): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtDateOnly(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Construye el HTML imprimible 80mm para un reporte X o Z de sesión de caja.
 * Mismo estilo que printReceipt (font monospace, ticket centrado, dashed
 * separators), formato técnico contable para que el dueño lo archive.
 */
export function buildSessionReportHtml(report: SessionReport): string {
  const { session, store, payments, totals, counts, movements, report_kind, generated_at } = report;
  const fi = store.fiscal_identity ?? {};

  const paymentsRows = payments
    .map((p) => {
      const net = p.net_amount;
      const sign = net < 0 ? '-' : '';
      return `
        <tr>
          <td>${escapeHtml(p.method_name)}</td>
          <td class="qty">${p.sale_count}</td>
          <td class="amount">${sign}${formatCurrency(Math.abs(net))}</td>
        </tr>
      `;
    })
    .join('');

  const movementsRows = movements
    .map((m) => {
      const sign = m.type === 'pay_out' ? '-' : '+';
      return `
        <tr>
          <td class="small">${escapeHtml(fmtDateTime(m.at))}</td>
          <td class="small">${escapeHtml(m.reason)}</td>
          <td class="amount">${sign}${formatCurrency(m.amount)}</td>
        </tr>
      `;
    })
    .join('');

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Reporte ${report_kind} — ${escapeHtml(store.name)}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 12px; line-height: 1.4; color: #000; background: #fff;
    padding: 16px;
  }
  .ticket { max-width: 320px; margin: 0 auto; }
  .center { text-align: center; }
  .right { text-align: right; }
  .bold { font-weight: 700; }
  .big { font-size: 16px; }
  .huge { font-size: 22px; }
  .sep { border-top: 1px dashed #000; margin: 8px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 1px 0; vertical-align: top; }
  .qty { width: 18%; text-align: right; }
  .amount { width: 30%; text-align: right; }
  .small { font-size: 10px; color: #444; }
  .kind-badge {
    display: inline-block; padding: 2px 8px; border: 2px solid #000;
    font-weight: 700; font-size: 14px;
  }
  .footer { margin-top: 12px; text-align: center; font-size: 11px; }
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
  <div class="center bold big">${escapeHtml(store.name)}</div>
  ${fi.razonSocial ? `<div class="center small">${escapeHtml(fi.razonSocial)}</div>` : ''}
  ${fi.cuit ? `<div class="center small">CUIT ${escapeHtml(fi.cuit)}</div>` : ''}
  ${fi.dirTel ? `<div class="center small">${escapeHtml(fi.dirTel)}</div>` : ''}

  <div class="sep"></div>

  <div class="center">
    <span class="kind-badge">REPORTE ${report_kind}</span>
  </div>
  <div class="center small" style="margin-top:4px">
    ${report_kind === 'Z' ? 'Cierre definitivo de caja' : 'Previa — caja abierta'}
  </div>

  <div class="sep"></div>

  <table>
    <tr><td>Apertura</td><td class="amount">${escapeHtml(fmtDateTime(session.opened_at))}</td></tr>
    <tr><td>Abrió</td><td class="amount">${escapeHtml(session.opened_by.name)}</td></tr>
    ${session.closed_at ? `<tr><td>Cierre</td><td class="amount">${escapeHtml(fmtDateTime(session.closed_at))}</td></tr>` : ''}
    ${session.closed_by ? `<tr><td>Cerró</td><td class="amount">${escapeHtml(session.closed_by.name)}</td></tr>` : ''}
    <tr><td>Generado</td><td class="amount">${escapeHtml(fmtDateTime(generated_at))}</td></tr>
  </table>

  <div class="sep"></div>

  <div class="bold">Ventas por método de pago</div>
  ${
    payments.length === 0
      ? '<div class="small" style="margin-top:4px">— Sin ventas en esta sesión —</div>'
      : `<table style="margin-top:4px">
          <tr class="small bold"><td>Método</td><td class="qty">Tickets</td><td class="amount">Neto</td></tr>
          ${paymentsRows}
        </table>`
  }

  <div class="sep"></div>

  <div class="bold">Totales</div>
  <table style="margin-top:4px">
    <tr><td>Tickets venta</td><td class="amount">${counts.sale_count}</td></tr>
    ${counts.refund_count > 0 ? `<tr><td>Tickets devolución</td><td class="amount">${counts.refund_count}</td></tr>` : ''}
    ${counts.parked_count > 0 ? `<tr><td>Tickets en espera</td><td class="amount">${counts.parked_count}</td></tr>` : ''}
    <tr><td>Subtotal bruto</td><td class="amount">${formatCurrency(totals.subtotal_gross)}</td></tr>
    ${totals.total_discounts > 0 ? `<tr><td>Descuentos</td><td class="amount">-${formatCurrency(totals.total_discounts)}</td></tr>` : ''}
    ${totals.total_taxes !== 0 ? `<tr><td>Impuestos</td><td class="amount">${formatCurrency(totals.total_taxes)}</td></tr>` : ''}
  </table>

  <div class="sep"></div>

  <table>
    <tr class="bold big"><td>TOTAL NETO</td><td class="amount">${formatCurrency(totals.total)}</td></tr>
  </table>

  ${
    movements.length > 0
      ? `
    <div class="sep"></div>
    <div class="bold">Movimientos de caja</div>
    <table style="margin-top:4px">${movementsRows}</table>
  `
      : ''
  }

  <div class="sep"></div>

  <div class="bold">Caja efectivo</div>
  <table style="margin-top:4px">
    <tr><td>Fondo inicial</td><td class="amount">${formatCurrency(session.opening_float)}</td></tr>
    ${
      session.expected_cash !== null
        ? `<tr><td>Esperado</td><td class="amount">${formatCurrency(session.expected_cash)}</td></tr>`
        : ''
    }
    ${
      session.counted_cash !== null
        ? `<tr><td>Contado</td><td class="amount">${formatCurrency(session.counted_cash)}</td></tr>`
        : ''
    }
    ${
      session.variance !== null
        ? `<tr class="bold"><td>Descuadre</td><td class="amount">${session.variance > 0 ? '+' : ''}${formatCurrency(session.variance)}</td></tr>`
        : ''
    }
  </table>

  ${session.notes ? `<div class="sep"></div><div class="small"><b>Notas:</b> ${escapeHtml(session.notes)}</div>` : ''}

  <div class="footer small">
    ${report_kind === 'Z' ? `Z #${escapeHtml(session.id.slice(0, 8))}` : `X — ${fmtDateOnly(generated_at)}`}
  </div>
</div>
<script>
  window.addEventListener('load', () => setTimeout(() => window.print(), 250));
</script>
</body>
</html>`;
}

export function printSessionReport(report: SessionReport): void {
  const html = buildSessionReportHtml(report);
  const w = window.open('', '_blank', 'width=420,height=720');
  if (!w) {
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

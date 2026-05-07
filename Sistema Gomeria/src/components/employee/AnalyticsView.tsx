// ═══════════════════════════════════════════════════
// AnalyticsView — Back-office de informes Loyverse (Fase 4).
// Filtros estándar (rango fecha, tienda, empleado) + 9 sub-vistas.
// Toda la agregación pasa por funciones SQL `report_*` (0004_reports.sql).
// ═══════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Store, Employee } from '@/types';
import { storeService } from '@/services/storeService';
import { employeeService } from '@/services/employeeService';
import {
  reportService,
  type ReportFilters,
  type SalesSummary,
  type SalesByItem,
  type SalesByCategory,
  type SalesByEmployee,
  type SalesByPayment,
  type SalesByTax,
  type DiscountReportRow,
  type ReceiptReportRow,
  type CashSessionReportRow,
} from '@/services/reportService';
import { formatCurrency } from '@/utils/currency';
import {
  rangeForPreset,
  dateInputToIso,
  isoToDateInput,
  rowsToCsv,
  downloadCsv,
  type CsvColumn,
  type PeriodPreset,
} from '@/utils/reports';
import { Download, Calendar, RefreshCw, BarChart2 } from 'lucide-react';
import { Button, Input, Select, EmptyState } from '@/components/ui';

interface Props {
  storeId: string;
}

type ReportTab =
  | 'summary'
  | 'items'
  | 'categories'
  | 'employees'
  | 'payments'
  | 'receipts'
  | 'discounts'
  | 'taxes'
  | 'cash';

const TABS: { id: ReportTab; label: string }[] = [
  { id: 'summary',    label: 'Resumen' },
  { id: 'items',      label: 'Por artículo' },
  { id: 'categories', label: 'Por categoría' },
  { id: 'employees',  label: 'Por empleado' },
  { id: 'payments',   label: 'Por pago' },
  { id: 'receipts',   label: 'Recibos' },
  { id: 'discounts',  label: 'Descuentos' },
  { id: 'taxes',      label: 'Impuestos' },
  { id: 'cash',       label: 'Caja' },
];

const PRESETS: { id: PeriodPreset; label: string }[] = [
  { id: 'today',      label: 'Hoy' },
  { id: 'yesterday',  label: 'Ayer' },
  { id: 'this_week',  label: 'Esta semana' },
  { id: 'this_month', label: 'Este mes' },
  { id: 'last_month', label: 'Mes anterior' },
  { id: 'last_30d',   label: 'Últ. 30 días' },
  { id: 'custom',     label: 'Personalizado' },
];

interface ReportData {
  summary: SalesSummary | null;
  items: SalesByItem[];
  categories: SalesByCategory[];
  employees: SalesByEmployee[];
  payments: SalesByPayment[];
  receipts: ReceiptReportRow[];
  discounts: DiscountReportRow[];
  taxes: SalesByTax[];
  cash: CashSessionReportRow[];
}

const EMPTY_DATA: ReportData = {
  summary: null, items: [], categories: [], employees: [],
  payments: [], receipts: [], discounts: [], taxes: [], cash: [],
};

export function AnalyticsView({ storeId }: Props) {
  const [tab, setTab] = useState<ReportTab>('summary');
  const [preset, setPreset] = useState<PeriodPreset>('this_month');
  const [from, setFrom] = useState(() => isoToDateInput(rangeForPreset('this_month').from));
  const [to, setTo] = useState(() => {
    // En el input mostramos el último día inclusive (UI-friendly).
    const r = rangeForPreset('this_month');
    const endIso = new Date(new Date(r.to).getTime() - 86_400_000).toISOString();
    return isoToDateInput(endIso);
  });
  const [filterStoreId, setFilterStoreId] = useState<string>(storeId);
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>('');

  const [stores, setStores] = useState<Store[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [data, setData] = useState<ReportData>(EMPTY_DATA);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar tiendas y empleados (una sola vez)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [st, emps] = await Promise.all([storeService.getAll(), employeeService.getAll()]);
        if (cancelled) return;
        setStores(st);
        setEmployees(emps);
      } catch {
        // ignore — los filtros caerán a "todas/todos"
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Sincroniza preset → inputs de fecha
  function applyPreset(p: PeriodPreset) {
    setPreset(p);
    if (p === 'custom') return;
    const r = rangeForPreset(p);
    setFrom(isoToDateInput(r.from));
    const endIso = new Date(new Date(r.to).getTime() - 86_400_000).toISOString();
    setTo(isoToDateInput(endIso));
  }

  const filters = useMemo<ReportFilters>(() => ({
    from: dateInputToIso(from),
    to:   dateInputToIso(to, true),
    storeId: filterStoreId || null,
    employeeId: filterEmployeeId || null,
  }), [from, to, filterStoreId, filterEmployeeId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        summary, items, categories, employeesR,
        payments, receipts, discounts, taxes, cash,
      ] = await Promise.all([
        reportService.salesSummary(filters),
        reportService.salesByItem(filters),
        reportService.salesByCategory(filters),
        reportService.salesByEmployee(filters),
        reportService.salesByPayment(filters),
        reportService.receipts(filters, 500),
        reportService.discounts(filters),
        reportService.salesByTax(filters),
        reportService.cashSessions(filters),
      ]);
      setData({ summary, items, categories, employees: employeesR, payments, receipts, discounts, taxes, cash });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando informes');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { void refresh(); }, [refresh]);

  function exportCurrentTab() {
    const periodTag = `${from}_${to}`;
    switch (tab) {
      case 'summary':
        if (!data.summary) return;
        downloadCsv(`resumen-${periodTag}.csv`, rowsToCsv(
          [data.summary],
          [
            { header: 'Ventas brutas', value: r => r.grossSales },
            { header: 'Reembolsos',    value: r => r.refunds },
            { header: 'Descuentos',    value: r => r.discounts },
            { header: 'Ventas netas',  value: r => r.netSales },
            { header: 'Impuestos',     value: r => r.taxes },
            { header: 'Total',         value: r => r.total },
            { header: 'COGS',          value: r => r.cogs },
            { header: 'Beneficio',     value: r => r.grossProfit },
            { header: 'Recibos',       value: r => r.receiptCount },
            { header: 'Reembolsos #',  value: r => r.refundCount },
          ],
        ));
        return;
      case 'items':
        downloadCsv(`articulos-${periodTag}.csv`, rowsToCsv(data.items, ITEM_COLUMNS));
        return;
      case 'categories':
        downloadCsv(`categorias-${periodTag}.csv`, rowsToCsv(data.categories, CATEGORY_COLUMNS));
        return;
      case 'employees':
        downloadCsv(`empleados-${periodTag}.csv`, rowsToCsv(data.employees, EMPLOYEE_COLUMNS));
        return;
      case 'payments':
        downloadCsv(`pagos-${periodTag}.csv`, rowsToCsv(data.payments, PAYMENT_COLUMNS));
        return;
      case 'receipts':
        downloadCsv(`recibos-${periodTag}.csv`, rowsToCsv(data.receipts, RECEIPT_COLUMNS));
        return;
      case 'discounts':
        downloadCsv(`descuentos-${periodTag}.csv`, rowsToCsv(data.discounts, DISCOUNT_COLUMNS));
        return;
      case 'taxes':
        downloadCsv(`impuestos-${periodTag}.csv`, rowsToCsv(data.taxes, TAX_COLUMNS));
        return;
      case 'cash':
        downloadCsv(`caja-${periodTag}.csv`, rowsToCsv(data.cash, CASH_COLUMNS));
        return;
    }
  }

  return (
    <div className="p-5 max-w-6xl mx-auto">
      <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--br-txt)' }}>Informes</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void refresh()}
            disabled={loading}
            iconLeft={<RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />}
          >
            Recargar
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={exportCurrentTab}
            iconLeft={<Download className="h-4 w-4" />}
          >
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl p-4 mb-4 grid gap-3" style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => applyPreset(p.id)}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold"
              style={{
                background: preset === p.id ? 'var(--br-amb)' : 'var(--br-sur2)',
                color: preset === p.id ? '#fff' : 'var(--br-txt2)',
                border: '1px solid var(--br-bor)',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>Desde</label>
            <Input
              type="date"
              value={from}
              onChange={(e) => { setFrom(e.target.value); setPreset('custom'); }}
              iconLeft={<Calendar className="h-3.5 w-3.5" />}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>Hasta</label>
            <Input
              type="date"
              value={to}
              onChange={(e) => { setTo(e.target.value); setPreset('custom'); }}
              iconLeft={<Calendar className="h-3.5 w-3.5" />}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>Tienda</label>
            <Select
              value={filterStoreId}
              onChange={(e) => setFilterStoreId(e.target.value)}
            >
              <option value="">Todas</option>
              {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>Empleado</label>
            <Select
              value={filterEmployeeId}
              onChange={(e) => setFilterEmployeeId(e.target.value)}
              disabled={tab === 'employees' || tab === 'cash'}
            >
              <option value="">Todos</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </Select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto" style={{ borderBottom: '1px solid var(--br-bor)' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-3 py-2 text-sm font-medium whitespace-nowrap"
            style={{
              color: tab === t.id ? 'var(--br-amb)' : 'var(--br-txt2)',
              borderBottom: tab === t.id ? '2px solid var(--br-amb)' : '2px solid transparent',
              marginBottom: '-1px',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg p-3 mb-4 text-sm" style={{ background: 'var(--br-red-bg)', color: 'var(--br-red)', border: '1px solid var(--br-red-bor)' }}>
          {error}
        </div>
      )}

      {loading && (
        <p className="text-sm py-2" style={{ color: 'var(--br-txt2)' }}>Cargando…</p>
      )}

      {/* Content */}
      {tab === 'summary'    && <SummaryPanel data={data.summary} />}
      {tab === 'items'      && <SimpleTable rows={data.items}      columns={ITEM_COLUMNS}     empty="Sin ventas en el período."     rowKey={r => r.tireId} />}
      {tab === 'categories' && <SimpleTable rows={data.categories} columns={CATEGORY_COLUMNS} empty="Sin ventas en el período."     rowKey={r => r.categoryId} />}
      {tab === 'employees'  && <SimpleTable rows={data.employees}  columns={EMPLOYEE_COLUMNS} empty="Sin actividad de empleados."   rowKey={r => r.employeeId} />}
      {tab === 'payments'   && <SimpleTable rows={data.payments}   columns={PAYMENT_COLUMNS}  empty="Sin pagos registrados."        rowKey={r => r.paymentMethodId} />}
      {tab === 'receipts'   && <SimpleTable rows={data.receipts}   columns={RECEIPT_COLUMNS}  empty="Sin recibos en el período."    rowKey={r => r.id} />}
      {tab === 'discounts'  && <SimpleTable rows={data.discounts}  columns={DISCOUNT_COLUMNS} empty="Sin descuentos aplicados."     rowKey={r => r.discountId} />}
      {tab === 'taxes'      && <SimpleTable rows={data.taxes}      columns={TAX_COLUMNS}      empty="Sin impuestos aplicados."      rowKey={r => r.taxId} />}
      {tab === 'cash'       && <SimpleTable rows={data.cash}       columns={CASH_COLUMNS}     empty="Sin sesiones de caja."         rowKey={r => r.id} />}
    </div>
  );
}

// ─── Summary panel ──────────────────────────────────────────────────

function SummaryPanel({ data }: { data: SalesSummary | null }) {
  if (!data) return null;
  const Stat = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
    <div className="rounded-xl p-4" style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}>
      <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--br-txt2)' }}>{label}</p>
      <p className="text-2xl font-bold font-mono" style={{ color: accent ? 'var(--br-amb)' : 'var(--br-txt)' }}>{value}</p>
    </div>
  );
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Stat label="Ventas brutas" value={formatCurrency(data.grossSales)} />
      <Stat label="Reembolsos" value={formatCurrency(data.refunds)} />
      <Stat label="Descuentos" value={formatCurrency(data.discounts)} />
      <Stat label="Ventas netas" value={formatCurrency(data.netSales)} accent />
      <Stat label="Impuestos" value={formatCurrency(data.taxes)} />
      <Stat label="Total cobrado" value={formatCurrency(data.total)} accent />
      <Stat label="Costo (COGS)" value={formatCurrency(data.cogs)} />
      <Stat label="Beneficio bruto" value={formatCurrency(data.grossProfit)} accent />
      <Stat label="Recibos" value={String(data.receiptCount)} />
      <Stat label="Reembolsos #" value={String(data.refundCount)} />
    </div>
  );
}

// ─── Generic table ──────────────────────────────────────────────────

function SimpleTable<T>({ rows, columns, empty, rowKey }: {
  rows: T[];
  columns: CsvColumn<T>[];
  empty: string;
  rowKey: (r: T, i: number) => string;
}) {
  if (rows.length === 0) {
    return <EmptyState icon={BarChart2} title={empty} density="compact" />;
  }
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--br-sur)', border: '1px solid var(--br-bor)' }}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead style={{ background: 'var(--br-sur2)' }}>
            <tr>
              {columns.map(c => (
                <th key={c.header} className="text-left px-3 py-2 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--br-txt2)' }}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={rowKey(r, i)} style={{ borderTop: '1px solid var(--br-bor)' }}>
                {columns.map(c => (
                  <td key={c.header} className="px-3 py-2" style={{ color: 'var(--br-txt)' }}>
                    {String(c.value(r) ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Columnas (compartidas con CSV export) ──────────────────────────

const fmt = (n: unknown) => typeof n === 'number' ? formatCurrency(n) : String(n ?? '');
const fmtQty = (n: unknown) => typeof n === 'number' ? n.toLocaleString('es-AR') : String(n ?? '');

const ITEM_COLUMNS: CsvColumn<SalesByItem>[] = [
  { header: 'Marca',       value: r => r.tireBrand },
  { header: 'Modelo',      value: r => r.tireModel },
  { header: 'Medida',      value: r => r.tireSize },
  { header: 'Cantidad',    value: r => fmtQty(r.quantity) },
  { header: 'Ventas netas',value: r => fmt(r.netSales) },
  { header: 'COGS',        value: r => fmt(r.cogs) },
  { header: 'Beneficio',   value: r => fmt(r.profit) },
];

const CATEGORY_COLUMNS: CsvColumn<SalesByCategory>[] = [
  { header: 'Categoría',   value: r => r.categoryName },
  { header: 'Cantidad',    value: r => fmtQty(r.quantity) },
  { header: 'Ventas netas',value: r => fmt(r.netSales) },
  { header: 'COGS',        value: r => fmt(r.cogs) },
  { header: 'Beneficio',   value: r => fmt(r.profit) },
];

const EMPLOYEE_COLUMNS: CsvColumn<SalesByEmployee>[] = [
  { header: 'Empleado',    value: r => r.employeeName },
  { header: 'Recibos',     value: r => r.receiptCount },
  { header: 'Reembolsos',  value: r => r.refundCount },
  { header: 'Ventas netas',value: r => fmt(r.netSales) },
  { header: 'Total',       value: r => fmt(r.total) },
  { header: 'Beneficio',   value: r => fmt(r.profit) },
];

const PAYMENT_COLUMNS: CsvColumn<SalesByPayment>[] = [
  { header: 'Método',      value: r => r.paymentMethodName },
  { header: 'Recibos',     value: r => r.receiptCount },
  { header: 'Total',       value: r => fmt(r.total) },
];

const RECEIPT_COLUMNS: CsvColumn<ReceiptReportRow>[] = [
  { header: 'Fecha',       value: r => new Date(r.createdAt).toLocaleString('es-AR') },
  { header: 'Recibo',      value: r => r.receiptNumber },
  { header: 'Tipo',        value: r => r.type === 'sale' ? 'Venta' : 'Reembolso' },
  { header: 'Tienda',      value: r => r.storeName },
  { header: 'Empleado',    value: r => r.employeeName },
  { header: 'Cliente',     value: r => r.customerName ?? '' },
  { header: 'Items',       value: r => fmtQty(r.itemCount) },
  { header: 'Descuentos',  value: r => fmt(r.totalDiscounts) },
  { header: 'Impuestos',   value: r => fmt(r.totalTaxes) },
  { header: 'Total',       value: r => fmt(r.total) },
];

const DISCOUNT_COLUMNS: CsvColumn<DiscountReportRow>[] = [
  { header: 'Descuento',   value: r => r.discountName },
  { header: 'Aplicaciones',value: r => r.applyCount },
  { header: 'Total',       value: r => fmt(r.amount) },
];

const TAX_COLUMNS: CsvColumn<SalesByTax>[] = [
  { header: 'Impuesto',    value: r => r.taxName },
  { header: 'Tasa',        value: r => `${r.rate}%` },
  { header: 'Base imponible', value: r => fmt(r.base) },
  { header: 'Importe',     value: r => fmt(r.amount) },
];

const CASH_COLUMNS: CsvColumn<CashSessionReportRow>[] = [
  { header: 'Apertura',    value: r => new Date(r.openedAt).toLocaleString('es-AR') },
  { header: 'Cierre',      value: r => r.closedAt ? new Date(r.closedAt).toLocaleString('es-AR') : '—' },
  { header: 'Tienda',      value: r => r.storeName },
  { header: 'Abrió',       value: r => r.openedByName ?? '' },
  { header: 'Cerró',       value: r => r.closedByName ?? '' },
  { header: 'Estado',      value: r => r.status === 'open' ? 'Abierta' : 'Cerrada' },
  { header: 'Fondo',       value: r => fmt(r.openingFloat) },
  { header: 'Ventas',      value: r => fmt(r.totalSales) },
  { header: 'Reembolsos',  value: r => fmt(r.totalRefunds) },
  { header: 'Recibos',     value: r => r.receiptCount },
  { header: 'Pay-in',      value: r => fmt(r.payIn) },
  { header: 'Pay-out',     value: r => fmt(r.payOut) },
  { header: 'Esperado',    value: r => r.expectedCash !== null ? fmt(r.expectedCash) : '—' },
  { header: 'Contado',     value: r => r.countedCash !== null ? fmt(r.countedCash) : '—' },
  { header: 'Descuadre',   value: r => r.variance !== null ? fmt(r.variance) : '—' },
];

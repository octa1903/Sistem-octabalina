-- =====================================================================
-- 0032 — Cotizaciones USD/ARS + histórico de listas de precios de proveedores.
--
-- Contexto:
--   Hoy `tires.cost` guarda un único costo por neumático sin trazabilidad.
--   Las listas de proveedores (BULL VIAL, CORRAL, FATE, …) se importan y
--   pisan ese costo. La lista BULL VIAL está en USD y necesita conversión
--   por cotización del Dólar Informal de ámbito.com.
--
-- Esta migración agrega:
--   1) `exchange_rates`            — cotización USD/ARS por fecha (compra,
--                                     venta, equilibrio generado).
--   2) `supplier_price_lists`      — snapshot por importación
--                                     (proveedor, moneda, fecha efectiva).
--   3) `supplier_price_list_items` — un row por neumático por importación
--                                     (costo original + costo en ARS).
--
-- Convenciones:
--   • La fuente de verdad para la conversión es `exchange_rates.rate`
--     (= (rate_buy + rate_sell) / 2, generated column).
--   • `tires.cost` se mantiene como costo vigente (compatibilidad). Se
--     actualiza desde la última importación. Si una lista USD se importa
--     y después cambia la cotización, no recalculamos automáticamente.
--   • Para listas en ARS, `cost_ars = cost_original` y `exchange_rate_id`
--     queda en null.
--
-- RLS:
--   • Lectura: cualquier empleado con `tires.view`.
--   • Escritura: empleados con `tires.manage`.
--   • exchange_rates es global (no scope por tienda).
--
-- Idempotente y reversible (drop-create de policies + if not exists).
-- =====================================================================

begin;

-- ── 1. exchange_rates ────────────────────────────────────────────────

create table if not exists exchange_rates (
  id              uuid primary key default gen_random_uuid(),
  from_currency   text not null default 'USD' check (from_currency = 'USD'),
  to_currency     text not null default 'ARS' check (to_currency = 'ARS'),
  rate_buy        numeric(12,4) not null check (rate_buy > 0),
  rate_sell       numeric(12,4) not null check (rate_sell > 0),
  rate            numeric(12,4) generated always as ((rate_buy + rate_sell) / 2) stored,
  effective_date  date not null,
  source          text not null check (source in ('ambito-informal','manual')),
  fetched_at      timestamptz not null default now(),
  created_by      uuid references employees(id) on delete set null,
  created_at      timestamptz not null default now()
);

create unique index if not exists exchange_rates_unique_day
  on exchange_rates (from_currency, to_currency, effective_date);

create index if not exists exchange_rates_effective_date_idx
  on exchange_rates (effective_date desc);

comment on table exchange_rates is
  'Cotización USD/ARS por fecha. Una vigente por día. rate = (buy+sell)/2.';

-- ── 2. supplier_price_lists ──────────────────────────────────────────

create table if not exists supplier_price_lists (
  id                uuid primary key default gen_random_uuid(),
  supplier_id       uuid references suppliers(id) on delete set null,
  supplier_name     text not null,
  list_name         text not null,
  currency          text not null default 'ARS' check (currency in ('ARS','USD')),
  exchange_rate_id  uuid references exchange_rates(id) on delete restrict,
  effective_date    date not null,
  imported_at       timestamptz not null default now(),
  imported_by       uuid references employees(id) on delete set null,
  row_count         int not null default 0,
  notes             text,
  -- USD requires exchange_rate_id; ARS does not.
  constraint supplier_price_lists_currency_rate_chk check (
    (currency = 'ARS') or (currency = 'USD' and exchange_rate_id is not null)
  )
);

create index if not exists supplier_price_lists_supplier_idx
  on supplier_price_lists (supplier_id, effective_date desc);

create index if not exists supplier_price_lists_effective_date_idx
  on supplier_price_lists (effective_date desc);

comment on table supplier_price_lists is
  'Snapshot inmutable de una importación de lista de proveedor.';

-- ── 3. supplier_price_list_items ─────────────────────────────────────

create table if not exists supplier_price_list_items (
  id               uuid primary key default gen_random_uuid(),
  price_list_id    uuid not null references supplier_price_lists(id) on delete cascade,
  tire_id          uuid references tires(id) on delete set null,
  raw_sku          text,
  raw_size         text not null,
  raw_brand        text,
  raw_model        text,
  cost_original    numeric(12,2) not null check (cost_original >= 0),
  cost_ars         numeric(12,2) not null check (cost_ars >= 0),
  price_suggested  numeric(12,2) check (price_suggested is null or price_suggested >= 0),
  created_at       timestamptz not null default now()
);

create index if not exists supplier_price_list_items_tire_idx
  on supplier_price_list_items (tire_id) where tire_id is not null;

create index if not exists supplier_price_list_items_list_idx
  on supplier_price_list_items (price_list_id);

comment on table supplier_price_list_items is
  'Item de una lista importada. cost_ars siempre presente (= cost_original si ARS).';

-- ── RLS ──────────────────────────────────────────────────────────────

alter table exchange_rates             enable row level security;
alter table supplier_price_lists       enable row level security;
alter table supplier_price_list_items  enable row level security;

-- exchange_rates: lectura para todo autenticado, escritura tires.manage
drop policy if exists exchange_rates_select on exchange_rates;
create policy exchange_rates_select on exchange_rates for select
  using (auth.uid() is not null);

drop policy if exists exchange_rates_write on exchange_rates;
create policy exchange_rates_write on exchange_rates for all
  using (current_employee_has_permission('tires.manage'))
  with check (current_employee_has_permission('tires.manage'));

-- supplier_price_lists: lectura tires.view, escritura tires.manage
drop policy if exists supplier_price_lists_select on supplier_price_lists;
create policy supplier_price_lists_select on supplier_price_lists for select
  using (current_employee_has_permission('tires.view'));

drop policy if exists supplier_price_lists_write on supplier_price_lists;
create policy supplier_price_lists_write on supplier_price_lists for all
  using (current_employee_has_permission('tires.manage'))
  with check (current_employee_has_permission('tires.manage'));

-- supplier_price_list_items: idem
drop policy if exists supplier_price_list_items_select on supplier_price_list_items;
create policy supplier_price_list_items_select on supplier_price_list_items for select
  using (current_employee_has_permission('tires.view'));

drop policy if exists supplier_price_list_items_write on supplier_price_list_items;
create policy supplier_price_list_items_write on supplier_price_list_items for all
  using (current_employee_has_permission('tires.manage'))
  with check (current_employee_has_permission('tires.manage'));

-- ── Helpers (vistas / RPC) ───────────────────────────────────────────

-- Vista materializada-lite: último costo importado por neumático.
-- Útil para mostrar "último costo conocido" sin ir tabla por tabla.
create or replace view tire_latest_cost as
select distinct on (i.tire_id)
  i.tire_id,
  i.cost_ars,
  i.cost_original,
  l.currency,
  l.effective_date,
  l.supplier_name,
  l.list_name,
  l.exchange_rate_id
from supplier_price_list_items i
join supplier_price_lists l on l.id = i.price_list_id
where i.tire_id is not null
order by i.tire_id, l.effective_date desc, l.imported_at desc;

comment on view tire_latest_cost is
  'Último costo importado por neumático (1 row por tire_id).';

commit;

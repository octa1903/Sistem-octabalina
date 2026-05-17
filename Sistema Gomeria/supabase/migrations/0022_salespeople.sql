-- =====================================================================
-- 0022_salespeople.sql — Vendedores con comisión
--
-- Refinado por Fase 0 (REPORTE_FASE0.md §9): el legacy maneja vendedores
-- denormalizados en CLIENTES.{VENDEDOR, DVENDEDOR}, ESTCLIE.{PORCVEND,
-- PAGADOVEND}, FACTURAS.{VENDEDOR, DVENDEDOR}. Para Supabase se introduce
-- una entidad propia con permission gating.
-- =====================================================================

begin;

-- ── Tabla salespeople ────────────────────────────────────────────────
create table if not exists salespeople (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references stores(id),  -- null = vendedor global / cross-tienda
  name text not null,
  cuit text,
  email text,
  phone text,
  default_commission_pct numeric(5,2) not null default 0
    check (default_commission_pct >= 0 and default_commission_pct <= 100),
  legacy_id text,                    -- = CLIENTES.VENDEDOR del .gdb
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists salespeople_legacy_id_uq
  on salespeople (legacy_id) where legacy_id is not null;
create index if not exists salespeople_store_idx
  on salespeople (store_id) where store_id is not null;
create index if not exists salespeople_active_idx
  on salespeople (active) where active = true;

drop trigger if exists salespeople_set_updated_at on salespeople;
create trigger salespeople_set_updated_at
  before update on salespeople
  for each row execute function set_updated_at_timestamp();

-- ── customers: vendedor default ───────────────────────────────────────
alter table customers
  add column if not exists default_salesperson_id uuid references salespeople(id) on delete set null;
create index if not exists customers_salesperson_idx
  on customers (default_salesperson_id) where default_salesperson_id is not null;

-- ── receipts: vendedor + comisión registrada ──────────────────────────
alter table receipts
  add column if not exists salesperson_id uuid references salespeople(id) on delete set null,
  add column if not exists salesperson_commission_pct numeric(5,2)
    check (salesperson_commission_pct is null or (salesperson_commission_pct >= 0 and salesperson_commission_pct <= 100)),
  add column if not exists salesperson_commission_amount numeric(12,2)
    check (salesperson_commission_amount is null or salesperson_commission_amount >= 0);

create index if not exists receipts_salesperson_idx
  on receipts (salesperson_id) where salesperson_id is not null;

-- ── RLS ───────────────────────────────────────────────────────────────
alter table salespeople enable row level security;

drop policy if exists salespeople_select on salespeople;
drop policy if exists salespeople_write  on salespeople;

-- Lectura: cualquier permission de POS o customers (los necesitamos en POSView
-- para asignar al receipt). El gating fino vive en la UI.
-- store_id NULL = vendedor global / cross-tienda
create policy salespeople_select on salespeople for select
  using (
    (
      current_employee_has_permission('customers.view')
      or current_employee_has_permission('pos.sell')
    )
    and (store_id is null or store_in_scope(store_id))
  );

-- Escritura: settings.manage + scope (admin de tienda A no toca vendedores de B)
create policy salespeople_write on salespeople for all
  using (
    current_employee_has_permission('settings.manage')
    and (store_id is null or store_in_scope(store_id))
  )
  with check (
    current_employee_has_permission('settings.manage')
    and (store_id is null or store_in_scope(store_id))
  );

commit;

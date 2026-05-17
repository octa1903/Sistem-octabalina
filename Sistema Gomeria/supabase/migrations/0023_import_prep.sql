-- =====================================================================
-- 0023_import_prep.sql — Schema preparatorio para import legacy Firebird
--
-- Refinado por Fase 0 + REPORTE_FASE0.md §§4,9,11.
--
-- Cambios:
--   1. customers: legacy_id, legacy_cuit, import_store_id, deleted_at,
--      import_batch_id.
--   2. receipts: legacy_id, legacy_number, afip_data jsonb (CAE histórico),
--      issued_at, import_batch_id, vehicle_owner_name (DUENIOS denormalizado).
--      Relax UNIQUE de receipt_number → parcial WHERE legacy_id IS NULL.
--   3. customer_account_movements: import_batch_id.
--   4. import_batches: nueva tabla (trazabilidad de imports).
--   5. suppliers: nueva tabla (810 filas legacy de PROVEEDORES).
--   6. banks: nueva tabla (15 filas legacy de BANCOS).
--   7. checks: nueva tabla (3488 filas legacy de CHEQUES).
--   8. supplier_account_movements: nueva tabla (29k filas legacy de ESTPROV).
--
-- Política RLS: scope por store_id donde aplica; settings.manage para escritura
-- de maestros nuevos; backoffice.access para lectura.
-- =====================================================================

begin;

-- ── customers: campos de import ──────────────────────────────────────
alter table customers
  add column if not exists legacy_id text,
  add column if not exists legacy_cuit text,
  add column if not exists import_store_id uuid references stores(id),
  add column if not exists deleted_at timestamptz,
  add column if not exists import_batch_id uuid;  -- FK definida después de import_batches

create unique index if not exists customers_legacy_id_uq
  on customers (legacy_id) where legacy_id is not null;
create index if not exists customers_legacy_cuit_idx
  on customers (legacy_cuit) where legacy_cuit is not null;
create index if not exists customers_import_store_idx
  on customers (import_store_id) where import_store_id is not null;
create index if not exists customers_deleted_idx
  on customers (deleted_at) where deleted_at is not null;

-- View de customers activos (no borrados)
create or replace view customers_active as
  select * from customers where deleted_at is null;

-- Extender customer_in_scope (0017) con import_store_id como punto (3).
-- El cliente importado sin receipts queda visible al empleado de su tienda
-- de pertenencia inicial.
create or replace function customer_in_scope(p_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    -- (1) Admin global
    current_employee_store_ids() is null
    -- (2) Cliente con receipt en una tienda del scope
    or exists (
      select 1 from receipts r
      where r.customer_id = p_customer_id
        and r.store_id = any(current_employee_store_ids())
    )
    -- (3) Cliente con movement ligado a receipt en scope
    or exists (
      select 1 from customer_account_movements m
      join receipts r on r.id = m.receipt_id
      where m.customer_id = p_customer_id
        and r.store_id = any(current_employee_store_ids())
    )
    -- (4) Cliente importado a una tienda del scope (sin receipts aún)
    or exists (
      select 1 from customers c
      where c.id = p_customer_id
        and c.import_store_id = any(current_employee_store_ids())
    ),
    false
  );
$$;

-- ── receipts: legacy + AFIP histórico ────────────────────────────────
alter table receipts
  add column if not exists legacy_id text,
  add column if not exists legacy_number text,
  add column if not exists afip_data jsonb,
  add column if not exists issued_at timestamptz,
  add column if not exists vehicle_owner_name text,   -- DUENIOS denormalizado
  add column if not exists import_batch_id uuid;

create unique index if not exists receipts_legacy_id_uq
  on receipts (legacy_id) where legacy_id is not null;
create index if not exists receipts_legacy_number_idx
  on receipts (legacy_number) where legacy_number is not null;
create index if not exists receipts_issued_at_idx
  on receipts (issued_at desc) where issued_at is not null;

-- Relax UNIQUE: receipt_number ya no es único global, solo para receipts
-- nativos del v2 (legacy_id IS NULL). Los receipts legacy pueden tener
-- numeros duplicados entre PVENTAs distintos.
-- Buscamos el constraint por catalog (el nombre auto-generado por inline
-- UNIQUE en 0001_init.sql:197 es típicamente receipts_receipt_number_key,
-- pero lo verificamos defensive en runtime).
do $$
declare
  v_conname text;
begin
  select conname into v_conname
  from pg_constraint
  where conrelid = 'public.receipts'::regclass
    and contype = 'u'
    and pg_get_constraintdef(oid) ilike '%(receipt_number)%';
  if v_conname is not null then
    execute format('alter table receipts drop constraint %I', v_conname);
  end if;
end$$;

create unique index if not exists receipts_receipt_number_native_uq
  on receipts (receipt_number) where legacy_id is null;

-- ── customer_account_movements: import_batch_id ──────────────────────
alter table customer_account_movements
  add column if not exists import_batch_id uuid;

-- ── import_batches ────────────────────────────────────────────────────
create table if not exists import_batches (
  id uuid primary key default gen_random_uuid(),
  source text not null,                  -- 'firebird:DataBRPVta.gdb' u otro
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running'
    check (status in ('running','completed','failed','rolled_back')),
  total_rows int not null default 0,
  inserted_rows int not null default 0,
  skipped_rows int not null default 0,
  errors jsonb not null default '[]'::jsonb,
  notes text,
  store_id uuid references stores(id),
  triggered_by_employee_id uuid references employees(id),
  created_at timestamptz not null default now()
);
create index if not exists import_batches_status_idx on import_batches (status);
create index if not exists import_batches_store_idx on import_batches (store_id);

-- Ahora sí, agregamos las FKs a import_batch_id que dejamos colgadas arriba.
-- ADD CONSTRAINT no admite IF NOT EXISTS en Postgres; usamos DROP IF EXISTS
-- antes para idempotencia.
alter table customers
  drop constraint if exists customers_import_batch_fkey;
alter table customers
  add constraint customers_import_batch_fkey
  foreign key (import_batch_id) references import_batches(id);

alter table receipts
  drop constraint if exists receipts_import_batch_fkey;
alter table receipts
  add constraint receipts_import_batch_fkey
  foreign key (import_batch_id) references import_batches(id);

alter table customer_account_movements
  drop constraint if exists cam_import_batch_fkey;
alter table customer_account_movements
  add constraint cam_import_batch_fkey
  foreign key (import_batch_id) references import_batches(id);

-- ── suppliers ────────────────────────────────────────────────────────
create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,                        -- = PROVEEDORES.RAZONS
  cuit text,
  phone text,
  cell text,
  email text,
  address text,
  city text,
  rubro text,                             -- categoría/rubro
  fiscal_position text,                   -- = PROVEEDORES.POSFISCAL
  retention_pct numeric(5,2),             -- = PROVEEDORES.RETENCION
  category text,                          -- = PROVEEDORES.CATEG
  contact_name text,
  notes text,
  legacy_id text,                         -- = PROVEEDORES.CODP
  import_batch_id uuid references import_batches(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists suppliers_legacy_id_uq
  on suppliers (legacy_id) where legacy_id is not null;
create index if not exists suppliers_cuit_idx
  on suppliers (cuit) where cuit is not null;
create index if not exists suppliers_active_idx
  on suppliers (active) where active = true;
create index if not exists suppliers_name_idx on suppliers (name);

drop trigger if exists suppliers_set_updated_at on suppliers;
create trigger suppliers_set_updated_at
  before update on suppliers
  for each row execute function set_updated_at_timestamp();

-- ── banks ────────────────────────────────────────────────────────────
create table if not exists banks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  branch text,                            -- sucursal
  address text,
  legacy_id text,                         -- = BANCOS.CODBANCO
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists banks_legacy_id_uq
  on banks (legacy_id) where legacy_id is not null;

drop trigger if exists banks_set_updated_at on banks;
create trigger banks_set_updated_at
  before update on banks
  for each row execute function set_updated_at_timestamp();

-- ── checks (cheques) ──────────────────────────────────────────────────
create table if not exists checks (
  id uuid primary key default gen_random_uuid(),
  check_number text not null,             -- = CHEQUES.NRO
  bank_id uuid references banks(id),
  -- CHEQUES.CLIEPROV es polimórfico (cliente o proveedor). Modelamos los dos.
  customer_id uuid references customers(id) on delete set null,
  supplier_id uuid references suppliers(id) on delete set null,
  type text not null check (type in ('incoming','outgoing')),  -- recibido vs emitido
  amount numeric(12,2) not null,
  emission_date timestamptz,              -- = CHEQUES.FECHAEMISION
  collection_date timestamptz,            -- = CHEQUES.FECHACOBRO
  entry_date timestamptz,                 -- = CHEQUES.FECHAENTRADA
  exit_date timestamptz,                  -- = CHEQUES.FECHASALIDA
  given_by text,                          -- = CHEQUES.ENTREGADO_POR
  given_to text,                          -- = CHEQUES.ENTREGADO_A
  detail text,                            -- = CHEQUES.DETALLE
  cashed boolean not null default false,  -- = CHEQUES.COBRADO
  status text default 'pending',          -- = CHEQUES.ESTADO
  receipt_id uuid references receipts(id),
  legacy_id text,
  import_batch_id uuid references import_batches(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Un cheque pertenece a UN actor (cliente o proveedor), nunca a ambos
  constraint checks_actor_check check (
    (customer_id is null) or (supplier_id is null)
  )
);
create unique index if not exists checks_legacy_id_uq
  on checks (legacy_id) where legacy_id is not null;
create index if not exists checks_customer_idx on checks (customer_id) where customer_id is not null;
create index if not exists checks_supplier_idx on checks (supplier_id) where supplier_id is not null;
create index if not exists checks_pending_idx on checks (status) where status = 'pending';
create index if not exists checks_collection_idx on checks (collection_date) where collection_date is not null;

drop trigger if exists checks_set_updated_at on checks;
create trigger checks_set_updated_at
  before update on checks
  for each row execute function set_updated_at_timestamp();

-- supplier_invoices: agregar FK a suppliers (antes era text libre).
-- Mantener el campo `supplier text` por compat con datos existentes.
-- Las nuevas inserts deben poblar supplier_id; los servicios v2 se
-- actualizan en el siguiente paso.
alter table supplier_invoices
  add column if not exists supplier_id uuid references suppliers(id);
create index if not exists supplier_invoices_supplier_id_idx
  on supplier_invoices (supplier_id) where supplier_id is not null;

-- ── supplier_account_movements ────────────────────────────────────────
create table if not exists supplier_account_movements (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id) on delete cascade,
  type text not null check (type in ('charge','payment')),
  amount numeric(12,2) not null check (amount > 0),
  payment_method_id uuid references payment_methods(id),
  notes text,
  supplier_invoice_id uuid references supplier_invoices(id),
  receipt_id uuid references receipts(id),
  employee_id uuid references employees(id),
  legacy_id text,
  import_batch_id uuid references import_batches(id),
  at timestamptz not null default now()
);
create unique index if not exists sam_legacy_id_uq
  on supplier_account_movements (legacy_id) where legacy_id is not null;
create index if not exists sam_supplier_idx
  on supplier_account_movements (supplier_id, at desc);

-- account_balance del proveedor (mantengo simétrico con customers)
alter table suppliers
  add column if not exists account_balance numeric(12,2) not null default 0;

create or replace function recompute_supplier_account_balance(p_supplier_id uuid)
returns void language sql as $$
  update suppliers s set
    account_balance = coalesce(sub.balance, 0)
  from (
    select coalesce(sum(case when type = 'charge' then amount else -amount end), 0) as balance
    from supplier_account_movements
    where supplier_id = p_supplier_id
  ) sub
  where s.id = p_supplier_id;
$$;

create or replace function trg_sam_after_change() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    perform recompute_supplier_account_balance(old.supplier_id);
    return old;
  end if;
  perform recompute_supplier_account_balance(new.supplier_id);
  if tg_op = 'UPDATE' and old.supplier_id is distinct from new.supplier_id then
    perform recompute_supplier_account_balance(old.supplier_id);
  end if;
  return new;
end $$;

drop trigger if exists supplier_account_movements_balance on supplier_account_movements;
create trigger supplier_account_movements_balance
  after insert or update or delete on supplier_account_movements
  for each row execute function trg_sam_after_change();

-- ── RLS ───────────────────────────────────────────────────────────────
alter table import_batches              enable row level security;
alter table suppliers                   enable row level security;
alter table banks                       enable row level security;
alter table checks                      enable row level security;
alter table supplier_account_movements  enable row level security;

-- import_batches: solo settings.manage (admin), scope por store_id
drop policy if exists import_batches_select on import_batches;
drop policy if exists import_batches_write  on import_batches;
create policy import_batches_select on import_batches for select
  using (
    current_employee_has_permission('settings.manage')
    and (store_id is null or store_in_scope(store_id))
  );
create policy import_batches_write on import_batches for all
  using (
    current_employee_has_permission('settings.manage')
    and (store_id is null or store_in_scope(store_id))
  )
  with check (
    current_employee_has_permission('settings.manage')
    and (store_id is null or store_in_scope(store_id))
  );

-- suppliers: maestros globales (no por tienda). select con backoffice.access
-- o tires.manage (necesario en SettingsView). Write con settings.manage.
drop policy if exists suppliers_select on suppliers;
drop policy if exists suppliers_write  on suppliers;
create policy suppliers_select on suppliers for select
  using (
    current_employee_has_permission('backoffice.access')
    or current_employee_has_permission('tires.manage')
    or current_employee_has_permission('settings.manage')
  );
create policy suppliers_write on suppliers for all
  using (current_employee_has_permission('settings.manage'))
  with check (current_employee_has_permission('settings.manage'));

-- banks: maestros globales (lectura amplia, escritura settings.manage)
drop policy if exists banks_select on banks;
drop policy if exists banks_write  on banks;
create policy banks_select on banks for select
  using (
    current_employee_has_permission('backoffice.access')
    or current_employee_has_permission('settings.manage')
    or current_employee_has_permission('pos.sell')
  );
create policy banks_write on banks for all
  using (current_employee_has_permission('settings.manage'))
  with check (current_employee_has_permission('settings.manage'));

-- checks: lectura para customers.view, write para customers.manage.
-- scope vía customer_in_scope o supplier (los suppliers son globales,
-- así que esta tabla queda accesible si el actor cae en scope).
drop policy if exists checks_select on checks;
drop policy if exists checks_write  on checks;
create policy checks_select on checks for select
  using (
    current_employee_has_permission('customers.view')
    and (
      customer_id is null
      or customer_in_scope(customer_id)
    )
  );
-- WRITE: customers.manage para cheques de cliente; settings.manage permite
-- también escribir cheques puros de proveedor (sin customer_id).
create policy checks_write on checks for all
  using (
    (
      current_employee_has_permission('customers.manage')
      and (customer_id is null or customer_in_scope(customer_id))
    )
    or (
      current_employee_has_permission('settings.manage')
      and customer_id is null
    )
  )
  with check (
    (
      current_employee_has_permission('customers.manage')
      and (customer_id is null or customer_in_scope(customer_id))
    )
    or (
      current_employee_has_permission('settings.manage')
      and customer_id is null
    )
  );

-- supplier_account_movements: select backoffice.access, write settings.manage
drop policy if exists sam_select on supplier_account_movements;
drop policy if exists sam_write  on supplier_account_movements;
create policy sam_select on supplier_account_movements for select
  using (
    current_employee_has_permission('backoffice.access')
    or current_employee_has_permission('settings.manage')
    or current_employee_has_permission('pos.cashMovement')
  );
create policy sam_write on supplier_account_movements for all
  using (current_employee_has_permission('settings.manage'))
  with check (current_employee_has_permission('settings.manage'));

commit;

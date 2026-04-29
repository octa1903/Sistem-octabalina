-- =====================================================================
-- 0001_init.sql — Schema inicial Sistema Octabalina (Baliña Ruedas)
-- Replica de funcionalidad Loyverse + diferenciadores propios
-- =====================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- =====================================================================
-- Catálogo
-- =====================================================================

create table stores (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  address jsonb,
  phone text,
  description text,
  pos_device_name text not null default 'TPV 1',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  color text not null default '#6b7280',
  sort_order int not null default 0
);

create table tires (
  id uuid primary key default uuid_generate_v4(),
  brand text not null,
  model text not null,
  size text not null,
  category_id uuid not null references categories(id) on delete restrict,
  cost numeric(12,2) not null default 0,
  default_price numeric(12,2) not null default 0,
  default_margin numeric(5,2) generated always as
    (case when default_price > 0
          then ((default_price - cost) / default_price) * 100
          else 0 end) stored,
  sku text unique,
  barcode text unique,
  image_url text,
  notes text,
  tax_ids uuid[] not null default '{}',
  modifier_group_ids uuid[] not null default '{}',
  available_in_all_stores boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tires_category_idx on tires (category_id);
create index tires_brand_model_idx on tires (brand, model);

create table tire_store_overrides (
  tire_id uuid not null references tires(id) on delete cascade,
  store_id uuid not null references stores(id) on delete cascade,
  available boolean not null default true,
  price numeric(12,2) not null,
  stock numeric(12,3) not null default 0,
  low_stock_threshold numeric(12,3) not null default 0,
  location text,
  primary key (tire_id, store_id)
);
create index tso_store_idx on tire_store_overrides (store_id);
create index tso_low_stock_idx on tire_store_overrides (store_id)
  where stock <= low_stock_threshold;

create table modifier_groups (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  options jsonb not null default '[]'::jsonb,
  store_ids uuid[]   -- null = todas las tiendas
);

create table discounts (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type text not null check (type in ('percent','amount')),
  value numeric(12,2),  -- null = pedir en venta
  pin_restricted boolean not null default false,
  store_ids uuid[]
);

create table taxes (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  rate numeric(5,2) not null,
  inclusion text not null check (inclusion in ('included','added')),
  applies_to_tire_ids uuid[] not null default '{}',
  apply_to_new_tires boolean not null default false,
  depends_on_order_type boolean not null default false,
  store_ids uuid[]
);

create table payment_methods (
  id uuid primary key default uuid_generate_v4(),
  type text not null check (type in ('cash','card','transfer','other')),
  name text not null,
  surcharge_percent numeric(5,2) not null default 0,
  store_ids uuid[],
  sort_order int not null default 0
);

-- =====================================================================
-- Personas
-- =====================================================================

create table roles (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  permissions text[] not null default '{}',
  is_system boolean not null default false
);

create table employees (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text unique,
  phone text,
  role_id uuid not null references roles(id),
  store_ids uuid[],   -- null = acceso a todas las tiendas
  pin_hash text not null,
  auth_user_id uuid references auth.users(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index employees_auth_user_idx on employees (auth_user_id);

create table customers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  label text,
  email text,
  phone text,
  address jsonb,
  birthday date,
  note text,
  -- métricas Loyverse (denormalizadas)
  first_visit timestamptz,
  last_visit timestamptz,
  total_visits int not null default 0,
  total_spent numeric(12,2) not null default 0,
  points_balance numeric(12,2) not null default 0,
  -- diferenciadores Octabalina
  credit_limit numeric(12,2) not null default 0,
  account_balance numeric(12,2) not null default 0,
  pin_hash text,
  customer_type text not null default 'retail'
    check (customer_type in ('retail','wholesale')),
  wholesale_discount numeric(5,2),
  auth_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index customers_phone_idx on customers (phone);
create index customers_email_idx on customers (email);

-- =====================================================================
-- Transacciones
-- =====================================================================

create table cash_sessions (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid not null references stores(id),
  opened_at timestamptz not null default now(),
  opened_by_employee_id uuid not null references employees(id),
  opening_float numeric(12,2) not null,
  closed_at timestamptz,
  closed_by_employee_id uuid references employees(id),
  expected_cash numeric(12,2),
  counted_cash numeric(12,2),
  variance numeric(12,2),
  notes text,
  status text not null default 'open' check (status in ('open','closed'))
);
-- una sola sesión abierta por tienda
create unique index one_open_session_per_store
  on cash_sessions (store_id) where status = 'open';
create index cash_sessions_store_opened_idx on cash_sessions (store_id, opened_at desc);

create table cash_movements (
  id uuid primary key default uuid_generate_v4(),
  cash_session_id uuid not null references cash_sessions(id) on delete cascade,
  type text not null check (type in ('pay_in','pay_out')),
  amount numeric(12,2) not null check (amount > 0),
  reason text not null,
  employee_id uuid not null references employees(id),
  at timestamptz not null default now()
);
create index cash_movements_session_idx on cash_movements (cash_session_id);

create table receipts (
  id uuid primary key default uuid_generate_v4(),
  receipt_number text not null unique,
  store_id uuid not null references stores(id),
  cash_session_id uuid not null references cash_sessions(id),
  employee_id uuid not null references employees(id),
  customer_id uuid references customers(id),
  type text not null check (type in ('sale','refund')),
  status text not null check (status in ('completed','parked')),
  parked_name text,
  refund_of_receipt_id uuid references receipts(id),
  applied_discounts jsonb not null default '[]'::jsonb,
  applied_taxes    jsonb not null default '[]'::jsonb,
  payments         jsonb not null default '[]'::jsonb,
  subtotal_gross   numeric(12,2) not null,
  total_discounts  numeric(12,2) not null,
  subtotal_net     numeric(12,2) not null,
  total_taxes      numeric(12,2) not null,
  total_cogs       numeric(12,2) not null,
  total            numeric(12,2) not null,
  points_earned    numeric(12,2) not null default 0,
  points_redeemed  numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);
create index receipts_store_created_idx on receipts (store_id, created_at desc);
create index receipts_employee_idx on receipts (employee_id, created_at desc);
create index receipts_customer_idx on receipts (customer_id, created_at desc) where customer_id is not null;
create index receipts_session_idx on receipts (cash_session_id);
create index receipts_status_idx on receipts (status) where status = 'parked';

create table receipt_lines (
  id uuid primary key default uuid_generate_v4(),
  receipt_id uuid not null references receipts(id) on delete cascade,
  tire_id uuid not null references tires(id),
  -- snapshots para reportes estables
  tire_brand text not null,
  tire_model text not null,
  tire_size text not null,
  category_id uuid not null,
  category_name text not null,
  modifiers jsonb not null default '[]'::jsonb,
  unit_price numeric(12,2) not null,
  unit_cost numeric(12,2) not null,
  quantity numeric(12,3) not null,
  line_discounts jsonb not null default '[]'::jsonb,
  line_taxes     jsonb not null default '[]'::jsonb,
  gross numeric(12,2) not null,
  net   numeric(12,2) not null,
  total numeric(12,2) not null
);
create index receipt_lines_receipt_idx on receipt_lines (receipt_id);
create index receipt_lines_tire_idx on receipt_lines (tire_id);
create index receipt_lines_category_idx on receipt_lines (category_id);

-- =====================================================================
-- Configuración (singletons + por tienda)
-- =====================================================================

create table app_features (
  singleton boolean primary key default true,
  cash_shifts boolean not null default true,
  time_clock  boolean not null default false,
  open_tickets boolean not null default true,
  customer_display boolean not null default false,
  order_types boolean not null default true,
  low_stock_notifications boolean not null default true,
  negative_stock_alert boolean not null default true,
  constraint app_features_singleton check (singleton)
);

create table loyalty_config (
  singleton boolean primary key default true,
  enabled boolean not null default false,
  earn_percent numeric(5,2) not null default 0,
  constraint loyalty_singleton check (singleton)
);

create table receipt_config (
  store_id uuid primary key references stores(id) on delete cascade,
  email_logo_url text,
  printed_logo_url text,
  header text not null default '',
  footer text not null default '',
  show_customer_info boolean not null default false,
  show_comments boolean not null default false
);

create table open_tickets_config (
  store_id uuid primary key references stores(id) on delete cascade,
  use_predefined boolean not null default false,
  predefined_names text[] not null default '{}'
);

-- =====================================================================
-- Diferenciadores Octabalina (preservados de v1)
-- =====================================================================

-- Facturas a proveedores (módulo actual de Invoices)
create table supplier_invoices (
  id uuid primary key default uuid_generate_v4(),
  type text not null check (type in ('A','B','C','X')),
  number text not null,
  supplier text not null,
  date date not null,
  due_date date,
  items jsonb not null default '[]'::jsonb,  -- [{description, quantity, unitPrice, subtotal}]
  subtotal numeric(12,2) not null default 0,
  iva numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  paid boolean not null default false,
  notes text,
  store_id uuid references stores(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index supplier_invoices_supplier_idx on supplier_invoices (supplier);
create index supplier_invoices_unpaid_idx on supplier_invoices (due_date) where not paid;

-- Pedidos online del portal cliente
create table customer_orders (
  id uuid primary key default uuid_generate_v4(),
  numero text not null unique,
  customer_id uuid references customers(id),
  customer_name text not null,
  store_id uuid references stores(id),
  items jsonb not null default '[]'::jsonb,
  payment_method_id uuid references payment_methods(id),
  status text not null default 'pendiente'
    check (status in ('pendiente','confirmado','en_preparacion','listo','entregado','cancelado')),
  tipo text not null check (tipo in ('retiro','entrega_domicilio')),
  scheduled_date date,
  scheduled_time text,
  address text,
  notes text,
  internal_notes text,
  client_message text,
  total_amount numeric(12,2) not null default 0,
  confirmed_by_employee_id uuid references employees(id),
  receipt_id uuid references receipts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index customer_orders_status_idx on customer_orders (status, scheduled_date);
create index customer_orders_customer_idx on customer_orders (customer_id);

-- Pagos / cargos sobre cuenta corriente del cliente
create table customer_account_movements (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid not null references customers(id) on delete cascade,
  type text not null check (type in ('charge','payment')),
  amount numeric(12,2) not null check (amount > 0),
  payment_method_id uuid references payment_methods(id),
  notes text,
  receipt_id uuid references receipts(id),
  employee_id uuid references employees(id),
  at timestamptz not null default now()
);
create index cam_customer_idx on customer_account_movements (customer_id, at desc);

-- Configuración global (single row)
create table app_metadata (
  singleton boolean primary key default true,
  schema_version int not null default 1,
  last_local_backup_at timestamptz,
  migrated_from_local_at timestamptz,
  constraint app_metadata_singleton check (singleton)
);

-- Configuración wholesale (single row, equivalente a wholesaleConfig actual)
create table wholesale_config (
  singleton boolean primary key default true,
  global_discount numeric(5,2) not null default 10,
  min_units_per_item int not null default 4,
  min_order_amount numeric(12,2) not null default 0,
  constraint wholesale_singleton check (singleton)
);

-- Configuración de pedidos online (single row, equivalente a orderConfig actual)
create table order_config (
  singleton boolean primary key default true,
  enabled boolean not null default true,
  work_days boolean[] not null default '{true,true,true,true,true,true,false}',
  blocked_dates date[] not null default '{}',
  min_days_ahead int not null default 1,
  max_days_ahead int not null default 30,
  time_slots text[] not null default
    '{"Mañana 09:00-12:00","Tarde 14:00-18:00","A coordinar"}',
  max_orders_per_day int not null default 10,
  constraint order_config_singleton check (singleton)
);

-- =====================================================================
-- Triggers de updated_at
-- =====================================================================

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger stores_updated before update on stores
  for each row execute function set_updated_at();
create trigger tires_updated before update on tires
  for each row execute function set_updated_at();
create trigger customers_updated before update on customers
  for each row execute function set_updated_at();
create trigger supplier_invoices_updated before update on supplier_invoices
  for each row execute function set_updated_at();
create trigger customer_orders_updated before update on customer_orders
  for each row execute function set_updated_at();

-- =====================================================================
-- RPCs de negocio
-- =====================================================================

-- Decremento atómico de stock al insertar un receipt
create or replace function apply_receipt_to_stock(p_receipt_id uuid)
returns void language plpgsql as $$
declare
  r record;
  sign int;
begin
  select store_id, type into r from receipts where id = p_receipt_id;
  if r is null then
    raise exception 'Receipt % no encontrado', p_receipt_id;
  end if;
  sign := case when r.type = 'sale' then -1 else 1 end;

  update tire_store_overrides tso
  set stock = tso.stock + sign * rl.quantity
  from receipt_lines rl
  where rl.receipt_id = p_receipt_id
    and tso.tire_id  = rl.tire_id
    and tso.store_id = r.store_id;
end $$;

-- Recompute métricas denormalizadas del cliente
create or replace function recompute_customer_metrics(p_customer_id uuid)
returns void language sql as $$
  update customers c set
    total_visits = coalesce(sub.visits, 0),
    total_spent  = coalesce(sub.spent, 0),
    first_visit  = sub.first_visit,
    last_visit   = sub.last_visit
  from (
    select count(*) filter (where type='sale')                               as visits,
           coalesce(sum(case when type='sale' then total else -total end), 0) as spent,
           min(created_at)                                                    as first_visit,
           max(created_at)                                                    as last_visit
    from receipts where customer_id = p_customer_id
  ) sub
  where c.id = p_customer_id;
$$;

-- Crear receipt + lines en una transacción y aplicar stock
-- p_receipt y p_lines son JSONB para evitar definir tipos compuestos
create or replace function create_receipt_with_lines(
  p_receipt jsonb,
  p_lines   jsonb
) returns uuid language plpgsql as $$
declare
  v_receipt_id uuid;
  v_store_id   uuid := (p_receipt->>'store_id')::uuid;
  v_session_status text;
begin
  -- Validar sesión de caja abierta
  select status into v_session_status from cash_sessions
   where id = (p_receipt->>'cash_session_id')::uuid;
  if v_session_status is null then
    raise exception 'Cash session no encontrada';
  end if;
  if v_session_status <> 'open' then
    raise exception 'Cash session no está abierta';
  end if;

  insert into receipts (
    receipt_number, store_id, cash_session_id, employee_id, customer_id,
    type, status, parked_name, refund_of_receipt_id,
    applied_discounts, applied_taxes, payments,
    subtotal_gross, total_discounts, subtotal_net,
    total_taxes, total_cogs, total,
    points_earned, points_redeemed, notes
  )
  select
    p_receipt->>'receipt_number',
    (p_receipt->>'store_id')::uuid,
    (p_receipt->>'cash_session_id')::uuid,
    (p_receipt->>'employee_id')::uuid,
    nullif(p_receipt->>'customer_id','')::uuid,
    p_receipt->>'type',
    p_receipt->>'status',
    p_receipt->>'parked_name',
    nullif(p_receipt->>'refund_of_receipt_id','')::uuid,
    coalesce(p_receipt->'applied_discounts','[]'::jsonb),
    coalesce(p_receipt->'applied_taxes','[]'::jsonb),
    coalesce(p_receipt->'payments','[]'::jsonb),
    (p_receipt->>'subtotal_gross')::numeric,
    (p_receipt->>'total_discounts')::numeric,
    (p_receipt->>'subtotal_net')::numeric,
    (p_receipt->>'total_taxes')::numeric,
    (p_receipt->>'total_cogs')::numeric,
    (p_receipt->>'total')::numeric,
    coalesce((p_receipt->>'points_earned')::numeric, 0),
    coalesce((p_receipt->>'points_redeemed')::numeric, 0),
    p_receipt->>'notes'
  returning id into v_receipt_id;

  insert into receipt_lines (
    receipt_id, tire_id, tire_brand, tire_model, tire_size,
    category_id, category_name, modifiers,
    unit_price, unit_cost, quantity,
    line_discounts, line_taxes, gross, net, total
  )
  select
    v_receipt_id,
    (l->>'tire_id')::uuid,
    l->>'tire_brand', l->>'tire_model', l->>'tire_size',
    (l->>'category_id')::uuid, l->>'category_name',
    coalesce(l->'modifiers','[]'::jsonb),
    (l->>'unit_price')::numeric,
    (l->>'unit_cost')::numeric,
    (l->>'quantity')::numeric,
    coalesce(l->'line_discounts','[]'::jsonb),
    coalesce(l->'line_taxes','[]'::jsonb),
    (l->>'gross')::numeric,
    (l->>'net')::numeric,
    (l->>'total')::numeric
  from jsonb_array_elements(p_lines) as l;

  -- Aplicar movimiento de stock (sólo si receipt está completed)
  if p_receipt->>'status' = 'completed' then
    perform apply_receipt_to_stock(v_receipt_id);
  end if;

  -- Recompute métricas si aplica
  if (p_receipt->>'customer_id') is not null and (p_receipt->>'customer_id') <> '' then
    perform recompute_customer_metrics((p_receipt->>'customer_id')::uuid);
  end if;

  return v_receipt_id;
end $$;

-- Cierre de caja con cálculo de descuadre
create or replace function close_cash_session(
  p_session_id uuid,
  p_employee_id uuid,
  p_counted_cash numeric
) returns jsonb language plpgsql as $$
declare
  v_session record;
  v_cash_in numeric;
  v_cash_adjust numeric;
  v_expected numeric;
  v_variance numeric;
begin
  select * into v_session from cash_sessions where id = p_session_id;
  if v_session is null then
    raise exception 'Sesión no encontrada';
  end if;
  if v_session.status = 'closed' then
    raise exception 'Sesión ya cerrada';
  end if;

  -- Suma de pagos en efectivo dentro de receipts de esta sesión
  select coalesce(sum(
    case when r.type = 'sale' then (p->>'amount')::numeric
         else -(p->>'amount')::numeric end
  ), 0)
  into v_cash_in
  from receipts r
       cross join lateral jsonb_array_elements(r.payments) p
       join payment_methods pm on pm.id = (p->>'payment_method_id')::uuid
  where r.cash_session_id = p_session_id
    and r.status = 'completed'
    and pm.type = 'cash';

  -- Suma de movimientos de caja (pay_in / pay_out)
  select coalesce(sum(case when type='pay_in' then amount else -amount end), 0)
  into v_cash_adjust
  from cash_movements where cash_session_id = p_session_id;

  v_expected := v_session.opening_float + v_cash_in + v_cash_adjust;
  v_variance := v_expected - p_counted_cash;

  update cash_sessions set
    closed_at = now(),
    closed_by_employee_id = p_employee_id,
    expected_cash = v_expected,
    counted_cash = p_counted_cash,
    variance = v_variance,
    status = 'closed'
  where id = p_session_id;

  return jsonb_build_object(
    'expected_cash', v_expected,
    'counted_cash', p_counted_cash,
    'variance', v_variance
  );
end $$;

-- =====================================================================
-- Vistas para reportes
-- =====================================================================

create or replace view daily_sales_summary as
select date_trunc('day', r.created_at) as day,
       r.store_id,
       sum(r.subtotal_gross)  filter (where r.type = 'sale')   as gross,
       sum(r.total_discounts)                                   as discounts,
       sum(case when r.type='sale' then r.total else -r.total end) as net,
       sum(case when r.type='sale' then r.total_cogs else -r.total_cogs end) as cogs,
       count(*) filter (where r.type = 'sale')                  as sales_count,
       count(*) filter (where r.type = 'refund')                as refunds_count
from receipts r
where r.status = 'completed'
group by 1, 2;

create or replace view sales_by_item as
select rl.tire_id,
       rl.tire_brand, rl.tire_model, rl.tire_size,
       rl.category_id, rl.category_name,
       r.store_id,
       date_trunc('day', r.created_at) as day,
       sum(rl.quantity * case when r.type='sale' then 1 else -1 end) as quantity,
       sum(rl.net      * case when r.type='sale' then 1 else -1 end) as net,
       sum(rl.unit_cost * rl.quantity * case when r.type='sale' then 1 else -1 end) as cogs
from receipt_lines rl
join receipts r on r.id = rl.receipt_id
where r.status = 'completed'
group by 1,2,3,4,5,6,7,8;

create or replace view sales_by_payment as
select (p->>'payment_method_id')::uuid as payment_method_id,
       r.store_id,
       date_trunc('day', r.created_at) as day,
       count(*) filter (where r.type = 'sale')   as sale_tx,
       count(*) filter (where r.type = 'refund') as refund_tx,
       sum((p->>'amount')::numeric) filter (where r.type = 'sale')   as sale_amount,
       sum((p->>'amount')::numeric) filter (where r.type = 'refund') as refund_amount
from receipts r
     cross join lateral jsonb_array_elements(r.payments) p
where r.status = 'completed'
group by 1, 2, 3;

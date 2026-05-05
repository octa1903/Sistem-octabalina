-- =====================================================================
-- 0004_reports.sql — Funciones agregadas para los 10 informes Loyverse.
--
-- Todos los reports filtran por:
--   p_from (timestamptz)  — inicio del rango (inclusive)
--   p_to   (timestamptz)  — fin    del rango (exclusive)
--   p_store_id    uuid    — opcional (null = todas las tiendas accesibles)
--   p_employee_id uuid    — opcional (null = todos los empleados)
--
-- Convenciones:
--   - Solo se incluyen receipts.status = 'completed'.
--   - Sales suman positivo (sign +1), refunds suman negativo (sign -1).
--   - "Net" = subtotal_net (después de descuentos, antes de impuestos agregados).
--   - "Profit" = net - cogs.
-- =====================================================================

-- ── Helper: signo según tipo de receipt ──────────────────────────────
create or replace function _receipt_sign(p_type text) returns int
language sql immutable as $$
  select case when p_type = 'refund' then -1 else 1 end;
$$;

-- ── 1. Resumen de ventas ─────────────────────────────────────────────
create or replace function report_sales_summary(
  p_from        timestamptz,
  p_to          timestamptz,
  p_store_id    uuid default null,
  p_employee_id uuid default null
) returns table (
  gross_sales      numeric,
  refunds          numeric,
  discounts        numeric,
  net_sales        numeric,
  taxes            numeric,
  total            numeric,
  cogs             numeric,
  gross_profit     numeric,
  receipt_count    bigint,
  refund_count     bigint
)
language sql stable security invoker as $$
  select
    coalesce(sum(case when r.type = 'sale'   then r.subtotal_gross  else 0 end), 0)            as gross_sales,
    coalesce(sum(case when r.type = 'refund' then r.total           else 0 end), 0)            as refunds,
    coalesce(sum(_receipt_sign(r.type) * r.total_discounts), 0)                                as discounts,
    coalesce(sum(_receipt_sign(r.type) * r.subtotal_net),    0)                                as net_sales,
    coalesce(sum(_receipt_sign(r.type) * r.total_taxes),     0)                                as taxes,
    coalesce(sum(_receipt_sign(r.type) * r.total),           0)                                as total,
    coalesce(sum(_receipt_sign(r.type) * r.total_cogs),      0)                                as cogs,
    coalesce(sum(_receipt_sign(r.type) * (r.subtotal_net - r.total_cogs)), 0)                  as gross_profit,
    count(*) filter (where r.type = 'sale')                                                    as receipt_count,
    count(*) filter (where r.type = 'refund')                                                  as refund_count
  from receipts r
  where r.status = 'completed'
    and r.created_at >= p_from
    and r.created_at <  p_to
    and (p_store_id is null    or r.store_id    = p_store_id)
    and (p_employee_id is null or r.employee_id = p_employee_id);
$$;

-- ── 2. Ventas por artículo ───────────────────────────────────────────
create or replace function report_sales_by_item(
  p_from        timestamptz,
  p_to          timestamptz,
  p_store_id    uuid default null,
  p_employee_id uuid default null
) returns table (
  tire_id     uuid,
  tire_brand  text,
  tire_model  text,
  tire_size   text,
  quantity    numeric,
  net_sales   numeric,
  cogs        numeric,
  profit      numeric
)
language sql stable security invoker as $$
  select
    rl.tire_id,
    rl.tire_brand,
    rl.tire_model,
    rl.tire_size,
    coalesce(sum(_receipt_sign(r.type) * rl.quantity),                  0) as quantity,
    coalesce(sum(_receipt_sign(r.type) * rl.net),                       0) as net_sales,
    coalesce(sum(_receipt_sign(r.type) * rl.unit_cost * rl.quantity),   0) as cogs,
    coalesce(sum(_receipt_sign(r.type) * (rl.net - rl.unit_cost * rl.quantity)), 0) as profit
  from receipt_lines rl
  join receipts r on r.id = rl.receipt_id
  where r.status = 'completed'
    and r.created_at >= p_from
    and r.created_at <  p_to
    and (p_store_id is null    or r.store_id    = p_store_id)
    and (p_employee_id is null or r.employee_id = p_employee_id)
  group by rl.tire_id, rl.tire_brand, rl.tire_model, rl.tire_size
  order by net_sales desc;
$$;

-- ── 3. Ventas por categoría ──────────────────────────────────────────
create or replace function report_sales_by_category(
  p_from        timestamptz,
  p_to          timestamptz,
  p_store_id    uuid default null,
  p_employee_id uuid default null
) returns table (
  category_id   uuid,
  category_name text,
  quantity      numeric,
  net_sales     numeric,
  cogs          numeric,
  profit        numeric
)
language sql stable security invoker as $$
  select
    rl.category_id,
    rl.category_name,
    coalesce(sum(_receipt_sign(r.type) * rl.quantity), 0)                              as quantity,
    coalesce(sum(_receipt_sign(r.type) * rl.net), 0)                                   as net_sales,
    coalesce(sum(_receipt_sign(r.type) * rl.unit_cost * rl.quantity), 0)               as cogs,
    coalesce(sum(_receipt_sign(r.type) * (rl.net - rl.unit_cost * rl.quantity)), 0)    as profit
  from receipt_lines rl
  join receipts r on r.id = rl.receipt_id
  where r.status = 'completed'
    and r.created_at >= p_from
    and r.created_at <  p_to
    and (p_store_id is null    or r.store_id    = p_store_id)
    and (p_employee_id is null or r.employee_id = p_employee_id)
  group by rl.category_id, rl.category_name
  order by net_sales desc;
$$;

-- ── 4. Ventas por empleado ───────────────────────────────────────────
create or replace function report_sales_by_employee(
  p_from        timestamptz,
  p_to          timestamptz,
  p_store_id    uuid default null
) returns table (
  employee_id   uuid,
  employee_name text,
  receipt_count bigint,
  refund_count  bigint,
  net_sales     numeric,
  total         numeric,
  profit        numeric
)
language sql stable security invoker as $$
  select
    e.id   as employee_id,
    e.name as employee_name,
    count(*) filter (where r.type = 'sale')                                          as receipt_count,
    count(*) filter (where r.type = 'refund')                                        as refund_count,
    coalesce(sum(_receipt_sign(r.type) * r.subtotal_net),                       0)  as net_sales,
    coalesce(sum(_receipt_sign(r.type) * r.total),                              0)  as total,
    coalesce(sum(_receipt_sign(r.type) * (r.subtotal_net - r.total_cogs)),      0)  as profit
  from receipts r
  join employees e on e.id = r.employee_id
  where r.status = 'completed'
    and r.created_at >= p_from
    and r.created_at <  p_to
    and (p_store_id is null or r.store_id = p_store_id)
  group by e.id, e.name
  order by net_sales desc;
$$;

-- ── 5. Ventas por tipo de pago ───────────────────────────────────────
create or replace function report_sales_by_payment(
  p_from        timestamptz,
  p_to          timestamptz,
  p_store_id    uuid default null,
  p_employee_id uuid default null
) returns table (
  payment_method_id   uuid,
  payment_method_name text,
  receipt_count       bigint,
  total               numeric
)
language sql stable security invoker as $$
  select
    pm.id   as payment_method_id,
    pm.name as payment_method_name,
    count(distinct r.id)                                              as receipt_count,
    coalesce(sum(_receipt_sign(r.type) * (p->>'amount')::numeric), 0) as total
  from receipts r
  cross join lateral jsonb_array_elements(r.payments) p
  join payment_methods pm on pm.id = (p->>'paymentMethodId')::uuid
  where r.status = 'completed'
    and r.created_at >= p_from
    and r.created_at <  p_to
    and (p_store_id is null    or r.store_id    = p_store_id)
    and (p_employee_id is null or r.employee_id = p_employee_id)
  group by pm.id, pm.name
  order by total desc;
$$;

-- ── 6. Ventas por impuesto ───────────────────────────────────────────
create or replace function report_sales_by_tax(
  p_from        timestamptz,
  p_to          timestamptz,
  p_store_id    uuid default null,
  p_employee_id uuid default null
) returns table (
  tax_id   uuid,
  tax_name text,
  rate     numeric,
  base     numeric,
  amount   numeric
)
language sql stable security invoker as $$
  select
    t.id   as tax_id,
    t.name as tax_name,
    t.rate,
    coalesce(sum(_receipt_sign(r.type) * (a->>'base')::numeric),   0) as base,
    coalesce(sum(_receipt_sign(r.type) * (a->>'amount')::numeric), 0) as amount
  from receipts r
  cross join lateral jsonb_array_elements(r.applied_taxes) a
  join taxes t on t.id = (a->>'taxId')::uuid
  where r.status = 'completed'
    and r.created_at >= p_from
    and r.created_at <  p_to
    and (p_store_id is null    or r.store_id    = p_store_id)
    and (p_employee_id is null or r.employee_id = p_employee_id)
  group by t.id, t.name, t.rate
  order by amount desc;
$$;

-- ── 7. Descuentos aplicados ──────────────────────────────────────────
create or replace function report_discounts(
  p_from        timestamptz,
  p_to          timestamptz,
  p_store_id    uuid default null,
  p_employee_id uuid default null
) returns table (
  discount_id   uuid,
  discount_name text,
  apply_count   bigint,
  amount        numeric
)
language sql stable security invoker as $$
  -- ticket-level discounts
  select
    d.id   as discount_id,
    d.name as discount_name,
    count(*)                                                          as apply_count,
    coalesce(sum(_receipt_sign(r.type) * (a->>'amount')::numeric), 0) as amount
  from receipts r
  cross join lateral jsonb_array_elements(r.applied_discounts) a
  join discounts d on d.id = (a->>'discountId')::uuid
  where r.status = 'completed'
    and r.created_at >= p_from
    and r.created_at <  p_to
    and (p_store_id is null    or r.store_id    = p_store_id)
    and (p_employee_id is null or r.employee_id = p_employee_id)
  group by d.id, d.name
  union all
  -- line-level discounts
  select
    d.id   as discount_id,
    d.name as discount_name,
    count(*)                                                          as apply_count,
    coalesce(sum(_receipt_sign(r.type) * (a->>'amount')::numeric), 0) as amount
  from receipts r
  join receipt_lines rl on rl.receipt_id = r.id
  cross join lateral jsonb_array_elements(rl.line_discounts) a
  join discounts d on d.id = (a->>'discountId')::uuid
  where r.status = 'completed'
    and r.created_at >= p_from
    and r.created_at <  p_to
    and (p_store_id is null    or r.store_id    = p_store_id)
    and (p_employee_id is null or r.employee_id = p_employee_id)
  group by d.id, d.name
  order by amount desc;
$$;

-- ── 8. Lista de recibos ──────────────────────────────────────────────
create or replace function report_receipts(
  p_from        timestamptz,
  p_to          timestamptz,
  p_store_id    uuid default null,
  p_employee_id uuid default null,
  p_limit       int  default 500
) returns table (
  id              uuid,
  receipt_number  text,
  type            text,
  created_at      timestamptz,
  store_id        uuid,
  store_name      text,
  employee_id     uuid,
  employee_name   text,
  customer_id     uuid,
  customer_name   text,
  total           numeric,
  total_discounts numeric,
  total_taxes     numeric,
  item_count      numeric
)
language sql stable security invoker as $$
  select
    r.id,
    r.receipt_number,
    r.type,
    r.created_at,
    r.store_id,
    s.name      as store_name,
    r.employee_id,
    e.name      as employee_name,
    r.customer_id,
    c.name      as customer_name,
    r.total,
    r.total_discounts,
    r.total_taxes,
    coalesce((select sum(rl.quantity) from receipt_lines rl where rl.receipt_id = r.id), 0) as item_count
  from receipts r
  join stores    s on s.id = r.store_id
  join employees e on e.id = r.employee_id
  left join customers c on c.id = r.customer_id
  where r.status = 'completed'
    and r.created_at >= p_from
    and r.created_at <  p_to
    and (p_store_id is null    or r.store_id    = p_store_id)
    and (p_employee_id is null or r.employee_id = p_employee_id)
  order by r.created_at desc
  limit p_limit;
$$;

-- ── 9. Sesiones de caja ──────────────────────────────────────────────
create or replace function report_cash_sessions(
  p_from        timestamptz,
  p_to          timestamptz,
  p_store_id    uuid default null
) returns table (
  id                       uuid,
  store_id                 uuid,
  store_name               text,
  opened_at                timestamptz,
  closed_at                timestamptz,
  opened_by_name           text,
  closed_by_name           text,
  opening_float            numeric,
  expected_cash            numeric,
  counted_cash             numeric,
  variance                 numeric,
  status                   text,
  total_sales              numeric,
  total_refunds            numeric,
  receipt_count            bigint,
  pay_in                   numeric,
  pay_out                  numeric
)
language sql stable security invoker as $$
  select
    cs.id,
    cs.store_id,
    s.name  as store_name,
    cs.opened_at,
    cs.closed_at,
    eo.name as opened_by_name,
    ec.name as closed_by_name,
    cs.opening_float,
    cs.expected_cash,
    cs.counted_cash,
    cs.variance,
    cs.status,
    coalesce(rs.total_sales, 0)   as total_sales,
    coalesce(rs.total_refunds, 0) as total_refunds,
    coalesce(rs.receipt_count, 0) as receipt_count,
    coalesce(mv.pay_in, 0)        as pay_in,
    coalesce(mv.pay_out, 0)       as pay_out
  from cash_sessions cs
  join stores s on s.id = cs.store_id
  left join employees eo on eo.id = cs.opened_by_employee_id
  left join employees ec on ec.id = cs.closed_by_employee_id
  left join lateral (
    select
      sum(case when r.type = 'sale'   then r.total else 0 end) as total_sales,
      sum(case when r.type = 'refund' then r.total else 0 end) as total_refunds,
      count(*) filter (where r.status = 'completed')           as receipt_count
    from receipts r
    where r.cash_session_id = cs.id and r.status = 'completed'
  ) rs on true
  left join lateral (
    select
      sum(case when m.type = 'pay_in'  then m.amount else 0 end) as pay_in,
      sum(case when m.type = 'pay_out' then m.amount else 0 end) as pay_out
    from cash_movements m
    where m.cash_session_id = cs.id
  ) mv on true
  where cs.opened_at >= p_from
    and cs.opened_at <  p_to
    and (p_store_id is null or cs.store_id = p_store_id)
  order by cs.opened_at desc;
$$;

-- =====================================================================
-- Ejecutar en SQL Editor de Supabase. Idempotente (create or replace).
-- =====================================================================

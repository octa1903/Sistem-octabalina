-- =====================================================================
-- 0005_reports_fixes.sql — Fixes derivados del review de 0004_reports.sql
-- y bug pre-existente en close_cash_session.
--
-- Cambios:
--   1) report_discounts: dedup con CTE + GROUP BY (antes: rows duplicadas
--      cuando un mismo discountId aparecía en ticket-level y line-level).
--   2) report_receipts: cap server-side LEAST(p_limit,500) para evitar
--      DoS de lectura, y reemplazo del correlated subquery por LATERAL.
--   3) Index parcial receipts_store_created_status_idx para acelerar el
--      filtro dominante (store_id, created_at desc) where status='completed'.
--   4) Fix de close_cash_session: el JSONB de payments usa key camelCase
--      `paymentMethodId` (lo que escribe el cliente en
--      receiptService.buildAndSave), no `payment_method_id`. Sin este fix,
--      el desglose por método de pago al cerrar caja siempre venía vacío.
-- =====================================================================

-- ── 1) report_discounts: deduplica ticket + line ─────────────────────
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
  with rows as (
    -- ticket-level
    select d.id as discount_id, d.name as discount_name,
           1::bigint as apply_count,
           _receipt_sign(r.type) * (a->>'amount')::numeric as amount
    from receipts r
    cross join lateral jsonb_array_elements(r.applied_discounts) a
    join discounts d on d.id = (a->>'discountId')::uuid
    where r.status = 'completed'
      and r.created_at >= p_from
      and r.created_at <  p_to
      and (p_store_id is null    or r.store_id    = p_store_id)
      and (p_employee_id is null or r.employee_id = p_employee_id)
    union all
    -- line-level
    select d.id as discount_id, d.name as discount_name,
           1::bigint as apply_count,
           _receipt_sign(r.type) * (a->>'amount')::numeric as amount
    from receipts r
    join receipt_lines rl on rl.receipt_id = r.id
    cross join lateral jsonb_array_elements(rl.line_discounts) a
    join discounts d on d.id = (a->>'discountId')::uuid
    where r.status = 'completed'
      and r.created_at >= p_from
      and r.created_at <  p_to
      and (p_store_id is null    or r.store_id    = p_store_id)
      and (p_employee_id is null or r.employee_id = p_employee_id)
  )
  select
    discount_id,
    discount_name,
    sum(apply_count) as apply_count,
    coalesce(sum(amount), 0) as amount
  from rows
  group by discount_id, discount_name
  order by amount desc;
$$;

-- ── 2) report_receipts: cap p_limit + lateral en lugar de subquery ───
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
    coalesce(items.qty, 0) as item_count
  from receipts r
  join stores    s on s.id = r.store_id
  join employees e on e.id = r.employee_id
  left join customers c on c.id = r.customer_id
  left join lateral (
    select sum(rl.quantity) as qty
    from receipt_lines rl
    where rl.receipt_id = r.id
  ) items on true
  where r.status = 'completed'
    and r.created_at >= p_from
    and r.created_at <  p_to
    and (p_store_id is null    or r.store_id    = p_store_id)
    and (p_employee_id is null or r.employee_id = p_employee_id)
  order by r.created_at desc
  limit least(coalesce(p_limit, 500), 500);
$$;

-- ── 3) Index parcial: filtro dominante (status='completed') ──────────
create index if not exists receipts_store_created_completed_idx
  on receipts (store_id, created_at desc)
  where status = 'completed';

-- ── 4) Fix close_cash_session: el JSONB de payments usa camelCase ────
-- Antes la función miraba `(p->>'payment_method_id')` y nunca encontraba
-- coincidencias contra `payment_methods.id`, así que `v_cash_in` siempre
-- daba 0 → `expected_cash` venía mal y el descuadre quedaba inflado por
-- el monto total de las ventas en efectivo de la sesión.
-- Mantengo idéntica la lógica y firma original; solo cambio la key.
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

  select coalesce(sum(
    case when r.type = 'sale' then (p->>'amount')::numeric
         else -(p->>'amount')::numeric end
  ), 0)
  into v_cash_in
  from receipts r
       cross join lateral jsonb_array_elements(r.payments) p
       join payment_methods pm on pm.id = (p->>'paymentMethodId')::uuid
  where r.cash_session_id = p_session_id
    and r.status = 'completed'
    and pm.type = 'cash';

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
-- Aplicar en SQL Editor de Supabase. Idempotente.
-- =====================================================================

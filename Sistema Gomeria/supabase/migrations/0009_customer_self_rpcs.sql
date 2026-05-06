-- =====================================================================
-- 0009_customer_self_rpcs.sql
--
-- Lecturas del portal cliente. La RLS de customers/receipts/movements
-- exige permisos de empleado, así que el cliente anónimo (con token
-- emitido por customer_login en 0008) no puede leerlos directamente.
-- Estos RPCs SECURITY DEFINER bypassean RLS validando el token de sesión.
--
-- Datos expuestos:
--   - Perfil propio (sin pin_hash, login_attempts, locked_until, auth_user_id)
--   - Movimientos de cuenta corriente propios
--   - Recibos propios + líneas (para historial de compras)
--
-- También se relaja la policy de payment_methods para permitir SELECT a
-- anon: los nombres de métodos de pago no son sensibles y la UI del portal
-- los necesita para mostrar "Pagado con: efectivo / tarjeta / etc".
-- =====================================================================

create or replace function customer_self_profile(p_token uuid)
returns table (
  id uuid,
  name text,
  email text,
  phone text,
  address jsonb,
  birthday date,
  customer_type text,
  wholesale_discount numeric,
  account_balance numeric,
  credit_limit numeric,
  total_visits int,
  total_spent numeric,
  points_balance numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
begin
  select s.customer_id into v_customer_id
  from customer_sessions s
  where s.token = p_token and s.expires_at > now();
  if v_customer_id is null then
    raise exception 'Sesión inválida o expirada.' using errcode = '28000';
  end if;

  return query
    select c.id, c.name, c.email, c.phone, c.address, c.birthday,
           c.customer_type, c.wholesale_discount,
           c.account_balance, c.credit_limit,
           c.total_visits, c.total_spent, c.points_balance
    from customers c where c.id = v_customer_id;
end $$;

revoke all on function customer_self_profile(uuid) from public;
grant execute on function customer_self_profile(uuid) to anon, authenticated;

-- =====================================================================
-- Movimientos de cuenta corriente del propio cliente
-- =====================================================================

create or replace function customer_self_movements(p_token uuid, p_limit int default 50)
returns setof customer_account_movements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
begin
  select s.customer_id into v_customer_id
  from customer_sessions s
  where s.token = p_token and s.expires_at > now();
  if v_customer_id is null then
    raise exception 'Sesión inválida o expirada.' using errcode = '28000';
  end if;

  return query
    select * from customer_account_movements
    where customer_id = v_customer_id
    order by at desc
    limit least(greatest(coalesce(p_limit, 50), 1), 500);
end $$;

revoke all on function customer_self_movements(uuid, int) from public;
grant execute on function customer_self_movements(uuid, int) to anon, authenticated;

-- =====================================================================
-- Recibos del propio cliente (último N) + líneas de cada recibo
-- =====================================================================

create or replace function customer_self_receipts(p_token uuid, p_limit int default 50)
returns table (
  id uuid,
  receipt_number text,
  store_id uuid,
  customer_id uuid,
  type text,
  status text,
  applied_discounts jsonb,
  applied_taxes jsonb,
  payments jsonb,
  subtotal_gross numeric,
  total_discounts numeric,
  subtotal_net numeric,
  total_taxes numeric,
  total numeric,
  points_earned numeric,
  points_redeemed numeric,
  notes text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
begin
  select s.customer_id into v_customer_id
  from customer_sessions s
  where s.token = p_token and s.expires_at > now();
  if v_customer_id is null then
    raise exception 'Sesión inválida o expirada.' using errcode = '28000';
  end if;

  return query
    -- Excluye cash_session_id, employee_id, total_cogs, refund_of_receipt_id, parked_name
    -- (datos internos / margen / costos no expuestos al cliente).
    select r.id, r.receipt_number, r.store_id, r.customer_id,
           r.type, r.status,
           r.applied_discounts, r.applied_taxes, r.payments,
           r.subtotal_gross, r.total_discounts, r.subtotal_net,
           r.total_taxes, r.total,
           r.points_earned, r.points_redeemed,
           r.notes, r.created_at
    from receipts r
    where r.customer_id = v_customer_id
      and r.status = 'completed'
    order by r.created_at desc
    limit least(greatest(coalesce(p_limit, 50), 1), 500);
end $$;

revoke all on function customer_self_receipts(uuid, int) from public;
grant execute on function customer_self_receipts(uuid, int) to anon, authenticated;

create or replace function customer_self_receipt_lines(p_token uuid, p_receipt_ids uuid[])
returns table (
  id uuid,
  receipt_id uuid,
  tire_id uuid,
  tire_brand text,
  tire_model text,
  tire_size text,
  category_id uuid,
  category_name text,
  modifiers jsonb,
  unit_price numeric,
  quantity numeric,
  line_discounts jsonb,
  line_taxes jsonb,
  gross numeric,
  net numeric,
  total numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
begin
  select s.customer_id into v_customer_id
  from customer_sessions s
  where s.token = p_token and s.expires_at > now();
  if v_customer_id is null then
    raise exception 'Sesión inválida o expirada.' using errcode = '28000';
  end if;
  if p_receipt_ids is null or array_length(p_receipt_ids, 1) is null then
    return;
  end if;

  -- sólo devolvemos líneas de recibos que pertenecen a este cliente.
  -- Excluye unit_cost (costo de compra — dato sensible de margen).
  return query
    select rl.id, rl.receipt_id,
           rl.tire_id, rl.tire_brand, rl.tire_model, rl.tire_size,
           rl.category_id, rl.category_name,
           rl.modifiers,
           rl.unit_price, rl.quantity,
           rl.line_discounts, rl.line_taxes,
           rl.gross, rl.net, rl.total
    from receipt_lines rl
    join receipts r on r.id = rl.receipt_id
    where r.customer_id = v_customer_id
      and rl.receipt_id = any(p_receipt_ids);
end $$;

revoke all on function customer_self_receipt_lines(uuid, uuid[]) from public;
grant execute on function customer_self_receipt_lines(uuid, uuid[]) to anon, authenticated;

-- =====================================================================
-- payment_methods: permitir SELECT a anon (nombres no sensibles)
-- =====================================================================

drop policy if exists payment_methods_select on payment_methods;
create policy payment_methods_select on payment_methods for select
  using (true);

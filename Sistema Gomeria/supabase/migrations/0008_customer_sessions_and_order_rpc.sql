-- =====================================================================
-- 0008_customer_sessions_and_order_rpc.sql
--
-- Hardening del portal cliente: en lugar de permitir INSERT anónimo a
-- customer_orders (policy customer_orders_public_insert), introducimos
-- un mecanismo de sesión por token verificado server-side.
--
-- Flujo:
--   1. Cliente hace login con (customer_id, pin) → RPC customer_login
--      verifica el pin contra customers.pin_hash (SHA-256 hex) y devuelve
--      un token UUID con expiración de 24h.
--   2. Para crear pedidos, el portal llama RPC customer_create_order
--      pasando ese token. El RPC valida el token contra customer_sessions
--      y bypass-ea RLS via SECURITY DEFINER.
--
-- La policy public_insert se elimina: ningún anon puede insertar
-- directamente a customer_orders.
--
-- Lockout de fuerza bruta: 5 intentos fallidos consecutivos lockean al
-- cliente por 15 minutos. Implementado via columnas login_attempts y
-- locked_until en customers.
--
-- Nota de diseño: customer_create_order acepta p_total_amount tal como lo
-- envía el cliente. No recalculamos el total server-side (requeriría
-- replicar la engine de precios + impuestos en SQL). El pedido entra como
-- 'pendiente' y el empleado verifica el monto antes de confirmar — la
-- discrepancia es visible en OrdersView. Documentado y aceptado.
-- =====================================================================

alter table customers
  add column if not exists login_attempts int not null default 0,
  add column if not exists locked_until timestamptz;

create table if not exists customer_sessions (
  token uuid primary key default uuid_generate_v4(),
  customer_id uuid not null references customers(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);
create index if not exists customer_sessions_customer_idx on customer_sessions (customer_id);
create index if not exists customer_sessions_expires_idx on customer_sessions (expires_at);

alter table customer_sessions enable row level security;

-- Solo lectura para empleados con backoffice.access (debug / soporte).
-- Escritura sólo via RPCs SECURITY DEFINER.
drop policy if exists customer_sessions_select on customer_sessions;
create policy customer_sessions_select on customer_sessions for select
  using (current_employee_has_permission('backoffice.access'));

-- =====================================================================
-- RPC: customer_login(p_customer_id, p_pin) → token + datos básicos
--
-- Verifica pin (SHA-256 hex) contra customers.pin_hash. No expone el hash
-- al cliente. Limpia sesiones expiradas del propio cliente al loguear.
-- =====================================================================

create or replace function customer_login(p_customer_id uuid, p_pin text)
returns table (
  token uuid,
  customer_id uuid,
  customer_name text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_name text;
  v_input_hash text;
  v_token uuid;
  v_expires timestamptz;
  v_attempts int;
  v_locked_until timestamptz;
begin
  if p_customer_id is null or p_pin is null or length(p_pin) = 0 then
    raise exception 'Datos incompletos.' using errcode = '22023';
  end if;

  select pin_hash, name, login_attempts, locked_until
    into v_hash, v_name, v_attempts, v_locked_until
  from customers where id = p_customer_id;

  if v_hash is null then
    -- mensaje genérico: no distinguimos "cliente no existe" de "sin pin"
    raise exception 'Credenciales inválidas.' using errcode = '28000';
  end if;

  if v_locked_until is not null and v_locked_until > now() then
    raise exception 'Cuenta bloqueada temporalmente. Reintentá más tarde.' using errcode = '28000';
  end if;

  v_input_hash := encode(digest(p_pin, 'sha256'), 'hex');
  if v_input_hash <> v_hash then
    update customers set
      login_attempts = login_attempts + 1,
      locked_until = case when login_attempts + 1 >= 5
                          then now() + interval '15 minutes'
                          else locked_until end
    where id = p_customer_id;
    raise exception 'Credenciales inválidas.' using errcode = '28000';
  end if;

  -- éxito: resetear contador
  update customers set login_attempts = 0, locked_until = null
  where id = p_customer_id and (login_attempts > 0 or locked_until is not null);

  -- limpieza de sesiones expiradas del mismo cliente
  delete from customer_sessions
  where customer_id = p_customer_id and expires_at < now();

  v_expires := now() + interval '24 hours';
  insert into customer_sessions (customer_id, expires_at)
  values (p_customer_id, v_expires)
  returning customer_sessions.token into v_token;

  return query select v_token, p_customer_id, v_name, v_expires;
end $$;

revoke all on function customer_login(uuid, text) from public;
grant execute on function customer_login(uuid, text) to anon, authenticated;

-- =====================================================================
-- RPC: customer_create_order(p_token, ...) → uuid del pedido creado
-- =====================================================================

create or replace function customer_create_order(
  p_token uuid,
  p_store_id uuid,
  p_items jsonb,
  p_payment_method_id uuid,
  p_tipo text,
  p_scheduled_date date,
  p_scheduled_time text,
  p_address text,
  p_notes text,
  p_total_amount numeric
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
  v_customer_name text;
  v_order_id uuid;
  v_numero text;
begin
  if p_token is null then
    raise exception 'Sesión inválida.' using errcode = '28000';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Pedido sin ítems.' using errcode = '22023';
  end if;
  if p_total_amount is null or p_total_amount <= 0 then
    raise exception 'Total inválido.' using errcode = '22023';
  end if;
  if p_store_id is null then
    raise exception 'Tienda requerida.' using errcode = '22023';
  end if;
  if p_tipo not in ('retiro', 'entrega_domicilio') then
    raise exception 'Tipo de pedido inválido.' using errcode = '22023';
  end if;
  if p_payment_method_id is not null and not exists (
    select 1 from payment_methods where id = p_payment_method_id
  ) then
    raise exception 'Método de pago inválido.' using errcode = '22023';
  end if;

  select s.customer_id, c.name into v_customer_id, v_customer_name
  from customer_sessions s
  join customers c on c.id = s.customer_id
  where s.token = p_token and s.expires_at > now();

  if v_customer_id is null then
    raise exception 'Sesión inválida o expirada.' using errcode = '28000';
  end if;

  v_numero := substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  insert into customer_orders (
    numero, customer_id, customer_name, store_id, items,
    payment_method_id, status, tipo,
    scheduled_date, scheduled_time, address, notes, total_amount
  ) values (
    v_numero, v_customer_id, v_customer_name, p_store_id, p_items,
    p_payment_method_id, 'pendiente', p_tipo,
    p_scheduled_date, p_scheduled_time, p_address, p_notes, p_total_amount
  ) returning id into v_order_id;

  return v_order_id;
end $$;

revoke all on function customer_create_order(uuid, uuid, jsonb, uuid, text, date, text, text, text, numeric) from public;
grant execute on function customer_create_order(uuid, uuid, jsonb, uuid, text, date, text, text, text, numeric) to anon, authenticated;

-- =====================================================================
-- RPC opcional: customer_logout(p_token) — libera la sesión.
-- =====================================================================

create or replace function customer_logout(p_token uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from customer_sessions where token = p_token;
$$;

revoke all on function customer_logout(uuid) from public;
grant execute on function customer_logout(uuid) to anon, authenticated;

-- =====================================================================
-- Eliminar policy public_insert (ahora obsoleta — usar RPC).
-- =====================================================================

drop policy if exists customer_orders_public_insert on customer_orders;

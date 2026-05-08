-- =====================================================================
-- 0010_security_hardening.sql
--
-- Endurecimiento post-auditoría 2026-05:
--   1. Cierra fuga cross-tienda en customer_orders y supplier_invoices
--      (las policies aceptaban store_id IS NULL → un empleado de tienda
--      A podía ver/escribir filas globales que en la práctica son de B).
--   2. PIN de cliente: agrega soporte server-side para bcrypt y formato
--      `pbkdf2$<iter>$<salt>$<hash>` (este último coincide con el hash
--      que produce el cliente desde src/utils/hash.ts). El RPC
--      customer_login despacha por prefijo y mantiene compatibilidad
--      hacia atrás con hashes SHA-256 hex pre-existentes.
--
-- Idempotente: se puede correr varias veces sin efectos secundarios.
-- =====================================================================

create extension if not exists pgcrypto;

-- ─── (1) RLS: forzar store_id NOT NULL en transacciones ──────────────

drop policy if exists customer_orders_select on customer_orders;
create policy customer_orders_select on customer_orders for select
  using (store_id is not null and store_in_scope(store_id));

drop policy if exists customer_orders_write on customer_orders;
create policy customer_orders_write on customer_orders for all
  using (
    store_id is not null
    and store_in_scope(store_id)
    and current_employee_has_permission('backoffice.access')
  )
  with check (
    store_id is not null
    and store_in_scope(store_id)
    and current_employee_has_permission('backoffice.access')
  );

drop policy if exists supplier_invoices_select on supplier_invoices;
create policy supplier_invoices_select on supplier_invoices for select
  using (store_id is not null and store_in_scope(store_id));

drop policy if exists supplier_invoices_write on supplier_invoices;
create policy supplier_invoices_write on supplier_invoices for all
  using (
    current_employee_has_permission('backoffice.access')
    and store_id is not null
    and store_in_scope(store_id)
  )
  with check (
    current_employee_has_permission('backoffice.access')
    and store_id is not null
    and store_in_scope(store_id)
  );

-- ─── (2) PIN cliente: verificación server-side multi-formato ────────

-- Implementación de PBKDF2-SHA256 en plpgsql usando hmac de pgcrypto.
-- Sólo se usa para verificar (no para hashear nuevos PINs server-side).
-- Para 300k iteraciones es tolerable (~200-400ms en Postgres) porque
-- los logins son infrecuentes; el rate-limit (5 intentos / 15min) en
-- customer_login limita el costo total.
create or replace function _pbkdf2_sha256_block(
  p_password bytea,
  p_salt bytea,
  p_iter int,
  p_block_index int
) returns bytea language plpgsql immutable as $$
declare
  v_int_block bytea;
  v_u bytea;
  v_t bytea;
  v_i int;
  v_xor bytea;
  v_byte_idx int;
begin
  v_int_block := decode(lpad(to_hex(p_block_index), 8, '0'), 'hex');
  v_u := hmac(p_salt || v_int_block, p_password, 'sha256');
  v_t := v_u;
  for v_i in 2..p_iter loop
    v_u := hmac(v_u, p_password, 'sha256');
    v_xor := decode(repeat('00', length(v_t)), 'hex');
    for v_byte_idx in 0..length(v_t) - 1 loop
      v_xor := set_byte(v_xor, v_byte_idx, get_byte(v_t, v_byte_idx) # get_byte(v_u, v_byte_idx));
    end loop;
    v_t := v_xor;
  end loop;
  return v_t;
end $$;

create or replace function _pbkdf2_sha256(
  p_password bytea,
  p_salt bytea,
  p_iter int,
  p_dklen int
) returns bytea language plpgsql immutable as $$
declare
  v_blocks int := ceil(p_dklen::numeric / 32);
  v_result bytea := ''::bytea;
  v_i int;
begin
  for v_i in 1..v_blocks loop
    v_result := v_result || _pbkdf2_sha256_block(p_password, p_salt, p_iter, v_i);
  end loop;
  return substring(v_result from 1 for p_dklen);
end $$;

create or replace function _verify_customer_pin(p_pin text, p_hash text)
returns boolean
language plpgsql immutable as $$
declare
  v_parts text[];
  v_iter int;
  v_salt bytea;
  v_expected bytea;
  v_actual bytea;
begin
  if p_pin is null or p_hash is null or length(p_hash) = 0 then
    return false;
  end if;

  -- Formato bcrypt: $2a$… / $2b$… / $2y$…
  if p_hash like '$2_$%' then
    return crypt(p_pin, p_hash) = p_hash;
  end if;

  -- Formato PBKDF2 (mismo del cliente): pbkdf2$<iter>$<saltHex>$<hashHex>
  if p_hash like 'pbkdf2$%' then
    v_parts := string_to_array(p_hash, '$');
    if array_length(v_parts, 1) <> 4 then return false; end if;
    begin
      v_iter := v_parts[2]::int;
      v_salt := decode(v_parts[3], 'hex');
      v_expected := decode(v_parts[4], 'hex');
    exception when others then
      return false;
    end;
    if v_iter < 1 or length(v_salt) = 0 or length(v_expected) = 0 then
      return false;
    end if;
    v_actual := _pbkdf2_sha256(convert_to(p_pin, 'UTF8'), v_salt, v_iter, length(v_expected));
    return v_actual = v_expected;
  end if;

  -- Legacy: SHA-256 hex (64 chars)
  return encode(digest(p_pin, 'sha256'), 'hex') = p_hash;
end $$;

-- Reemplaza customer_login para usar el verificador multi-formato.
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
  v_token uuid;
  v_expires timestamptz;
  v_locked_until timestamptz;
begin
  if p_customer_id is null or p_pin is null or length(p_pin) = 0 then
    raise exception 'Datos incompletos.' using errcode = '22023';
  end if;

  select pin_hash, name, locked_until
    into v_hash, v_name, v_locked_until
  from customers where id = p_customer_id;

  if v_hash is null then
    raise exception 'Credenciales inválidas.' using errcode = '28000';
  end if;

  if v_locked_until is not null and v_locked_until > now() then
    raise exception 'Cuenta bloqueada temporalmente. Reintentá más tarde.' using errcode = '28000';
  end if;

  if not _verify_customer_pin(p_pin, v_hash) then
    update customers set
      login_attempts = login_attempts + 1,
      locked_until = case when login_attempts + 1 >= 5
                          then now() + interval '15 minutes'
                          else locked_until end
    where id = p_customer_id;
    raise exception 'Credenciales inválidas.' using errcode = '28000';
  end if;

  update customers set login_attempts = 0, locked_until = null
  where id = p_customer_id and (login_attempts > 0 or locked_until is not null);

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
-- Lockout server-side para login de empleado (defensa contra brute force
-- desde múltiples sesiones, ya que el lockout en useAuth es client-side
-- y se resetea con F5).
--
-- Diferimos a Supabase Auth's brute force protection (configurable en el
-- dashboard del proyecto). Esta migración deja documentado el ítem.
-- =====================================================================

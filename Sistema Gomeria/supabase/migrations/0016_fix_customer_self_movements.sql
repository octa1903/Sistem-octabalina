-- =====================================================================
-- 0011_fix_customer_self_movements.sql
--
-- M3 del audit 2026-05: customer_self_movements devolvía `setof
-- customer_account_movements` (todas las columnas), lo que expone
-- `employee_id` al cliente y hace que cualquier columna futura quede
-- accesible automáticamente.
--
-- Cambiamos a retorno tipado explícito. `employee_id` queda excluido:
-- no es necesario para el portal y expone un UUID interno.
-- =====================================================================

create or replace function customer_self_movements(p_token uuid, p_limit int default 50)
returns table (
  id uuid,
  customer_id uuid,
  type text,
  amount numeric,
  payment_method_id uuid,
  notes text,
  receipt_id uuid,
  at timestamptz
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
    select m.id, m.customer_id, m.type, m.amount,
           m.payment_method_id, m.notes, m.receipt_id, m.at
    from customer_account_movements m
    where m.customer_id = v_customer_id
    order by m.at desc
    limit least(greatest(coalesce(p_limit, 50), 1), 500);
end $$;

revoke all on function customer_self_movements(uuid, int) from public;
grant execute on function customer_self_movements(uuid, int) to anon, authenticated;

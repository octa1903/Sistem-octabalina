-- =====================================================================
-- 0010_customer_self_orders.sql
--
-- Complemento a 0009: el portal cliente también necesita listar sus
-- propios pedidos (MyOrdersView). La policy customer_orders_select
-- exige store_in_scope(store_id) → falsa para anon. Sin RPC, el cliente
-- recibe lista vacía silenciosamente.
-- =====================================================================

create or replace function customer_self_orders(p_token uuid, p_limit int default 100)
returns table (
  id uuid,
  numero text,
  customer_id uuid,
  customer_name text,
  store_id uuid,
  items jsonb,
  payment_method_id uuid,
  status text,
  tipo text,
  scheduled_date date,
  scheduled_time text,
  address text,
  notes text,
  client_message text,
  total_amount numeric,
  created_at timestamptz,
  updated_at timestamptz
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

  -- Excluye internal_notes (uso interno de la gomería) y confirmed_by_employee_id.
  return query
    select o.id, o.numero, o.customer_id, o.customer_name, o.store_id,
           o.items, o.payment_method_id, o.status, o.tipo,
           o.scheduled_date, o.scheduled_time, o.address, o.notes,
           o.client_message, o.total_amount, o.created_at, o.updated_at
    from customer_orders o
    where o.customer_id = v_customer_id
    order by o.created_at desc
    limit least(greatest(coalesce(p_limit, 100), 1), 500);
end $$;

revoke all on function customer_self_orders(uuid, int) from public;
grant execute on function customer_self_orders(uuid, int) to anon, authenticated;

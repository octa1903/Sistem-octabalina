-- =====================================================================
-- 0011_customer_create_order_recompute.sql
--
-- Cierra la limitación documentada en 0008: el RPC `customer_create_order`
-- aceptaba `p_total_amount` tal como lo enviaba el portal cliente, lo que
-- permitía a un cliente malicioso registrar un pedido con total=0.
--
-- Esta migración:
--   1. Drop del RPC viejo (10 args, con p_total_amount).
--   2. Crea uno nuevo (9 args) que recalcula el total server-side a partir
--      de los items, leyendo el precio de tire_store_overrides.price del
--      store_id, fallback a tires.default_price, y aplicando descuento
--      mayorista si el customer.customer_type='wholesale'.
--   3. Reescribe items[].unit_price y items[].subtotal con los valores
--      autoritativos antes de insertar — así OrdersView y los recibos ven
--      precios coherentes.
--
-- La engine de precios server-side replica `priceFor` de CatalogView:
--     price_unit = round(base * (1 - discount/100))   si wholesale
--     price_unit = base                                en otro caso
-- donde base = COALESCE(override.price, tire.default_price).
--
-- IVA y modificadores no se aplican en pedidos online (consistente con la
-- UI: el portal no calcula impuestos — eso lo hace POS al confirmar).
-- =====================================================================

drop function if exists customer_create_order(uuid, uuid, jsonb, uuid, text, date, text, text, text, numeric);

create or replace function customer_create_order(
  p_token uuid,
  p_store_id uuid,
  p_items jsonb,
  p_payment_method_id uuid,
  p_tipo text,
  p_scheduled_date date,
  p_scheduled_time text,
  p_address text,
  p_notes text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
  v_customer_name text;
  v_customer_type text;
  v_wholesale_discount numeric;
  v_order_id uuid;
  v_numero text;
  v_item jsonb;
  v_tire_id uuid;
  v_qty numeric;
  v_base_price numeric;
  v_unit_price numeric;
  v_subtotal numeric;
  v_total numeric := 0;
  v_brand text;
  v_model text;
  v_size text;
  v_priced_items jsonb := '[]'::jsonb;
begin
  if p_token is null then
    raise exception 'Sesión inválida.' using errcode = '28000';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Pedido sin ítems.' using errcode = '22023';
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

  -- Validar sesión + leer datos del cliente.
  select s.customer_id, c.name, c.customer_type, c.wholesale_discount
    into v_customer_id, v_customer_name, v_customer_type, v_wholesale_discount
  from customer_sessions s
  join customers c on c.id = s.customer_id
  where s.token = p_token and s.expires_at > now();

  if v_customer_id is null then
    raise exception 'Sesión inválida o expirada.' using errcode = '28000';
  end if;

  -- Recompute total + reemplazar unit_price/subtotal item por item.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    if v_item ? 'tireId' = false then
      raise exception 'Ítem sin tireId.' using errcode = '22023';
    end if;
    v_tire_id := (v_item->>'tireId')::uuid;
    v_qty := coalesce((v_item->>'quantity')::numeric, 0);
    if v_qty <= 0 then
      raise exception 'Cantidad inválida.' using errcode = '22023';
    end if;

    select t.brand, t.model, t.size,
           coalesce(tso.price, t.default_price)
      into v_brand, v_model, v_size, v_base_price
    from tires t
    left join tire_store_overrides tso
      on tso.tire_id = t.id and tso.store_id = p_store_id
    where t.id = v_tire_id;

    if v_base_price is null then
      raise exception 'Producto sin precio configurado para esta tienda.' using errcode = '22023';
    end if;

    if v_customer_type = 'wholesale' and coalesce(v_wholesale_discount, 0) > 0 then
      v_unit_price := round(v_base_price * (1 - v_wholesale_discount / 100));
    else
      v_unit_price := v_base_price;
    end if;

    v_subtotal := v_unit_price * v_qty;
    v_total := v_total + v_subtotal;

    v_priced_items := v_priced_items || jsonb_build_object(
      'tireId',    v_tire_id::text,
      'brand',     v_brand,
      'model',     v_model,
      'size',      v_size,
      'quantity',  v_qty,
      'unitPrice', v_unit_price,
      'subtotal',  v_subtotal
    );
  end loop;

  if v_total <= 0 then
    raise exception 'Total inválido.' using errcode = '22023';
  end if;

  v_numero := substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  insert into customer_orders (
    numero, customer_id, customer_name, store_id, items,
    payment_method_id, status, tipo,
    scheduled_date, scheduled_time, address, notes, total_amount
  ) values (
    v_numero, v_customer_id, v_customer_name, p_store_id, v_priced_items,
    p_payment_method_id, 'pendiente', p_tipo,
    p_scheduled_date, p_scheduled_time, p_address, p_notes, v_total
  ) returning id into v_order_id;

  return v_order_id;
end $$;

revoke all on function customer_create_order(uuid, uuid, jsonb, uuid, text, date, text, text, text) from public;
grant execute on function customer_create_order(uuid, uuid, jsonb, uuid, text, date, text, text, text) to anon, authenticated;

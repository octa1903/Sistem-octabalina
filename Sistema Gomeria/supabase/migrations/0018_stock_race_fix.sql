-- =====================================================================
-- 0018_stock_race_fix.sql
-- Reemplaza apply_receipt_to_stock con dos mejoras:
--   (1) Lock ordenado por tire_id (FOR UPDATE) — previene deadlocks cuando
--       dos receipts concurrentes tocan el mismo SKU desde TPVs distintos.
--   (2) Si app_features.negative_stock_alert = true y type = 'sale',
--       valida post-update que ningún tire_store_overrides.stock quedó < 0;
--       aborta con SQLSTATE 23514 y hint = 'negative_stock'.
--
-- El RPC original vive en 0001_init.sql:414-432.
-- =====================================================================

begin;

create or replace function apply_receipt_to_stock(p_receipt_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  sign int;
  v_negative_alert boolean;
  v_bad_count int;
  v_bad_tire_id uuid;
begin
  select store_id, type into r from receipts where id = p_receipt_id;
  if r is null then
    raise exception 'Receipt % no encontrado', p_receipt_id;
  end if;
  sign := case when r.type = 'sale' then -1 else 1 end;

  -- (1) Lock ordenado anti-deadlock: tomamos todas las filas afectadas
  --     en orden de tire_id antes de mutarlas.
  perform 1 from tire_store_overrides tso
   where tso.store_id = r.store_id
     and tso.tire_id in (
       select rl.tire_id from receipt_lines rl
        where rl.receipt_id = p_receipt_id
     )
   order by tso.tire_id
   for update;

  -- Aplicar el delta
  update tire_store_overrides tso
  set stock = tso.stock + sign * rl.quantity
  from receipt_lines rl
  where rl.receipt_id = p_receipt_id
    and tso.tire_id  = rl.tire_id
    and tso.store_id = r.store_id;

  -- (2) Validación de stock negativo si está habilitada y es venta
  if r.type = 'sale' then
    select coalesce(af.negative_stock_alert, true)
      into v_negative_alert
      from app_features af
     where af.singleton = true;

    if coalesce(v_negative_alert, true) then
      select count(*), min(tso.tire_id)
        into v_bad_count, v_bad_tire_id
        from tire_store_overrides tso
        join receipt_lines rl on rl.tire_id = tso.tire_id
       where rl.receipt_id = p_receipt_id
         and tso.store_id = r.store_id
         and tso.stock < 0;

      if v_bad_count > 0 then
        raise exception
          'Stock insuficiente para % SKU(s) en esta tienda (primero: %)',
          v_bad_count, v_bad_tire_id
          using errcode = '23514',
                hint   = 'negative_stock';
      end if;
    end if;
  end if;
end $$;

comment on function apply_receipt_to_stock(uuid) is
  'Aplica el delta de stock para un receipt. v2 (0018): lock ordenado anti-deadlock + validación negative_stock (errcode 23514, hint negative_stock).';

commit;

-- =====================================================================
-- 0014_bulk_adjust_tire_prices.sql
--
-- Ajuste masivo de precios y costos de neumáticos. Pensado para dos
-- escenarios típicos en gomería:
--   1) Sube un impuesto/ganancia y quiero subir el precio de TODO un %.
--   2) Sube el costo de Continental/Fate y quiero ajustar sólo esa marca.
--
-- Diseño tipo "checkbox": el llamador decide qué tres campos tocar
-- independientemente:
--   p_touch_cost           → tires.cost
--   p_touch_default_price  → tires.default_price
--   p_touch_overrides      → tire_store_overrides.price (en p_store_id)
--
-- Filtros opcionales (AND): p_brand, p_category_id.
-- Si p_store_id es NULL y p_touch_overrides=true, NO se tocan overrides
-- (necesitamos saber qué tienda).
--
-- p_pct_delta: porcentaje (puede ser negativo). Ej: 5 → ×1.05; -10 → ×0.90.
--   Cap defensivo: |p_pct_delta| <= 100. Si querés más, hacelo en pasos.
--
-- p_dry_run=true → no escribe, sólo devuelve el conteo de filas que
-- serían afectadas. Pensado para mostrar preview en la UI.
--
-- Permiso requerido: tires.manage. SECURITY DEFINER para escribir
-- atómicamente bajo RLS, pero validamos el permiso del caller.
-- =====================================================================

create or replace function bulk_adjust_tire_prices(
  p_pct_delta numeric,
  p_brand text default null,
  p_category_id uuid default null,
  p_store_id uuid default null,
  p_touch_cost boolean default false,
  p_touch_default_price boolean default false,
  p_touch_overrides boolean default false,
  p_dry_run boolean default true
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_factor numeric;
  v_tires_count int := 0;
  v_overrides_count int := 0;
begin
  -- Permisos
  if not current_employee_has_permission('tires.manage') then
    raise exception 'No tenés permiso para ajustar precios (tires.manage).';
  end if;

  -- Validaciones
  if p_pct_delta is null then
    raise exception 'Porcentaje requerido.';
  end if;
  if abs(p_pct_delta) > 100 then
    raise exception 'Cap de seguridad: el ajuste no puede exceder ±100%% en una sola operación.';
  end if;
  if not (p_touch_cost or p_touch_default_price or p_touch_overrides) then
    raise exception 'Marcá al menos un campo a ajustar (costo, precio base, o precios por tienda).';
  end if;
  if p_touch_overrides and p_store_id is null then
    raise exception 'Para ajustar precios por tienda hay que indicar la tienda.';
  end if;
  if p_store_id is not null and not store_in_scope(p_store_id) then
    raise exception 'La tienda indicada no está en tu scope.';
  end if;

  v_factor := 1 + (p_pct_delta / 100.0);

  -- Conteo de tires que matchean filtros (sirve para preview y para el resumen)
  if p_touch_cost or p_touch_default_price then
    select count(*) into v_tires_count
    from tires t
    where (p_brand is null or t.brand = p_brand)
      and (p_category_id is null or t.category_id = p_category_id);
  end if;

  -- Conteo de overrides que matchean (sólo si vamos a tocar overrides)
  if p_touch_overrides then
    select count(*) into v_overrides_count
    from tire_store_overrides o
    join tires t on t.id = o.tire_id
    where o.store_id = p_store_id
      and (p_brand is null or t.brand = p_brand)
      and (p_category_id is null or t.category_id = p_category_id);
  end if;

  if p_dry_run then
    return json_build_object(
      'dry_run', true,
      'factor', v_factor,
      'tires_count', v_tires_count,
      'overrides_count', v_overrides_count
    );
  end if;

  -- Escritura real, transaccional
  if p_touch_cost and p_touch_default_price then
    update tires t
       set cost = round(t.cost * v_factor, 2),
           default_price = round(t.default_price * v_factor, 2)
     where (p_brand is null or t.brand = p_brand)
       and (p_category_id is null or t.category_id = p_category_id);
  elsif p_touch_cost then
    update tires t
       set cost = round(t.cost * v_factor, 2)
     where (p_brand is null or t.brand = p_brand)
       and (p_category_id is null or t.category_id = p_category_id);
  elsif p_touch_default_price then
    update tires t
       set default_price = round(t.default_price * v_factor, 2)
     where (p_brand is null or t.brand = p_brand)
       and (p_category_id is null or t.category_id = p_category_id);
  end if;

  if p_touch_overrides then
    update tire_store_overrides o
       set price = round(o.price * v_factor, 2)
      from tires t
     where o.tire_id = t.id
       and o.store_id = p_store_id
       and (p_brand is null or t.brand = p_brand)
       and (p_category_id is null or t.category_id = p_category_id);
  end if;

  return json_build_object(
    'dry_run', false,
    'factor', v_factor,
    'tires_count', v_tires_count,
    'overrides_count', v_overrides_count
  );
end $$;

grant execute on function bulk_adjust_tire_prices(
  numeric, text, uuid, uuid, boolean, boolean, boolean, boolean
) to authenticated;

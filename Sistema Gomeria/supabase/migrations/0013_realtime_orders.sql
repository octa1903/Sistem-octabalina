-- =====================================================================
-- 0013_realtime_orders.sql
--
-- Fase 7 — Realtime: el operador del TPV ve pedidos online del portal
-- cliente sin recargar OrdersView.
--
-- Agrega `customer_orders` a la publicación `supabase_realtime`. Las
-- políticas RLS existentes ya restringen el SELECT por scope de tienda,
-- así que el canal sólo emitirá filas a empleados con permiso.
-- Idempotente: usa DO + check de pg_publication_tables.
-- =====================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'customer_orders'
  ) then
    alter publication supabase_realtime add table public.customer_orders;
  end if;
end $$;

-- replica identity full para que UPDATE/DELETE incluyan el row anterior
-- (necesario para que el cliente reconozca cambios por id sin requerir
-- toda la fila previa cacheada).
-- NOTA: el OLD record en payload de realtime expone TODAS las columnas
-- (incluido internal_notes, confirmed_by_employee_id). Hoy sólo se
-- suscribe el TPV de empleados — no exponer este canal al portal cliente.
alter table public.customer_orders replica identity full;

-- Hardening preventivo (auditor 0013): la policy SELECT actual permite
-- store_id IS NULL como visible para cualquier empleado autenticado.
-- En la práctica nunca debería existir un customer_order sin store_id
-- (la policy de INSERT pública lo exige), pero al activar realtime
-- queremos garantizar que un bug futuro no broadcastee a todas las
-- tiendas. Recreamos la policy sin la rama "store_id is null".
do $$
begin
  if exists (select 1 from public.customer_orders where store_id is null) then
    raise exception 'Hay customer_orders con store_id NULL. Asignar tienda antes de aplicar 0013.';
  end if;
end $$;

drop policy if exists customer_orders_select on public.customer_orders;
create policy customer_orders_select on public.customer_orders for select
  using (store_in_scope(store_id));

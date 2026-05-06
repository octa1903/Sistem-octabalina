-- =====================================================================
-- 0006_customer_orders_public_insert.sql
--
-- Decisión de diseño:
--   El portal cliente (CatalogView) inserta pedidos sin tener una sesión
--   Supabase Auth — el cliente se identifica con PIN local y un customer_id
--   conocido (UUID de la tabla customers). La policy customer_orders_write
--   existente exige `current_employee_has_permission('backoffice.access')`
--   en el WITH CHECK, lo que bloquearía ese INSERT.
--
--   Agregamos una policy separada solo para INSERT que permite a cualquier
--   llamada anónima crear un pedido siempre que:
--     1. customer_id sea un UUID que exista en la tabla customers.
--     2. store_id esté seteado (no null).
--     3. items no esté vacío.
--     4. total_amount sea > 0.
--
--   SELECT / UPDATE / DELETE siguen bajo customer_orders_write (solo
--   empleados con backoffice.access). Los clientes solo pueden insertar.
--
-- Interacción con customer_orders_write (FOR ALL):
--   En Postgres, múltiples policies permissive se combinan con OR.
--   El INSERT anónimo NO satisface el WITH CHECK de customer_orders_write
--   (porque no hay employee), pero sí satisface esta policy nueva → pasa.
--   El USING de customer_orders_write no aplica a INSERT (USING filtra
--   filas existentes, no nuevas), por lo que no hay conflicto real.
--
-- Vector de abuso conocido (aceptado): un atacante anónimo puede enumerar
-- UUIDs de customers probando hasta acertar uno y crear pedidos spam.
-- Mitigación a futuro: token firmado por customer al cargar el portal.
-- Para un POS de gomería local con tráfico bajo es aceptable.
-- =====================================================================

drop policy if exists customer_orders_public_insert on customer_orders;

create policy customer_orders_public_insert on customer_orders
  for insert
  with check (
    customer_id is not null
    and exists (select 1 from customers where id = customer_id)
    and store_id is not null
    and jsonb_array_length(items) > 0
    and total_amount > 0
  );

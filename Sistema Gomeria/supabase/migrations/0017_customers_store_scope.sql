-- =====================================================================
-- 0017_customers_store_scope.sql
-- Cierra fuga cross-tienda en `customers`: un empleado solo puede ver
-- clientes ligados a las tiendas de su scope.
--
-- Modelo: un cliente pertenece a una tienda si:
--   (a) tiene al menos un receipt en una tienda del scope, o
--   (b) tiene al menos un customer_account_movement ligado a tal receipt, o
--   (c) (futuro Fase 2) tiene `import_store_id` en una tienda del scope.
--
-- Admin global (employees.store_ids = NULL) ve todo.
-- =====================================================================

begin;

-- ── Helper: customer_in_scope ────────────────────────────────────────
-- Stable + security definer para que pueda leer receipts/movements
-- sin tropezar con RLS de esas tablas dentro del propio chequeo.
create or replace function customer_in_scope(p_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    -- (1) Admin global
    current_employee_store_ids() is null
    -- (2) Cliente con receipt en una tienda del scope
    or exists (
      select 1 from receipts r
      where r.customer_id = p_customer_id
        and r.store_id = any(current_employee_store_ids())
    )
    -- (3) Cliente con movement ligado a receipt en scope
    or exists (
      select 1 from customer_account_movements m
      join receipts r on r.id = m.receipt_id
      where m.customer_id = p_customer_id
        and r.store_id = any(current_employee_store_ids())
    ),
    false
  );
$$;

comment on function customer_in_scope(uuid) is
  'Returns true if the customer has any receipt/movement in the current employee''s store scope, or if employee is admin global. Used by customers/customer_account_movements RLS policies.';

-- ── Reemplazo de policies de customers ───────────────────────────────
drop policy if exists customers_select on customers;
drop policy if exists customers_write  on customers;

-- SELECT: requiere customers.view + estar en scope (admin ve todo)
create policy customers_select on customers for select
  using (
    current_employee_has_permission('customers.view')
    and customer_in_scope(id)
  );

-- INSERT: customers.manage; la pertenencia se establece después al ligar
-- al primer receipt (Fase 1) o vía import_store_id (Fase 2).
-- Sin restricción de scope acá porque el cliente nuevo aún no tiene receipts.
create policy customers_insert on customers for insert
  with check (current_employee_has_permission('customers.manage'));

-- UPDATE: customers.manage + estar en scope (no podés editar clientes ajenos)
create policy customers_update on customers for update
  using (
    current_employee_has_permission('customers.manage')
    and customer_in_scope(id)
  )
  with check (
    current_employee_has_permission('customers.manage')
    and customer_in_scope(id)
  );

-- DELETE: customers.manage + scope
create policy customers_delete on customers for delete
  using (
    current_employee_has_permission('customers.manage')
    and customer_in_scope(id)
  );

-- ── Reemplazo de policies de customer_account_movements ──────────────
-- Asumimos que ya existen — las dropeamos si están y las recreamos.
drop policy if exists customer_account_movements_select on customer_account_movements;
drop policy if exists customer_account_movements_write  on customer_account_movements;
drop policy if exists customer_account_movements_insert on customer_account_movements;
drop policy if exists customer_account_movements_update on customer_account_movements;
drop policy if exists customer_account_movements_delete on customer_account_movements;

create policy customer_account_movements_select on customer_account_movements for select
  using (
    current_employee_has_permission('customers.view')
    and customer_in_scope(customer_id)
  );

-- INSERT: customers.manage + scope. Excepción: cliente recién creado sin
-- receipts aún (admin lo dio de alta y antes del primer receipt quiere
-- registrar un cargo manual) — se permite si no hay receipts.
create policy customer_account_movements_insert on customer_account_movements for insert
  with check (
    current_employee_has_permission('customers.manage')
    and (
      customer_in_scope(customer_id)
      or not exists (
        select 1 from receipts r where r.customer_id = customer_account_movements.customer_id
      )
    )
  );

create policy customer_account_movements_update on customer_account_movements for update
  using (
    current_employee_has_permission('customers.manage')
    and customer_in_scope(customer_id)
  )
  with check (
    current_employee_has_permission('customers.manage')
    and customer_in_scope(customer_id)
  );

create policy customer_account_movements_delete on customer_account_movements for delete
  using (
    current_employee_has_permission('customers.manage')
    and customer_in_scope(customer_id)
  );

-- ── Índice de soporte ─────────────────────────────────────────────────
-- customer_in_scope lookups: receipts.customer_id + store_id
create index if not exists receipts_customer_store_idx
  on receipts (customer_id, store_id)
  where customer_id is not null;

-- customer_account_movements.customer_id ya debería estar indexado vía FK,
-- pero garantizamos el predicate.
create index if not exists customer_account_movements_customer_receipt_idx
  on customer_account_movements (customer_id, receipt_id)
  where receipt_id is not null;

commit;

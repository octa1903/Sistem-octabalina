-- =====================================================================
-- 0002_rls.sql — Row-Level Security
-- Modelo: cada empleado autenticado (auth.uid()) accede sólo a las
-- tiendas que tiene en employees.store_ids; null = todas las tiendas.
-- =====================================================================

-- ── Helpers ────────────────────────────────────────────────────────────

create or replace function current_employee_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from employees where auth_user_id = auth.uid() and active limit 1;
$$;

create or replace function current_employee_store_ids() returns uuid[]
language sql stable security definer set search_path = public as $$
  select store_ids from employees where auth_user_id = auth.uid() and active limit 1;
$$;

create or replace function current_employee_role() returns text
language sql stable security definer set search_path = public as $$
  select r.name from employees e join roles r on r.id = e.role_id
  where e.auth_user_id = auth.uid() and e.active limit 1;
$$;

create or replace function current_employee_has_permission(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from employees e
    join roles r on r.id = e.role_id
    where e.auth_user_id = auth.uid()
      and e.active
      and (p = any(r.permissions))
  );
$$;

create or replace function store_in_scope(p_store_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    -- null en store_ids = "todas las tiendas"
    current_employee_store_ids() is null
    or p_store_id = any(current_employee_store_ids()),
    false
  );
$$;

-- ── Activar RLS en todas las tablas ───────────────────────────────────

alter table stores                       enable row level security;
alter table categories                   enable row level security;
alter table tires                        enable row level security;
alter table tire_store_overrides         enable row level security;
alter table modifier_groups              enable row level security;
alter table discounts                    enable row level security;
alter table taxes                        enable row level security;
alter table payment_methods              enable row level security;
alter table roles                        enable row level security;
alter table employees                    enable row level security;
alter table customers                    enable row level security;
alter table cash_sessions                enable row level security;
alter table cash_movements               enable row level security;
alter table receipts                     enable row level security;
alter table receipt_lines                enable row level security;
alter table app_features                 enable row level security;
alter table loyalty_config               enable row level security;
alter table receipt_config               enable row level security;
alter table open_tickets_config          enable row level security;
alter table supplier_invoices            enable row level security;
alter table customer_orders              enable row level security;
alter table customer_account_movements   enable row level security;
alter table app_metadata                 enable row level security;
alter table wholesale_config             enable row level security;
alter table order_config                 enable row level security;

-- ── Catálogo: lectura para autenticados, escritura por permiso ────────

-- stores: lectura sólo de las tiendas en scope, escritura settings.manage
create policy stores_select on stores for select
  using (store_in_scope(id));
create policy stores_write on stores for all
  using (current_employee_has_permission('settings.manage'))
  with check (current_employee_has_permission('settings.manage'));

-- categories: lectura para autenticados; escritura items.manage
create policy categories_select on categories for select
  using (auth.uid() is not null);
create policy categories_write on categories for all
  using (current_employee_has_permission('tires.manage'))
  with check (current_employee_has_permission('tires.manage'));

-- tires: lectura tires.view; escritura tires.manage
create policy tires_select on tires for select
  using (current_employee_has_permission('tires.view'));
create policy tires_write on tires for all
  using (current_employee_has_permission('tires.manage'))
  with check (current_employee_has_permission('tires.manage'));

-- overrides: lectura sólo si la tienda está en scope; escritura tires.manage
create policy tso_select on tire_store_overrides for select
  using (store_in_scope(store_id));
create policy tso_write on tire_store_overrides for all
  using (current_employee_has_permission('tires.manage') and store_in_scope(store_id))
  with check (current_employee_has_permission('tires.manage') and store_in_scope(store_id));

-- modifiers / discounts / taxes / payment methods: lectura autenticada, escritura settings/items
create policy modifiers_select on modifier_groups for select
  using (auth.uid() is not null);
create policy modifiers_write on modifier_groups for all
  using (current_employee_has_permission('tires.manage'))
  with check (current_employee_has_permission('tires.manage'));

create policy discounts_select on discounts for select
  using (auth.uid() is not null);
create policy discounts_write on discounts for all
  using (current_employee_has_permission('tires.manage'))
  with check (current_employee_has_permission('tires.manage'));

create policy taxes_select on taxes for select
  using (auth.uid() is not null);
create policy taxes_write on taxes for all
  using (current_employee_has_permission('settings.manage'))
  with check (current_employee_has_permission('settings.manage'));

create policy payment_methods_select on payment_methods for select
  using (auth.uid() is not null);
create policy payment_methods_write on payment_methods for all
  using (current_employee_has_permission('settings.manage'))
  with check (current_employee_has_permission('settings.manage'));

-- ── Personas ──────────────────────────────────────────────────────────

-- roles: lectura para todos los autenticados, escritura employees.manage
create policy roles_select on roles for select
  using (auth.uid() is not null);
create policy roles_write on roles for all
  using (current_employee_has_permission('employees.manage') and not is_system)
  with check (current_employee_has_permission('employees.manage') and not is_system);

-- employees: cada empleado puede leer su propia fila + lecturas con employees.manage
create policy employees_select on employees for select
  using (
    auth_user_id = auth.uid()
    or current_employee_has_permission('employees.manage')
  );
create policy employees_write on employees for all
  using (current_employee_has_permission('employees.manage'))
  with check (current_employee_has_permission('employees.manage'));

-- customers: lectura customers.view, escritura customers.manage
create policy customers_select on customers for select
  using (current_employee_has_permission('customers.view'));
create policy customers_write on customers for all
  using (current_employee_has_permission('customers.manage'))
  with check (current_employee_has_permission('customers.manage'));

-- ── Transacciones ─────────────────────────────────────────────────────

-- cash_sessions: lectura por scope de tienda; insert pos.openCash; update close
create policy cash_sessions_select on cash_sessions for select
  using (store_in_scope(store_id));
create policy cash_sessions_insert on cash_sessions for insert
  with check (
    store_in_scope(store_id)
    and current_employee_has_permission('pos.openCash')
  );
create policy cash_sessions_update on cash_sessions for update
  using (store_in_scope(store_id))
  with check (
    store_in_scope(store_id)
    and current_employee_has_permission('pos.closeCash')
  );

-- cash_movements: lectura por scope (vía sesión); insert pos.cashMovement
create policy cash_movements_select on cash_movements for select
  using (
    exists (
      select 1 from cash_sessions s
      where s.id = cash_movements.cash_session_id
        and store_in_scope(s.store_id)
    )
  );
create policy cash_movements_insert on cash_movements for insert
  with check (
    current_employee_has_permission('pos.cashMovement')
    and exists (
      select 1 from cash_sessions s
      where s.id = cash_movements.cash_session_id
        and s.status = 'open'
        and store_in_scope(s.store_id)
    )
  );

-- receipts: lectura por scope; insert pos.sell; refunds requieren pos.refund
create policy receipts_select on receipts for select
  using (store_in_scope(store_id));
create policy receipts_insert on receipts for insert
  with check (
    store_in_scope(store_id)
    and (
      (type = 'sale'   and current_employee_has_permission('pos.sell'))
      or (type = 'refund' and current_employee_has_permission('pos.refund'))
    )
  );
create policy receipts_update on receipts for update
  using (store_in_scope(store_id))
  with check (store_in_scope(store_id));

-- receipt_lines: derivado del receipt
create policy receipt_lines_select on receipt_lines for select
  using (
    exists (
      select 1 from receipts r
      where r.id = receipt_lines.receipt_id
        and store_in_scope(r.store_id)
    )
  );
create policy receipt_lines_insert on receipt_lines for insert
  with check (
    exists (
      select 1 from receipts r
      where r.id = receipt_lines.receipt_id
        and store_in_scope(r.store_id)
    )
  );

-- ── Configuración ─────────────────────────────────────────────────────

create policy app_features_rw on app_features for all
  using (current_employee_has_permission('settings.manage') or current_employee_has_permission('backoffice.access'))
  with check (current_employee_has_permission('settings.manage'));

create policy loyalty_config_rw on loyalty_config for all
  using (auth.uid() is not null)
  with check (current_employee_has_permission('settings.manage'));

create policy receipt_config_rw on receipt_config for all
  using (store_in_scope(store_id))
  with check (store_in_scope(store_id) and current_employee_has_permission('settings.manage'));

create policy open_tickets_config_rw on open_tickets_config for all
  using (store_in_scope(store_id))
  with check (store_in_scope(store_id) and current_employee_has_permission('settings.manage'));

create policy app_metadata_rw on app_metadata for all
  using (auth.uid() is not null)
  with check (current_employee_has_permission('settings.manage'));

create policy wholesale_config_rw on wholesale_config for all
  using (auth.uid() is not null)
  with check (current_employee_has_permission('settings.manage'));

create policy order_config_rw on order_config for all
  using (auth.uid() is not null)
  with check (current_employee_has_permission('settings.manage'));

-- ── Diferenciadores ───────────────────────────────────────────────────

create policy supplier_invoices_select on supplier_invoices for select
  using (store_id is null or store_in_scope(store_id));
create policy supplier_invoices_write on supplier_invoices for all
  using (current_employee_has_permission('backoffice.access'))
  with check (current_employee_has_permission('backoffice.access'));

create policy customer_orders_select on customer_orders for select
  using (store_id is null or store_in_scope(store_id));
create policy customer_orders_write on customer_orders for all
  using (
    -- empleados pueden gestionar pedidos de su tienda
    (store_id is null or store_in_scope(store_id))
    and current_employee_has_permission('backoffice.access')
  )
  with check (
    (store_id is null or store_in_scope(store_id))
    and current_employee_has_permission('backoffice.access')
  );

create policy customer_account_movements_select on customer_account_movements for select
  using (current_employee_has_permission('customers.view'));
create policy customer_account_movements_insert on customer_account_movements for insert
  with check (current_employee_has_permission('customers.manage'));

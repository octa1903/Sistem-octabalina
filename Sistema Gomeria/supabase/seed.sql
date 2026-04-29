-- =====================================================================
-- seed.sql — Datos iniciales (roles default, categorías, app singletons)
-- Idempotente: usa on conflict do nothing donde aplica.
-- =====================================================================

-- ── Roles del sistema (los 4 de Loyverse) ─────────────────────────────

insert into roles (name, permissions, is_system) values
  ('Propietario', array[
    'pos.sell','pos.refund','pos.discount','pos.openTickets',
    'pos.openCash','pos.closeCash','pos.cashMovement',
    'discounts.unrestricted',
    'backoffice.access',
    'tires.view','tires.manage',
    'reports.view',
    'employees.manage',
    'customers.view','customers.manage',
    'settings.manage'
  ], true),
  ('Administrador', array[
    'pos.sell','pos.refund','pos.discount','pos.openTickets',
    'pos.openCash','pos.closeCash','pos.cashMovement',
    'discounts.unrestricted',
    'backoffice.access',
    'tires.view','tires.manage',
    'reports.view',
    'employees.manage',
    'customers.view','customers.manage'
  ], true),
  ('Gerente', array[
    'pos.sell','pos.refund','pos.discount','pos.openTickets',
    'pos.openCash','pos.closeCash','pos.cashMovement',
    'backoffice.access',
    'tires.view',
    'reports.view',
    'customers.view','customers.manage'
  ], true),
  ('Cajero', array[
    'pos.sell','pos.discount','pos.openTickets',
    'pos.openCash','pos.closeCash',
    'customers.view'
  ], true)
on conflict (name) do nothing;

-- ── Categorías iniciales (heredadas del modelo Tire) ──────────────────

insert into categories (name, color, sort_order) values
  ('Auto',       '#f97316', 10),
  ('SUV',        '#eab308', 20),
  ('Camioneta',  '#84cc16', 30),
  ('Camión',     '#22c55e', 40),
  ('Moto',       '#06b6d4', 50),
  ('Agrícola',   '#3b82f6', 60),
  ('Industrial', '#a855f7', 70),
  ('Sin categoría', '#6b7280', 999)
on conflict (name) do nothing;

-- ── Métodos de pago iniciales ─────────────────────────────────────────

insert into payment_methods (type, name, surcharge_percent, sort_order) values
  ('cash',         'Efectivo',           0,  10),
  ('card',         'Débito',             0,  20),
  ('card',         'Crédito 1 cuota',    0,  30),
  ('card',         'Crédito 3 cuotas',  15,  40),
  ('card',         'Crédito 6 cuotas',  25,  50),
  ('card',         'Crédito 12 cuotas', 40,  60),
  ('transfer',     'Transferencia',      0,  70),
  ('other',        'Cuenta Corriente',   0,  80)
on conflict do nothing;

-- ── Singletons de configuración ───────────────────────────────────────

insert into app_features (singleton) values (true) on conflict do nothing;
insert into loyalty_config (singleton) values (true) on conflict do nothing;
insert into wholesale_config (singleton) values (true) on conflict do nothing;
insert into order_config (singleton) values (true) on conflict do nothing;
insert into app_metadata (singleton, schema_version) values (true, 1) on conflict do nothing;

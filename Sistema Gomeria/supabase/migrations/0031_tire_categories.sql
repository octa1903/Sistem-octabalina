-- =====================================================================
-- 0031 — Categorías estándar de neumáticos.
--
-- Inserta las categorías que cubren el catálogo de la gomería:
-- Auto, SUV, Camioneta, Camión, Agrícola, Industrial, Moto.
-- `sort_order` determina el orden en que aparecen en la UI.
--
-- Idempotente: `on conflict (name) do nothing` — re-correr no duplica
-- ni pisa colores/orden de categorías existentes.
-- =====================================================================

begin;

insert into categories (name, color, sort_order) values
  ('Auto',        '#3b82f6', 10),
  ('SUV',         '#06b6d4', 20),
  ('Camioneta',   '#0ea5e9', 30),
  ('Camión',      '#6366f1', 40),
  ('Agrícola',    '#16a34a', 50),
  ('Industrial', '#f59e0b', 60),
  ('Moto',        '#ef4444', 70),
  ('Sin categoría', '#6b7280', 999)
on conflict (name) do nothing;

commit;

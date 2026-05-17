-- =====================================================================
-- 0025_receipt_lines_legacy.sql — Relajar NOT NULL para líneas legacy
--
-- Decisión 2026-05-15: tires no se importan desde el .gdb (Octavio los
-- carga por CSV manual). Las líneas de DETALLEF legacy se importan con
-- tire_id = NULL y category_id = NULL, manteniendo los snapshots de
-- text/numéricos para preservar el detalle del recibo histórico.
-- =====================================================================

begin;

alter table receipt_lines
  alter column tire_id drop not null,
  alter column category_id drop not null,
  alter column category_name drop not null,
  alter column tire_brand drop not null,
  alter column tire_model drop not null,
  alter column tire_size drop not null,
  alter column unit_cost drop not null;

-- unit_cost se relaja también: el legacy DETALLEF guarda PRECIOCOSTO solo
-- en algunas líneas. Para no perder esas líneas en el import, NULL es OK
-- (los reportes de margen las saltan).

-- El campo `category_id` perdía la FK implícita (era NOT NULL pero sin
-- REFERENCES). No agregamos FK ahora — sería breaking change para líneas
-- legacy que pueden referenciar categorías huérfanas.

comment on column receipt_lines.tire_id is
  'FK a tires.id. NULL permitido solo para líneas legacy importadas (migration 0025) o líneas reconciliadas con el catálogo nuevo.';

commit;

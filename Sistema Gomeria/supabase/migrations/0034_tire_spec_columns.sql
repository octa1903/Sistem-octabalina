-- =====================================================================
-- 0034_tire_spec_columns.sql
-- Columnas auxiliares para especificaciones técnicas del neumático
-- que hoy viven embebidas en `model` o `size`.
--
-- Motivación: la importación inicial de los 9 CSVs de proveedores
-- mezcló (a) modelos de XBRI cargados como brand (FASTWAY, ECOLOGY,
-- ENZO, FORZA, BRUTUS), (b) índices de carga/velocidad y ply rating
-- empotrados en el modelo (`8PR MRT331 TT`, `82H FASTWAY`), y
-- (c) equivalencias métrica/imperial concatenadas en size
-- (`320/85R24 (12.4-24)`). Estas columnas permiten separar cada
-- atributo a su propio campo sin perder información al limpiar.
--
-- Todas nullables — datos legacy quedan con NULL hasta que el script
-- `scripts/fixTireData.ts` los pueble.
-- =====================================================================

alter table tires
  add column if not exists size_alt text,
  add column if not exists load_speed_index text,
  add column if not exists ply_rating text,
  add column if not exists tube_type text;

comment on column tires.size_alt is
  'Equivalencia alternativa de la medida (ej: imperial 12.4-24 cuando size es ETRTO 320/85 R24)';
comment on column tires.load_speed_index is
  'Índice de carga y velocidad combinado (ej: 82H, 91V, 122A8/B, 149/146 K)';
comment on column tires.ply_rating is
  'Capas / ply rating (ej: 8PR, 10PR, 16PR). Aplica sobre todo a agrícolas e industriales';
comment on column tires.tube_type is
  'Tipo de cámara: TT (Tube Type, con cámara) o TL (Tubeless, sin cámara)';

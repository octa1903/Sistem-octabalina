-- 0026_cash_movements_legacy.sql
-- Permite importar movimientos de caja legacy del .gdb (ENTRADAS_CAJA,
-- SALIDAS_CAJA, OTRAS_CAJA, TRANSFERENCIASBANCARIAS ≈ 125k filas).
--
-- Cambios:
-- 1. cash_movements + legacy_id text (UNIQUE partial WHERE legacy_id IS NOT NULL)
-- 2. cash_movements + import_batch_id uuid (FK a import_batches, ON DELETE SET NULL)
-- 3. cash_sessions + import_batch_id (para auditar las sesiones import-legacy-YYYY-MM-DD)
--
-- Idempotente: ADD COLUMN IF NOT EXISTS + CREATE INDEX IF NOT EXISTS.
-- Reversible: ver bloque comentado al final.

alter table public.cash_movements
  add column if not exists legacy_id text,
  add column if not exists import_batch_id uuid references public.import_batches(id) on delete set null;

create unique index if not exists cash_movements_legacy_id_uq
  on public.cash_movements (legacy_id) where legacy_id is not null;

create index if not exists cash_movements_import_batch_idx
  on public.cash_movements (import_batch_id) where import_batch_id is not null;

alter table public.cash_sessions
  add column if not exists import_batch_id uuid references public.import_batches(id) on delete set null;

create index if not exists cash_sessions_import_batch_idx
  on public.cash_sessions (import_batch_id) where import_batch_id is not null;

comment on column public.cash_movements.legacy_id
  is 'Identificador del movimiento en el sistema legacy Firebird (CODENTR/CODSAL/CODOTRAS/CODTB con prefijo). NULL para movimientos creados desde el POS v2.';
comment on column public.cash_movements.import_batch_id
  is 'Batch de import_batches al que pertenece. NULL para movs creados en el POS.';
comment on column public.cash_sessions.import_batch_id
  is 'Si la sesión fue creada por un loader de import, referencia al batch. NULL para sesiones reales del TPV.';

-- Revert (manual):
-- drop index if exists cash_movements_legacy_id_uq;
-- drop index if exists cash_movements_import_batch_idx;
-- drop index if exists cash_sessions_import_batch_idx;
-- alter table cash_movements drop column if exists legacy_id;
-- alter table cash_movements drop column if exists import_batch_id;
-- alter table cash_sessions drop column if exists import_batch_id;

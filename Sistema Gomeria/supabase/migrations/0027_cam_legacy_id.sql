-- =====================================================================
-- 0027 — customer_account_movements: legacy_id + idempotencia.
--
-- Por qué: el loader customerMovements (ESTCLIE ~110k) necesita un
-- legacy_id UNIQUE partial para soportar idempotencia (re-correr el
-- loader sin duplicar). El patrón es el mismo aplicado en customers,
-- receipts, cash_movements, supplier_account_movements.
--
-- legacy_id no es un INTEGER del .gdb (Firebird ODS-10 con RLE aplasta
-- los PKs en el buffer descomprimido → colisiones masivas). Usamos la
-- dirección física "ESTCLIE:p<page>:l<line>" del row en el .gdb, que es
-- estable y única mientras el archivo no se modifique.
-- =====================================================================

begin;

alter table customer_account_movements
  add column if not exists legacy_id text;

create unique index if not exists cam_legacy_id_uq
  on customer_account_movements (legacy_id)
  where legacy_id is not null;

comment on column customer_account_movements.legacy_id is
  'Dirección física <SRC>:p<page>:l<line> del row en DataBRPVta.gdb. '
  'Estable mientras el archivo legacy no se modifique. UNIQUE partial '
  'para idempotencia del loader.';

commit;

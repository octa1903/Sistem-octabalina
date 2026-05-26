-- =====================================================================
-- 0033 — Purga datos demo previos a Fase A (catálogo real importado el
-- 2026-05-20). Limpia:
--
--   * 4 tires demo (Pirelli/Michelin/Bridgestone del initialData.json +
--     TestPirelli creado a mano).
--   * 3 receipts demo (TPV-0001/02/03) y sus receipt_lines (cascadea).
--   * tire_store_overrides de los tires demo (cascadea por FK).
--   * Cierra la única cash_session con status='open' que estaba
--     abierta desde 2026-04-30 con esas 3 ventas demo dentro.
--
-- Idempotente: filtra por IDs exactos detectados en auditoría 2026-05-26.
-- No toca catálogo de Fase A ni datos legacy importados (todos posteriores
-- al 2026-05-20 o con legacy_id no nulo).
-- =====================================================================

begin;

-- 1. Borrar receipts demo (cascadea receipt_lines por FK on delete cascade)
delete from receipts where id in (
  '338829ee-8868-4f11-9813-aa6637a3f1b0',  -- TPV-0001 (Pirelli P1)
  '080f853e-33f8-429c-9440-29589dd31d57',  -- TPV-0002 (TestPirelli)
  '763880b2-6ba5-43e2-9fa5-41eed3ba27b9'   -- TPV-0003 (Michelin Pilot Sport 4)
);

-- 2. Borrar tire_store_overrides de los tires demo (también cascadea por FK,
--    pero hacemos explícito por claridad).
delete from tire_store_overrides where tire_id in (
  '4dfca434-3a1b-4e72-9cf8-d6c30ec0f295',  -- Pirelli P1 Cinturato
  'a1c224b9-023f-4221-9202-4497bc6502a9',  -- Michelin Pilot Sport 4
  'a294e6cf-65d9-4ade-be22-d5cf9571c1d8',  -- Bridgestone Turanza ER300
  'd97a28d1-ad9a-43a3-b007-05af5c8f5ad6'   -- TestPirelli TestModel
);

-- 3. Borrar los 4 tires demo.
delete from tires where id in (
  '4dfca434-3a1b-4e72-9cf8-d6c30ec0f295',
  'a1c224b9-023f-4221-9202-4497bc6502a9',
  'a294e6cf-65d9-4ade-be22-d5cf9571c1d8',
  'd97a28d1-ad9a-43a3-b007-05af5c8f5ad6'
);

-- 4. Cerrar la cash_session demo que quedó open con 0 ventas reales.
update cash_sessions
set status = 'closed',
    closed_at = now(),
    expected_cash = opening_float,
    counted_cash = opening_float,
    variance = 0,
    notes = coalesce(notes, '') ||
            case when notes is null or notes = '' then '' else E'\n' end ||
            '[2026-05-26] Sesión cerrada automáticamente por migration 0033 — contenía solo ventas demo purgadas.'
where id = '22008a08-b3b7-4907-8c31-529748e399e8'
  and status = 'open';

commit;

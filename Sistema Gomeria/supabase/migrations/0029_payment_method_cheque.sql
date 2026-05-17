-- =====================================================================
-- 0029 — Agregar método de pago "Cheque" requerido por loader payments.
--
-- El sistema legacy distingue pagos por FPAGO ("EFECTIVO", "CHEQUE",
-- "TRANSFERENCIA", "TARJETA"). Existen 8 métodos en Supabase pero falta
-- "Cheque" como tipo distintivo. Lo agregamos antes de mapear PAGOS.FPAGO
-- a payment_method_id.
--
-- Idempotente: ON CONFLICT DO NOTHING sobre name único.
-- =====================================================================

begin;

insert into payment_methods (name, type, surcharge_percent, sort_order)
select 'Cheque', 'other', 0, 90
where not exists (select 1 from payment_methods where name = 'Cheque');

commit;

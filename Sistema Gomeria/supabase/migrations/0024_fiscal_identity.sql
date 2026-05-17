-- =====================================================================
-- 0024_fiscal_identity.sql — Identidad fiscal del negocio por tienda
--
-- Refinado por Fase 0 (REPORTE_FASE0.md §3.NROS, §9): el legacy guardaba
-- en NROS (singleton) la razón social, CUIT, IIBB, fecha inicio actividades,
-- certificado AFIP y clave AFIP en una sola fila. En Supabase migramos a
-- stores.fiscal_identity jsonb (1 por tienda), permitiendo múltiples tiendas
-- con identidades fiscales propias.
--
-- Forma del jsonb:
--   {
--     razonSocial: string,
--     cuit: string,
--     iibb?: string,
--     inicioActiv?: string (YYYY-MM-DD),
--     dirTel?: string,
--     localidad?: string,
--     ivaCondition?: string,
--     certAfipPath?: string,            -- nombre del archivo (no se guarda el contenido)
--     claveAfipEncrypted?: string       -- cifrada client-side antes de mandar; NUNCA en claro
--   }
-- =====================================================================

begin;

alter table stores
  add column if not exists fiscal_identity jsonb;

-- Comentario para que el lector sepa que claveAfipEncrypted NO debe persistirse
-- en claro. La encriptación es responsabilidad del cliente (Sistema Gomeria/src).
comment on column stores.fiscal_identity is
  'JSONB con identidad fiscal del negocio: razonSocial, cuit, iibb, inicioActiv, dirTel, localidad, ivaCondition, certAfipPath, claveAfipEncrypted. La clave AFIP debe encriptarse client-side antes de persistir (nunca guardar en claro).';

-- Validación básica: si está poblado, debe tener razonSocial y cuit.
-- No es CHECK constraint estricto porque jsonb permite muchas formas.
-- Lo validamos en el servicio TS.

commit;

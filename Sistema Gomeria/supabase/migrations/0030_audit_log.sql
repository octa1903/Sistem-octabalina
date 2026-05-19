-- =====================================================================
-- 0030 — Audit log centralizado (Loyverse parity, Fase E del plan).
--
-- Tabla `audit_log` registra acciones críticas con before/after en jsonb:
--   - receipt.create / receipt.void
--   - cash.open / cash.close / cash.movement
--   - tire.price_change / tire.bulk_price_change
--   - customer.credit_limit_change
--   - discount.apply (cuando excede tope del rol)
--   - employee.password_change
--
-- Inserción exclusiva vía RPC `log_action` (SECURITY DEFINER). Lectura
-- restringida a empleados con permiso `reports.audit` en la tienda.
--
-- Idempotente: usa CREATE TABLE IF NOT EXISTS + drop/create de policies.
-- =====================================================================

begin;

-- ── Tabla ─────────────────────────────────────────────────────────────

create table if not exists audit_log (
  id           uuid primary key default gen_random_uuid(),
  store_id     uuid not null references stores(id) on delete cascade,
  employee_id  uuid references employees(id) on delete set null,
  action       text not null,
  entity_type  text not null,
  entity_id    uuid,
  before       jsonb,
  after        jsonb,
  reason       text,
  created_at   timestamptz not null default now()
);

create index if not exists idx_audit_log_store_created
  on audit_log (store_id, created_at desc);

create index if not exists idx_audit_log_entity
  on audit_log (entity_type, entity_id);

create index if not exists idx_audit_log_employee
  on audit_log (employee_id, created_at desc);

-- ── RLS ───────────────────────────────────────────────────────────────

alter table audit_log enable row level security;

drop policy if exists audit_log_read on audit_log;
create policy audit_log_read on audit_log
  for select
  using (
    store_in_scope(store_id)
    and current_employee_has_permission('reports.audit')
  );

-- Inserción/update/delete bloqueados a `authenticated`: solo el RPC
-- `log_action` (SECURITY DEFINER) puede escribir.
revoke insert, update, delete on audit_log from authenticated;
revoke insert, update, delete on audit_log from anon;

-- ── RPC log_action ────────────────────────────────────────────────────

create or replace function log_action(
  p_store_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid default null,
  p_before jsonb default null,
  p_after jsonb default null,
  p_reason text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp uuid := current_employee_id();
  v_id  uuid;
begin
  if v_emp is null then
    raise exception 'log_action: no hay empleado autenticado';
  end if;

  if not store_in_scope(p_store_id) then
    raise exception 'log_action: tienda fuera de scope (%)', p_store_id
      using errcode = '42501';
  end if;

  if p_action is null or length(trim(p_action)) = 0 then
    raise exception 'log_action: action requerido';
  end if;

  if p_entity_type is null or length(trim(p_entity_type)) = 0 then
    raise exception 'log_action: entity_type requerido';
  end if;

  insert into audit_log (store_id, employee_id, action, entity_type, entity_id, before, after, reason)
  values (p_store_id, v_emp, p_action, p_entity_type, p_entity_id, p_before, p_after, p_reason)
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function log_action(uuid, text, text, uuid, jsonb, jsonb, text) to authenticated;

-- ── Asegurar que el permiso `reports.audit` existe en al menos un rol ─
-- No forzamos asignación (eso lo decide el dueño en UI RolesSection).
-- Solo dejamos comentario para regen-types y onboarding.

comment on table audit_log is
  'Audit log centralizado. Lectura: permiso reports.audit. Escritura: solo via RPC log_action.';

commit;

-- =====================================================================
-- 0019_credit_limit_enforcement.sql
-- Valida cupo de crédito server-side al insertar un charge en
-- customer_account_movements. Política (semántica final):
--   - credit_limit IS NULL  → sin tope (admin no configuró política).
--   - credit_limit = 0      → sin tope (alineado con el default actual
--                              customers.credit_limit numeric NOT NULL DEFAULT 0).
--   - credit_limit > 0      → permite si new_balance <= credit_limit.
--
-- Justificación de 0 = sin tope: el default actual es 0; reinterpretar 0
-- como "bloqueo" rompería todos los clientes existentes. Para "bloqueado"
-- explícito, usar un valor simbólico (e.g. -1 con CHECK) o un flag separado
-- en una migration futura si hace falta.
--
-- Convención de signo (ver 0007): balance positivo = deuda del cliente.
-- Un 'charge' suma a la deuda; un 'payment' la resta.
--
-- Si excede: error SQLSTATE 23514 con hint='credit_limit_exceeded'
-- para que el frontend lo traduzca a un toast amigable.
--
-- BYPASS: durante el import legacy (Fase 4), se desactiva el trigger via
-- SET LOCAL session_replication_role = replica; dentro de la transacción.
-- =====================================================================

begin;

create or replace function trg_credit_limit_check() returns trigger
language plpgsql as $$
declare
  v_credit_limit numeric(12,2);
  v_current_balance numeric(12,2);
  v_new_balance numeric(12,2);
begin
  if new.type <> 'charge' then
    return new;
  end if;

  select credit_limit, account_balance
    into v_credit_limit, v_current_balance
    from customers
   where id = new.customer_id;

  -- credit_limit NULL o 0 → sin tope (compat con default actual)
  if v_credit_limit is null or v_credit_limit <= 0 then
    return new;
  end if;

  v_new_balance := coalesce(v_current_balance, 0) + new.amount;

  -- credit_limit > 0: permite hasta el tope
  if v_new_balance > v_credit_limit then
    raise exception
      'Cargo excede cupo de crédito (saldo resultante % > límite %)',
      v_new_balance, v_credit_limit
      using errcode = '23514',
            hint   = 'credit_limit_exceeded';
  end if;

  return new;
end $$;

drop trigger if exists customer_account_movements_credit_check on customer_account_movements;

create trigger customer_account_movements_credit_check
  before insert on customer_account_movements
  for each row execute function trg_credit_limit_check();

comment on function trg_credit_limit_check() is
  'Valida customers.credit_limit antes de insertar un charge. Errores: SQLSTATE 23514, hint=credit_limit_exceeded. Bypass durante import: SET LOCAL session_replication_role=replica.';

commit;

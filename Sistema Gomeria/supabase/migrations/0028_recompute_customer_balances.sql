-- =====================================================================
-- 0028 — Asegurar trigger + RPC de balance de cuenta corriente.
--
-- Diagnóstico (2026-05-16): después de cargar 23196 customer_account_movements
-- vía loader legacy, `customers.account_balance` quedó en 0. El trigger
-- definido en 0007 no se disparó (probable: nunca se aplicó al remoto, o el
-- RPC fue removido). Esta migración re-crea ambos y recalcula todos los
-- balances de una.
--
-- Idempotente: usa CREATE OR REPLACE para functions y DROP IF EXISTS para
-- triggers.
-- =====================================================================

begin;

create or replace function recompute_customer_account_balance(p_customer_id uuid)
returns void language sql as $$
  update customers c set
    account_balance = coalesce(sub.balance, 0)
  from (
    select coalesce(sum(case when type = 'charge' then amount else -amount end), 0) as balance
    from customer_account_movements
    where customer_id = p_customer_id
  ) sub
  where c.id = p_customer_id;
$$;

create or replace function trg_account_balance_after_change() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    perform recompute_customer_account_balance(old.customer_id);
    return old;
  end if;
  perform recompute_customer_account_balance(new.customer_id);
  if tg_op = 'UPDATE' and old.customer_id is distinct from new.customer_id then
    perform recompute_customer_account_balance(old.customer_id);
  end if;
  return new;
end $$;

drop trigger if exists customer_account_movements_balance on customer_account_movements;
create trigger customer_account_movements_balance
  after insert or update or delete on customer_account_movements
  for each row execute function trg_account_balance_after_change();

-- Recálculo masivo para customers que ya tienen movements legacy importados.
-- Esto fija los 23196+ movements cargados en 0027.
update customers c set account_balance = coalesce(sub.balance, 0)
from (
  select customer_id,
    coalesce(sum(case when type = 'charge' then amount else -amount end), 0) as balance
  from customer_account_movements
  group by customer_id
) sub
where c.id = sub.customer_id;

commit;

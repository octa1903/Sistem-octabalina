-- =====================================================================
-- 0007_account_balance_trigger.sql
--
-- Mantiene customers.account_balance derivado de customer_account_movements
-- de forma atómica via trigger. Antes, AccountsView hacía dos writes
-- (insert movement + update customer.account_balance) sin transacción,
-- con riesgo de inconsistencia si el segundo fallaba o había concurrencia.
--
-- También expone recompute_customer_account_balance(p_customer_id) como
-- RPC pública para reparar manualmente (después de imports masivos o
-- migraciones desde v1).
-- =====================================================================

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
  -- Si en un UPDATE cambió el customer_id, recomputar también el viejo.
  if tg_op = 'UPDATE' and old.customer_id is distinct from new.customer_id then
    perform recompute_customer_account_balance(old.customer_id);
  end if;
  return new;
end $$;

drop trigger if exists customer_account_movements_balance on customer_account_movements;

create trigger customer_account_movements_balance
  after insert or update or delete on customer_account_movements
  for each row execute function trg_account_balance_after_change();

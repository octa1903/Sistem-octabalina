-- =====================================================================
-- 0012_loyalty_points_trigger.sql
--
-- Mantiene customers.points_balance derivado de receipts.points_earned y
-- receipts.points_redeemed via trigger. Se aplica solo a recibos
-- 'completed' con customer_id no nulo. Refunds (type='refund')
-- contribuyen con signo invertido — devuelven puntos canjeados y restan
-- los ganados originalmente.
--
-- Diseño:
--   sale completed → balance += earned − redeemed
--   refund completed → balance += redeemed − earned (signo opuesto)
--   parked → no aplica (los puntos se calculan al cobrar)
--   delete → revertir el efecto.
--
-- También expone recompute_customer_points_balance(p_customer_id) como
-- RPC pública para reparar manualmente.
-- =====================================================================

create or replace function recompute_customer_points_balance(p_customer_id uuid)
returns void language sql set search_path = public as $$
  update customers c set
    points_balance = coalesce(sub.bal, 0)
  from (
    select coalesce(sum(
      (case when type = 'sale' then 1 else -1 end) *
      (coalesce(points_earned, 0) - coalesce(points_redeemed, 0))
    ), 0) as bal
    from receipts
    where customer_id = p_customer_id
      and status = 'completed'
  ) sub
  where c.id = p_customer_id;
$$;

create or replace function trg_points_balance_after_change() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.customer_id is not null and old.status = 'completed' then
      perform recompute_customer_points_balance(old.customer_id);
    end if;
    return old;
  end if;

  -- Early-exit en UPDATEs entre estados no-completed (ej. parked → parked):
  -- el balance no cambia, evitamos un write redundante a customers.
  if tg_op = 'UPDATE'
     and old.status <> 'completed'
     and new.status <> 'completed' then
    return new;
  end if;

  if new.customer_id is not null then
    perform recompute_customer_points_balance(new.customer_id);
  end if;
  if tg_op = 'UPDATE'
     and old.customer_id is not null
     and old.customer_id is distinct from new.customer_id then
    perform recompute_customer_points_balance(old.customer_id);
  end if;
  return new;
end $$;

drop trigger if exists receipts_points_balance on receipts;

create trigger receipts_points_balance
  after insert or update or delete on receipts
  for each row execute function trg_points_balance_after_change();

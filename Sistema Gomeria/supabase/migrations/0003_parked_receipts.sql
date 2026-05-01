-- Permite eliminar recibos solo si están en estado 'parked' (tickets abiertos).
-- Los recibos completados / refunds NUNCA se borran: se anulan con un refund.
-- receipt_lines ya cae en cascada por la FK con on delete cascade.
-- Permiso: pos.openTickets (no pos.sell — Cajero puede vender pero no
-- necesariamente borrar tickets de otros).

create policy receipts_delete_parked on receipts for delete
  using (
    status = 'parked'
    and store_in_scope(store_id)
    and current_employee_has_permission('pos.openTickets')
  );

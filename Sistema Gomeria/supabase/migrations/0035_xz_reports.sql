-- =====================================================================
-- 0035_xz_reports.sql — RPCs para reportes X y Z de sesión de caja
--
-- Z = cierre Z = snapshot al cerrar la sesión (immutable, contable)
-- X = preview en tiempo real sobre sesión abierta (mismo formato, no escribe)
--
-- Ambos calculan los mismos totales (a) ventas por método de pago,
-- (b) totales de ticket (subtotal, descuentos, impuestos, total),
-- (c) movimientos de caja in/out, (d) cantidad de tickets sale/refund,
-- (e) descuadre (solo Z, requiere counted_cash).
--
-- Devuelven JSON que la UI imprime tal cual. La inmutabilidad del Z
-- ya está garantizada por la unique index existente: una vez closed,
-- no se puede reabrir, y la fila cash_sessions queda con el snapshot.
-- =====================================================================

create or replace function build_session_report(p_session_id uuid)
returns jsonb language plpgsql as $$
declare
  v_session record;
  v_store record;
  v_opener record;
  v_closer record;
  v_payments jsonb;
  v_totals jsonb;
  v_movements jsonb;
  v_counts jsonb;
begin
  select * into v_session from cash_sessions where id = p_session_id;
  if v_session is null then
    raise exception 'Sesión no encontrada';
  end if;

  select id, name, fiscal_identity into v_store from stores where id = v_session.store_id;

  select id, name into v_opener from employees where id = v_session.opened_by_employee_id;
  if v_session.closed_by_employee_id is not null then
    select id, name into v_closer from employees where id = v_session.closed_by_employee_id;
  end if;

  -- Ventas agrupadas por método de pago
  select coalesce(
    jsonb_agg(jsonb_build_object(
      'payment_method_id', payment_method_id,
      'method_name', method_name,
      'method_type', method_type,
      'sale_amount', sale_amount,
      'refund_amount', refund_amount,
      'net_amount', sale_amount - refund_amount,
      'sale_count', sale_count,
      'refund_count', refund_count
    ) order by method_name),
    '[]'::jsonb
  ) into v_payments
  from (
    select pm.id as payment_method_id,
           pm.name as method_name,
           pm.type as method_type,
           coalesce(sum((p->>'amount')::numeric)
             filter (where r.type = 'sale'), 0)   as sale_amount,
           coalesce(sum((p->>'amount')::numeric)
             filter (where r.type = 'refund'), 0) as refund_amount,
           count(*) filter (where r.type = 'sale')   as sale_count,
           count(*) filter (where r.type = 'refund') as refund_count
    from receipts r
         cross join lateral jsonb_array_elements(r.payments) p
         join payment_methods pm on pm.id = (p->>'payment_method_id')::uuid
    where r.cash_session_id = p_session_id
      and r.status = 'completed'
    group by pm.id, pm.name, pm.type
  ) pivot;

  -- Totales de ticket
  select jsonb_build_object(
    'subtotal_gross',  coalesce(sum(case when type='sale' then subtotal_gross  else -subtotal_gross  end), 0),
    'total_discounts', coalesce(sum(case when type='sale' then total_discounts else -total_discounts end), 0),
    'subtotal_net',    coalesce(sum(case when type='sale' then subtotal_net    else -subtotal_net    end), 0),
    'total_taxes',     coalesce(sum(case when type='sale' then total_taxes     else -total_taxes     end), 0),
    'total_cogs',      coalesce(sum(case when type='sale' then total_cogs      else -total_cogs      end), 0),
    'total',           coalesce(sum(case when type='sale' then total           else -total           end), 0),
    'points_earned',   coalesce(sum(points_earned),   0),
    'points_redeemed', coalesce(sum(points_redeemed), 0)
  ) into v_totals
  from receipts
  where cash_session_id = p_session_id
    and status = 'completed';

  -- Conteos
  select jsonb_build_object(
    'sale_count',   count(*) filter (where type='sale'   and status='completed'),
    'refund_count', count(*) filter (where type='refund' and status='completed'),
    'parked_count', count(*) filter (where status='parked')
  ) into v_counts
  from receipts where cash_session_id = p_session_id;

  -- Movimientos de caja (entradas/salidas manuales)
  select coalesce(
    jsonb_agg(jsonb_build_object(
      'id', id,
      'type', type,
      'amount', amount,
      'reason', reason,
      'at', at,
      'employee_id', employee_id
    ) order by at),
    '[]'::jsonb
  ) into v_movements
  from cash_movements where cash_session_id = p_session_id;

  return jsonb_build_object(
    'session', jsonb_build_object(
      'id', v_session.id,
      'store_id', v_session.store_id,
      'opened_at', v_session.opened_at,
      'closed_at', v_session.closed_at,
      'opened_by', jsonb_build_object('id', v_opener.id, 'name', v_opener.name),
      'closed_by', case when v_closer.id is not null
                        then jsonb_build_object('id', v_closer.id, 'name', v_closer.name)
                        else null end,
      'opening_float', v_session.opening_float,
      'expected_cash', v_session.expected_cash,
      'counted_cash',  v_session.counted_cash,
      'variance',      v_session.variance,
      'status',        v_session.status,
      'notes',         v_session.notes
    ),
    'store', jsonb_build_object(
      'id', v_store.id,
      'name', v_store.name,
      'fiscal_identity', v_store.fiscal_identity
    ),
    'payments', v_payments,
    'totals',   v_totals,
    'counts',   v_counts,
    'movements', v_movements,
    'generated_at', now(),
    'report_kind', case when v_session.status = 'closed' then 'Z' else 'X' end
  );
end $$;

comment on function build_session_report(uuid) is
  'Genera reporte X (sesión abierta, preview) o Z (sesión cerrada, snapshot) según el status. La fila de cash_sessions ya es inmutable post-cierre.';

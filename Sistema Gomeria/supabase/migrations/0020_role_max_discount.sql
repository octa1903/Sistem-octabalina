-- =====================================================================
-- 0020_role_max_discount.sql
-- Tope de descuento por rol. Reglas:
--   - roles.max_discount_percent: 0..100 (default 100 = sin tope).
--   - Si el empleado tiene permission 'discounts.unrestricted', se ignora.
--   - Sin ese permiso, valida que (total_discounts / subtotal_gross) * 100
--     no supere el tope del rol.
--   - Aplica a la creación de receipts via create_receipt_with_lines.
--
-- Reescribe create_receipt_with_lines (definido en 0001_init.sql:454-538)
-- con CREATE OR REPLACE, manteniendo el cuerpo original intacto y
-- prependiendo la validación.
-- =====================================================================

begin;

-- ── (1) Agregar columna max_discount_percent al rol ──────────────────
alter table roles
  add column if not exists max_discount_percent numeric(5,2) not null default 100;

-- ── (2) Helper: tope de descuento del empleado actual ────────────────
create or replace function current_employee_max_discount()
returns numeric
language sql stable security definer set search_path = public as $$
  select r.max_discount_percent
    from employees e
    join roles r on r.id = e.role_id
   where e.auth_user_id = auth.uid()
     and e.active
   limit 1
$$;

comment on function current_employee_max_discount() is
  'Tope de descuento (porcentaje 0..100) del empleado autenticado por Supabase Auth. 100 = sin tope. Se ignora si tiene discounts.unrestricted. NOTA: el operador del TPV identificado solo por PIN no impacta este lookup (lo resuelve auth.uid del dueño). El cap del operador PIN debe validarse client-side adicionalmente en POSView via roleService.maxDiscountFor(operatorRole).';

-- ── (3) Reescribir create_receipt_with_lines con validación ──────────
create or replace function create_receipt_with_lines(
  p_receipt jsonb,
  p_lines   jsonb
) returns uuid language plpgsql as $$
declare
  v_receipt_id uuid;
  v_store_id   uuid := (p_receipt->>'store_id')::uuid;
  v_session_status text;
  v_subtotal_gross numeric;
  v_total_discounts numeric;
  v_max_pct numeric;
  v_applied_pct numeric;
  v_unrestricted boolean;
begin
  -- Validar sesión de caja abierta
  select status into v_session_status from cash_sessions
   where id = (p_receipt->>'cash_session_id')::uuid;
  if v_session_status is null then
    raise exception 'Cash session no encontrada';
  end if;
  if v_session_status <> 'open' then
    raise exception 'Cash session no está abierta';
  end if;

  -- ── Validación de tope de descuento por rol (0020) ────────────────
  v_subtotal_gross := (p_receipt->>'subtotal_gross')::numeric;
  v_total_discounts := coalesce((p_receipt->>'total_discounts')::numeric, 0);

  if v_subtotal_gross > 0 and v_total_discounts > 0 then
    v_unrestricted := current_employee_has_permission('discounts.unrestricted');
    if not v_unrestricted then
      v_max_pct := current_employee_max_discount();
      if v_max_pct is not null then
        v_applied_pct := (v_total_discounts / v_subtotal_gross) * 100;
        if v_applied_pct > v_max_pct + 0.01 then
          raise exception
            'Descuento aplicado %.2f%% supera el tope del rol %.2f%%',
            v_applied_pct, v_max_pct
            using errcode = '23514',
                  hint   = 'max_discount_exceeded';
        end if;
      end if;
    end if;
  end if;

  -- ── Cuerpo original (mismo que 0001_init.sql:472-538) ─────────────
  insert into receipts (
    receipt_number, store_id, cash_session_id, employee_id, customer_id,
    type, status, parked_name, refund_of_receipt_id,
    applied_discounts, applied_taxes, payments,
    subtotal_gross, total_discounts, subtotal_net,
    total_taxes, total_cogs, total,
    points_earned, points_redeemed, notes
  )
  select
    p_receipt->>'receipt_number',
    (p_receipt->>'store_id')::uuid,
    (p_receipt->>'cash_session_id')::uuid,
    (p_receipt->>'employee_id')::uuid,
    nullif(p_receipt->>'customer_id','')::uuid,
    p_receipt->>'type',
    p_receipt->>'status',
    p_receipt->>'parked_name',
    nullif(p_receipt->>'refund_of_receipt_id','')::uuid,
    coalesce(p_receipt->'applied_discounts','[]'::jsonb),
    coalesce(p_receipt->'applied_taxes','[]'::jsonb),
    coalesce(p_receipt->'payments','[]'::jsonb),
    (p_receipt->>'subtotal_gross')::numeric,
    (p_receipt->>'total_discounts')::numeric,
    (p_receipt->>'subtotal_net')::numeric,
    (p_receipt->>'total_taxes')::numeric,
    (p_receipt->>'total_cogs')::numeric,
    (p_receipt->>'total')::numeric,
    coalesce((p_receipt->>'points_earned')::numeric, 0),
    coalesce((p_receipt->>'points_redeemed')::numeric, 0),
    p_receipt->>'notes'
  returning id into v_receipt_id;

  insert into receipt_lines (
    receipt_id, tire_id, tire_brand, tire_model, tire_size,
    category_id, category_name, modifiers,
    unit_price, unit_cost, quantity,
    line_discounts, line_taxes, gross, net, total
  )
  select
    v_receipt_id,
    (l->>'tire_id')::uuid,
    l->>'tire_brand', l->>'tire_model', l->>'tire_size',
    (l->>'category_id')::uuid, l->>'category_name',
    coalesce(l->'modifiers','[]'::jsonb),
    (l->>'unit_price')::numeric,
    (l->>'unit_cost')::numeric,
    (l->>'quantity')::numeric,
    coalesce(l->'line_discounts','[]'::jsonb),
    coalesce(l->'line_taxes','[]'::jsonb),
    (l->>'gross')::numeric,
    (l->>'net')::numeric,
    (l->>'total')::numeric
  from jsonb_array_elements(p_lines) as l;

  -- Aplicar movimiento de stock (sólo si receipt está completed)
  if p_receipt->>'status' = 'completed' then
    perform apply_receipt_to_stock(v_receipt_id);
  end if;

  -- Recompute métricas si aplica
  if (p_receipt->>'customer_id') is not null and (p_receipt->>'customer_id') <> '' then
    perform recompute_customer_metrics((p_receipt->>'customer_id')::uuid);
  end if;

  return v_receipt_id;
end $$;

comment on function create_receipt_with_lines(jsonb, jsonb) is
  'Crea receipt + lines + aplica stock. v2 (0020): valida tope de descuento por rol (errcode 23514, hint max_discount_exceeded). Bypass: permission discounts.unrestricted.';

commit;

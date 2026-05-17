-- =====================================================================
-- 0021_insurance.sql — Módulo de aseguradoras
--
-- Refinado por Fase 0 (ver gdb-analysis/REPORTE_FASE0.md §3):
--   - ASEGURADOS legacy NO son aseguradoras, son pólizas+vehículos
--     (CODA, ASEGURADO, DIRECCION, TELS, NROSEGURO, MODELO, PATENTE, COMPANIA).
--   - La aseguradora (COMPANIA) es FK INTEGER a tabla externa (no resuelta
--     todavía — Fase 3 lo confirma con samples reales).
--
-- Modelo Supabase:
--   - insurance_companies: maestro de cías (Allianz, San Cristóbal, etc.).
--   - insurance_policies: una por póliza+vehículo del cliente (= ASEGURADOS).
--   - customers.customer_type ahora admite 'insured' además de 'retail'/'wholesale'.
--   - receipts.insurance_policy_id + insurance_split jsonb para refacturación
--     con split cliente / aseguradora.
-- =====================================================================

begin;

-- ── insurance_companies ───────────────────────────────────────────────
create table if not exists insurance_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cuit text,
  contact_name text,
  phone text,
  email text,
  address jsonb,
  account_balance numeric(12,2) not null default 0,
  notes text,
  legacy_id text,                  -- identidad legacy si vino del .gdb (= COMPANIA del ASEGURADOS legacy)
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists insurance_companies_legacy_id_uq
  on insurance_companies (legacy_id) where legacy_id is not null;
create index if not exists insurance_companies_cuit_idx
  on insurance_companies (cuit) where cuit is not null;
create index if not exists insurance_companies_active_idx
  on insurance_companies (active) where active = true;

-- ── insurance_policies ────────────────────────────────────────────────
-- Una póliza por (customer, company, policy_number). El asegurado puede no
-- coincidir con el customer (e.g. titular del vehículo distinto del cliente
-- que paga la franquicia). insured_name preserva esa info si difiere.
create table if not exists insurance_policies (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references stores(id),
  customer_id uuid references customers(id) on delete set null,
  insurance_company_id uuid not null references insurance_companies(id),
  policy_number text not null,
  vehicle_model text,
  vehicle_plate text,
  insured_name text,             -- denormalizado: nombre real del asegurado si difiere del customer
  insured_address text,
  insured_phones text,
  legacy_id text,                -- = ASEGURADOS.CODA del .gdb
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists insurance_policies_legacy_id_uq
  on insurance_policies (legacy_id) where legacy_id is not null;
create index if not exists insurance_policies_customer_idx
  on insurance_policies (customer_id) where customer_id is not null;
create index if not exists insurance_policies_company_idx
  on insurance_policies (insurance_company_id);
create index if not exists insurance_policies_plate_idx
  on insurance_policies (vehicle_plate) where vehicle_plate is not null;
create index if not exists insurance_policies_policy_num_idx
  on insurance_policies (policy_number);

-- updated_at trigger (usa función set_updated_at si existe; si no, la creamos)
create or replace function set_updated_at_timestamp()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists insurance_companies_set_updated_at on insurance_companies;
create trigger insurance_companies_set_updated_at
  before update on insurance_companies
  for each row execute function set_updated_at_timestamp();

drop trigger if exists insurance_policies_set_updated_at on insurance_policies;
create trigger insurance_policies_set_updated_at
  before update on insurance_policies
  for each row execute function set_updated_at_timestamp();

-- ── customers: admitir customer_type='insured' ────────────────────────
-- El CHECK constraint actual ('retail','wholesale') hay que reemplazarlo.
alter table customers drop constraint if exists customers_customer_type_check;
alter table customers
  add constraint customers_customer_type_check
  check (customer_type in ('retail','wholesale','insured'));

-- ── receipts: campos para split asegurado/aseguradora ─────────────────
alter table receipts
  add column if not exists insurance_policy_id uuid references insurance_policies(id),
  add column if not exists insurance_split jsonb;

create index if not exists receipts_insurance_policy_idx
  on receipts (insurance_policy_id) where insurance_policy_id is not null;

-- Validación de split: si hay policy, debe haber split coherente.
-- insurance_split = { customer_amount, insurance_amount, deductible?, claim_number? }
create or replace function trg_receipt_insurance_split_check()
returns trigger language plpgsql as $$
declare
  v_customer_amount numeric;
  v_insurance_amount numeric;
  v_sum numeric;
begin
  if new.insurance_policy_id is null and new.insurance_split is null then
    return new;
  end if;
  if new.insurance_policy_id is not null and new.insurance_split is null then
    raise exception 'Falta insurance_split cuando hay insurance_policy_id'
      using errcode = '23514', hint = 'insurance_split_required';
  end if;
  if new.insurance_split is not null then
    v_customer_amount := coalesce((new.insurance_split->>'customer_amount')::numeric, 0);
    v_insurance_amount := coalesce((new.insurance_split->>'insurance_amount')::numeric, 0);
    v_sum := v_customer_amount + v_insurance_amount;
    -- Tolerancia 0.02 por redondeo (mismas reglas que reportes)
    if abs(v_sum - new.total) > 0.02 then
      raise exception
        'insurance_split (% + % = %) no coincide con receipt.total (%)',
        v_customer_amount, v_insurance_amount, v_sum, new.total
        using errcode = '23514', hint = 'insurance_split_mismatch';
    end if;
    if v_insurance_amount > 0 and new.insurance_policy_id is null then
      raise exception 'insurance_amount > 0 requiere insurance_policy_id'
        using errcode = '23514', hint = 'insurance_policy_required';
    end if;
  end if;
  return new;
end $$;

-- Disparar solo en INSERT y en UPDATEs que toquen los campos relevantes —
-- evita correr el check sobre receipts viejos cuando se actualizan campos
-- no-insurance (status, etc.).
drop trigger if exists receipts_insurance_split_check on receipts;
drop trigger if exists receipts_insurance_split_update_check on receipts;
create trigger receipts_insurance_split_check
  before insert on receipts
  for each row execute function trg_receipt_insurance_split_check();
create trigger receipts_insurance_split_update_check
  before update of insurance_policy_id, insurance_split on receipts
  for each row execute function trg_receipt_insurance_split_check();

-- ── insurance_company_movements: cuenta corriente con la cía ──────────
-- Análoga a customer_account_movements: charges cuando facturamos a la cía,
-- payments cuando la cía liquida.
create table if not exists insurance_company_movements (
  id uuid primary key default gen_random_uuid(),
  insurance_company_id uuid not null references insurance_companies(id) on delete cascade,
  type text not null check (type in ('charge','payment')),
  amount numeric(12,2) not null check (amount > 0),
  payment_method_id uuid references payment_methods(id),
  notes text,
  receipt_id uuid references receipts(id),
  employee_id uuid references employees(id),
  at timestamptz not null default now()
);
create index if not exists icm_company_idx
  on insurance_company_movements (insurance_company_id, at desc);

-- Trigger de recompute para insurance_companies.account_balance
create or replace function recompute_insurance_company_balance(p_id uuid)
returns void language sql as $$
  update insurance_companies c set
    account_balance = coalesce(sub.balance, 0)
  from (
    select coalesce(sum(case when type = 'charge' then amount else -amount end), 0) as balance
    from insurance_company_movements
    where insurance_company_id = p_id
  ) sub
  where c.id = p_id;
$$;

create or replace function trg_icm_after_change() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    perform recompute_insurance_company_balance(old.insurance_company_id);
    return old;
  end if;
  perform recompute_insurance_company_balance(new.insurance_company_id);
  if tg_op = 'UPDATE' and old.insurance_company_id is distinct from new.insurance_company_id then
    perform recompute_insurance_company_balance(old.insurance_company_id);
  end if;
  return new;
end $$;

drop trigger if exists insurance_company_movements_balance on insurance_company_movements;
create trigger insurance_company_movements_balance
  after insert or update or delete on insurance_company_movements
  for each row execute function trg_icm_after_change();

-- ── RLS ───────────────────────────────────────────────────────────────
alter table insurance_companies          enable row level security;
alter table insurance_policies           enable row level security;
alter table insurance_company_movements  enable row level security;

-- insurance_companies: select customers.view, write customers.manage
-- (políticamente las cías son maestros globales — no por tienda)
drop policy if exists insurance_companies_select on insurance_companies;
drop policy if exists insurance_companies_write  on insurance_companies;
create policy insurance_companies_select on insurance_companies for select
  using (current_employee_has_permission('customers.view'));
create policy insurance_companies_write on insurance_companies for all
  using (current_employee_has_permission('customers.manage'))
  with check (current_employee_has_permission('customers.manage'));

-- insurance_policies: scope por store_id (NULL = global como customers nuevos)
drop policy if exists insurance_policies_select on insurance_policies;
drop policy if exists insurance_policies_insert on insurance_policies;
drop policy if exists insurance_policies_update on insurance_policies;
drop policy if exists insurance_policies_delete on insurance_policies;

create policy insurance_policies_select on insurance_policies for select
  using (
    current_employee_has_permission('customers.view')
    and (store_id is null or store_in_scope(store_id))
  );
create policy insurance_policies_insert on insurance_policies for insert
  with check (
    current_employee_has_permission('customers.manage')
    and (store_id is null or store_in_scope(store_id))
  );
create policy insurance_policies_update on insurance_policies for update
  using (
    current_employee_has_permission('customers.manage')
    and (store_id is null or store_in_scope(store_id))
  )
  with check (
    current_employee_has_permission('customers.manage')
    and (store_id is null or store_in_scope(store_id))
  );
create policy insurance_policies_delete on insurance_policies for delete
  using (
    current_employee_has_permission('customers.manage')
    and (store_id is null or store_in_scope(store_id))
  );

-- insurance_company_movements: select/write customers.view/manage
drop policy if exists insurance_company_movements_select on insurance_company_movements;
drop policy if exists insurance_company_movements_write on insurance_company_movements;
create policy insurance_company_movements_select on insurance_company_movements for select
  using (current_employee_has_permission('customers.view'));
create policy insurance_company_movements_write on insurance_company_movements for all
  using (current_employee_has_permission('customers.manage'))
  with check (current_employee_has_permission('customers.manage'));

commit;

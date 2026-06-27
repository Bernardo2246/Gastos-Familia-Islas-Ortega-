-- ============================================================
-- App Familiar de Control de Gastos — Esquema completo
-- Pega TODO este archivo en Supabase > SQL Editor y ejecútalo.
-- Luego ejecuta seed.sql para los datos iniciales.
-- ============================================================

-- ---------- Extensiones ----------
create extension if not exists "pgcrypto";  -- gen_random_uuid()

-- ============================================================
-- TABLAS
-- ============================================================

create table if not exists households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

create table if not exists members (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  name          text not null,
  auth_user_id  uuid references auth.users(id),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists months (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  year          int  not null,
  month         int  not null check (month between 1 and 12),
  total_budget  numeric(12,2) not null default 0,
  is_closed     boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (household_id, year, month)
);

create table if not exists categories (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  name          text not null,
  sort_order    int  not null default 0,
  is_active     boolean not null default true
);

create table if not exists month_budgets (
  id              uuid primary key default gen_random_uuid(),
  month_id        uuid not null references months(id) on delete cascade,
  category_id     uuid not null references categories(id) on delete cascade,
  assigned_amount numeric(12,2) not null default 0,
  unique (month_id, category_id)
);

create table if not exists expenses (
  id            uuid primary key default gen_random_uuid(),
  month_id      uuid not null references months(id) on delete cascade,
  category_id   uuid not null references categories(id) on delete cascade,
  amount        numeric(12,2) not null check (amount >= 0),
  spent_at      date not null default current_date,
  note          text,
  created_by    uuid references members(id),
  created_at    timestamptz not null default now()
);

create table if not exists income_targets (
  id            uuid primary key default gen_random_uuid(),
  month_id      uuid not null references months(id) on delete cascade,
  member_id     uuid not null references members(id) on delete cascade,
  target_amount numeric(12,2) not null default 0,
  unique (month_id, member_id)
);

create table if not exists contributions (
  id            uuid primary key default gen_random_uuid(),
  month_id      uuid not null references months(id) on delete cascade,
  member_id     uuid not null references members(id) on delete cascade,
  amount        numeric(12,2) not null check (amount >= 0),
  paid_at       date not null default current_date,
  note          text,
  created_by    uuid references members(id),
  created_at    timestamptz not null default now()
);

-- Índices para consultas frecuentes
create index if not exists idx_expenses_month        on expenses(month_id);
create index if not exists idx_expenses_category     on expenses(category_id);
create index if not exists idx_contributions_month   on contributions(month_id);
create index if not exists idx_contributions_member  on contributions(member_id);
create index if not exists idx_month_budgets_month   on month_budgets(month_id);
create index if not exists idx_income_targets_month  on income_targets(month_id);

-- ============================================================
-- VISTAS DERIVADAS (saldos ya calculados para el frontend)
-- ============================================================

-- Saldo por categoría en cada mes
create or replace view v_category_balances as
select
  mb.month_id,
  m.household_id,
  mb.category_id,
  c.name        as category_name,
  c.sort_order,
  mb.assigned_amount,
  coalesce(e.spent, 0)                          as spent,
  mb.assigned_amount - coalesce(e.spent, 0)     as remaining
from month_budgets mb
join months     m on m.id = mb.month_id
join categories c on c.id = mb.category_id
left join (
  select month_id, category_id, sum(amount) as spent
  from expenses
  group by month_id, category_id
) e on e.month_id = mb.month_id and e.category_id = mb.category_id;

-- Resumen global del mes
create or replace view v_month_summary as
select
  m.id            as month_id,
  m.household_id,
  m.year,
  m.month,
  m.total_budget,
  m.is_closed,
  coalesce(ex.spent, 0)                       as total_spent,
  m.total_budget - coalesce(ex.spent, 0)      as total_remaining,
  coalesce(it.target_total, 0)                as income_goal,
  coalesce(co.collected, 0)                   as total_collected,
  coalesce(it.target_total, 0) - coalesce(co.collected, 0) as income_pending
from months m
left join (select month_id, sum(amount) spent       from expenses      group by month_id) ex on ex.month_id = m.id
left join (select month_id, sum(target_amount) target_total from income_targets group by month_id) it on it.month_id = m.id
left join (select month_id, sum(amount) collected   from contributions group by month_id) co on co.month_id = m.id;

-- Aportación por persona en cada mes
create or replace view v_member_contributions as
select
  it.month_id,
  m.household_id,
  it.member_id,
  mem.name        as member_name,
  mem.is_active,
  it.target_amount,
  coalesce(co.contributed, 0)                       as contributed,
  it.target_amount - coalesce(co.contributed, 0)    as pending,
  (coalesce(co.contributed, 0) >= it.target_amount) as is_complete
from income_targets it
join months  m  on m.id = it.month_id
join members mem on mem.id = it.member_id
left join (
  select month_id, member_id, sum(amount) as contributed
  from contributions
  group by month_id, member_id
) co on co.month_id = it.month_id and co.member_id = it.member_id;

-- ============================================================
-- RPC: crear (o clonar) un mes nuevo a partir del mes previo
-- Devuelve el id del mes objetivo. Idempotente: si ya existe, lo devuelve.
-- ============================================================
create or replace function create_month(
  p_household_id uuid,
  p_year         int,
  p_month        int
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month_id   uuid;
  v_prev_id    uuid;
  v_prev_budget numeric(12,2);
begin
  -- ¿ya existe?
  select id into v_month_id
  from months
  where household_id = p_household_id and year = p_year and month = p_month;
  if v_month_id is not null then
    return v_month_id;
  end if;

  -- mes anterior más reciente (por año/mes)
  select id, total_budget into v_prev_id, v_prev_budget
  from months
  where household_id = p_household_id
    and (year * 12 + month) < (p_year * 12 + p_month)
  order by (year * 12 + month) desc
  limit 1;

  -- crear el mes (clona total_budget si hay anterior)
  insert into months (household_id, year, month, total_budget)
  values (p_household_id, p_year, p_month, coalesce(v_prev_budget, 0))
  returning id into v_month_id;

  if v_prev_id is not null then
    -- clonar presupuestos por categoría
    insert into month_budgets (month_id, category_id, assigned_amount)
    select v_month_id, category_id, assigned_amount
    from month_budgets where month_id = v_prev_id;

    -- clonar metas de ingreso de miembros activos
    insert into income_targets (month_id, member_id, target_amount)
    select v_month_id, it.member_id, it.target_amount
    from income_targets it
    join members mem on mem.id = it.member_id
    where it.month_id = v_prev_id and mem.is_active = true;
  else
    -- sin mes anterior: crea presupuestos en 0 para categorías activas
    insert into month_budgets (month_id, category_id, assigned_amount)
    select v_month_id, id, 0 from categories
    where household_id = p_household_id and is_active = true;

    insert into income_targets (month_id, member_id, target_amount)
    select v_month_id, id, 0 from members
    where household_id = p_household_id and is_active = true;
  end if;

  return v_month_id;
end;
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- Modelo: un solo login familiar compartido. Cualquier usuario
-- autenticado del proyecto accede a los datos. (Single-tenant)
-- ============================================================
alter table households     enable row level security;
alter table members        enable row level security;
alter table months         enable row level security;
alter table categories     enable row level security;
alter table month_budgets  enable row level security;
alter table expenses       enable row level security;
alter table income_targets enable row level security;
alter table contributions  enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'households','members','months','categories',
    'month_budgets','expenses','income_targets','contributions'
  ]
  loop
    execute format('drop policy if exists "auth_all" on %I;', t);
    execute format(
      'create policy "auth_all" on %I for all to authenticated using (true) with check (true);',
      t
    );
  end loop;
end $$;

-- ============================================================
-- REALTIME: publicar tablas que cambian en vivo
-- ============================================================
do $$
begin
  begin execute 'alter publication supabase_realtime add table expenses';      exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table contributions'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table month_budgets'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table income_targets';exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table months';        exception when others then null; end;
end $$;

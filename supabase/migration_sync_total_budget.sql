-- ============================================================
-- Migración: sincronizar months.total_budget automáticamente
-- Pega y ejecuta esto en Supabase > SQL Editor (una sola vez).
-- Ya está incorporado a schema.sql para instalaciones nuevas.
-- ============================================================

-- 1) Trigger que recalcula months.total_budget cada vez que cambia
--    un presupuesto de categoría (insert/update/delete en month_budgets).
create or replace function sync_month_total_budget() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month_id uuid := coalesce(new.month_id, old.month_id);
begin
  update months
  set total_budget = (
    select coalesce(sum(assigned_amount), 0)
    from month_budgets
    where month_id = v_month_id
  )
  where id = v_month_id;
  return null;
end;
$$;

drop trigger if exists trg_sync_month_total_budget on month_budgets;
create trigger trg_sync_month_total_budget
after insert or update or delete on month_budgets
for each row
execute function sync_month_total_budget();

-- 2) create_month actualizado: ya no clona total_budget a mano
--    (el trigger de arriba lo recalcula solo en cuanto clona los
--    presupuestos por categoría).
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
begin
  select id into v_month_id
  from months
  where household_id = p_household_id and year = p_year and month = p_month;
  if v_month_id is not null then
    return v_month_id;
  end if;

  select id into v_prev_id
  from months
  where household_id = p_household_id
    and (year * 12 + month) < (p_year * 12 + p_month)
  order by (year * 12 + month) desc
  limit 1;

  insert into months (household_id, year, month)
  values (p_household_id, p_year, p_month)
  returning id into v_month_id;

  if v_prev_id is not null then
    insert into month_budgets (month_id, category_id, assigned_amount)
    select v_month_id, category_id, assigned_amount
    from month_budgets where month_id = v_prev_id;

    insert into income_targets (month_id, member_id, target_amount)
    select v_month_id, it.member_id, it.target_amount
    from income_targets it
    join members mem on mem.id = it.member_id
    where it.month_id = v_prev_id and mem.is_active = true;
  else
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

-- 3) Backfill: corrige de una sola vez los meses que ya existen
--    (incluye Agosto 2026, que hoy muestra el $24,000 desincronizado).
update months m
set total_budget = coalesce((
  select sum(mb.assigned_amount) from month_budgets mb where mb.month_id = m.id
), 0)
where m.total_budget <> coalesce((
  select sum(mb.assigned_amount) from month_budgets mb where mb.month_id = m.id
), 0);

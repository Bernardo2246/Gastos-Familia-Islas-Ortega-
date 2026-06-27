-- ============================================================
-- Datos semilla — ejecuta DESPUÉS de schema.sql
-- Crea: 1 hogar, 6 miembros (4 activos), 11 categorías,
-- el mes actual (2026-06) con presupuesto 22,520, sus
-- montos por categoría y las metas de aportación.
-- Idempotente: no duplica si ya existe el hogar "Familia".
-- ============================================================
do $$
declare
  v_household uuid;
  v_month     uuid;
  v_year      int := 2026;
  v_mon       int := 6;
begin
  -- Hogar (no duplicar)
  select id into v_household from households where name = 'Familia' limit 1;
  if v_household is null then
    insert into households(name) values ('Familia') returning id into v_household;
  end if;

  -- Miembros
  insert into members(household_id, name, is_active)
  select v_household, x.name, x.active
  from (values
    ('Angel',   true),
    ('Rol',     true),
    ('Renta',   true),
    ('Gisela',  true),
    ('Futuro 1',false),
    ('Futuro 2',false)
  ) as x(name, active)
  where not exists (
    select 1 from members m where m.household_id = v_household and m.name = x.name
  );

  -- Categorías
  insert into categories(household_id, name, sort_order)
  select v_household, x.name, x.ord
  from (values
    ('Renta',1),('Servicios',2),('Gas',3),('Comida',4),
    ('Agua y tortillas',5),('Pasajes y transporte',6),('Despensa',7),
    ('Cenas y botanas',8),('Mantenimiento',9),('Vacaciones',10),('Extras',11)
  ) as x(name, ord)
  where not exists (
    select 1 from categories c where c.household_id = v_household and c.name = x.name
  );

  -- Mes actual
  select id into v_month from months
  where household_id = v_household and year = v_year and month = v_mon;
  if v_month is null then
    insert into months(household_id, year, month, total_budget)
    values (v_household, v_year, v_mon, 22520) returning id into v_month;
  end if;

  -- Presupuesto por categoría (base)
  insert into month_budgets(month_id, category_id, assigned_amount)
  select v_month, c.id, x.amount
  from (values
    ('Renta',5000),('Servicios',1580),('Gas',510),('Comida',8000),
    ('Agua y tortillas',800),('Pasajes y transporte',1150),('Despensa',2900),
    ('Cenas y botanas',900),('Mantenimiento',280),('Vacaciones',500),('Extras',900)
  ) as x(name, amount)
  join categories c on c.household_id = v_household and c.name = x.name
  on conflict (month_id, category_id) do nothing;

  -- Metas de aportación
  insert into income_targets(month_id, member_id, target_amount)
  select v_month, m.id, x.amount
  from (values
    ('Angel',7500),('Rol',7500),('Renta',4000),('Gisela',3520)
  ) as x(name, amount)
  join members m on m.household_id = v_household and m.name = x.name
  on conflict (month_id, member_id) do nothing;
end $$;

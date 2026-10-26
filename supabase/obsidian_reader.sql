-- ============================================================================
-- Rol de SOLO LECTURA para la sincronización con Obsidian (gastos-familia)
--
-- `scripts/sync-obsidian.mjs` lee meses, sobres, gastos y aportaciones para
-- escribir la carpeta `Gastos Familia/` de la bóveda. Usa este rol, que:
--   - solo tiene SELECT sobre las tablas que necesita (no puede escribir ni
--     borrar nada aunque se filtre la contraseña);
--   - tiene forzado default_transaction_read_only;
--   - ve todas las filas mediante políticas RLS propias (la app es de un solo
--     hogar; las políticas de la app son solo para `authenticated`).
--
-- NO lo corras tal cual: `node scripts/setup-obsidian-reader.mjs` genera una
-- contraseña aleatoria, escribe `.env.sync` y deja este mismo SQL con la
-- contraseña puesta en `supabase/obsidian_reader.local.sql` (ignorado por
-- git). Ese es el que se pega en Supabase → SQL Editor → Run.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'obsidian_reader') then
    create role obsidian_reader login password 'CAMBIA_ESTA_CONTRASEÑA';
  else
    alter role obsidian_reader login password 'CAMBIA_ESTA_CONTRASEÑA';
  end if;
end $$;

alter role obsidian_reader set default_transaction_read_only = on;
alter role obsidian_reader set statement_timeout = '30s';

grant usage on schema public to obsidian_reader;

do $$
declare
  t text;
begin
  foreach t in array array[
    'households', 'members', 'months', 'categories',
    'month_budgets', 'expenses', 'income_targets', 'contributions'
  ]
  loop
    execute format('grant select on %I to obsidian_reader', t);
    execute format('drop policy if exists "obsidian_reader_select" on %I', t);
    execute format('create policy "obsidian_reader_select" on %I for select to obsidian_reader using (true)', t);
  end loop;
end $$;

-- Verificación: debe listar 8 tablas, todas solo con SELECT.
select table_name, privilege_type
from information_schema.role_table_grants
where grantee = 'obsidian_reader'
order by table_name;

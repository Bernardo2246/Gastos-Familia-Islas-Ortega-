-- ============================================================
-- Totales del mes en una sola vista (2026-10-28)
--
-- Problema: Asignado, Meta de aportaciones, Recaudado y Gastado se sumaban
-- en el cliente (src/lib/finance.js) y la vista v_month_summary, que nadie
-- usaba, calculaba otro "restante" (presupuesto − gastado). En octubre 2026
-- lo asignado ($27,946) no coincidía con la meta ($27,916) y nada lo avisó.
--
-- Corrección: v_month_totals es la fuente oficial de los totales del mes,
-- incluida la diferencia Asignado − Meta. La leen Inicio, Aportaciones,
-- Categorías, Ajustes, Historial, Análisis y la sincronización con Obsidian.
-- finance.js repite la misma fórmula solo mientras hay movimientos sin
-- sincronizar; scripts/verify-month-totals.mjs comprueba que coincidan.
-- Se borra v_month_summary. No toca datos.
-- ============================================================

drop view if exists v_month_summary;

create or replace view v_month_totals with (security_invoker = true) as
select
  m.id            as month_id,
  m.household_id,
  m.year,
  m.month,
  m.is_closed,
  coalesce(mb.assigned, 0)                              as assigned,
  coalesce(it.goal, 0)                                  as income_goal,
  coalesce(co.collected, 0)                             as collected,
  coalesce(ex.spent, 0)                                 as spent,
  -- > 0 falta aportar para cubrir lo asignado; < 0 sobra aportación sin asignar.
  coalesce(mb.assigned, 0) - coalesce(it.goal, 0)       as difference,
  coalesce(co.collected, 0) - coalesce(ex.spent, 0)     as remaining,
  coalesce(it.goal, 0) - coalesce(co.collected, 0)      as income_pending,
  greatest(coalesce(it.goal, 0) - coalesce(co.collected, 0), 0) as to_collect
from months m
left join (select month_id, sum(assigned_amount) assigned from month_budgets  group by month_id) mb on mb.month_id = m.id
left join (select month_id, sum(target_amount)   goal     from income_targets group by month_id) it on it.month_id = m.id
left join (select month_id, sum(amount)          collected from contributions group by month_id) co on co.month_id = m.id
left join (select month_id, sum(amount)          spent    from expenses       group by month_id) ex on ex.month_id = m.id;

revoke all on v_month_totals from anon;
grant select on v_month_totals to authenticated;

-- La sincronización con Obsidian lee con el rol de solo lectura.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'obsidian_reader') then
    execute 'grant select on v_month_totals to obsidian_reader';
  end if;
end $$;

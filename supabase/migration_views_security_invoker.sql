-- ============================================================
-- Vistas con security_invoker (2026-10-25)
--
-- Problema: las tres vistas se creaban sin security_invoker, así que se
-- ejecutaban con los permisos de su dueño (postgres), se saltaban el RLS
-- de las tablas y cualquiera con la anon key pública (que va dentro del
-- bundle de la app) podía leer saldos, metas y aportaciones por persona.
-- Además anon tenía todos los privilegios sobre ellas.
--
-- Corrección: security_invoker = true (la vista aplica el RLS de quien
-- consulta: authenticated pasa por la política "auth_all", anon no ve
-- nada) y se quitan los privilegios de anon. No toca datos.
--
-- Diagnóstico y verificación: scripts/verify-views-security.mjs
-- ============================================================

alter view v_category_balances    set (security_invoker = true);
alter view v_month_summary        set (security_invoker = true);
alter view v_member_contributions set (security_invoker = true);

revoke all on v_category_balances, v_month_summary, v_member_contributions from anon;

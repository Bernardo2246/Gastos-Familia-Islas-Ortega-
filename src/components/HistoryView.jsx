import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { money, monthLabel } from '../lib/format'
import { monthSummaries } from '../lib/finance'

export default function HistoryView() {
  const { household, goToMonth, createMonth, ym } = useApp()
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!household) return
    setLoading(true)
    // Se calcula con lib/finance.js (no con la vista v_month_summary) para que
    // el restante de cada mes sea el mismo que muestra Inicio.
    const { data: months } = await supabase.from('months').select('id,year,month').eq('household_id', household.id)
    const ids = (months || []).map((m) => m.id)
    const [ex, co, mb] = ids.length ? await Promise.all([
      supabase.from('expenses').select('month_id,category_id,amount').in('month_id', ids),
      supabase.from('contributions').select('month_id,amount').in('month_id', ids),
      supabase.from('month_budgets').select('month_id,category_id,assigned_amount').in('month_id', ids),
    ]) : [{}, {}, {}]
    const res = monthSummaries({
      months: months || [], expenses: ex.data || [], contributions: co.data || [], budgets: mb.data || [],
    })
    setRows(res.reverse())
    setLoading(false)
  }, [household])

  useEffect(() => { load() }, [load])

  // Siguiente mes respecto al más reciente registrado (o al actual).
  const nextOf = () => {
    const base = rows[0] ? { year: rows[0].year, month: rows[0].month } : ym
    const idx = base.year * 12 + (base.month - 1) + 1
    return { year: Math.floor(idx / 12), month: (idx % 12) + 1 }
  }

  const onCreateNext = async () => {
    const n = nextOf()
    await createMonth(n.year, n.month)
    goToMonth(n.year, n.month)
    navigate('/')
  }

  const open = (r) => { goToMonth(r.year, r.month); navigate('/') }

  return (
    <div className="content">
      <div className="section-title">Historial de meses</div>
      <button className="btn secondary" onClick={onCreateNext}>
        ➕ Iniciar nuevo mes ({monthLabel(nextOf().year, nextOf().month)})
      </button>

      {loading ? (
        <div className="empty">Cargando…</div>
      ) : rows.length === 0 ? (
        <div className="empty">Aún no hay meses guardados.</div>
      ) : (
        <div className="row-list">
          {rows.map((r) => {
            const neg = r.remaining < 0
            return (
              <button key={r.id} className="row" onClick={() => open(r)} style={{ textAlign: 'left' }}>
                <div className="row-top">
                  <span className="row-name">{monthLabel(r.year, r.month)}</span>
                  <span className={`row-remain ${neg ? 'neg' : ''}`}>{money(r.remaining)}</span>
                </div>
                <div className="row-sub">
                  <span>Gastado {money(r.spent)} de {money(r.collected)}</span>
                  <span>Presupuesto {money(r.budget)}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

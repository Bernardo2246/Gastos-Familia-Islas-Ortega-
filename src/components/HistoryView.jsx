import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { money, monthLabel } from '../lib/format'

export default function HistoryView() {
  const { household, goToMonth, createMonth, ym } = useApp()
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!household) return
    setLoading(true)
    const { data } = await supabase
      .from('v_month_summary')
      .select('*')
      .eq('household_id', household.id)
      .order('year', { ascending: false })
      .order('month', { ascending: false })
    setRows(data || [])
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
            const neg = Number(r.total_remaining) < 0
            return (
              <button key={r.month_id} className="row" onClick={() => open(r)} style={{ textAlign: 'left' }}>
                <div className="row-top">
                  <span className="row-name">{monthLabel(r.year, r.month)}</span>
                  <span className={`row-remain ${neg ? 'neg' : ''}`}>{money(r.total_remaining)}</span>
                </div>
                <div className="row-sub">
                  <span>Gastado {money(r.total_spent)} de {money(r.total_budget)}</span>
                  <span>Recaudado {money(r.total_collected)}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

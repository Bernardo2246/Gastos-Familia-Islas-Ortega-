import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { money } from '../lib/format'
import Meter from './Meter'

export default function GlobalView() {
  const {
    monthMissing, createMonth, ym,
    totalBudget, totalSpent, totalRemaining,
    incomeGoal, totalCollected, incomePending,
    categoryBalances, expenses,
  } = useApp()

  if (monthMissing) {
    return (
      <div className="content">
        <div className="empty">
          <p>No hay datos para este mes todavía.</p>
          <button className="btn" style={{ maxWidth: 280, margin: '12px auto' }}
            onClick={() => createMonth(ym.year, ym.month)}>
            Crear mes (clonar presupuesto anterior)
          </button>
        </div>
      </div>
    )
  }

  const neg = totalRemaining < 0
  const topCats = [...categoryBalances].sort((a, b) => a.remaining - b.remaining).slice(0, 4)

  return (
    <div className="content">
      <div className="hero">
        <div className="label">Restante del mes</div>
        <div className={`amount ${neg ? 'neg' : ''}`}>{money(totalRemaining)}</div>
        <div className="sub">Gastado {money(totalSpent)} de {money(totalBudget)}</div>
        <div className="meter"><span style={{ width: `${Math.min(100, totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0)}%` }} /></div>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <div className="k">Recaudado</div>
          <div className="v">{money(totalCollected)}</div>
          <Meter value={totalCollected} max={incomeGoal} />
        </div>
        <div className="stat">
          <div className="k">Falta recaudar</div>
          <div className="v">{money(Math.max(0, incomePending))}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Meta {money(incomeGoal)}</div>
        </div>
      </div>

      <div>
        <div className="section-title flex-between">
          <span>Atención por categoría</span>
          <Link to="/categorias" className="muted" style={{ fontSize: 12, textTransform: 'none' }}>Ver todas ›</Link>
        </div>
        <div className="row-list">
          {topCats.map((c) => (
            <Link key={c.id} to={`/categorias/${c.id}`} className="row">
              <div className="row-top">
                <span className="row-name">{c.name}</span>
                <span className={`row-remain ${c.remaining < 0 ? 'neg' : ''}`}>{money(c.remaining)}</span>
              </div>
              <Meter value={c.spent} max={c.assigned} />
              <div className="row-sub">
                <span>{money(c.spent)} gastado</span>
                <span>de {money(c.assigned)}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <div className="section-title">Últimos gastos</div>
        {expenses.length === 0 ? (
          <div className="empty">Aún no hay gastos. Toca el botón ➕ para registrar el primero.</div>
        ) : (
          <div className="card">
            {expenses.slice(0, 6).map((e) => {
              const cat = categoryBalances.find((c) => c.id === e.category_id)
              return (
                <div className="tx" key={e.id}>
                  <div className="tx-main">
                    <span className="tx-note">{e.note || cat?.name || 'Gasto'}</span>
                    <span className="tx-meta">{cat?.name} · {e.spent_at}</span>
                  </div>
                  <span className="tx-amt">{money(e.amount)}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

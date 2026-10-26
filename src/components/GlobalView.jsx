import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { money, formatDate } from '../lib/format'
import Meter from './Meter'
import CategorySheet from './CategorySheet'
import MovementSheets from './MovementSheets'
import { MovementList, MovementRow } from './MovementRow'
import { remainClass } from './status'

const SWIPE_MONTH_PX = 70

// Deslizar horizontalmente sobre Inicio cambia de mes (izquierda = siguiente).
// Solo cuenta un gesto claramente horizontal, para no pelear con el scroll.
function useMonthSwipe(shiftMonth) {
  const start = useRef(null)
  return {
    onTouchStart: (e) => {
      const t = e.touches[0]
      start.current = { x: t.clientX, y: t.clientY }
    },
    onTouchEnd: (e) => {
      const s = start.current
      start.current = null
      if (!s || document.documentElement.classList.contains('sheet-open')) return
      // Un deslizamiento sobre una fila de gasto es para "Eliminar", no para cambiar de mes.
      if (e.target.closest?.('.mv-row')) return
      const t = e.changedTouches[0]
      const dx = t.clientX - s.x
      const dy = t.clientY - s.y
      if (Math.abs(dx) >= SWIPE_MONTH_PX && Math.abs(dx) > Math.abs(dy) * 2) shiftMonth(dx < 0 ? 1 : -1)
    },
  }
}

export default function GlobalView() {
  const {
    monthMissing, createMonth, ym, shiftMonth,
    totalSpent, totalRemaining,
    incomeGoal, totalCollected, incomePending,
    categoryBalances, expenses, members, deleteExpense,
  } = useApp()
  const swipe = useMonthSwipe(shiftMonth)
  const [openCat, setOpenCat] = useState(null)
  const [selected, setSelected] = useState(null)

  if (monthMissing) {
    return (
      <div className="content" {...swipe}>
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
  // Primero los sobres más comprometidos (por porcentaje usado).
  const ratio = (c) => (c.assigned > 0 ? c.spent / c.assigned : c.spent > 0 ? Infinity : 0)
  const topCats = [...categoryBalances].sort((a, b) => ratio(b) - ratio(a)).slice(0, 4)
  const catName = (id) => categoryBalances.find((c) => c.id === id)?.name
  const who = (id) => members.find((m) => m.id === id)?.name

  return (
    <div className="content" {...swipe}>
      <div className={`hero ${neg ? 'neg' : ''}`}>
        <div className="label">Restante del mes</div>
        <div className="amount">{money(totalRemaining)}</div>
        <div className="sub">Recaudado {money(totalCollected)} − gastado {money(totalSpent)}</div>
        <div className="meter"><span style={{ width: `${Math.min(100, totalCollected > 0 ? (totalSpent / totalCollected) * 100 : totalSpent > 0 ? 100 : 0)}%` }} /></div>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <div className="k">Recaudado</div>
          <div className="v">{money(totalCollected)}</div>
          <Meter value={totalCollected} max={incomeGoal} goal />
        </div>
        <div className="stat">
          <div className="k">Falta recaudar</div>
          <div className="v">{money(Math.max(0, incomePending))}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Meta {money(incomeGoal)}</div>
        </div>
      </div>

      <div>
        <div className="section-title flex-between">
          <span>Atención por sobre</span>
          <Link to="/categorias" className="section-link">Ver todos</Link>
        </div>
        <div className="row-list">
          {topCats.map((c) => (
            <button key={c.id} type="button" className="row" onClick={() => setOpenCat(c.id)}>
              <div className="row-top">
                <span className="row-name">{c.name}</span>
                <span className={`row-remain ${remainClass(c)}`}>{money(c.remaining)}</span>
              </div>
              <Meter value={c.spent} max={c.assigned} />
              <div className="row-sub">
                <span>{money(c.spent)} gastado</span>
                <span>de {money(c.assigned)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="section-title">Últimos gastos</div>
        <MovementList empty="Aún no hay gastos. Toca + para registrar el primero.">
          {expenses.slice(0, 6).map((e) => (
            <MovementRow key={e.id}
              title={e.note || catName(e.category_id) || 'Gasto'}
              subtitle={[catName(e.category_id), formatDate(e.spent_at), who(e.created_by)].filter(Boolean).join(' · ')}
              amount={money(e.amount)}
              onOpen={() => setSelected({ kind: 'expense', id: e.id })}
              onDelete={() => deleteExpense(e.id)}
              deleteConfirm="¿Eliminar este gasto?" />
          ))}
        </MovementList>
      </div>

      {openCat && <CategorySheet categoryId={openCat} onClose={() => setOpenCat(null)} />}
      <MovementSheets selected={selected} onClose={() => setSelected(null)} />
    </div>
  )
}

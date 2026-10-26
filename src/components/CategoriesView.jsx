import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { money } from '../lib/format'
import Meter from './Meter'
import CategorySheet from './CategorySheet'
import { remainClass } from './status'

export default function CategoriesView() {
  const { categoryBalances, assignedSum, totalSpent } = useApp()
  const [openCat, setOpenCat] = useState(null)

  return (
    <div className="content">
      <div className="stat-grid">
        <div className="stat"><div className="k">Asignado</div><div className="v">{money(assignedSum)}</div></div>
        <div className="stat"><div className="k">Gastado</div><div className="v">{money(totalSpent)}</div></div>
      </div>
      <div className="row-list">
        {categoryBalances.map((c) => (
          <button key={c.id} type="button" className="row" onClick={() => setOpenCat(c.id)}>
            <div className="row-top">
              <span className="row-name">{c.name}</span>
              <span className={`row-remain ${remainClass(c)}`}>{money(c.remaining)}</span>
            </div>
            <Meter value={c.spent} max={c.assigned} />
            <div className="row-sub">
              <span>{money(c.spent)} de {money(c.assigned)}</span>
              <span>{c.remaining < 0 ? 'excedido' : 'restante'}</span>
            </div>
          </button>
        ))}
      </div>

      {openCat && <CategorySheet categoryId={openCat} onClose={() => setOpenCat(null)} />}
    </div>
  )
}

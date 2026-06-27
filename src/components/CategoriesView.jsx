import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { money } from '../lib/format'
import Meter from './Meter'

export default function CategoriesView() {
  const { categoryBalances, assignedSum, totalSpent } = useApp()

  return (
    <div className="content">
      <div className="stat-grid">
        <div className="stat"><div className="k">Asignado</div><div className="v">{money(assignedSum)}</div></div>
        <div className="stat"><div className="k">Gastado</div><div className="v">{money(totalSpent)}</div></div>
      </div>
      <div className="row-list">
        {categoryBalances.map((c) => (
          <Link key={c.id} to={`/categorias/${c.id}`} className="row">
            <div className="row-top">
              <span className="row-name">{c.name}</span>
              <span className={`row-remain ${c.remaining < 0 ? 'neg' : ''}`}>{money(c.remaining)}</span>
            </div>
            <Meter value={c.spent} max={c.assigned} />
            <div className="row-sub">
              <span>{money(c.spent)} de {money(c.assigned)}</span>
              <span>{c.remaining < 0 ? 'Excedido' : 'restante'}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

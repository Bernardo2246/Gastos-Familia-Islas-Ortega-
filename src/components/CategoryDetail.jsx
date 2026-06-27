import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { money, formatDate } from '../lib/format'
import Meter from './Meter'

export default function CategoryDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { categoryBalances, expenses, members, deleteExpense } = useApp()

  const cat = categoryBalances.find((c) => c.id === id)
  if (!cat) return <div className="content"><div className="empty">Categoría no encontrada.</div></div>

  const list = expenses.filter((e) => e.category_id === id)
  const memberName = (mid) => members.find((m) => m.id === mid)?.name || '—'

  return (
    <div className="content">
      <button className="pill" style={{ alignSelf: 'flex-start' }} onClick={() => navigate(-1)}>‹ Volver</button>
      <div className="hero" style={{ background: 'var(--bg-card)', border: '1px solid var(--line)' }}>
        <div className="label" style={{ color: 'var(--muted)' }}>{cat.name} — restante</div>
        <div className={`amount ${cat.remaining < 0 ? 'neg' : ''}`}>{money(cat.remaining)}</div>
        <div className="sub" style={{ color: 'var(--muted)' }}>Gastado {money(cat.spent)} de {money(cat.assigned)}</div>
        <div style={{ marginTop: 14 }}><Meter value={cat.spent} max={cat.assigned} /></div>
      </div>

      <div className="section-title">Movimientos ({list.length})</div>
      {list.length === 0 ? (
        <div className="empty">Sin gastos en esta categoría.</div>
      ) : (
        <div className="card">
          {list.map((e) => (
            <div className="tx" key={e.id}>
              <div className="tx-main">
                <span className="tx-note">{e.note || cat.name}</span>
                <span className="tx-meta">{formatDate(e.spent_at)} · {memberName(e.created_by)}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span className="tx-amt">{money(e.amount)}</span>
                <button className="del" onClick={() => deleteExpense(e.id)} aria-label="Eliminar">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

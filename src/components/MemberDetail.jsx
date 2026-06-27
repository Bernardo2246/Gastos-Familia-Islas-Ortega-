import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { money, formatDate } from '../lib/format'
import Meter from './Meter'

export default function MemberDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { memberRows, contributions, members, deleteContribution } = useApp()

  const m = memberRows.find((x) => x.id === id)
  if (!m) return <div className="content"><div className="empty">Persona no encontrada.</div></div>

  const list = contributions.filter((c) => c.member_id === id)
  const byName = (mid) => members.find((x) => x.id === mid)?.name || '—'

  return (
    <div className="content">
      <button className="pill" style={{ alignSelf: 'flex-start' }} onClick={() => navigate(-1)}>‹ Volver</button>
      <div className="hero" style={{ background: 'var(--bg-card)', border: '1px solid var(--line)' }}>
        <div className="label" style={{ color: 'var(--muted)' }}>{m.name} — aportado</div>
        <div className="amount">{money(m.contributed)}</div>
        <div className="sub" style={{ color: 'var(--muted)' }}>
          {m.isComplete ? 'Meta completada ✓' : `Faltan ${money(m.pending)} de ${money(m.target)}`}
        </div>
        <div style={{ marginTop: 14 }}><Meter value={m.contributed} max={m.target} /></div>
      </div>

      <div className="section-title">Aportaciones ({list.length})</div>
      {list.length === 0 ? (
        <div className="empty">Sin aportaciones registradas.</div>
      ) : (
        <div className="card">
          {list.map((c) => (
            <div className="tx" key={c.id}>
              <div className="tx-main">
                <span className="tx-note">{money(c.amount)}{c.note ? ` · ${c.note}` : ''}</span>
                <span className="tx-meta">{formatDate(c.paid_at)} · registró {byName(c.created_by)}</span>
              </div>
              <button className="del" onClick={() => deleteContribution(c.id)} aria-label="Eliminar">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

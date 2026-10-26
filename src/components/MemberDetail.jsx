import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { money, formatDate } from '../lib/format'
import Meter from './Meter'
import MovementSheets from './MovementSheets'
import { MovementList, MovementRow } from './MovementRow'

export default function MemberDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { memberRows, contributions, members, deleteContribution } = useApp()
  const [selected, setSelected] = useState(null)

  const m = memberRows.find((x) => x.id === id)
  if (!m) return <div className="content"><div className="empty">Persona no encontrada.</div></div>

  const list = contributions
    .filter((c) => c.member_id === id)
    .sort((a, b) => (a.paid_at === b.paid_at ? 0 : a.paid_at < b.paid_at ? 1 : -1))
  const byName = (mid) => members.find((x) => x.id === mid)?.name

  return (
    <div className="content">
      <button className="pill back" onClick={() => navigate(-1)}>‹ Volver</button>
      <div className="hero plain">
        <div className="label">{m.name} · aportado</div>
        <div className="amount">{money(m.contributed)}</div>
        <div className="sub">
          {m.isComplete ? 'Meta completada' : m.target > 0 ? `Faltan ${money(m.pending)} de ${money(m.target)}` : 'Sin meta este mes'}
        </div>
        <div style={{ marginTop: 14 }}><Meter value={m.contributed} max={m.target} goal /></div>
      </div>

      <div className="section-title">{list.length} {list.length === 1 ? 'aportación' : 'aportaciones'}</div>
      <MovementList empty="Sin aportaciones registradas.">
        {list.map((c) => (
          <MovementRow key={c.id}
            title={c.note || 'Aportación'}
            subtitle={[formatDate(c.paid_at), byName(c.created_by) && `registró ${byName(c.created_by)}`].filter(Boolean).join(' · ')}
            amount={money(c.amount)}
            amountClass="credit"
            onOpen={() => setSelected({ kind: 'contribution', id: c.id })}
            onDelete={() => deleteContribution(c.id)}
            deleteConfirm="¿Eliminar esta aportación?" />
        ))}
      </MovementList>
      <button className="btn secondary" onClick={() => setSelected({ kind: 'contribution', id: 'new' })}>Registrar aportación de {m.name}</button>

      <MovementSheets selected={selected} presetMemberId={id} onClose={() => setSelected(null)} />
    </div>
  )
}

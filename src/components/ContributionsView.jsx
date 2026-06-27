import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { money } from '../lib/format'
import Meter from './Meter'

export default function ContributionsView() {
  const { memberRows, incomeGoal, totalCollected, incomePending } = useApp()

  return (
    <div className="content">
      <div className="hero" style={{ background: 'linear-gradient(160deg,#1c3a6b,#10204a)', borderColor: 'var(--line)' }}>
        <div className="label" style={{ color: '#bcd2f5' }}>Recaudado del mes</div>
        <div className="amount">{money(totalCollected)}</div>
        <div className="sub" style={{ color: '#bcd2f5' }}>Meta {money(incomeGoal)} · faltan {money(Math.max(0, incomePending))}</div>
        <div className="meter" style={{ marginTop: 14 }}><span style={{ width: `${incomeGoal > 0 ? Math.min(100, (totalCollected / incomeGoal) * 100) : 0}%` }} /></div>
      </div>

      <div className="row-list">
        {memberRows.map((m) => (
          <Link key={m.id} to={`/aportaciones/${m.id}`} className="row">
            <div className="row-top">
              <span className="row-name">{m.name}</span>
              {m.isComplete
                ? <span className="badge-ok">✓ Completo</span>
                : <span className="row-remain">{money(m.contributed)}</span>}
            </div>
            <Meter value={m.contributed} max={m.target} />
            <div className="row-sub">
              <span>{money(m.contributed)} de {money(m.target)}</span>
              <span>{m.pending > 0 ? `faltan ${money(m.pending)}` : 'al corriente'}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

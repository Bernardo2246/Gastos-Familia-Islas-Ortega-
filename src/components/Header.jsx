import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { monthLabel } from '../lib/format'

export default function Header() {
  const { ym, shiftMonth, online, pending, activeMemberId, members } = useApp()
  const navigate = useNavigate()
  const me = members.find((m) => m.id === activeMemberId)

  return (
    <header className="header">
      <div className="header-row">
        <div className="month-nav">
          <button onClick={() => shiftMonth(-1)} aria-label="Mes anterior">‹</button>
          <span className="label">{monthLabel(ym.year, ym.month)}</span>
          <button onClick={() => shiftMonth(1)} aria-label="Mes siguiente">›</button>
        </div>
        <div className="status-pills">
          {pending > 0 && <span className="pill queue" aria-label={`${pending} cambios por subir`}>⟳ {pending}</span>}
          {/* Estar en línea es lo normal: solo se avisa cuando no hay red. */}
          {!online && <span className="pill off">Sin red</span>}
          <button className="pill me" onClick={() => navigate('/ajustes')} aria-label="Ajustes">
            {me ? me.name : '⚙'}
          </button>
        </div>
      </div>
    </header>
  )
}

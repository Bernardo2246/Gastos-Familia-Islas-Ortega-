import { useApp } from '../context/AppContext'

export default function MemberGate() {
  const { members, setActiveMemberId } = useApp()
  const active = members.filter((m) => m.is_active)

  return (
    <div className="center-screen">
      <div className="logo">👋</div>
      <h1>¿Quién eres?</h1>
      <p>Elige tu nombre para registrar movimientos. Puedes cambiarlo después en Ajustes.</p>
      <div className="chips" style={{ justifyContent: 'center', marginTop: 8 }}>
        {active.map((m) => (
          <button key={m.id} className="chip" onClick={() => setActiveMemberId(m.id)}>
            {m.name}
          </button>
        ))}
      </div>
    </div>
  )
}

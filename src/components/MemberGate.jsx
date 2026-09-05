import { useApp } from '../context/AppContext'

export default function MemberGate() {
  const { members, setActiveMemberId } = useApp()
  // Solo personas reales pueden "iniciar sesión" como quién registra —
  // un aportante como "Renta" (ingreso, no persona) no debe aparecer aquí.
  const active = members.filter((m) => m.is_active && m.is_person !== false)

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

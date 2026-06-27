import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { todayISO } from '../lib/format'

export default function ContributionModal({ onClose, presetMemberId }) {
  const { members, addContribution } = useApp()
  const active = members.filter((m) => m.is_active)
  const [amount, setAmount] = useState('')
  const [memberId, setMemberId] = useState(presetMemberId || active[0]?.id || '')
  const [paidAt, setPaidAt] = useState(todayISO())
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const valid = Number(amount) > 0 && memberId

  const save = async () => {
    if (!valid) return
    setBusy(true)
    await addContribution({ member_id: memberId, amount, paid_at: paidAt, note })
    setBusy(false)
    onClose()
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grab" />
        <h2>Registrar aportación</h2>

        <div className="field">
          <label>Monto</label>
          <input className="input amount-input" type="number" inputMode="decimal"
            placeholder="$0" value={amount} autoFocus
            onChange={(e) => setAmount(e.target.value)} />
        </div>

        <div className="field">
          <label>¿De quién es la aportación?</label>
          <div className="chips">
            {active.map((m) => (
              <button key={m.id} type="button"
                className={`chip ${m.id === memberId ? 'active' : ''}`}
                onClick={() => setMemberId(m.id)}>{m.name}</button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Fecha</label>
          <input className="input" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
        </div>

        <div className="field">
          <label>Nota (opcional)</label>
          <input className="input" type="text" placeholder="Ej. Efectivo / 1ª parcialidad"
            value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn secondary" onClick={onClose}>Cancelar</button>
          <button className="btn" disabled={!valid || busy} onClick={save}>
            {busy ? 'Guardando…' : 'Guardar aportación'}
          </button>
        </div>
      </div>
    </div>
  )
}

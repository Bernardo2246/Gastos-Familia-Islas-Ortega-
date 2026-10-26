import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { todayISO } from '../lib/format'
import BottomSheet from './BottomSheet'

// Alta y edición de una aportación. Con `contribution` la edita y ofrece eliminarla.
export default function ContributionModal({ onClose, contribution, presetMemberId }) {
  const { members, addContribution, updateContribution, deleteContribution } = useApp()
  const active = members.filter((m) => m.is_active || m.id === contribution?.member_id)
  const [amount, setAmount] = useState(contribution ? String(contribution.amount) : '')
  const [memberId, setMemberId] = useState(contribution?.member_id || presetMemberId || active[0]?.id || '')
  const [paidAt, setPaidAt] = useState(contribution?.paid_at || todayISO())
  const [note, setNote] = useState(contribution?.note || '')
  const [busy, setBusy] = useState(false)

  const valid = Number(amount) > 0 && memberId

  const save = async () => {
    if (!valid) return
    setBusy(true)
    const data = { member_id: memberId, amount, paid_at: paidAt, note }
    if (contribution) await updateContribution(contribution.id, data)
    else await addContribution(data)
    setBusy(false)
    onClose()
  }

  const remove = async () => {
    if (!confirm('¿Eliminar esta aportación?')) return
    await deleteContribution(contribution.id)
    onClose()
  }

  return (
    <BottomSheet
      title={contribution ? 'Editar aportación' : 'Registrar aportación'}
      onClose={onClose}
      footer={
        <button className="btn" disabled={!valid || busy} onClick={save}>
          {busy ? 'Guardando…' : contribution ? 'Guardar cambios' : 'Guardar aportación'}
        </button>
      }
    >
      <div className="field">
        <label htmlFor="con-amount">Monto</label>
        <input id="con-amount" className="input amount-input" type="number" inputMode="decimal"
          placeholder="$0" value={amount} autoFocus={!contribution}
          onChange={(e) => setAmount(e.target.value)} />
      </div>

      <div className="field">
        <label>¿De quién es la aportación?</label>
        <div className="chips">
          {active.map((m) => (
            <button key={m.id} type="button"
              className={`chip ${m.id === memberId ? 'active' : ''}`}
              aria-pressed={m.id === memberId}
              onClick={() => setMemberId(m.id)}>{m.name}</button>
          ))}
        </div>
      </div>

      <div className="field">
        <label htmlFor="con-date">Fecha</label>
        <input id="con-date" className="input" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
      </div>

      <div className="field">
        <label htmlFor="con-note">Nota (opcional)</label>
        <input id="con-note" className="input" type="text" placeholder="Ej. Efectivo / 1ª parcialidad"
          value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      {contribution && <button type="button" className="btn danger" onClick={remove}>Eliminar aportación</button>}
    </BottomSheet>
  )
}

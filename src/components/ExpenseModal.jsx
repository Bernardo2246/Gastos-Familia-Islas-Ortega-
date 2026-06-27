import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { todayISO } from '../lib/format'

export default function ExpenseModal({ onClose }) {
  const { categories, addExpense } = useApp()
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '')
  const [spentAt, setSpentAt] = useState(todayISO())
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const valid = Number(amount) > 0 && categoryId

  const save = async () => {
    if (!valid) return
    setBusy(true)
    await addExpense({ category_id: categoryId, amount, spent_at: spentAt, note })
    setBusy(false)
    onClose()
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grab" />
        <h2>Nuevo gasto</h2>

        <div className="field">
          <label>Monto</label>
          <input className="input amount-input" type="number" inputMode="decimal"
            placeholder="$0" value={amount} autoFocus
            onChange={(e) => setAmount(e.target.value)} />
        </div>

        <div className="field">
          <label>Categoría</label>
          <div className="chips">
            {categories.map((c) => (
              <button key={c.id} type="button"
                className={`chip ${c.id === categoryId ? 'active' : ''}`}
                onClick={() => setCategoryId(c.id)}>{c.name}</button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Fecha</label>
          <input className="input" type="date" value={spentAt} onChange={(e) => setSpentAt(e.target.value)} />
        </div>

        <div className="field">
          <label>Nota (opcional)</label>
          <input className="input" type="text" placeholder="Ej. Súper de la semana"
            value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn secondary" onClick={onClose}>Cancelar</button>
          <button className="btn" disabled={!valid || busy} onClick={save}>
            {busy ? 'Guardando…' : 'Guardar gasto'}
          </button>
        </div>
      </div>
    </div>
  )
}

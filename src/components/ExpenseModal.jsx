import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { todayISO } from '../lib/format'
import BottomSheet from './BottomSheet'

// Alta y edición de un gasto. Con `expense` edita ese gasto y ofrece eliminarlo.
export default function ExpenseModal({ onClose, expense, presetCategoryId }) {
  const { categories: allCategories, addExpense, updateExpense, deleteExpense } = useApp()
  // Al editar, la categoría del gasto se muestra aunque esté oculta.
  const categories = allCategories.filter((c) => c.is_active || c.id === expense?.category_id)
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '')
  const [categoryId, setCategoryId] = useState(expense?.category_id || presetCategoryId || categories[0]?.id || '')
  const [spentAt, setSpentAt] = useState(expense?.spent_at || todayISO())
  const [note, setNote] = useState(expense?.note || '')
  const [busy, setBusy] = useState(false)

  const valid = Number(amount) > 0 && categoryId

  const save = async () => {
    if (!valid) return
    setBusy(true)
    const data = { category_id: categoryId, amount, spent_at: spentAt, note }
    if (expense) await updateExpense(expense.id, data)
    else await addExpense(data)
    setBusy(false)
    onClose()
  }

  const remove = async () => {
    if (!confirm('¿Eliminar este gasto?')) return
    await deleteExpense(expense.id)
    onClose()
  }

  return (
    <BottomSheet
      title={expense ? 'Editar gasto' : 'Nuevo gasto'}
      onClose={onClose}
      footer={
        <button className="btn" disabled={!valid || busy} onClick={save}>
          {busy ? 'Guardando…' : expense ? 'Guardar cambios' : 'Guardar gasto'}
        </button>
      }
    >
      <div className="field">
        <label htmlFor="exp-amount">Monto</label>
        <input id="exp-amount" className="input amount-input" type="number" inputMode="decimal"
          placeholder="$0" value={amount} autoFocus={!expense}
          onChange={(e) => setAmount(e.target.value)} />
      </div>

      <div className="field">
        <label>Categoría</label>
        <div className="chips">
          {categories.map((c) => (
            <button key={c.id} type="button"
              className={`chip ${c.id === categoryId ? 'active' : ''}`}
              aria-pressed={c.id === categoryId}
              onClick={() => setCategoryId(c.id)}>{c.name}</button>
          ))}
        </div>
      </div>

      <div className="field">
        <label htmlFor="exp-date">Fecha</label>
        <input id="exp-date" className="input" type="date" value={spentAt} onChange={(e) => setSpentAt(e.target.value)} />
      </div>

      <div className="field">
        <label htmlFor="exp-note">Nota (opcional)</label>
        <input id="exp-note" className="input" type="text" placeholder="Ej. Súper de la semana"
          value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      {expense && <button type="button" className="btn danger" onClick={remove}>Eliminar gasto</button>}
    </BottomSheet>
  )
}

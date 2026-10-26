import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { money, formatDate } from '../lib/format'
import BottomSheet from './BottomSheet'
import ExpenseModal from './ExpenseModal'
import ContributionModal from './ContributionModal'

// Tocar un gasto o una aportación abre primero su detalle (solo lectura, con el
// concepto completo) y desde ahí Editar o Eliminar. `selected` es
// { kind: 'expense' | 'contribution', id } o null; también acepta
// { kind, id: 'new' } para abrir directo el alta.
export default function MovementSheets({ selected, onClose, presetCategoryId, presetMemberId }) {
  const [editing, setEditing] = useState(false)
  const close = () => { setEditing(false); onClose() }
  if (!selected) return null

  const isExpense = selected.kind === 'expense'
  const Modal = isExpense ? ExpenseModal : ContributionModal

  if (selected.id === 'new') {
    return <Modal presetCategoryId={presetCategoryId} presetMemberId={presetMemberId} onClose={close} />
  }
  return editing
    ? <EditLatest selected={selected} Modal={Modal} onClose={close} />
    : <MovementDetail selected={selected} onEdit={() => setEditing(true)} onClose={close} />
}

// Siempre muestra la versión vigente de la fila (si otro teléfono la cambia o
// la borra, el detalle se actualiza o se cierra solo).
function useLatest({ kind, id }) {
  const { expenses, contributions } = useApp()
  return (kind === 'expense' ? expenses : contributions).find((r) => r.id === id)
}

function EditLatest({ selected, Modal, onClose }) {
  const item = useLatest(selected)
  if (!item) return null
  return selected.kind === 'expense'
    ? <Modal expense={item} onClose={onClose} />
    : <Modal contribution={item} onClose={onClose} />
}

function MovementDetail({ selected, onEdit, onClose }) {
  const { categories, members, deleteExpense, deleteContribution } = useApp()
  const item = useLatest(selected)
  if (!item) return null

  const isExpense = selected.kind === 'expense'
  const name = (list, id) => list.find((x) => x.id === id)?.name
  const group = isExpense ? name(categories, item.category_id) : name(members, item.member_id)
  const facts = [
    [isExpense ? 'Sobre' : 'Aportante', group || '—'],
    ['Fecha', formatDate(isExpense ? item.spent_at : item.paid_at)],
    ['Registró', name(members, item.created_by) || '—'],
  ]

  const remove = async () => {
    if (!confirm(isExpense ? '¿Eliminar este gasto?' : '¿Eliminar esta aportación?')) return
    await (isExpense ? deleteExpense : deleteContribution)(item.id)
    onClose()
  }

  return (
    <BottomSheet
      title={isExpense ? 'Gasto' : 'Aportación'}
      onClose={onClose}
      footer={
        <div className="sheet-actions">
          <button type="button" className="btn danger" onClick={remove}>Eliminar</button>
          <button type="button" className="btn" onClick={onEdit}>Editar</button>
        </div>
      }
    >
      <div className={`sheet-amount ${isExpense ? '' : 'credit'}`}>{money(item.amount)}</div>
      <p className={`detail-note ${item.note ? '' : 'muted'}`}>{item.note || 'Sin concepto'}</p>
      <dl className="detail-facts">
        {facts.map(([k, v]) => (
          <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>
    </BottomSheet>
  )
}

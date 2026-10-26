import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { money, formatDate } from '../lib/format'
import { categoryExpenses } from '../lib/finance'
import BottomSheet from './BottomSheet'
import Meter from './Meter'
import ExpenseModal from './ExpenseModal'
import { MovementList, MovementRow } from './MovementRow'
import { remainClass } from './status'

// Hoja de un sobre: su saldo y TODOS sus gastos del mes (la suma de la lista
// es el Gastado del sobre: ambos salen de lib/finance.js).
export default function CategorySheet({ categoryId, onClose }) {
  const { categoryBalances, expenses, members, deleteExpense } = useApp()
  const [editing, setEditing] = useState(null) // gasto | 'new' | null
  const cat = categoryBalances.find((c) => c.id === categoryId)
  if (!cat) return null

  const list = categoryExpenses(expenses, categoryId)
  const who = (id) => members.find((m) => m.id === id)?.name

  return (
    <>
      <BottomSheet
        title={cat.name}
        onClose={onClose}
        footer={<button className="btn secondary" onClick={() => setEditing('new')}>Agregar gasto a {cat.name}</button>}
      >
        <div className="sheet-summary">
          <div className={`sheet-amount ${remainClass(cat)}`}>{money(cat.remaining)}</div>
          <div className="muted">{cat.remaining < 0 ? 'excedido' : 'restante'} · gastado {money(cat.spent)} de {money(cat.assigned)}</div>
          <Meter value={cat.spent} max={cat.assigned} />
        </div>

        <div className="section-title">{list.length} {list.length === 1 ? 'gasto' : 'gastos'}</div>
        <MovementList empty="Sin gastos en este sobre este mes.">
          {list.map((e) => (
            <MovementRow key={e.id}
              title={e.note || cat.name}
              subtitle={[formatDate(e.spent_at), who(e.created_by)].filter(Boolean).join(' · ')}
              amount={money(e.amount)}
              onOpen={() => setEditing(e)}
              onDelete={() => deleteExpense(e.id)}
              deleteConfirm="¿Eliminar este gasto?" />
          ))}
        </MovementList>
      </BottomSheet>

      {editing && (
        <ExpenseModal
          expense={editing === 'new' ? undefined : editing}
          presetCategoryId={categoryId}
          onClose={() => setEditing(null)} />
      )}
    </>
  )
}

import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { money } from '../lib/format'

function NumberRow({ label, value, onSave }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(String(value ?? 0))

  const save = async () => { await onSave(Number(val)); setEditing(false) }

  return (
    <div className="tx">
      <span className="tx-note">{label}</span>
      {editing ? (
        <div className="inline-edit">
          <input className="input" type="number" inputMode="decimal" value={val}
            onChange={(e) => setVal(e.target.value)} style={{ width: 110 }} autoFocus />
          <button className="pill on" onClick={save}>Guardar</button>
        </div>
      ) : (
        <button className="inline-edit" style={{ background: 'none', border: 'none', color: 'var(--text)' }}
          onClick={() => { setVal(String(value ?? 0)); setEditing(true) }}>
          <span className="tx-amt">{money(value)}</span>
          <span className="muted">✎</span>
        </button>
      )}
    </div>
  )
}

export default function SettingsView() {
  const {
    monthRecord, totalBudget, assignedSum, setTotalBudget,
    categoryBalances, setCategoryBudget,
    members, incomeTargets, setMemberTarget,
    activeMemberId, setActiveMemberId, signOut,
  } = useApp()

  const targetOf = (mid) => incomeTargets.find((t) => t.member_id === mid)?.target_amount ?? 0

  return (
    <div className="content">
      <div className="section-title">Quién registra</div>
      <div className="chips">
        {members.filter((m) => m.is_active).map((m) => (
          <button key={m.id} className={`chip ${m.id === activeMemberId ? 'active' : ''}`}
            onClick={() => setActiveMemberId(m.id)}>{m.name}</button>
        ))}
      </div>

      {monthRecord && (
        <>
          <div className="section-title">Presupuesto del mes</div>
          <div className="card">
            <NumberRow label="Presupuesto total" value={totalBudget} onSave={setTotalBudget} />
            <div className="tx">
              <span className="muted">Suma asignada a categorías</span>
              <span className={`tx-amt ${assignedSum > totalBudget ? 'row-remain neg' : ''}`}>{money(assignedSum)}</span>
            </div>
          </div>

          <div className="section-title">Monto por categoría</div>
          <div className="card">
            {categoryBalances.map((c) => (
              <NumberRow key={c.id} label={c.name} value={c.assigned}
                onSave={(v) => setCategoryBudget(c.id, v)} />
            ))}
          </div>

          <div className="section-title">Meta de aportación por persona</div>
          <div className="card">
            {members.filter((m) => m.is_active).map((m) => (
              <NumberRow key={m.id} label={m.name} value={targetOf(m.id)}
                onSave={(v) => setMemberTarget(m.id, v)} />
            ))}
          </div>
        </>
      )}

      <button className="btn danger" onClick={signOut}>Cerrar sesión</button>
    </div>
  )
}

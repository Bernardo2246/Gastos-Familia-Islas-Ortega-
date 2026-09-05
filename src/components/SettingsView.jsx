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

function MemberManager() {
  const { members, addMember, updateMemberName, setMemberActive, incomeTargets, setMemberTarget } = useApp()
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')
  const [newName, setNewName] = useState('')
  const [newTarget, setNewTarget] = useState('')
  const [busy, setBusy] = useState(false)

  const targetOf = (mid) => incomeTargets.find((t) => t.member_id === mid)?.target_amount ?? 0

  const saveName = async (id) => {
    if (editName.trim()) await updateMemberName(id, editName)
    setEditId(null)
  }
  const add = async () => {
    if (!newName.trim()) return
    setBusy(true)
    await addMember(newName, newTarget)
    setNewName(''); setNewTarget(''); setBusy(false)
  }

  return (
    <>
      <div className="section-title">Aportantes</div>
      <div className="card">
        {members.map((m) => (
          <div className="tx" key={m.id}>
            {editId === m.id ? (
              <div className="inline-edit" style={{ flex: 1 }}>
                <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
                <button className="pill on" onClick={() => saveName(m.id)}>OK</button>
              </div>
            ) : (
              <>
                <div className="tx-main">
                  <span className="tx-note">{m.name} {!m.is_active && <span className="muted">(inactivo)</span>}</span>
                  <span className="tx-meta">Meta: {money(targetOf(m.id))}{m.auth_user_id ? '' : ' · sin login'}</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="pill" onClick={() => { setEditId(m.id); setEditName(m.name) }}>✎</button>
                  <button className="pill" onClick={() => setMemberActive(m.id, !m.is_active)}>
                    {m.is_active ? 'Ocultar' : 'Activar'}
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
      <div className="card">
        <div className="chart-title">Agregar aportante</div>
        <div className="field">
          <label>Nombre</label>
          <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ej. Mamá" />
        </div>
        <div className="field">
          <label>Meta mensual (opcional)</label>
          <input className="input" type="number" inputMode="decimal" value={newTarget}
            onChange={(e) => setNewTarget(e.target.value)} placeholder="$0" />
        </div>
        <button className="btn" disabled={!newName.trim() || busy} onClick={add}>
          {busy ? 'Agregando…' : 'Agregar aportante'}
        </button>
      </div>
    </>
  )
}

function CategoryManager() {
  const { categories, updateCategoryName, setCategoryActive } = useApp()
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')

  const saveName = async (id) => {
    if (editName.trim()) await updateCategoryName(id, editName)
    setEditId(null)
  }

  return (
    <>
      <div className="section-title">Categorías</div>
      <div className="card">
        {categories.map((c) => (
          <div className="tx" key={c.id}>
            {editId === c.id ? (
              <div className="inline-edit" style={{ flex: 1 }}>
                <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
                <button className="pill on" onClick={() => saveName(c.id)}>OK</button>
              </div>
            ) : (
              <>
                <span className="tx-note">{c.name} {!c.is_active && <span className="muted">(oculta)</span>}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="pill" onClick={() => { setEditId(c.id); setEditName(c.name) }}>✎</button>
                  <button className="pill" onClick={() => setCategoryActive(c.id, !c.is_active)}>
                    {c.is_active ? 'Ocultar' : 'Activar'}
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </>
  )
}

export default function SettingsView() {
  const {
    monthRecord, totalBudget, assignedSum,
    categoryBalances, setCategoryBudget,
    members, incomeTargets, setMemberTarget,
    activeMemberId, setActiveMemberId, signOut,
  } = useApp()

  const targetOf = (mid) => incomeTargets.find((t) => t.member_id === mid)?.target_amount ?? 0

  return (
    <div className="content">
      <div className="section-title">Quién registra</div>
      <div className="chips">
        {members.filter((m) => m.is_active && m.is_person !== false).map((m) => (
          <button key={m.id} className={`chip ${m.id === activeMemberId ? 'active' : ''}`}
            onClick={() => setActiveMemberId(m.id)}>{m.name}</button>
        ))}
      </div>

      <MemberManager />

      {monthRecord && (
        <>
          <div className="section-title">Presupuesto del mes</div>
          <div className="card">
            <div className="tx">
              <span className="tx-note">Presupuesto total</span>
              <span className="tx-amt">{money(totalBudget)}</span>
            </div>
            <div className="tx">
              <span className="muted">Suma asignada a categorías</span>
              <span className="tx-amt">{money(assignedSum)}</span>
            </div>
            <div className="muted" style={{ fontSize: 12, padding: '4px 0 0' }}>
              El presupuesto total se calcula solo, sumando lo asignado a cada categoría abajo.
            </div>
          </div>

          <CategoryManager />

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

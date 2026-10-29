// Vista previa SOLO de desarrollo (/__preview): la app completa con datos
// falsos y extremos para revisar el diseño a 390 px sin el login compartido.
// main.jsx la importa detrás de import.meta.env.DEV, así que no llega al build.
// Historial y Análisis consultan Supabase directo: aquí se ven vacíos.
// /__preview?offline simula estar sin red; /__preview?graficas muestra las
// gráficas de Análisis con datos falsos (incluye acumulado negativo).
// /__preview?cuadre=faltante|sobrante|cuadrado ajusta la meta de Gisela para que
// la meta de aportaciones quede $30 abajo, $1,500 arriba o igual a lo asignado.
import { useCallback, useMemo, useState } from 'react'
import { AppContext } from '../context/AppContext'
import { monthView } from '../lib/finance'
import App from '../App'
import { GroupedBarChart, LineChart, ChartLegend } from '../components/Charts'

const NOMBRES = [
  'Comida', 'Renta', 'Luz', 'Agua', 'Gas', 'Internet y teléfono de toda la casa',
  'Transporte', 'Escuela', 'Salud', 'Mantenimiento', 'Imprevistos',
]
const NOTA_LARGA = 'Compra del súper de la quincena con despensa para la abuela, artículos de limpieza, '
  + 'croquetas del perro y un garrafón extra porque se acabó el agua antes de tiempo'

const pad = (n) => String(n).padStart(2, '0')

function fakeMonth(year, month) {
  const monthId = `m-${year}-${month}`
  const categories = NOMBRES.map((name, i) => ({ id: `c${i}`, name, sort_order: i, is_active: true }))
  const assigned = [9000, 1250000, 800, 350, 600, 999.99, 1500, 0, 2000, 500, 300]
  const monthBudgets = categories.map((c, i) => ({
    id: `b${i}`, month_id: monthId, category_id: c.id, assigned_amount: assigned[i],
  }))
  // Gasto por sobre: unos en verde, otros en ámbar, otros excedidos (negativos).
  const factor = [0.5, 0.3, 0.85, 1, 1.4, 0.95, 0.2, 0, 2.5, 0.79, 4]
  const expenses = []
  categories.forEach((c, i) => {
    const total = Math.round(assigned[i] * factor[i] * 100) / 100 || (i === 7 ? 1234.56 : 0)
    const n = i === 0 ? 14 : 3
    for (let k = 0; k < n && total > 0; k++) {
      expenses.push({
        id: `e${i}-${k}`, month_id: monthId, category_id: c.id,
        amount: Math.round((total / n) * 100) / 100,
        spent_at: `${year}-${pad(month)}-${pad(1 + ((k * 3 + i) % 28))}`,
        note: k === 0 ? NOTA_LARGA : k === 1 ? null : `Pago ${k}`,
        created_by: 'p1', created_at: new Date().toISOString(),
      })
    }
  })
  expenses.sort((a, b) => (a.spent_at < b.spent_at ? 1 : -1))
  const members = [
    { id: 'p1', name: 'Angel', is_active: true, is_person: true },
    { id: 'p2', name: 'Gisela Guadalupe de la Concepción', is_active: true, is_person: true },
    { id: 'p3', name: 'Rol', is_active: true, is_person: true },
    { id: 'p4', name: 'Renta', is_active: true, is_person: false },
    { id: 'p5', name: 'Tony', is_active: true, is_person: false },
    { id: 'p6', name: 'Futuro 1', is_active: false, is_person: true },
  ]
  const metas = { p1: 8000, p2: 1500000, p3: 5000, p4: 6000, p5: 0 }
  const escenario = new URLSearchParams(location.search).get('cuadre')
  const delta = { faltante: -30, sobrante: 1500, cuadrado: 0 }[escenario]
  if (delta != null) {
    const totalAsignado = assigned.reduce((a, b) => a + b, 0)
    metas.p2 = 0
    const resto = Object.values(metas).reduce((a, b) => a + b, 0)
    metas.p2 = Math.round((totalAsignado + delta - resto) * 100) / 100
  }
  const incomeTargets = Object.entries(metas).map(([member_id, target_amount], i) => ({
    id: `t${i}`, month_id: monthId, member_id, target_amount,
  }))
  const contributions = [
    ['p1', 8000], ['p2', 2500.5], ['p2', 100000], ['p3', 0.01], ['p4', 6000], ['p5', 1200],
  ].map(([member_id, amount], i) => ({
    id: `a${i}`, month_id: monthId, member_id, amount,
    paid_at: `${year}-${pad(month)}-${pad(2 + i * 4)}`,
    note: i === 1 ? NOTA_LARGA : null, created_by: 'p1', created_at: new Date().toISOString(),
  }))
  return {
    monthRecord: { id: monthId, year, month, total_budget: 0, is_closed: false },
    categories, members, monthBudgets, incomeTargets, expenses, contributions,
  }
}

function ChartsPreview() {
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov']
  const gasto = [20000, 19307, 22100, 24314, 22438, 22000, 20888, 25167, 26000, 26129, 1250000]
  const plan = [20000, 19307, 22100, 24314, 22438, 22000, 20888, 25167, 26000, 27946, 26000]
  let acc = 0
  const S = [{ name: 'Gastado', color: 'var(--series-1)' }, { name: 'Presupuestado', color: 'var(--series-2)' }]
  return (
    <div className="app"><div className="content">
      <div className="card chart-card">
        <div className="chart-title">Gastado vs presupuestado por mes</div>
        <ChartLegend items={S} />
        <GroupedBarChart data={meses.map((label, i) => ({ label, values: [gasto[i], plan[i]] }))} series={S} />
      </div>
      <div className="card chart-card">
        <div className="chart-title">Ahorro / déficit acumulado</div>
        <LineChart name="Acumulado" allowNegative color="var(--series-1)"
          data={meses.map((label, i) => ({ label, value: (acc += [500, -800, 300, -2500, 0, 1200, -300, 900, -4000, 1787, 2500][i]) }))} />
      </div>
    </div></div>
  )
}

export default function Preview() {
  return location.search.includes('graficas') ? <ChartsPreview /> : <PreviewApp />
}

function PreviewApp() {
  const now = new Date()
  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 })
  const [data, setData] = useState(() => fakeMonth(ym.year, ym.month))
  const [activeMemberId, setActiveMemberId] = useState('p1')

  const goToMonth = useCallback((year, month) => { setYm({ year, month }); setData(fakeMonth(year, month)) }, [])
  const shiftMonth = useCallback((delta) => {
    setYm(({ year, month }) => {
      const idx = year * 12 + (month - 1) + delta
      const next = { year: Math.floor(idx / 12), month: (idx % 12) + 1 }
      setData(fakeMonth(next.year, next.month))
      return next
    })
  }, [])

  const set = (key) => (fn) => setData((d) => ({ ...d, [key]: fn(d[key]) }))
  const noop = async () => {}

  const value = useMemo(() => ({
    session: { user: { id: 'preview' } }, authReady: true, isSupabaseConfigured: true,
    household: { id: 'h-preview', name: 'Vista previa' },
    ...data, ym, loading: false, monthMissing: false, error: null, online: !location.search.includes('offline'), pending: 2,
    activeMemberId, setActiveMemberId,
    ...monthView(data),
    signIn: noop, signOut: noop, createMonth: noop, reloadMonth: noop,
    addExpense: async (e) => set('expenses')((x) => [{ ...e, id: crypto.randomUUID(), month_id: data.monthRecord.id, amount: Number(e.amount) }, ...x]),
    addContribution: async (c) => set('contributions')((x) => [{ ...c, id: crypto.randomUUID(), month_id: data.monthRecord.id, amount: Number(c.amount) }, ...x]),
    updateExpense: async (id, patch) => set('expenses')((x) => x.map((r) => (r.id === id ? { ...r, ...patch } : r))),
    updateContribution: async (id, patch) => set('contributions')((x) => x.map((r) => (r.id === id ? { ...r, ...patch } : r))),
    deleteExpense: async (id) => set('expenses')((x) => x.filter((r) => r.id !== id)),
    deleteContribution: async (id) => set('contributions')((x) => x.filter((r) => r.id !== id)),
    setCategoryBudget: async (category_id, v) => set('monthBudgets')((x) => x.map((b) => (b.category_id === category_id ? { ...b, assigned_amount: v } : b))),
    setMemberTarget: async (member_id, v) => set('incomeTargets')((x) => x.map((t) => (t.member_id === member_id ? { ...t, target_amount: v } : t))),
    addMember: noop, updateMemberName: noop, setMemberActive: noop,
    updateCategoryName: noop, setCategoryActive: noop,
    goToMonth, shiftMonth,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [data, ym, activeMemberId, goToMonth, shiftMonth])

  return (
    <AppContext.Provider value={value}>
      <App />
    </AppContext.Provider>
  )
}

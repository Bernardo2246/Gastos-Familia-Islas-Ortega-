// Única fuente de las fórmulas de dinero de la app. Inicio, Categorías,
// Aportaciones, Historial, Análisis y la sincronización con Obsidian leen de
// aquí: si dos pantallas muestran "el mismo total", salen de la misma función.
// Funciones puras, sin React ni Supabase (scripts/sync-obsidian.mjs las importa
// directo con node).

// Suma en centavos enteros para no arrastrar errores de punto flotante
// (Postgres manda numeric como texto: '1500.50').
export function sumMoney(rows, pick = (x) => x) {
  let cents = 0
  for (const r of rows || []) cents += Math.round(Number(pick(r) || 0) * 100)
  return cents / 100
}

// Semáforo de un sobre: verde < 80 %, ámbar 80–100 %, rojo > 100 %.
export function semaforo(spent, assigned) {
  if (!(assigned > 0)) return spent > 0 ? 'over' : 'ok'
  const r = spent / assigned
  return r > 1 ? 'over' : r >= 0.8 ? 'warn' : 'ok'
}

// Totales del mes. Restante = Recaudado − Gastado: se mide contra el dinero que
// ya entró, no contra el presupuesto planeado.
export function monthTotals({ expenses = [], contributions = [], budgets = [], targets = [] } = {}) {
  const spent = sumMoney(expenses, (e) => e.amount)
  const collected = sumMoney(contributions, (c) => c.amount)
  const budget = sumMoney(budgets, (b) => b.assigned_amount)
  const goal = sumMoney(targets, (t) => t.target_amount)
  return {
    spent, collected, budget, goal,
    remaining: round2(collected - spent),
    incomePending: round2(goal - collected),
  }
}

// Saldo por sobre. Una categoría oculta deja de aparecer, salvo que ese mes ya
// tenga presupuesto o gasto (para no perder el dato si se ocultó a medio mes).
export function categoryBalances({ categories = [], expenses = [], budgets = [] } = {}) {
  const spentBy = groupSum(expenses, (e) => e.category_id, (e) => e.amount)
  const budgetBy = {}
  for (const b of budgets) budgetBy[b.category_id] = Number(b.assigned_amount) || 0
  return categories
    .filter((c) => c.is_active || budgetBy[c.id] || spentBy[c.id])
    .map((c) => {
      const assigned = budgetBy[c.id] || 0
      const spent = spentBy[c.id] || 0
      return {
        ...c, assigned, spent,
        remaining: round2(assigned - spent),
        pct: assigned > 0 ? spent / assigned : null,
        status: semaforo(spent, assigned),
      }
    })
}

// Avance de aportaciones por persona (o fuente, como Renta) contra su meta.
// Un inactivo solo aparece si ese mes tiene meta o aportó algo.
export function memberProgress({ members = [], contributions = [], targets = [] } = {}) {
  const contribBy = groupSum(contributions, (c) => c.member_id, (c) => c.amount)
  const targetBy = {}
  for (const t of targets) targetBy[t.member_id] = Number(t.target_amount) || 0
  return members
    .filter((m) => m.is_active || targetBy[m.id] != null || contribBy[m.id])
    .map((m) => {
      const target = targetBy[m.id] || 0
      const contributed = contribBy[m.id] || 0
      return {
        ...m, target, contributed,
        pending: round2(target - contributed),
        isComplete: target > 0 && contributed >= target,
      }
    })
}

// Gastos de un sobre, del más reciente al más viejo. Es la lista de la hoja del
// sobre: su suma es exactamente el Gastado de categoryBalances.
export function categoryExpenses(expenses, categoryId) {
  return (expenses || [])
    .filter((e) => e.category_id === categoryId)
    .sort((a, b) => cmpDesc(a.spent_at, b.spent_at) || cmpDesc(a.created_at, b.created_at))
}

const cmpDesc = (a, b) => (a === b ? 0 : (a || '') < (b || '') ? 1 : -1)

// Filas visibles: lo que tiene un borrado esperando en la cola offline no se
// muestra ni cuenta en los totales.
export function withoutPendingDeletes(rows, pendingIds) {
  return (rows || []).filter((r) => !pendingIds?.has(r.id))
}

// Un renglón por mes (orden cronológico) con las mismas fórmulas que el mes
// abierto. Lo usan Historial, Análisis y Evolución en Obsidian.
export function monthSummaries({ months = [], expenses = [], contributions = [], budgets = [], targets = [] } = {}) {
  const by = (rows) => {
    const out = {}
    for (const r of rows) (out[r.month_id] ||= []).push(r)
    return out
  }
  const ex = by(expenses), co = by(contributions), bu = by(budgets), ta = by(targets)
  return [...months]
    .sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month))
    .map((m) => {
      const t = monthTotals({ expenses: ex[m.id], contributions: co[m.id], budgets: bu[m.id], targets: ta[m.id] })
      const spentByCat = groupSum(ex[m.id] || [], (e) => e.category_id, (e) => e.amount)
      const budgetByCat = groupSum(bu[m.id] || [], (b) => b.category_id, (b) => b.assigned_amount)
      const cats = new Set([...Object.keys(spentByCat), ...Object.keys(budgetByCat)])
      let overCount = 0
      for (const c of cats) if (semaforo(spentByCat[c] || 0, budgetByCat[c] || 0) === 'over') overCount++
      return { id: m.id, year: m.year, month: m.month, ...t, overCount }
    })
}

// Todo lo derivado del mes abierto, con los nombres que leen las pantallas
// (AppContext y la vista previa de desarrollo lo exponen tal cual).
export function monthView({ categories = [], members = [], expenses = [], contributions = [], monthBudgets = [], incomeTargets = [] } = {}) {
  const t = monthTotals({ expenses, contributions, budgets: monthBudgets, targets: incomeTargets })
  return {
    categoryBalances: categoryBalances({ categories, expenses, budgets: monthBudgets }),
    memberRows: memberProgress({ members, contributions, targets: incomeTargets }),
    totalSpent: t.spent,
    // El presupuesto del mes es siempre la suma de lo asignado por categoría.
    totalBudget: t.budget, assignedSum: t.budget,
    totalCollected: t.collected,
    totalRemaining: t.remaining,
    incomeGoal: t.goal, incomePending: t.incomePending,
  }
}

function groupSum(rows, key, val) {
  const cents = {}
  for (const r of rows || []) cents[key(r)] = (cents[key(r)] || 0) + Math.round(Number(val(r) || 0) * 100)
  const out = {}
  for (const k in cents) out[k] = cents[k] / 100
  return out
}

function round2(n) {
  return Math.round(n * 100) / 100
}

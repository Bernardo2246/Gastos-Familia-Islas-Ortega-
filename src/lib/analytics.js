import { monthName } from './format'

// Día del mes (1-31) a partir de una fecha ISO 'YYYY-MM-DD',
// sin usar Date() para evitar corrimientos por zona horaria.
const dayOf = (iso) => (iso ? Number(iso.slice(8, 10)) : 0)
const chrono = (a, b) => a.year * 12 + a.month - (b.year * 12 + b.month)
const sum = (arr, f = (x) => x) => arr.reduce((s, x) => s + Number(f(x) || 0), 0)

// Paleta estable para categorías (se reparte por orden).
export const PALETTE = [
  '#15c08a', '#4f9dff', '#f5b945', '#ff7b9c', '#a78bfa',
  '#38d6c4', '#ff9f43', '#6ee7b7', '#f472b6', '#60a5fa', '#fbbf24',
]

/**
 * Agrega los datos de varios meses en las estructuras que consume el Dashboard.
 * Todas las entradas ya vienen filtradas al rango seleccionado.
 * Es tolerante a meses vacíos / categorías sin gasto (nunca produce NaN).
 */
export function computeDashboard({
  months = [], expenses = [], contributions = [],
  budgets = [], targets = [], categories = [], members = [],
}) {
  const sorted = [...months].sort(chrono)

  // ---- Agregados por mes ----
  const expByMonth = {}
  const contByMonth = {}
  const targetSumByMonth = {}
  for (const e of expenses) expByMonth[e.month_id] = (expByMonth[e.month_id] || 0) + Number(e.amount)
  for (const c of contributions) contByMonth[c.month_id] = (contByMonth[c.month_id] || 0) + Number(c.amount)
  for (const t of targets) targetSumByMonth[t.month_id] = (targetSumByMonth[t.month_id] || 0) + Number(t.target_amount)

  const perMonth = sorted.map((m) => {
    const spent = expByMonth[m.id] || 0
    const collected = contByMonth[m.id] || 0
    const budget = Number(m.total_budget) || 0
    const goal = targetSumByMonth[m.id] || 0
    return {
      id: m.id, year: m.year, month: m.month,
      label: monthName(m.month).slice(0, 3),
      spent, collected, budget, goal,
      net: collected - spent,
      withinBudget: budget > 0 && spent <= budget,
    }
  })

  // Ahorro/déficit acumulado mes a mes
  let run = 0
  const cumulative = perMonth.map((p) => { run += p.net; return { label: p.label, value: run } })

  // ---- KPIs ----
  const totalSpent = sum(perMonth, (p) => p.spent)
  const totalCollected = sum(perMonth, (p) => p.collected)
  const totalGoal = sum(perMonth, (p) => p.goal)
  const totalBudget = sum(perMonth, (p) => p.budget)
  const budgetMonths = perMonth.filter((p) => p.budget > 0)
  const withinCount = budgetMonths.filter((p) => p.withinBudget).length
  const nMonths = perMonth.length || 1

  const kpis = {
    netCumulative: totalCollected - totalSpent,
    totalSpent,
    avgMonthlySpend: totalSpent / nMonths,
    totalCollected,
    totalGoal,
    totalBudget,
    budgetComplianceRate: budgetMonths.length ? withinCount / budgetMonths.length : 0,
    withinCount,
    budgetMonthsCount: budgetMonths.length,
    collectionRate: totalGoal ? totalCollected / totalGoal : 0,
    monthsCount: perMonth.length,
  }

  // ---- Análisis por categoría ----
  const catSpentByMonth = {} // catId -> { monthId: spent }
  const catBudgetByMonth = {}
  for (const e of expenses) {
    ;(catSpentByMonth[e.category_id] ||= {})
    catSpentByMonth[e.category_id][e.month_id] = (catSpentByMonth[e.category_id][e.month_id] || 0) + Number(e.amount)
  }
  for (const b of budgets) {
    ;(catBudgetByMonth[b.category_id] ||= {})
    catBudgetByMonth[b.category_id][b.month_id] = Number(b.assigned_amount)
  }

  const perCategory = categories.map((c, i) => {
    const monthVals = sorted.map((m) => catSpentByMonth[c.id]?.[m.id] || 0)
    const spentTotal = sum(monthVals)
    const assignedTotal = sum(sorted, (m) => catBudgetByMonth[c.id]?.[m.id] || 0)
    const avg = spentTotal / nMonths
    const min = monthVals.length ? Math.min(...monthVals) : 0
    const max = monthVals.length ? Math.max(...monthVals) : 0
    const variance = monthVals.length ? sum(monthVals.map((v) => (v - avg) ** 2)) / monthVals.length : 0
    let overCount = 0
    for (const m of sorted) {
      const s = catSpentByMonth[c.id]?.[m.id] || 0
      const a = catBudgetByMonth[c.id]?.[m.id] || 0
      if (a > 0 && s > a) overCount++
    }
    return {
      id: c.id, name: c.name, color: PALETTE[i % PALETTE.length],
      monthVals, spentTotal, assignedTotal, avg, min, max,
      range: max - min, std: Math.sqrt(variance), overCount,
    }
  })
  const assignedAll = sum(perCategory, (c) => c.assignedTotal)
  for (const c of perCategory) {
    c.pctOfSpend = totalSpent ? c.spentTotal / totalSpent : 0
    c.pctPlanned = assignedAll ? c.assignedTotal / assignedAll : 0
  }

  const overspendRanking = perCategory.filter((c) => c.overCount > 0).sort((a, b) => b.overCount - a.overCount || b.spentTotal - a.spentTotal)
  const distribution = perCategory.filter((c) => c.spentTotal > 0).sort((a, b) => b.spentTotal - a.spentTotal)
  const mostVariable = [...perCategory].filter((c) => c.spentTotal > 0).sort((a, b) => b.std - a.std)

  // ---- Aportaciones por persona ----
  const targetByMemberMonth = {}
  const contByMember = {}
  for (const t of targets) {
    ;(targetByMemberMonth[t.member_id] ||= {})
    targetByMemberMonth[t.member_id][t.month_id] = Number(t.target_amount)
  }
  for (const c of contributions) contByMember[c.member_id] = (contByMember[c.member_id] || 0) + Number(c.amount)

  const perMember = members
    .map((m) => {
      const totalTarget = sum(sorted, (mo) => targetByMemberMonth[m.id]?.[mo.id] || 0)
      const totalContrib = contByMember[m.id] || 0

      // Días promedio para completar la meta mensual (día del mes en que se alcanza)
      const completionDays = []
      for (const mo of sorted) {
        const tgt = targetByMemberMonth[m.id]?.[mo.id] || 0
        if (tgt <= 0) continue
        const cs = contributions
          .filter((c) => c.member_id === m.id && c.month_id === mo.id)
          .sort((a, b) => (a.paid_at < b.paid_at ? -1 : 1))
        let acc = 0
        for (const c of cs) {
          acc += Number(c.amount)
          if (acc >= tgt) { completionDays.push(dayOf(c.paid_at)); break }
        }
      }
      const avgDayToComplete = completionDays.length ? sum(completionDays) / completionDays.length : null

      return {
        id: m.id, name: m.name, is_active: m.is_active,
        totalTarget, totalContrib,
        complianceRate: totalTarget ? totalContrib / totalTarget : 0,
        avgDayToComplete, monthsCompleted: completionDays.length,
      }
    })
    .filter((m) => m.totalTarget > 0 || m.totalContrib > 0)
    .sort((a, b) => b.complianceRate - a.complianceRate)

  // ---- Patrón de gasto por día del mes ----
  const thirds = { inicio: 0, medio: 0, fin: 0 }
  const perDay = Array.from({ length: 31 }, () => 0)
  for (const e of expenses) {
    const d = dayOf(e.spent_at)
    if (d < 1 || d > 31) continue
    perDay[d - 1] += Number(e.amount)
    if (d <= 10) thirds.inicio += Number(e.amount)
    else if (d <= 20) thirds.medio += Number(e.amount)
    else thirds.fin += Number(e.amount)
  }

  // ---- Mes de mayor / menor gasto ----
  let maxMonth = null
  let minMonth = null
  for (const p of perMonth) {
    if (!maxMonth || p.spent > maxMonth.spent) maxMonth = p
    if (!minMonth || p.spent < minMonth.spent) minMonth = p
  }

  return {
    perMonth, cumulative, kpis,
    perCategory, overspendRanking, distribution, mostVariable,
    perMember, thirds, perDay, maxMonth, minMonth,
    hasData: perMonth.length > 0,
  }
}

/**
 * Saldo acumulado por categoría, mes a mes, tipo "sobre" (envelope budgeting):
 * balance[mes] = asignado[mes] − gastado[mes] + balance[mes anterior].
 * A diferencia de computeDashboard, esto SIEMPRE debe recibir el historial
 * completo del hogar (no el rango filtrado del selector), porque el arrastre
 * solo es correcto si la cadena de meses empieza desde el primer mes real.
 */
export function computeCategoryCarryover({ months = [], expenses = [], budgets = [], categories = [] }) {
  const sorted = [...months].sort(chrono)

  const spentByCatMonth = {}
  for (const e of expenses) {
    (spentByCatMonth[e.category_id] ||= {})
    spentByCatMonth[e.category_id][e.month_id] = (spentByCatMonth[e.category_id][e.month_id] || 0) + Number(e.amount)
  }
  const budgetByCatMonth = {}
  for (const b of budgets) {
    (budgetByCatMonth[b.category_id] ||= {})
    budgetByCatMonth[b.category_id][b.month_id] = Number(b.assigned_amount)
  }

  const perCategory = categories
    .map((c, i) => {
      let running = 0
      const history = sorted.map((m) => {
        const assigned = budgetByCatMonth[c.id]?.[m.id] || 0
        const spent = spentByCatMonth[c.id]?.[m.id] || 0
        running += assigned - spent
        return {
          year: m.year, month: m.month, label: monthName(m.month).slice(0, 3),
          assigned, spent, diff: assigned - spent, balance: running,
        }
      })
      const assignedTotal = sum(history, (h) => h.assigned)
      const spentTotal = sum(history, (h) => h.spent)
      return {
        id: c.id, name: c.name, color: PALETTE[i % PALETTE.length],
        history, balance: running, assignedTotal, spentTotal,
      }
    })
    .filter((c) => c.assignedTotal > 0 || c.spentTotal > 0)
    .sort((a, b) => b.balance - a.balance)

  return {
    perCategory,
    totalBalance: sum(perCategory, (c) => c.balance),
    totalAssigned: sum(perCategory, (c) => c.assignedTotal),
    totalSpent: sum(perCategory, (c) => c.spentTotal),
    monthsCount: sorted.length,
    firstMonth: sorted[0] || null,
    lastMonth: sorted.at(-1) || null,
  }
}

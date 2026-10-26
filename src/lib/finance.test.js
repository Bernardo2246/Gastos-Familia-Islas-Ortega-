import { describe, it, expect } from 'vitest'
import {
  sumMoney, monthTotals, categoryBalances, memberProgress,
  withoutPendingDeletes, semaforo, monthSummaries, monthView, categoryExpenses,
} from './finance'

const cat = (id, extra = {}) => ({ id, name: id, is_active: true, sort_order: 0, ...extra })
const mem = (id, extra = {}) => ({ id, name: id, is_active: true, is_person: true, ...extra })

describe('sumMoney', () => {
  it('suma en centavos (0.1 + 0.2 = 0.3 exacto)', () => {
    expect(sumMoney([{ amount: 0.1 }, { amount: 0.2 }], (x) => x.amount)).toBe(0.3)
  })
  it('acepta numeric de Postgres como texto', () => {
    expect(sumMoney([{ amount: '1500.50' }, { amount: '99.50' }], (x) => x.amount)).toBe(1600)
  })
})

describe('monthTotals', () => {
  it('Restante = Recaudado − Gastado (no Presupuesto − Gastado)', () => {
    const t = monthTotals({
      expenses: [{ amount: 3000 }],
      contributions: [{ amount: 5000 }],
      budgets: [{ assigned_amount: 10000 }],
      targets: [{ target_amount: 8000 }],
    })
    expect(t).toMatchObject({ collected: 5000, spent: 3000, remaining: 2000, budget: 10000, goal: 8000, incomePending: 3000 })
  })
  it('mes sin aportaciones: restante negativo igual a lo gastado', () => {
    const t = monthTotals({ expenses: [{ amount: 1200 }], contributions: [], budgets: [], targets: [] })
    expect(t.collected).toBe(0)
    expect(t.remaining).toBe(-1200)
  })
  it('mes vacío no produce NaN', () => {
    expect(monthTotals({})).toMatchObject({ collected: 0, spent: 0, remaining: 0, budget: 0, goal: 0 })
  })
})

describe('categoryBalances', () => {
  const categories = [cat('comida'), cat('luz'), cat('oculta', { is_active: false }), cat('vieja', { is_active: false })]
  const budgets = [{ category_id: 'comida', assigned_amount: 1000 }, { category_id: 'luz', assigned_amount: 500 }]
  const expenses = [
    { category_id: 'comida', amount: 700 }, { category_id: 'comida', amount: 600 },
    { category_id: 'vieja', amount: 50 },
  ]
  const rows = categoryBalances({ categories, budgets, expenses })
  const by = Object.fromEntries(rows.map((r) => [r.id, r]))

  it('sobre en negativo cuando se gasta más de lo asignado', () => {
    expect(by.comida).toMatchObject({ assigned: 1000, spent: 1300, remaining: -300, status: 'over' })
  })
  it('sobre sin gasto queda en verde con todo su restante', () => {
    expect(by.luz).toMatchObject({ spent: 0, remaining: 500, status: 'ok' })
  })
  it('oculta sin movimiento no aparece; oculta con gasto sí', () => {
    expect(by.oculta).toBeUndefined()
    expect(by.vieja).toMatchObject({ assigned: 0, spent: 50, remaining: -50, status: 'over' })
  })
  it('la suma de los sobres cuadra con el gastado del mes', () => {
    expect(sumMoney(rows, (r) => r.spent)).toBe(monthTotals({ expenses }).spent)
  })
})

describe('semaforo', () => {
  it('verde < 80 %, ámbar 80–100 %, rojo > 100 %', () => {
    expect(semaforo(79, 100)).toBe('ok')
    expect(semaforo(80, 100)).toBe('warn')
    expect(semaforo(100, 100)).toBe('warn')
    expect(semaforo(100.01, 100)).toBe('over')
  })
  it('sin asignado: verde si no hay gasto, rojo si hay', () => {
    expect(semaforo(0, 0)).toBe('ok')
    expect(semaforo(1, 0)).toBe('over')
  })
})

describe('memberProgress', () => {
  const members = [mem('angel'), mem('renta', { is_person: false }), mem('ex', { is_active: false }), mem('ex2', { is_active: false })]
  const targets = [{ member_id: 'angel', target_amount: 3000 }, { member_id: 'renta', target_amount: 4000 }]
  const contributions = [
    { member_id: 'angel', amount: 1000 }, { member_id: 'renta', amount: 4000 }, { member_id: 'ex2', amount: 200 },
  ]
  const rows = memberProgress({ members, targets, contributions })
  const by = Object.fromEntries(rows.map((r) => [r.id, r]))

  it('avance por persona contra su meta', () => {
    expect(by.angel).toMatchObject({ target: 3000, contributed: 1000, pending: 2000, isComplete: false })
  })
  it('Renta (is_person=false) cuenta como aportante con meta y avance', () => {
    expect(by.renta).toMatchObject({ target: 4000, contributed: 4000, pending: 0, isComplete: true })
  })
  it('inactivo sin meta ni aportación no aparece; con aportación sí', () => {
    expect(by.ex).toBeUndefined()
    expect(by.ex2).toMatchObject({ target: 0, contributed: 200, isComplete: false })
  })
  it('la suma por persona = Recaudado del mes', () => {
    expect(sumMoney(rows, (r) => r.contributed)).toBe(monthTotals({ contributions }).collected)
  })
})

describe('withoutPendingDeletes', () => {
  it('quita lo que tiene borrado pendiente en la cola y no cuenta en los totales', () => {
    const expenses = [{ id: 'a', amount: 100 }, { id: 'b', amount: 50 }]
    const vivos = withoutPendingDeletes(expenses, new Set(['b']))
    expect(vivos.map((e) => e.id)).toEqual(['a'])
    expect(monthTotals({ expenses: vivos }).spent).toBe(100)
  })
  it('sin cola regresa las mismas filas', () => {
    const rows = [{ id: 'a' }]
    expect(withoutPendingDeletes(rows, new Set())).toEqual(rows)
    expect(withoutPendingDeletes(null, new Set())).toEqual([])
  })
})

describe('monthSummaries', () => {
  it('un renglón por mes en orden cronológico, con las mismas fórmulas que el mes', () => {
    const months = [{ id: 'm2', year: 2026, month: 2 }, { id: 'm1', year: 2026, month: 1 }]
    const res = monthSummaries({
      months,
      expenses: [
        { month_id: 'm1', category_id: 'comida', amount: 1500 },
        { month_id: 'm2', category_id: 'comida', amount: 200 },
      ],
      contributions: [{ month_id: 'm1', amount: 1000 }, { month_id: 'm2', amount: 900 }],
      budgets: [
        { month_id: 'm1', category_id: 'comida', assigned_amount: 1000 },
        { month_id: 'm2', category_id: 'comida', assigned_amount: 1000 },
      ],
      targets: [],
    })
    expect(res.map((r) => r.id)).toEqual(['m1', 'm2'])
    expect(res[0]).toMatchObject({ collected: 1000, spent: 1500, remaining: -500, budget: 1000, overCount: 1 })
    expect(res[1]).toMatchObject({ remaining: 700, overCount: 0 })
  })
})

describe('monthView', () => {
  it('expone con los nombres que usan las pantallas las mismas cifras que monthTotals', () => {
    const input = {
      categories: [cat('comida')], members: [mem('angel')],
      expenses: [{ category_id: 'comida', amount: 300 }],
      contributions: [{ member_id: 'angel', amount: 1000 }],
      monthBudgets: [{ category_id: 'comida', assigned_amount: 800 }],
      incomeTargets: [{ member_id: 'angel', target_amount: 1500 }],
    }
    const v = monthView(input)
    expect(v).toMatchObject({
      totalSpent: 300, totalCollected: 1000, totalRemaining: 700,
      totalBudget: 800, assignedSum: 800, incomeGoal: 1500, incomePending: 500,
    })
    expect(v.categoryBalances[0]).toMatchObject({ id: 'comida', remaining: 500, status: 'ok' })
    expect(v.memberRows[0]).toMatchObject({ id: 'angel', pending: 500 })
  })
})

describe('categoryExpenses', () => {
  const expenses = [
    { id: '1', category_id: 'comida', amount: 100.1, spent_at: '2026-10-02', created_at: '2026-10-02T10:00:00Z' },
    { id: '2', category_id: 'luz', amount: 500, spent_at: '2026-10-05', created_at: '2026-10-05T10:00:00Z' },
    { id: '3', category_id: 'comida', amount: 200.2, spent_at: '2026-10-09', created_at: '2026-10-09T10:00:00Z' },
    { id: '4', category_id: 'comida', amount: 0.7, spent_at: '2026-10-09', created_at: '2026-10-09T12:00:00Z' },
  ]
  it('todos los gastos del sobre, del más reciente al más viejo', () => {
    expect(categoryExpenses(expenses, 'comida').map((e) => e.id)).toEqual(['4', '3', '1'])
  })
  it('la suma de la lista de cada sobre = su Gastado', () => {
    const rows = categoryBalances({ categories: [cat('comida'), cat('luz')], expenses, budgets: [] })
    for (const r of rows) expect(sumMoney(categoryExpenses(expenses, r.id), (e) => e.amount)).toBe(r.spent)
  })
})

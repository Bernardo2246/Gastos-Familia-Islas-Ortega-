import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { enqueue, queueCount, saveCache, readCache } from '../lib/db'
import { flushQueue } from '../lib/sync'
import { todayISO } from '../lib/format'

const AppContext = createContext(null)
export const useApp = () => useContext(AppContext)

const upsertById = (arr, row) => {
  const i = arr.findIndex((x) => x.id === row.id)
  if (i === -1) return [row, ...arr]
  const copy = arr.slice()
  copy[i] = { ...copy[i], ...row }
  return copy
}

function nowYM() {
  const d = new Date()
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

export function AppProvider({ children }) {
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(false)

  const [household, setHousehold] = useState(null)
  const [members, setMembers] = useState([])
  const [categories, setCategories] = useState([])

  const [ym, setYm] = useState(nowYM())
  const [monthRecord, setMonthRecord] = useState(null)
  const [monthBudgets, setMonthBudgets] = useState([])
  const [incomeTargets, setIncomeTargets] = useState([])
  const [expenses, setExpenses] = useState([])
  const [contributions, setContributions] = useState([])

  const [loading, setLoading] = useState(true)
  const [monthMissing, setMonthMissing] = useState(false)
  const [error, setError] = useState(null)

  const [online, setOnline] = useState(navigator.onLine)
  const [pending, setPending] = useState(0)

  // Miembro activo (quién captura). Persistido en localStorage.
  const [activeMemberId, setActiveMemberIdState] = useState(
    () => localStorage.getItem('activeMemberId') || null
  )
  const setActiveMemberId = useCallback((id) => {
    setActiveMemberIdState(id)
    if (id) localStorage.setItem('activeMemberId', id)
    else localStorage.removeItem('activeMemberId')
  }, [])

  const refreshPending = useCallback(async () => {
    setPending(await queueCount())
  }, [])

  // ---------- Auth ----------
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthReady(true)
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setActiveMemberId(null)
  }, [setActiveMemberId])

  // ---------- Online / offline ----------
  useEffect(() => {
    const goOnline = async () => {
      setOnline(true)
      const sent = await flushQueue()
      await refreshPending()
      if (sent > 0) reloadMonth()
    }
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------- Carga base (hogar, miembros, categorías) ----------
  const loadBase = useCallback(async () => {
    const cacheKey = 'base'
    try {
      const { data: hh, error: e1 } = await supabase.from('households').select('*').limit(1).maybeSingle()
      if (e1) throw e1
      const householdId = hh?.id
      const [{ data: mem }, { data: cat }] = await Promise.all([
        supabase.from('members').select('*').eq('household_id', householdId).order('created_at'),
        supabase.from('categories').select('*').eq('household_id', householdId).order('sort_order'),
      ])
      setHousehold(hh)
      setMembers(mem || [])
      setCategories(cat || [])
      await saveCache(cacheKey, { household: hh, members: mem || [], categories: cat || [] })
      return hh
    } catch (err) {
      // Offline: usa cache
      const cached = await readCache(cacheKey)
      if (cached) {
        setHousehold(cached.household)
        setMembers(cached.members)
        setCategories(cached.categories)
        return cached.household
      }
      throw err
    }
  }, [])

  // ---------- Carga de un mes ----------
  const loadMonth = useCallback(async (householdId, year, month, { autoCreate = false } = {}) => {
    setError(null)
    setMonthMissing(false)
    const cacheKey = `month:${year}-${month}`
    try {
      let { data: m } = await supabase
        .from('months')
        .select('*')
        .eq('household_id', householdId)
        .eq('year', year)
        .eq('month', month)
        .maybeSingle()

      if (!m) {
        if (autoCreate) {
          const { data: newId, error: rpcErr } = await supabase.rpc('create_month', {
            p_household_id: householdId, p_year: year, p_month: month,
          })
          if (rpcErr) throw rpcErr
          const res = await supabase.from('months').select('*').eq('id', newId).single()
          m = res.data
        } else {
          setMonthRecord(null); setMonthBudgets([]); setIncomeTargets([])
          setExpenses([]); setContributions([]); setMonthMissing(true)
          return
        }
      }

      const [{ data: mb }, { data: it }, { data: ex }, { data: co }] = await Promise.all([
        supabase.from('month_budgets').select('*').eq('month_id', m.id),
        supabase.from('income_targets').select('*').eq('month_id', m.id),
        supabase.from('expenses').select('*').eq('month_id', m.id).order('spent_at', { ascending: false }),
        supabase.from('contributions').select('*').eq('month_id', m.id).order('paid_at', { ascending: false }),
      ])
      setMonthRecord(m)
      setMonthBudgets(mb || [])
      setIncomeTargets(it || [])
      setExpenses(ex || [])
      setContributions(co || [])
      await saveCache(cacheKey, {
        monthRecord: m, monthBudgets: mb || [], incomeTargets: it || [],
        expenses: ex || [], contributions: co || [],
      })
    } catch (err) {
      const cached = await readCache(cacheKey)
      if (cached) {
        setMonthRecord(cached.monthRecord)
        setMonthBudgets(cached.monthBudgets)
        setIncomeTargets(cached.incomeTargets)
        setExpenses(cached.expenses)
        setContributions(cached.contributions)
      } else {
        setError('No se pudo cargar el mes y no hay datos guardados sin conexión.')
      }
    }
  }, [])

  const reloadMonth = useCallback(() => {
    if (household) loadMonth(household.id, ym.year, ym.month)
  }, [household, ym, loadMonth])

  // Carga inicial tras login
  useEffect(() => {
    if (!authReady) return
    if (isSupabaseConfigured && !session) { setLoading(false); return }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const hh = await loadBase()
        if (cancelled || !hh) return
        const cur = nowYM()
        const isCurrent = ym.year === cur.year && ym.month === cur.month
        await loadMonth(hh.id, ym.year, ym.month, { autoCreate: isCurrent })
        await flushQueue()
        await refreshPending()
      } catch {
        setError('No se pudieron cargar los datos iniciales.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, session])

  // Cambio de mes (navegación)
  useEffect(() => {
    if (!household) return
    const cur = nowYM()
    const isCurrent = ym.year === cur.year && ym.month === cur.month
    loadMonth(household.id, ym.year, ym.month, { autoCreate: isCurrent })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ym])

  // ---------- Realtime ----------
  useEffect(() => {
    if (!monthRecord || !isSupabaseConfigured) return
    const ch = supabase
      .channel(`month-${monthRecord.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `month_id=eq.${monthRecord.id}` },
        (p) => {
          if (p.eventType === 'DELETE') setExpenses((x) => x.filter((r) => r.id !== p.old.id))
          else setExpenses((x) => upsertById(x, p.new))
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contributions', filter: `month_id=eq.${monthRecord.id}` },
        (p) => {
          if (p.eventType === 'DELETE') setContributions((x) => x.filter((r) => r.id !== p.old.id))
          else setContributions((x) => upsertById(x, p.new))
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'month_budgets', filter: `month_id=eq.${monthRecord.id}` },
        (p) => setMonthBudgets((x) => upsertById(x, p.new)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'income_targets', filter: `month_id=eq.${monthRecord.id}` },
        (p) => setIncomeTargets((x) => upsertById(x, p.new)))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'months', filter: `id=eq.${monthRecord.id}` },
        (p) => setMonthRecord((m) => ({ ...m, ...p.new })))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [monthRecord?.id])

  // ---------- Acciones de escritura (optimistas + cola) ----------
  const persistRow = useCallback(async (table, row) => {
    if (navigator.onLine) {
      const { error } = await supabase.from(table).upsert(row, { onConflict: 'id' })
      if (error) { await enqueue({ table, row }); await refreshPending() }
    } else {
      await enqueue({ table, row })
      await refreshPending()
    }
  }, [refreshPending])

  const addExpense = useCallback(async ({ category_id, amount, spent_at, note }) => {
    if (!monthRecord) return
    const row = {
      id: crypto.randomUUID(), month_id: monthRecord.id, category_id,
      amount: Number(amount), spent_at: spent_at || todayISO(),
      note: note || null, created_by: activeMemberId || null,
      created_at: new Date().toISOString(),
    }
    setExpenses((x) => upsertById(x, row))
    await persistRow('expenses', row)
  }, [monthRecord, activeMemberId, persistRow])

  const addContribution = useCallback(async ({ member_id, amount, paid_at, note }) => {
    if (!monthRecord) return
    const row = {
      id: crypto.randomUUID(), month_id: monthRecord.id, member_id,
      amount: Number(amount), paid_at: paid_at || todayISO(),
      note: note || null, created_by: activeMemberId || null,
      created_at: new Date().toISOString(),
    }
    setContributions((x) => upsertById(x, row))
    await persistRow('contributions', row)
  }, [monthRecord, activeMemberId, persistRow])

  const deleteExpense = useCallback(async (id) => {
    setExpenses((x) => x.filter((r) => r.id !== id))
    if (navigator.onLine) await supabase.from('expenses').delete().eq('id', id)
  }, [])

  const deleteContribution = useCallback(async (id) => {
    setContributions((x) => x.filter((r) => r.id !== id))
    if (navigator.onLine) await supabase.from('contributions').delete().eq('id', id)
  }, [])

  const setCategoryBudget = useCallback(async (category_id, amount) => {
    const existing = monthBudgets.find((b) => b.category_id === category_id)
    const row = existing
      ? { ...existing, assigned_amount: Number(amount) }
      : { id: crypto.randomUUID(), month_id: monthRecord.id, category_id, assigned_amount: Number(amount) }
    setMonthBudgets((x) => upsertById(x, row))
    await persistRow('month_budgets', row)
  }, [monthBudgets, monthRecord, persistRow])

  const setMemberTarget = useCallback(async (member_id, amount) => {
    const existing = incomeTargets.find((t) => t.member_id === member_id)
    const row = existing
      ? { ...existing, target_amount: Number(amount) }
      : { id: crypto.randomUUID(), month_id: monthRecord.id, member_id, target_amount: Number(amount) }
    setIncomeTargets((x) => upsertById(x, row))
    await persistRow('income_targets', row)
  }, [incomeTargets, monthRecord, persistRow])

  const createMonth = useCallback(async (year, month) => {
    if (!household) return
    await loadMonth(household.id, year, month, { autoCreate: true })
  }, [household, loadMonth])

  // Alta de aportante (sin necesidad de login: auth_user_id queda en null).
  // Devuelve el id del nuevo miembro. Si hay mes actual y meta, la registra.
  const addMember = useCallback(async (name, monthlyTarget) => {
    if (!household) return null
    const id = crypto.randomUUID()
    const row = {
      id, household_id: household.id, name: name.trim(),
      auth_user_id: null, is_active: true, created_at: new Date().toISOString(),
    }
    setMembers((x) => [...x, row])
    await persistRow('members', row)
    if (monthRecord && Number(monthlyTarget) > 0) {
      const t = { id: crypto.randomUUID(), month_id: monthRecord.id, member_id: id, target_amount: Number(monthlyTarget) }
      setIncomeTargets((x) => upsertById(x, t))
      await persistRow('income_targets', t)
    }
    return id
  }, [household, monthRecord, persistRow])

  const updateMemberName = useCallback(async (id, name) => {
    const existing = members.find((m) => m.id === id)
    if (!existing) return
    const row = { ...existing, name: name.trim() }
    setMembers((x) => x.map((m) => (m.id === id ? row : m)))
    await persistRow('members', row)
  }, [members, persistRow])

  const setMemberActive = useCallback(async (id, isActive) => {
    const existing = members.find((m) => m.id === id)
    if (!existing) return
    const row = { ...existing, is_active: isActive }
    setMembers((x) => x.map((m) => (m.id === id ? row : m)))
    await persistRow('members', row)
  }, [members, persistRow])

  const updateCategoryName = useCallback(async (id, name) => {
    const existing = categories.find((c) => c.id === id)
    if (!existing) return
    const row = { ...existing, name: name.trim() }
    setCategories((x) => x.map((c) => (c.id === id ? row : c)))
    await persistRow('categories', row)
  }, [categories, persistRow])

  const setCategoryActive = useCallback(async (id, isActive) => {
    const existing = categories.find((c) => c.id === id)
    if (!existing) return
    const row = { ...existing, is_active: isActive }
    setCategories((x) => x.map((c) => (c.id === id ? row : c)))
    await persistRow('categories', row)
  }, [categories, persistRow])

  const goToMonth = useCallback((year, month) => setYm({ year, month }), [])
  const shiftMonth = useCallback((delta) => {
    setYm(({ year, month }) => {
      const idx = year * 12 + (month - 1) + delta
      return { year: Math.floor(idx / 12), month: (idx % 12) + 1 }
    })
  }, [])

  // ---------- Cálculos derivados ----------
  const derived = useMemo(() => {
    const spentByCat = {}
    for (const e of expenses) spentByCat[e.category_id] = (spentByCat[e.category_id] || 0) + Number(e.amount)
    const budgetByCat = {}
    for (const b of monthBudgets) budgetByCat[b.category_id] = Number(b.assigned_amount)

    // Igual que con los aportantes: una categoría oculta deja de aparecer en el
    // uso normal del mes, salvo que ya tenga presupuesto o gasto asignado ese mes
    // (para no perder el dato histórico si se ocultó a medio mes).
    const categoryBalances = categories
      .filter((c) => c.is_active || budgetByCat[c.id] || spentByCat[c.id])
      .map((c) => {
        const assigned = budgetByCat[c.id] || 0
        const spent = spentByCat[c.id] || 0
        return { ...c, assigned, spent, remaining: assigned - spent }
      })

    const totalSpent = expenses.reduce((s, e) => s + Number(e.amount), 0)
    // El presupuesto total del mes se calcula siempre como la suma de lo asignado
    // por categoría — no es un valor independiente que se edite aparte.
    const assignedSum = monthBudgets.reduce((s, b) => s + Number(b.assigned_amount), 0)
    const totalBudget = assignedSum
    const totalRemaining = totalBudget - totalSpent

    const contribByMember = {}
    for (const c of contributions) contribByMember[c.member_id] = (contribByMember[c.member_id] || 0) + Number(c.amount)
    const targetByMember = {}
    for (const t of incomeTargets) targetByMember[t.member_id] = Number(t.target_amount)

    const memberRows = members
      .filter((m) => m.is_active || targetByMember[m.id] != null || contribByMember[m.id])
      .map((m) => {
        const target = targetByMember[m.id] || 0
        const contributed = contribByMember[m.id] || 0
        return { ...m, target, contributed, pending: target - contributed, isComplete: target > 0 && contributed >= target }
      })

    const incomeGoal = incomeTargets.reduce((s, t) => s + Number(t.target_amount), 0)
    const totalCollected = contributions.reduce((s, c) => s + Number(c.amount), 0)

    return {
      categoryBalances, totalSpent, totalBudget, totalRemaining, assignedSum,
      memberRows, incomeGoal, totalCollected, incomePending: incomeGoal - totalCollected,
    }
  }, [categories, expenses, monthBudgets, monthRecord, members, contributions, incomeTargets])

  const value = {
    // estado
    session, authReady, isSupabaseConfigured, household, members, categories,
    ym, monthRecord, monthBudgets, incomeTargets, expenses, contributions,
    loading, monthMissing, error, online, pending,
    activeMemberId, setActiveMemberId,
    // derivado
    ...derived,
    // acciones
    signIn, signOut, addExpense, addContribution, deleteExpense, deleteContribution,
    setCategoryBudget, setMemberTarget, createMonth,
    addMember, updateMemberName, setMemberActive,
    updateCategoryName, setCategoryActive,
    goToMonth, shiftMonth, reloadMonth,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

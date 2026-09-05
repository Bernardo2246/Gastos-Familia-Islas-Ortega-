import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { money, pct, monthLabel } from '../lib/format'
import { computeDashboard, computeCategoryCarryover } from '../lib/analytics'
import { GroupedBarChart, LineChart, Donut, ChartLegend } from './Charts'

const RANGES = [
  { key: '3', label: 'Últimos 3' },
  { key: '6', label: 'Últimos 6' },
  { key: 'all', label: 'Todo' },
]

const nowYM = () => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() + 1 } }

// Barra horizontal simple reutilizable
function HBar({ label, value, max, caption, color = 'var(--accent)', highlight }) {
  const w = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="hbar">
      <div className="hbar-head">
        <span className={`hbar-label ${highlight ? 'hl' : ''}`}>{label}</span>
        <span className="hbar-cap">{caption}</span>
      </div>
      <div className="meter"><span style={{ width: `${w}%`, background: color }} /></div>
    </div>
  )
}

export default function DashboardView() {
  const { household, categories, members } = useApp()
  const [range, setRange] = useState('6')
  const [includeCurrent, setIncludeCurrent] = useState(false)
  const [raw, setRaw] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(false)
  const [sort, setSort] = useState({ key: 'avg', dir: 'desc' })
  const [carryRaw, setCarryRaw] = useState(null)

  useEffect(() => {
    if (!household) return
    let cancelled = false
    ;(async () => {
      setLoading(true); setErr(false)
      try {
        const { data: allMonths, error } = await supabase
          .from('months').select('*').eq('household_id', household.id)
        if (error) throw error
        // El mes en curso (calendario actual) suele estar incompleto y
        // distorsiona promedios/tendencias, así que se excluye por defecto.
        const cur = nowYM()
        const sortedAll = [...(allMonths || [])].sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month))
        const isCurrent = (m) => m.year === cur.year && m.month === cur.month
        const hasCurrent = sortedAll.some(isCurrent)
        const pool = includeCurrent ? sortedAll : sortedAll.filter((m) => !isCurrent(m))
        const base = pool.length ? pool : sortedAll
        const months = range === 'all' ? base : base.slice(-Number(range))
        const ids = months.map((m) => m.id)
        if (ids.length === 0) { if (!cancelled) { setRaw({ months: [], expenses: [], contributions: [], budgets: [], targets: [], hasCurrent, currentLabel: monthLabel(cur.year, cur.month) }); setLoading(false) } ; return }
        const [ex, co, mb, it] = await Promise.all([
          supabase.from('expenses').select('month_id,category_id,amount,spent_at').in('month_id', ids),
          supabase.from('contributions').select('month_id,member_id,amount,paid_at').in('month_id', ids),
          supabase.from('month_budgets').select('month_id,category_id,assigned_amount').in('month_id', ids),
          supabase.from('income_targets').select('month_id,member_id,target_amount').in('month_id', ids),
        ])
        if (cancelled) return
        setRaw({
          months, expenses: ex.data || [], contributions: co.data || [], budgets: mb.data || [], targets: it.data || [],
          hasCurrent, currentLabel: monthLabel(cur.year, cur.month),
        })
      } catch {
        if (!cancelled) setErr(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [household, range, includeCurrent])

  // Historial completo del hogar para el saldo acumulado por categoría.
  // Independiente del selector de rango: el arrastre solo es correcto si se
  // calcula desde el primer mes real, no desde un recorte de "últimos N".
  useEffect(() => {
    if (!household) return
    let cancelled = false
    ;(async () => {
      try {
        const { data: allMonths, error } = await supabase
          .from('months').select('*').eq('household_id', household.id)
        if (error) throw error
        const sortedAll = [...(allMonths || [])].sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month))
        const ids = sortedAll.map((m) => m.id)
        if (ids.length === 0) { if (!cancelled) setCarryRaw({ months: [], expenses: [], budgets: [] }); return }
        const [ex, mb] = await Promise.all([
          supabase.from('expenses').select('month_id,category_id,amount').in('month_id', ids),
          supabase.from('month_budgets').select('month_id,category_id,assigned_amount').in('month_id', ids),
        ])
        if (!cancelled) setCarryRaw({ months: sortedAll, expenses: ex.data || [], budgets: mb.data || [] })
      } catch {
        if (!cancelled) setCarryRaw(null)
      }
    })()
    return () => { cancelled = true }
  }, [household])

  const carry = useMemo(
    () => computeCategoryCarryover({ ...(carryRaw || {}), categories }),
    [carryRaw, categories]
  )

  const d = useMemo(
    () => computeDashboard({ ...(raw || {}), categories, members }),
    [raw, categories, members]
  )

  const sortedTable = useMemo(() => {
    const rows = d.perCategory.filter((c) => c.spentTotal > 0 || c.assignedTotal > 0)
    const { key, dir } = sort
    const mul = dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      if (key === 'name') return a.name.localeCompare(b.name) * mul
      return (a[key] - b[key]) * mul
    })
  }, [d.perCategory, sort])

  const toggleSort = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }))
  const arrow = (key) => (sort.key === key ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : '')

  if (loading) return <div className="content"><div className="empty"><div className="spinner" style={{ margin: '0 auto' }} /></div></div>
  if (err) return <div className="content"><div className="empty">No se pudo cargar el análisis. Revisa tu conexión.</div></div>
  if (!d.hasData) return (
    <div className="content">
      <RangeSelector range={range} setRange={setRange} />
      <CurrentToggle raw={raw} includeCurrent={includeCurrent} setIncludeCurrent={setIncludeCurrent} />
      <div className="empty">Aún no hay meses con datos en este rango.</div>
    </div>
  )

  const { kpis, perMonth, cumulative, overspendRanking, distribution, mostVariable, perMember, thirds, maxMonth, minMonth } = d
  const net = kpis.netCumulative
  const maxContribTarget = Math.max(1, ...perMember.map((m) => Math.max(m.totalTarget, m.totalContrib)))

  return (
    <div className="content">
      <RangeSelector range={range} setRange={setRange} />
      <CurrentToggle raw={raw} includeCurrent={includeCurrent} setIncludeCurrent={setIncludeCurrent} />
      <p className="muted" style={{ margin: '0 2px', fontSize: 12 }}>
        {perMonth.length} {perMonth.length === 1 ? 'mes' : 'meses'}: {monthLabel(perMonth[0].year, perMonth[0].month)} – {monthLabel(perMonth.at(-1).year, perMonth.at(-1).month)}
      </p>

      {/* ---------- Sección A: Resumen ---------- */}
      <div className="hero" style={net < 0 ? { background: 'linear-gradient(160deg,#7a1f2b,#3d0a11)', borderColor: 'var(--line)' } : undefined}>
        <div className="label">{net < 0 ? 'Déficit acumulado' : 'Ahorro acumulado'}</div>
        <div className={`amount ${net < 0 ? 'neg' : ''}`}>{money(net)}</div>
        <div className="sub">Recaudado {money(kpis.totalCollected)} − Gastado {money(kpis.totalSpent)}</div>
      </div>

      <div className="stat-grid">
        <div className="stat"><div className="k">Gasto total</div><div className="v">{money(kpis.totalSpent)}</div></div>
        <div className="stat"><div className="k">Promedio mensual</div><div className="v">{money(Math.round(kpis.avgMonthlySpend))}</div></div>
        <div className="stat">
          <div className="k">Meses dentro de presupuesto</div>
          <div className="v">{pct(kpis.budgetComplianceRate)}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{kpis.withinCount} de {kpis.budgetMonthsCount}</div>
        </div>
        <div className="stat">
          <div className="k">Recaudación vs meta</div>
          <div className="v">{pct(kpis.collectionRate)}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{money(kpis.totalCollected)} / {money(kpis.totalGoal)}</div>
        </div>
      </div>

      {/* ---------- Sección B: Presupuesto en el tiempo ---------- */}
      <div className="section-title">Presupuesto en el tiempo</div>
      <div className="card chart-card">
        <div className="chart-title">Gastado vs presupuestado por mes</div>
        <ChartLegend items={[{ name: 'Gastado', color: '#15c08a' }, { name: 'Presupuestado', color: '#4f9dff' }]} />
        <GroupedBarChart
          data={perMonth.map((p) => ({ label: p.label, values: [p.spent, p.budget] }))}
          series={[{ name: 'Gastado', color: '#15c08a' }, { name: 'Presupuestado', color: '#4f9dff' }]}
        />
      </div>
      <div className="card chart-card">
        <div className="chart-title">Tendencia del gasto mensual</div>
        <LineChart data={perMonth.map((p) => ({ label: p.label, value: p.spent }))} color="#15c08a" />
      </div>
      <div className="card chart-card">
        <div className="chart-title">Ahorro / déficit acumulado</div>
        <LineChart data={cumulative} color="#4f9dff" allowNegative />
      </div>

      {/* ---------- Saldo acumulado por categoría (tipo "sobre") ---------- */}
      <div className="section-title">Saldo acumulado por categoría</div>
      <div className="card">
        {carry.perCategory.length === 0 ? (
          <div className="empty" style={{ padding: 16 }}>Aún no hay historial para calcular el saldo acumulado.</div>
        ) : (
          <>
            <p className="muted" style={{ margin: '0 0 10px', fontSize: 12 }}>
              {carry.firstMonth && carry.lastMonth
                ? `${monthLabel(carry.firstMonth.year, carry.firstMonth.month)} – ${monthLabel(carry.lastMonth.year, carry.lastMonth.month)} · saldo = presupuesto asignado − gastado, arrastrado mes a mes por categoría`
                : ''}
            </p>
            {carry.perCategory.map((c) => (
              <div className="tx" key={c.id}>
                <div className="tx-main">
                  <span className="tx-note">{c.name}</span>
                  <span className="tx-meta">asignado {money(c.assignedTotal)} · gastado {money(c.spentTotal)}</span>
                </div>
                <span className={`row-remain ${c.balance < 0 ? 'neg' : ''}`}>{money(c.balance)}</span>
              </div>
            ))}
            <div className="tx" style={{ borderTop: '1px solid var(--line)', marginTop: 4, paddingTop: 10 }}>
              <span className="tx-note" style={{ fontWeight: 800 }}>Total acumulado</span>
              <span className={`row-remain ${carry.totalBalance < 0 ? 'neg' : ''}`}>{money(carry.totalBalance)}</span>
            </div>
            <p className="muted" style={{ margin: '8px 0 0', fontSize: 12 }}>
              {money(carry.totalBalance)} = presupuesto asignado {money(carry.totalAssigned)} − gastado {money(carry.totalSpent)}, en {carry.monthsCount} {carry.monthsCount === 1 ? 'mes' : 'meses'}. Este total es el acumulado real desde el primer mes; el "Restante del mes" de Inicio solo muestra el mes que estás viendo ahí, sin arrastre de meses anteriores.
            </p>
          </>
        )}
      </div>

      {/* ---------- Sección C: Análisis por categoría ---------- */}
      <div className="section-title">Análisis por categoría</div>
      <div className="card">
        <div className="chart-title">Categorías que más rebasan su presupuesto</div>
        {overspendRanking.length === 0 ? (
          <div className="empty" style={{ padding: 16 }}>Ninguna categoría rebasó su presupuesto 🎉</div>
        ) : (
          overspendRanking.map((c, i) => (
            <HBar key={c.id} label={`${i + 1}. ${c.name}`} value={c.overCount} max={perMonth.length}
              color={i < 3 ? 'var(--danger)' : 'var(--warn)'} highlight={i < 3}
              caption={`${c.overCount} de ${perMonth.length} ${perMonth.length === 1 ? 'mes' : 'meses'}`} />
          ))
        )}
      </div>

      <div className="card chart-card">
        <div className="chart-title">Distribución del gasto</div>
        <div className="donut-wrap">
          <Donut data={distribution.map((c) => ({ name: c.name, value: c.spentTotal, color: c.color }))}
            centerLabel={money(kpis.totalSpent)} centerSub="total" />
          <div className="donut-legend">
            {distribution.slice(0, 8).map((c) => (
              <div key={c.id} className="dl-row">
                <span className="legend-dot" style={{ background: c.color }} />
                <span className="dl-name">{c.name}</span>
                <span className="dl-pct">{pct(c.pctOfSpend)}</span>
                <span className="dl-plan muted">plan {pct(c.pctPlanned)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="chart-title">Variabilidad mes a mes (rango min–máx)</div>
        {mostVariable.slice(0, 6).map((c) => (
          <div key={c.id} className="tx" style={{ borderColor: 'var(--line)' }}>
            <div className="tx-main">
              <span className="tx-note">{c.name}</span>
              <span className="tx-meta">min {money(c.min)} · máx {money(c.max)}</span>
            </div>
            <span className="tx-amt">±{money(Math.round(c.std))}</span>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="chart-title">Gasto por categoría</div>
        <table className="dash-table">
          <thead>
            <tr>
              <th onClick={() => toggleSort('name')}>Categoría{arrow('name')}</th>
              <th className="right" onClick={() => toggleSort('avg')}>Prom/mes{arrow('avg')}</th>
              <th className="right" onClick={() => toggleSort('spentTotal')}>Total{arrow('spentTotal')}</th>
            </tr>
          </thead>
          <tbody>
            {sortedTable.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td className="right">{money(Math.round(c.avg))}</td>
                <td className="right">{money(c.spentTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ---------- Sección D: Aportaciones ---------- */}
      <div className="section-title">Aportaciones</div>
      <div className="card">
        <div className="chart-title">Cumplimiento por persona</div>
        {perMember.length === 0 ? <div className="empty" style={{ padding: 16 }}>Sin metas de aportación en el rango.</div> : (
          perMember.map((m) => (
            <HBar key={m.id} label={m.name} value={m.totalContrib} max={m.totalTarget || maxContribTarget}
              color={m.complianceRate >= 1 ? 'var(--accent)' : '#4f9dff'}
              caption={`${pct(m.complianceRate)} · ${money(m.totalContrib)}/${money(m.totalTarget)}`} />
          ))
        )}
      </div>

      <div className="card">
        <div className="chart-title">Días promedio para completar la meta</div>
        {perMember.map((m) => (
          <div key={m.id} className="tx">
            <div className="tx-main">
              <span className="tx-note">{m.name}</span>
              <span className="tx-meta">{m.monthsCompleted} {m.monthsCompleted === 1 ? 'mes completado' : 'meses completados'}</span>
            </div>
            <span className="tx-amt">{m.avgDayToComplete != null ? `día ${Math.round(m.avgDayToComplete)}` : '—'}</span>
          </div>
        ))}
      </div>

      <div className="card chart-card">
        <div className="chart-title">Aportado vs meta por mes</div>
        <ChartLegend items={[{ name: 'Aportado', color: '#15c08a' }, { name: 'Meta', color: '#f5b945' }]} />
        <GroupedBarChart
          data={perMonth.map((p) => ({ label: p.label, values: [p.collected, p.goal] }))}
          series={[{ name: 'Aportado', color: '#15c08a' }, { name: 'Meta', color: '#f5b945' }]}
        />
      </div>

      {/* ---------- Sección E: Detalle temporal ---------- */}
      <div className="section-title">Detalle temporal</div>
      <div className="card chart-card">
        <div className="chart-title">¿En qué parte del mes se gasta?</div>
        <GroupedBarChart
          data={[
            { label: 'Días 1–10', values: [thirds.inicio] },
            { label: 'Días 11–20', values: [thirds.medio] },
            { label: 'Días 21–31', values: [thirds.fin] },
          ]}
          series={[{ name: 'Gasto', color: '#a78bfa' }]}
        />
      </div>
      <div className="stat-grid">
        <div className="stat">
          <div className="k">Mes de mayor gasto</div>
          <div className="v" style={{ fontSize: 17 }}>{maxMonth ? monthLabel(maxMonth.year, maxMonth.month) : '—'}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{maxMonth ? money(maxMonth.spent) : ''}</div>
        </div>
        <div className="stat">
          <div className="k">Mes de menor gasto</div>
          <div className="v" style={{ fontSize: 17 }}>{minMonth ? monthLabel(minMonth.year, minMonth.month) : '—'}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{minMonth ? money(minMonth.spent) : ''}</div>
        </div>
      </div>
    </div>
  )
}

function RangeSelector({ range, setRange }) {
  return (
    <div className="chips" style={{ marginTop: 2 }}>
      {RANGES.map((r) => (
        <button key={r.key} className={`chip ${range === r.key ? 'active' : ''}`} onClick={() => setRange(r.key)}>
          {r.label}
        </button>
      ))}
    </div>
  )
}

function CurrentToggle({ raw, includeCurrent, setIncludeCurrent }) {
  if (!raw?.hasCurrent) return null
  return (
    <label className="toggle-row">
      <input type="checkbox" checked={includeCurrent} onChange={(e) => setIncludeCurrent(e.target.checked)} />
      Incluir mes en curso ({raw.currentLabel}, aún incompleto)
    </label>
  )
}

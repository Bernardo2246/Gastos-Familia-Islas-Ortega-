import { useState } from 'react'
import { compactMoney, money } from '../lib/format'

// Todas las gráficas son SVG responsivas (width 100%, alto por viewBox) y
// usan variables CSS del tema (--series-*, --muted, --line). Toleran datasets
// vacíos sin producir NaN. Tocar o pasar el cursor sobre un mes muestra sus
// cifras arriba de la gráfica (en iPhone no hay hover: es un toque).

const FONT = 11

export function ChartLegend({ items }) {
  return (
    <div className="legend">
      {items.map((it) => (
        <span key={it.name} className="legend-item">
          <span className="legend-dot" style={{ background: it.color }} />
          {it.name}
        </span>
      ))}
    </div>
  )
}

// Rectángulo con las esquinas redondeadas solo arriba: la barra queda anclada a la base.
function barPath(x, y, w, h, r = 4) {
  if (h <= 0 || w <= 0) return ''
  const rr = Math.min(r, w / 2, h)
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`
}

// Renglón con las cifras del mes activo (o del último, si no hay ninguno).
function Readout({ label, items }) {
  return (
    <div className="chart-readout" aria-live="polite">
      <span className="chart-readout-label">{label}</span>
      {items.map((it) => (
        <span key={it.name} className="chart-readout-item">
          {it.color && <span className="legend-dot" style={{ background: it.color }} />}
          {it.name} <strong>{money(it.value)}</strong>
        </span>
      ))}
    </div>
  )
}

// data: [{ label, values: [n, n] }]  series: [{ name, color }]
export function GroupedBarChart({ data, series }) {
  const [active, setActive] = useState(null)
  const W = 340, H = 180, padB = 22, padT = 16, padL = 4, padR = 4
  const plotW = W - padL - padR
  const plotH = H - padT - padB
  const baseY = padT + plotH
  const max = Math.max(1, ...data.flatMap((d) => d.values))
  const groups = data.length || 1
  const gW = plotW / groups
  const barW = (gW * 0.7) / series.length
  const y = (v) => baseY - (v / max) * plotH
  const showEvery = Math.ceil(groups / 7)

  if (!data.length) return <ChartEmpty />
  const shown = active ?? data.length - 1

  return (
    <>
      <Readout label={data[shown].label}
        items={series.map((s, si) => ({ name: s.name, color: s.color, value: data[shown].values[si] }))} />
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img"
        aria-label={`Gráfica de barras: ${series.map((s) => s.name).join(' y ')} por mes`}
        onMouseLeave={() => setActive(null)}>
        <line x1={padL} y1={y(max)} x2={W - padR} y2={y(max)} stroke="var(--line)" strokeWidth="1" strokeDasharray="3 4" />
        <text x={W - padR} y={y(max) - 4} textAnchor="end" fill="var(--muted)" fontSize={FONT}>{compactMoney(max)}</text>
        {data.map((d, gi) => {
          const gx = padL + gi * gW
          const on = gi === active
          return (
            <g key={gi} opacity={active == null || on ? 1 : 0.45}>
              {d.values.map((v, si) => {
                const bx = gx + gW * 0.15 + si * barW
                // 2 px de separación entre barras vecinas.
                return <path key={si} d={barPath(bx, y(v), barW - 2, Math.max(0, baseY - y(v)))} fill={series[si].color} />
              })}
              {(gi % showEvery === 0 || gi === groups - 1) && (
                <text x={gx + gW / 2} y={H - 6} textAnchor="middle" fill={on ? 'var(--text)' : 'var(--muted)'} fontSize={FONT}>{d.label}</text>
              )}
              {/* Zona de toque de toda la columna, más grande que las barras. */}
              <rect x={gx} y={padT} width={gW} height={plotH + padB} fill="transparent"
                onMouseEnter={() => setActive(gi)} onClick={() => setActive(on ? null : gi)} />
            </g>
          )
        })}
        <line x1={padL} y1={baseY} x2={W - padR} y2={baseY} stroke="var(--line)" strokeWidth="1" />
      </svg>
    </>
  )
}

// data: [{ label, value }]  allowNegative para líneas de acumulado
export function LineChart({ data, name, color = 'var(--series-1)', area = true, allowNegative = false }) {
  const [active, setActive] = useState(null)
  const W = 340, H = 170, padB = 22, padT = 14, padL = 8, padR = 8
  const plotW = W - padL - padR
  const plotH = H - padT - padB
  if (!data.length) return <ChartEmpty />

  const vals = data.map((d) => d.value)
  const max = allowNegative ? Math.max(...vals, 0) : Math.max(1, ...vals)
  const min = allowNegative ? Math.min(...vals, 0) : 0
  const span = max - min || 1
  const n = data.length
  const x = (i) => padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW)
  const y = (v) => padT + (1 - (v - min) / span) * plotH
  const zeroY = y(0)

  const pts = data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ')
  const areaPath = `M ${x(0)},${zeroY} L ${pts.replaceAll(' ', ' L ')} L ${x(n - 1)},${zeroY} Z`
  const showEvery = Math.ceil(n / 7)
  const shown = active ?? n - 1
  const step = n === 1 ? plotW : plotW / (n - 1)
  // Las etiquetas de los extremos se alinean hacia adentro para no cortarse.
  const anchor = (i) => (n === 1 ? 'middle' : i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle')
  const labelX = (i) => (anchor(i) === 'start' ? x(i) - 4 : anchor(i) === 'end' ? x(i) + 4 : x(i))

  return (
    <>
      <Readout label={data[shown].label} items={[{ name, value: data[shown].value }]} />
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img" aria-label={`Gráfica de línea: ${name}`}
        onMouseLeave={() => setActive(null)}>
        <line x1={padL} y1={zeroY} x2={W - padR} y2={zeroY} stroke="var(--line)" strokeWidth="1"
          strokeDasharray={allowNegative ? '3 4' : undefined} />
        {area && <path d={areaPath} fill={color} opacity="0.12" />}
        {active != null && <line x1={x(active)} y1={padT} x2={x(active)} y2={padT + plotH} stroke="var(--muted)" strokeWidth="1" />}
        <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => (
          <circle key={i} cx={x(i)} cy={y(d.value)} r={i === shown ? 5 : 3.5} fill={color}
            stroke="var(--bg-card)" strokeWidth="2" />
        ))}
        {data.map((d, i) => (i % showEvery === 0 || i === n - 1)
          ? <text key={`l${i}`} x={labelX(i)} y={H - 6} textAnchor={anchor(i)} fill={i === active ? 'var(--text)' : 'var(--muted)'} fontSize={FONT}>{d.label}</text>
          : null)}
        {data.map((d, i) => (
          <rect key={`h${i}`} x={x(i) - step / 2} y={0} width={step} height={H} fill="transparent"
            onMouseEnter={() => setActive(i)} onClick={() => setActive(i === active ? null : i)} />
        ))}
      </svg>
    </>
  )
}

function ChartEmpty() {
  return <div className="empty" style={{ padding: 20 }}>Sin datos en el rango</div>
}

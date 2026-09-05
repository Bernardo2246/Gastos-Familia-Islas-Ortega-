import { compactMoney } from '../lib/format'

// Todas las gráficas son SVG responsivas (width 100%, alto por viewBox) y
// usan variables CSS del tema. Toleran datasets vacíos sin producir NaN.

const AXIS = '#25324d'
const MUTED = '#93a1bd'

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

// data: [{ label, values: [n, n] }]  series: [{ name, color }]
export function GroupedBarChart({ data, series }) {
  const W = 340, H = 190, padB = 26, padT = 14, padL = 6, padR = 6
  const plotW = W - padL - padR
  const plotH = H - padT - padB
  const baseY = padT + plotH
  const max = Math.max(1, ...data.flatMap((d) => d.values))
  const groups = data.length || 1
  const gW = plotW / groups
  const bars = series.length
  const barW = (gW * 0.62) / bars
  const y = (v) => baseY - (v / max) * plotH

  if (!data.length) return <ChartEmpty />

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img">
      <line x1={padL} y1={baseY} x2={W - padR} y2={baseY} stroke={AXIS} strokeWidth="1" />
      <line x1={padL} y1={y(max)} x2={W - padR} y2={y(max)} stroke={AXIS} strokeWidth="1" strokeDasharray="3 4" />
      <text x={padL} y={y(max) - 3} fill={MUTED} fontSize="9">{compactMoney(max)}</text>
      {data.map((d, gi) => {
        const gx = padL + gi * gW
        return (
          <g key={gi}>
            {d.values.map((v, si) => {
              const bx = gx + gW * 0.19 + si * barW
              const bh = Math.max(0, baseY - y(v))
              return <rect key={si} x={bx} y={y(v)} width={barW - 2} height={bh} rx="2" fill={series[si].color} />
            })}
            <text x={gx + gW / 2} y={H - 9} textAnchor="middle" fill={MUTED} fontSize="10">{d.label}</text>
          </g>
        )
      })}
    </svg>
  )
}

// data: [{ label, value }]  allowNegative para líneas de acumulado
export function LineChart({ data, color = 'var(--accent)', area = true, allowNegative = false }) {
  const W = 340, H = 170, padB = 24, padT = 14, padL = 6, padR = 8
  const plotW = W - padL - padR
  const plotH = H - padT - padB
  if (!data.length) return <ChartEmpty />

  const vals = data.map((d) => d.value)
  const rawMax = Math.max(...vals)
  const rawMin = Math.min(...vals)
  const max = allowNegative ? Math.max(rawMax, 0) : Math.max(1, rawMax)
  const min = allowNegative ? Math.min(rawMin, 0) : 0
  const span = max - min || 1
  const n = data.length
  const x = (i) => padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW)
  const y = (v) => padT + (1 - (v - min) / span) * plotH
  const zeroY = y(0)

  const pts = data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ')
  const areaPath = `M ${x(0)},${zeroY} L ${pts.replaceAll(' ', ' L ')} L ${x(n - 1)},${zeroY} Z`
  const showEvery = Math.ceil(n / 6)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img">
      {allowNegative && <line x1={padL} y1={zeroY} x2={W - padR} y2={zeroY} stroke={AXIS} strokeWidth="1" strokeDasharray="3 4" />}
      {!allowNegative && <line x1={padL} y1={padT + plotH} x2={W - padR} y2={padT + plotH} stroke={AXIS} strokeWidth="1" />}
      {area && <path d={areaPath} fill={color} opacity="0.14" />}
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => <circle key={i} cx={x(i)} cy={y(d.value)} r="3" fill={color} />)}
      {data.map((d, i) => (i % showEvery === 0 || i === n - 1)
        ? <text key={`l${i}`} x={x(i)} y={H - 7} textAnchor="middle" fill={MUTED} fontSize="10">{d.label}</text>
        : null)}
    </svg>
  )
}

// data: [{ name, value, color }]
export function Donut({ data, centerLabel, centerSub }) {
  const size = 168, stroke = 26, r = (size - stroke) / 2, cx = size / 2, cy = size / 2
  const C = 2 * Math.PI * r
  const total = data.reduce((s, d) => s + d.value, 0)
  if (!total) return <ChartEmpty />

  let offset = 0
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="donut-svg" role="img">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#0c1424" strokeWidth={stroke} />
      {data.map((d, i) => {
        const frac = d.value / total
        const seg = frac * C
        const el = (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={d.color} strokeWidth={stroke}
            strokeDasharray={`${seg} ${C - seg}`} strokeDashoffset={-offset}
            transform={`rotate(-90 ${cx} ${cy})`} />
        )
        offset += seg
        return el
      })}
      <text x={cx} y={cy - 2} textAnchor="middle" fill="var(--text)" fontSize="22" fontWeight="800">{centerLabel}</text>
      {centerSub && <text x={cx} y={cy + 16} textAnchor="middle" fill={MUTED} fontSize="10">{centerSub}</text>}
    </svg>
  )
}

function ChartEmpty() {
  return <div className="empty" style={{ padding: 20 }}>Sin datos en el rango</div>
}

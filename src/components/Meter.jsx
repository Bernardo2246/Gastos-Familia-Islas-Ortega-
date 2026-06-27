export default function Meter({ value, max }) {
  const ratio = max > 0 ? value / max : 0
  const pct = Math.min(100, Math.max(0, ratio * 100))
  const cls = ratio > 1 ? 'meter over' : ratio >= 0.85 ? 'meter warn' : 'meter'
  return (
    <div className={cls}>
      <span style={{ width: `${pct}%` }} />
    </div>
  )
}

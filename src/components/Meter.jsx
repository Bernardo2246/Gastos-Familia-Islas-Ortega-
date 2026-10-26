import { semaforo } from '../lib/finance'

// Barra de avance con el semáforo de lib/finance.js (verde < 80 %, ámbar
// 80–100 %, rojo > 100 %). Sin máximo y con gasto, la barra va llena en rojo.
// `goal` = la barra mide una meta a alcanzar (aportaciones): siempre verde.
export default function Meter({ value, max, goal = false }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : value > 0 ? 100 : 0
  const status = goal ? 'ok' : semaforo(value, max)
  return (
    <div className={`meter ${status === 'ok' ? '' : status}`}>
      <span style={{ width: `${pct}%` }} />
    </div>
  )
}

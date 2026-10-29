import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { cuadre } from '../lib/finance'
import { money } from '../lib/format'

// Cuadre entre lo asignado a sobres y la meta de aportaciones (v_month_totals).
// Mismos colores y barra que un sobre excedido: rojo falta aportar, ámbar
// sobra meta sin asignar, verde cuadrados. La barra mide cuánto de lo
// asignado cubre la meta.
const TEXTO = {
  short: (d) => `Faltan ${money(d)} por aportar para cubrir lo asignado`,
  surplus: (d) => `Hay ${money(-d)} aportados de más sin asignar a categorías`,
  ok: () => 'Aportaciones y presupuesto cuadrados ✓',
}
const METER = { short: 'over', surplus: 'warn', ok: '' }

// `to`: la tarjeta lleva a esa pantalla (Inicio → Ajustes).
export default function CuadreAlert({ detail = true, to }) {
  const { totalBudget, incomeGoal, budgetDifference } = useApp()
  const status = cuadre(budgetDifference)
  const pct = status === 'short' && totalBudget > 0 ? Math.max(0, (incomeGoal / totalBudget) * 100) : 100
  const Box = to ? Link : 'div'
  return (
    <Box to={to} className={`cuadre ${status}`} role="status">
      <div className="cuadre-msg">{TEXTO[status](budgetDifference)}</div>
      <div className={`meter ${METER[status]}`}><span style={{ width: `${pct}%` }} /></div>
      {detail && (
        <div className="row-sub">
          <span>Asignado {money(totalBudget)}</span>
          <span>Meta {money(incomeGoal)}</span>
        </div>
      )}
    </Box>
  )
}

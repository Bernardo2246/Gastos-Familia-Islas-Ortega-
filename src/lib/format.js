const mxn = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

const mxnCents = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function money(n) {
  const v = Number(n) || 0
  // Sin centavos si es entero, con centavos si no.
  return Number.isInteger(v) ? mxn.format(v) : mxnCents.format(v)
}

export function num(n) {
  return new Intl.NumberFormat('es-MX').format(Number(n) || 0)
}

// Moneda compacta para ejes de gráficas: $8k, $1.2k, $500
export function compactMoney(n) {
  const v = Number(n) || 0
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1000) {
    const k = abs / 1000
    return `${sign}$${k >= 10 ? Math.round(k) : k.toFixed(1).replace('.0', '')}k`
  }
  return `${sign}$${Math.round(abs)}`
}

export function pct(ratio) {
  return `${Math.round((Number(ratio) || 0) * 100)}%`
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export function monthName(month) {
  return MESES[(month - 1) % 12] || ''
}

export function monthLabel(year, month) {
  return `${monthName(month)} ${year}`
}

// Fecha local en formato YYYY-MM-DD (para inputs date y columnas date)
export function todayISO() {
  const d = new Date()
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10)
}

export function formatDate(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

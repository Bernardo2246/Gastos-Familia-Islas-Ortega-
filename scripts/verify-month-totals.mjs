// Comprueba que la vista v_month_totals (fuente oficial de los totales del mes)
// y src/lib/finance.js (respaldo mientras hay movimientos sin sincronizar) dan
// exactamente las mismas cifras en todos los meses. Solo lee.
// Uso: node scripts/verify-month-totals.mjs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import pg from 'pg'
import { monthTotals, totalsFromView } from '../src/lib/finance.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
for (const line of readFileSync(resolve(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m) process.env[m[1]] ??= m[2]
}

const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } })
await client.connect()
let fallas = 0
try {
  await client.query('begin read only')
  const q = async (sql) => (await client.query(sql)).rows
  const vista = await q('select * from v_month_totals order by year, month')
  const de = (rows, id) => rows.filter((r) => r.month_id === id)
  const expenses = await q('select month_id, amount from expenses')
  const contributions = await q('select month_id, amount from contributions')
  const budgets = await q('select month_id, assigned_amount from month_budgets')
  const targets = await q('select month_id, target_amount from income_targets')
  for (const r of vista) {
    const db = totalsFromView(r)
    const js = monthTotals({
      expenses: de(expenses, r.month_id), contributions: de(contributions, r.month_id),
      budgets: de(budgets, r.month_id), targets: de(targets, r.month_id),
    })
    const distintos = Object.keys(js).filter((k) => js[k] !== db[k])
    const mes = `${r.year}-${String(r.month).padStart(2, '0')}`
    if (distintos.length) {
      fallas++
      console.log(`FALLA ${mes}: ${distintos.map((k) => `${k} vista=${db[k]} js=${js[k]}`).join(', ')}`)
    } else {
      console.log(`OK    ${mes}: asignado ${db.budget} · meta ${db.goal} · diferencia ${db.difference} · recaudado ${db.collected} · gastado ${db.spent} · restante ${db.remaining}`)
    }
  }
  await client.query('rollback')
} finally {
  await client.end()
}
process.exit(fallas ? 1 : 0)

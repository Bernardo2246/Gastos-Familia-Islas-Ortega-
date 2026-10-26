// Sincroniza Gastos Familia (Supabase) → bóveda de Obsidian "Segundo Cerebro",
// carpeta `Gastos Familia/`:
//   - Mes actual.md       corte del mes en curso: totales, sobres y aportaciones
//   - Evolución.md        un renglón por mes desde enero 2026
//   - Historial/AAAA-MM.md  cierre de cada mes ya terminado
// Mismas fórmulas que la app: importa src/lib/finance.js (nunca se reescriben aquí).
// Lee con el rol de SOLO LECTURA obsidian_reader (supabase/obsidian_reader.sql)
// en una transacción read only; la conexión vive en .env.sync (ignorado por git).
// Idempotente: una nota solo se reescribe si su contenido cambió.
//
// Uso:      node scripts/sync-obsidian.mjs   (lo corre el LaunchAgent cada 30 min)
// Pruebas:  --boveda <carpeta>  escribe en otra carpeta en vez de la bóveda de iCloud
//           --prueba <json>     usa un volcado {households, members, ..., ahora} en vez de Supabase
//
// La escritura en la bóveda reutiliza el módulo genérico de Finanzas-Personales.

import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  celda,
  escribirSiCambia,
  frontmatter,
  rutaBoveda,
  verificarAcceso,
} from '../../Finanzas-Personales/scripts/obsidian/boveda.mjs'
import { categoryBalances, memberProgress, monthSummaries, monthTotals } from '../src/lib/finance.js'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CARPETA = 'Gastos Familia'
const DESDE = { year: 2026, month: 1 }
const ZONA = 'America/Mexico_City'
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const AVISO = '> [!warning] Nota generada por `gastos-familia/scripts/sync-obsidian.mjs` cada 30 min. No la edites a mano: la siguiente corrida la reescribe.'

function argumentos() {
  const a = process.argv.slice(2)
  const valor = (flag) => {
    const i = a.indexOf(flag)
    return i >= 0 ? a[i + 1] : undefined
  }
  return { boveda: valor('--boveda'), prueba: valor('--prueba') }
}

async function cargarEnv() {
  let texto
  try {
    texto = await readFile(join(RAIZ, '.env.sync'), 'utf8')
  } catch {
    return
  }
  for (const linea of texto.split('\n')) {
    const m = linea.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

async function cargarDeSupabase() {
  const url = process.env.SUPABASE_READER_DB_URL
  if (!url) throw new Error('Falta SUPABASE_READER_DB_URL en .env.sync (node scripts/setup-obsidian-reader.mjs)')
  const { default: pg } = await import('pg')
  pg.types.setTypeParser(1082, (v) => v) // date → 'YYYY-MM-DD' sin zona horaria
  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
  await client.connect()
  try {
    await client.query('begin read only')
    const q = async (sql) => (await client.query(sql)).rows
    const datos = {
      households: await q('select id, name from households order by created_at'),
      members: await q('select id, household_id, name, is_active, is_person, created_at from members order by created_at'),
      categories: await q('select id, household_id, name, is_active, sort_order from categories order by sort_order'),
      months: await q('select id, household_id, year, month from months'),
      budgets: await q('select month_id, category_id, assigned_amount from month_budgets'),
      targets: await q('select month_id, member_id, target_amount from income_targets'),
      expenses: await q('select month_id, category_id, amount from expenses'),
      contributions: await q('select month_id, member_id, amount from contributions'),
    }
    await client.query('commit')
    return datos
  } finally {
    await client.end()
  }
}

// --------------------------- Formato ---------------------------

const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 })
const dinero = (n) => mxn.format(Number(n) || 0)
const porcentaje = (r) => (r == null ? '—' : `${Math.round(r * 100)} %`)
const SEMAFORO = { ok: '🟢', warn: '🟡', over: '🔴' }
const ym = (m) => `${m.year}-${String(m.month).padStart(2, '0')}`
const nombreMes = (m) => `${MESES[m.month - 1]} ${m.year}`

function ahoraMx(ahora) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(ahora).map((p) => [p.type, p.value]),
  )
  return { year: Number(partes.year), month: Number(partes.month), fecha: `${partes.year}-${partes.month}-${partes.day}`, hora: `${partes.hour}:${partes.minute}` }
}

// Corte de un mes con las mismas funciones que la app.
function corteDelMes(d, mes) {
  const de = (rows) => rows.filter((r) => r.month_id === mes.id)
  const expenses = de(d.expenses), contributions = de(d.contributions), budgets = de(d.budgets), targets = de(d.targets)
  return {
    totales: monthTotals({ expenses, contributions, budgets, targets }),
    sobres: categoryBalances({ categories: d.categories, expenses, budgets }),
    personas: memberProgress({ members: d.members, contributions, targets }),
  }
}

function cuerpoDelMes(mes, corte) {
  const { totales: t, sobres, personas } = corte
  const lineas = [
    '## Resumen',
    '',
    '| | Monto |',
    '|---|---:|',
    `| Recaudado | ${dinero(t.collected)} |`,
    `| Gastado | ${dinero(t.spent)} |`,
    `| **Restante** (Recaudado − Gastado) | **${dinero(t.remaining)}** |`,
    `| Presupuesto (suma de sobres) | ${dinero(t.budget)} |`,
    `| Meta de aportaciones | ${dinero(t.goal)} |`,
    '',
    '## Sobres',
    '',
    '| Sobre | Presupuesto | Gastado | Restante | % usado | |',
    '|---|---:|---:|---:|---:|:-:|',
    ...sobres.map((s) => `| ${celda(s.name)} | ${dinero(s.assigned)} | ${dinero(s.spent)} | ${dinero(s.remaining)} | ${porcentaje(s.pct)} | ${SEMAFORO[s.status]} |`),
    '',
    '🟢 menos de 80 % · 🟡 80–100 % · 🔴 excedido',
    '',
    '## Aportaciones',
    '',
    '| Aportante | Meta | Aportado | Falta | |',
    '|---|---:|---:|---:|:-:|',
    ...personas.map((p) => `| ${celda(p.name)}${p.is_person === false ? ' (fuente)' : ''} | ${dinero(p.target)} | ${dinero(p.contributed)} | ${dinero(Math.max(0, p.pending))} | ${p.isComplete ? '✅' : p.target > 0 ? '⏳' : '—'} |`),
  ]
  return lineas.join('\n')
}

function notaMesActual(mes, corte, ahora) {
  const t = corte.totales
  return frontmatter({
    tipo: 'gastos-familia',
    nota: 'mes actual',
    mes: ym(mes),
    corte: `${ahora.fecha} ${ahora.hora}`,
    recaudado: t.collected,
    gastado: t.spent,
    restante: t.remaining,
  }) + [
    `# Gastos de la familia · ${nombreMes(mes)}`,
    '',
    AVISO,
    '',
    `Corte: **${ahora.fecha} ${ahora.hora}** (hora de Pachuca). Si la fecha es vieja, la Mac no ha corrido la sincronización. · [[Familia]] · [[Evolución]]`,
    '',
    cuerpoDelMes(mes, corte),
    '',
  ].join('\n')
}

function notaHistorial(mes, corte) {
  const t = corte.totales
  return frontmatter({
    tipo: 'gastos-familia',
    nota: 'cierre de mes',
    mes: ym(mes),
    recaudado: t.collected,
    gastado: t.spent,
    restante: t.remaining,
  }) + [
    `# Cierre · ${nombreMes(mes)}`,
    '',
    AVISO,
    '',
    '[[Familia]] · [[Evolución]]',
    '',
    cuerpoDelMes(mes, corte),
    '',
  ].join('\n')
}

function notaEvolucion(filas, ahora) {
  const suma = (k) => filas.reduce((s, f) => s + Math.round(f[k] * 100), 0) / 100
  return frontmatter({ tipo: 'gastos-familia', nota: 'evolución', corte: `${ahora.fecha} ${ahora.hora}` }) + [
    '# Evolución de los gastos de la familia',
    '',
    AVISO,
    '',
    `Corte: **${ahora.fecha} ${ahora.hora}**. Restante = Recaudado − Gastado de cada mes (sin arrastre). · [[Familia]] · [[Mes actual]]`,
    '',
    '| Mes | Recaudado | Gastado | Restante | Sobres excedidos |',
    '|---|---:|---:|---:|---:|',
    ...filas.map((f) => `| ${f.enCurso ? `[[Mes actual\\|${f.etiqueta}]] (en curso)` : `[[${f.ym}\\|${f.etiqueta}]]`} | ${dinero(f.collected)} | ${dinero(f.spent)} | ${dinero(f.remaining)} | ${f.overCount} |`),
    `| **Total** | **${dinero(suma('collected'))}** | **${dinero(suma('spent'))}** | **${dinero(suma('remaining'))}** | |`,
    '',
  ].join('\n')
}

// --------------------------- Principal ---------------------------

export function generarNotas(d, ahoraDate) {
  const ahora = ahoraMx(ahoraDate)
  const indice = (m) => m.year * 12 + m.month
  const hogar = d.households[0]
  if (!hogar) throw new Error('No hay hogar en la base')
  const propios = (rows) => rows.filter((r) => !r.household_id || r.household_id === hogar.id)
  const datos = { ...d, members: propios(d.members), categories: propios(d.categories), months: propios(d.months) }

  const actual = indice(ahora)
  const meses = datos.months
    .filter((m) => indice(m) >= indice(DESDE) && indice(m) <= actual)
    .sort((a, b) => indice(a) - indice(b))
  const resumen = monthSummaries({ months: meses, expenses: d.expenses, contributions: d.contributions, budgets: d.budgets, targets: d.targets })

  const notas = []
  const mesActual = meses.find((m) => indice(m) === actual)
  if (mesActual) notas.push([`${CARPETA}/Mes actual.md`, notaMesActual(mesActual, corteDelMes(datos, mesActual), ahora)])
  for (const m of meses.filter((x) => indice(x) < actual)) {
    notas.push([`${CARPETA}/Historial/${ym(m)}.md`, notaHistorial(m, corteDelMes(datos, m))])
  }
  notas.push([`${CARPETA}/Evolución.md`, notaEvolucion(
    resumen.map((r) => ({ ...r, ym: ym(r), etiqueta: nombreMes(r), enCurso: indice(r) === actual })), ahora)])
  return notas
}

async function main() {
  const args = argumentos()
  await cargarEnv()
  let datos, ahora = new Date()
  if (args.prueba) {
    const p = JSON.parse(await readFile(args.prueba, 'utf8'))
    datos = p
    if (p.ahora) ahora = new Date(p.ahora)
  } else {
    datos = await cargarDeSupabase()
  }

  const boveda = rutaBoveda(args.boveda)
  await verificarAcceso(boveda)
  const resultados = {}
  for (const [ruta, contenido] of generarNotas(datos, ahora)) {
    const r = await escribirSiCambia(boveda, ruta, contenido)
    resultados[r] = (resultados[r] || 0) + 1
    if (r !== 'sin cambios') console.log(`  ${r}: ${ruta}`)
  }
  console.log(`[${new Date().toISOString()}] gastos-familia → Obsidian: ${Object.entries(resultados).map(([k, v]) => `${v} ${k}`).join(', ')}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(`[${new Date().toISOString()}] gastos-familia → Obsidian FALLÓ: ${e.message}`)
    process.exitCode = 1
  })
}

// Prepara la credencial de solo lectura para la sincronización con Obsidian
// sin que la contraseña pase por el chat ni por el repo:
//   1. genera una contraseña aleatoria,
//   2. escribe .env.sync (ignorado por git, permisos 600) con la conexión del
//      rol obsidian_reader (mismo host/pooler que SUPABASE_DB_URL de .env.local),
//   3. escribe supabase/obsidian_reader.local.sql (ignorado por git): el SQL de
//      supabase/obsidian_reader.sql con la contraseña puesta, para pegarlo en
//      Supabase → SQL Editor → Run.
// No se conecta a la base ni imprime la contraseña. Al terminar de correr el SQL:
//   node scripts/setup-obsidian-reader.mjs --verificar
// comprueba que el rol entra, lee y NO puede escribir; luego borra el .local.sql.

import { randomBytes } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PLACEHOLDER = 'CAMBIA_ESTA_CONTRASEÑA'

async function leerEnv(archivo) {
  const vars = {}
  const texto = await readFile(join(RAIZ, archivo), 'utf8')
  for (const linea of texto.split('\n')) {
    const m = linea.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/)
    if (m) vars[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return vars
}

// Misma conexión que la de admin, con el usuario obsidian_reader y otra contraseña.
// Pooler: "postgres.<ref>" → "obsidian_reader.<ref>". Directa: "postgres" → "obsidian_reader".
function urlLector(adminUrl, password) {
  const u = new URL(adminUrl)
  const usuario = decodeURIComponent(u.username)
  u.username = usuario.includes('.') ? `obsidian_reader.${usuario.split('.').slice(1).join('.')}` : 'obsidian_reader'
  u.password = encodeURIComponent(password)
  return u.toString()
}

async function preparar() {
  const { SUPABASE_DB_URL: adminUrl } = await leerEnv('.env.local')
  if (!adminUrl) throw new Error('Falta SUPABASE_DB_URL en .env.local (de ahí se toma el host)')
  const plantilla = await readFile(join(RAIZ, 'supabase/obsidian_reader.sql'), 'utf8')
  if (!plantilla.includes(PLACEHOLDER)) throw new Error('supabase/obsidian_reader.sql ya no tiene el marcador: no lo edites a mano')

  const password = randomBytes(24).toString('base64url') // sin comillas ni caracteres especiales
  await writeFile(join(RAIZ, 'supabase/obsidian_reader.local.sql'), plantilla.replaceAll(PLACEHOLDER, password), { mode: 0o600 })
  await writeFile(join(RAIZ, '.env.sync'),
    `# Generado por scripts/setup-obsidian-reader.mjs — no versionar\nSUPABASE_READER_DB_URL=${urlLector(adminUrl, password)}\n`,
    { mode: 0o600 })
  console.log('✓ .env.sync escrito (permisos 600)')
  console.log('✓ supabase/obsidian_reader.local.sql listo: pégalo en Supabase → SQL Editor → Run')
  console.log('  Después: node scripts/setup-obsidian-reader.mjs --verificar')
}

async function verificar() {
  const { SUPABASE_READER_DB_URL: url } = await leerEnv('.env.sync')
  const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
  await c.connect()
  let fallas = 0
  const check = (ok, msg) => { console.log(`${ok ? '✓' : '✗'} ${msg}`); if (!ok) fallas++ }
  try {
    const { rows: [ro] } = await c.query('show default_transaction_read_only')
    check(ro.default_transaction_read_only === 'on', `solo lectura por defecto (${ro.default_transaction_read_only})`)
    for (const t of ['months', 'expenses', 'contributions', 'month_budgets', 'income_targets', 'members', 'categories', 'households']) {
      const { rows: [n] } = await c.query(`select count(*)::int as n from ${t}`)
      check(n.n > 0, `lee ${t}: ${n.n} filas`)
    }
    try {
      await c.query('begin read write')
      await c.query("update households set name = name where false")
      await c.query('rollback')
      check(false, 'NO debería poder escribir')
    } catch {
      await c.query('rollback').catch(() => {})
      check(true, 'no puede escribir')
    }
  } finally {
    await c.end()
  }
  process.exitCode = fallas ? 1 : 0
}

await (process.argv.includes('--verificar') ? verificar() : preparar())

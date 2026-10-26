// Diagnóstico / verificación de la seguridad de las vistas (solo lectura).
// Comprueba, para cada vista:
//   1. reloptions incluye security_invoker=true
//   2. anon no tiene privilegios
//   3. con la anon key pública, la API REST no devuelve filas
//   4. como authenticated (lo que usa la app) sí devuelve filas
// Uso: node scripts/verify-views-security.mjs   (sale con código 1 si algo falla)
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
for (const line of readFileSync(resolve(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m) process.env[m[1]] ??= m[2]
}

const VISTAS = ['v_category_balances', 'v_month_summary', 'v_member_contributions']
const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } })
await client.connect()
let fallas = 0
const check = (ok, msg) => { console.log(`${ok ? 'OK   ' : 'FALLA'} ${msg}`); if (!ok) fallas++ }

try {
  await client.query('begin read only')
  for (const v of VISTAS) {
    const { rows: [r] } = await client.query(`select reloptions from pg_class where relname = $1 and relkind = 'v'`, [v])
    check((r?.reloptions || []).includes('security_invoker=true'), `${v}: security_invoker`)

    const { rows: g } = await client.query(
      `select privilege_type from information_schema.role_table_grants where table_name = $1 and grantee = 'anon'`, [v])
    check(g.length === 0, `${v}: anon sin privilegios${g.length ? ` (tiene ${g.map((x) => x.privilege_type).join(',')})` : ''}`)

    const res = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/${v}?select=month_id&limit=1`, {
      headers: { apikey: process.env.VITE_SUPABASE_ANON_KEY },
    })
    const body = await res.json().catch(() => null)
    check(!(Array.isArray(body) && body.length > 0), `${v}: anon por API → ${res.status}, ${Array.isArray(body) ? `${body.length} filas` : 'sin filas'}`)

    await client.query(`set local role authenticated`)
    const { rows: [n] } = await client.query(`select count(*)::int as n from ${v}`)
    await client.query(`reset role`)
    check(n.n > 0, `${v}: authenticated lee ${n.n} filas`)
  }
  await client.query('rollback')
} finally {
  await client.end()
}
process.exit(fallas ? 1 : 0)

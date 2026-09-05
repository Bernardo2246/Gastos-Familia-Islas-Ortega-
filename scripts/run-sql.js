// Ejecuta un archivo .sql contra la base de datos de Supabase usando
// conexión directa a Postgres (bypassa RLS). Requiere SUPABASE_DB_URL en
// .env.local. Uso: node scripts/run-sql.js supabase/migration_x.sql
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
for (const line of readFileSync(resolve(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m) process.env[m[1]] ??= m[2]
}

const file = process.argv[2]
if (!file) {
  console.error('Uso: node scripts/run-sql.js <archivo.sql>')
  process.exit(1)
}

const connectionString = process.env.SUPABASE_DB_URL
if (!connectionString) {
  console.error('Falta SUPABASE_DB_URL en .env.local')
  process.exit(1)
}

const sql = readFileSync(resolve(process.cwd(), file), 'utf8')

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } })
await client.connect()
try {
  await client.query(sql)
  console.log(`OK: ${file} ejecutado.`)
} finally {
  await client.end()
}

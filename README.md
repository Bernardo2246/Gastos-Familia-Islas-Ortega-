# Gastos Familia

PWA para llevar los gastos del hogar por **sobres**. Cada mes la familia sabe cuánto
se recaudó, cuánto se gastó y cuánto queda en cada sobre. La usa toda la familia
desde el iPhone con un login compartido y funciona sin conexión.

En producción: <https://gastos-familia.bernardoz72.workers.dev>

## Cómo funciona

- **Mes:** cada mes es su propio registro y clona los presupuestos y las metas del
  mes anterior (`create_month`).
- **Sobres:** 11 categorías con presupuesto asignado. El presupuesto del mes es la
  suma de los sobres; un trigger mantiene `months.total_budget`.
- **Aportaciones:** cada persona (o fuente, como Renta, con `is_person = false`)
  tiene su meta mensual. Cualquiera puede registrar la aportación de cualquiera.
- **Restante del mes = Recaudado − Gastado.** Se mide contra el dinero que ya
  entró, no contra el presupuesto.
- **Semáforo por sobre:** verde < 80 %, ámbar 80–100 %, rojo > 100 %.

Todas las fórmulas están en [`src/lib/finance.js`](src/lib/finance.js) y tienen
pruebas en `finance.test.js`. Inicio, Categorías, Aportaciones, Historial, Análisis
y la sincronización con Obsidian leen de ahí: si dos lugares muestran "el mismo
total", salen de la misma función. No reescribas una fórmula en una pantalla.

## Stack

- React 19 + Vite (JavaScript), React Router, PWA (`vite-plugin-pwa`).
- Supabase: Postgres + Auth + Realtime. Esquema en
  [`supabase/schema.sql`](supabase/schema.sql).
- Offline: cola de mutaciones en IndexedDB ([`src/lib/db.js`](src/lib/db.js),
  [`src/lib/sync.js`](src/lib/sync.js)). Altas, ediciones y borrados pasan por
  ella; cada fila trae un id generado en el cliente, así que subirla es idempotente.
- Hosting: Cloudflare Workers, solo con assets estáticos (`wrangler.jsonc`).
- Pruebas: Vitest. Lint: oxlint.

## Correr en local

Node no está en el PATH de las herramientas; `dev.sh` lo agrega.

```bash
cp .env.example .env.local   # VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm ci                       # nunca npm install: regenera el lockfile y sube versiones
./dev.sh                     # = npm run dev → http://localhost:5173
npm test                     # Vitest (lib/finance.js)
npm run lint
```

**Vista previa sin login:** con `npm run dev`, <http://localhost:5173/__preview>
muestra la app completa con datos falsos y extremos (11 sobres, montos de
millones, notas larguísimas, negativos). `?offline` simula estar sin red y
`?graficas` muestra las gráficas de Análisis. Solo existe en desarrollo y no
llega al build. Historial y Análisis consultan Supabase, así que ahí salen vacíos.

## Deploy

```bash
npm run deploy               # build + wrangler deploy
```

Después de cada deploy:

1. Comprueba que el bundle servido es el nuevo (`curl -s <url>/ | grep assets/index-`)
   y que `index.html` y `sw.js` siguen con `cache-control: no-cache`
   (`curl -sI <url>/sw.js`).
2. En el iPhone: **Ajustes → Versión** muestra la fecha del build y el commit. Si
   la fecha es vieja, cierra la app por completo y vuelve a abrirla. Si el commit
   dice `+cambios`, se desplegó código sin commit.

### Gotchas de caché

- `public/_headers` obliga a revalidar `index.html`, `sw.js`, `registerSW.js` y el
  manifest; los `assets/` llevan hash y se cachean un año. **No lo quites:** sin él,
  el iPhone se quedaba con la versión vieja después de un deploy.
- Arreglar los headers no purga las copias que ya quedaron en el borde: hay que
  esperar a que expiren.

## Base de datos

- `node scripts/run-sql.js supabase/<archivo>.sql` corre SQL directo contra la base
  con `SUPABASE_DB_URL` de `.env.local`. Esa conexión **se salta el RLS**: úsala
  solo para migraciones.
- Las correcciones de datos van como script con tres pasos: diagnóstico,
  corrección y verificación.
- RLS: un solo hogar y un login compartido. La política `auth_all` da todo a
  `authenticated`; `anon` no ve nada.
- **Toda vista lleva `security_invoker = true`.** Sin eso se ejecuta como su dueño,
  se salta el RLS y queda legible con la anon key pública (que va en el bundle).
  `node scripts/verify-views-security.mjs` lo comprueba.
- **Realtime:** con RLS activo, el `old` de un DELETE solo trae el id, así que un
  filtro por `month_id` nunca coincide y el evento no llega. Por eso la app escucha
  INSERT y UPDATE filtrados por mes, y DELETE sin filtro, quitando la fila si su id
  está en pantalla. `REPLICA IDENTITY FULL` no lo resuelve mientras haya RLS.

## Sincronización con Obsidian

`scripts/sync-obsidian.mjs` escribe la carpeta `Gastos Familia/` de la bóveda
"Segundo Cerebro":

- `Mes actual.md`: corte con fecha y hora, totales, sobres y aportaciones.
- `Evolución.md`: un renglón por mes desde enero 2026.
- `Historial/AAAA-MM.md`: el cierre de cada mes terminado.

Usa las mismas funciones de `src/lib/finance.js` y el módulo genérico
`../Finanzas-Personales/scripts/obsidian/boveda.mjs`, importado por ruta relativa.
Si mueves cualquiera de los dos repos, actualiza esa ruta. Lee con el rol
`obsidian_reader`, que solo tiene SELECT y abre una transacción read only.

Configuración, una sola vez:

```bash
node scripts/setup-obsidian-reader.mjs
```

Ese comando genera `.env.sync` y `supabase/obsidian_reader.local.sql`, los dos
ignorados por git. Pega el `.local.sql` en Supabase → SQL Editor → Run y luego:

```bash
node scripts/setup-obsidian-reader.mjs --verificar
```

Si la verificación pasa, borra el `.local.sql`.

Para instalar el LaunchAgent (cada 30 min y al iniciar sesión):

```bash
cp scripts/launchd/com.bernardo.gastos-familia-obsidian.plist ~/Library/LaunchAgents/
```

```bash
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.bernardo.gastos-familia-obsidian.plist
```

Para correrlo ya:

```bash
launchctl kickstart gui/$(id -u)/com.bernardo.gastos-familia-obsidian
```

El log está en `~/Library/Logs/gastos-familia-obsidian.log`. Para desinstalarlo:

```bash
launchctl bootout gui/$(id -u)/com.bernardo.gastos-familia-obsidian
```

Para probar sin tocar la bóveda: `node scripts/sync-obsidian.mjs --boveda <carpeta>`.
También puedes agregar `--prueba <volcado.json>` para no leer de Supabase.

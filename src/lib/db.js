import { openDB } from 'idb'

const DB_NAME = 'gastos-familia'
const DB_VERSION = 1

const dbp = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('queue')) {
      // Cola de mutaciones pendientes de subir a Supabase.
      db.createObjectStore('queue', { keyPath: 'qid' })
    }
    if (!db.objectStoreNames.contains('cache')) {
      // Snapshot de datos para lectura offline (clave libre).
      db.createObjectStore('cache')
    }
  },
})

// ---------- Cola de sincronización ----------

// mutation: { table: 'expenses'|'contributions', row: {...con id...} }   → upsert
//       o   { table: 'expenses'|'contributions', op: 'delete', id }       → borrado
export async function enqueue(mutation) {
  const db = await dbp
  const item = {
    qid: crypto.randomUUID(),
    createdAt: Date.now(),
    ...mutation,
  }
  await db.put('queue', item)
  return item
}

export async function getQueue() {
  const db = await dbp
  const all = await db.getAll('queue')
  return all.sort((a, b) => a.createdAt - b.createdAt)
}

export async function dequeue(qid) {
  const db = await dbp
  await db.delete('queue', qid)
}

// Quita de la cola las altas pendientes de una fila (se borró antes de subirse:
// si se quedaran, la cola la volvería a crear al reconectar).
export async function dropQueuedUpserts(table, id) {
  const db = await dbp
  const all = await db.getAll('queue')
  for (const item of all) {
    if (item.table === table && item.op !== 'delete' && item.row?.id === id) await db.delete('queue', item.qid)
  }
}

// Ids con borrado pendiente de subir, para no volver a mostrarlos al recargar.
export async function pendingDeleteIds(table) {
  const db = await dbp
  const all = await db.getAll('queue')
  return new Set(all.filter((i) => i.table === table && i.op === 'delete').map((i) => i.id))
}

export async function queueCount() {
  const db = await dbp
  return db.count('queue')
}

// ---------- Cache offline ----------

export async function saveCache(key, value) {
  const db = await dbp
  await db.put('cache', value, key)
}

export async function readCache(key) {
  const db = await dbp
  return db.get('cache', key)
}

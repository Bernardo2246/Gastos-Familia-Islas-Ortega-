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

// mutation: { table: 'expenses'|'contributions', row: {...con id...} }
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

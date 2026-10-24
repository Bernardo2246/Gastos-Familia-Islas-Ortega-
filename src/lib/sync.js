import { supabase } from './supabase'
import { getQueue, dequeue } from './db'

let flushing = false

// Sube en orden las mutaciones pendientes. Cada fila trae su id generado en
// cliente, así que el upsert es idempotente (last-write-wins por fila), y el
// borrado también (borrar un id que ya no existe no es error).
// Devuelve cuántas se subieron con éxito.
export async function flushQueue() {
  if (flushing || !navigator.onLine) return 0
  flushing = true
  let sent = 0
  try {
    const items = await getQueue()
    for (const item of items) {
      const { error } = item.op === 'delete'
        ? await supabase.from(item.table).delete().eq('id', item.id)
        : await supabase.from(item.table).upsert(item.row, { onConflict: 'id' })
      if (error) {
        // Si falla la red, paramos y reintentamos después.
        // Si es un error de datos, también paramos para no perder orden.
        console.warn('Error al sincronizar, se reintentará:', error.message)
        break
      }
      await dequeue(item.qid)
      sent++
    }
  } finally {
    flushing = false
  }
  return sent
}

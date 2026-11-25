// src/pages/Dashboard/review/reviewBatch.js — "Confirmar los N" de "Por revisar".
// Una sola transacción para todos los movimientos (y una sola recarga del
// estado después), en vez de N escrituras y N renders. Sin IndexedDB (modo
// de respaldo en localStorage) se escribe uno por uno.
import { getDB, dbAdd } from '../../../core/db/index.js'

/** @param {Array<{ store: 'incomes'|'expenses', record: any }>} writes */
export async function putMovements(writes, db = null) {
  const list = (writes || []).filter(w => w && w.record)
  if (!list.length) return
  const conn = db || await getDB()
  if (!conn) { for (const w of list) await dbAdd(w.store, w.record); return }
  const tx = conn.transaction([...new Set(list.map(w => w.store))], 'readwrite')
  await Promise.all([...list.map(w => tx.objectStore(w.store).put(w.record)), tx.done])
}

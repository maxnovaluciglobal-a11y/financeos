// src/core/db/migrations.js — pasos de esquema versionados para IndexedDB.
//
// Cada entrada de MIGRATIONS es un paso irreversible: una vez que un usuario
// pasó por él, no se edita (cambiar un paso ya shippeado no re-ejecuta para
// quien ya está en esa versión). Para cambiar la forma de datos ya guardados,
// agregar un paso NUEVO con la versión siguiente.
//
// `migrate(db, transaction, oldVersion)` corre dentro de la transacción
// 'versionchange' que abre idb — cubre TODOS los object stores, así que sirve
// tanto para crear stores (db.createObjectStore) como para transformar datos
// ya existentes (transaction.objectStore('x').getAll()/put()). Si `migrate`
// tira, IndexedDB aborta toda la operación: la base queda en oldVersion con
// los datos tal como estaban, no a medio migrar (garantía del spec, no de
// este código — ver migrations.test.js para la prueba).
// Id de la foto previa a la unificación de Suscripciones/Deudas en fijos (v4).
export const PRE_RECURRING_SNAPSHOT_ID = 'pre-recurring-v4'

export const MIGRATIONS = [
  {
    version: 1,
    migrate(db) {
      if (!db.objectStoreNames.contains('incomes')) {
        const s = db.createObjectStore('incomes', { keyPath: 'id' })
        s.createIndex('date', 'date'); s.createIndex('category', 'category')
      }
      if (!db.objectStoreNames.contains('expenses')) {
        const s = db.createObjectStore('expenses', { keyPath: 'id' })
        s.createIndex('date', 'date'); s.createIndex('category', 'category')
      }
      if (!db.objectStoreNames.contains('budgets')) db.createObjectStore('budgets', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('debts'))   db.createObjectStore('debts',   { keyPath: 'id' })
      if (!db.objectStoreNames.contains('goals'))   db.createObjectStore('goals',   { keyPath: 'id' })
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings')
    },
  },
  {
    version: 2,
    migrate(db) {
      if (!db.objectStoreNames.contains('subscriptions')) db.createObjectStore('subscriptions', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('importBatches')) db.createObjectStore('importBatches', { keyPath: 'id' })
    },
  },
  {
    // T14 · bloqueo con PIN/biometría. Store aparte (clave fuera de línea,
    // como 'settings') para el hash del PIN, el id de la credencial WebAuthn y
    // el contador de intentos. NO va en 'settings' a propósito: settings viaja
    // en el respaldo JSON y en el sync cifrado, y restaurar un respaldo no
    // debe re-importar un PIN (ni "olvidé mi PIN" debe poder deshacerse
    // bajando la nube). exportAllData/importAllData nombran sus stores uno por
    // uno, así que 'security' queda fuera de los dos (ver db/index.test.js).
    version: 3,
    migrate(db) {
      if (!db.objectStoreNames.contains('security')) db.createObjectStore('security')
    },
  },
  {
    // Movimientos fijos (08-oct-2026). 'recurring' guarda las REGLAS (las
    // ocurrencias se calculan, ver utils/recurring.js); viaja en el respaldo y
    // en el sync. 'backups' guarda copias locales de seguridad del dispositivo
    // (no viaja en el respaldo ni en el sync: duplicaría el tamaño).
    //
    // Antes de que la app convierta Suscripciones y Deudas en reglas
    // (reconcileRecurringSources, al hidratar), este paso deja una foto completa
    // de los datos en 'backups' con id PRE_RECURRING_SNAPSHOT_ID, dentro de la
    // MISMA transacción de upgrade: o queda la foto y la versión nueva, o no
    // queda nada (la base sigue en v3, intacta). Restaurar: restoreSnapshot().
    // Una instalación nueva (oldVersion 0) no tiene nada que fotografiar.
    version: 4,
    async migrate(db, transaction, oldVersion) {
      if (!db.objectStoreNames.contains('recurring')) db.createObjectStore('recurring', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('backups'))   db.createObjectStore('backups',   { keyPath: 'id' })
      if (!oldVersion || !transaction) return
      const has = (n) => db.objectStoreNames.contains(n)
      const all = (n) => (has(n) ? transaction.objectStore(n).getAll() : Promise.resolve([]))
      const [incomes, expenses, budgets, debts, goals, subscriptions, importBatches, settings] = await Promise.all([
        all('incomes'), all('expenses'), all('budgets'), all('debts'), all('goals'), all('subscriptions'), all('importBatches'),
        has('settings') ? transaction.objectStore('settings').get('main') : Promise.resolve(null),
      ])
      await transaction.objectStore('backups').put({
        id: PRE_RECURRING_SNAPSHOT_ID,
        reason: 'pre-recurring-migration',
        fromVersion: oldVersion,
        createdAt: new Date().toISOString(),
        data: { incomes, expenses, budgets, debts, goals, subscriptions, importBatches, settings: settings || null },
      })
    },
  },
]

// Única fuente de verdad de la versión: quien agrega un paso a MIGRATIONS
// bumpea DB_VERSION automáticamente. Elimina la clase de bug "se subió
// DB_VERSION a mano sin escribir la migración" — ya no hay dos lugares que
// puedan desincronizarse.
export const DB_VERSION = Math.max(...MIGRATIONS.map(m => m.version))

// Motor genérico, separado de la lista real de arriba para poder testearlo
// en aislamiento con pasos de prueba (ver migrations.test.js) sin acoplar
// esos tests a la forma actual de los datos de FinanceOS.
//
// Un paso puede ser async (lee/escribe datos con `transaction`): los pasos
// siguientes esperan a que termine, y si falla se aborta la transacción de
// upgrade — mismo resultado que un paso síncrono que tira: la base queda en
// oldVersion, sin cambios. Dentro de un paso async solo se puede esperar
// operaciones de ESA transacción (si se espera otra cosa, IndexedDB la cierra).
export function runMigrationSteps(db, oldVersion, newVersion, transaction, steps) {
  let chain = null
  for (const step of steps) {
    if (!(oldVersion < step.version && step.version <= newVersion)) continue
    if (chain) chain = chain.then(() => step.migrate(db, transaction, oldVersion))
    else {
      const r = step.migrate(db, transaction, oldVersion)
      if (r && typeof r.then === 'function') chain = r
    }
  }
  if (!chain) return undefined
  return chain.catch((err) => {
    console.error('[FinanceOS] migración de IndexedDB fallida, se aborta:', err)
    try { transaction?.done?.catch?.(() => {}) } catch {}
    try { transaction?.abort() } catch {}
  })
}

export function runMigrations(db, oldVersion, newVersion, transaction) {
  return runMigrationSteps(db, oldVersion, newVersion, transaction, MIGRATIONS)
}

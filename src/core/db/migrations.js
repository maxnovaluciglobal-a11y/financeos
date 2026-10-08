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
]

// Única fuente de verdad de la versión: quien agrega un paso a MIGRATIONS
// bumpea DB_VERSION automáticamente. Elimina la clase de bug "se subió
// DB_VERSION a mano sin escribir la migración" — ya no hay dos lugares que
// puedan desincronizarse.
export const DB_VERSION = Math.max(...MIGRATIONS.map(m => m.version))

// Motor genérico, separado de la lista real de arriba para poder testearlo
// en aislamiento con pasos de prueba (ver migrations.test.js) sin acoplar
// esos tests a la forma actual de los datos de FinanceOS.
export function runMigrationSteps(db, oldVersion, newVersion, transaction, steps) {
  for (const step of steps) {
    if (oldVersion < step.version && step.version <= newVersion) {
      step.migrate(db, transaction, oldVersion)
    }
  }
}

export function runMigrations(db, oldVersion, newVersion, transaction) {
  runMigrationSteps(db, oldVersion, newVersion, transaction, MIGRATIONS)
}

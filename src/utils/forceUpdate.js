// src/utils/forceUpdate.js — ING-13: la base local es de una versión más nueva
// que el código que sirvió el service worker (VersionError al abrir). Recargar
// no alcanza porque el SW vuelve a servir el código viejo: se lo desregistra,
// se vacían sus cachés y se recarga desde la red. Los datos (IndexedDB) no se tocan.
export function isNewerDbError(err) {
  return err?.name === 'VersionError' || err?.cause?.name === 'VersionError'
}

export async function forceAppUpdate({ sw = globalThis.navigator?.serviceWorker, cacheStorage = globalThis.caches, reload = () => globalThis.location?.reload() } = {}) {
  try {
    const regs = (await sw?.getRegistrations?.()) || []
    await Promise.all(regs.map(r => r.unregister().catch(() => false)))
  } catch { /* sin SW: solo recargar */ }
  try {
    const keys = (await cacheStorage?.keys?.()) || []
    await Promise.all(keys.map(k => cacheStorage.delete(k)))
  } catch { /* sin Cache Storage: solo recargar */ }
  reload()
}

// src/native/saveFile.js — guardar un archivo que genera la app (respaldo, CSV,
// PDF) de forma que funcione también dentro de la app nativa (AND-2).
//
// En la web alcanza con <a download>. En la app nativa NO: la WebView de
// Android ignora esas descargas (Capacitor no registra un DownloadListener) y
// la de iOS tampoco guarda nada. Antes la app decía "respaldo creado" sin que
// existiera ningún archivo. Ahora:
//
//   Android  plugin local MoyiqNative.saveDocument: el "Guardar como" del
//            sistema (Descargas, Drive…). Se resuelve recién cuando el archivo
//            quedó escrito; si la persona cierra el selector, 'cancelled'.
//   iOS      Filesystem (Cache) + hoja de compartir (Share), que trae
//            "Guardar en Archivos". Cerrar la hoja = 'cancelled'.
//   (Android sin MoyiqNative: lo mismo que iOS.)
//
// saveBlob() devuelve 'saved' o 'cancelled' y LANZA si falló. Quien llama
// marca "Último respaldo" o muestra "listo" solo con 'saved'.
// Los plugins se piden por nombre (registerPlugin): su código nativo vive en
// el repo privado moyiq-ios-capacitor; @capacitor/core solo se descarga dentro
// de la app.
import { isNativeApp, nativePlatform } from './platform.js'

export const SAVED = 'saved'
export const CANCELLED = 'cancelled'

// La hoja de compartir de iOS y el selector de Android avisan "cancelado" con
// un rechazo cuyo texto incluye cancel (Share: "Share canceled").
export function isCancel(err) {
  return /cancel/i.test(String(err?.message || err || ''))
}

// base64 de un Blob, sin el prefijo data: (lo que esperan los plugins).
export async function blobToBase64(blob) {
  const buf = new Uint8Array(await blob.arrayBuffer())
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < buf.length; i += CHUNK) bin += String.fromCharCode.apply(null, buf.subarray(i, i + CHUNK))
  return btoa(bin)
}

// Solo letras, números, punto, guion y guion bajo: el nombre viaja a un
// selector del sistema y a una ruta de la caché.
export function safeFileName(name) {
  const n = String(name || 'moyiq').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '')
  return n || 'moyiq'
}

function downloadInBrowser(blob, filename, doc) {
  const url = URL.createObjectURL(blob)
  const a = doc.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  doc.body.appendChild(a)
  a.click()
  a.remove()
  // Revocar en el mismo tick puede cortar la descarga en Safari.
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
  return SAVED
}

async function plugins() {
  const { registerPlugin } = await import('@capacitor/core')
  return {
    MoyiqNative: registerPlugin('MoyiqNative'),
    Filesystem: registerPlugin('Filesystem'),
    Share: registerPlugin('Share'),
  }
}

function hasPlugin(win, name) {
  try { return win?.Capacitor?.isPluginAvailable?.(name) === true } catch { return false }
}

async function shareFromCache(p, blob, name, title) {
  const data = await blobToBase64(blob)
  const { uri } = await p.Filesystem.writeFile({ path: name, data, directory: 'CACHE' })
  try {
    await p.Share.share({ title: title || name, files: [uri], dialogTitle: title || name })
    return SAVED
  } catch (e) {
    if (isCancel(e)) return CANCELLED
    throw e
  }
}

/**
 * Guarda `blob` como `filename`. → 'saved' | 'cancelled'. Lanza si falló.
 * opts.title: título de la hoja de compartir (iOS).
 */
export async function saveBlob(blob, filename, opts = {}) {
  const win = opts.win || globalThis
  const name = safeFileName(filename)
  if (!isNativeApp(win)) return downloadInBrowser(blob, name, win.document)
  const p = await (opts.plugins ? Promise.resolve(opts.plugins) : plugins())
  if (nativePlatform(win) === 'android' && (opts.plugins || hasPlugin(win, 'MoyiqNative'))) {
    const data = await blobToBase64(blob)
    const mimeType = (blob.type || 'application/octet-stream').split(';')[0]
    try {
      const r = await p.MoyiqNative.saveDocument({ filename: name, mimeType, data })
      return r?.saved ? SAVED : CANCELLED
    } catch (e) {
      // Sin selector de documentos en el equipo: la hoja de compartir.
      if (e?.code !== 'UNAVAILABLE') throw e
    }
  }
  return shareFromCache(p, blob, name, opts.title)
}

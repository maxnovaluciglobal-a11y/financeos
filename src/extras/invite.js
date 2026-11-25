// src/extras/invite.js — "Invita a alguien" (24-nov-2026): compartir moyiq con
// un mensaje simple y el enlace público. SIN recompensas, cupones ni Stripe
// (el programa de referidos espera una decisión de Walter).
//   App de tienda  hoja de compartir del sistema (@capacitor/share, ya en el repo nativo)
//   Web            Web Share API; si no hay, copia el enlace al portapapeles
// Devuelve 'shared' | 'copied' | 'cancelled' | 'failed'. Nunca lanza.
//
// Enlace (25-nov-2026, decisión de Walter): la web comparte la home
// (https://moyiq.app). La app de tienda (nativa o compilada para tiendas)
// comparte https://moyiq.app/app, una página de la landing sin precios ni
// planes (financeos-landing/app.html): la app de tienda no puede llevar a
// precios fuera de la tienda (storePolicy.js).
import { isNativeApp } from '../native/platform.js'
import { STORE_BUILD } from '../native/storeBuild.js'

export const INVITE_URL = 'https://moyiq.app'
export const STORE_INVITE_URL = 'https://moyiq.app/app'

/** Enlace a compartir: el sin precios en la app de tienda, la home en la web. */
export function inviteUrl(win = globalThis, storeBuild = STORE_BUILD) {
  return storeBuild || isNativeApp(win) ? STORE_INVITE_URL : INVITE_URL
}
const isCancel = (e) => e?.name === 'AbortError' || /cancel/i.test(String(e?.message || e || ''))

/** @param {{ title: string, text: string }} msg */
export async function shareInvite({ title, text }, win = globalThis, storeBuild = STORE_BUILD) {
  const url = inviteUrl(win, storeBuild)
  const data = { title, text, url }
  try {
    if (isNativeApp(win) && win.Capacitor?.isPluginAvailable?.('Share')) {
      const { registerPlugin } = await import('@capacitor/core')
      await registerPlugin('Share').share({ ...data, dialogTitle: title })
      return 'shared'
    }
    const nav = win.navigator
    if (nav?.share && (!nav.canShare || nav.canShare(data))) {
      await nav.share(data)
      return 'shared'
    }
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(`${text} ${url}`)
      return 'copied'
    }
    return 'failed'
  } catch (e) {
    return isCancel(e) ? 'cancelled' : 'failed'
  }
}

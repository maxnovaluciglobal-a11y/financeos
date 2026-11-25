// src/extras/invite.js — "Invita a alguien" (24-nov-2026): compartir moyiq con
// un mensaje simple y el enlace público. SIN recompensas, cupones ni Stripe
// (el programa de referidos espera una decisión de Walter).
//   App de tienda  hoja de compartir del sistema (@capacitor/share, ya en el repo nativo)
//   Web            Web Share API; si no hay, copia el enlace al portapapeles
// Devuelve 'shared' | 'copied' | 'cancelled' | 'failed'. Nunca lanza.
import { isNativeApp } from '../native/platform.js'

export const INVITE_URL = 'https://moyiq.app'
const isCancel = (e) => e?.name === 'AbortError' || /cancel/i.test(String(e?.message || e || ''))

/** @param {{ title: string, text: string }} msg */
export async function shareInvite({ title, text }, win = globalThis) {
  const data = { title, text, url: INVITE_URL }
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
      await nav.clipboard.writeText(`${text} ${INVITE_URL}`)
      return 'copied'
    }
    return 'failed'
  } catch (e) {
    return isCancel(e) ? 'cancelled' : 'failed'
  }
}

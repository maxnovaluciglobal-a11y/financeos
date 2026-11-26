// src/native/storePolicy.js — qué se puede vender y con qué se puede entrar
// según dónde corre la app.
//
// Pagos (App Store 3.1.1 y 3.1.3(b); Google Play, política de pagos §2 y §4):
// dentro de una app de tienda, Pro solo se puede vender con la compra de la
// tienda (StoreKit / Play Billing). Mientras esa compra no exista (RevenueCat,
// ver NATIVO-CAPACITOR.md), la app nativa NO muestra precios, botones ni
// enlaces al checkout de Stripe: solo un texto neutro sin enlace.
// `iapReady` se enciende el día que la compra de la tienda esté integrada.
//
// Inicio de sesión (App Store 4.8): si la app de iOS ofrece Google, tiene que
// ofrecer también un servicio equivalente (Sign in with Apple). Hasta que Apple
// esté configurado en Supabase (`appleSignIn`), iOS entra solo con correo y
// contraseña, que no exige nada más.
//
// Inversiones (decisión del 23-nov-2026, D1 de la revisión pre-tiendas): la v1
// de Google Play y App Store sale sin Inversiones; vuelve en una v2. Con
// `investments` en false la app nativa no muestra la sección en ningún lado
// (navegación, Panorama, Patrimonio, Ajustes, enlaces ?open=invest-*, Ayuda) y
// no le pide nada al servidor de Inversiones. La web y la PWA no cambian.

import { isNativeApp, nativePlatform } from './platform.js'

export const NATIVE_FLAGS = Object.freeze({
  iapReady: false,     // compra de la tienda integrada (RevenueCat)
  appleSignIn: false,  // proveedor Apple configurado en Supabase Auth
  investments: true,   // sección Inversiones en la app de tienda (Walter, 26-nov-2026: se enciende desde la 1.0.6)
})

/** ¿Se puede mostrar el checkout de Stripe (precio, botón, enlace)? */
export function webCheckoutAllowed(platform) {
  return platform === 'web'
}

/** ¿Se puede mostrar la compra de la tienda? */
export function storePurchaseAllowed(platform, flags = NATIVE_FLAGS) {
  return platform !== 'web' && flags.iapReady === true
}

/** Proveedores de inicio de sesión externos a mostrar, en orden. */
export function oauthProviders(platform, flags = NATIVE_FLAGS) {
  if (platform === 'ios') return flags.appleSignIn ? ['apple', 'google'] : []
  if (platform === 'android') return flags.appleSignIn ? ['google', 'apple'] : ['google']
  return ['google']
}

// Atajo para los componentes: ¿esta instancia puede mostrar el checkout web?
export function canShowWebCheckout(win = globalThis) {
  return webCheckoutAllowed(nativePlatform(win))
}

/** ¿Esta plataforma muestra Inversiones? La web siempre; la app nativa, solo con el flag. */
export function investmentsAllowed(platform, flags = NATIVE_FLAGS) {
  return platform === 'web' || flags.investments === true
}

// Atajo para los componentes. Cualquier app nativa cuenta como nativa aunque
// Capacitor no diga la plataforma (nativePlatform cae a 'web' en ese caso).
export function canShowInvestments(win = globalThis, flags = NATIVE_FLAGS) {
  return isNativeApp(win) ? flags.investments === true : true
}

// Páginas de Inversiones: en la app de tienda sin Inversiones, un enlace o una
// página guardada que apunte a ellas abre Inicio.
export const INVEST_PAGES = Object.freeze(['investments', 'investAsset'])
export function storePage(page, win = globalThis) {
  return INVEST_PAGES.includes(page) && !canShowInvestments(win) ? 'dashboard' : page
}

// La etiqueta PRO es publicidad de un plan que la app de tienda no vende
// (NAT-1): sin compra de la tienda no se muestra.
export function canShowProMarketing(win = globalThis, flags = NATIVE_FLAGS) {
  if (!isNativeApp(win)) return true
  return storePurchaseAllowed(nativePlatform(win), flags)
}

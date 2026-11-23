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

import { nativePlatform } from './platform.js'

export const NATIVE_FLAGS = Object.freeze({
  iapReady: false,     // compra de la tienda integrada (RevenueCat)
  appleSignIn: false,  // proveedor Apple configurado en Supabase Auth
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

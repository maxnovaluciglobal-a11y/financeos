// src/native/storeBuild.js — ¿es la compilación para las tiendas? (AND-5, ronda 3)
//
// La app de tienda empaqueta la misma PWA, pero compilada con
// MOYIQ_STORE_BUILD=1 (lo pone el script build-web del repo nativo). Con eso,
// vite.config.js define __STORE_BUILD__ = true y Rollup elimina del bundle lo
// que la app de tienda nunca muestra: los Payment Links y el portal de Stripe,
// y las páginas de Inversiones (que en la app de tienda están ocultas). En la
// web y en los tests vale false y todo sigue igual.
/* global __STORE_BUILD__ */
export const STORE_BUILD = typeof __STORE_BUILD__ !== 'undefined' && __STORE_BUILD__ === true

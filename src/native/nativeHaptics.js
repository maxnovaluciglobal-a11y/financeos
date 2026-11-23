// src/native/nativeHaptics.js — hápticos nativos (Taptic Engine en iPhone,
// vibrador en Android) cuando la app corre en Capacitor. native/bridge.js
// instala la implementación al arrancar; utils/haptics.js la usa si existe y,
// si no, sigue con navigator.vibrate como en la PWA.
let impl = null

export function setNativeHaptics(next) { impl = next || null }
export function nativeHaptics() { return impl }

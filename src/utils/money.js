// src/utils/money.js — lógica pura de "ocultar montos" (T13), sin React.
// La usan Money.jsx (componente + hook) y los tests.

export const MONEY_MASK = '•••'

// Devuelve el string tal cual o la máscara. Nunca deja pasar dígitos cuando
// hidden es true, venga lo que venga (número, string formateado, null).
export function maskMoney(hidden, s) {
  return hidden ? MONEY_MASK : s
}

// Ajustes que son de ESTE dispositivo y no viajan en respaldos ni en el sync:
// ocultar montos es una preferencia de privacidad de la pantalla que se tiene
// en la mano (un teléfono en el metro), no de la cuenta. Restaurar un respaldo
// o bajar la nube no debe prenderla ni apagarla en otro equipo.
export const DEVICE_ONLY_SETTINGS = ['hideAmounts']

export function stripDeviceOnlySettings(settings) {
  if (!settings || typeof settings !== 'object') return settings
  const out = { ...settings }
  for (const k of DEVICE_ONLY_SETTINGS) delete out[k]
  return out
}

// Al importar (respaldo o sync): toma los ajustes entrantes, pero conserva los
// valores locales de los ajustes de dispositivo.
export function mergeIncomingSettings(incoming, local) {
  const out = stripDeviceOnlySettings(incoming)
  for (const k of DEVICE_ONLY_SETTINGS) {
    if (local && local[k] !== undefined) out[k] = local[k]
  }
  return out
}

// src/core/deviceOwner.js
// A qué cuenta pertenecen los datos de ESTE dispositivo (18-oct-2026).
//
// MOY IQ guarda las finanzas solo en el dispositivo (IndexedDB) y la licencia
// o el "Starter" elegido también en el navegador (licenseValidator.js). Nada
// de eso estaba atado a una cuenta: si en el mismo navegador entraba otra
// cuenta, veía los movimientos, la configuración y hasta el plan Pro de la
// anterior (lo detectó Walter al crear la cuenta de empresa). Desde ahora el
// dispositivo recuerda el id de la cuenta dueña y, si entra otra, App.jsx
// muestra DeviceSwitch antes de cargar la app: empezar de cero (borra lo
// local) o cerrar sesión. Nunca se borra nada sin que la persona lo elija.

import { wipeLocalDevice } from './db/index.js'
import { clearLicense, clearStarterAck } from '../utils/licenseValidator.js'

const OWNER_KEY = 'fnos_device_owner'

export function readDeviceOwner() {
  try { return JSON.parse(localStorage.getItem(OWNER_KEY) || 'null') } catch { return null }
}

export function writeDeviceOwner(user) {
  if (!user?.id) return
  try { localStorage.setItem(OWNER_KEY, JSON.stringify({ uid: user.id, email: user.email || null, at: Date.now() })) } catch {}
}

// Decisión pura (testeada en deviceOwner.test.js):
// - 'same'  → el dispositivo ya es de esta cuenta.
// - 'adopt' → no hay dueño registrado y nada indica que sea de otra cuenta:
//             se registra esta (usuarios que ya usaban la app antes del cambio).
// - 'other' → los datos son de otra cuenta.
// Para dispositivos sin dueño registrado, la única señal fuerte es una
// licencia Pro guardada que en el servidor no pertenece a esta cuenta.
export function decideOwnership({ owner, userId, deviceLicenseKey, serverEntitlement }) {
  if (owner?.uid) return owner.uid === userId ? 'same' : 'other'
  if (deviceLicenseKey) {
    const mine = serverEntitlement?.plan === 'pro' && serverEntitlement?.license_key === deviceLicenseKey
    if (!mine) return 'other'
  }
  return 'adopt'
}

export function maskEmail(email) {
  if (typeof email !== 'string' || !email.includes('@')) return null
  const [user, domain] = email.split('@')
  return `${user.slice(0, 1)}${'•'.repeat(Math.max(2, Math.min(6, user.length - 1)))}@${domain}`
}

// "Empezar de cero": borra todo lo local (datos, ajustes, PIN, respaldos
// previos al sync) y además la licencia y el Starter del dispositivo, que
// eran de la otra cuenta. Al recargar, la cuenta nueva pasa por el
// onboarding y elige su plan como cualquier cuenta nueva.
export async function resetDeviceForNewAccount() {
  await wipeLocalDevice()
  clearLicense()
  clearStarterAck()
  try { localStorage.removeItem(OWNER_KEY) } catch {}
}

// src/core/pushAutoAsk.js — el chequeo del pedido automático de avisos, fuera
// del JS inicial: el Shell lo carga con import() después de guardar desde el
// Registro rápido. Las reglas están en core/pushAsk.js.
import { pushSupported, isPushEnabled } from './push.js'
import { hasProEntitlement } from '../utils/licenseValidator.js'
import { isNativeApp } from '../native/platform.js'
import { shouldAskPush, loadPushAsk } from './pushAsk.js'

/** @param {{ isDemo?: boolean, movementCount?: number }} o */
export function autoPushAsk({ isDemo = false, movementCount = 0 } = {}) {
  // Bloqueado en el navegador: el diálogo ya no aparecería.
  const blocked = typeof Notification !== 'undefined' && Notification.permission === 'denied'
  return shouldAskPush({
    supported: pushSupported() && !blocked, enabled: isPushEnabled(), native: isNativeApp(),
    hasLicense: hasProEntitlement(), isDemo, movementCount, asked: loadPushAsk(),
  })
}

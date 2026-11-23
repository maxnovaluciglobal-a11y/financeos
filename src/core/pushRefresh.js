// src/core/pushRefresh.js
// Al abrir la app (una vez por sesión del navegador) vuelve a guardar la
// suscripción push de este dispositivo. save_push_subscription es idempotente
// por endpoint y pone fail_count en 0, así una suscripción que el servidor dio
// de baja (push_subscriptions_record, migración 20261123000100) o que el
// navegador renovó vuelve a quedar registrada sin que la persona haga nada.
// Lógica pura con dependencias inyectadas (core/push.js la cablea); probada en
// pushRefresh.test.js.

export const SS_REFRESHED = 'fnos_push_refreshed'

// deps: {
//   supported(): boolean, enabled(): boolean, permission(): string,
//   getSubscription(): Promise<PushSubscription|null>,
//   save(json): Promise<{ ok: boolean, error?: string }>,
//   setEnabled(on: boolean): void,
//   session: { get(k): string|null, set(k, v): void } | null,
// }
// Devuelve qué hizo: 'skipped' | 'already' | 'off' | 'saved' | 'error'.
export async function refreshPushSubscription(deps) {
  if (!deps.supported() || !deps.enabled()) return 'skipped'
  try {
    if (deps.session?.get(SS_REFRESHED) === '1') return 'already'
    deps.session?.set(SS_REFRESHED, '1')
  } catch { /* sin sessionStorage: se intenta igual */ }

  const permission = deps.permission()
  // Permiso retirado en el navegador: los avisos ya no pueden llegar.
  if (permission === 'denied') { deps.setEnabled(false); return 'off' }
  if (permission !== 'granted') return 'skipped'

  const sub = await deps.getSubscription()
  // Activo en este dispositivo pero sin suscripción (el navegador la borró):
  // no se marca activo algo que no puede recibir avisos.
  if (!sub) { deps.setEnabled(false); return 'off' }
  const json = typeof sub.toJSON === 'function' ? sub.toJSON() : sub
  if (!json?.endpoint || !json?.keys?.p256dh || !json?.keys?.auth) { deps.setEnabled(false); return 'off' }

  const r = await deps.save(json)
  return r && r.ok ? 'saved' : 'error'
}

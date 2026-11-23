// Suscripciones de una licencia a las que send-push manda el recordatorio de
// prueba. La base ya solo guarda endpoints de servicios Web Push (migración
// 20261123000100), pero acá se vuelve a filtrar con la misma lista y se manda a
// 5 como mucho, las más recientes (igual que invest_alert_push_targets): una
// fila vieja nunca recibe un POST y la corrida no pasa el límite de reloj.
import { pushEndpointAllowed } from "../_shared/pushEndpoint.ts";

export const MAX_SUBS_PER_LICENSE = 5;
// Se piden algunas de más por si alguna no pasa el filtro (10 = tope por licencia).
export const SUBS_FETCH_LIMIT = 10;

export function licenseSubsPath(keyHash: string): string {
  return `push_subscriptions?key_hash=eq.${encodeURIComponent(keyHash)}` +
    `&select=id,endpoint,p256dh,auth,last_sent_at&order=created_at.desc,id.asc&limit=${SUBS_FETCH_LIMIT}`;
}

export function pickPushTargets<T extends { endpoint: string }>(subs: T[], max = MAX_SUBS_PER_LICENSE): T[] {
  return (Array.isArray(subs) ? subs : []).filter(s => pushEndpointAllowed(s?.endpoint)).slice(0, max);
}

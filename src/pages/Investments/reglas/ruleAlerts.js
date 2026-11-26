// src/pages/Investments/reglas/ruleAlerts.js — "Avisarme cuando un activo
// cumpla mi regla" (Tus reglas hoy).
//
// Cómo funciona HOY (solo en el cliente, sin infraestructura nueva):
//  · Se evalúa al abrir Inversiones › Resumen, con las mismas historias de 1
//    año que la tarjeta ya pidió (summarizeRules). No hay pedidos extra.
//  · Cada tramo que pasa a 'today' (cumple la regla) genera un aviso por
//    activo + media + día local: la misma combinación no se repite ese día,
//    aunque la persona abra la app diez veces (ledger con fecha).
//  · Canal 1, siempre: un aviso dentro de la app, arriba de la tarjeta.
//  · Canal 2, si está disponible: una notificación del sistema con el service
//    worker de los avisos push (el mismo registro de public/push-sw.js),
//    SOLO si los avisos del navegador están activos en este dispositivo
//    (follow/shared.js pushState === 'on', que exige la licencia como el resto
//    de los avisos push) y fuera del horario tranquilo de los avisos locales
//    (core/localAlerts/plan.js: nada entre las 21:00 y las 8:00). En horario
//    tranquilo queda el aviso de la app: la persona la tiene abierta.
//  · App de tienda (Capacitor): Inversiones no se muestra (native/storePolicy
//    .js), así que esto nunca corre ahí; igual, sin notificación del sistema
//    dentro de la app nativa (isNativeApp).
//  · Privacidad (como targetsStore.js: los tickers no se guardan en el
//    dispositivo en claro): las preferencias y el registro de avisos guardan
//    un hash FNV-1a del ticker, no el ticker. No es cifrado: evita dejar la
//    lista de activos legible en localStorage.
//
// TODO(server-push de reglas) — NO construido a propósito (ni función ni cron
// nuevos en esta rama). Para avisar con la app cerrada haría falta:
//  1. Tabla `invest_rule_alerts` (RLS por auth.uid(), como invest_alerts):
//     user_id, scope ('all' | 'list'), symbols text[] (solo si scope='list'),
//     ladder ('even'|'long'|'half200'), rsi_rule bool, active bool,
//     created_at. La escalera y la regla de RSI hoy viven solo en este
//     dispositivo (rulePrefs.js): habría que subirlas ahí al cambiarlas.
//  2. Ledger del servidor `invest_rule_alert_log` (user_id, symbol, sma int,
//     day date, unique(user_id, symbol, sma, day)) para la misma deduplicación
//     de aquí (activo + media + día).
//  3. Función `invest-rules-check` con el mismo esqueleto que
//     invest-alerts-check (service role, dryRun, runFailed): por cada fila
//     activa, leer portfolio_holdings de la persona (o symbols), pedir la
//     historia de 1 año a la API de Invest (una vez por símbolo y corrida),
//     calcular readSignal + planCapital (copiar signals.js / capital.js /
//     utils/investIndicators.js como _shared, con test de paridad como
//     utils/investValuation.js ↔ invest-web), y por cada tramo nuevo en
//     'today' insertar en el log (ON CONFLICT DO NOTHING) y mandar push.
//  4. Cron diario después del cierre de EE. UU. (p. ej. 22:30 UTC, lun–vie;
//     cripto: además sáb–dom) y respetar el horario tranquilo con la zona de
//     la persona (push_subscriptions no la guarda: agregar `tz`).
//  5. Payload `i18n: { key: 'ruleMet', t, sma, rsi, rsiRule }` y su texto en
//     PUSH_TEXT de public/push-sw.js en es/en/pt/de, con las mismas frases de
//     rul.notice.* (sin "señal", "oportunidad", "comprar" ni "vender").
//  6. Entitlement: hoy push exige licencia (core/push.js enablePush); el
//     modelo aprobado deja "Tus reglas hoy" y sus avisos en el teléfono en Pro.
//     La función debe filtrar por licencia activa igual que send-push.
import { isPushEnabled, pushSupported } from '../../../core/push.js'
import { getLicenseKey } from '../../../utils/licenseValidator.js'

// Copias de core/localAlerts/plan.js (QUIET_START, QUIET_END, alertId) y de
// follow/shared.js (pushState): importarlas metía sus chunks (plan, primer,
// investAlerts) en el mapa de precarga de la entrada y el JS inicial crecía.
// reglas.test.js verifica que sigan iguales a las originales.
export const QUIET_START = 21
export const QUIET_END = 8
export function alertId(key) {
  let h = 0x811c9dc5
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return (h >>> 0) % 2147483647 || 1
}
const notifPermission = () => { try { return typeof Notification !== 'undefined' ? Notification.permission : 'default' } catch { return 'default' } }
export function pushState({ demo = false, supported = pushSupported(), hasKey = !!getLicenseKey(), on = isPushEnabled(), permission = notifPermission() } = {}) {
  if (demo) return 'demo'
  if (!supported) return 'unsupported'
  if (!hasKey) return 'noLicense'
  return on && permission === 'granted' ? 'on' : 'off'
}

export const PREFS_KEY = 'fos_invest_rule_alerts_v1'
export const LEDGER_KEY = 'fos_invest_rule_alerts_log_v1'
const LEDGER_KEEP_DAYS = 7
const DAY_MS = 24 * 3600 * 1000

const pad = (n) => String(n).padStart(2, '0')
export const localDay = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
export const tickerId = (t) => alertId(`rule:${String(t || '').toUpperCase()}`)
export const isQuiet = (ms) => { const h = new Date(ms).getHours(); return h >= QUIET_START || h < QUIET_END }

// ── Preferencias: { all: bool, ids: [hash] } ──
export const EMPTY_PREFS = Object.freeze({ all: false, ids: [] })
export function parsePrefs(raw) {
  try {
    const p = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!p || typeof p !== 'object') return { ...EMPTY_PREFS, ids: [] }
    return { all: p.all === true, ids: Array.isArray(p.ids) ? p.ids.filter(Number.isFinite) : [] }
  } catch { return { ...EMPTY_PREFS, ids: [] } }
}
export const wantsAlert = (prefs, t) => !!prefs && (prefs.all || prefs.ids.includes(tickerId(t)))
export const anyAlert = (prefs) => !!prefs && (prefs.all || prefs.ids.length > 0)
export function toggleAsset(prefs, t, on) {
  const id = tickerId(t)
  const ids = prefs.ids.filter(x => x !== id)
  return { all: prefs.all, ids: on ? [...ids, id] : ids }
}
export const setAll = (prefs, on) => ({ all: !!on, ids: prefs.ids })

// ── Registro de avisos: { [hash:sma:día]: ms } ──
export const ledgerKey = (t, n, day) => `${tickerId(t)}:${n}:${day}`
export function parseLedger(raw) {
  try {
    const l = typeof raw === 'string' ? JSON.parse(raw) : raw
    return l && typeof l === 'object' && !Array.isArray(l) ? l : {}
  } catch { return {} }
}
export function pruneLedger(ledger, now) {
  const out = {}
  for (const [k, v] of Object.entries(ledger || {})) if (Number.isFinite(v) && now - v < LEDGER_KEEP_DAYS * DAY_MS) out[k] = v
  return out
}

/**
 * Avisos nuevos de hoy. rows: summarizeRules(...).rows; prefs; ledger; now.
 * Un aviso por activo (con la media más larga que se cumple entre las nuevas);
 * se marcan en el ledger TODAS las medias nuevas del activo.
 * → { notices: [{ t, label, n, rsi }], ledger }
 */
export function newRuleHits(rows, prefs, ledger, now = Date.now()) {
  const day = localDay(now)
  const next = pruneLedger(ledger, now)
  const notices = []
  for (const r of rows || []) {
    if (r.state !== 'meets' || !wantsAlert(prefs, r.t)) continue
    const fresh = (r.tramos || []).filter(x => x.state === 'today' && next[ledgerKey(r.t, x.n, day)] == null)
    if (!fresh.length) continue
    for (const x of fresh) next[ledgerKey(r.t, x.n, day)] = now
    notices.push({ t: r.t, label: r.label || r.t, n: fresh[fresh.length - 1].n, rsi: r.fact?.rsi ?? null })
  }
  return { notices, ledger: next }
}

/** ¿Se puede mandar una notificación del sistema ahora? → { ok, why } */
export function systemChannel({ pushState, native = false, now = Date.now() }) {
  if (native) return { ok: false, why: 'native' }
  if (pushState === 'demo') return { ok: false, why: 'demo' }
  if (pushState === 'unsupported') return { ok: false, why: 'unsupported' }
  if (pushState === 'noLicense') return { ok: false, why: 'noLicense' }
  if (pushState !== 'on') return { ok: false, why: 'off' }
  if (isQuiet(now)) return { ok: false, why: 'quiet' }
  return { ok: true, why: null }
}

// ── Almacenamiento (inyectable en tests; demo: en memoria) ──
const memory = new Map()
export const memoryStore = { getItem: (k) => (memory.has(k) ? memory.get(k) : null), setItem: (k, v) => { memory.set(k, String(v)) } }
export const __resetMemory = () => memory.clear()
export function browserStore() {
  try { return typeof localStorage !== 'undefined' ? localStorage : memoryStore } catch { return memoryStore }
}
const read = (st, k) => { try { return st.getItem(k) } catch { return null } }
const write = (st, k, v) => { try { st.setItem(k, v) } catch { /* modo privado: vale en esta visita */ } }
export const loadPrefs = (st) => parsePrefs(read(st, PREFS_KEY))
export const savePrefs = (st, p) => write(st, PREFS_KEY, JSON.stringify({ all: !!p.all, ids: p.ids }))
export const loadLedger = (st) => parseLedger(read(st, LEDGER_KEY))
export const saveLedger = (st, l) => write(st, LEDGER_KEY, JSON.stringify(l))

/** Notificación del sistema con el service worker de los avisos. No lanza. */
export async function showSystemNotice({ title, body, tag, sw = typeof navigator !== 'undefined' ? navigator.serviceWorker : null }) {
  try {
    if (!sw?.ready) return false
    const reg = await Promise.race([sw.ready, new Promise(r => setTimeout(() => r(null), 3000))])
    if (!reg?.showNotification) return false
    await reg.showNotification(title, { body, tag, icon: '/app/icon-192.png', badge: '/app/notification-96.png', data: { url: '/app/' } })
    return true
  } catch { return false }
}

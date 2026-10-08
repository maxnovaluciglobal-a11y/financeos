// src/core/appLock.js — bloqueo de la app con PIN y biometría (T14).
//
// Qué es y qué no es: un bloqueo de PANTALLA en este dispositivo. Impide que
// quien tome el teléfono desbloqueado abra MOY IQ y vea los montos. NO cifra
// los datos guardados: siguen en IndexedDB tal como antes, y alguien con
// acceso técnico al dispositivo (devtools, backup del navegador) los puede
// leer. El texto de Ajustes lo dice así, sin prometer más.
//
// Este módulo es lógica pura + WebCrypto/WebAuthn, sin React ni IndexedDB
// (eso vive en appLockStore.js), para poder testear el hash en Node
// (crypto.subtle existe en Node ≥18).
//
// PIN: 4–6 dígitos → PBKDF2-SHA256 con salt aleatorio de 16 bytes. Nunca se
// guarda el PIN. Honestidad sobre el alcance: con 10^6 combinaciones como
// máximo, ningún KDF hace que el hash resista fuerza bruta offline de quien
// ya extrajo la base del dispositivo. El hash existe para no guardar el PIN
// en claro; lo que frena a alguien con el teléfono en la mano es el límite
// de intentos con espera creciente (lockoutDelayMs).

export const PIN_MIN_LENGTH = 4
export const PIN_MAX_LENGTH = 6
// OWASP (2023) recomienda 600.000 iteraciones para PBKDF2-HMAC-SHA256. El
// ticket pedía ≥210.000; usamos la cifra de OWASP. En un Android de gama baja
// son ~0,5 s por desbloqueo, aceptable para algo que pasa una vez por sesión.
export const PBKDF2_ITERATIONS = 600_000
export const PIN_RECORD_VERSION = 1
const SALT_BYTES = 16
const HASH_BITS = 256

export const LOCK_TIMEOUTS_MIN = [1, 5, 15]
export const DEFAULT_TIMEOUT_MIN = 5

// Intentos de PIN libres antes de empezar a imponer espera.
export const FREE_ATTEMPTS = 5
const BASE_DELAY_MS = 30_000
const MAX_DELAY_MS = 15 * 60_000

// ─── base64url ────────────────────────────────────────────────────────────────
export function bytesToB64url(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let s = ''
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i])
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function b64urlToBytes(str) {
  const b64 = String(str).replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  const bin = atob(padded)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function getCrypto(c) {
  const cr = c || globalThis.crypto
  if (!cr?.subtle || !cr.getRandomValues) throw new Error('webcrypto_unavailable')
  return cr
}

// ─── PIN ──────────────────────────────────────────────────────────────────────
// Solo dígitos ASCII. Nada de normalizar: "١٢٣٤" (dígitos arábigos) no es un
// PIN válido, para que el mismo PIN se tipee igual en cualquier teclado.
export function isValidPin(pin) {
  return typeof pin === 'string' && /^[0-9]{4,6}$/.test(pin)
}

async function derive(pin, saltBytes, iterations, cr) {
  const key = await cr.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await cr.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations },
    key,
    HASH_BITS,
  )
  return new Uint8Array(bits)
}

// Devuelve el registro a guardar: { version, algo, iterations, salt, hash, length }.
// `length` (cantidad de dígitos) se guarda para que la pantalla de bloqueo
// muestre los puntos correctos y desbloquee al completar, como un teléfono.
// Revela el largo, no el PIN; la defensa real es el límite de intentos.
export async function hashPin(pin, { iterations = PBKDF2_ITERATIONS, salt, crypto: c } = {}) {
  if (!isValidPin(pin)) throw new Error('invalid_pin')
  if (!Number.isInteger(iterations) || iterations < 1) throw new Error('invalid_iterations')
  const cr = getCrypto(c)
  const saltBytes = salt ? new Uint8Array(salt) : cr.getRandomValues(new Uint8Array(SALT_BYTES))
  const hash = await derive(pin, saltBytes, iterations, cr)
  return {
    version: PIN_RECORD_VERSION,
    algo: 'PBKDF2-SHA256',
    iterations,
    salt: bytesToB64url(saltBytes),
    hash: bytesToB64url(hash),
    length: pin.length,
  }
}

// Comparación en tiempo constante respecto del contenido (el largo no es
// secreto: siempre son 32 bytes).
export function timingSafeEqual(a, b) {
  if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array)) return false
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

// Usa las iteraciones y el salt GUARDADOS en el registro, no las constantes
// actuales: si mañana subimos PBKDF2_ITERATIONS, los PIN viejos siguen
// verificando (y se pueden re-hashear al próximo desbloqueo correcto).
export async function verifyPin(pin, record, { crypto: c } = {}) {
  if (!isValidPin(pin) || !isPinRecord(record)) return false
  const cr = getCrypto(c)
  const expected = b64urlToBytes(record.hash)
  const actual = await derive(pin, b64urlToBytes(record.salt), record.iterations, cr)
  return timingSafeEqual(actual, expected)
}

export function isPinRecord(r) {
  return !!r && typeof r === 'object' && r.version === PIN_RECORD_VERSION &&
    typeof r.salt === 'string' && typeof r.hash === 'string' &&
    Number.isInteger(r.iterations) && r.iterations > 0
}

// ─── Límite de intentos ───────────────────────────────────────────────────────
// 5 intentos libres; desde el 5.º fallo, espera de 30 s que se duplica en cada
// fallo siguiente (30 s, 1 min, 2 min, 4 min…) con tope de 15 min. Nunca deja
// la app bloqueada para siempre: "Olvidé mi PIN" sigue disponible siempre.
export function lockoutDelayMs(failedCount) {
  const n = Number(failedCount) || 0
  if (n < FREE_ATTEMPTS) return 0
  const d = BASE_DELAY_MS * 2 ** (n - FREE_ATTEMPTS)
  return Math.min(d, MAX_DELAY_MS)
}

export function registerFailure(attempts, now = Date.now()) {
  const count = (Number(attempts?.count) || 0) + 1
  const delay = lockoutDelayMs(count)
  return { count, lockedUntil: delay ? now + delay : 0 }
}

export function remainingLockoutMs(attempts, now = Date.now()) {
  const until = Number(attempts?.lockedUntil) || 0
  // Si el reloj del sistema se atrasó (o alguien lo movió), `until - now`
  // podría ser enorme; nunca esperamos más que el tope.
  return Math.max(0, Math.min(until - now, MAX_DELAY_MS))
}

// ─── Auto-bloqueo ─────────────────────────────────────────────────────────────
export function normalizeTimeout(min) {
  return LOCK_TIMEOUTS_MIN.includes(min) ? min : DEFAULT_TIMEOUT_MIN
}

// hiddenAt: timestamp de cuando la app pasó a segundo plano (null si no pasó).
export function shouldLockOnResume(hiddenAt, now, timeoutMin) {
  if (!hiddenAt) return false
  const elapsed = now - hiddenAt
  // Reloj que retrocede: no sabemos cuánto pasó → bloqueamos (lado seguro).
  if (elapsed < 0) return true
  return elapsed >= normalizeTimeout(timeoutMin) * 60_000
}

export function isLockEnabled(config) {
  return !!config?.enabled && isPinRecord(config.pin)
}

// ─── Biometría (WebAuthn de plataforma) ───────────────────────────────────────
// No hay servidor que verifique la firma: esto es un bloqueo local, y quien
// pueda falsificar una respuesta de WebAuthn también puede editar IndexedDB.
// Lo que sí exigimos: que el navegador devuelva una aserción para NUESTRA
// credencial y con el flag UV (user verified) encendido en authenticatorData.
//
// Capacitor iOS: el WKWebView sin Associated Domains no expone WebAuthn de
// plataforma (y `isUserVerifyingPlatformAuthenticatorAvailable` puede decir
// que sí y después fallar). Ahí solo se ofrece PIN. Seguimiento: un plugin
// nativo de biometría (Face ID / Touch ID vía LocalAuthentication) en el
// proyecto ../ios-capacitor-moyiq — requiere Xcode, fuera de esta rama.
function isCapacitorNative() {
  try { return !!globalThis.Capacitor?.isNativePlatform?.() } catch { return false }
}

export async function biometricsAvailable() {
  try {
    if (isCapacitorNative()) return false
    if (typeof window === 'undefined' || !window.isSecureContext) return false
    const PKC = window.PublicKeyCredential
    if (!PKC || typeof PKC.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') return false
    if (!navigator.credentials?.create || !navigator.credentials?.get) return false
    return await PKC.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

// Crea la credencial. Devuelve { credentialId } (base64url) o tira.
// residentKey 'discouraged': pedimos una credencial NO descubrible, para que
// no aparezca como passkey en el gestor de contraseñas. Algunos navegadores
// igual la guardan como passkey (el texto de Ajustes lo advierte).
export async function createBiometricCredential({ rpName = 'MOY IQ', hostname = location.hostname } = {}) {
  const cr = getCrypto()
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: cr.getRandomValues(new Uint8Array(32)),
      rp: { name: rpName, id: hostname },
      // id aleatorio: no identifica a la persona ni a la cuenta.
      user: { id: cr.getRandomValues(new Uint8Array(16)), name: 'moyiq-lock', displayName: rpName },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'discouraged',
        requireResidentKey: false,
      },
      attestation: 'none',
      timeout: 60_000,
    },
  })
  if (!cred?.rawId) throw new Error('no_credential')
  return { credentialId: bytesToB64url(cred.rawId) }
}

// Flag UV = bit 2 (0x04) del byte de flags, que está en el offset 32 de
// authenticatorData (después de los 32 bytes del hash del rpId).
export function authDataHasUV(authenticatorData) {
  const u8 = authenticatorData instanceof Uint8Array ? authenticatorData : new Uint8Array(authenticatorData || [])
  return u8.length > 32 && (u8[32] & 0x04) === 0x04
}

// true solo si el usuario se verificó con la credencial guardada.
export async function verifyBiometric(credentialId, { hostname = location.hostname } = {}) {
  const cr = getCrypto()
  const id = b64urlToBytes(credentialId)
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: cr.getRandomValues(new Uint8Array(32)),
      rpId: hostname,
      allowCredentials: [{ type: 'public-key', id, transports: ['internal'] }],
      userVerification: 'required',
      timeout: 60_000,
    },
  })
  if (!assertion?.rawId) return false
  if (!timingSafeEqual(new Uint8Array(assertion.rawId), id)) return false
  return authDataHasUV(assertion.response?.authenticatorData)
}

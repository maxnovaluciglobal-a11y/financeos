// src/utils/syncCrypto.js
// Cifrado del sync en el dispositivo (AES-GCM, IV aleatorio por subida).
//
// v1 (modelo viejo, se sigue leyendo): llave = SHA-256('fnos-sync:' + LICENCIA),
//   sin sal ni KDF. El servidor guardaba la licencia, así que podía derivarla
//   (auditoría 360, SEG-2). Blob = base64(iv ‖ ciphertext).
// v2 (D-05, desde el 20-oct-2026, opt-in): llave = PBKDF2-SHA256(frase de paso,
//   sal aleatoria de 16 bytes, 600 000 iteraciones). La frase nunca sale del
//   dispositivo; el servidor no tiene con qué derivar la llave. Blob =
//   'fnos2:' + JSON { v, kdf, i, s, iv, ct }; los parámetros del KDF van como
//   datos autenticados (AAD), así que alterarlos hace fallar el descifrado.
//   Ver docs/sync-frase-de-paso.md.

const enc = new TextEncoder()
const dec = new TextDecoder()

function bufToB64(buf) {
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}
function b64ToBuf(b64) {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

// Deriva una CryptoKey AES-GCM de 256 bits desde la clave de licencia.
async function deriveKey(licenseKey) {
  const material = enc.encode('fnos-sync:' + String(licenseKey).trim().toUpperCase())
  const hash = await crypto.subtle.digest('SHA-256', material) // 32 bytes
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

// Cifra un objeto → string base64 (iv + ciphertext).
export async function encryptData(obj, licenseKey) {
  const key = await deriveKey(licenseKey)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plaintext = enc.encode(JSON.stringify(obj))
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)
  const out = new Uint8Array(iv.length + cipher.byteLength)
  out.set(iv, 0)
  out.set(new Uint8Array(cipher), iv.length)
  return bufToB64(out.buffer)
}

// Descifra un string base64 → objeto. Lanza si la clave no corresponde.
export async function decryptData(blobB64, licenseKey) {
  const key = await deriveKey(licenseKey)
  const raw = b64ToBuf(blobB64)
  const iv = raw.slice(0, 12)
  const cipher = raw.slice(12)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher)
  return JSON.parse(dec.decode(plain))
}

// Hash sha256 (hex) de la clave de licencia normalizada — IDÉNTICO al key_hash
// que calcula el servidor: encode(digest(upper(trim(key)),'sha256'),'hex').
// Se envía al servidor en vez de la clave cruda: el servidor autentica por hash
// y NUNCA recibe la clave (que es también la base de la llave de cifrado local).
// Desde el 20-oct-2026 la cuenta puede devolver el hash en vez de la clave
// (user_entitlements guarda el hash, C-21/C-04): un hash de 64 hex se usa tal
// cual, igual que fnos_resolve_hash() en el servidor.
export const LICENSE_HASH_RE = /^[0-9a-f]{64}$/i
export async function licenseKeyHash(licenseKey) {
  const raw = String(licenseKey || '').trim()
  if (LICENSE_HASH_RE.test(raw)) return raw.toLowerCase()
  const norm = raw.toUpperCase()
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(norm))
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
}

// ── v2: frase de paso + PBKDF2 ────────────────────────────────────────────────
export const V2_PREFIX = 'fnos2:'
export const V2_KDF = 'pbkdf2-sha256'
export const V2_ITERATIONS = 600000
export const V2_SALT_BYTES = 16
export const MIN_PASSPHRASE_LENGTH = 10

export function isV2Blob(blob) {
  return typeof blob === 'string' && blob.startsWith(V2_PREFIX)
}

export function normalizePassphrase(p) {
  return String(p ?? '').normalize('NFKC')
}

export function bytesToB64(bytes) { return bufToB64(bytes) }
export function b64ToBytes(b64) { return b64ToBuf(b64) }

function v2Aad(i, saltB64) {
  return enc.encode(`fnos2|${V2_KDF}|${i}|${saltB64}`)
}

// Bytes crudos de la llave (32). Se guardan en el dispositivo para no pedir la
// frase en cada subida; son tan sensibles como los datos locales en claro.
export async function deriveV2KeyBytes(passphrase, saltBytes, iterations = V2_ITERATIONS) {
  const base = await crypto.subtle.importKey('raw', enc.encode(normalizePassphrase(passphrase)), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations }, base, 256)
  return new Uint8Array(bits)
}

export function newV2Salt() {
  return crypto.getRandomValues(new Uint8Array(V2_SALT_BYTES))
}

// Lee los parámetros del sobre sin descifrar (para derivar la llave en un
// dispositivo nuevo). Rechaza parámetros más débiles que los de la app: un
// servidor alterado no puede hacer que este dispositivo cifre con un KDF flojo.
export function parseV2Envelope(blob, { minIterations = V2_ITERATIONS } = {}) {
  if (!isV2Blob(blob)) throw new Error('not_v2')
  let env
  try { env = JSON.parse(blob.slice(V2_PREFIX.length)) } catch { throw new Error('corrupt') }
  if (!env || env.v !== 2 || env.kdf !== V2_KDF) throw new Error('corrupt')
  if (!Number.isInteger(env.i) || env.i < minIterations || env.i > 10000000) throw new Error('weak_kdf')
  if (typeof env.s !== 'string' || typeof env.iv !== 'string' || typeof env.ct !== 'string') throw new Error('corrupt')
  let salt, iv, ct
  try { salt = b64ToBuf(env.s); iv = b64ToBuf(env.iv); ct = b64ToBuf(env.ct) } catch { throw new Error('corrupt') }
  if (salt.length !== V2_SALT_BYTES || iv.length !== 12 || ct.length < 16) throw new Error('corrupt')
  return { iterations: env.i, salt, saltB64: env.s, iv, ct }
}

export async function encryptV2(obj, keyBytes, saltBytes, iterations = V2_ITERATIONS) {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const s = bufToB64(saltBytes)
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: v2Aad(iterations, s) }, key, enc.encode(JSON.stringify(obj)))
  return V2_PREFIX + JSON.stringify({ v: 2, kdf: V2_KDF, i: iterations, s, iv: bufToB64(iv), ct: bufToB64(ct) })
}

// Lanza 'wrong_key' si la llave no corresponde (frase incorrecta) o el blob
// fue alterado, y 'corrupt' / 'weak_kdf' si el sobre no es válido.
export async function decryptV2(blob, keyBytes, opts) {
  const env = parseV2Envelope(blob, opts)
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt'])
  let plain
  try {
    plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: env.iv, additionalData: v2Aad(env.iterations, env.saltB64) }, key, env.ct)
  } catch { throw new Error('wrong_key') }
  try { return JSON.parse(dec.decode(plain)) } catch { throw new Error('corrupt') }
}

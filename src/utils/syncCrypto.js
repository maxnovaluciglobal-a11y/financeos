// src/utils/syncCrypto.js
// Cifrado de extremo a extremo para el sync. AES-GCM con llave derivada de la
// clave de licencia (SHA-256). El servidor solo ve texto cifrado; sin la clave
// FNOS no se pueden leer los datos.

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

// Cifrado del sync (auditoría 360: ING-3, C-21 / D-05). Vectores fijos: si
// alguno cambia, un blob que ya está en el servidor dejaría de poder leerse.
import { describe, it, expect } from 'vitest'
import {
  encryptData, decryptData, licenseKeyHash, LICENSE_HASH_RE,
  deriveV2KeyBytes, encryptV2, decryptV2, parseV2Envelope, isV2Blob, newV2Salt,
  V2_ITERATIONS, V2_PREFIX, normalizePassphrase,
} from './syncCrypto.js'

const hex = (u) => [...u].map((b) => b.toString(16).padStart(2, '0')).join('')
const PAYLOAD = { expenses: [{ id: 'e1', amount: 1500 }], v: 'vector' }
// Generados el 20-oct-2026 (v1: iv 01..0c fijo; v2: frase y sal fijas). La llave
// v2 se verificó con crypto.pbkdf2Sync de Node, otra implementación.
const V1_VECTOR = 'AQIDBAUGBwgJCgsMR3HH3sOgU3UWeBtA9GAd1r/hDgD5upVnvyfYMEg8omW2YzOXe1ugBU/Qy3bRaZTYApyjRxMGnD1Eao/wOl/tB5FZroF3'
const V2_PASS = 'caballo correcto batería grapa'
const V2_SALT = new Uint8Array(16).map((_, i) => 200 - i)
const V2_KEY_HEX = 'da0eba0354914b2a33ea4088bd8f5b983cba822f5d8def9519a3b8b3d23714d7'
const V2_VECTOR = 'fnos2:{"v":2,"kdf":"pbkdf2-sha256","i":600000,"s":"yMfGxcTDwsHAv769vLu6uQ==","iv":"qFioJ9/F+09l50Ug","ct":"r/7tlqBCtW34WPymD9VYkq5AIkq6cXhkyn7t2BQB+oZbe73Elxhh+lAdtBvdpe2esoqbxnCtE8S7r7DZc0pZmt3cpya6"}'

describe('licenseKeyHash = fnos_resolve_hash del servidor', () => {
  it('vector fijo calculado en Postgres: encode(digest(upper(trim(k)),\'sha256\'),\'hex\')', async () => {
    expect(await licenseKeyHash('  fnos-abcd-efgh-ijkl ')).toBe('c9ad25682b492de062fd50b3f0be43c1c53bffb62e785005129af6639bba35db')
  })
  it('un hash de 64 hex se usa tal cual (en minúsculas), sin doble hash', async () => {
    const h = 'C9AD25682B492DE062FD50B3F0BE43C1C53BFFB62E785005129AF6639BBA35DB'
    expect(LICENSE_HASH_RE.test(h)).toBe(true)
    expect(await licenseKeyHash(h)).toBe(h.toLowerCase())
  })
})

describe('v1 (llave derivada de la licencia): se sigue leyendo', () => {
  it('descifra el vector fijo', async () => {
    expect(await decryptData(V1_VECTOR, 'fnos-abcd-efgh-ijkl')).toEqual(PAYLOAD)
  })
  it('ida y vuelta, IV distinto en cada cifrado', async () => {
    const a = await encryptData(PAYLOAD, 'FNOS-ABCD-EFGH-IJKL')
    const b = await encryptData(PAYLOAD, 'FNOS-ABCD-EFGH-IJKL')
    expect(a).not.toBe(b)
    expect(await decryptData(a, 'FNOS-ABCD-EFGH-IJKL')).toEqual(PAYLOAD)
  })
  it('otra licencia no descifra', async () => {
    await expect(decryptData(V1_VECTOR, 'FNOS-ZZZZ-ZZZZ-ZZZZ')).rejects.toThrow()
  })
})

describe('v2 (frase de paso + PBKDF2-SHA256)', () => {
  it('PBKDF2 con el vector del RFC 7914 §11 (P="passwd", S="salt", c=1)', async () => {
    expect(hex(await deriveV2KeyBytes('passwd', new TextEncoder().encode('salt'), 1))).toBe('55ac046e56e3089fec1691c22544b605f94185216dde0465e68b9d57c20dacbc')
  })
  it('deriva la llave del vector fijo con 600 000 iteraciones y lo descifra', async () => {
    const k = await deriveV2KeyBytes(V2_PASS, V2_SALT)
    expect(hex(k)).toBe(V2_KEY_HEX)
    expect(await decryptV2(V2_VECTOR, k)).toEqual(PAYLOAD)
    expect(parseV2Envelope(V2_VECTOR).iterations).toBe(V2_ITERATIONS)
  })
  it('ida y vuelta con sal nueva; el blob no contiene la frase ni los datos', async () => {
    const salt = newV2Salt()
    const k = await deriveV2KeyBytes('una frase larga de prueba', salt, 1000)
    const blob = await encryptV2(PAYLOAD, k, salt, 1000)
    expect(isV2Blob(blob)).toBe(true)
    expect(blob.startsWith(V2_PREFIX)).toBe(true)
    expect(blob).not.toContain('"expenses"')
    expect(blob).not.toContain('"amount"')
    expect(await decryptV2(blob, k, { minIterations: 1000 })).toEqual(PAYLOAD)
  })
  it('frase incorrecta: wrong_key', async () => {
    const k = await deriveV2KeyBytes('otra frase cualquiera', V2_SALT)
    await expect(decryptV2(V2_VECTOR, k)).rejects.toThrow('wrong_key')
  })
  it('datos corruptos o alterados: corrupt / wrong_key, nunca datos a medias', async () => {
    const k = await deriveV2KeyBytes(V2_PASS, V2_SALT)
    const env = JSON.parse(V2_VECTOR.slice(V2_PREFIX.length))
    const ct = Buffer.from(env.ct, 'base64'); ct[3] ^= 1
    await expect(decryptV2(V2_PREFIX + JSON.stringify({ ...env, ct: ct.toString('base64') }), k)).rejects.toThrow('wrong_key')
    await expect(decryptV2('fnos2:{no json', k)).rejects.toThrow('corrupt')
    await expect(decryptV2(V2_PREFIX + JSON.stringify({ ...env, v: 3 }), k)).rejects.toThrow('corrupt')
    await expect(decryptV2(V2_PREFIX + JSON.stringify({ ...env, s: 'AAAA' }), k)).rejects.toThrow('corrupt')
    await expect(decryptV2(V1_VECTOR, k)).rejects.toThrow('not_v2')
  })
  it('un servidor no puede bajar las iteraciones: el sobre con menos se rechaza', () => {
    const env = JSON.parse(V2_VECTOR.slice(V2_PREFIX.length))
    expect(() => parseV2Envelope(V2_PREFIX + JSON.stringify({ ...env, i: 1 }))).toThrow('weak_kdf')
  })
  it('cambiar el número de iteraciones en el sobre (AAD) rompe el descifrado', async () => {
    const k = await deriveV2KeyBytes(V2_PASS, V2_SALT)
    const env = JSON.parse(V2_VECTOR.slice(V2_PREFIX.length))
    await expect(decryptV2(V2_PREFIX + JSON.stringify({ ...env, i: 700000 }), k)).rejects.toThrow('wrong_key')
  })
  it('la frase se normaliza (NFKC): la misma frase escrita con otra composición da la misma llave', async () => {
    expect(normalizePassphrase('batería')).toBe(normalizePassphrase('batería'))
    const a = await deriveV2KeyBytes('batería frase', V2_SALT, 1000)
    const b = await deriveV2KeyBytes('batería frase', V2_SALT, 1000)
    expect(hex(a)).toBe(hex(b))
  })
})

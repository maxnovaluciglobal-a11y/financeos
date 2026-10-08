import { describe, it, expect } from 'vitest'
import {
  isValidPin, hashPin, verifyPin, timingSafeEqual, isPinRecord,
  PBKDF2_ITERATIONS, FREE_ATTEMPTS, lockoutDelayMs, registerFailure, remainingLockoutMs,
  shouldLockOnResume, normalizeTimeout, isLockEnabled, authDataHasUV,
  bytesToB64url, b64urlToBytes,
} from './appLock.js'

// Iteraciones bajas en la mayoría de los tests para que corran rápido; uno
// usa el valor por defecto real.
const FAST = { iterations: 1000 }

describe('isValidPin', () => {
  it.each(['1234', '12345', '123456', '0000'])('acepta %s', (p) => expect(isValidPin(p)).toBe(true))
  it.each(['123', '1234567', '12a4', ' 1234', '١٢٣٤', '', null, 1234])('rechaza %s', (p) => expect(isValidPin(p)).toBe(false))
})

describe('hashPin / verifyPin', () => {
  it('no guarda el PIN y el registro tiene salt de 16 bytes y hash de 32', async () => {
    const r = await hashPin('482915', FAST)
    expect(JSON.stringify(r)).not.toContain('482915')
    expect(b64urlToBytes(r.salt)).toHaveLength(16)
    expect(b64urlToBytes(r.hash)).toHaveLength(32)
    expect(r).toMatchObject({ version: 1, algo: 'PBKDF2-SHA256', iterations: 1000, length: 6 })
    expect(isPinRecord(r)).toBe(true)
  })

  it('verifica el PIN correcto y rechaza uno incorrecto', async () => {
    const r = await hashPin('2580', FAST)
    expect(await verifyPin('2580', r)).toBe(true)
    expect(await verifyPin('2581', r)).toBe(false)
    expect(await verifyPin('25800', r)).toBe(false)
    expect(await verifyPin('abcd', r)).toBe(false)
  })

  it('el mismo PIN con salts distintos da hashes distintos', async () => {
    const a = await hashPin('1111', FAST)
    const b = await hashPin('1111', FAST)
    expect(a.salt).not.toBe(b.salt)
    expect(a.hash).not.toBe(b.hash)
    expect(await verifyPin('1111', a)).toBe(true)
    expect(await verifyPin('1111', b)).toBe(true)
  })

  it('respeta las iteraciones guardadas en el registro', async () => {
    const salt = new Uint8Array(16).fill(7)
    const r1 = await hashPin('1357', { iterations: 1000, salt })
    const r2 = await hashPin('1357', { iterations: 1001, salt })
    expect(r1.hash).not.toBe(r2.hash)
    // Verificar usa las iteraciones del registro: cambiarlas rompe la verificación.
    expect(await verifyPin('1357', r1)).toBe(true)
    expect(await verifyPin('1357', { ...r1, iterations: 1001 })).toBe(false)
  })

  it('por defecto usa al menos 210.000 iteraciones', async () => {
    expect(PBKDF2_ITERATIONS).toBeGreaterThanOrEqual(210_000)
    const r = await hashPin('9876')
    expect(r.iterations).toBe(PBKDF2_ITERATIONS)
    expect(await verifyPin('9876', r)).toBe(true)
  })

  it('rechaza registros malformados sin tirar', async () => {
    expect(await verifyPin('1234', null)).toBe(false)
    expect(await verifyPin('1234', { version: 2, salt: 'a', hash: 'b', iterations: 1 })).toBe(false)
    await expect(hashPin('12')).rejects.toThrow('invalid_pin')
  })
})

describe('timingSafeEqual', () => {
  it('compara contenido y largo', () => {
    expect(timingSafeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(true)
    expect(timingSafeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 3]))).toBe(false)
    expect(timingSafeEqual(new Uint8Array([1]), new Uint8Array([1, 2]))).toBe(false)
    expect(timingSafeEqual('ab', 'ab')).toBe(false)
  })
})

describe('base64url', () => {
  it('ida y vuelta sin padding ni caracteres +/', () => {
    const bytes = new Uint8Array([251, 255, 0, 62, 63, 1])
    const s = bytesToB64url(bytes)
    expect(s).not.toMatch(/[+/=]/)
    expect([...b64urlToBytes(s)]).toEqual([...bytes])
  })
})

describe('límite de intentos', () => {
  it('sin espera durante los intentos libres', () => {
    for (let n = 0; n < FREE_ATTEMPTS; n++) expect(lockoutDelayMs(n)).toBe(0)
  })
  it('espera creciente desde el 5.º fallo, con tope de 15 min', () => {
    expect(lockoutDelayMs(5)).toBe(30_000)
    expect(lockoutDelayMs(6)).toBe(60_000)
    expect(lockoutDelayMs(7)).toBe(120_000)
    expect(lockoutDelayMs(50)).toBe(15 * 60_000)
  })
  it('registerFailure acumula y fija lockedUntil', () => {
    let a = { count: 0, lockedUntil: 0 }
    for (let i = 0; i < 4; i++) a = registerFailure(a, 1000)
    expect(a).toEqual({ count: 4, lockedUntil: 0 })
    a = registerFailure(a, 1000)
    expect(a).toEqual({ count: 5, lockedUntil: 31_000 })
    expect(remainingLockoutMs(a, 11_000)).toBe(20_000)
    expect(remainingLockoutMs(a, 40_000)).toBe(0)
  })
  it('un lockedUntil absurdo (reloj movido) nunca supera el tope', () => {
    expect(remainingLockoutMs({ lockedUntil: 1e15 }, 0)).toBe(15 * 60_000)
  })
})

describe('auto-bloqueo', () => {
  it('bloquea solo si pasó el tiempo configurado en segundo plano', () => {
    expect(shouldLockOnResume(null, 10_000, 1)).toBe(false)
    expect(shouldLockOnResume(0, 59_999, 1)).toBe(false)
    expect(shouldLockOnResume(1, 60_001, 1)).toBe(true)
    expect(shouldLockOnResume(1, 5 * 60_000, 15)).toBe(false)
  })
  it('reloj que retrocede → bloquea', () => {
    expect(shouldLockOnResume(10_000, 5_000, 15)).toBe(true)
  })
  it('timeout desconocido cae a 5 min', () => {
    expect(normalizeTimeout(3)).toBe(5)
    expect(normalizeTimeout(15)).toBe(15)
  })
  it('isLockEnabled exige enabled y un registro de PIN válido', async () => {
    const pin = await hashPin('1234', FAST)
    expect(isLockEnabled({ enabled: true, pin })).toBe(true)
    expect(isLockEnabled({ enabled: false, pin })).toBe(false)
    expect(isLockEnabled({ enabled: true })).toBe(false)
    expect(isLockEnabled(null)).toBe(false)
  })
})

describe('authDataHasUV', () => {
  it('lee el bit UV del byte de flags', () => {
    const ad = new Uint8Array(37)
    expect(authDataHasUV(ad)).toBe(false)
    ad[32] = 0x01 | 0x04
    expect(authDataHasUV(ad)).toBe(true)
    expect(authDataHasUV(new Uint8Array(10))).toBe(false)
  })
})

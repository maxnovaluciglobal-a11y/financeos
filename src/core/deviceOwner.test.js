import { describe, it, expect, vi } from 'vitest'

vi.mock('./db/index.js', () => ({ wipeLocalDevice: vi.fn() }))
vi.mock('../utils/licenseValidator.js', () => ({ clearLicense: vi.fn(), clearStarterAck: vi.fn() }))

const { decideOwnership, maskEmail } = await import('./deviceOwner.js')

describe('decideOwnership', () => {
  it('mismo dueño registrado → same', () => {
    expect(decideOwnership({ owner: { uid: 'a' }, userId: 'a' })).toBe('same')
  })

  it('dueño registrado distinto → other, aunque no haya licencia', () => {
    expect(decideOwnership({ owner: { uid: 'a' }, userId: 'b' })).toBe('other')
  })

  it('sin dueño ni licencia en el dispositivo → adopt (usuarios existentes no pierden nada)', () => {
    expect(decideOwnership({ owner: null, userId: 'b', deviceLicenseKey: '' })).toBe('adopt')
  })

  it('sin dueño, con licencia Pro que en el servidor es de esta cuenta → adopt', () => {
    expect(decideOwnership({
      owner: null, userId: 'a', deviceLicenseKey: 'FNOS-AAAA-BBBB-CCCC',
      serverEntitlement: { plan: 'pro', license_key: 'FNOS-AAAA-BBBB-CCCC' },
    })).toBe('adopt')
  })

  it('sin dueño, con licencia Pro que esta cuenta no tiene → other (el caso de la cuenta nueva en un navegador usado)', () => {
    expect(decideOwnership({ owner: null, userId: 'nueva', deviceLicenseKey: 'FNOS-AAAA-BBBB-CCCC', serverEntitlement: null })).toBe('other')
    expect(decideOwnership({
      owner: null, userId: 'b', deviceLicenseKey: 'FNOS-AAAA-BBBB-CCCC',
      serverEntitlement: { plan: 'starter', license_key: null },
    })).toBe('other')
  })
})

describe('maskEmail', () => {
  it('enmascara el usuario y deja el dominio', () => {
    expect(maskEmail('walterlamadriz@gmail.com')).toBe('w••••••@gmail.com')
    expect(maskEmail('ab@x.com')).toBe('a••@x.com')
  })
  it('devuelve null si no es un email', () => {
    expect(maskEmail(null)).toBeNull()
    expect(maskEmail('sin-arroba')).toBeNull()
  })
})

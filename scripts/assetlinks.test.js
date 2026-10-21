// OPS-7 (auditoría 360): el APK de la TWA es app.moyiq.app.twa (twa-manifest.json
// y app/build.gradle en ../moyiq-android-twa). Si assetlinks.json no declara ese
// package con el SHA-256 del certificado de firma, Android no valida el dominio
// y la app abre con barra de URL. com.moyiq.app.twa queda declarado también
// mientras no se fije el ID definitivo antes de Play (C-28 / D-09).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const links = JSON.parse(readFileSync(join(root, 'public', '.well-known', 'assetlinks.json'), 'utf8'))
const UPLOAD_CERT = 'B4:3F:0C:1B:7E:19:64:4F:D9:F8:A5:3F:C0:DA:BD:FC:FD:E5:44:BA:E8:B9:09:2F:8E:E8:17:1C:C7:0A:88:5F'

describe('assetlinks.json (OPS-7)', () => {
  it('declara el package real del APK con el certificado de firma', () => {
    const real = links.find((l) => l.target?.package_name === 'app.moyiq.app.twa')
    expect(real).toBeTruthy()
    expect(real.relation).toEqual(['delegate_permission/common.handle_all_urls'])
    expect(real.target.namespace).toBe('android_app')
    expect(real.target.sha256_cert_fingerprints).toContain(UPLOAD_CERT)
  })
  it('todas las huellas tienen el formato SHA-256 de Android', () => {
    for (const l of links) {
      for (const fp of l.target.sha256_cert_fingerprints) expect(fp).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/)
    }
  })
})

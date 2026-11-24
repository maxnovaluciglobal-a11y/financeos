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

// AND-6: la app nativa de la tienda (package app.moyiq, Play App Signing) abre
// enlaces de app.moyiq.app solo si el dominio declara las huellas de Play.
// Huellas leídas de Play Console → Integridad de la app → Firma de apps (24-nov-2026).
const PLAY_SIGNING_CERT = '7C:2E:1B:CF:60:A6:BF:C9:CC:30:9C:55:BC:C6:CF:BB:1F:46:E4:7F:CD:A9:07:24:76:4F:84:4F:4E:0A:51:D3'
const PLAY_SIGNING_CERT_CURRENT = '96:51:BB:0A:68:77:98:5C:5C:5E:0B:F1:69:79:86:BF:E6:E6:D0:77:21:99:DA:87:C3:CF:6A:E4:56:AE:E3:E2'
const NATIVE_UPLOAD_CERT = '46:70:FD:39:7E:3B:40:49:31:F7:F4:CB:BA:1A:8E:72:78:35:F2:13:70:F0:B4:78:95:69:A7:B8:EB:5C:A1:4A'

describe('assetlinks.json (AND-6, app nativa app.moyiq)', () => {
  it('declara app.moyiq con las huellas de Play App Signing y de subida', () => {
    const nativa = links.find((l) => l.target?.package_name === 'app.moyiq')
    expect(nativa).toBeTruthy()
    expect(nativa.relation).toEqual(['delegate_permission/common.handle_all_urls'])
    expect(nativa.target.namespace).toBe('android_app')
    expect(nativa.target.sha256_cert_fingerprints).toEqual(
      expect.arrayContaining([PLAY_SIGNING_CERT, PLAY_SIGNING_CERT_CURRENT, NATIVE_UPLOAD_CERT])
    )
  })
  it('mantiene las entradas de la TWA', () => {
    const pkgs = links.map((l) => l.target.package_name)
    expect(pkgs).toEqual(expect.arrayContaining(['app.moyiq.app.twa', 'com.moyiq.app.twa']))
  })
})

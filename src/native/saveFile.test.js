// AND-2: en la app nativa un respaldo/CSV/PDF se da por guardado solo si el
// archivo quedó escrito; cancelar no cuenta y un error se propaga.
import { describe, it, expect, vi } from 'vitest'
import { saveBlob, isCancel, safeFileName, blobToBase64, SAVED, CANCELLED } from './saveFile.js'

const native = (platform, plugins = []) => ({
  Capacitor: { isNativePlatform: () => true, getPlatform: () => platform, isPluginAvailable: (n) => plugins.includes(n) },
})
const blob = () => new Blob(['{"a":1}'], { type: 'application/json' })

describe('saveFile', () => {
  it('nombres seguros y base64 sin prefijo', async () => {
    expect(safeFileName('moyiq backup/2026.json')).toBe('moyiq-backup-2026.json')
    expect(safeFileName('')).toBe('moyiq')
    expect(await blobToBase64(blob())).toBe(btoa('{"a":1}'))
    expect(isCancel(new Error('Share canceled'))).toBe(true)
    expect(isCancel(new Error('disk full'))).toBe(false)
  })

  it('Android: "Guardar como" del sistema; guardado o cancelado según el selector', async () => {
    const saveDocument = vi.fn()
      .mockResolvedValueOnce({ saved: true, uri: 'content://x' })
      .mockResolvedValueOnce({ saved: false })
    const plugins = { MoyiqNative: { saveDocument } }
    expect(await saveBlob(blob(), 'moyiq-backup.json', { win: native('android', ['MoyiqNative']), plugins })).toBe(SAVED)
    expect(saveDocument.mock.calls[0][0]).toMatchObject({ filename: 'moyiq-backup.json', mimeType: 'application/json', data: btoa('{"a":1}') })
    expect(await saveBlob(blob(), 'b.json', { win: native('android', ['MoyiqNative']), plugins })).toBe(CANCELLED)
  })

  it('Android: un error al escribir se propaga (la app no dice "listo")', async () => {
    const plugins = { MoyiqNative: { saveDocument: vi.fn().mockRejectedValue(Object.assign(new Error('Could not write'), { code: 'WRITE_FAILED' })) } }
    await expect(saveBlob(blob(), 'b.json', { win: native('android', ['MoyiqNative']), plugins })).rejects.toThrow('Could not write')
  })

  it('iOS: caché + hoja de compartir; cerrar la hoja = cancelado', async () => {
    const writeFile = vi.fn().mockResolvedValue({ uri: 'file:///cache/b.json' })
    const share = vi.fn().mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('Share canceled'))
    const plugins = { Filesystem: { writeFile }, Share: { share } }
    expect(await saveBlob(blob(), 'b.json', { win: native('ios'), plugins })).toBe(SAVED)
    expect(writeFile.mock.calls[0][0]).toMatchObject({ path: 'b.json', directory: 'CACHE' })
    expect(share.mock.calls[0][0].files).toEqual(['file:///cache/b.json'])
    expect(await saveBlob(blob(), 'b.json', { win: native('ios'), plugins })).toBe(CANCELLED)
  })

  it('iOS: un error de la hoja que no es cancelar se propaga', async () => {
    const plugins = { Filesystem: { writeFile: vi.fn().mockResolvedValue({ uri: 'file:///c' }) }, Share: { share: vi.fn().mockRejectedValue(new Error('boom')) } }
    await expect(saveBlob(blob(), 'b.json', { win: native('ios'), plugins })).rejects.toThrow('boom')
  })
})

describe('el respaldo marca "Último respaldo" solo si se guardó', () => {
  it('ningún llamador de exportData marca la fecha sin mirar el resultado', async () => {
    const { readFileSync } = await import('node:fs')
    for (const f of ['src/components/backup/BackupManager.jsx', 'src/components/backup/BackupStatus.jsx', 'src/pages/Dashboard/FirstSteps.jsx']) {
      const src = readFileSync(f, 'utf8')
      expect(src, f).toMatch(/['"]cancelled['"]/)
    }
    for (const f of ['src/context/AppContext.jsx', 'src/demo/DemoContext.jsx', 'src/pages/Reports/index.jsx', 'src/pages/Advisor/ReportePDF.jsx', 'src/pages/Steuer/index.jsx']) {
      const src = readFileSync(f, 'utf8')
      expect(src, f).not.toMatch(/\.download\s*=/)
      expect(src, f).toMatch(/saveBlob\(/)
    }
  })
})

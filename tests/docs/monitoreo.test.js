// GOB-N1 (auditoría 360, 19-nov-2026): docs/monitoreo.md must describe the alerts the code really sends.
// It kept saying `MOY IQ <hola@moyiq.app>` and `[MOY IQ] caída` after the rebrand to moyiq.
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../..')
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8')
const doc = read('docs/monitoreo.md')

describe('docs/monitoreo.md', () => {
  it('uses the sender from alertEmail.ts', () => {
    const from = /ALERT_FROM = "([^"]+)"/.exec(read('supabase/functions/_shared/alertEmail.ts'))?.[1]
    expect(from).toBeTruthy()
    expect(doc).toContain(`\`${from}\``)
    expect(doc).not.toMatch(/MOY IQ <hola@/)
  })

  it('quotes the subject prefix the code uses, never the old one', () => {
    const code = ['_shared/uptimeState.ts', 'cron-health-alert/cronHealthLogic.ts', 'uptime-alert/edgeErrorAlertLogic.ts']
      .map((f) => read(`supabase/functions/${f}`)).join('\n')
    expect(code).toContain('[moyiq] caída')
    expect(code).not.toContain('[MOY IQ]')
    expect(doc).not.toContain('[MOY IQ]')
    for (const s of ['[moyiq] caída', '[moyiq] sigue caído', '[moyiq] recuperado', '[moyiq] cron con problemas', '[moyiq] errores en Edge Functions']) {
      expect(doc).toContain(s)
    }
  })

  it('documents the external heartbeat and the backup watch', () => {
    expect(doc).toContain('heartbeat.yml')
    expect(doc).toContain('backup-watch.yml')
    expect(doc).not.toMatch(/si se cae Supabase entero, no hay aviso/)
  })
})

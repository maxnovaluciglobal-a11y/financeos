// Revisión previa al lanzamiento (fuente): el pedido automático de avisos
// locales sale después de guardar desde el Registro rápido, no al abrir; y el
// foco de las hojas anidadas no se pierde en cada guardado.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = (p) => readFileSync(join(import.meta.dirname, '..', '..', p), 'utf8')

describe('pedido automático de avisos locales', () => {
  it('Host lo evalúa con el evento del Registro rápido y no encima de otra hoja', () => {
    const host = src('core/localAlerts/Host.jsx')
    expect(host).toMatch(/QUICKADD_SAVED_EVENT = 'fos:quickadd-saved'/)
    expect(host).toMatch(/addEventListener\(QUICKADD_SAVED_EVENT/)
    expect(host).toMatch(/aria-modal="true"/)
    // Solo el "Ahora no" del pedido automático pospone.
    expect(host).toMatch(/wasAuto && r\?\.error === 'dismissed'/)
    expect(src('components/layout/Shell.jsx')).toMatch(/dispatchEvent\(new Event\('fos:quickadd-saved'\)\)/)
  })
})

describe('foco en diálogos', () => {
  it('useDialogA11y no depende de onClose (un onClose nuevo no devuelve el foco al disparador)', () => {
    const hook = src('hooks/useDialogA11y.js')
    expect(hook).toMatch(/closeRef\.current\?\.\(\); return/)
    expect(hook).toMatch(/\}, \[open, containerRef, focusRef\]\)/)
  })
  it('sin regiones en vivo duplicadas: el toast es el único aviso', () => {
    for (const f of ['components/categories/CategoryManager.jsx', 'components/categories/Proposals.jsx', 'pages/Dashboard/FirstSteps.jsx']) {
      expect(src(f), f).not.toMatch(/aria-live/)
    }
  })
})

// La tarjeta "Primeros pasos" no aparece en cuentas que ya existían y sí en
// una cuenta nueva (render sin DOM, contexto reemplazado).
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('../../i18n/useT.js', async () => {
  const { translate } = await import('../../i18n/translate.js')
  const useT = () => ({ t: (key, vars) => translate('es', key, vars), lang: 'es' })
  return { useT, useTFor: useT }
})
let app = {}
vi.mock('../../context/AppContext.jsx', () => ({ useApp: () => app }))
vi.mock('../../core/sync.js', () => ({ isSyncEnabled: () => false, syncAvailable: () => false }))
vi.mock('../../core/push.js', () => ({ pushSupported: () => true, isPushEnabled: () => false }))
vi.mock('../../core/pushPrimer.js', () => ({ requestPushPermission: async () => ({ ok: false }) }))
vi.mock('../../utils/licenseValidator.js', () => ({ getLicenseKey: () => 'k' }))
vi.mock('../../native/platform.js', () => ({ isNativeApp: () => false }))

const { default: FirstSteps, useFirstSteps } = await import('./FirstSteps.jsx')

function Host() {
  const steps = useFirstSteps()
  return createElement(FirstSteps, { setPage: () => {}, steps })
}
const render = (over = {}) => {
  app = { settings: {}, incomes: [], expenses: [], budgets: [], recurring: [], loading: false, ...over }
  return renderToStaticMarkup(createElement(Host))
}
const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString()

describe('Primeros pasos: solo cuentas nuevas', () => {
  it('una cuenta nueva la ve', () => {
    expect(render()).toContain('first-steps-title')
    expect(render({ expenses: [{ id: 'e', amount: 1, date: daysAgo(2).slice(0, 10), createdAt: daysAgo(2) }] })).toContain('first-steps-title')
  })

  it('una cuenta que ya existía no la ve, aunque le falten pasos', () => {
    expect(render({ expenses: [{ id: 'e', amount: 1, date: '2025-03-01', createdAt: daysAgo(200) }] })).toBe('')
    expect(render({ incomes: [{ id: 'i', amount: 1, date: '2025-01-10' }] })).toBe('')
    expect(render({ settings: { lastBackupAt: daysAgo(90) } })).toBe('')
  })

  it('mientras los datos cargan no se muestra', () => {
    expect(render({ loading: true })).toBe('')
  })

  it('con el permiso de avisos bloqueado el quinto paso es el respaldo', () => {
    globalThis.Notification = { permission: 'denied' }
    try {
      const html = render()
      expect(html).not.toContain('Activa los avisos')
    } finally { delete globalThis.Notification }
  })
})

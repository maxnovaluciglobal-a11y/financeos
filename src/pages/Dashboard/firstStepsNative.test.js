// Primeros pasos en la app de tienda: con el plugin de avisos locales, el
// quinto paso es "Activa los avisos" (hoja de ejemplos en modo local); sin el
// plugin, sigue siendo el respaldo. Render sin DOM, contexto reemplazado.
import { describe, it, expect, vi, afterEach } from 'vitest'
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
vi.mock('../../core/push.js', () => ({ pushSupported: () => false, isPushEnabled: () => false }))
vi.mock('../../core/pushPrimer.js', () => ({ requestPushPermission: async () => ({ ok: false }) }))
vi.mock('../../utils/licenseValidator.js', () => ({ getLicenseKey: () => 'k', hasProEntitlement: () => true }))
vi.mock('../../native/platform.js', () => ({ isNativeApp: () => true }))

const { default: FirstSteps, useFirstSteps } = await import('./FirstSteps.jsx')
const { translate } = await import('../../i18n/translate.js')

function Host() {
  const steps = useFirstSteps()
  return createElement(FirstSteps, { setPage: () => {}, steps })
}
const render = (over = {}) => {
  app = { settings: {}, incomes: [], expenses: [], budgets: [], recurring: [], loading: false, ...over }
  return renderToStaticMarkup(createElement(Host))
}
const withPlugin = (available) => { globalThis.Capacitor = { isPluginAvailable: (n) => available && n === 'LocalNotifications' } }

afterEach(() => { delete globalThis.Capacitor })

describe('Primeros pasos en la app de tienda', () => {
  it('con avisos locales, el quinto paso los activa', () => {
    withPlugin(true)
    const html = render()
    expect(html).toContain(translate('es', 'steps.alerts.title'))
    expect(html).not.toContain(translate('es', 'steps.backup.title'))
  })

  it('el texto del paso habla de los avisos locales cuando es el siguiente', () => {
    withPlugin(true)
    const done = { createdAt: new Date().toISOString() }
    const today = new Date().toISOString().slice(0, 10)
    const html = render({
      incomes: [{ id: 'i', amount: 1, date: today, ...done }],
      expenses: [{ id: 'e', amount: 1, date: today, ...done }],
      recurring: [{ id: 'r', kind: 'expense', ...done }],
      budgets: [{ id: 'b', ...done }],
      settings: { activeMonth: today.slice(0, 7) },
    })
    expect(html).toContain(translate('es', 'steps.alerts.localDesc'))
    expect(html).not.toContain(translate('es', 'steps.alerts.desc'))
  })

  it('sin el plugin, el quinto paso es el respaldo', () => {
    withPlugin(false)
    const html = render()
    expect(html).toContain(translate('es', 'steps.backup.title'))
    expect(html).not.toContain(translate('es', 'steps.alerts.title'))
  })
})

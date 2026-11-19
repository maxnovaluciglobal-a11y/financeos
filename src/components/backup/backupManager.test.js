// Ajustes › Datos y respaldo rompía con "Algo se interrumpió" (ErrorBoundary):
// BackupManager usaba <BackupStatusBadge /> sin importarlo desde que se partió
// el archivo (de69dc2, 30-oct-2026) → ReferenceError en cada render. Reportado
// por Walter el 19-nov-2026 en su iPhone; reproducido en Chromium y WebKit.
// Se renderiza sin DOM (renderToStaticMarkup) con el contexto reemplazado.
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

const { default: BackupManager } = await import('./BackupManager.jsx')

const base = {
  settings: {}, updateSettings: async () => {}, exportData: async () => {}, importData: async () => {},
  incomes: [], expenses: [], budgets: [], debts: [], goals: [],
}
const render = (over = {}) => {
  app = { ...base, ...over }
  return renderToStaticMarkup(createElement(BackupManager))
}

describe('BackupManager (Ajustes › Datos y respaldo)', () => {
  it('renderiza sin datos y sin respaldo previo (con el aviso de estado)', () => {
    const html = render()
    expect(html).toContain('Crear respaldo')
    expect(html).toContain('Todavía no hay un respaldo')
  })

  it('renderiza con datos y un respaldo reciente', () => {
    const html = render({
      settings: { lastBackupAt: new Date().toISOString() },
      expenses: [{ id: 'e1', amount: 10 }],
    })
    expect(html).toContain('✓')
  })

  it('renderiza con un respaldo viejo (>30 días)', () => {
    const old = new Date(Date.now() - 40 * 864e5).toISOString()
    expect(() => render({ settings: { lastBackupAt: old }, incomes: [{ id: 'i1', amount: 1 }] })).not.toThrow()
  })
})

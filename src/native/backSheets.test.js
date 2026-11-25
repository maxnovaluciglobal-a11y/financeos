// R4-1: toda hoja o diálogo que se puede cerrar se registra en el botón atrás de
// Android (native/backStack.js), para que atrás la cierre antes de navegar o de
// mandar la app al fondo. Sin DOM en vitest (environment node): los hooks de
// React se simulan (useEffect corre en el acto) y se llama al componente como
// función.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const h = vi.hoisted(() => ({ state: [], setters: [], cleanups: [] }))
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useEffect: (fn) => { const c = fn(); if (typeof c === 'function') h.cleanups.push(c) },
    useRef: (v) => ({ current: v }),
    useState: (init) => {
      const v = h.state.length ? h.state.shift() : (typeof init === 'function' ? init() : init)
      const set = vi.fn()
      h.setters.push(set)
      return [v, set]
    },
  }
})
vi.mock('../i18n/useT.js', () => ({ useT: () => ({ t: (k) => k, lang: 'es' }), useTFor: () => ({ t: (k) => k }) }))

const { handleBack, _resetBackStack } = await import('./backStack.js')
const { LegalNotice } = await import('../components/AuthGate.jsx')
const { ConfirmModal } = await import('../components/backup/BackupManager.jsx')
const { DemoBottomCTA } = await import('../demo/DemoShell.jsx')

beforeEach(() => {
  _resetBackStack()
  h.state.length = 0
  h.setters.length = 0
  h.cleanups.length = 0
})

describe('R4-1: atrás cierra la hoja legal del registro (Términos / Privacidad)', () => {
  const t = (k) => k
  it('con Términos abiertos, atrás cierra la hoja y no manda la app al fondo', () => {
    h.state.push('terms')
    LegalNotice({ t, lang: 'es', native: true })
    expect(handleBack()).toBe('dismissed')
    expect(h.setters[0]).toHaveBeenCalledWith(null)
  })
  it('con Privacidad abierta, igual', () => {
    h.state.push('privacy')
    LegalNotice({ t, lang: 'es', native: true })
    expect(handleBack()).toBe('dismissed')
    expect(h.setters[0]).toHaveBeenCalledWith(null)
  })
  it('cerrada no registra nada (atrás sigue con el historial de la pantalla de acceso)', () => {
    LegalNotice({ t, lang: 'es', native: true })
    expect(handleBack()).toBe('unhandled')
  })
  it('al cerrarse se quita del registro', () => {
    h.state.push('terms')
    LegalNotice({ t, lang: 'es', native: true })
    h.cleanups.forEach(c => c())
    expect(handleBack()).toBe('unhandled')
  })
})

describe('R4-1: atrás cancela la confirmación de restaurar respaldo', () => {
  it('abierta: atrás llama a onCancel', () => {
    const onCancel = vi.fn()
    ConfirmModal({ isOpen: true, title: 'x', message: 'y', onConfirm: vi.fn(), onCancel })
    expect(handleBack()).toBe('dismissed')
    expect(onCancel).toHaveBeenCalledOnce()
  })
  it('cerrada: no registra nada', () => {
    ConfirmModal({ isOpen: false, title: 'x', message: 'y', onConfirm: vi.fn(), onCancel: vi.fn() })
    expect(handleBack()).toBe('unhandled')
  })
})

describe('ronda 5: atrás cierra la tarjeta «¿Te sirve?» del demo', () => {
  it('visible: atrás la cierra (como la X)', () => {
    h.state.push(true, false) // visible, dismissed
    DemoBottomCTA({ hidden: false })
    expect(handleBack()).toBe('dismissed')
    expect(h.setters[1]).toHaveBeenCalledWith(true)
  })
  it('oculta o durante el recorrido: no registra nada', () => {
    h.state.push(false, false)
    DemoBottomCTA({ hidden: false })
    expect(handleBack()).toBe('unhandled')
    h.state.push(true, false)
    DemoBottomCTA({ hidden: true })
    expect(handleBack()).toBe('unhandled')
  })
})

// Auditoría: cualquier componente que pinte un diálogo (role="dialog",
// role="alertdialog", aria-modal) o una capa a pantalla completa
// (position: 'fixed' + inset: 0) tiene que registrarse en el botón atrás.
const REGISTERED = /useDialogA11y|useBackDismiss|pushBackDismiss|<Sheet\b|<Modal\b|<OptionSheet\b/
// Excepciones a propósito (no se cierran con atrás o no existen en la app de tienda):
const EXEMPT = {
  'components/DeviceSwitch.jsx': 'pantalla completa sin nada debajo: reintentar o cerrar sesión',
  'components/lock/AppLock.jsx': 'bloqueo con PIN: atrás nunca lo salta',
  'components/ui/Toast.jsx': 'aviso efímero, no es una hoja',
  'admin/AdminCRM.jsx': 'panel web de administración, no está en la app',
  'components/tour/PageTour.jsx': 'solo busca un diálogo abierto con querySelector; el recorrido (Tour.jsx) sí se registra',
  'core/localAlerts/Host.jsx': 'solo busca una hoja abierta con querySelector; la hoja de avisos (PushAsk) es un <Sheet>',
}
const SRC = join(import.meta.dirname, '..')
function* files(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) yield* files(p)
    else if (/\.jsx$/.test(name) && !/\.test\./.test(name)) yield p
  }
}
const DIALOG = /role="(dialog|alertdialog)"|aria-modal|position: ?'fixed',[^}\n]*inset: ?0|className="demo-bottom-cta"/

describe('auditoría: hojas y diálogos registrados en el botón atrás', () => {
  it('ningún diálogo o capa a pantalla completa queda fuera de backStack', () => {
    const missing = []
    for (const f of files(SRC)) {
      const rel = relative(SRC, f).split('\\').join('/')
      if (rel.startsWith('pages/Investments/') || EXEMPT[rel]) continue // Inversiones no va en la app de tienda
      const src = readFileSync(f, 'utf8')
      if (DIALOG.test(src) && !REGISTERED.test(src)) missing.push(rel)
    }
    expect(missing).toEqual([])
  })
})

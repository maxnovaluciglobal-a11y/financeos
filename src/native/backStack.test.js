// Botón atrás de Android (AND-3/AND-4): hojas primero, después pantallas y
// pestañas, y en Inicio la app va al fondo (nunca a la pantalla de acceso).
import { describe, it, expect, beforeEach } from 'vitest'
import { pushBackDismiss, setBackNavigator, handleBack, _resetBackStack } from './backStack.js'
import { nativeBackAction } from '../components/layout/pageStack.js'

beforeEach(() => _resetBackStack())

describe('backStack', () => {
  it('sin app montada (acceso) no decide: lo hace el historial', () => {
    expect(handleBack()).toBe('unhandled')
  })
  it('cierra primero la hoja de más arriba, una por vez', () => {
    const closed = []
    const offA = pushBackDismiss(() => closed.push('detalle'))
    const offB = pushBackDismiss(() => closed.push('lista'))
    let navs = 0
    setBackNavigator(() => { navs++; return true })
    expect(handleBack()).toBe('dismissed')
    expect(closed).toEqual(['lista'])
    offB()
    expect(handleBack()).toBe('dismissed')
    expect(closed).toEqual(['lista', 'detalle'])
    offA()
    expect(navs).toBe(0)
    expect(handleBack()).toBe('navigated')
  })
  it('en la raíz avisa "root" (la app va al fondo)', () => {
    setBackNavigator(() => false)
    expect(handleBack()).toBe('root')
  })
  it('un navegador viejo que se desmonta no borra al nuevo', () => {
    const a = () => true
    const offA = setBackNavigator(a)
    setBackNavigator(() => false)
    offA()
    expect(handleBack()).toBe('root')
  })
})

describe('nativeBackAction', () => {
  it('pantalla empujada → history; subpantalla de Ajustes → history', () => {
    expect(nativeBackAction({ fosPage: 'goals', fosDepth: 1, fosFrom: 'more' }, 'goals')).toBe('history')
    expect(nativeBackAction({ fosPage: 'settings', fosDepth: 0, fosSettingsSub: 'data' }, 'settings')).toBe('history')
  })
  it('pantalla secundaria sin entrada debajo → su raíz', () => {
    expect(nativeBackAction(null, 'settings')).toBe('parent')
  })
  it('pestaña que no es Inicio → Inicio; Inicio → fondo (también en el demo)', () => {
    expect(nativeBackAction({ fosPage: 'movements', fosDepth: 0 }, 'movements')).toBe('home')
    expect(nativeBackAction({ fosPage: 'dashboard', fosDepth: 0 }, 'dashboard')).toBe('root')
  })
})

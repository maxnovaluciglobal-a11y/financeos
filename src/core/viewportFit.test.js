import { describe, it, expect } from 'vitest'
import { computeViewportFit, applyViewportFit, viewportHeight, MAX_GAP } from './viewportFit.js'

// iPhone 14/15 (390×844 pt), zona segura superior 47 pt.
const iphone = { standalone: true, innerWidth: 390, innerHeight: 797, screenWidth: 390, screenHeight: 844 }

function fakeWin(env) {
  const props = new Map()
  const dataset = {}
  return {
    navigator: { standalone: env.standalone },
    innerWidth: env.innerWidth,
    innerHeight: env.innerHeight,
    screen: { width: env.screenWidth, height: env.screenHeight },
    document: {
      documentElement: {
        dataset,
        style: { setProperty: (k, v) => props.set(k, v), removeProperty: (k) => props.delete(k) },
      },
    },
    props,
    dataset,
  }
}

describe('computeViewportFit', () => {
  it('ajusta la app al viewport corto de la app instalada (sin empujar hacia la franja sin pintar)', () => {
    expect(computeViewportFit(iphone)).toEqual({ appH: 797, gap: 0, mode: 'fit' })
  })

  it('no toca nada fuera de la app instalada de iOS (Safari, Android, TWA, escritorio)', () => {
    expect(computeViewportFit({ ...iphone, standalone: false })).toBeNull()
    expect(computeViewportFit({ ...iphone, standalone: undefined })).toBeNull()
  })

  it('no corrige cuando el viewport ya llega al borde', () => {
    expect(computeViewportFit({ ...iphone, innerHeight: 844 })).toBeNull()
  })

  it('usa el lado corto de screen como alto en horizontal', () => {
    expect(computeViewportFit({ ...iphone, innerWidth: 844, innerHeight: 370 })).toEqual({ appH: 370, gap: 0, mode: 'fit' })
  })

  it('descarta ventanas que no ocupan el ancho completo (iPad dividido)', () => {
    expect(computeViewportFit({ standalone: true, innerWidth: 507, innerHeight: 1000, screenWidth: 1024, screenHeight: 1366 })).toBeNull()
  })

  it('descarta diferencias que no pueden ser la zona segura', () => {
    expect(computeViewportFit({ ...iphone, innerHeight: 844 - MAX_GAP - 1 })).toBeNull()
    expect(computeViewportFit({ ...iphone, innerHeight: NaN })).toBeNull()
  })
})

describe('applyViewportFit', () => {
  it('publica --app-h, --vp-gap y data-vp-fit, y los quita cuando ya no aplica', () => {
    const win = fakeWin(iphone)
    applyViewportFit(win)
    expect(win.props.get('--app-h')).toBe('797px')
    expect(win.props.get('--vp-gap')).toBe('0px')
    expect(win.dataset.vpFit).toBe('fit')
    win.innerHeight = 844
    applyViewportFit(win)
    expect(win.props.has('--app-h')).toBe(false)
    expect(win.props.has('--vp-gap')).toBe(false)
    expect(win.dataset.vpFit).toBeUndefined()
  })

  it('viewportHeight da el alto del viewport en la app instalada y innerHeight en el resto', () => {
    expect(viewportHeight(fakeWin(iphone))).toBe(797)
    expect(viewportHeight(fakeWin({ ...iphone, standalone: false }))).toBe(797)
  })
})

describe('computeViewportFit · nunca empuja hacia la franja sin pintar (19-nov-2026)', () => {
  const walter = { standalone: true, innerWidth: 440, innerHeight: 894, screenWidth: 440, screenHeight: 956 }
  it('iPhone de Walter (iOS 26): la app se ajusta al viewport, hueco 0', () => {
    expect(computeViewportFit(walter)).toEqual({ appH: 894, gap: 0, mode: 'fit' })
  })
  it('pantalla completa sin hueco: nada que corregir', () => {
    expect(computeViewportFit({ ...walter, innerHeight: 956 })).toBeNull()
  })
  it('fuera de la app instalada: nada', () => {
    expect(computeViewportFit({ ...walter, standalone: undefined })).toBeNull()
  })
})

describe('app nativa (Capacitor)', () => {
  it('no aplica las correcciones de la PWA: el viewport es el real', () => {
    expect(computeViewportFit({ standalone: true, native: true, innerWidth: 440, innerHeight: 894, screenWidth: 440, screenHeight: 956 })).toBeNull()
  })
})

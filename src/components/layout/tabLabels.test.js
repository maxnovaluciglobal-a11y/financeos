// AND-11: con la letra del sistema al 130 % las etiquetas de la barra se
// cortaban ("Ho…"). TabBar mide y deja solo los íconos si alguna no entra.
import { describe, it, expect } from 'vitest'
import { tabLabelsFit } from './TabBar.jsx'

describe('tabLabelsFit', () => {
  it('con etiquetas que entran enteras se muestran', () => {
    expect(tabLabelsFit({ natural: [40, 80, 70, 40, 40], visible: [40, 80, 70, 40, 40], pill: 330, compact: false })).toBe(true)
  })
  it('si una se corta, solo íconos', () => {
    expect(tabLabelsFit({ natural: [48, 120, 90, 50, 30], visible: [30, 70, 60, 30, 30], pill: 330, compact: false })).toBe(false)
  })
  it('vuelven cuando la cápsula alcanza para todas', () => {
    expect(tabLabelsFit({ natural: [48, 120, 90, 50, 30], visible: [1, 1, 1, 1, 1], pill: 330, compact: true })).toBe(false)
    expect(tabLabelsFit({ natural: [40, 80, 70, 40, 40], visible: [1, 1, 1, 1, 1], pill: 400, compact: true })).toBe(true)
  })
  it('etiquetas ya ocultas por la consulta de contenedor no cuentan como cortadas', () => {
    expect(tabLabelsFit({ natural: [48, 120, 90, 50, 30], visible: [1, 1, 1, 1, 1], pill: 330, compact: false })).toBe(true)
  })
})

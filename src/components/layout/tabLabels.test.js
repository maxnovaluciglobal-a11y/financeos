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

// Inicio v2 (24-nov-2026): 3 pestañas. Con la cápsula de un teléfono de 360 px
// (≈ 260 px) cada pestaña tiene ≈ 85 px y la etiqueta más larga de los 4
// idiomas ("Movimentações", ≈ 80 px a 11 px) entra entera.
import { TABS } from './TabBar.jsx'
import { es } from '../../i18n/es.js'
import { en } from '../../i18n/en.js'
import { pt } from '../../i18n/pt.js'
import { de } from '../../i18n/de.js'

describe('barra de 4 pestañas con el "+" al centro (opción D, 26-nov-2026)', () => {
  it('Inicio · Movimientos · [+] · Presupuestos · Más, en ese orden', () => {
    expect(TABS.map(t => t.id)).toEqual(['dashboard', 'movements', 'budgets', 'more'])
  })
  it('ninguna etiqueta pasa de 13 caracteres en ningún idioma (no se corta en 360 px)', () => {
    for (const dict of [es, en, pt, de]) for (const tab of TABS) {
      expect(dict[tab.lb]?.length, `${tab.lb}: ${dict[tab.lb]}`).toBeLessThanOrEqual(13)
    }
  })
})

// C-43: cifras oficiales fijas en el código (topes y comisión AFP de Chile,
// límites e impuestos de EE. UU., RESICO, §32a y cotizaciones de Alemania).
// Cada módulo dice cuándo se verificó contra la fuente oficial y cuándo toca
// la próxima revisión. Esta prueba falla pasada esa fecha: hay que volver a
// verificar (fuentes en el comentario de cada archivo) y mover la fecha.
import { describe, it, expect } from 'vitest'
import { REVISION_PREVISIONAL_CL, COMISION_AFP_PROMEDIO_PCT, COMISION_AFP_MIN_PCT, COMISION_AFP_MAX_PCT } from './indicadores.js'
import { REVISION_US } from './taxCalcUS.js'
import { REVISION_RESICO } from './resicoMX.js'
import { REVISION_DE } from './taxCalcDE.js'

const today = new Date().toISOString().slice(0, 10)

describe('revisión de cifras oficiales (C-43)', () => {
  for (const [name, rev] of Object.entries({ REVISION_PREVISIONAL_CL, REVISION_US, REVISION_RESICO, REVISION_DE })) {
    it(`${name}: revisión al día (próxima ${rev.proximaRevision})`, () => {
      expect(rev.verificadoEl <= rev.proximaRevision).toBe(true)
      expect(today <= rev.proximaRevision, `${name} venció el ${rev.proximaRevision}: verificar contra la fuente oficial`).toBe(true)
    })
  }
  it('la comisión promedio está dentro del rango publicado', () => {
    expect(COMISION_AFP_MIN_PCT).toBeLessThan(COMISION_AFP_PROMEDIO_PCT)
    expect(COMISION_AFP_PROMEDIO_PCT).toBeLessThan(COMISION_AFP_MAX_PCT)
    expect(COMISION_AFP_PROMEDIO_PCT).toBeCloseTo((1.44 + 1.44 + 1.27 + 0.58 + 1.16 + 1.45 + 0.46) / 7, 2)
  })
})

import { describe, it, expect } from 'vitest'
import { pendingNotes, RELEASE_NOTES } from './releaseNotes.js'

const notes = [{ id: '2026-11-20', items: {} }, { id: '2026-10-30', items: {} }]

describe('Novedades (N12)', () => {
  it('cuenta nueva sin datos: no se muestra, se marca vista', () => {
    expect(pendingNotes({ seen: null, hasData: false, notes })).toEqual({ show: [], markSeen: '2026-11-20' })
  })
  it('usuario con datos que nunca vio notas: solo la última', () => {
    expect(pendingNotes({ seen: null, hasData: true, notes }).show.map(n => n.id)).toEqual(['2026-11-20'])
  })
  it('muestra las más nuevas que la vista, nada si está al día', () => {
    expect(pendingNotes({ seen: '2026-10-30', hasData: true, notes }).show.map(n => n.id)).toEqual(['2026-11-20'])
    expect(pendingNotes({ seen: '2026-11-20', hasData: true, notes })).toEqual({ show: [], markSeen: null })
  })
  it('las notas reales tienen los 4 idiomas, sin exclamaciones', () => {
    for (const n of RELEASE_NOTES) for (const l of ['es', 'en', 'pt', 'de']) {
      expect(n.items[l]?.length).toBeGreaterThan(0)
      for (const line of n.items[l]) expect(line).not.toMatch(/[!¡]/)
    }
  })
})

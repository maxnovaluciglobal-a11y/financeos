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

// Aviso del rebranding: en iPhone, borrar el ícono de la pantalla de inicio
// puede borrar los datos de la app instalada. El texto tiene que ofrecer
// conservar el ícono viejo (sigue funcionando) y pedir el respaldo ANTES de
// mencionar el borrado, con la ruta real (Más › Ajustes › Respaldo…).
describe('Novedades: aviso del rebranding en iPhone', () => {
  const rebrand = RELEASE_NOTES.find(n => n.items.es.some(l => l.includes('ahora es moyiq')))
  const RULES = {
    es: { keep: /puedes conservarlos/, backup: /respaldo \(Más › Ajustes › Respaldo y restauración\)/, remove: /bórrala/, guard: /Sin ese respaldo no la borres/ },
    en: { keep: /you can keep them/, backup: /backup \(More › Settings › Backup and restore\)/, remove: /remove it and add it again/, guard: /Do not remove it without that backup/ },
    pt: { keep: /você pode mantê-los/, backup: /backup \(Mais › Configurações › Backup e restauração\)/, remove: /apague e adicione/, guard: /Sem esse backup, não apague/ },
    de: { keep: /Sie können sie behalten/, backup: /Sicherung \(Mehr › Einstellungen › Sicherung und Wiederherstellung\)/, remove: /entfernen Sie die App/, guard: /Ohne diese Sicherung bitte nicht entfernen/ },
  }
  for (const [lang, r] of Object.entries(RULES)) {
    it(`${lang}: conservar el ícono, respaldo antes de borrar y aviso sin respaldo`, () => {
      expect(rebrand).toBeTruthy()
      const line = rebrand.items[lang].find(l => /iPhone/.test(l))
      expect(line).toMatch(r.keep)
      expect(line).toMatch(r.guard)
      const b = line.search(r.backup), d = line.search(r.remove)
      expect(b).toBeGreaterThan(-1)
      expect(d).toBeGreaterThan(b)
      expect(line.search(r.keep)).toBeLessThan(b)
    })
  }
})

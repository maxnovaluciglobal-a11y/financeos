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
// puede borrar los datos de la app instalada. El texto ofrece primero
// conservar el ícono viejo (funciona igual) y, para quien igual quiera el
// nuevo, los tres pasos en orden: 1) respaldo, 2) borrar y volver a agregar,
// 3) restaurar el respaldo; y avisa que no se borre sin respaldo.
describe('Novedades: aviso del rebranding en iPhone', () => {
  const rebrand = RELEASE_NOTES.find(n => n.items.es.some(l => l.includes('ahora es moyiq')))
  const RULES = {
    es: { keep: /puedes conservar el ícono/, s1: /1\) crea un respaldo en Más › Ajustes › Respaldo y restauración/, s2: /2\) borra la app/, s3: /3\) ábrela y restaura ese respaldo/, guard: /Sin respaldo no la borres/ },
    en: { keep: /you can keep the old icon/, s1: /1\) create a backup in More › Settings › Backup and restore/, s2: /2\) remove the app/, s3: /3\) open it and restore that backup/, guard: /Do not remove it without a backup/ },
    pt: { keep: /você pode manter o ícone/, s1: /1\) crie um backup em Mais › Configurações › Backup e restauração/, s2: /2\) apague o app/, s3: /3\) abra o app e restaure esse backup/, guard: /Sem backup, não apague/ },
    de: { keep: /können Sie das alte Symbol/, s1: /1\) Erstellen Sie eine Sicherung unter Mehr › Einstellungen › Sicherung und Wiederherstellung/, s2: /2\) entfernen Sie die App/, s3: /3\) öffnen Sie sie und stellen Sie diese Sicherung/, guard: /Ohne Sicherung bitte nicht entfernen/ },
  }
  for (const [lang, r] of Object.entries(RULES)) {
    it(`${lang}: conservar el ícono, y si no: respaldo, borrar y volver a agregar, restaurar`, () => {
      const line = rebrand.items[lang].find(l => /iPhone/.test(l))
      const pos = ['keep', 's1', 's2', 's3'].map(k => line.search(r[k]))
      for (const p of pos) expect(p).toBeGreaterThan(-1)
      expect([...pos].sort((a, b) => a - b)).toEqual(pos)
      expect(line).toMatch(r.guard)
    })
  }
})

import { describe, it, expect } from 'vitest'
import { snapshotIdsToPrune, readOptionalStore } from './index.js'

describe('retención de fotos previas (ING-13)', () => {
  it('conserva las 2 más recientes', () => {
    const list = [
      { id: 'a', createdAt: '2026-09-01T00:00:00Z' },
      { id: 'b', createdAt: '2026-10-09T00:00:00Z' },
      { id: 'c', createdAt: '2026-10-19T00:00:00Z' },
      { id: 'd', createdAt: '2026-08-01T00:00:00Z' },
    ]
    expect(snapshotIdsToPrune(list).sort()).toEqual(['a', 'd'])
    expect(snapshotIdsToPrune(list, 3)).toEqual(['d'])
  })
  it('con 2 o menos no borra nada', () => {
    expect(snapshotIdsToPrune([{ id: 'x', createdAt: '1' }, { id: 'y', createdAt: '2' }])).toEqual([])
    expect(snapshotIdsToPrune([])).toEqual([])
    expect(snapshotIdsToPrune(undefined)).toEqual([])
  })
})

describe('respaldo sin las reglas de fijos (ING-5)', () => {
  it('una store inexistente se omite sin registrar error', async () => {
    const log = []
    const r = await readOptionalStore('recurring', async () => { const e = new Error('x'); e.name = 'NotFoundError'; throw e }, (x) => log.push(x))
    expect(r).toEqual({ ok: false, missing: true })
    expect(log).toEqual([])
  })
  it('una lectura que falla se omite, se registra y no se convierte en lista vacía', async () => {
    const log = []
    const r = await readOptionalStore('recurring', async () => { const e = new Error('boom'); e.name = 'UnknownError'; throw e }, (x) => log.push(x))
    expect(r).toEqual({ ok: false, missing: false })
    expect(r.items).toBeUndefined()
    expect(log[0]).toMatchObject({ type: 'export', message: 'recurring: UnknownError' })
  })
  it('una lectura correcta devuelve los registros', async () => {
    expect(await readOptionalStore('recurring', async () => [{ id: 1 }])).toEqual({ ok: true, items: [{ id: 1 }] })
  })
})

import { describe, it, expect, vi } from 'vitest'
import { shareInvite, INVITE_URL } from './invite.js'

const msg = { title: 'moyiq', text: 'Hola' }

describe('Invita a alguien', () => {
  it('web con Web Share: comparte el mensaje con el enlace público', async () => {
    const share = vi.fn().mockResolvedValue()
    expect(await shareInvite(msg, { navigator: { share } })).toBe('shared')
    expect(share).toHaveBeenCalledWith({ title: 'moyiq', text: 'Hola', url: INVITE_URL })
    expect(INVITE_URL).toBe('https://moyiq.app')
  })
  it('sin Web Share copia el enlace; cerrar la hoja es "cancelled"', async () => {
    const writeText = vi.fn().mockResolvedValue()
    expect(await shareInvite(msg, { navigator: { clipboard: { writeText } } })).toBe('copied')
    expect(writeText).toHaveBeenCalledWith('Hola https://moyiq.app')
    const abort = Object.assign(new Error('x'), { name: 'AbortError' })
    expect(await shareInvite(msg, { navigator: { share: () => Promise.reject(abort) } })).toBe('cancelled')
    expect(await shareInvite(msg, { navigator: {} })).toBe('failed')
  })
})

import { describe, it, expect, vi } from 'vitest'
import { cancelSubscription, cancelSubscriptions, pendingSubscriptions, STRIPE_API } from './stripeCancel.ts'
import { cancelStripeAfterDelete, followupMessage, type DeleteResult } from './deleteAccountLogic.ts'

// Stripe mockeado: estado por suscripción; GET devuelve el estado, DELETE la cancela.
function fakeStripe(state: Record<string, string | 'missing' | 'error500' | 'throw'>) {
  const calls: Array<{ url: string; method: string; auth: string }> = []
  const fetchImpl = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET'
    calls.push({ url, method, auth: (init.headers as any).Authorization })
    const id = decodeURIComponent(url.split('/').pop()!)
    const s = state[id]
    if (s === 'throw') throw new Error('net')
    if (s === 'error500') return new Response(JSON.stringify({ error: { type: 'api_error' } }), { status: 500 })
    if (s === undefined || s === 'missing') return new Response(JSON.stringify({ error: { code: 'resource_missing' } }), { status: 404 })
    if (method === 'DELETE') { state[id] = 'canceled'; return new Response(JSON.stringify({ id, status: 'canceled' }), { status: 200 }) }
    return new Response(JSON.stringify({ id, status: s }), { status: 200 })
  })
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls }
}

describe('SEG-5: cancelación en Stripe', () => {
  it('cancela una suscripción activa en el acto con la clave restringida', async () => {
    const { fetchImpl, calls } = fakeStripe({ sub_ABC123: 'active' })
    expect(await cancelSubscription('sub_ABC123', 'rk_test_x', { fetchImpl })).toEqual({ id: 'sub_ABC123', result: 'canceled' })
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      `GET ${STRIPE_API}/subscriptions/sub_ABC123`,
      `DELETE ${STRIPE_API}/subscriptions/sub_ABC123`,
    ])
    expect(calls.every((c) => c.auth === 'Bearer rk_test_x')).toBe(true)
  })
  it('idempotente: una ya cancelada o inexistente no se vuelve a cancelar', async () => {
    const { fetchImpl, calls } = fakeStripe({ sub_DONE01: 'canceled', sub_EXP001: 'incomplete_expired' })
    expect((await cancelSubscription('sub_DONE01', 'k', { fetchImpl })).result).toBe('already_canceled')
    expect((await cancelSubscription('sub_EXP001', 'k', { fetchImpl })).result).toBe('already_canceled')
    expect((await cancelSubscription('sub_GONE01', 'k', { fetchImpl })).result).toBe('not_found')
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false)
    // segunda pasada sobre la misma: no repite el DELETE
    const s = fakeStripe({ sub_TWICE1: 'trialing' })
    await cancelSubscriptions(['sub_TWICE1', 'sub_TWICE1'], 'k', { fetchImpl: s.fetchImpl })
    await cancelSubscriptions(['sub_TWICE1'], 'k', { fetchImpl: s.fetchImpl })
    expect(s.calls.filter((c) => c.method === 'DELETE')).toHaveLength(1)
  })
  it('errores de Stripe, de red o un id raro quedan como failed sin lanzar', async () => {
    const { fetchImpl, calls } = fakeStripe({ sub_ERR500: 'error500', sub_NET001: 'throw' })
    expect(await cancelSubscription('sub_ERR500', 'k', { fetchImpl })).toEqual({ id: 'sub_ERR500', result: 'failed', error: 'stripe_http_500_api_error' })
    expect(await cancelSubscription('sub_NET001', 'k', { fetchImpl })).toEqual({ id: 'sub_NET001', result: 'failed', error: 'stripe_network_error' })
    expect(await cancelSubscription('sub_x/../../charges', 'k', { fetchImpl })).toMatchObject({ result: 'failed', error: 'invalid_subscription_id' })
    expect(calls.some((c) => c.url.includes('charges'))).toBe(false)
    expect(pendingSubscriptions([{ id: 'a', result: 'failed' }, { id: 'b', result: 'canceled' }])).toEqual(['a'])
  })
})

describe('SEG-5: delete-account con Stripe', () => {
  const base: DeleteResult = { ok: true, status: 200, stripeSubscriptions: ['sub_OK0001', 'sub_BAD001'], newsletterFollowup: false }

  it('sin STRIPE_RESTRICTED_KEY no llama a Stripe y deja el paso manual como antes', async () => {
    const { fetchImpl, calls } = fakeStripe({ sub_OK0001: 'active' })
    const onFailure = vi.fn()
    const r = await cancelStripeAfterDelete(base, undefined, onFailure, { fetchImpl })
    expect(r).toBe(base)
    expect(calls).toHaveLength(0)
    expect(followupMessage(r, 'ana@ejemplo.com')!.text).toContain('Cancelar en Stripe')
  })
  it('con la clave cancela todas; sin fallos no hay aviso a soporte', async () => {
    const { fetchImpl } = fakeStripe({ sub_OK0001: 'active', sub_BAD001: 'past_due' })
    const onFailure = vi.fn()
    const r = await cancelStripeAfterDelete(base, 'rk_live_x', onFailure, { fetchImpl })
    expect(r).toMatchObject({ ok: true, stripeSubscriptions: [], stripeCanceled: ['sub_OK0001', 'sub_BAD001'], stripeAutoFailed: false })
    expect(onFailure).not.toHaveBeenCalled()
    expect(followupMessage(r, 'ana@ejemplo.com')).toBeNull()
  })
  it('si Stripe falla el borrado sigue ok, se informa el error y se avisa a soporte', async () => {
    const { fetchImpl } = fakeStripe({ sub_OK0001: 'active', sub_BAD001: 'error500' })
    const onFailure = vi.fn()
    const r = await cancelStripeAfterDelete(base, 'rk_live_x', onFailure, { fetchImpl })
    expect(r.ok).toBe(true)
    expect(r.stripeSubscriptions).toEqual(['sub_BAD001'])
    expect(r.stripeCanceled).toEqual(['sub_OK0001'])
    expect(onFailure).toHaveBeenCalledTimes(1)
    expect(onFailure.mock.calls[0][0]).toMatchObject({ id: 'sub_BAD001', result: 'failed' })
    const msg = followupMessage(r, 'ana@ejemplo.com')!
    expect(msg.text).toContain('falló')
    expect(msg.text).toContain('sub_BAD001')
    expect(msg.text).not.toContain('sub_OK0001')
  })
  it('un borrado fallido o sin suscripciones no llama a Stripe', async () => {
    const { fetchImpl, calls } = fakeStripe({})
    await cancelStripeAfterDelete({ ok: false, status: 503, stripeSubscriptions: ['sub_OK0001'] }, 'k', vi.fn(), { fetchImpl })
    await cancelStripeAfterDelete({ ok: true, status: 200, stripeSubscriptions: [] }, 'k', vi.fn(), { fetchImpl })
    expect(calls).toHaveLength(0)
  })
})

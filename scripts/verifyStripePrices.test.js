import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { verify, linksFromWebhook, expectedFromCode } from './verifyStripePrices.mjs'

const configSrc = fs.readFileSync('src/config.js', 'utf8')
const webhookSrc = fs.readFileSync('supabase/functions/stripe-webhook/webhookLogic.ts', 'utf8')
const links = linksFromWebhook(webhookSrc)

// Fake Stripe: every link charges what the code expects unless `over` says otherwise.
function fakeStripe(over = {}) {
  const exp = expectedFromCode(configSrc, webhookSrc)
  return async (url) => {
    const m = /payment_links\/(plink_\w+)(\/line_items)?$/.exec(url)
    const id = m[1]
    const o = over[id] || {}
    if (o.missing) return { status: 404, ok: false, json: async () => ({}) }
    if (over.status) return { status: over.status, ok: false, json: async () => ({}) }
    const want = links[id]
    if (m[2]) {
      return { status: 200, ok: true, json: async () => ({ data: [{ price: { unit_amount: o.amount ?? exp[want.interval], currency: o.currency ?? exp.currency, recurring: { interval: o.interval ?? want.interval } } }] }) }
    }
    return { status: 200, ok: true, json: async () => ({ active: o.active ?? true, subscription_data: want.trial ? { trial_period_days: o.trial ?? exp.trialDays } : {} }) }
  }
}
const run = (over, extra = {}) => verify({ fetchFn: fakeStripe(over), key: 'rk_test_secret', configSrc, webhookSrc, ...extra })
const first = Object.keys(links)[0]

describe('verifyStripePrices', () => {
  it('reads the links and the expected prices from the real sources', () => {
    expect(Object.keys(links).length).toBe(4)
    const e = expectedFromCode(configSrc, webhookSrc)
    expect(e).toMatchObject({ month: 499, year: 3999, currency: 'usd', trialDays: 14, webhookTrialDays: 14 })
  })
  it('passes when Stripe matches the code', async () => {
    expect(await run()).toMatchObject({ ok: true, checked: 4 })
  })
  it('flags a different monthly or annual amount', async () => {
    expect((await run({ [first]: { amount: 599 } })).problems[0]).toMatch(/charges 599/)
  })
  it('flags another currency, interval, inactive link, missing link and trial days', async () => {
    expect((await run({ [first]: { currency: 'eur' } })).problems.join()).toMatch(/currency eur/)
    expect((await run({ [first]: { interval: 'week' } })).problems.join()).toMatch(/interval week/)
    expect((await run({ [first]: { active: false } })).problems.join()).toMatch(/not active/)
    expect((await run({ [first]: { missing: true } })).problems.join()).toMatch(/not found in Stripe/)
    const trial = Object.keys(links).find((k) => links[k].trial)
    expect((await run({ [trial]: { trial: 7 } })).problems.join()).toMatch(/trial_period_days 7/)
  })
  it('turns a rejected key into a clear error that never contains the key', async () => {
    await expect(run({ status: 401 })).rejects.toThrow(/rejected the key/)
    await run({ status: 401 }).catch((e) => expect(e.message).not.toContain('rk_test_secret'))
  })
  it('a network error is an exception (exit 2 in the CLI), not a pass', async () => {
    await expect(verify({ fetchFn: async () => { throw new Error('offline') }, key: 'k', configSrc, webhookSrc })).rejects.toThrow(/network/)
  })
  it('flags a landing page with another price and accepts the right ones', async () => {
    const bad = await run({}, { landingTexts: [{ file: 'a.html', text: 'Pro US$ 5,99 al mes' }] })
    expect(bad.problems.join()).toMatch(/a\.html/)
    const good = await run({}, { landingTexts: [{ file: 'b.html', text: 'US$ 4,99 al mes, US$ 39,99 al año, US$ 3,33 por mes' }] })
    expect(good.ok).toBe(true)
  })
  it('flags config and webhook disagreeing', async () => {
    const r = await verify({ fetchFn: fakeStripe(), key: 'k', configSrc: configSrc.replace('proMonthly: 4.99', 'proMonthly: 5.99'), webhookSrc })
    expect(r.problems.join()).toMatch(/month price differs/)
  })
})

describe('verifyStripePrices landing formats', () => {
  it('reads "3,33 US$" (German) and "US$&nbsp;39,99" too', async () => {
    const r = await run({}, { landingTexts: [{ file: 'de.html', text: 'also 3,33 US$/Monat oder US$&nbsp;39,99 und 9,99 US$' }] })
    expect(r.problems.join()).toMatch(/9,99/)
    expect(r.problems.length).toBe(1)
  })
})

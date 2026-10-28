#!/usr/bin/env node
// Read-only check: do the Stripe Payment Links of MOY IQ charge what the code says?
// Compares Stripe (payment links + line items) with src/config.js (config.pricing) and
// supabase/functions/stripe-webhook/webhookLogic.ts (TRIAL_DAYS, PRO_LIST_PRICE_CENTS,
// the plink ids), and, with --landing <dir>, the prices written in the landing pages.
//
//   STRIPE_RO_KEY=rk_live_... node scripts/verifyStripePrices.mjs [--landing <dir>]
//   (key: a RESTRICTED, READ-ONLY key of the MOY IQ Stripe account; it is only sent to api.stripe.com
//    and never printed.) Without the key: `security find-generic-password -s moyiq-stripe-ro -w`.
// Exit: 0 all consistent, 1 mismatch, 2 cannot check (no key, bad key, network).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// Active Payment Links the webhook accepts, with the interval each one must charge.
export function linksFromWebhook(src) {
  const out = {}
  for (const line of src.split('\n')) {
    const m = /(plink_[A-Za-z0-9]+)/.exec(line)
    if (!m || !/(Pro mensual|Pro anual)/.test(line)) continue
    if (line.includes('RETIRED') || /cuenta compartida/.test(line)) continue
    out[m[1]] = { interval: /Pro anual/.test(line) ? 'year' : 'month', trial: /prueba de 14/.test(line) }
  }
  return out
}

export function expectedFromCode(configSrc, webhookSrc) {
  const num = (re, s) => {
    const m = re.exec(s)
    if (!m) throw new Error(`cannot read ${re} from the source`)
    return Number(m[1])
  }
  return {
    month: Math.round(num(/proMonthly:\s*([\d.]+)/, configSrc) * 100),
    year: Math.round(num(/proAnnual:\s*([\d.]+)/, configSrc) * 100),
    currency: /pricing:\s*\{[^}]*?currency:\s*'(\w+)'/s.exec(configSrc)?.[1]?.toLowerCase(),
    trialDays: num(/trialDays:\s*(\d+)/, configSrc),
    webhookTrialDays: num(/export const TRIAL_DAYS = (\d+)/, webhookSrc),
    webhookCents: {
      month: num(/month:\s*(\d+)/, /PRO_LIST_PRICE_CENTS[^{]*\{([^}]*)\}/.exec(webhookSrc)?.[1] ?? ''),
      year: num(/year:\s*(\d+)/, /PRO_LIST_PRICE_CENTS[^{]*\{([^}]*)\}/.exec(webhookSrc)?.[1] ?? ''),
    },
  }
}

class StripeError extends Error {}

async function stripeGet(fetchFn, key, p) {
  let res
  try {
    res = await fetchFn(`https://api.stripe.com/v1/${p}`, { headers: { Authorization: `Bearer ${key}` } })
  } catch (e) {
    throw new StripeError(`network error: ${e.message}`)
  }
  if (res.status === 401 || res.status === 403) throw new StripeError(`Stripe rejected the key (HTTP ${res.status}); check that it is a restricted read key with Payment Links and Prices`)
  if (res.status === 404) return null
  if (!res.ok) throw new StripeError(`Stripe answered HTTP ${res.status}`)
  return res.json()
}

export async function verify({ fetchFn = fetch, key, configSrc, webhookSrc, landingTexts = [] }) {
  const problems = []
  const exp = expectedFromCode(configSrc, webhookSrc)
  if (exp.trialDays !== exp.webhookTrialDays) problems.push(`trial days differ: config ${exp.trialDays} vs webhook ${exp.webhookTrialDays}`)
  for (const k of ['month', 'year']) if (exp[k] !== exp.webhookCents[k]) problems.push(`${k} price differs: config ${exp[k]} vs webhook ${exp.webhookCents[k]}`)
  const links = linksFromWebhook(webhookSrc)
  if (Object.keys(links).length === 0) problems.push('no payment links found in webhookLogic.ts')
  for (const [id, want] of Object.entries(links)) {
    const link = await stripeGet(fetchFn, key, `payment_links/${id}`)
    if (!link) { problems.push(`${id}: not found in Stripe`); continue }
    if (!link.active) problems.push(`${id}: link is not active`)
    const items = await stripeGet(fetchFn, key, `payment_links/${id}/line_items`)
    const price = items?.data?.[0]?.price
    if (!price) { problems.push(`${id}: no line item`); continue }
    if (price.unit_amount !== exp[want.interval]) problems.push(`${id}: charges ${price.unit_amount}, code says ${exp[want.interval]} (${want.interval})`)
    if (price.currency !== exp.currency) problems.push(`${id}: currency ${price.currency}, code says ${exp.currency}`)
    if (price.recurring?.interval !== want.interval) problems.push(`${id}: interval ${price.recurring?.interval}, expected ${want.interval}`)
    if (want.trial) {
      const t = link.subscription_data?.trial_period_days
      if (t !== exp.trialDays) problems.push(`${id}: trial_period_days ${t}, code says ${exp.trialDays}`)
    }
  }
  const money = (cents) => (cents / 100).toFixed(2).replace('.', ',')
  const allowed = new Set([money(exp.month), money(exp.year), money(Math.round(exp.year / 12))])
  for (const { file, text } of landingTexts) {
    for (const m of text.matchAll(/(?:US\$(?:\s|&nbsp;)?(\d{1,3}[,.]\d{2}))|(?:(\d{1,3}[,.]\d{2})(?:\s|&nbsp;)?US\$)/g)) {
      const shown = (m[1] ?? m[2]).replace('.', ',')
      if (!allowed.has(shown)) problems.push(`${file}: shows US$ ${shown}, expected one of ${[...allowed].join(' / ')}`)
    }
  }
  return { ok: problems.length === 0, problems, checked: Object.keys(links).length }
}

async function main() {
  const args = process.argv.slice(2)
  const key = process.env.STRIPE_RO_KEY
  if (!key) {
    console.error('verifyStripePrices: STRIPE_RO_KEY is not set (restricted read-only key of the MOY IQ account)')
    process.exit(2)
  }
  const li = args.indexOf('--landing')
  const landingTexts = []
  if (li >= 0) {
    const dir = args[li + 1]
    for (const f of fs.readdirSync(dir, { recursive: true }).filter((n) => String(n).endsWith('.html') && !/^(blog|docs)\//.test(String(n)))) {
      landingTexts.push({ file: String(f), text: fs.readFileSync(path.join(dir, String(f)), 'utf8') })
    }
  }
  try {
    const r = await verify({
      key,
      configSrc: fs.readFileSync(path.join(ROOT, 'src/config.js'), 'utf8'),
      webhookSrc: fs.readFileSync(path.join(ROOT, 'supabase/functions/stripe-webhook/webhookLogic.ts'), 'utf8'),
      landingTexts,
    })
    for (const p of r.problems) console.log(`MISMATCH ${p}`)
    console.log(`checked ${r.checked} payment links${landingTexts.length ? ` and ${landingTexts.length} landing pages` : ''}: ${r.ok ? 'consistent' : `${r.problems.length} problem(s)`}`)
    process.exit(r.ok ? 0 : 1)
  } catch (e) {
    console.error(`verifyStripePrices: ${e.message.replaceAll(key, '[key]')}`)
    process.exit(2)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()

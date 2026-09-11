// api/fixer.js — Vercel Edge Function
// Fixer proxy for live USD exchange rates (Settings → "moneda secundaria").
// FIXER_API_KEY stays server-side on purpose: FinanceOS is a client-only PWA
// with no other backend, and Fixer's key travels as a plain query param — it
// must never reach the browser bundle or a request the browser makes.
//
// Fixer's free tier only allows EUR as the `base` currency (requesting any
// other base needs a paid plan), and only allows plain HTTP, not HTTPS, to
// data.fixer.io. Both constraints are handled here regardless of which plan
// this account is on: always fetch EUR-based, then convert to "1 USD = X"
// server-side, so the client never has to know about either limitation.
//
// AR, VE and CL are intentionally NOT special-cased away from this endpoint:
// this only feeds Settings' single usdRate field (the dashboard's dual-
// currency header), which today has no live source for any currency. The
// dedicated blue/paralelo rates those three already have (tasaAR.js,
// tasaVE.js, indicadores.js) feed separate features (MultiDolarAR,
// Multimoneda, Debts/HipotecaUF/APV) and are untouched by this.

export const config = { runtime: 'edge' };

const ALLOWED_ORIGINS = ['https://app.moyiq.app', 'https://demo.moyiq.app', 'https://moyiq.app', 'https://app.financeospro.com', 'https://demo.financeospro.com', 'https://financeospro.com'];

// Every currency DEFAULT_USD_RATES covers, plus USD itself as the pivot.
// EUR is deliberately NOT requested: it's the (forced, free-tier) base
// currency, so Fixer returns it implicitly as 1.0 rather than as a symbol —
// asking for it as a symbol too gets rejected. EUR-per-USD is derived below
// from the USD entry instead.
const SYMBOLS = ['USD', 'CLP', 'MXN', 'ARS', 'COP', 'PEN', 'BRL', 'UYU', 'VES'];

// Cross-rate: (units of X per EUR) / (units of USD per EUR) = units of X per USD.
// Works for USD itself too (gives exactly 1). Extracted as its own export so it
// can be unit-tested without invoking the edge handler (network, env vars, etc).
export function computeCrossRates(eurRates) {
  const usdPerEur = eurRates.USD; // "1 EUR = this many USD"
  if (!usdPerEur) return null;
  const rates = {};
  for (const [code, perEur] of Object.entries(eurRates)) {
    rates[code] = Number((perEur / usdPerEur).toFixed(6));
  }
  // EUR was the base, so it was never in `rates` — derive it the same way.
  rates.EUR = Number((1 / usdPerEur).toFixed(6));
  return rates;
}

function buildHeaders(req) {
  const origin = req.headers.get('origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Vary': 'Origin',
    // Fixer's free tier is metered per month, not per day — cache hard.
    // Exchange rates for personal-finance display don't need to be fresher
    // than a few hours.
    'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400',
  };
}

export default async function handler(req) {
  const HEADERS = buildHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: HEADERS });

  const apiKey = process.env.FIXER_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'not_configured' }), { status: 503, headers: HEADERS });
  }

  try {
    // No `base` param on purpose — see file header. HTTP, not HTTPS — Fixer's
    // free tier rejects https_access_restricted otherwise; paid plans accept
    // plain HTTP too, so this is safe on either tier.
    const url = `http://data.fixer.io/api/latest?access_key=${apiKey}&symbols=${SYMBOLS.join(',')}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const json = await res.json();

    if (!json.success) {
      const code = json.error?.type || json.error?.code || 'fixer_error';
      return new Response(JSON.stringify({ error: code }), { status: 502, headers: HEADERS });
    }

    const eurRates = json.rates; // "1 EUR = X" for each requested symbol (includes USD, not EUR)
    const rates = computeCrossRates(eurRates);
    if (!rates) {
      return new Response(JSON.stringify({ error: 'missing_pivot' }), { status: 502, headers: HEADERS });
    }

    return new Response(JSON.stringify({ rates, source: 'fixer', fetchedAt: Date.now() }), { status: 200, headers: HEADERS });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'fetch_failed' }), { status: 500, headers: HEADERS });
  }
}

// src/pages/Investments/hub/tickerSearch.js — ranking del buscador de tickers.
//
// Invest no tiene API de búsqueda (inventario 07, gsMatches): el universo es
// lo de la persona (portafolio y lista) más una lista corta de tickers
// conocidos con su nombre. Cualquier ticker válido escrito se puede abrir
// igual ("Abrir la ficha de T"), y la ficha dice si la API no lo encuentra.
// Lógica pura: sin red ni almacenamiento.
export const SEARCH_TICKER_RE = /^[\^A-Z0-9.\-=]{1,15}$/

// Nombres propios, no se traducen.
export const POPULAR = [
  ['SPY', 'SPDR S&P 500 ETF'], ['QQQ', 'Invesco QQQ (Nasdaq 100)'], ['VOO', 'Vanguard S&P 500 ETF'], ['VT', 'Vanguard Total World Stock ETF'],
  ['IWM', 'iShares Russell 2000 ETF'], ['GLD', 'SPDR Gold Shares'], ['ECH', 'iShares MSCI Chile ETF'], ['EWZ', 'iShares MSCI Brazil ETF'],
  ['AAPL', 'Apple'], ['MSFT', 'Microsoft'], ['NVDA', 'NVIDIA'], ['AMZN', 'Amazon'], ['GOOGL', 'Alphabet (Google)'], ['META', 'Meta Platforms'],
  ['TSLA', 'Tesla'], ['BRK-B', 'Berkshire Hathaway'], ['JPM', 'JPMorgan Chase'], ['KO', 'Coca-Cola'], ['MELI', 'MercadoLibre'],
  ['BTC-USD', 'Bitcoin'], ['ETH-USD', 'Ethereum'],
].map(([t, name]) => ({ t, name }))

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// groups: [{ key: 'portfolio'|'watch'|'popular', items: [{ t, name? }] }]
// Devuelve [{ t, name, group, open? }] — open: true es "Abrir la ficha de T".
export function searchMatches(query, groups, { maxEmpty = 8, max = 7 } = {}) {
  const q = String(query || '').trim()
  const byT = new Map()
  const all = []
  for (const g of groups || []) {
    for (const it of g.items || []) {
      const t = String(it.t || '').toUpperCase()
      if (!t) continue
      const prev = byT.get(t)
      // Repetido: manda el primer grupo (portafolio > lista > conocidos) y se
      // completa el nombre si el primero no lo tenía.
      if (prev) { if (!prev.name && it.name) prev.name = it.name; continue }
      const x = { t, name: it.name || null, group: g.key }
      byT.set(t, x)
      all.push(x)
    }
  }
  if (!q) return all.filter(x => x.group !== 'popular').slice(0, maxEmpty)
  const up = q.toUpperCase(), low = norm(q)
  const score = (x) => (x.t.startsWith(up) ? 0 : x.t.includes(up) ? 1 : x.name && norm(x.name).includes(low) ? 2 : 9)
  const out = all.map(x => ({ x, s: score(x) })).filter(o => o.s < 9)
    .sort((a, b) => a.s - b.s || a.x.t.length - b.x.t.length || a.x.t.localeCompare(b.x.t))
    .slice(0, max).map(o => o.x)
  if (SEARCH_TICKER_RE.test(up) && !out.some(x => x.t === up)) out.push({ t: up, name: null, group: 'typed', open: true })
  return out
}

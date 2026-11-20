// Textos de la ficha: mismas claves y variables en los 4 idiomas, sin voseo
// ni emoji, y cada familia de claves dinámicas completa.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import es from './strings.es.js'
import en from './strings.en.js'
import pt from './strings.pt.js'
import de from './strings.de.js'
import { es as appEs } from '../../../i18n/es.js'
import { ASSET_RANGES, ASSET_TABS, FUND_METRICS } from '../../../utils/investAsset.js'
import { ASSET_TYPES } from '../../../core/investData.js'
import { EXCHANGE_KEYS } from '../../../utils/investQuoteMeta.js'

const L = { es, en, pt, de }
const vars = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort()
const DIR = dirname(fileURLToPath(import.meta.url))

describe('textos de la ficha del activo', () => {
  for (const lang of ['en', 'pt', 'de']) {
    it(`${lang}: mismas claves y variables que el español`, () => {
      expect(Object.keys(L[lang]).sort()).toEqual(Object.keys(es).sort())
      const bad = Object.keys(es).filter(k => vars(es[k]).join() !== vars(L[lang][k]).join())
      expect(bad).toEqual([])
    })
  }
  it('español neutro: sin voseo', () => {
    const vos = /\b(tenés|podés|querés|sabés|elegí|tocá|mirá|buscá|agregá|escribí|probá|hacé|usá|guardá|revisá|vos)\b/i
    expect(Object.entries(es).filter(([, v]) => vos.test(v)).map(([k]) => k)).toEqual([])
  })
  it('sin emoji en ningún idioma', () => {
    for (const d of Object.values(L)) expect(Object.entries(d).filter(([, v]) => /\p{Extended_Pictographic}/u.test(v)).map(([k]) => k)).toEqual([])
  })
  it('familias dinámicas completas', () => {
    const need = [
      ...ASSET_TABS.map(k => `asset.tab.${k}`),
      ...ASSET_RANGES.flatMap(r => [`asset.range.${r.key}`, `asset.range.long.${r.key}`]),
      ...FUND_METRICS.map(([k]) => `asset.fund.m.${k}`),
      ...['T', 'B', 'M'].map(u => `asset.fund.cap.${u}`),
      ...['UP', 'MIX', 'DOWN'].map(k => `asset.trend.${k}`),
      ...['high', 'low', 'mid', 'na'].map(k => `asset.rsi.zone.${k}`),
      ...ASSET_TYPES.map(k => `asset.pos.type.${k}`),
      ...['high', 'mid', 'low'].map(k => `asset.cmp.band.${k}`),
      ...EXCHANGE_KEYS.map(k => `asset.ex.${k}`),
      ...['live', 'delayed', 'closed', 'unknown', 'unknownAt'].map(k => `asset.fresh.${k}`),
      ...['sma200', 'sma50', 'rsi', 'macd', 'vol', 'high52', 'atr'].flatMap(k => [`asset.rd.${k}.label`, `asset.rd.${k}.range`]),
      'asset.rd.sma200.up', 'asset.rd.sma200.down', 'asset.rd.sma50.up', 'asset.rd.sma50.down',
      'asset.rd.rsi.high', 'asset.rd.rsi.low', 'asset.rd.rsi.mid',
      'asset.rd.macd.pos', 'asset.rd.macd.posFading', 'asset.rd.macd.neg', 'asset.rd.macd.negRecovering',
      'asset.rd.vol.high', 'asset.rd.vol.low', 'asset.rd.vol.usual', 'asset.rd.high52.near', 'asset.rd.high52.below', 'asset.rd.atr.typical',
      ...['shares_invalid', 'cost_invalid', 'stop_invalid', 'fx_invalid', 'note_too_long', 'type_invalid', 'price_invalid',
        'qty_or_amount_required', 'qty_invalid', 'amount_invalid', 'date_invalid', 'date_future', 'sell_none', 'sell_too_many'].map(k => `asset.field.${k}`),
    ]
    expect(need.filter(k => !(k in es))).toEqual([])
  })
  it('cada t(\'…\') literal de la ficha existe (en la ficha o en la app)', () => {
    const code = ['../Asset.jsx', ...readdirSync(DIR).filter(f => f.endsWith('.jsx'))].map(f => readFileSync(join(DIR, f), 'utf8')).join('\n')
    const used = [...new Set([...code.matchAll(/\bt\(\s*'([^'$`]+)'/g)].map(m => m[1]))]
    expect(used.length).toBeGreaterThan(50)
    expect(used.filter(k => !(k in es) && !(k in appEs))).toEqual([])
  })
  it('la alerta avisa que llega con Lista; el compartir no lleva datos de la posición', () => {
    expect(es['asset.alert.soon']).toMatch(/Lista/)
    expect(vars(es['asset.share.text'])).toEqual(['name', 'pct', 'price', 't'])
  })
})

describe('privacidad de la ficha', () => {
  it('nada se guarda en el dispositivo (ni ticker ni posición)', () => {
    const files = ['../Asset.jsx', ...readdirSync(DIR).filter(f => /\.jsx?$/.test(f) && !f.includes('.test.') && !f.startsWith('strings.'))]
    const code = files.map(f => readFileSync(join(DIR, f), 'utf8')).join('\n')
    expect(code).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie/)
  })
  it('las noticias piden solo el ticker de esta ficha', () => {
    const code = readFileSync(join(DIR, 'useAssetData.js'), 'utf8')
    const calls = [...code.matchAll(/investApi\.news\(([^)]*)\)/g)].map(m => m[1].trim())
    expect(calls).toEqual(['{ tickers: [ticker] }'])
  })
})

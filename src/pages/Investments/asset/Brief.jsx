// "Esta empresa en 30 segundos": lo primero de la ficha. Qué hace, tamaño, si
// paga dividendos, cuánto subió o bajó en el año y el riesgo en palabras, solo
// con lo que ya trae la API (utils/investEsencial.js: companyBrief). Lo que
// falta no se muestra; si no hay nada, se dice.
import { useId, useMemo } from 'react'
import { companyBrief, sectorKey } from '../../../utils/investEsencial.js'
import { fmtPct } from '../../../utils/index.js'
import { useAssetT } from './assetDict.js'
import { fmtNum } from './format.js'
import s from './asset.module.css'

export default function Brief({ ticker, quote, fund, rows, rowsPhase, type, price, now = Date.now() }) {
  const { t } = useAssetT()
  const id = useId()
  const b = useMemo(() => companyBrief({ quote, fund: fund.data, rows, type, price, now }), [quote, fund.data, rows, type, price, now])
  const title = t(b.crypto ? 'asset.brief.titleCrypto' : b.etf ? 'asset.brief.titleEtf' : 'asset.brief.title')
  const loading = (!b.crypto && (fund.phase === 'loading' || fund.phase === 'idle')) || rowsPhase === 'loading'
  const facts = []
  if (b.size?.band) {
    const c = b.size.cap
    const cap = c ? (c.unit ? t(`asset.fund.cap.${c.unit}`, { n: fmtNum(c.n, c.n >= 100 ? 0 : 1) }) : fmtNum(c.n, 0)) : '—'
    facts.push(['size', t(`asset.brief.size.${b.size.band}`), t('asset.brief.sizeText', { cap })])
  }
  if (b.dividend) {
    const k = b.dividend.kind
    facts.push(['div', t(`asset.brief.div.${k}`), k === 'pays' ? t('asset.brief.div.paysText', { pct: fmtPct(b.dividend.yield, { decimals: 1 }) }) : k === 'none' ? t('asset.brief.div.noneText') : t('asset.brief.div.cryptoText')])
  }
  if (b.year) {
    const p = b.year.pct
    const dir = p > 0.0005 ? 'up' : p < -0.0005 ? 'down' : 'flat'
    facts.push(['year', t(`asset.brief.year.${dir}`, { pct: fmtPct(Math.abs(p), { decimals: 1 }) }), t('asset.brief.yearText', { prev: b.year.year - 1 }), dir === 'up' ? 'pos' : dir === 'down' ? 'neg' : undefined])
  }
  if (b.risk) {
    facts.push(['risk', t(`asset.brief.risk.${b.risk.band}`), `${t(`asset.brief.risk.${b.risk.band}Text`)} ${t('asset.brief.riskBasis', { pct: fmtPct(b.risk.yearly, { decimals: 0 }) })}`])
  }
  // Rubros conocidos, traducidos; el resto tal como viene de la fuente (en inglés).
  const sectors = b.sector.map(x => { const k = sectorKey(x); return k ? { text: t(`asset.sector.${k}`), en: false } : { text: x, en: true } })
  const english = !!b.what || sectors.some(x => x.en)
  return (
    <section className={s.brief} aria-labelledby={`${id}-brief`}>
      <h2 id={`${id}-brief`} className={s.h3}>{title}</h2>
      {(b.what || b.sector.length > 0) && (
        <div className={s.briefWhat}>
          <h3 className={s.briefK}>{t('asset.brief.what')}</h3>
          {b.what && <p className={s.desc} lang="en">{b.what}</p>}
          {sectors.length > 0 && <p className={s.note}>{t('asset.brief.sector', { list: sectors.map(x => x.text).join(' · ') })}</p>}
          {english && <p className={s.note}>{t(b.what ? 'asset.brief.whatLang' : 'asset.brief.sourceLang')}</p>}
        </div>
      )}
      {facts.length > 0 && (
        <dl className={s.facts}>
          {facts.map(([k, head, sub, tone]) => (
            <div key={k}>
              <dt>{t(`asset.brief.k.${k}`)}</dt>
              <dd data-tone={tone}><span>{head}</span><span className={s.factSub}>{sub}</span></dd>
            </div>
          ))}
        </dl>
      )}
      {b.empty && (loading
        ? <p className={s.note} role="status">{t('asset.brief.loading', { t: ticker })}</p>
        : <p className={s.note}>{t('asset.brief.none', { t: ticker })}</p>)}
      {!b.empty && <p className={s.note}>{t('asset.brief.source')}</p>}
    </section>
  )
}

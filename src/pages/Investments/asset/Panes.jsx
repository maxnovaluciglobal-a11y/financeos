// Pestañas de la ficha: Indicadores, Fundamentales, Mi posición y Noticias
// (Invest: renderDrawerBody, drawerFundPane, drawerMinePane, drawerNewsPane).
import { useEffect, useId, useState } from 'react'
import { Check, Pencil, Trash2, X } from 'lucide-react'
import Money from '../../../components/Money.jsx'
import { capParts, earningsSummary, fundMetrics, fundTags, filterNews, hasFundamentals, minePosition, range52, safeLink } from '../../../utils/investAsset.js'
import { fmtPct } from '../../../utils/index.js'
import NewsThumb from '../news/NewsThumb.jsx'
import { useAssetT } from './assetDict.js'
import { fmtDay, fmtEps, fmtNum, fmtPx, fmtPxSigned, fmtStamp, fmtUnits, isCryptoTicker } from './format.js'
import s from './asset.module.css'

function Loading({ text }) { return <p className={s.note} role="status">{text}</p> }

function Retry({ text, onRetry }) {
  const { t } = useAssetT()
  return (
    <div className={s.stateBox}>
      <p className={s.note}>{text}</p>
      {onRetry && <button type="button" className={s.btn} onClick={onRetry}>{t('asset.retry')}</button>}
    </div>
  )
}

// ── Indicadores ──
function readingValue(r) {
  const v = r.value
  if (v.kind === 'pct') return fmtPct(v.v, { signed: !v.unsigned })
  if (v.kind === 'pct0') return fmtPct(v.v, { signed: true, decimals: 0 })
  if (v.kind === 'int') return String(Math.round(v.v))
  return null
}
export function IndicatorsPane({ ticker, ccy, score, phase, onRetry }) {
  const { t } = useAssetT()
  const id = useId()
  const [explain, setExplain] = useState(false)
  if (phase === 'loading' || phase === 'idle') return <Loading text={t('asset.ind.loading')} />
  // Falla de carga ≠ falta de datos: se avisa y se ofrece reintentar.
  if (phase === 'error') return <Retry text={t('asset.ind.error', { t: ticker })} onRetry={onRetry} />
  if (!score) return <p className={s.note}>{t('asset.ind.none', { t: ticker })}</p>
  const rows = score.readings.map(r => {
    const vars = r.key === 'high52' ? { pct: fmtPct(r.vars.pct, { decimals: 0 }) }
      : r.key === 'atr' ? { pct: fmtPct(r.vars.pct, { decimals: 1 }), amt: fmtPx(r.vars.amt, ccy, { decimals: 2 }) } : {}
    const value = r.key === 'macd' ? t(r.value.v === 'above' ? 'asset.macd.above' : 'asset.macd.below') : readingValue(r)
    return { r, vars, value }
  })
  // Grilla como Fundamentales (Walter, 26-nov-2026): nombre, valor y una lectura
  // corta con un punto de color; las explicaciones largas, plegadas debajo.
  return (
    <div className={s.pane}>
      <div className={s.trendRow}>
        {score.trend && <span className={s.tag} data-tone={score.trend === 'UP' ? 'pos' : score.trend === 'DOWN' ? 'neg' : 'neu'}>{t(`asset.trend.${score.trend}`)}</span>}
        <span className={s.note}>{t('asset.ind.basis')}</span>
      </div>
      <dl className={s.metrics}>
        {rows.map(({ r, vars, value }) => (
          <div key={r.key} className={s.metric}>
            <dt>{t(`asset.rd.${r.key}.label`)}</dt>
            <dd className={s.indValue} data-tone={r.tone}>{value}</dd>
            <dd className={s.indShort}><span className={s.indDot} data-tone={r.tone} aria-hidden="true" />{t(`asset.rd.${r.key}.${r.reading}.short`, vars)}</dd>
          </div>
        ))}
      </dl>
      <button type="button" className={s.indToggle} aria-expanded={explain} aria-controls={`${id}-explain`} onClick={() => setExplain(v => !v)}>
        {t(explain ? 'asset.ind.explainHide' : 'asset.ind.explain')}
      </button>
      {explain && (
        <ul id={`${id}-explain`} className={s.readings}>
          {rows.map(({ r, vars }) => (
            <li key={r.key} className={s.reading}>
              <div className={s.readingHead}><span className={s.readingLabel}>{t(`asset.rd.${r.key}.label`)}</span></div>
              <p className={s.readingRange}>{t(`asset.rd.${r.key}.range`)}</p>
              <p className={s.readingText}>{t(`asset.rd.${r.key}.${r.reading}`, vars)}</p>
            </li>
          ))}
        </ul>
      )}
      <p className={s.note}>{t('asset.ind.disclaimer')}</p>
    </div>
  )
}

// ── Fundamentales ──
function metricText(m, t, ccy) {
  if (m.kind === 'div') return m.none ? t('asset.fund.noDiv') : fmtPct(m.v)
  if (m.v == null) return null
  if (m.kind === 'times1') return t('asset.fund.times', { n: fmtNum(m.v, 1) })
  if (m.kind === 'times2') return t('asset.fund.times', { n: fmtNum(m.v, 2) })
  if (m.kind === 'pct') return fmtPct(m.v)
  if (m.kind === 'num2') return fmtNum(m.v, 2)
  if (m.kind === 'eps') return fmtEps(m.v, ccy)
  if (m.kind === 'cap') {
    const c = capParts(m.v)
    return c ? (c.unit ? t(`asset.fund.cap.${c.unit}`, { n: fmtNum(c.n, 2) }) : fmtNum(c.n, 0)) : null
  }
  return null
}

export function Range52({ ccy, price, quote, score }) {
  const { t } = useAssetT()
  const r = range52(price, quote, score)
  const id = useId()
  if (!r) return null
  const p = fmtPct(r.p, { decimals: 0 })
  return (
    <section className={s.block} aria-labelledby={`${id}-r52`}>
      <h3 id={`${id}-r52`} className={s.h3}>{t('asset.r52.title')}</h3>
      <div className={s.r52}>
        <span className={s.num}><span className="sr-only">{t('asset.r52.low')} </span>{fmtPx(r.low, ccy)}</span>
        <span className={s.r52Track} aria-hidden="true"><i style={{ left: `${(r.p * 100).toFixed(0)}%` }} /></span>
        <span className={s.num}><span className="sr-only">{t('asset.r52.high')} </span>{fmtPx(r.high, ccy)}</span>
      </div>
      <p className={s.note}>{t('asset.r52.text', { p })}{r.from === 'candles' ? ` ${t('asset.r52.fromCandles')}` : ''}</p>
    </section>
  )
}

// demo: todo el panel es de ejemplo (sin datos de origen). En el demo con
// datos reales, cada bloque dice lo suyo: fundSample / earnSample.
export function FundamentalsPane({ ticker, ccy, price, quote, score, fund, earn, demo = false, fundSample = demo, earnSample = demo, type, onRetry }) {
  const { t } = useAssetT()
  const id = useId()
  const crypto = isCryptoTicker(ticker, type)
  const f = fund.data
  const e = earningsSummary(earn.data)
  return (
    <div className={s.pane}>
      {fundSample && !crypto && <p className={s.sampleTag}>{t('asset.sample')}</p>}
      {crypto ? <p className={s.note}>{t('asset.fund.crypto')}</p>
        : fund.phase === 'loading' || fund.phase === 'idle' ? <Loading text={t('asset.fund.loading')} />
        : fund.phase === 'error' ? <Retry text={t('asset.fund.error')} onRetry={onRetry} />
        : !hasFundamentals(f) ? <Retry text={t('asset.fund.none', { t: ticker })} onRetry={fundSample ? null : onRetry} />
        : (
          <>
            {fundTags(f).length > 0 && (
              <ul className={s.tags} aria-label={t('asset.fund.tags')}>
                {fundTags(f).map(x => <li key={x} className={s.tag} lang="en">{x}</li>)}
              </ul>
            )}
            {f.description && <><p className={s.desc} lang="en">{f.description}</p><p className={s.note}>{t('asset.fund.descLang')}</p></>}
            <dl className={s.metrics} aria-label={t('asset.fund.metrics', { t: ticker })}>
              {fundMetrics(f, quote).map(m => {
                const txt = metricText(m, t, ccy)
                return (
                  <div key={m.key} className={s.metric}>
                    <dt>{t(`asset.fund.m.${m.key}`)}</dt>
                    <dd className={txt == null ? s.muted : s.num}>{txt == null ? <><span aria-hidden="true">—</span><span className="sr-only">{t('asset.na')}</span></> : txt}</dd>
                  </div>
                )
              })}
            </dl>
            {!fundSample && <p className={s.note}>
              {t('asset.fund.source', { source: f.source === 'finnhub' ? 'Finnhub' : 'Financial Modeling Prep' })}
              {fmtStamp(f.fetchedAt) ? ` ${t('asset.fund.updated', { date: fmtStamp(f.fetchedAt) })}` : ''} {t('asset.fund.differ')}
            </p>}
          </>
        )}

      <Range52 ccy={ccy} price={price} quote={quote} score={score} />

      {!crypto && (
        <section className={s.block} aria-labelledby={`${id}-earn`}>
          <h3 id={`${id}-earn`} className={s.h3}>{t('asset.earn.title')}</h3>
          {earn.phase === 'loading' || earn.phase === 'idle' ? <Loading text={t('asset.earn.loading')} />
            : !e ? <p className={s.note}>{t('asset.earn.none', { t: ticker })}</p>
            : (
              <>
                {earnSample && <p className={s.sampleTag}>{t('asset.sample')}</p>}
                <p className={s.note}>
                  {e.total > 0 ? t('asset.earn.summary', { n: e.beat, total: e.total }) : ''}
                  {e.nextDate ? ` ${t('asset.earn.next', { date: fmtDay(e.nextDate) })}` : ''}
                </p>
                {e.quarters.length > 0 && (
                  // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- the table can scroll sideways on a phone; the region must take focus so keyboard users can scroll it (axe scrollable-region-focusable)
                  <div className={s.tableWrap} role="region" aria-labelledby={`${id}-earn`} tabIndex={0}>
                    <table className={s.table}>
                      <thead><tr>
                        <th scope="col">{t('asset.earn.col.date')}</th>
                        <th scope="col">{t('asset.earn.col.eps')}</th>
                        <th scope="col">{t('asset.earn.col.est')}</th>
                        <th scope="col">{t('asset.earn.col.vs')}</th>
                      </tr></thead>
                      <tbody>
                        {e.quarters.map(q => (
                          <tr key={q.date}>
                            <td className={s.num}>{fmtDay(q.date)}</td>
                            <td className={s.num}>{fmtEps(q.eps, ccy)}</td>
                            <td className={s.num}>{fmtEps(q.epsEst, ccy)}</td>
                            <td>{q.beat === true ? <span className={s.word}><Check size={14} strokeWidth={2.2} aria-hidden="true" />{t('asset.earn.beat')}</span>
                              : q.beat === false ? <span className={s.word}><X size={14} strokeWidth={2.2} aria-hidden="true" />{t('asset.earn.miss')}</span> : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {e.source && !earnSample && <p className={s.note}>{t('asset.earn.source', { source: e.source === 'finnhub' ? 'Finnhub' : 'Financial Modeling Prep' })}</p>}
              </>
            )}
        </section>
      )}
    </div>
  )
}

// ── Mi posición ──
// Desde el 26-nov-2026 es el único lugar con el detalle de la posición: lo que
// mostraba la fila de Portafolio al desplegarse (invertido, resultado, efecto
// del tipo de cambio, riesgo al stop, tipo de cambio de la compra y nota), el
// stop editable (vista completa) y Editar / Eliminar, también por lote.
export function MinePane({ ticker, ccy, price, lots, weight, profile, cols, demo, priceSample = demo, onSaveStop, showStop = true, onEdit, onDelete, busy: lotsBusy = false }) {
  const { t } = useAssetT()
  const id = useId()
  const limit = profile.data?.limit ?? 25
  const w = weight.data
  const m = minePosition(lots, price, { weight: w?.weight ?? null, limit, stopColumn: cols.stop })
  const [stop, setStop] = useState(m?.stop ?? '')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { setStop(m?.stop ?? ''); setErr(null) }, [m?.stop, ticker])
  if (!m) return <p className={s.note}>{t('asset.mine.loading')}</p>

  async function save(e) {
    e.preventDefault()
    const raw = String(stop).trim()
    const n = raw === '' ? null : Number(raw.replace(',', '.'))
    if (n != null && !(n > 0)) { setErr(t('asset.mine.stopInvalid')); return }
    setErr(null); setBusy(true)
    await onSaveStop(n)
    setBusy(false)
  }
  const plTone = m.pl == null ? undefined : m.pl >= 0 ? 'pos' : 'neg'
  const own = (lots || []).filter(h => h && Number(h.sh) > 0)
  const one = own.length === 1 ? own[0] : null
  const fx = w?.fxEffectUsd
  return (
    <div className={s.pane}>
      {/* Con el precio de ejemplo, la cabecera de la ficha ya lo dice: un solo aviso. */}
      {demo && !priceSample && <p className={s.sampleTag}>{t('asset.mine.demo')}</p>}
      <h3 className="sr-only">{t('asset.mine.title', { t: ticker })}</h3>
      <dl className={s.facts}>
        <div><dt>{t('asset.mine.units')}</dt><dd className={s.num}><Money>{fmtUnits(m.sh)}</Money></dd></div>
        <div><dt>{t('asset.mine.avg')}</dt><dd className={s.num}><Money>{fmtPx(m.avgCost, ccy)}</Money></dd></div>
        <div>
          <dt>{t('asset.mine.value')}</dt>
          <dd>
            <span className={s.num}><Money>{fmtPx(m.value, ccy, { decimals: 0 })}</Money></span>
            <span className={s.factSub}>
              {weight.phase === 'loading' ? t('asset.mine.weightLoading')
                : w?.nofx ? t('asset.mine.noFx')
                : m.weight != null ? <>
                  {ccy !== 'USD' && w?.valueUsd != null ? <><Money>{t('asset.mine.approxUsd', { usd: fmtPx(w.valueUsd, 'USD', { decimals: 0 }) })}</Money> · </> : null}
                  {t('asset.mine.weight', { p: fmtPct(m.weight, { decimals: 0 }) })}
                  {m.overLimit ? <> · <strong className={s.warn}>{t('asset.mine.overLimit', { limit })}</strong></> : null}
                </> : null}
            </span>
            {!m.priced && <span className={s.factSub}>{t('asset.mine.noPrice')}</span>}
          </dd>
        </div>
        <div><dt>{t('asset.mine.cost')}</dt><dd className={s.num}><Money>{fmtPx(m.cost, ccy, { decimals: 0 })}</Money></dd></div>
        <div>
          <dt>{t('asset.mine.pl')}</dt>
          <dd className={s.num} data-tone={plTone}>{m.pl == null ? '—' : <><Money>{fmtPxSigned(m.pl, ccy, { decimals: 0 })}</Money>{m.plPct != null ? ` · ${fmtPct(m.plPct, { signed: true })}` : ''}</>}</dd>
        </div>
        {fx != null && Math.abs(fx) >= 0.5 && (
          <div><dt>{t('asset.mine.fxEffect')}</dt><dd className={s.num}><Money>{fmtPxSigned(fx, 'USD', { decimals: 0 })}</Money></dd></div>
        )}
        {showStop && <div>
          <dt>{t('asset.mine.stopRisk')}</dt>
          <dd className={s.num}>
            {m.riskKind === 'stop' || m.riskKind === 'estimate' ? <Money>{fmtPxSigned(m.risk, ccy, { decimals: 0 })}</Money> : m.riskKind === 'noStop' ? t('asset.mine.noStop') : '—'}
            {m.riskKind === 'estimate' && <span className={s.factSub}>{t('asset.mine.stopEst')}</span>}
          </dd>
        </div>}
        {one?.fxCost != null && Number(one.fxCost) > 0 && (
          <div><dt>{t('asset.mine.fxCost', { ccy })}</dt><dd className={s.num}><Money>{fmtUnits(Number(one.fxCost))}</Money></dd></div>
        )}
        {one?.note && <div><dt>{t('asset.mine.note')}</dt><dd className={s.noteText}>{one.note}</dd></div>}
      </dl>
      {m.lots > 1 && <p className={s.note}>{t('asset.mine.lots', { n: m.lots, t: ticker })}</p>}
      {showStop && m.editableStop && (
        <form className={s.stopForm} onSubmit={save} noValidate>
          <label htmlFor={`${id}-stop`} className={s.label}>{t('asset.mine.stopField', { ccy })}</label>
          <div className={s.inline}>
            <input id={`${id}-stop`} className={s.input} type="text" inputMode="decimal" autoComplete="off" value={stop ?? ''} placeholder={t('asset.mine.noStop')}
              aria-invalid={err ? 'true' : undefined} aria-describedby={`${id}-stop-hint${err ? ` ${id}-stop-err` : ''}`}
              onChange={e => setStop(e.target.value)} />
            <button type="submit" className={s.btn} disabled={busy}>{busy ? t('asset.saving') : t('asset.mine.stopSave')}</button>
          </div>
          <p id={`${id}-stop-hint`} className={s.note}>{t('asset.mine.stopHint')}</p>
          {err && <p id={`${id}-stop-err`} className={s.err} role="alert">{err}</p>}
        </form>
      )}
      {one && (onEdit || onDelete) && (
        <div className={s.mineActs}>
          {onEdit && <button type="button" className={s.btn} onClick={() => onEdit(one)} disabled={lotsBusy}><Pencil size={16} strokeWidth={2} aria-hidden="true" />{t('asset.act.editPos')}</button>}
          {onDelete && <button type="button" className={`${s.btn} ${s.btnDanger}`} onClick={() => onDelete(one)} disabled={lotsBusy}><Trash2 size={16} strokeWidth={2} aria-hidden="true" />{t('asset.mine.delete')}</button>}
        </div>
      )}
      {own.length > 1 && (onEdit || onDelete) && (
        <section className={s.block} aria-labelledby={`${id}-lots`}>
          <h4 id={`${id}-lots`} className={s.label}>{t('asset.mine.lotsTitle', { t: ticker })}</h4>
          <ul className={s.lots}>
            {own.map((h, i) => (
              <li key={h.id ?? i}>
                <span className={s.num}><Money>{t('asset.mine.lot', { n: i + 1, units: fmtUnits(Number(h.sh)), entry: fmtPx(Number(h.cost), ccy) })}</Money></span>
                <span className={s.lotActs}>
                  {onEdit && <button type="button" className={s.btn} aria-label={t('asset.mine.lotEditA', { n: i + 1, t: ticker })} onClick={() => onEdit(h)} disabled={lotsBusy}>{t('asset.mine.editShort')}</button>}
                  {onDelete && <button type="button" className={`${s.btn} ${s.btnDanger}`} aria-label={t('asset.mine.lotDeleteA', { n: i + 1, t: ticker })} onClick={() => onDelete(h)} disabled={lotsBusy}>{t('asset.mine.deleteShort')}</button>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

// ── Noticias ──
export function NewsPane({ ticker, news, onRetry }) {
  const { t } = useAssetT()
  if (news.phase === 'loading' || news.phase === 'idle') return <Loading text={t('asset.news.loading')} />
  if (news.phase === 'error') return <Retry text={t('asset.news.error')} onRetry={onRetry} />
  const sample = !!news.data?.sample
  const items = filterNews(news.data?.items, ticker)
  return (
    <div className={s.pane}>
      {sample && <p className={s.sampleTag}>{t('asset.news.sample')}</p>}
      {!items.length ? <p className={s.note}>{t('asset.news.none', { t: ticker })}</p> : (
        <>
          <p className={s.note}>{t('asset.news.lang')}</p>
          <ul className={s.news}>
            {items.map(n => {
              const href = safeLink(n.link)
              const meta = [n.source, n.hoursAgo != null ? t('asset.news.ago', { n: n.hoursAgo }) : null].filter(Boolean).join(' · ')
              return (
                <li key={n.id || n.title}>
                  <div className={s.newsText}>
                    {href
                      ? <a href={href} target="_blank" rel="noopener noreferrer" lang="en" className={s.newsLink}>{n.title}<span className="sr-only"> {t('asset.news.newTab')}</span></a>
                      : <span lang="en" className={s.newsTitle}>{n.title}</span>}
                    {meta && <span className={s.newsMeta}>{meta}</span>}
                  </div>
                  {n.image && <NewsThumb key={n.image} url={n.image} />}
                </li>
              )
            })}
          </ul>
        </>
      )}
      {!sample && <p className={s.note}>{t('asset.news.privacy', { t: ticker })}</p>}
    </div>
  )
}


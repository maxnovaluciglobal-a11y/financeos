// src/pages/Investments/Portfolio.jsx — el portafolio dentro de moyiq (opción B).
// Valor, cambio del día y total, reparto por tipo y una fila por posición con
// su detalle. Las filas se traen al abrir la pantalla y viven solo en memoria
// (core/investBridge.js → fetchPortfolioDetail). Es un visor de solo lectura:
// registrar operaciones se hace en Portafolio › Movimientos de Inversiones
// completo, dentro de la app (onOpenHere). invest.moyiq.app/app ya no existe
// (redirige a la app desde el 23-nov-2026).
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Equal, RefreshCw } from 'lucide-react'
import Money from '../../components/Money.jsx'
import Sheet from '../../components/ui/Sheet.jsx'
import { StateTag } from '../../components/ledger/index.js'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { fetchPortfolioDetail, INVEST_ORIGIN } from '../../core/investBridge.js'
import { demoInvestRows } from '../../demo/demoInvest.js'
import { useInvestPortfolio } from '../../hooks/useInvestPortfolio.js'
import { allocationByType } from '../../utils/investValuation.js'
import { fmtInvestAt, fmtUsd } from '../../utils/investNetWorth.js'
import { currencySymbol, fmtMoney, fmtPct, moneyLocale } from '../../utils/index.js'
import s from './investments.module.css'

const TYPE_COLOR = { ETF: 'var(--cat-1)', Stock: 'var(--cat-2)', Crypto: 'var(--cat-3)', Otro: 'var(--cat-5)' }
const typeKey = (type) => (TYPE_COLOR[type] ? type : 'Otro')

function dirOf(n) { return n > 0 ? 'up' : n < 0 ? 'down' : 'flat' }
function Arrow({ dir, size = 14 }) {
  const Ic = dir === 'up' ? ArrowUp : dir === 'down' ? ArrowDown : Equal
  return <Ic size={size} strokeWidth={2.2} aria-hidden="true" />
}
const sign = (n) => (n < 0 ? '−' : n > 0 ? '+' : '')

// "US$12.500,00" → ["US$12.500", ",00"] para atenuar los centavos como en Inicio.
function splitCents(text) {
  const m = /^(.*?)([.,]\d{2})$/.exec(text)
  return m ? [m[1], m[2]] : [text, '']
}

// Tamaño de la cifra según su largo: siempre en una línea (Bs.11.067.500,00
// no cabe a 52 px en un teléfono de 375). Los centavos van a la mitad.
export function heroFontSize(whole, cents = '') {
  const units = String(whole).length + String(cents).length * 0.5
  return Math.max(28, Math.min(52, Math.floor(330 / Math.max(units, 1) / 0.62)))
}

function useDetail(demo) {
  const [state, setState] = useState(() => (demo ? { rows: demoInvestRows(), phase: 'ready' } : { rows: null, phase: 'loading' }))
  const alive = useRef(true)
  const load = useCallback(() => {
    if (demo) return Promise.resolve()
    setState(st => ({ ...st, phase: st.rows ? 'refreshing' : 'loading' }))
    return fetchPortfolioDetail()
      .then(({ rows }) => { if (alive.current) setState({ rows, phase: 'ready' }) })
      .catch(() => { if (alive.current) setState(st => ({ ...st, phase: st.rows ? 'stale' : 'error' })) })
  }, [demo])
  useEffect(() => { alive.current = true; load(); return () => { alive.current = false } }, [load])
  return { ...state, reload: load }
}

function HoldingDetail({ row, onClose, currency }) {
  const { t } = useT()
  const titleRef = useRef(null)
  if (!row) return <Sheet open={false} onClose={onClose} ariaLabel="" />
  const usd = (n) => (n == null ? '—' : fmtUsd(n, currency))
  const native = (n) => {
    if (n == null) return '—'
    if (row.ccy === 'USD') return fmtUsd(n, currency)
    return `${row.ccy || ''} ${Number(n).toLocaleString(moneyLocale(), { maximumFractionDigits: n < 1 ? 6 : 2 })}`.trim()
  }
  return (
    <Sheet open={!!row} onClose={onClose} ariaLabel={row.t} initialFocusRef={titleRef} initialDetent="medium">
      <div className={s.detail}>
        <div className={s.detailHead}>
          <span className={s.badge} aria-hidden="true">{row.t.replace(/-USD$/, '').slice(0, 4)}</span>
          <div style={{ minWidth: 0 }}>
            <h2 ref={titleRef} tabIndex={-1} className={s.detailTitle}>{row.t}</h2>
            {row.name && <div className={s.detailName}>{row.name}</div>}
          </div>
        </div>
        <dl className={s.detailGrid}>
          <dt>{t('invest.detail.value')}</dt><dd><Money>{usd(row.valueUsd)}</Money></dd>
          <dt>{t('invest.detail.cost')}</dt><dd><Money>{usd(row.costUsd)}</Money></dd>
          <dt>{t('invest.detail.pl')}</dt>
          <dd style={{ color: row.plUsd == null ? undefined : row.plUsd >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
            {row.plUsd == null ? '—' : <><Money>{sign(row.plUsd)}{usd(row.plUsd)}</Money> ({fmtPct(row.plPct, { signed: true })})</>}
          </dd>
          <dt>{t('invest.detail.day')}</dt>
          <dd>{row.dayUsd == null ? '—' : <><Money>{sign(row.dayUsd)}{usd(row.dayUsd)}</Money> ({fmtPct(row.dayPct, { signed: true })})</>}</dd>
          {row.weight != null && <><dt>{t('invest.detail.weight')}</dt><dd>{t('invest.port.share', { p: fmtPct(row.weight, { decimals: 0 }) })}</dd></>}
          <dt>{t('invest.detail.shares')}</dt><dd>{Number(row.sh).toLocaleString(moneyLocale(), { maximumFractionDigits: 8 })}</dd>
          <dt>{t('invest.detail.avgCost')}</dt><dd><Money>{native(row.avgCost)}</Money></dd>
          <dt>{t('invest.detail.price')}</dt><dd><Money>{native(row.price)}</Money></dd>
        </dl>
        <p className={s.note}>{t('invest.detail.ccy', { ccy: row.ccy || '—' })}</p>
        <button type="button" className={s.btn} onClick={onClose}>{t('invest.detail.close')}</button>
      </div>
    </Sheet>
  )
}

export default function Portfolio({ onOpenHere } = {}) {
  const { t } = useT()
  const app = useApp() || {}
  const settings = app.settings || {}
  const currency = settings.currency
  const { demo, snapshot, inv, rate } = useInvestPortfolio()
  const { rows, phase, reload } = useDetail(demo)
  const [selected, setSelected] = useState(null)
  const sym = currencySymbol(settings.currency, settings.language)

  // C8 y C6 de la auditoría de branding (23-nov-2026): el botón abría
  // invest.moyiq.app/app. Ahora, con cuenta o en el demo, abre Portafolio ›
  // Movimientos de Inversiones dentro de la app (onOpenHere).
  const manageBtn = onOpenHere ? <button type="button" className={s.btn} onClick={onOpenHere}>{t('invest.port.manageHere')}</button> : null

  const busy = phase === 'loading' || phase === 'refreshing'
  const empty = (rows && rows.length === 0) || snapshot?.status === 'empty'

  // Una moneda por pantalla (coherencia 360 I-13): las filas y el detalle van
  // en US$, así que la cifra principal también; la moneda de la persona queda
  // como equivalente debajo, solo si hay tasa con fecha.
  const inUserCcy = inv?.amount != null && rate?.source !== 'usd'
  const mainText = inv ? fmtUsd(inv.usd, currency) : null
  const [whole, cents] = mainText ? splitCents(mainText) : ['', '']
  const tag = demo ? t('invest.state.sample')
    : phase === 'stale' ? t('invest.state.stale')
    : snapshot?.status === 'cost' ? t('invest.state.cost')
    : t('invest.state.estimate')

  const alloc = rows ? allocationByType(rows) : []
  const names = snapshot ? [snapshot.yahoo && 'Yahoo Finance', snapshot.coingecko && 'CoinGecko'].filter(Boolean) : []

  return (
    <div className={s.page}>
      <section className={s.hero} aria-labelledby="invest-hero-label">
        <div className={s.heroTop}>
          <span id="invest-hero-label" className={s.heroLabel}>{t('invest.port.value')}</span>
          {!demo && (
            <button type="button" className={s.refresh} onClick={reload} disabled={busy} aria-label={t('invest.port.refresh')}>
              <RefreshCw size={16} strokeWidth={2} aria-hidden="true" className={busy ? s.spin : undefined} />
            </button>
          )}
        </div>
        {mainText ? (
          <div className={s.heroValue} style={{ fontSize: heroFontSize(whole, cents) }}><Money>{whole}<span className={s.heroCents}>{cents}</span></Money></div>
        ) : (
          <p className={s.heroSub} role="status" style={{ margin: '14px 0 6px' }}>
            {phase === 'error' ? t('invest.card.error') : empty ? t('invest.port.empty') : t('invest.card.loading')}
          </p>
        )}
        {inUserCcy && <div className={s.heroSub}>≈ <Money>{fmtMoney(inv.amount, sym)}</Money></div>}
        {snapshot?.status === 'live' && (
          <div className={s.heroChanges}>
            {snapshot.dayUsd != null && (
              <span className={s.chip} data-tone={dirOf(snapshot.dayUsd)}>
                <Arrow dir={dirOf(snapshot.dayUsd)} />{t('invest.card.day')} <Money>{sign(snapshot.dayUsd)}{fmtUsd(snapshot.dayUsd, currency)}</Money> ({fmtPct(snapshot.dayPct, { signed: true })})
              </span>
            )}
            {snapshot.totalUsd != null && (
              <span className={s.chip} data-tone={dirOf(snapshot.totalUsd)}>
                <Arrow dir={dirOf(snapshot.totalUsd)} />{t('invest.card.total')} <Money>{sign(snapshot.totalUsd)}{fmtUsd(snapshot.totalUsd, currency)}</Money> ({fmtPct(snapshot.totalPct, { signed: true })})
              </span>
            )}
          </div>
        )}
        {snapshot && snapshot.status !== 'empty' && (
          <p className={s.heroMeta}>
            <StateTag tone="muted" label={tag} size={12} style={{ color: 'inherit', marginRight: 6 }} />
            {t(snapshot.positions === 1 ? 'invest.card.positions.one' : 'invest.card.positions.many', { n: snapshot.positions })} · {t('invest.card.asOf', { at: fmtInvestAt(snapshot.pricesAt || snapshot.at) })}
          </p>
        )}
      </section>

      {phase === 'stale' && <p className={s.status}>{t('invest.card.staleNote', { at: fmtInvestAt(snapshot?.at) })}</p>}
      {phase === 'error' && (
        <div className={s.actions}>
          <button type="button" className={s.btn} onClick={reload}><RefreshCw size={16} strokeWidth={2} aria-hidden="true" />{t('invest.card.retry')}</button>
        </div>
      )}

      {alloc.length > 0 && (
        <section className={s.section} aria-labelledby="invest-alloc-title">
          <div className={s.sectionHead}><h2 id="invest-alloc-title" className={s.sectionTitle}>{t('invest.port.alloc')}</h2></div>
          <div className={s.allocBar} aria-hidden="true">
            {alloc.map(a => <span key={a.type} className={s.allocSeg} style={{ flexGrow: a.share, background: TYPE_COLOR[typeKey(a.type)] }} />)}
          </div>
          <ul className={s.allocLegend}>
            {alloc.map(a => (
              <li key={a.type} className={s.allocItem}>
                <span className={s.allocDot} style={{ background: TYPE_COLOR[typeKey(a.type)] }} aria-hidden="true" />
                {t(`invest.type.${typeKey(a.type)}`)}
                <span className={s.allocPct}>{fmtPct(a.share, { decimals: 0 })}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {rows && rows.length > 0 && (
        <section className={s.section} aria-labelledby="invest-hold-title">
          <div className={s.sectionHead}>
            <h2 id="invest-hold-title" className={s.sectionTitle}>{t('invest.port.holdings')}</h2>
            <span className={s.sectionHint}>{t(rows.length === 1 ? 'invest.card.positions.one' : 'invest.card.positions.many', { n: rows.length })}</span>
          </div>
          <ul className={s.list}>
            {rows.map((r, i) => (
              // INV-N15: puede haber dos lotes del mismo ticker; el ticker no sirve de key.
              <li key={r.id ?? `${r.t}-${i}`}>
                <button type="button" className={s.row} onClick={() => setSelected(r)}>
                  <span className={s.badge} aria-hidden="true">{r.t.replace(/-USD$/, '').slice(0, 4)}</span>
                  <span className={s.rowMain}>
                    <span className={s.rowTicker} style={{ display: 'block' }}>{r.t}</span>
                    <span className={s.rowSub} style={{ display: 'block' }}>
                      {t(`invest.type.${typeKey(r.type)}`)} · {t('invest.port.shares', { n: Number(r.sh).toLocaleString(moneyLocale(), { maximumFractionDigits: 6 }) })}
                    </span>
                  </span>
                  <span className={s.rowRight}>
                    <span className={s.rowValue}><Money>{r.valueUsd == null ? '—' : fmtUsd(r.valueUsd, currency)}</Money></span>
                    {r.status === 'live' && r.plUsd != null ? (
                      <span className={s.rowPl} style={{ color: r.plUsd >= 0 ? 'var(--pos)' : 'var(--neg)', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                        <Arrow dir={dirOf(r.plUsd)} size={12} />{fmtPct(r.plPct, { signed: true })}
                      </span>
                    ) : (
                      <span className={s.rowPl} style={{ color: 'var(--th)' }}>{r.status === 'nofx' ? t('invest.port.noFx') : t('invest.port.atCost')}</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className={s.actions}>
        {empty && !demo && onOpenHere
          ? <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={onOpenHere}>{t('invest.port.addFirst')}</button>
          : manageBtn}
      </div>

      <div className={s.notes}>
        {names.length > 0 && <p className={s.note}>{t('invest.card.source', { source: names.join(', ') })}</p>}
        <div className={s.links}>
          <a href={`${INVEST_ORIGIN}/datos-y-licencias.html`} target="_blank" rel="noopener noreferrer">{t('invest.card.sourcesLink')}</a>
          {snapshot?.coingecko && <a href="https://www.coingecko.com/en/api" target="_blank" rel="noopener noreferrer">Powered by CoinGecko API</a>}
        </div>
        <p className={s.note}>{t('invest.privacy')}</p>
        <p className={s.note}>{t('invest.legal')}</p>
      </div>

      <HoldingDetail row={selected} onClose={() => setSelected(null)} currency={currency} />
    </div>
  )
}

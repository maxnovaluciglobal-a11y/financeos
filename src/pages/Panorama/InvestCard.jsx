// src/pages/Panorama/InvestCard.jsx — módulo Inversiones (Opción 1 de D-08).
// Muestra el portafolio de Invest: valor, cambio del día y total, posiciones y
// de cuándo y de dónde es el dato. Es una estimación de solo lectura; el detalle
// de las posiciones está en la pantalla Inversiones dentro de moyiq (opción B,
// 19-nov-2026) y registrar operaciones sigue en Invest. Nunca lleva ProGate:
// los datos de mercado no tienen licencia comercial (INV-1). Sin perfil de
// inversionista la tarjeta invita a activarlo y no pide datos.
import { useState } from 'react'
import { ChevronRight, RefreshCw } from 'lucide-react'
import Money, { useMoney } from '../../components/Money.jsx'
import { Delta, StateTag } from '../../components/ledger/index.js'
import { NAV_ICONS } from '../../components/icons/Icons.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { INVEST_ORIGIN } from '../../core/investBridge.js'
import { openInvest } from '../../core/investHandoff.js'
import { useInvestPortfolio } from '../../hooks/useInvestPortfolio.js'
import { investFullHere } from '../../utils/uiFlags.js'
import { queueInvestTab } from '../../utils/investNav.js'
import { aporteHandoff, fmtInvestAt, fmtUsd, monthContributions } from '../../utils/investNetWorth.js'
import { currencySymbol, currentMonth, fmtMoney, fmtPct } from '../../utils/index.js'
import hs from '../Dashboard/Home.module.css'
import s from './investCard.module.css'

function Change({ label, usd, pct, currency }) {
  const { m } = useMoney()
  if (usd == null) return null
  const dir = usd > 0 ? 'up' : usd < 0 ? 'down' : 'flat'
  return (
    <Delta dir={dir} good={usd >= 0}>
      {label} {usd < 0 ? '−' : usd > 0 ? '+' : ''}{m(fmtUsd(usd, currency))} ({fmtPct(pct, { signed: true })})
    </Delta>
  )
}

function Sources({ snapshot, t }) {
  const names = [snapshot.yahoo && 'Yahoo Finance', snapshot.coingecko && 'CoinGecko'].filter(Boolean)
  return (
    <>
      {names.length > 0 && <p className={s.meta}>{t('invest.card.source', { source: names.join(', ') })}</p>}
      <div className={s.links}>
        <a href={`${INVEST_ORIGIN}/datos-y-licencias.html`} target="_blank" rel="noopener noreferrer">{t('invest.card.sourcesLink')}</a>
        {/* CoinGecko pide su atribución junto a sus datos (C-33). */}
        {snapshot.coingecko && <a href="https://www.coingecko.com/en/api" target="_blank" rel="noopener noreferrer">Powered by CoinGecko API</a>}
      </div>
    </>
  )
}

export default function InvestCard({ setPage } = {}) {
  const { t } = useT()
  const app = useApp() || {}
  const settings = app.settings || {}
  const { demo, phase, snapshot, inv, rate, refresh, offline } = useInvestPortfolio()
  const [opening, setOpening] = useState(false)

  const sym = currencySymbol(settings.currency, settings.language)
  const month = settings.activeMonth || currentMonth()
  const contrib = monthContributions(app.expenses, month, app.setAsides)

  // Con Inversiones completo (UI_FLAGS.investFull) el aporte se registra
  // dentro de moyiq: Portafolio › Movimientos ofrece el depósito. Sin él,
  // sigue el traspaso a Invest de siempre.
  const full = investFullHere()
  function open(aporte) {
    if (full && setPage) { queueInvestTab('portafolio', 'movimientos'); setPage('investments'); return }
    setOpening(true)
    openInvest({ aporte }).finally(() => setOpening(false))
  }

  // "Ver portafolio" abre la pantalla Inversiones dentro de moyiq (opción B).
  const goPage = () => setPage?.('investments')
  const cta = <button type="button" className={hs.btnSecondary} onClick={goPage}>{t('invest.card.view')}<ChevronRight size={16} strokeWidth={2} aria-hidden="true" /></button>

  const heading = (tag) => (
    <div className={s.head}>
      <h2 id="pano-invest-title" className={hs.scoreLabel} style={{ margin: 0 }}>
        {NAV_ICONS.investments ? <NAV_ICONS.investments size={14} /> : null}{t('nav.investments')}
      </h2>
      {tag}
    </div>
  )

  const body = () => {
    if (phase === 'locked') {
      return (
        <>
          {heading(null)}
          <p className={s.note}>{t('invest.card.locked')}</p>
          <div className={s.actions}><button type="button" className={hs.btnSecondary} onClick={goPage}>{t('invest.card.unlock')}<ChevronRight size={16} strokeWidth={2} aria-hidden="true" /></button></div>
        </>
      )
    }
    if (!snapshot) {
      if (phase === 'error') {
        return (
          <>
            {heading(<StateTag tone="risk" label={t('invest.state.error')} />)}
            <p className={s.note}>{offline ? t('invest.card.errorOffline') : t('invest.card.error')}</p>
            <div className={s.actions}>
              <button type="button" className={hs.btnSecondary} onClick={refresh}><RefreshCw size={14} strokeWidth={1.8} aria-hidden="true" />{t('invest.card.retry')}</button>
            </div>
          </>
        )
      }
      return (
        <>
          {heading(<StateTag tone="muted" label={t('invest.state.loading')} />)}
          <p className={s.note} role="status">{t('invest.card.loading')}</p>
        </>
      )
    }

    if (snapshot.status === 'empty') {
      return (
        <>
          {heading(null)}
          <p className={s.note}>{t('invest.card.empty')}</p>
          <div className={s.actions}>{cta}</div>
        </>
      )
    }

    const tag = demo ? <StateTag tone="muted" label={t('invest.state.sample')} />
      : phase === 'stale' ? <StateTag tone="warn" label={offline ? t('invest.state.offline') : t('invest.state.stale')} />
      : snapshot.status === 'cost' ? <StateTag tone="warn" label={t('invest.state.cost')} />
      : snapshot.status === 'nofx' ? <StateTag tone="warn" label={t('invest.state.nofx')} />
      : <StateTag tone="ok" label={t('invest.state.estimate')} />

    const inUserCcy = inv?.amount != null && rate?.source !== 'usd'
    const asOf = fmtInvestAt(snapshot.pricesAt || snapshot.at)

    return (
      <>
        {heading(tag)}
        {inv && (
          <div className={`num ${hs.nwValue}`}>
            <Money>{inUserCcy ? fmtMoney(inv.amount, sym) : fmtUsd(inv.usd, settings.currency)}</Money>
          </div>
        )}
        {inUserCcy && <div className={s.sub}>≈ <Money>{fmtUsd(inv.usd, settings.currency)}</Money></div>}
        {snapshot.status === 'live' && (
          <div className={s.changes}>
            <Change label={t('invest.card.day')} usd={snapshot.dayUsd} pct={snapshot.dayPct} currency={settings.currency} />
            <Change label={t('invest.card.total')} usd={snapshot.totalUsd} pct={snapshot.totalPct} currency={settings.currency} />
          </div>
        )}
        <p className={s.meta}>
          {t(snapshot.positions === 1 ? 'invest.card.positions.one' : 'invest.card.positions.many', { n: snapshot.positions })} · {t('invest.card.asOf', { at: asOf })}
        </p>
        {phase === 'stale' && <p className={s.notice}>{t('invest.card.staleNote', { at: fmtInvestAt(snapshot.at) })}</p>}
        {snapshot.status === 'cost' && <p className={s.notice}>{t('invest.card.costNote')}</p>}
        {snapshot.excluded > 0 && <p className={s.notice}>{t(snapshot.excluded === 1 ? 'invest.card.excluded.one' : 'invest.card.excluded.many', { n: snapshot.excluded })}</p>}
        {snapshot.status === 'live' && snapshot.missing > 0 && <p className={s.notice}>{t(snapshot.missing === 1 ? 'invest.card.missing.one' : 'invest.card.missing.many', { n: snapshot.missing })}</p>}
        <Sources snapshot={snapshot} t={t} />
        {contrib.count > 0 && (demo && !full
          ? <a className={s.aporte} href={`${INVEST_ORIGIN}/app/`} target="_blank" rel="noopener noreferrer">{t(contrib.count === 1 ? 'invest.aportes.one' : 'invest.aportes.many', { n: contrib.count })}</a>
          : <button type="button" className={s.aporte} disabled={opening} onClick={() => open(aporteHandoff(contrib, settings, rate))}>{t(contrib.count === 1 ? 'invest.aportes.one' : 'invest.aportes.many', { n: contrib.count })}</button>
        )}
        <div className={s.actions}>{cta}</div>
      </>
    )
  }

  return (
    <section className={`${hs.card} rise`} aria-labelledby="pano-invest-title" data-tour="pano-invest">
      <div className={s.wrap}>{body()}</div>
      <p className={s.legal}>{t('invest.privacy')}</p>
      <p className={s.legal}>{t('invest.legal')}</p>
    </section>
  )
}

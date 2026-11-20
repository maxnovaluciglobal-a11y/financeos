// src/pages/Investments/hub/InvestHub.jsx — Inversiones completo (F0).
// Solo se monta con UI_FLAGS.investFull y con acceso (perfil de inversionista,
// ver ../index.jsx). Cinco pestañas arriba (control segmentado del patrón APG)
// y el buscador de tickers. Hoy (F2) y Portafolio (F1: portfolio/PortfolioTab.jsx)
// ya son las completas; las demás dicen con honestidad qué traen mientras no están.
// La pestaña vive en la entrada del historial y en fos_invest_tab (investNav).
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { Hammer } from 'lucide-react'
import { useT } from '../../../i18n/useT.js'
import { INVEST_TABS, bootTab, isTab, openAsset, rememberTab, tabKeyTarget } from '../../../utils/investNav.js'
import { demoInvestRows } from '../../../demo/demoInvest.js'
import PortfolioTab from '../portfolio/PortfolioTab.jsx'
import TickerSearch from './TickerSearch.jsx'
import s from './hub.module.css'

// Hoy (F2) en su propio chunk: solo se baja al abrir la pestaña.
const Hoy = lazy(() => import('../hoy/Hoy.jsx'))

const safeStorage = {
  getItem: (k) => { try { return localStorage.getItem(k) } catch { return null } },
  setItem: (k, v) => { try { localStorage.setItem(k, v) } catch { /* modo privado: la pestaña queda en el historial */ } },
}

// Aviso honesto de "en construcción" con lo que la sección va a traer.
export function Wip({ id, text }) {
  const { t } = useT()
  return (
    <section className={s.wip} aria-labelledby={`invest-wip-${id}`}>
      <span id={`invest-wip-${id}`} className={s.wipTag}><Hammer size={14} strokeWidth={2} aria-hidden="true" />{t('invest.hub.wip')}</span>
      <p className={s.wipBody}>{t('invest.hub.wipBody')}</p>
      <p className={s.wipList}>{text}</p>
    </section>
  )
}

export default function InvestHub({ setPage, demo = false }) {
  const { t } = useT()
  const [tab, setTab] = useState(() => bootTab({ storage: safeStorage }))
  const refs = useRef({})

  useEffect(() => { rememberTab(tab, safeStorage) }, [tab])
  // Atrás/Adelante entre dos entradas de Inversiones: la pestaña de esa entrada.
  useEffect(() => {
    const onPop = (e) => { if (isTab(e.state?.invTab)) setTab(e.state.invTab) }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  function onKey(e) {
    const next = tabKeyTarget(e.key, tab)
    if (!next) return
    e.preventDefault()
    setTab(next)
    refs.current[next]?.focus()
  }
  const open = useCallback((ticker) => openAsset(setPage, ticker), [setPage])
  // Desde una tarjeta de Hoy a otra pestaña ("Ver en Portafolio", "Ver mercado"):
  // sube al principio para que la pestaña nueva se lea desde arriba.
  const go = useCallback((next) => {
    if (!isTab(next)) return
    setTab(next)
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => refs.current[next]?.focus())
  }, [])

  return (
    <div className={s.hub}>
      <div role="tablist" aria-label={t('invest.hub.tabsLabel')} className={s.tabs}>
        {INVEST_TABS.map(k => (
          <button key={k} ref={el => { refs.current[k] = el }} type="button" role="tab" id={`invest-tab-${k}`}
            aria-selected={tab === k} aria-controls={`invest-panel-${k}`} tabIndex={tab === k ? 0 : -1}
            className={s.tab} onClick={() => setTab(k)} onKeyDown={onKey}>
            {t(`invest.hub.tab.${k}`)}
          </button>
        ))}
      </div>

      <TickerSearch onOpen={open} demo={demo} demoTickers={demo ? demoInvestRows().map(r => r.t) : []} />

      <div role="tabpanel" id={`invest-panel-${tab}`} aria-labelledby={`invest-tab-${tab}`} tabIndex={0}>
        {tab === 'hoy'
          ? <Suspense fallback={<p className={s.wipBody} role="status">{t('invest.card.loading')}</p>}><Hoy demo={demo} onOpen={open} onTab={go} /></Suspense>
          : tab === 'portafolio'
            ? <PortfolioTab setPage={setPage} demo={demo} />
            : <Wip id={tab} text={t(`invest.hub.soon.${tab}`)} />}
      </div>
    </div>
  )
}

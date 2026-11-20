// src/pages/Investments/hub/InvestHub.jsx — Inversiones completo (F0).
// Solo se monta con UI_FLAGS.investFull y con acceso (perfil de inversionista,
// ver ../index.jsx). Cinco pestañas arriba (control segmentado del patrón APG)
// y el buscador de tickers. Cada pestaña dice con honestidad qué trae cuando
// todavía no está; Portafolio ya muestra el visor actual.
// La pestaña vive en la entrada del historial y en fos_invest_tab (investNav).
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { Hammer } from 'lucide-react'
import { useT } from '../../../i18n/useT.js'
import { INVEST_TABS, bootTab, isTab, openAsset, rememberTab, tabKeyTarget } from '../../../utils/investNav.js'
import { demoInvestRows } from '../../../demo/demoInvest.js'
import Portfolio from '../Portfolio.jsx'
import TickerSearch from './TickerSearch.jsx'
import s from './hub.module.css'

// Mercado (F6) en su propio chunk: solo se baja al abrir la pestaña.
const Market = lazy(() => import('../market/Market.jsx'))

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
  // Desde una pestaña a otra (Mercado › "Ver lecturas de tu lista"): el foco
  // va a la pestaña nueva para que el lector de pantalla anuncie el cambio.
  const goTab = useCallback((k) => {
    if (!isTab(k)) return
    setTab(k)
    setTimeout(() => refs.current[k]?.focus(), 0)
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
        {tab === 'portafolio'
          ? <div className={s.hub}><Wip id="portafolio" text={t('invest.hub.soon.portafolio')} /><Portfolio /></div>
          : tab === 'mercado'
            ? <Suspense fallback={<p className={s.wipBody} role="status">{t('invest.mkt.fresh.loading')}</p>}><Market demo={demo} onOpen={open} onTab={goTab} /></Suspense>
            : <Wip id={tab} text={t(`invest.hub.soon.${tab}`)} />}
      </div>
    </div>
  )
}

// src/pages/Investments/hub/InvestHub.jsx — Inversiones completo (F0).
// Solo se monta con UI_FLAGS.investFull y con acceso (perfil de inversionista,
// ver ../index.jsx). Cinco pestañas arriba (control segmentado del patrón APG)
// y el buscador de tickers. Resumen (F2, antes "Hoy"), Portafolio (F1:
// portfolio/PortfolioTab.jsx) y Mercado (F6) ya son las completas; Siguiendo
// (antes "Lista") dice con honestidad qué trae mientras no está. Planificar
// (F5: calculadora, aportes y planes guardados) también va en su chunk.
// La pestaña vive en la entrada del historial y en fos_invest_tab (investNav).
// Arriba, el interruptor "Vista completa" (esencial por defecto,
// utils/investView.js) y el aviso educativo.
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { Hammer } from 'lucide-react'
import { useT } from '../../../i18n/useT.js'
import { INVEST_TABS, bootTab, isTab, normTab, openAsset, rememberTab, tabKeyTarget } from '../../../utils/investNav.js'
import { demoInvestRows } from '../../../demo/demoInvest.js'
import PortfolioTab from '../portfolio/PortfolioTab.jsx'
import TickerSearch from './TickerSearch.jsx'
import { EduNotice, ViewToggle } from '../esencial/ViewToggle.jsx'
import { useInvestView } from '../esencial/useInvestView.js'
import s from './hub.module.css'

// Resumen (F2) y Mercado (F6) en su propio chunk: solo se bajan al abrir la pestaña.
const Hoy = lazy(() => import('../hoy/Hoy.jsx'))
const Market = lazy(() => import('../market/Market.jsx'))
const Planificar = lazy(() => import('../planificar/Planificar.jsx'))

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
  const [view, setView] = useInvestView()
  const refs = useRef({})

  useEffect(() => { rememberTab(tab, safeStorage) }, [tab])
  // Atrás/Adelante entre dos entradas de Inversiones: la pestaña de esa entrada.
  useEffect(() => {
    const onPop = (e) => { const tb = normTab(e.state?.invTab); if (tb) setTab(tb) }
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
  // De una pestaña a otra (Resumen › "Ver en Portafolio", Mercado › "Ver
  // lecturas de Siguiendo"): el foco va a la pestaña nueva, que se lee desde arriba y el
  // lector de pantalla anuncia el cambio.
  const go = useCallback((to) => {
    const next = normTab(to)
    if (!isTab(next)) return
    setTab(next)
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => refs.current[next]?.focus())
    else setTimeout(() => refs.current[next]?.focus(), 0)
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

      <ViewToggle view={view} onChange={setView} />
      <EduNotice />

      <TickerSearch onOpen={open} demo={demo} demoTickers={demo ? demoInvestRows().map(r => r.t) : []} />

      <div role="tabpanel" id={`invest-panel-${tab}`} aria-labelledby={`invest-tab-${tab}`} tabIndex={0}>
        {tab === 'resumen'
          ? <Suspense fallback={<p className={s.wipBody} role="status">{t('invest.card.loading')}</p>}><Hoy demo={demo} onOpen={open} onTab={go} view={view} /></Suspense>
          : tab === 'portafolio'
            ? <PortfolioTab setPage={setPage} demo={demo} view={view} />
            : tab === 'mercado'
              ? <Suspense fallback={<p className={s.wipBody} role="status">{t('invest.mkt.fresh.loading')}</p>}><Market demo={demo} onOpen={open} onTab={go} view={view} /></Suspense>
              : tab === 'planificar'
                ? <Suspense fallback={<p className={s.wipBody} role="status">{t('invest.card.loading')}</p>}><Planificar demo={demo} view={view} onTab={go} /></Suspense>
                : <Wip id={tab} text={t(`invest.hub.soon.${tab}`)} />}
      </div>
    </div>
  )
}

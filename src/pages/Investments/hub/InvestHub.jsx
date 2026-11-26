// src/pages/Investments/hub/InvestHub.jsx — Inversiones completo (F0).
// Solo se monta con UI_FLAGS.investFull y con acceso (perfil de inversionista,
// ver ../index.jsx). Cinco pestañas arriba (control segmentado del patrón APG)
// y el buscador de tickers. Resumen (F2, antes "Hoy"), Portafolio (F1:
// portfolio/PortfolioTab.jsx) y Mercado (F6) ya son las completas;
// Siguiendo (F4: follow/Follow.jsx, antes "Lista") y Planificar (F5:
// planificar/Planificar.jsx: calculadora, aportes y planes guardados) también,
// cada una en su chunk.
// La pestaña vive en la entrada del historial y en fos_invest_tab (investNav).
// Arriba, el interruptor "Vista completa" (esencial por defecto,
// utils/investView.js) y el aviso educativo.
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { CircleHelp, Hammer } from 'lucide-react'
import { useT } from '../../../i18n/useT.js'
import { INVEST_TABS, OPEN_EVENT, bootTab, isTab, normTab, openAsset, rememberTab, tabKeyTarget } from '../../../utils/investNav.js'
import { demoInvestRows } from '../../../demo/demoInvest.js'
import PortfolioTab from '../portfolio/PortfolioTab.jsx'
import TickerSearch from './TickerSearch.jsx'
import { EduNotice, ViewToggle } from '../esencial/ViewToggle.jsx'
import { useInvestView } from '../esencial/useInvestView.js'
import s from './hub.module.css'

// Resumen (F2) y Mercado (F6) en su propio chunk: solo se bajan al abrir la pestaña.
const Hoy = lazy(() => import('../hoy/Hoy.jsx'))
const Market = lazy(() => import('../market/Market.jsx'))
// Siguiendo (F4), igual: Mi lista, Alertas, Descubrir y Comparar con sus textos.
const Follow = lazy(() => import('../follow/Follow.jsx'))
// Planificar (F5): calculadora, aportes y planes guardados.
const Planificar = lazy(() => import('../planificar/Planificar.jsx'))
// Ayuda (F7): la hoja y sus textos, solo al tocar "Ayuda".
const InvestHelp = lazy(() => import('../help/InvestHelp.jsx'))

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
  const [help, setHelp] = useState(false)
  const helpBtn = useRef(null)
  const refs = useRef({})

  useEffect(() => { rememberTab(tab, safeStorage) }, [tab])
  // Atrás/Adelante entre dos entradas de Inversiones: la pestaña de esa entrada.
  useEffect(() => {
    const onPop = (e) => { const tb = normTab(e.state?.invTab); if (tb) setTab(tb) }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  // Aviso push tocado con Inversiones ya abierta (utils/swOpen.js): la pestaña
  // pedida, sin recargar.
  useEffect(() => {
    const onOpen = () => setTab(bootTab({ storage: safeStorage }))
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_EVENT, onOpen)
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
      <div role="tablist" aria-label={t('invest.hub.tabsLabel')} className={s.tabs} data-tour="inv-tabs">
        {INVEST_TABS.map(k => (
          <button key={k} ref={el => { refs.current[k] = el }} type="button" role="tab" id={`invest-tab-${k}`}
            aria-selected={tab === k} aria-controls={`invest-panel-${k}`} tabIndex={tab === k ? 0 : -1}
            className={s.tab} onClick={() => setTab(k)} onKeyDown={onKey}>
            {t(`invest.hub.tab.${k}`)}
          </button>
        ))}
      </div>

      <div className={s.toolRow} data-tour="inv-tools">
        <ViewToggle view={view} onChange={setView} />
        <button ref={helpBtn} type="button" className={s.helpBtn} onClick={() => setHelp(true)} aria-label={t('invest.hub.helpLabel')} aria-haspopup="dialog">
          <CircleHelp size={18} strokeWidth={1.8} aria-hidden="true" />{t('invest.hub.help')}
        </button>
      </div>
      <EduNotice />
      {help && (
        <Suspense fallback={null}>
          <InvestHelp open={help} onClose={() => { setHelp(false); helpBtn.current?.focus() }} />
        </Suspense>
      )}

      <TickerSearch onOpen={open} demo={demo} demoTickers={demo ? demoInvestRows().map(r => r.t) : []} />

      <div role="tabpanel" id={`invest-panel-${tab}`} aria-labelledby={`invest-tab-${tab}`} tabIndex={0}>
        {tab === 'resumen'
          ? <Suspense fallback={<p className={s.wipBody} role="status">{t('invest.card.loading')}</p>}><Hoy demo={demo} onOpen={open} onTab={go} view={view} /></Suspense>
          : tab === 'portafolio'
            ? <PortfolioTab setPage={setPage} demo={demo} view={view} />
            : tab === 'mercado'
              ? <Suspense fallback={<p className={s.wipBody} role="status">{t('invest.mkt.fresh.loading')}</p>}><Market demo={demo} onOpen={open} onTab={go} view={view} /></Suspense>
              : tab === 'siguiendo'
                ? <Suspense fallback={<p className={s.wipBody} role="status">{t('invest.card.loading')}</p>}><Follow demo={demo} onOpen={open} view={view} /></Suspense>
                : tab === 'planificar'
                  ? <Suspense fallback={<p className={s.wipBody} role="status">{t('invest.card.loading')}</p>}><Planificar demo={demo} view={view} onTab={go} onOpen={open} /></Suspense>
                  : <Wip id={tab} text={t(`invest.hub.soon.${tab}`)} />}
      </div>
    </div>
  )
}

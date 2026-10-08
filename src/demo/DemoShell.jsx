// src/demo/DemoShell.jsx
// Shell para modo demo — envuelve la app con DemoProvider
// Bridge: hace que useApp() en todos los módulos use los datos demo (sin IndexedDB)

import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { DemoProvider, useDemo, DemoContext } from './DemoContext.jsx'
import DemoBanner, { PRICING_URL, APP_URL } from './DemoBanner.jsx'
import DemoTour, { hasSeenDemoTour } from './DemoTour.jsx'
import DemoGate, { hasPassedDemoGate } from './DemoGate.jsx'
import Shell from '../components/layout/Shell.jsx'
import Toast from '../components/ui/Toast.jsx'
import PageSkeleton from '../components/ui/PageSkeleton.jsx'
import { AppContext } from '../context/AppContext.jsx'
import { useT } from '../i18n/useT.js'
import { proPriceVars } from '../utils/pricing.js'

// Páginas lazy — mismo patrón que App.jsx para coherencia de chunks
const Dashboard     = lazy(() => import('../pages/Dashboard/index.jsx'))
const CashFlow      = lazy(() => import('../pages/CashFlow/index.jsx'))
const Income        = lazy(() => import('../pages/Income/index.jsx'))
const Budgets       = lazy(() => import('../pages/Budgets/index.jsx'))
const Debts         = lazy(() => import('../pages/Debts/index.jsx'))
const Goals         = lazy(() => import('../pages/Goals/index.jsx'))
const Projects      = lazy(() => import('../pages/Projects/index.jsx'))
const NetWorth      = lazy(() => import('../pages/NetWorth/index.jsx'))
const Reports       = lazy(() => import('../pages/Reports/index.jsx'))
const Settings      = lazy(() => import('../pages/Settings/index.jsx'))
const Advisor       = lazy(() => import('../pages/Advisor/index.jsx'))
const Subscriptions = lazy(() => import('../pages/Subscriptions/index.jsx'))
const Coach         = lazy(() => import('../pages/Coach/index.jsx'))
const APVPage       = lazy(() => import('../pages/APV/index.jsx'))
const HipotecaUF    = lazy(() => import('../pages/HipotecaUF/index.jsx'))
const PPRPage       = lazy(() => import('../pages/PPR/index.jsx'))
const Deducciones   = lazy(() => import('../pages/Deducciones/index.jsx'))
const AhorroFiscal  = lazy(() => import('../pages/AhorroFiscal/index.jsx'))
const Inflacion     = lazy(() => import('../pages/Inflacion/index.jsx'))
const ResicoMX      = lazy(() => import('../pages/ResicoMX/index.jsx'))
const MultiDolarAR  = lazy(() => import('../pages/MultiDolarAR/index.jsx'))
const IRPFEspana    = lazy(() => import('../pages/IRPFEspana/index.jsx'))
const IRSPortugal   = lazy(() => import('../pages/IRSPortugal/index.jsx'))
const Multimoneda   = lazy(() => import('../pages/Multimoneda/index.jsx'))
const Steuer        = lazy(() => import('../pages/Steuer/index.jsx'))
const ImportCSV     = lazy(() => import('../pages/Import/index.jsx'))
const Movements     = lazy(() => import('../pages/Movements/index.jsx'))
const Privacy       = lazy(() => import('../pages/legal/Privacy.jsx'))
const Terms         = lazy(() => import('../pages/legal/Terms.jsx'))
const License       = lazy(() => import('../pages/legal/License.jsx'))
const Disclaimer    = lazy(() => import('../pages/legal/Disclaimer.jsx'))
const More          = lazy(() => import('../pages/More/index.jsx'))

const PageLoader = () => <PageSkeleton />

// Bridge: inyecta el valor de DemoContext en AppContext
// → todos los módulos que llaman useApp() reciben los datos demo
function DemoBridge({ children }) {
  const demoValue = useDemo()
  return (
    <AppContext.Provider value={demoValue}>
      {children}
    </AppContext.Provider>
  )
}

// CTA persistente al pie — aparece después de 75 s de uso del demo. Tarjeta
// Navy plana (sin degradado); en móvil flota por encima del tabbar, no lo tapa.
// No se muestra mientras corre el recorrido.
function DemoBottomCTA({ hidden }) {
  const { t, lang } = useT()
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(() => {
    try { return !!localStorage.getItem('fos_demo_cta_dismissed') } catch { return false }
  })

  useEffect(() => {
    if (dismissed) return
    const t = setTimeout(() => setVisible(true), 75 * 1000)
    return () => clearTimeout(t)
  }, [dismissed])

  if (!visible || dismissed || hidden) return null

  function dismiss() {
    try { localStorage.setItem('fos_demo_cta_dismissed', '1') } catch {}
    setDismissed(true)
  }

  return (
    <div className="demo-bottom-cta" role="region" aria-label={t('demo.cta.title')}>
      <div style={{ flex: 1, minWidth: 180, paddingRight: 36 }}>
        <div style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--sans)', marginBottom: 2 }}>{t('demo.cta.title')}</div>
        <div style={{ fontSize: 13, fontFamily: 'var(--sans)', lineHeight: 1.4, color: 'color-mix(in srgb, var(--papel-000) 82%, transparent)' }}>{t('demo.cta.sub', proPriceVars(lang))}</div>
      </div>
      {/* Mismo destino y texto que el CTA del banner (T09): la app real, en la
          misma pestaña — el registro ya captura el lead. "Ver planes" queda como
          enlace secundario hacia la landing. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        <a className="fos-btn-primary" href={APP_URL}
          style={{ width: 'auto', fontSize: 14, textDecoration: 'none', whiteSpace: 'nowrap' }}>
          {t('demo.banner.start')}
        </a>
        <a className="demo-banner__plans" href={PRICING_URL} target="_blank" rel="noopener noreferrer" style={{ padding: '0 8px' }}>
          {t('demo.banner.plans')}
        </a>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('common.close')}
        style={{
          position: 'absolute', top: 4, right: 4,
          width: 44, height: 44, flexShrink: 0, borderRadius: 'var(--r)',
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'color-mix(in srgb, var(--papel-000) 70%, transparent)', fontSize: 16,
        }}
      >
        <span aria-hidden="true">✕</span>
      </button>
    </div>
  )
}

function DemoInner() {
  const [page, setPage] = useState('dashboard')
  const { t } = useT()
  // Recorrido: arranca solo en la primera visita; el "?" del banner lo repite
  // (vuelve al Dashboard, donde están los objetivos).
  const [tourOpen, setTourOpen] = useState(() => !hasSeenDemoTour())
  const closeTour = useCallback(() => setTourOpen(false), [])
  const replayTour = useCallback(() => {
    setPage('dashboard')
    setTourOpen(false)
    setTimeout(() => setTourOpen(true), 0)
  }, [])
  const docTitle = t('demo.docTitle')

  // SEO (auditoría 2026-08-27): demo.moyiq.app comparte el mismo build
  // que app.moyiq.app (sin valor SEO, ya bloqueado con X-Robots-Tag en
  // vercel.json) pero SÍ está en el sitemap con priority 0.8 — necesitaba su
  // propio title/canonical, no el genérico heredado de index.html.
  useEffect(() => {
    if (typeof window === 'undefined' || window.location.hostname !== 'demo.moyiq.app') return
    document.title = docTitle
    let link = document.querySelector('link[rel="canonical"]')
    if (!link) {
      link = document.createElement('link')
      link.setAttribute('rel', 'canonical')
      document.head.appendChild(link)
    }
    link.setAttribute('href', 'https://demo.moyiq.app/app/?demo=true')
  }, [docTitle])

  function renderPage(page) {
    switch (page) {
      case 'dashboard':     return <Dashboard setPage={setPage}/>
      case 'income':        return <Income setPage={setPage}/>
      case 'budgets':       return <Budgets />
      case 'debts':         return <Debts />
      case 'goals':         return <Goals />
      case 'projects':      return <Projects />
      case 'networth':      return <NetWorth />
      case 'cashflow':      return <CashFlow setPage={setPage}/>
      case 'reports':       return <Reports setPage={setPage}/>
      case 'settings':      return <Settings />
      case 'privacy':       return <Privacy />
      case 'terms':         return <Terms />
      case 'license':       return <License />
      case 'disclaimer':    return <Disclaimer />
      case 'advisor':       return <Advisor />
      case 'subscriptions': return <Subscriptions />
      case 'coach':         return <Coach />
      case 'apv':           return <APVPage />
      case 'hipoteca':      return <HipotecaUF />
      case 'ppr':           return <PPRPage />
      case 'deducciones':   return <Deducciones />
      case 'ahorrofiscal':  return <AhorroFiscal />
      case 'inflacion':     return <Inflacion />
      case 'resico':        return <ResicoMX />
      case 'multidolar':    return <MultiDolarAR />
      case 'irpfes':        return <IRPFEspana />
      case 'irspt':         return <IRSPortugal />
      case 'multimoneda':   return <Multimoneda />
      case 'steuer':        return <Steuer />
      case 'movements':     return <Movements setPage={setPage}/>
      case 'import':        return <ImportCSV />
      case 'more':          return <More setPage={setPage} />
      default:              return <Dashboard setPage={setPage}/>
    }
  }

  return (
    <>
      <DemoBanner onReplayTour={replayTour} />
      <Shell page={page} setPage={setPage}>
        <Suspense fallback={<PageLoader />}>
          {renderPage(page)}
        </Suspense>
        <Toast />
      </Shell>
      <DemoBottomCTA hidden={tourOpen} />
      <DemoTour open={tourOpen} onClose={closeTour} />
    </>
  )
}

export default function DemoShell() {
  const [gatePassed, setGatePassed] = useState(() => hasPassedDemoGate())

  if (!gatePassed) {
    return <DemoGate onPass={() => setGatePassed(true)} />
  }

  return (
    <DemoProvider>
      <DemoBridge>
        <DemoInner />
      </DemoBridge>
    </DemoProvider>
  )
}

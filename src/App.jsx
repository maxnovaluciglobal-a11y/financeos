// src/App.jsx
import { lazy, Suspense } from 'react'
import LicenseGate from './components/LicenseGate.jsx'
import AuthGate from './components/AuthGate.jsx'
import { isLicenseActive, isStarterAcknowledged, getServerEntitlement, validateLicense, acknowledgeStarter } from './utils/licenseValidator.js'
import { getSession, onAuthChange } from './core/auth.js'
import { AppProvider, useApp } from './context/AppContext.jsx'
import Shell from './components/layout/Shell.jsx'
import Toast from './components/ui/Toast.jsx'
import Onboarding from './components/Onboarding.jsx'
import DemoShell from './demo/DemoShell.jsx'
import { usePersistedPage } from './hooks/usePersistedPage.js'
import { useState, useEffect } from 'react'

// Páginas lazy — solo se cargan cuando el usuario navega a ellas
const Dashboard     = lazy(() => import('./pages/Dashboard/index.jsx'))
const CashFlow      = lazy(() => import('./pages/CashFlow/index.jsx'))
const Income        = lazy(() => import('./pages/Income/index.jsx'))
const Budgets       = lazy(() => import('./pages/Budgets/index.jsx'))
const Debts         = lazy(() => import('./pages/Debts/index.jsx'))
const Goals         = lazy(() => import('./pages/Goals/index.jsx'))
const Projects      = lazy(() => import('./pages/Projects/index.jsx'))
const NetWorth      = lazy(() => import('./pages/NetWorth/index.jsx'))
const Reports       = lazy(() => import('./pages/Reports/index.jsx'))
const Settings      = lazy(() => import('./pages/Settings/index.jsx'))
const Advisor       = lazy(() => import('./pages/Advisor/index.jsx'))
const Subscriptions = lazy(() => import('./pages/Subscriptions/index.jsx'))
const Coach         = lazy(() => import('./pages/Coach/index.jsx'))
const APVPage       = lazy(() => import('./pages/APV/index.jsx'))
const HipotecaUF    = lazy(() => import('./pages/HipotecaUF/index.jsx'))
const PPRPage       = lazy(() => import('./pages/PPR/index.jsx'))
const Deducciones   = lazy(() => import('./pages/Deducciones/index.jsx'))
const AhorroFiscal  = lazy(() => import('./pages/AhorroFiscal/index.jsx'))
const Inflacion     = lazy(() => import('./pages/Inflacion/index.jsx'))
const ResicoMX      = lazy(() => import('./pages/ResicoMX/index.jsx'))
const MultiDolarAR  = lazy(() => import('./pages/MultiDolarAR/index.jsx'))
const IRPFEspana    = lazy(() => import('./pages/IRPFEspana/index.jsx'))
const IRSPortugal   = lazy(() => import('./pages/IRSPortugal/index.jsx'))
const Multimoneda   = lazy(() => import('./pages/Multimoneda/index.jsx'))
const Steuer        = lazy(() => import('./pages/Steuer/index.jsx'))
const ImportCSV     = lazy(() => import('./pages/Import/index.jsx'))
const Movements     = lazy(() => import('./pages/Movements/index.jsx'))
const Privacy       = lazy(() => import('./pages/legal/Privacy.jsx'))
const Terms         = lazy(() => import('./pages/legal/Terms.jsx'))
const License       = lazy(() => import('./pages/legal/License.jsx'))
const Disclaimer    = lazy(() => import('./pages/legal/Disclaimer.jsx'))

const PageLoader = () => (
  <div style={{ padding: 24, color: 'var(--th)', fontFamily: 'var(--mono)', fontSize: 12 }}>
    Cargando...
  </div>
)

// ── Detectar modo demo ────────────────────────────────────────────────────────
function isDemoMode() {
  try {
    const params = new URLSearchParams(window.location.search)
    return params.get('demo') === 'true'
  } catch {
    return false
  }
}

function Inner() {
  const [page, setPage] = usePersistedPage('dashboard')
  const [licensed, setLicensed] = useState(isLicenseActive() || isStarterAcknowledged())
  // undefined = todavía verificando sesión, null = sin sesión, objeto = autenticado.
  const [session, setSession] = useState(undefined)
  // Evita el flash de LicenseGate en un dispositivo nuevo mientras se
  // consulta si la cuenta ya eligió plan en otro dispositivo (ver el efecto
  // de más abajo y getServerEntitlement).
  const [entitlementChecked, setEntitlementChecked] = useState(false)
  // useApp() tiene que llamarse SIEMPRE, antes que cualquier return condicional
  // (Rules of Hooks) — estaba después del `if` de abajo, así que la sesión que
  // pasa de "sin licencia" a "activada" (LicenseGate → onActivate) cambiaba la
  // cantidad de hooks llamados entre un render y el siguiente del mismo Inner
  // montado. React lo tolera con un warning en vez de romper visiblemente, por
  // eso pasó desapercibido — pero es un bug real, no cosmético. Mismo motivo
  // por el que este useEffect va acá arriba, antes de cualquier return.
  const { settings, loading } = useApp()

  // Demo bypass: si URL tiene ?demo=true no se pide login ni licencia
  const isDemo = typeof window !== 'undefined' && window.location.search.includes('demo=true')

  useEffect(() => {
    if (isDemo) return
    getSession().then(setSession)
    return onAuthChange(setSession)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sincroniza Starter/Pro contra la cuenta (user_entitlements) — sin esto,
  // loguearse desde un dispositivo nuevo repetía la pantalla de elegir plan
  // aunque la cuenta ya la hubiera elegido antes en otro dispositivo. Pro se
  // revalida con la misma validateLicense() de siempre (respeta una licencia
  // revocada); Starter solo marca el ack local — ninguno de los dos toca
  // isLicenseActive()/getLicensePlan() directamente.
  useEffect(() => {
    if (isDemo || !session?.user?.id) return
    if (licensed) { setEntitlementChecked(true); return }
    let cancelled = false
    getServerEntitlement(session.user.id).then(async (ent) => {
      if (!cancelled && ent?.plan === 'pro' && ent.license_key) {
        const ok = await validateLicense(ent.license_key)
        if (!cancelled && ok) setLicensed(true)
      } else if (!cancelled && ent?.plan === 'starter') {
        acknowledgeStarter()
        setLicensed(true)
      }
      if (!cancelled) setEntitlementChecked(true)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, licensed])

  if (!isDemo) {
    if (session === undefined) return null // verificando — evita flash del gate
    if (!session) return <AuthGate onAuthenticated={() => {}} />
    if (!licensed && !entitlementChecked) return null // verificando entitlement de cuenta
    if (!licensed) return <LicenseGate onActivate={() => setLicensed(true)} userEmail={session.user?.email} userId={session.user?.id} />
  }

  function renderPage(page) {
    switch (page) {
      case 'dashboard':     return <Dashboard setPage={setPage}/>
      case 'income':        return <Income setPage={setPage}/>
      case 'budgets':       return <Budgets />
      case 'debts':         return <Debts />
      case 'goals':         return <Goals setPage={setPage}/>
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
      case 'import':        return <ImportCSV setPage={setPage} />
      default:              return <Dashboard setPage={setPage}/>
    }
  }

  const showOnboarding = !loading && !settings.onboardingDone

  if (showOnboarding) {
    // goTo: el onboarding puede pedir abrir una página al terminar (ej. 'import'
    // cuando el usuario elige subir su cartola). Sin goTo, cae a dashboard.
    return <Onboarding onComplete={(goTo) => { if (goTo) setPage(goTo) }} />
  }

  return (
    <Shell page={page} setPage={setPage}>
      <Suspense fallback={<PageLoader />}>
        {renderPage(page)}
      </Suspense>
      <Toast />
    </Shell>
  )
}

export default function App() {
  // Si URL tiene ?demo=true, cargar DemoShell (sin AppProvider, sin IndexedDB)
  if (isDemoMode()) {
    return <DemoShell />
  }

  return (
    <AppProvider>
      <Inner />
    </AppProvider>
  )
}

// src/App.jsx
import { lazy, Suspense } from 'react'
import LicenseGate from './components/LicenseGate.jsx'
import AuthGate from './components/AuthGate.jsx'
import ResetPassword from './components/ResetPassword.jsx'
import { isLicenseActive, isStarterAcknowledged, getServerEntitlement, validateLicense, acknowledgeStarter, getLicenseKey } from './utils/licenseValidator.js'
import { readDeviceOwner, readLegacyUid, planAccountSwitch, applyAccountSwitch, hasVault, legacyBagLicenseKey } from './core/deviceOwner.js'
import { disablePush, isPushEnabled } from './core/push.js'
import DeviceSwitch from './components/DeviceSwitch.jsx'
import { getSession, onAuthChange, syncUserLang } from './core/auth.js'
import { AppProvider, useApp } from './context/AppContext.jsx'
import Shell from './components/layout/Shell.jsx'
import Toast from './components/ui/Toast.jsx'
import PageSkeleton from './components/ui/PageSkeleton.jsx'
import BootSplash from './components/ui/BootSplash.jsx'
import Onboarding from './components/Onboarding.jsx'
import DemoShell from './demo/DemoShell.jsx'
import AdminCRM from './admin/AdminCRM.jsx'
import TrialUnsubscribe from './components/TrialUnsubscribe.jsx'
import { trialUnsubscribeTarget } from './utils/trialUnsubscribe.js'
import AppLockGate from './components/lock/AppLockGate.jsx'
import DbErrorScreen from './components/DbErrorScreen.jsx'
import { usePersistedPage } from './hooks/usePersistedPage.js'
import { pageFromSearch, initialSearch } from './utils/deepLink.js'
import { licenseKeyHash } from './utils/syncCrypto.js'
import { markInternalUser } from './utils/webAnalytics.js'
import { usePageStack } from './hooks/usePageStack.js'
import { usePlan } from './hooks/usePlan.js'
import { startChecklist, markPageVisited } from './utils/proChecklist.js'
import { useState, useEffect } from 'react'
import { logClientError, logRejection } from './utils/errorLog.js'

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
const Recurring     = lazy(() => import('./pages/Recurring/index.jsx'))
const Privacy       = lazy(() => import('./pages/legal/Privacy.jsx'))
const Terms         = lazy(() => import('./pages/legal/Terms.jsx'))
const License       = lazy(() => import('./pages/legal/License.jsx'))
const Disclaimer    = lazy(() => import('./pages/legal/Disclaimer.jsx'))
const More          = lazy(() => import('./pages/More/index.jsx'))
const NpsPrompt     = lazy(() => import('./components/NpsPrompt.jsx'))

const PageLoader = () => <PageSkeleton />

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
  const [page, setPageState] = usePersistedPage('dashboard', pageFromSearch(typeof window !== 'undefined' ? initialSearch(window.location.search) : ''))
  // R14: setPage apila en el historial (atrás del navegador/Android/iOS).
  // Las páginas siguen recibiendo setPage(id) como siempre.
  const { go: setPage, back: goBack, backTo } = usePageStack(page, setPageState)
  // PRD-4: con Pro, abrir una pantalla marca su paso de la checklist de Pro.
  const { isPro } = usePlan()
  useEffect(() => {
    if (!isPro || isDemoMode()) return
    startChecklist()
    markPageVisited(page)
  }, [page, isPro])
  const [licensed, setLicensed] = useState(isLicenseActive() || isStarterAcknowledged())
  // undefined = todavía verificando sesión, null = sin sesión, objeto = autenticado.
  const [session, setSession] = useState(undefined)
  // Evita el flash de LicenseGate en un dispositivo nuevo mientras se
  // consulta si la cuenta ya eligió plan en otro dispositivo (ver el efecto
  // de más abajo y getServerEntitlement).
  const [entitlementChecked, setEntitlementChecked] = useState(false)
  // getSession/getServerEntitlement/verifyOnline ya tienen timeout propio
  // (10s/8s/10s, ver auth.js y licenseValidator.js) así que en el camino
  // normal `session` y `entitlementChecked` siempre terminan resolviendo.
  // Este es un segundo cinturón de seguridad: cubre también un reject no
  // capturado u otro modo de falla que deje esos dos colgados igual. Si a
  // los 12s seguimos sin saber si hay sesión o si la cuenta ya eligió plan,
  // mostramos LicenseGate (reintentable) en vez de la pantalla en blanco
  // indefinida que hoy deja `Inner()` devolviendo null.
  const [bootTimedOut, setBootTimedOut] = useState(false)
  // true mientras el usuario vino desde el link del correo de "olvidé mi
  // contraseña" (evento PASSWORD_RECOVERY de Supabase) — esa sesión ya es
  // válida, así que sin este flag caería directo a LicenseGate/la app en
  // vez de dejarlo elegir una contraseña nueva primero.
  const [passwordRecovery, setPasswordRecovery] = useState(false)
  // 'checking' | 'ok' | 'failed' — si el espacio local activo es el de esta
  // cuenta (core/deviceOwner.js). Mientras no se sabe, no se muestra nada de
  // la app: una cuenta no debe ver ni un instante los datos o el plan de otra.
  // 'failed' = no se pudo cambiar de espacio (almacenamiento lleno).
  // Guarda para qué cuenta se resolvió: si la sesión cambia de cuenta sin
  // recargar (otra pestaña, cerrar e iniciar sesión), el estado viejo no vale.
  const [owner, setOwner] = useState({ uid: null, status: 'checking' })
  const setOwnerStatus = (status) => setOwner({ uid: session?.user?.id || null, status })
  // useApp() tiene que llamarse SIEMPRE, antes que cualquier return condicional
  // (Rules of Hooks) — estaba después del `if` de abajo, así que la sesión que
  // pasa de "sin licencia" a "activada" (LicenseGate → onActivate) cambiaba la
  // cantidad de hooks llamados entre un render y el siguiente del mismo Inner
  // montado. React lo tolera con un warning en vez de romper visiblemente, por
  // eso pasó desapercibido — pero es un bug real, no cosmético. Mismo motivo
  // por el que este useEffect va acá arriba, antes de cualquier return.
  const { settings, loading, dbError } = useApp()

  // Demo bypass: si URL tiene ?demo=true no se pide login ni licencia
  const isDemo = typeof window !== 'undefined' && window.location.search.includes('demo=true')

  // Analítica (C-14): las cuentas internas no se miden.
  useEffect(() => { if (session?.user?.email) markInternalUser(session.user.email) }, [session?.user?.email])

  useEffect(() => {
    if (isDemo) return
    getSession().then(setSession)
    return onAuthChange(setSession, (event) => {
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
      // Al cerrar sesión se recarga: lo que la cuenta tenía en memoria (datos,
      // plan, estado de las pantallas) no sobrevive para la próxima.
      if (event === 'SIGNED_OUT') window.location.reload()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // user_metadata.lang = idioma de la app (correos de auth en ese idioma).
  useEffect(() => {
    if (isDemo || loading || !session?.user) return
    syncUserLang(session, settings.language)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, settings.language, loading])

  useEffect(() => {
    if (isDemo || !session?.user?.id) return
    let cancelled = false
    ;(async () => {
      const owner = readDeviceOwner()
      const legacyUid = readLegacyUid()
      const deviceLicenseKey = getLicenseKey()
      const bagKey = legacyBagLicenseKey()
      // Solo hace falta preguntar al servidor si hay una licencia que podría
      // ser (o no) de esta cuenta: la del dispositivo sin dueño, o la de
      // unos datos sin dueño guardados aparte.
      const needServer = (!owner?.uid && deviceLicenseKey) || (owner?.uid !== session.user.id && bagKey)
      const rawEntitlement = needServer ? await getServerEntitlement(session.user.id) : null
      // La cuenta puede guardar el hash de la licencia en vez de la clave
      // (C-21/C-04): se compara siempre por hash.
      const hashOrEmpty = async (k) => (k ? licenseKeyHash(k) : '')
      const serverEntitlement = rawEntitlement
        ? { ...rawEntitlement, license_key: await hashOrEmpty(rawEntitlement.license_key) }
        : null
      const deviceHash = await hashOrEmpty(deviceLicenseKey)
      const bagHash = await hashOrEmpty(bagKey)
      if (cancelled) return
      const plan = planAccountSwitch({
        owner, legacyUid, userId: session.user.id, deviceLicenseKey: deviceHash, serverEntitlement,
        hasVault: hasVault(session.user.id), legacyBagLicenseKey: bagHash,
      })
      if (plan.action !== 'switch') {
        try { applyAccountSwitch(session.user, plan) } catch (e) { logClientError({ type: 'swallowed', message: String(e?.message || e), source: 'app.accountSwitch' }) }
        setOwnerStatus('ok')
        return
      }
      // Cambio de cuenta: el aviso push de este navegador estaba atado a la
      // cuenta anterior, se da de baja antes de guardar su espacio.
      if (isPushEnabled()) await disablePush().catch(logRejection('App:189'))
      try {
        applyAccountSwitch(session.user, plan)
      } catch {
        if (!cancelled) setOwnerStatus('failed')
        return
      }
      // Recargar: la app arranca de cero con la base y los ajustes de esta
      // cuenta. Nada de lo que había en memoria llega a pintarse.
      window.location.reload()
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per signed-in user id on purpose: session.user changes identity on every token refresh and setOwnerStatus is recreated each render, so depending on them would re-run the account-switch check (server call, possible reload) repeatedly
  }, [session?.user?.id])

  useEffect(() => {
    if (isDemo) return
    const timer = setTimeout(() => setBootTimedOut(true), 12000)
    return () => clearTimeout(timer)
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
    if (session === undefined) {
      // Verificando sesión (evita flash del gate). Si bootTimedOut ya se
      // cumplió, dejamos de esperar y mostramos LicenseGate en vez de null
      // — el usuario puede reintentar en lugar de ver blanco para siempre.
      if (bootTimedOut) return <main><LicenseGate onActivate={() => setLicensed(true)} /></main>
      return <BootSplash />
    }
    if (!session) return <main><AuthGate onAuthenticated={() => {}} /></main>
    if (passwordRecovery) return <main><ResetPassword onDone={() => setPasswordRecovery(false)} /></main>
    const ownerStatus = owner.uid === session.user.id ? owner.status : 'checking'
    if (ownerStatus === 'failed') return <main><DeviceSwitch previousEmail={readDeviceOwner()?.email} /></main>
    if (ownerStatus === 'checking') return <BootSplash />
    if (!licensed && !entitlementChecked) {
      // Mismo criterio mientras se verifica el entitlement de la cuenta.
      if (bootTimedOut) return <main><LicenseGate onActivate={() => setLicensed(true)} userEmail={session.user?.email} userId={session.user?.id} /></main>
      return <BootSplash />
    }
    if (!licensed) return <main><LicenseGate onActivate={() => setLicensed(true)} userEmail={session.user?.email} userId={session.user?.id} /></main>
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
      case 'recurring':     return <Recurring setPage={setPage}/>
      case 'import':        return <ImportCSV setPage={setPage} />
      case 'more':          return <More setPage={setPage} />
      default:              return <Dashboard setPage={setPage}/>
    }
  }

  // La base local existe pero no abrió: bloquear (no mostrar una app vacía).
  if (dbError) return <DbErrorScreen kind={dbError} />

  const showOnboarding = !loading && !settings.onboardingDone

  if (showOnboarding) {
    // goTo: el onboarding puede pedir abrir una página al terminar (ej. 'import'
    // cuando el usuario elige subir su cartola). Sin goTo, cae a dashboard.
    return <Onboarding onComplete={(goTo) => { if (goTo) setPage(goTo) }} />
  }

  return (
    <Shell page={page} setPage={setPage} onBack={goBack} backTo={backTo}>
      <Suspense fallback={<PageLoader />}>
        {renderPage(page)}
      </Suspense>
      {session?.user && !isDemo && (
        <Suspense fallback={null}><NpsPrompt createdAt={session.user.created_at} /></Suspense>
      )}
      <Toast />
    </Shell>
  )
}

export default function App() {
  // C-35: baja de los correos de la prueba (?unsub=trial&id=), sin sesión.
  const trialUnsubId = typeof window !== 'undefined' ? trialUnsubscribeTarget(window.location.search) : null
  if (trialUnsubId) return <TrialUnsubscribe id={trialUnsubId} />
  // Si URL tiene ?admin=crm, cargar el panel CRM interno (sin AppProvider, sin
  // IndexedDB, sin onboarding/licencia) — solo Walter puede leer datos reales,
  // la policy RLS de crm_contacts hace el gate real, no esta condición.
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('admin') === 'crm') {
    return <AdminCRM />
  }
  // Si URL tiene ?demo=true, cargar DemoShell (sin AppProvider, sin IndexedDB)
  if (isDemoMode()) {
    return <DemoShell />
  }

  // T14: el bloqueo va POR FUERA de AppProvider — mientras está bloqueada no
  // se monta nada de la app (ni se cargan los datos al estado de React).
  return (
    <AppLockGate>
      <AppProvider>
        <Inner />
      </AppProvider>
    </AppLockGate>
  )
}

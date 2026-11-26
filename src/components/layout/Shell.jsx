// src/components/layout/Shell.jsx — Fase mobile nav

import { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { isNativeApp } from '../../native/platform.js'
import { STORE_BUILD } from '../../native/storeBuild.js'
import { appHelpHref } from '../../utils/landingUrls.js'
import s from './shell.module.css'
import { BackupStatusBadge } from '../backup/BackupStatus.jsx'
import QuickAdd from '../QuickAdd.jsx'
import PrivacySeal from '../PrivacySeal.jsx'
import CountryBadge from '../CountryBadge.jsx'
import Logo, { Monogram } from '../Logo.jsx'
import { NAV_ICONS } from '../icons/Icons.jsx'
import { signOutAuth } from '../../core/auth.js'
import { useKeyboardOpen } from '../../hooks/useKeyboardOpen.js'
import { NAV, ALL_ITEMS, pageLabel, showProChip, navItemVisible } from './navConfig.js'
import TabBar, { AddFab } from './TabBar.jsx'
import { runViewTransition } from './viewTransition.js'
import { chromeFor, SUB_BACK_EVENT } from './pageStack.js'
import { useEdgeSwipeBack } from '../../hooks/useEdgeSwipeBack.js'
import { QUICK_ADD_EVENT, NAVIGATE_EVENT } from '../quickAddBus.js'
import HelpButton from '../help/HelpButton.jsx'
import { useHelp } from '../help/useHelp.js'
// Ayuda en la app: panel, primera visita y recorridos, fuera del JS inicial.
const HelpHost = lazy(() => import('../help/HelpHost.jsx'))
import UpdateNotice from '../UpdateNotice.jsx'
// V4: piezas ocasionales fuera del JS inicial.
const PushAsk = lazy(() => import('../PushAsk.jsx'))
const WhatsNew = lazy(() => import('../WhatsNew.jsx'))
import { setPushPrimerHost, createPrimerQueue } from '../../core/pushPrimer.js'
import { logRejection } from '../../utils/errorLog.js'
import { getLicensePlan } from '../../utils/licenseValidator.js'
// Avisos locales (fijos, presupuestos, lo que queda, cobro): se calculan en el dispositivo.
const LocalAlerts = lazy(() => import('../../core/localAlerts/Host.jsx'))
import { Eye, EyeOff, Lock, Sun, Moon, LogOut, ChevronLeft } from 'lucide-react'
import { useResolvedTheme } from '../../hooks/useResolvedTheme.js'

// Firma del producto (Sello + badges de país) — visible por defecto.
const SHOW_FIRMA = true

export default function Shell({ page, setPage, onBack, backTo, children }) {
  const { settings, updateSettings, incomes, expenses } = useApp()
  const { t, lang } = useT()
  // Con "Sistema" el atajo muestra el opuesto de lo que se ve y fija ese tema.
  const isDark = useResolvedTheme(settings.theme) === 'dark'

  const [quickAdd, setQuickAdd] = useState(null) // null | 'expense' | 'income' | 'setAside'
  // Otras pantallas (Primeros pasos del Inicio) piden abrir el Registro rápido.
  useEffect(() => {
    const onOpen = (e) => setQuickAdd(['income', 'setAside'].includes(e.detail?.type) ? e.detail.type : 'expense')
    window.addEventListener(QUICK_ADD_EVENT, onOpen)
    return () => window.removeEventListener(QUICK_ADD_EVENT, onOpen)
  }, [])
  // "Más detalles" del Registro rápido (B4a): cierra la hoja y navega.
  useEffect(() => {
    const onNav = (e) => {
      const id = e.detail?.page
      if (typeof id !== 'string' || !id) return
      setQuickAdd(null)
      navigate(id)
    }
    window.addEventListener(NAVIGATE_EVENT, onNav)
    return () => window.removeEventListener(NAVIGATE_EVENT, onNav)
  })

  // Con el teclado virtual abierto, el TabBar queda flotando arriba de él o lo
  // tapa — se oculta mientras se escribe (ver useKeyboardOpen).
  const keyboardOpen = useKeyboardOpen()

  // Pre-permiso de avisos (R09; con ejemplos y "Ahora no" que pospone):
  // el pedido automático se evalúa después de guardar desde el Registro rápido,
  // con los conteos ya actualizados (el efecto corre tras el render); el chequeo
  // (core/pushAutoAsk.js) se carga recién ahí. Ajustes, Inversiones y "Primeros
  // pasos" lo piden por core/pushPrimer.js: la misma hoja, sin esperar al 3.er
  // movimiento ni al plazo de "Ahora no". pushAsk: null | 'auto' | 'manual' |
  // el `source` del pedido ('invest' muestra el ejemplo de alerta de precio).
  // Guardar también emite 'fos:quickadd-saved' (pedido de avisos locales de la
  // app de tienda, core/localAlerts/Host.jsx).
  // Lo guardado y el toast del pedido automático son de la hoja (PushAsk.jsx).
  const [pushCheck, setPushCheck] = useState(false)
  const [pushAsk, setPushAsk] = useState(null)
  const [pushQueue] = useState(() => createPrimerQueue((o) => setPushAsk(o?.source || 'manual')))
  const movementCount = (incomes?.length || 0) + (expenses?.length || 0)
  useEffect(() => {
    if (!pushCheck) return
    setPushCheck(false)
    if (settings.isDemo) return
    import('../../core/pushAutoAsk.js').then(({ autoPushAsk }) => {
      if (autoPushAsk({ movementCount })) setTimeout(() => setPushAsk(v => v || 'auto'), 400)
    // Sin el chunk (sin red) se vuelve a intentar en el próximo guardado.
    }).catch(logRejection('Shell:pushAutoAsk'))
  }, [pushCheck, movementCount, settings.isDemo])
  useEffect(() => setPushPrimerHost(pushQueue.request), [pushQueue])

  // R14/L2: raíces (Inicio · Movimientos · Presupuestos · Metas · Menú) con barra; el resto se abre
  // "empujado": "‹" arriba, sin barra y sin "+" (salvo páginas de registrar).
  const chrome = chromeFor(page)
  // Una subpantalla dentro de la página (hoy, Ajustes › Perfil y país…) toma
  // el "‹" de la barra: dice a dónde vuelve (la raíz de Ajustes) y vuelve con
  // el historial, así no conviven "‹ Más" y "‹ Ajustes" en el celular.
  const [subBack, setSubBack] = useState(null)
  useEffect(() => {
    const on = (e) => setSubBack(e.detail?.label || null)
    window.addEventListener(SUB_BACK_EVENT, on)
    return () => window.removeEventListener(SUB_BACK_EVENT, on)
  }, [])
  const pageBack = onBack || (() => setPage(chrome.parent))
  const back = subBack ? () => history.back() : pageBack
  const backLabel = subBack || pageLabel(backTo || chrome.parent)
  // El atributo vive en <html> para que --tabbar-h (Toast, CountrySelect, CTA
  // del demo, aire del contenido) se recalcule también en lo que va en portal.
  useEffect(() => {
    const el = document.documentElement
    el.dataset.chrome = chrome.root ? 'root' : 'pushed'
    // Con barra, el "+" va dentro de ella y no pide aire encima.
    el.dataset.fab = chrome.fab && !chrome.tabBar ? 'on' : 'off'
  }, [chrome.root, chrome.fab, chrome.tabBar])
  // iOS instalada (standalone) no tiene gesto atrás propio: borde izquierdo.
  useEdgeSwipeBack({ enabled: chrome.back, onBack: back })

  // Ayuda de la pantalla (26-nov-2026): el "?" abre el panel; la primera visita
  // pregunta si se quiere ver el recorrido (nunca en el demo).
  const helpCountry = (settings.country || 'CL').toUpperCase()
  const investOn = !STORE_BUILD && navItemVisible(ALL_ITEMS.find(it => it.id === 'investments') || {}, helpCountry, settings)
  const newsFilter = useMemo(() => ({ investments: investOn }), [investOn])
  const help = useHelp(page, { isDemo: !!settings.isDemo, newsFilter })

  // ── Foco al cambiar de página ────────────────────────────────────────────────
  // Sin esto, un lector de pantalla no se entera de que la página cambió: el foco
  // se queda en el botón del sidebar que se clickeó. Mismo patrón que ya usa
  // Onboarding.jsx (headingRef) — acá se aplica al landmark <main>, con su nombre
  // accesible dinámico, en vez de tocar cada página una por una.
  const contentRef = useRef(null)
  useEffect(() => {
    // preventScroll: en el demo el banner sticky va arriba del Shell (100dvh) y el
    // documento queda 60px más alto; sin esto el focus() desplazaba la ventana y
    // la topbar (con el botón de ocultar montos) quedaba tapada por el banner.
    const id = setTimeout(() => contentRef.current?.focus({ preventScroll: true }), 50)
    return () => clearTimeout(id)
  }, [page])

  // El anillo de foco de <main> es para quien navega con teclado (ver CSS).
  useEffect(() => {
    const root = document.documentElement
    const onKey = (e) => { if (e.key === 'Tab') root.dataset.keyboard = '1' }
    const onPointer = () => { delete root.dataset.keyboard }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onPointer, { passive: true })
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('pointerdown', onPointer) }
  }, [])

  function navigate(id) {
    runViewTransition(() => setPage(id))
  }

  // Tocar la pestaña activa sube al inicio (causa 11).
  function scrollToTop() {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    contentRef.current?.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
  }

  // ── Ocultar montos (T13) ─────────────────────────────────────────────────────
  // Preferencia de este dispositivo (no viaja en respaldos ni sync, ver
  // utils/money.js). El anuncio va a una región aria-live propia: el botón ya
  // expone su estado con aria-pressed, pero el cambio de toda la pantalla
  // (cifras → "Monto oculto") merece decirse en voz alta una vez.
  const amountsHidden = !!settings.hideAmounts
  const licensePlan = getLicensePlan()
  const [amountsAnnounce, setAmountsAnnounce] = useState('')
  function toggleAmounts() {
    const next = !amountsHidden
    updateSettings({ ...settings, hideAmounts: next })
    setAmountsAnnounce(t(next ? 'money.announce.hidden' : 'money.announce.shown'))
  }
  // Atajo Alt+H (Opción+H en Mac) en escritorio, solo si el foco no está en un
  // campo editable. Antes era la tecla H sola: WCAG 2.1.4 (A11Y-5) pide un
  // modificador para que el control por voz no lo dispare al dictar.
  useEffect(() => {
    function onKey(e) {
      if (!e.altKey || e.code !== 'KeyH') return
      if (e.metaKey || e.ctrlKey || e.repeat || e.defaultPrevented) return
      const el = e.target
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return
      if (!window.matchMedia?.('(min-width: 701px)').matches) return
      e.preventDefault()
      toggleAmounts()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function toggleTheme() {
    updateSettings({ ...settings, theme: isDark ? 'light' : 'dark' })
  }

  // ── Render del nav (reutilizado en sidebar y drawer) ─────────────────────────
  const navCountry = (settings.country || 'CL').toUpperCase()
  function NavItems({ onNavigate }) {
    return (
      <>
        {NAV.map(g => {
          const items = g.items.filter(it => navItemVisible(it, navCountry, settings))
          if (items.length === 0) return null   // no mostrar cabecera de sección vacía
          return (
          <div key={g.sec} data-tour={g.sec === 'nav.sec.country' ? 'nav-country' : undefined}>
            <div className={s.sec}>{t(g.sec)}</div>
            {items.map(it => (
              <button
                key={it.id}
                type="button"
                className={s.ni + (page === it.id ? ' ' + s.active : '')}
                onClick={() => onNavigate(it.id)}
                aria-current={page === it.id ? 'page' : undefined}
              >
                <span className={s.ic} aria-hidden="true">
                  {SHOW_FIRMA && it.cc
                    ? <CountryBadge code={it.cc} />
                    : NAV_ICONS[it.id]
                      ? (() => { const Ic = NAV_ICONS[it.id]; return <Ic size={15} /> })()
                      : it.ic}
                </span>
                {t(it.lb)}
                {showProChip(it, licensePlan) && (
                  // Contraste: un color-mix(var(--warn) 18%) diluye el mismo tono que el
                  // texto (--warn === --amb) y queda en ~4.17:1 en claro (bajo AA 4.5:1) —
                  // subir el % empeora el contraste porque converge hacia el color del
                  // texto (verificado: 28% da ~3.59:1 en claro y baja el oscuro de 5.11:1
                  // a 4.14:1, rompiéndolo también). --amb-bg ya es el tono claro correcto
                  // para este par (mismo que usa .badge_amber en ui.module.css): ~4.74:1
                  // en claro, ~5.32:1 en oscuro sobre el fondo real del sidebar (--sur).
                  <span style={{ marginLeft:'auto', fontSize:'var(--t-caption)', fontFamily: 'var(--num)', background:'var(--amb-bg)', color:'var(--amb)', borderRadius:4, padding:'1px 5px', letterSpacing:'.5px', fontWeight:700 }}>PRO</span>
                )}
              </button>
            ))}
          </div>
          )
        })}
      </>
    )
  }

  return (
    <div className={s.shell}>

      {/* ── SIDEBAR DESKTOP (oculto en móvil) ── */}
      <nav className={s.sb}>
        <div className={s.logo}>
          <Logo size={19} />
        </div>

        <NavItems onNavigate={navigate} />

        <div className={s.footer}>
          <button className={s.themeBtn} onClick={toggleTheme}>
            {isDark
              ? <><Sun size={14} strokeWidth={1.7} aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: 6 }} />{t('settings.theme.light')}</>
              : <><Moon size={14} strokeWidth={1.7} aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: 6 }} />{t('settings.theme.dark')}</>}
          </button>
          <button className={s.themeBtn} onClick={() => signOutAuth()}>
            <LogOut size={14} strokeWidth={1.7} aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: 6 }} />{t('settings.account.logoutBtn')}
          </button>
          <div className={s.legalLinks}>
            <button type="button" onClick={() => navigate('privacy')} className={s.legalLink}>{t('nav.legal.privacy')}</button>
            <button type="button" onClick={() => navigate('terms')} className={s.legalLink}>{t('nav.legal.terms')}</button>
            <button type="button" onClick={() => navigate('disclaimer')} className={s.legalLink}>{t('nav.legal.disclaimer')}</button>
            <a href={appHelpHref(lang, isNativeApp())} target='_blank' rel='noopener noreferrer' className={s.legalLink} style={{textDecoration:'none'}}>{t('nav.legal.help')}</a>
          </div>
          {SHOW_FIRMA && (
            <div style={{ display:'flex', justifyContent:'center', padding:'8px 0 2px' }}
              title={t('nav.noServerTag')}>
              <PrivacySeal size={72} />
            </div>
          )}
          <div className={s.appVersion}>
            moyiq · MAXNOVA & LUCI Global LLC<br/>
            <span><Lock size={12} strokeWidth={1.7} aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: 5, flexShrink: 0 }} />{t('nav.noServerTag')}</span>
          </div>
          <div style={{marginTop:6}}><BackupStatusBadge compact /></div>
        </div>
      </nav>

      {/* ── ÁREA PRINCIPAL ── */}
      <div className={s.main}>

        {/* Barra superior — sin fila propia (causa 6): en el teléfono flota en la
            línea del título grande. Al hacer scroll se le suma el título compacto
            (LargeTitle lo manda a #nav-title) y el fondo con desenfoque, ligados al
            dedo. En las pantallas empujadas (R14) lleva "‹ {de dónde viniste}". */}
        <header className={s.topbar} data-shell-topbar>
          <div className={s.navBg} aria-hidden="true" />
          <div className={s.topLeft}>
            {chrome.back && (
              <button type="button" className={s.backBtn} onClick={back}
                aria-label={t('nav.backTo', { page: t(backLabel) })}>
                <ChevronLeft size={22} strokeWidth={2} aria-hidden="true" />
                <span className={s.backLbl}>{t(backLabel)}</span>
              </button>
            )}
          </div>
          {/* El título vive en el PageHead de cada página (UI-M8); acá solo su copia compacta. */}
          <div id="nav-title" className={s.navTitle} aria-hidden="true" />
          <span className={s.topRight}>
            <HelpButton className={s.amountsBtn} onClick={help.openPanel} unread={help.unread} open={help.panel} t={t} />
            <button
              type="button"
              className={s.amountsBtn}
              onClick={toggleAmounts}
              aria-pressed={amountsHidden}
              aria-label={t('money.toggle')}
              title={`${t('money.toggle')} · ${t('money.shortcut')}`}
            >
              {amountsHidden
                ? <EyeOff size={16} strokeWidth={1.7} aria-hidden="true" />
                : <Eye size={16} strokeWidth={1.7} aria-hidden="true" />}
              <span className={s.amountsLbl} aria-hidden="true">{t('money.toggle')}</span>
            </button>
          </span>
          <span className="sr-only" role="status" aria-live="polite">{amountsAnnounce}</span>
        </header>

        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- main is the app's own scroll container (data-scroll-root); it receives focus on page change and must be focusable so keyboard users can scroll it (axe scrollable-region-focusable) */}
        <main className={s.content} data-scroll-root ref={contentRef} tabIndex={0} aria-label={t(pageLabel(page))}>
          <div className={s.contentInner}>
            {children}
          </div>
        </main>

        {/* TABBAR móvil — 3 destinos (Inicio · Movimientos · Más, Inicio v2 del
            24-nov-2026) y el "+" al lado. La misma barra en todas las raíces; las
            pantallas empujadas no la llevan. Se oculta con el teclado abierto. */}
        <div className={keyboardOpen ? s.tabbarHidden : undefined}>
          {chrome.tabBar && <TabBar page={page} onNavigate={navigate} onReselect={scrollToTop} onAdd={() => setQuickAdd('expense')} t={t} />}
          {chrome.fab && !chrome.tabBar && <AddFab onAdd={() => setQuickAdd(page === 'income' ? 'income' : 'expense')} t={t} />}
        </div>
      </div>

      {help.active && (
        <Suspense fallback={null}>
          <HelpHost help={help} page={page} navigate={navigate} country={helpCountry} settings={settings} />
        </Suspense>
      )}
      <QuickAdd open={!!quickAdd} defaultType={quickAdd || 'expense'} onClose={() => setQuickAdd(null)} onSaved={() => { setPushCheck(true); window.dispatchEvent(new Event('fos:quickadd-saved')) }} />
      {pushAsk && <Suspense fallback={null}><PushAsk open auto={pushAsk === 'auto'} source={pushAsk} onClose={() => setPushAsk(null)} onResult={pushQueue.settle} /></Suspense>}
      <UpdateNotice />
      <Suspense fallback={null}><WhatsNew /></Suspense>
      <Suspense fallback={null}><LocalAlerts /></Suspense>
    </div>
  )
}

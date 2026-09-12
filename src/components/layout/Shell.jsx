// src/components/layout/Shell.jsx — Fase mobile nav

import { useState, useEffect, useRef } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import s from './shell.module.css'
import { BackupStatusBadge } from '../backup/BackupManager.jsx'
import { useDialogA11y } from '../../hooks/useDialogA11y.js'
import QuickAdd from '../QuickAdd.jsx'
import PrivacySeal from '../PrivacySeal.jsx'
import CountryBadge from '../CountryBadge.jsx'
import Logo, { Monogram } from '../Logo.jsx'
import { NAV_ICONS } from '../icons/Icons.jsx'
import { signOutAuth } from '../../core/auth.js'

// Firma del producto (Sello + badges de país) — visible por defecto.
const SHOW_FIRMA = true

// lb = key de traducción (ver src/i18n/translations.js), no texto directo
const NAV = [
  { sec: 'nav.sec.main',    items: [{ id: 'dashboard', ic: '◈', lb: 'nav.dashboard' }] },
  { sec: 'nav.sec.movements',  items: [
    { id: 'income',    ic: '↑', lb: 'nav.income' },
    { id: 'movements', ic: '↓', lb: 'nav.expenses' },
    { id: 'import',    ic: '⇪', lb: 'nav.import' },
  ] },
  // #06 — "Tu país" como sección propia: eleva el diferenciador fiscal por país
  // (antes estaba diluido dentro de Planificación) y de-satura esa sección.
  { sec: 'nav.sec.country', items: [
    { id: 'hipoteca', ic: '🇨🇱', cc: 'CL', lb: 'nav.hipotecaCL', countries: ['CL'], proOnly: true },
    { id: 'apv',     ic: '🇨🇱', cc: 'CL', lb: 'nav.apvChile', countries: ['CL'], proOnly: true },
    { id: 'irspt',    ic: '🇵🇹', cc: 'PT', lb: 'nav.irsPT', countries: ['PT'], proOnly: true },
    { id: 'ppr',     ic: '🇵🇹', cc: 'PT', lb: 'nav.pprPortugal', countries: ['PT'], proOnly: true },
    { id: 'deducciones', ic: '⊟', lb: 'nav.deductions', countries: ['EC', 'PE'], proOnly: true },
    { id: 'resico',       ic: '🇲🇽', cc: 'MX', lb: 'nav.resicoMX', countries: ['MX'], proOnly: true },
    { id: 'irpfes',   ic: '🇪🇸', cc: 'ES', lb: 'nav.irpfES', countries: ['ES'], proOnly: true },
    { id: 'ahorrofiscal', ic: '⊡', lb: 'nav.taxSavings', countries: ['MX', 'CO', 'US', 'ES'], proOnly: true },
    { id: 'multidolar',  ic: '🇦🇷', cc: 'AR', lb: 'nav.multidolarAR', countries: ['AR'], proOnly: true },
    { id: 'inflacion',   ic: '↗', lb: 'nav.inflation', countries: ['AR'], proOnly: true },
    { id: 'multimoneda', ic: '⇄', lb: 'nav.multicurrency', countries: ['VE'], proOnly: true },
    { id: 'steuer',      ic: '🇩🇪', cc: 'DE', lb: 'nav.steuerDE', countries: ['DE'], proOnly: true },
  ] },
  { sec: 'nav.sec.planning', items: [
    { id: 'budgets', ic: '▤', lb: 'nav.budgets' },
    { id: 'debts',   ic: '⊖', lb: 'nav.debts' },
    { id: 'goals',   ic: '◎', lb: 'nav.goals' },
    { id: 'projects', ic: '⌂', lb: 'nav.properties', proOnly: true },
  ] },
  { sec: 'nav.sec.analysis', items: [
    { id: 'networth', ic: '◆', lb: 'nav.netWorth' },
    { id: 'coach',    ic: '⚕', lb: 'nav.diagnosis' },
    { id: 'reports',  ic: '⊞', lb: 'nav.reports' },
    { id: 'cashflow', ic: '⟶', lb: 'nav.projection', proOnly: true },
  ] },
  { sec: 'nav.sec.pro', items: [
    { id: 'advisor',  ic: '◑', lb: 'nav.advisorMode', proOnly: true },
  ] },
  { sec: 'nav.sec.account', items: [
    { id: 'settings', ic: '⊙', lb: 'nav.settings' },
  ] },
]

// Todas las secciones planas para historial
const ALL_ITEMS = NAV.flatMap(g => g.items)

// Key de traducción para la topbar (pageLabel devuelve una KEY, no texto — se traduce con t() al usarla)
function pageLabel(id) {
  return ALL_ITEMS.find(it => it.id === id)?.lb || id
}

export default function Shell({ page, setPage, children }) {
  const { settings, updateSettings } = useApp()
  const { t } = useT()
  const isChile = (settings.country || 'CL') === 'CL'
  const isDark = settings.theme === 'dark'

  // ── Drawer móvil ────────────────────────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false)
  const drawerRef = useRef(null)
  useDialogA11y(drawerOpen, () => setDrawerOpen(false), drawerRef)

  // React 18 no serializa `inert` como prop JSX (llega hasta 19) — sin esto, el
  // drawer cerrado queda navegable por teclado y visible para lectores de
  // pantalla pese a estar fuera de pantalla vía transform. Seteo directo al DOM.
  useEffect(() => {
    if (!drawerRef.current) return
    if (drawerOpen) drawerRef.current.removeAttribute('inert')
    else drawerRef.current.setAttribute('inert', '')
  }, [drawerOpen])

  // ── FAB speed-dial (Ingreso / Egreso) ────────────────────────────────────────
  const [fabOpen, setFabOpen] = useState(false)
  const [quickAdd, setQuickAdd] = useState(null) // null | 'expense' | 'income'

  // Cerrar drawer al hacer clic fuera
  useEffect(() => {
    function handleOutside(e) {
      if (drawerOpen && drawerRef.current && !drawerRef.current.contains(e.target)) {
        setDrawerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('touchstart', handleOutside)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
    }
  }, [drawerOpen])

  // Bloquear scroll del body cuando el drawer está abierto
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  // ── Foco al cambiar de página ────────────────────────────────────────────────
  // Sin esto, un lector de pantalla no se entera de que la página cambió: el foco
  // se queda en el botón del sidebar que se clickeó. Mismo patrón que ya usa
  // Onboarding.jsx (headingRef) — acá se aplica al landmark <main>, con su nombre
  // accesible dinámico, en vez de tocar cada página una por una.
  const contentRef = useRef(null)
  useEffect(() => {
    const id = setTimeout(() => contentRef.current?.focus(), 50)
    return () => clearTimeout(id)
  }, [page])

  // ── Historial de navegación ──────────────────────────────────────────────────
  const [history, setHistory] = useState([])

  function navigate(id) {
    if (id !== page) {
      setHistory(h => [...h, page])
    }
    setPage(id)
    setDrawerOpen(false)
  }

  function goBack() {
    if (history.length > 0) {
      const prev = history[history.length - 1]
      setHistory(h => h.slice(0, -1))
      setPage(prev)
    } else {
      setPage('dashboard')
    }
  }

  function toggleTheme() {
    updateSettings({ ...settings, theme: isDark ? 'light' : 'dark' })
  }

  // ── Render del nav (reutilizado en sidebar y drawer) ─────────────────────────
  const navCountry = (settings.country || 'CL').toUpperCase()
  function NavItems({ onNavigate }) {
    return (
      <>
        {NAV.map(g => {
          const items = g.items.filter(it => !it.countries || it.countries.includes(navCountry))
          if (items.length === 0) return null   // no mostrar cabecera de sección vacía
          return (
          <div key={g.sec}>
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
                {it.proOnly && (
                  <span style={{ marginLeft:'auto', fontSize:8, fontFamily:'var(--mono)', background:'color-mix(in srgb, var(--warn) 18%, transparent)', color:'var(--amb)', borderRadius:4, padding:'1px 5px', letterSpacing:'.5px', fontWeight:700 }}>PRO</span>
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
          <div className={s.logoSub}>v1.5</div>
        </div>

        <NavItems onNavigate={navigate} />

        <div className={s.footer}>
          <button className={s.themeBtn} onClick={toggleTheme}>
            {isDark ? '☀ ' + t('settings.theme.light') : '◑ ' + t('settings.theme.dark')}
          </button>
          <button className={s.themeBtn} onClick={() => signOutAuth()}>
            ⏻ {t('settings.account.logoutBtn')}
          </button>
          <div className={s.legalLinks}>
            <button type="button" onClick={() => navigate('privacy')} className={s.legalLink}>{t('nav.legal.privacy')}</button>
            <button type="button" onClick={() => navigate('terms')} className={s.legalLink}>{t('nav.legal.terms')}</button>
            <button type="button" onClick={() => navigate('disclaimer')} className={s.legalLink}>{t('nav.legal.disclaimer')}</button>
            <a href='https://www.moyiq.app/docs/' target='_blank' className={s.legalLink} style={{textDecoration:'none'}}>{t('nav.legal.help')}</a>
          </div>
          {SHOW_FIRMA && (
            <div style={{ display:'flex', justifyContent:'center', padding:'8px 0 2px' }}
              title={t('nav.noServerTag')}>
              <PrivacySeal size={72} />
            </div>
          )}
          <div className={s.appVersion}>
            MOY IQ v1.5 · MAXNOVA & LUCI Global LLC<br/>
            <span style={{opacity:.5}}>{t('nav.noServerTag')}</span>
          </div>
          <div style={{marginTop:6}}><BackupStatusBadge compact /></div>
        </div>
      </nav>

      {/* ── OVERLAY del drawer (solo móvil) ── */}
      {drawerOpen && <div className={s.overlay} onClick={() => setDrawerOpen(false)} />}

      {/* ── DRAWER MÓVIL ── */}
      {/* inert cuando está cerrado se setea vía ref más arriba, no como prop JSX
          (ver comentario junto a drawerRef). */}
      <nav ref={drawerRef} tabIndex={-1} role="dialog" aria-modal={drawerOpen} aria-label={t('nav.menuLabel')}
        className={s.drawer + (drawerOpen ? ' ' + s.drawerOpen : '')}>
        <div className={s.drawerHeader}>
          <div className={s.logo} style={{border:'none', padding:0, margin:0}}>
            <Logo size={19} />
            <div className={s.logoSub}>v1.5</div>
          </div>
          <button className={s.drawerClose} onClick={() => setDrawerOpen(false)} aria-label={t('nav.closeMenu')}><span style={{fontSize:18}}>✕</span></button>
        </div>

        <div className={s.drawerNav}>
          <NavItems onNavigate={navigate} />
        </div>

        <div className={s.drawerFooter}>
          <button className={s.themeBtn} onClick={toggleTheme}>
            {isDark ? '☀ ' + t('settings.theme.light') : '◑ ' + t('settings.theme.dark')}
          </button>
          <button className={s.themeBtn} onClick={() => signOutAuth()}>
            ⏻ {t('settings.account.logoutBtn')}
          </button>
          <div style={{marginTop:8}}><BackupStatusBadge compact /></div>
        </div>
      </nav>

      {/* ── ÁREA PRINCIPAL ── */}
      <div className={s.main}>

        {/* Topbar móvil — botón ☰ + atrás + título */}
        <div className={s.topbar}>
          <div className={s.topLeft}>
            {/* Botón hamburguesa — solo móvil */}
            <button
              className={s.menuBtn}
              onClick={() => setDrawerOpen(true)} aria-label={t('nav.openMenu')}
            >
              <span style={{fontSize:18}}>☰</span><span style={{fontSize:10,fontFamily:"var(--mono)",display:"block",lineHeight:1,marginTop:2}}>{t('nav.menuLabel')}</span>
            </button>
            {/* Botón atrás — solo móvil, si no está en dashboard */}
            {page !== 'dashboard' && (
              <button className={s.backBtn} onClick={goBack} aria-label={t('nav.goBack')}>
                {t('nav.back')}
              </button>
            )}
          </div>
          <span className={s.crumb}>{t(pageLabel(page))}</span>
          <span className={s.topRight}>MOY IQ · {settings.currency || 'CLP'}</span>
        </div>

        <main className={s.content} ref={contentRef} tabIndex={-1} style={{ outline: 'none' }} aria-label={t(pageLabel(page))}>
          <div className={s.contentInner}>
            {children}
          </div>
        </main>

        {/* FAB — abre captura rápida directa (1 tap), solo móvil */}
        <div className={s.fabWrap}>
          <button
            className={s.fab}
            onClick={() => setQuickAdd('expense')}
            aria-label={t('qa.title')}
          >
            +
          </button>
        </div>
      </div>

      <QuickAdd open={!!quickAdd} defaultType={quickAdd || 'expense'} onClose={() => setQuickAdd(null)} />
    </div>
  )
}

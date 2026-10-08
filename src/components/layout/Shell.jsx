// src/components/layout/Shell.jsx — Fase mobile nav

import { useState, useEffect, useRef } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import s from './shell.module.css'
import { BackupStatusBadge } from '../backup/BackupManager.jsx'
import QuickAdd from '../QuickAdd.jsx'
import PrivacySeal from '../PrivacySeal.jsx'
import CountryBadge from '../CountryBadge.jsx'
import Logo, { Monogram } from '../Logo.jsx'
import { NAV_ICONS } from '../icons/Icons.jsx'
import { signOutAuth } from '../../core/auth.js'
import { useKeyboardOpen } from '../../hooks/useKeyboardOpen.js'
import { NAV, pageLabel } from './navConfig.js'
import TabBar from './TabBar.jsx'
import { Eye, EyeOff } from 'lucide-react'

// Firma del producto (Sello + badges de país) — visible por defecto.
const SHOW_FIRMA = true

export default function Shell({ page, setPage, children }) {
  const { settings, updateSettings } = useApp()
  const { t } = useT()
  const isChile = (settings.country || 'CL') === 'CL'
  const isDark = settings.theme === 'dark'

  const [quickAdd, setQuickAdd] = useState(null) // null | 'expense' | 'income'

  // Con el teclado virtual abierto, el TabBar queda flotando arriba de él o lo
  // tapa — se oculta mientras se escribe (ver useKeyboardOpen).
  const keyboardOpen = useKeyboardOpen()

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

  function navigate(id) {
    // startViewTransition() da el fundido nativo entre pantallas; sin soporte
    // (Firefox, Safari < 18) cae directo a setPage sin transición — no rompe nada.
    if (document.startViewTransition) document.startViewTransition(() => setPage(id))
    else setPage(id)
  }

  // ── Ocultar montos (T13) ─────────────────────────────────────────────────────
  // Preferencia de este dispositivo (no viaja en respaldos ni sync, ver
  // utils/money.js). El anuncio va a una región aria-live propia: el botón ya
  // expone su estado con aria-pressed, pero el cambio de toda la pantalla
  // (cifras → "Monto oculto") merece decirse en voz alta una vez.
  const amountsHidden = !!settings.hideAmounts
  const [amountsAnnounce, setAmountsAnnounce] = useState('')
  function toggleAmounts() {
    const next = !amountsHidden
    updateSettings({ ...settings, hideAmounts: next })
    setAmountsAnnounce(t(next ? 'money.announce.hidden' : 'money.announce.shown'))
  }
  // Atajo "H" en escritorio, solo si el foco no está en un campo editable.
  useEffect(() => {
    function onKey(e) {
      if (e.key !== 'h' && e.key !== 'H') return
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat || e.defaultPrevented) return
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
          const items = g.items.filter(it => !it.countries || it.countries.includes(navCountry))
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
                {it.proOnly && (
                  // Contraste: un color-mix(var(--warn) 18%) diluye el mismo tono que el
                  // texto (--warn === --amb) y queda en ~4.17:1 en claro (bajo AA 4.5:1) —
                  // subir el % empeora el contraste porque converge hacia el color del
                  // texto (verificado: 28% da ~3.59:1 en claro y baja el oscuro de 5.11:1
                  // a 4.14:1, rompiéndolo también). --amb-bg ya es el tono claro correcto
                  // para este par (mismo que usa .badge_amber en ui.module.css): ~4.74:1
                  // en claro, ~5.32:1 en oscuro sobre el fondo real del sidebar (--sur).
                  <span style={{ marginLeft:'auto', fontSize:8, fontFamily:'var(--mono)', background:'var(--amb-bg)', color:'var(--amb)', borderRadius:4, padding:'1px 5px', letterSpacing:'.5px', fontWeight:700 }}>PRO</span>
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

      {/* ── ÁREA PRINCIPAL ── */}
      <div className={s.main}>

        {/* Topbar — título de la página + moneda. En móvil el TabBar es la
            navegación primaria (ver más abajo); no hay hamburguesa ni "atrás". */}
        <div className={s.topbar}>
          <div className={s.topLeft} />
          <span className={s.crumb}>{t(pageLabel(page))}</span>
          <span className={s.topRight}>
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
            <span>MOY IQ · {settings.currency || 'CLP'}</span>
          </span>
          <span className="sr-only" role="status" aria-live="polite">{amountsAnnounce}</span>
        </div>

        <main className={s.content} ref={contentRef} tabIndex={-1} style={{ outline: 'none' }} aria-label={t(pageLabel(page))}>
          <div className={s.contentInner}>
            {children}
          </div>
        </main>

        {/* TABBAR móvil — navegación primaria; "+" abre QuickAdd, "more" navega
            a la página que lista el árbol completo de NAV. */}
        <div className={keyboardOpen ? s.tabbarHidden : undefined}>
          <TabBar page={page} onNavigate={navigate} onAdd={() => setQuickAdd('expense')} t={t} />
        </div>
      </div>

      <QuickAdd open={!!quickAdd} defaultType={quickAdd || 'expense'} onClose={() => setQuickAdd(null)} />
    </div>
  )
}

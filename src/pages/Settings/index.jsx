// src/pages/Settings/index.jsx — v1.6 (R10, ola C, 30-oct-2026)
// Ajustes ya no es una pantalla de ~15 alturas: la raíz es una lista corta de
// filas agrupadas (ícono, título, una línea, chevron) con un buscador arriba.
// Cada fila abre una subpantalla dentro de la misma página, con "‹ Ajustes"
// para volver; la subpantalla queda en history.state (settingsIndex.js:
// SUB_KEY), así el atrás del navegador, de Android y el gesto de iOS vuelven a
// la raíz de Ajustes antes de salir. Dónde quedó cada control de antes:
// CONTROL_MAP en settingsIndex.js (verificado por settingsIndex.test.js).
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  UserRound, Coins, Palette, LayoutTemplate, DatabaseBackup, ShieldCheck, Bell,
  CreditCard, SlidersHorizontal, TriangleAlert, Search, ChevronRight, ChevronLeft, X, Sparkles } from 'lucide-react'
import { PageHeader } from '../../components/ui/index.jsx'
import TemplateSelector from '../../components/templates/TemplateSelector.jsx'
import SecuritySection from './SecuritySection.jsx'
import ProfileScreen from './ProfileScreen.jsx'
import CurrencyScreen from './CurrencyScreen.jsx'
import AppearanceScreen from './AppearanceScreen.jsx'
import FeaturesScreen from './FeaturesScreen.jsx'
import DataScreen from './DataScreen.jsx'
import NotificationsScreen from './NotificationsScreen.jsx'
import PlanScreen from './PlanScreen.jsx'
import AdvancedScreen from './AdvancedScreen.jsx'
import DangerScreen from './DangerScreen.jsx'
import { Setting } from './settingsUi.jsx'
// Mismas filas que el Menú (patrón rial ya aprobado): grupo con título, lista
// en una superficie, fila de ≥ 52 px con ícono, texto y chevron.
import m from '../More/more.module.css'
import { SETTINGS_SECTIONS, groupById, searchSettings, subFromState, withSub, takePendingSub } from './settingsIndex.js'
import { wantsDeleteAccount, initialSearch } from '../../utils/deepLink.js'
import { announceSubBack } from '../../components/layout/pageStack.js'
import { getSession } from '../../core/auth.js'
import { getLicensePlan } from '../../utils/licenseValidator.js'
import config from '../../config.js'
import { useT } from '../../i18n/useT.js'

const ICONS = {
  profile: UserRound, currency: Coins, appearance: Palette, templates: LayoutTemplate, features: Sparkles,
  data: DatabaseBackup, security: ShieldCheck, notifications: Bell, plan: CreditCard,
  advanced: SlidersHorizontal, danger: TriangleAlert,
}

const scrollRoot = () => document.querySelector('[data-scroll-root]')
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export default function Settings() {
  const { t } = useT()
  const isDemo = typeof window !== 'undefined' && window.location.search.includes('demo=true')
  const [autoOpenDelete] = useState(() => typeof window !== 'undefined' && wantsDeleteAccount(initialSearch(window.location.search)))
  // Subpantalla abierta: la de history.state (recarga, o volver desde otra
  // página) o "Zona de riesgo" si se llegó por ?open=delete-account.
  const [sub, setSub] = useState(() => subFromState(typeof history !== 'undefined' ? history.state : null) || (autoOpenDelete ? 'danger' : null))
  const subRef = useRef(sub)
  subRef.current = sub
  const [focusItem, setFocusItem] = useState(null)
  const [query, setQuery] = useState('')
  const lastRow = useRef(null)
  const rootScroll = useRef(0)
  const headingRef = useRef(null)

  const [accountEmail, setAccountEmail] = useState(null)
  const [accountUserId, setAccountUserId] = useState(null)
  useEffect(() => { getSession().then(s => { setAccountEmail(s?.user?.email || null); setAccountUserId(s?.user?.id || null) }) }, [])

  // Instalar como app: el evento llega una vez, se escucha mientras Ajustes
  // está montado (igual que antes) y se pasa a Avanzado.
  const [installPrompt, setInstallPrompt] = useState(null)
  const [installed, setInstalled] = useState(false)
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
  const isStandalone = typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true)
  useEffect(() => {
    function onBeforeInstall(e) { e.preventDefault(); setInstallPrompt(e) }
    function onAppInstalled() { setInstalled(true); setInstallPrompt(null) }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onAppInstalled)
    if (isStandalone) setInstalled(true)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [isStandalone])
  async function handleInstall() {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') setInstalled(true)
    setInstallPrompt(null)
  }

  // Atrás del navegador / Android / gesto de iOS: la entrada de la
  // subpantalla sale y queda la de la raíz (sin SUB_KEY).
  useEffect(() => {
    function onPop(e) {
      const next = subFromState(e.state)
      if (subRef.current && !next) restoreRoot()
      setSub(next)
      setFocusItem(null)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  function restoreRoot() {
    const top = rootScroll.current
    const id = lastRow.current
    requestAnimationFrame(() => {
      const el = scrollRoot(); if (el) el.scrollTop = top
      if (id) document.querySelector(`[data-group-row="${id}"]`)?.focus({ preventScroll: true })
    })
  }

  const openSub = useCallback((id, item = null) => {
    if (!groupById(id)) return
    const el = scrollRoot()
    rootScroll.current = el ? el.scrollTop : 0
    lastRow.current = id
    try { history.pushState(withSub(history.state, id), '') } catch { /* history no disponible: queda solo el estado de React */ }
    setSub(id)
    setFocusItem(item)
  }, [])

  // Pedido desde otra página (requestSettingsSub): se abre como si se tocara
  // la fila, así "atrás" vuelve a la raíz de Ajustes.
  useEffect(() => {
    const pending = takePendingSub()
    if (pending && !subFromState(history.state)) openSub(pending)
  }, [openSub])

  // El "‹" de la barra superior vuelve a la raíz de Ajustes mientras haya
  // una subpantalla abierta (pageStack.js › SUB_BACK_EVENT).
  useEffect(() => {
    announceSubBack(sub ? 'settings.title' : null)
    return () => announceSubBack(null)
  }, [sub])

  function closeSub() {
    if (subFromState(history.state)) { history.back(); return }
    setSub(null)
    setFocusItem(null)
    restoreRoot()
  }

  // Al abrir: arriba de todo y foco en el título; si se llegó desde el
  // buscador a un ajuste de adentro, se lo trae a la vista y se marca un momento.
  useEffect(() => {
    if (!sub) return
    if (!focusItem) {
      const el = scrollRoot(); if (el) el.scrollTop = 0
      if (!autoOpenDelete || sub !== 'danger') headingRef.current?.focus({ preventScroll: true })
      return
    }
    const id = setTimeout(() => {
      const target = document.querySelector(`[data-settings-sub] [data-setting="${focusItem}"]`)
      if (!target) { headingRef.current?.focus({ preventScroll: true }); return }
      target.scrollIntoView?.({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' })
      target.setAttribute('tabindex', '-1')
      target.focus({ preventScroll: true })
      target.style.transition = 'background-color .6s ease'
      target.style.backgroundColor = 'var(--sur2)'
      setTimeout(() => { target.style.backgroundColor = '' }, 1400)
    }, 80)
    return () => clearTimeout(id)
  }, [sub, focusItem, autoOpenDelete])

  if (sub) {
    const g = groupById(sub)
    return (
      <div className="stack" data-settings-sub={sub}>
        <div>
          {/* En el celular el "‹ Ajustes" vive en la barra superior (Shell). */}
          <button type="button" className="fos-hide-mobile" onClick={closeSub} aria-label={t('settings.backTo')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 2, minHeight: 44, padding: '0 8px 0 0', background: 'none', border: 'none', color: 'var(--blu)', fontSize: 14, fontFamily: 'var(--sans)', cursor: 'pointer' }}>
            <ChevronLeft size={20} strokeWidth={1.7} aria-hidden="true" />{t('settings.title')}
          </button>
          <h2 ref={headingRef} tabIndex={-1}
            style={{ margin: '4px 0 2px', fontSize: 22, fontWeight: 700, color: sub === 'danger' ? 'var(--red)' : 'var(--tx)', fontFamily: 'var(--display)', outline: 'none' }}>
            {t(g.title)}
          </h2>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--tm)', lineHeight: 1.5 }}>{t(g.desc)}</p>
        </div>
        <div style={{ borderTop: '1px solid var(--brd2)', paddingTop: 4 }}>
          {sub === 'profile'       && <ProfileScreen isDemo={isDemo} accountEmail={accountEmail} />}
          {sub === 'currency'      && <CurrencyScreen />}
          {sub === 'appearance'    && <AppearanceScreen />}
          {sub === 'features'      && <FeaturesScreen />}
          {sub === 'templates'     && (
            <Setting id="templates" style={{ paddingTop: 10 }}>
              <div style={{fontSize:11,color:'var(--th)',fontFamily: 'var(--sans)',marginBottom:12,lineHeight:1.5}}>
                {t('settings.templates.sub')}
              </div>
              <TemplateSelector />
            </Setting>
          )}
          {sub === 'data'          && <DataScreen />}
          {sub === 'security'      && <SecuritySection />}
          {sub === 'notifications' && <NotificationsScreen />}
          {sub === 'plan'          && <PlanScreen isDemo={isDemo} accountUserId={accountUserId} />}
          {sub === 'advanced'      && <AdvancedScreen install={{ prompt: installPrompt, installed, isIOS, isStandalone, onInstall: handleInstall }} />}
          {sub === 'danger'        && <DangerScreen isDemo={isDemo} accountEmail={accountEmail} autoOpenDelete={autoOpenDelete} />}
        </div>
      </div>
    )
  }

  const results = searchSettings(query, t)
  const showUpgradeHint = !isDemo && getLicensePlan() !== 'pro'

  return (
    <div className="stack">
      <PageHeader title={t('settings.title')} sub={t('settings.sub')} />

      <div data-tour="set-search" role="search" style={{ position: 'relative' }}>
        <label htmlFor="settings-search" className="sr-only">{t('settings.search.label')}</label>
        <Search size={16} strokeWidth={1.7} aria-hidden="true" style={{ position: 'absolute', left: 12, top: 14, color: 'var(--th)', pointerEvents: 'none' }} />
        <input
          id="settings-search"
          type="text"
          enterKeyHint="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t('settings.search.placeholder')}
          autoComplete="off"
          aria-describedby={results ? 'settings-search-status' : undefined}
          style={{ width: '100%', boxSizing: 'border-box', minHeight: 44, padding: '10px 40px 10px 36px', fontSize: 16, borderRadius: 10, border: '0.5px solid var(--brd2)', background: 'var(--sur2)', color: 'var(--tx)', fontFamily: 'var(--sans)' }}
        />
        {query && (
          <button type="button" onClick={() => setQuery('')} aria-label={t('settings.search.clear')}
            style={{ position: 'absolute', right: 0, top: 0, width: 44, height: 44, display: 'grid', placeItems: 'center', background: 'none', border: 'none', color: 'var(--th)', cursor: 'pointer' }}>
            <X size={16} strokeWidth={1.7} aria-hidden="true" />
          </button>
        )}
      </div>

      {results ? (
        <div>
          <p id="settings-search-status" role="status" style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--tm)' }}>
            {results.length ? t('settings.search.count', { n: results.length }) : t('settings.search.none', { q: query.trim() })}
          </p>
          {results.length > 0 && (
            <div className={m.list}>
              {results.map(r => (
                <GroupRow
                  key={`${r.groupId}-${r.itemId || ''}`}
                  id={r.groupId}
                  title={r.label}
                  desc={r.kind === 'item' ? r.context : t(groupById(r.groupId).desc)}
                  onClick={() => openSub(r.groupId, r.itemId || null)}
                  danger={r.groupId === 'danger'}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div data-tour="set-groups">
          {SETTINGS_SECTIONS.map(sec => (
            <section key={sec.id} className={m.group} aria-labelledby={`settings-sec-${sec.id}`}>
              <h2 id={`settings-sec-${sec.id}`} className={m.groupTitle}>{t(sec.title)}</h2>
              <div className={m.list}>
                {sec.groups.map(id => {
                  const g = groupById(id)
                  const desc = id === 'plan' && showUpgradeHint ? t('settings.upgrade.title', { days: config.pricing.trialDays }) : t(g.desc)
                  return <GroupRow key={id} id={id} title={t(g.title)} desc={desc} onClick={() => openSub(id)} danger={id === 'danger'} />
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* UXP-6: mismo tiempo de respuesta que publica moyiq.app/ayuda. */}
      <p style={{fontSize:13,color:'var(--tm)',lineHeight:1.6,margin:'12px 2px 0'}}>
        {t('settings.support.line')}{' '}
        <a href="mailto:support@moyiq.app" style={{color:'var(--tx)'}}>support@moyiq.app</a>
        {' · '}{t('settings.support.time')}{' · '}
        <a href="https://moyiq.app/ayuda.html" target="_blank" rel="noopener noreferrer" style={{color:'var(--tx)'}}>{t('nav.legal.help')}</a>
      </p>
      <div style={{padding:'10px 12px',background:'var(--sur2)',borderRadius:'var(--r)',border:'0.5px solid var(--brd)',fontSize:11,color:'var(--th)',fontFamily: 'var(--sans)',lineHeight:1.7,marginTop:8}}>
        {t('settings.footer')}
      </div>
    </div>
  )
}

// Fila de la raíz (patrón rial): ícono, título, una línea y chevron. Zona de
// riesgo en rojo (nunca Latón). Toda la fila es el botón (≥ 56 px de alto).
function GroupRow({ id, title, desc, onClick, danger }) {
  const Icon = ICONS[id] || ChevronRight
  return (
    <button type="button" data-group-row={id} onClick={onClick} className={m.row} style={danger ? { color: 'var(--red)' } : undefined}>
      <span className={m.rowIc} aria-hidden="true" style={{ color: danger ? 'var(--red)' : 'var(--tm)' }}>
        <Icon size={18} strokeWidth={1.7} />
      </span>
      <span className={m.rowLabel}>
        <span style={{ display: 'block' }}>{title}</span>
        <span style={{ display: 'block', fontSize: 12, color: 'var(--th)', marginTop: 2, lineHeight: 1.4 }}>{desc}</span>
      </span>
      <ChevronRight size={16} strokeWidth={1.8} aria-hidden="true" className={m.chev} />
    </button>
  )
}

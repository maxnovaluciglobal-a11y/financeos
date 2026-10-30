// src/pages/More/index.jsx — pestaña "Más" del TabBar (antes "Menú", R11).
// Poda P1 (30-oct-2026): 4 grupos con nombre y ≤ 10 filas (moreSections() en
// navConfig.js): Mi dinero · Panorama · Herramientas · Cuenta. Arriba, la
// cabecera de cuenta (email y plan; el estado del respaldo vive en Ajustes ›
// Datos y en "Para hacer" del Inicio cuando está vencido). Al final, tema,
// cerrar sesión, legales y versión.
import { useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { Lock, Sun, Moon, LogOut, ChevronRight, Calculator, MessageSquare, CreditCard, ExternalLink, Wrench, Sparkles } from 'lucide-react'
import { useT } from '../../i18n/useT.js'
import { PageHeader } from '../../components/ui/index.jsx'
import { moreSections, showProChip } from '../../components/layout/navConfig.js'
import { requestSettingsSub } from '../Settings/settingsIndex.js'
import { NAV_ICONS } from '../../components/icons/Icons.jsx'
import CountryBadge from '../../components/CountryBadge.jsx'
import Sheet from '../../components/ui/Sheet.jsx'
import { getSession, signOutAuth } from '../../core/auth.js'
import { getLicensePlan } from '../../utils/licenseValidator.js'
import FeedbackSheet from '../../components/FeedbackSheet.jsx'
import { STRIPE_PORTAL_URL } from '../legal/legalMeta.js'
import s from './more.module.css'
import { logRejection } from '../../utils/errorLog.js'
import { useResolvedTheme } from '../../hooks/useResolvedTheme.js'

const SHOW_FIRMA = true

function AccountHeader({ setPage }) {
  const { settings } = useApp()
  const { t } = useT()
  const isDemo = !!settings.isDemo
  const [email, setEmail] = useState(null)
  useEffect(() => {
    if (isDemo) return
    let alive = true
    getSession().then(sess => { if (alive) setEmail(sess?.user?.email || null) }).catch(logRejection('More:31'))
    return () => { alive = false }
  }, [isDemo])

  const isPro = getLicensePlan() === 'pro'
  const name = isDemo ? t('menu.account.demo') : (email || t('menu.account.local'))
  const initial = (isDemo ? 'D' : (email || 'M')).trim().charAt(0).toUpperCase()

  return (
    <section className={s.account} aria-label={t('menu.account.aria')}>
      <div className={s.accountTop}>
        <span className={s.avatar} aria-hidden="true">{initial}</span>
        <div className={s.accountBody}>
          <div className={s.accountName}>{name}</div>
          <div className={s.accountMeta}>
            {!isDemo && <span className={isPro ? s.planPro : s.plan}>{t(isPro ? 'menu.plan.pro' : 'menu.plan.starter')}</span>}
            {!isDemo && isPro && STRIPE_PORTAL_URL && (
              <a href={STRIPE_PORTAL_URL} target="_blank" rel="noopener noreferrer" className={s.manage}>
                <CreditCard size={14} strokeWidth={1.7} aria-hidden="true" />{t('menu.manageSub')}
                <ExternalLink size={12} strokeWidth={1.8} aria-hidden="true" />
                <span className="sr-only">{t('menu.manageSubHint')}</span>
              </a>
            )}
          </div>
        </div>
      </div>
      {!isDemo && !isPro && (
        <button type="button" className={s.upgrade} onClick={() => { requestSettingsSub('plan'); setPage('settings') }}>
          <span>
            <span className={s.upgradeTitle}>{t('menu.upgrade.title')}</span>
            <span className={s.upgradeSub}>{t('settings.upgrade.sub')}</span>
          </span>
          <ChevronRight size={18} strokeWidth={1.8} aria-hidden="true" />
        </button>
      )}
    </section>
  )
}

function RowIcon({ it }) {
  if (it.tool) return <Calculator size={18} strokeWidth={1.7} />
  if (it.id === 'countryTools') return <Wrench size={18} strokeWidth={1.7} />
  if (it.id === 'modules') return <Sparkles size={18} strokeWidth={1.7} />
  if (SHOW_FIRMA && it.cc) return <CountryBadge code={it.cc} />
  const Ic = NAV_ICONS[it.id]
  return Ic ? <Ic size={18} /> : (it.ic || null)
}

export default function More({ setPage }) {
  const { settings, updateSettings } = useApp()
  const { t } = useT()
  // Con "Sistema" el atajo muestra el opuesto de lo que se ve y fija ese tema.
  const isDark = useResolvedTheme(settings.theme) === 'dark'
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [countrySheet, setCountrySheet] = useState(null)
  const plan = getLicensePlan()

  function toggleTheme() {
    updateSettings({ ...settings, theme: isDark ? 'light' : 'dark' })
  }

  function open(it) {
    if (it.sheet) return setCountrySheet(it)
    if (it.action === 'features') { requestSettingsSub('features'); return setPage('settings') }
    setPage(it.id)
  }

  return (
    <div>
      <PageHeader title={t('nav.menuLabel')} />

      <AccountHeader setPage={setPage} />

      {moreSections(settings.country, settings).map(g => (
        <div key={g.sec} className={s.group}>
          <h2 className={s.groupTitle}>{t(g.sec)}</h2>
          <div className={s.list}>
            {g.items.map(it => (
              <button key={it.id} type="button" className={s.row} onClick={() => open(it)}
                aria-haspopup={it.sheet ? 'dialog' : undefined}>
                <span className={s.rowIc} aria-hidden="true"><RowIcon it={it} /></span>
                <span className={s.rowLabel}>{t(it.lb)}</span>
                {showProChip(it, plan) && <span className={s.pro}>PRO</span>}
                <ChevronRight size={16} strokeWidth={1.8} aria-hidden="true" className={s.chev} />
              </button>
            ))}
          </div>
        </div>
      ))}

      {!settings.isDemo && <FeedbackSheet open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />}

      {/* Herramientas de mi país: una hoja con todas (CL, MX, ES, PT…). */}
      <Sheet open={!!countrySheet} onClose={() => setCountrySheet(null)} ariaLabel={t('more.countryTools')} maxWidth={420}>
        <h2 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 700, color: 'var(--tx)' }}>{t('more.countryTools')}</h2>
        <div className={s.list}>
          {(countrySheet?.items || []).map(it => (
            <button key={it.id} type="button" className={s.row} onClick={() => { setCountrySheet(null); setPage(it.id) }}>
              <span className={s.rowIc} aria-hidden="true"><RowIcon it={it} /></span>
              <span className={s.rowLabel}>{t(it.lb)}</span>
              {showProChip(it, plan) && <span className={s.pro}>PRO</span>}
              <ChevronRight size={16} strokeWidth={1.8} aria-hidden="true" className={s.chev} />
            </button>
          ))}
        </div>
      </Sheet>

      <div className={s.actions}>
        {!settings.isDemo && (
          <button type="button" onClick={() => setFeedbackOpen(true)} className={s.action} aria-haspopup="dialog">
            <MessageSquare size={16} strokeWidth={1.7} aria-hidden="true" />{t('more.help')}
          </button>
        )}
        <button type="button" onClick={toggleTheme} className={s.action}>
          {isDark
            ? <><Sun size={16} strokeWidth={1.7} aria-hidden="true" />{t('settings.theme.light')}</>
            : <><Moon size={16} strokeWidth={1.7} aria-hidden="true" />{t('settings.theme.dark')}</>}
        </button>
        {!settings.isDemo && (
          <button type="button" onClick={() => signOutAuth()} className={s.action}>
            <LogOut size={16} strokeWidth={1.7} aria-hidden="true" />{t('settings.account.logoutBtn')}
          </button>
        )}
      </div>

      <div className={s.legal}>
        <button type="button" onClick={() => setPage('privacy')} className={s.legalLink}>{t('nav.legal.privacy')}</button>
        <button type="button" onClick={() => setPage('terms')} className={s.legalLink}>{t('nav.legal.terms')}</button>
        <button type="button" onClick={() => setPage('disclaimer')} className={s.legalLink}>{t('nav.legal.disclaimer')}</button>
        <a href="https://moyiq.app/ayuda.html" target="_blank" rel="noreferrer" className={s.legalLink}>{t('nav.legal.help')}</a>
      </div>

      <div className={s.version}>
        MOY IQ v1.5 · MAXNOVA &amp; LUCI Global LLC<br />
        <span className={s.versionLock}><Lock size={12} strokeWidth={1.7} aria-hidden="true" />{t('nav.noServerTag')}</span>
      </div>
    </div>
  )
}

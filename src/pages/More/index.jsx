// src/pages/More/index.jsx — pestaña "Menú" del TabBar (R11).
// Arriba, la cabecera de cuenta: email, plan (Starter/Pro) y estado del
// respaldo. Después, el árbol completo de NAV (navConfig.js, sin duplicarlo)
// en el orden de menuSections(): Planificación primero — Presupuestos salió de
// la barra — y Cuenta (Ajustes), tema y cerrar sesión al final.
import { useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { Lock, Sun, Moon, LogOut, ChevronRight, Calculator, MessageSquare, CreditCard, ExternalLink } from 'lucide-react'
import { useT } from '../../i18n/useT.js'
import { PageHeader } from '../../components/ui/index.jsx'
import { menuSections, showProChip } from '../../components/layout/navConfig.js'
import { NAV_ICONS } from '../../components/icons/Icons.jsx'
import CountryBadge from '../../components/CountryBadge.jsx'
import { BackupStatusBadge } from '../../components/backup/BackupManager.jsx'
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
            {!isDemo && <BackupStatusBadge compact />}
          </div>
        </div>
      </div>
      {!isDemo && !isPro && (
        <button type="button" className={s.upgrade} onClick={() => setPage('settings')}>
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

export default function More({ setPage }) {
  const { settings, updateSettings } = useApp()
  const { t } = useT()
  // Con "Sistema" el atajo muestra el opuesto de lo que se ve y fija ese tema.
  const isDark = useResolvedTheme(settings.theme) === 'dark'
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const plan = getLicensePlan()
  const isPro = plan === 'pro'

  function toggleTheme() {
    updateSettings({ ...settings, theme: isDark ? 'light' : 'dark' })
  }

  return (
    <div>
      <PageHeader title={t('nav.menuLabel')} />

      <AccountHeader setPage={setPage} />

      {menuSections(settings.country).map(g => (
        <div key={g.sec} className={s.group}>
          <h2 className={s.groupTitle}>{t(g.sec)}</h2>
          <div className={s.list}>
            {g.items.map(it => (
              <button key={it.id} type="button" className={s.row} onClick={() => setPage(it.id)}>
                <span className={s.rowIc} aria-hidden="true">
                  {it.tool
                    ? <Calculator size={18} strokeWidth={1.7} />
                    : SHOW_FIRMA && it.cc
                    ? <CountryBadge code={it.cc} />
                    : NAV_ICONS[it.id]
                      ? (() => { const Ic = NAV_ICONS[it.id]; return <Ic size={18} /> })()
                      : it.ic}
                </span>
                <span className={s.rowLabel}>{t(it.lb)}</span>
                {showProChip(it, plan) && <span className={s.pro}>PRO</span>}
                <ChevronRight size={16} strokeWidth={1.8} aria-hidden="true" className={s.chev} />
              </button>
            ))}
          </div>
        </div>
      ))}

      {!settings.isDemo && (
        <div className={s.group}>
          <h2 className={s.groupTitle}>{t('feedback.section')}</h2>
          <div className={s.list}>
            {isPro && STRIPE_PORTAL_URL && (
              <a href={STRIPE_PORTAL_URL} target="_blank" rel="noopener noreferrer" className={s.row} aria-describedby="menu-manage-sub-hint">
                <span className={s.rowIc} aria-hidden="true"><CreditCard size={18} strokeWidth={1.7} /></span>
                <span className={s.rowLabel}>{t('menu.manageSub')}</span>
                <span id="menu-manage-sub-hint" className="sr-only">{t('menu.manageSubHint')}</span>
                <ExternalLink size={16} strokeWidth={1.8} aria-hidden="true" className={s.chev} />
              </a>
            )}
            <button type="button" className={s.row} onClick={() => setFeedbackOpen(true)} aria-haspopup="dialog">
              <span className={s.rowIc} aria-hidden="true"><MessageSquare size={18} strokeWidth={1.7} /></span>
              <span className={s.rowLabel}>{t('feedback.title')}</span>
              <ChevronRight size={16} strokeWidth={1.8} aria-hidden="true" className={s.chev} />
            </button>
          </div>
          <FeedbackSheet open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
        </div>
      )}

      <div className={s.actions}>
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

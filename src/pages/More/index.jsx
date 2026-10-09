// src/pages/More/index.jsx — pestaña "Menú" del TabBar (R11).
// Arriba, la cabecera de cuenta: email, plan (Starter/Pro) y estado del
// respaldo. Después, el árbol completo de NAV (navConfig.js, sin duplicarlo)
// en el orden de menuSections(): Planificación primero — Presupuestos salió de
// la barra — y Cuenta (Ajustes), tema y cerrar sesión al final.
import { useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { Lock, Sun, Moon, LogOut, ChevronRight, Calculator } from 'lucide-react'
import { useT } from '../../i18n/useT.js'
import { PageHeader } from '../../components/ui/index.jsx'
import { menuSections } from '../../components/layout/navConfig.js'
import { NAV_ICONS } from '../../components/icons/Icons.jsx'
import CountryBadge from '../../components/CountryBadge.jsx'
import { BackupStatusBadge } from '../../components/backup/BackupManager.jsx'
import { getSession, signOutAuth } from '../../core/auth.js'
import { getLicensePlan } from '../../utils/licenseValidator.js'
import s from './more.module.css'

const SHOW_FIRMA = true

function AccountHeader({ setPage }) {
  const { settings } = useApp()
  const { t } = useT()
  const isDemo = !!settings.isDemo
  const [email, setEmail] = useState(null)
  useEffect(() => {
    if (isDemo) return
    let alive = true
    getSession().then(sess => { if (alive) setEmail(sess?.user?.email || null) }).catch(() => {})
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
  const isDark = settings.theme === 'dark'

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
                {it.proOnly && <span className={s.pro}>PRO</span>}
                <ChevronRight size={16} strokeWidth={1.8} aria-hidden="true" className={s.chev} />
              </button>
            ))}
          </div>
        </div>
      ))}

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
        <a href="https://www.moyiq.app/docs/" target="_blank" rel="noreferrer" className={s.legalLink}>{t('nav.legal.help')}</a>
      </div>

      <div className={s.version}>
        MOY IQ v1.5 · MAXNOVA &amp; LUCI Global LLC<br />
        <span className={s.versionLock}><Lock size={12} strokeWidth={1.7} aria-hidden="true" />{t('nav.noServerTag')}</span>
      </div>
    </div>
  )
}

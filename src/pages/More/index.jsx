// src/pages/More/index.jsx
// Reemplaza al drawer deslizable en móvil (tab "Menú" del TabBar). Reusa el
// mismo árbol NAV que antes vivía solo en Shell.jsx — ver navConfig.js — así
// que un id/label nuevo no se duplica entre el sidebar de escritorio y esta
// página.
import { useApp } from '../../context/AppContext.jsx'
import { Lock } from 'lucide-react'
import { useT } from '../../i18n/useT.js'
import { PageHeader } from '../../components/ui/index.jsx'
import { NAV } from '../../components/layout/navConfig.js'
import { NAV_ICONS } from '../../components/icons/Icons.jsx'
import CountryBadge from '../../components/CountryBadge.jsx'
import { BackupStatusBadge } from '../../components/backup/BackupManager.jsx'
import { signOutAuth } from '../../core/auth.js'

const SHOW_FIRMA = true

export default function More({ setPage }) {
  const { settings, updateSettings } = useApp()
  const { t } = useT()
  const isDark = settings.theme === 'dark'
  const navCountry = (settings.country || 'CL').toUpperCase()

  function toggleTheme() {
    updateSettings({ ...settings, theme: isDark ? 'light' : 'dark' })
  }

  return (
    <div>
      <PageHeader title={t('nav.menuLabel')} />

      {NAV.map(g => {
        const items = g.items.filter(it => !it.countries || it.countries.includes(navCountry))
        if (items.length === 0) return null
        return (
          <div key={g.sec} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--th)', textTransform: 'uppercase', letterSpacing: 1, padding: '0 2px 6px' }}>
              {t(g.sec)}
            </div>
            <div style={{ background: 'var(--sur)', border: '0.5px solid var(--brd)', borderRadius: 'var(--rl)', overflow: 'hidden' }}>
              {items.map((it, i) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => setPage(it.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 48,
                    padding: '10px 14px', background: 'none', border: 'none', borderTop: i > 0 ? '0.5px solid var(--brd)' : 'none',
                    textAlign: 'left', cursor: 'pointer', fontSize: 13.5, fontFamily: 'var(--sans)', color: 'var(--tx)',
                  }}
                >
                  <span style={{ width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} aria-hidden="true">
                    {SHOW_FIRMA && it.cc
                      ? <CountryBadge code={it.cc} />
                      : NAV_ICONS[it.id]
                        ? (() => { const Ic = NAV_ICONS[it.id]; return <Ic size={16} /> })()
                        : it.ic}
                  </span>
                  <span style={{ flex: 1 }}>{t(it.lb)}</span>
                  {it.proOnly && (
                    <span style={{ fontSize: 8, fontFamily: 'var(--mono)', background: 'var(--amb-bg)', color: 'var(--amb)', borderRadius: 4, padding: '1px 5px', letterSpacing: '.5px', fontWeight: 700 }}>PRO</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )
      })}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
        <button type="button" onClick={toggleTheme} style={{
          width: '100%', padding: '10px 0', background: 'var(--sur2)', border: '0.5px solid var(--brd)',
          borderRadius: 'var(--r)', fontSize: 12, fontFamily: 'var(--sans)', color: 'var(--tm)', cursor: 'pointer',
        }}>
          {isDark ? '☀ ' + t('settings.theme.light') : '◑ ' + t('settings.theme.dark')}
        </button>
        <button type="button" onClick={() => signOutAuth()} style={{
          width: '100%', padding: '10px 0', background: 'var(--sur2)', border: '0.5px solid var(--brd)',
          borderRadius: 'var(--r)', fontSize: 12, fontFamily: 'var(--sans)', color: 'var(--tm)', cursor: 'pointer',
        }}>
          ⏻ {t('settings.account.logoutBtn')}
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: 14, paddingTop: 10, borderTop: '0.5px solid var(--brd)' }}>
        <button type="button" onClick={() => setPage('privacy')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontFamily: 'var(--sans)', color: 'var(--th)', padding: '2px 0' }}>{t('nav.legal.privacy')}</button>
        <button type="button" onClick={() => setPage('terms')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontFamily: 'var(--sans)', color: 'var(--th)', padding: '2px 0' }}>{t('nav.legal.terms')}</button>
        <button type="button" onClick={() => setPage('disclaimer')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontFamily: 'var(--sans)', color: 'var(--th)', padding: '2px 0' }}>{t('nav.legal.disclaimer')}</button>
        <a href="https://www.moyiq.app/docs/" target="_blank" rel="noreferrer" style={{ fontSize: 11, fontFamily: 'var(--sans)', color: 'var(--th)', padding: '2px 0', textDecoration: 'none' }}>{t('nav.legal.help')}</a>
      </div>

      <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--th)', marginTop: 10, lineHeight: 1.5 }}>
        MOY IQ v1.5 · MAXNOVA &amp; LUCI Global LLC<br />
        <span style={{ opacity: .5 }}><Lock size={12} strokeWidth={1.7} aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: 5, flexShrink: 0 }} />{t('nav.noServerTag')}</span>
      </div>
      <div style={{ marginTop: 6 }}><BackupStatusBadge compact /></div>
    </div>
  )
}

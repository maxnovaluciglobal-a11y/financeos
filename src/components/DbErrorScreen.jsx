// src/components/DbErrorScreen.jsx — la base local existe pero no se pudo abrir
// (core/db: DbOpenError). Antes la app caía en silencio a localStorage y se
// mostraba VACÍA; lo que el usuario cargaba ahí no se mezclaba nunca con sus
// datos reales. Esta pantalla bloquea hasta reintentar.
import config from '../config.js'
import { useT } from '../i18n/useT.js'
import Logo from './Logo.jsx'

export default function DbErrorScreen() {
  const { t } = useT()
  const mail = `mailto:${config.app?.supportEmail || config.supportEmail || 'support@moyiq.app'}?subject=${encodeURIComponent(t('dbError.mailSubject'))}`
  return (
    <main role="alert" aria-labelledby="dberr-title" style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--bg)' }}>
      <div style={{ maxWidth: 440, width: '100%', background: 'var(--sur)', border: '.5px solid var(--brd)', borderRadius: 'var(--rxl)', boxShadow: 'var(--sh-2)', padding: '28px 24px' }}>
        <div style={{ marginBottom: 18 }}><Logo size={28} /></div>
        <h1 id="dberr-title" className="display" style={{ fontSize: 22, fontWeight: 600, color: 'var(--tx)', margin: '0 0 10px' }}>{t('dbError.title')}</h1>
        <p style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--tm)', margin: '0 0 10px' }}>{t('dbError.body')}</p>
        <p style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--tm)', margin: '0 0 20px' }}>{t('dbError.keep')}</p>
        <button type="button" className="fos-btn-primary" onClick={() => window.location.reload()}>{t('dbError.retry')}</button>
        <p style={{ fontSize: 13, color: 'var(--th)', margin: '16px 0 0', lineHeight: 1.5 }}>
          {t('dbError.help')} <a href={mail} style={{ color: 'var(--laton-700)', fontWeight: 600 }}>{t('dbError.contact')}</a>
        </p>
      </div>
    </main>
  )
}

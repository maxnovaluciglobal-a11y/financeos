// src/pages/Investments/index.jsx — Inversiones dentro de moyiq (opción B,
// decisión de Walter del 19-nov-2026). Se entra desde Más, el riel y la tarjeta
// de Panorama. Solo se abre con perfil de inversionista (utils/investProfile.js):
//   granted → Portfolio · needs-profile → puerta + cuestionario
//   no-account → pedir cuenta (con botón: recargar lleva a la puerta de
//   acceso de moyiq, components/AuthGate.jsx; coherencia 360 I-19) ·
//   loading → aviso breve
// Sin perfil no se pide nada al servidor (useInvestPortfolio queda 'locked').
import { useState } from 'react'
import { Check, ChartLine } from 'lucide-react'
import { PageHeader } from '../../components/ui/index.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { useInvestAccess } from '../../hooks/useInvestAccess.js'
import { moduleOn } from '../../utils/modules.js'
import { investFullHere } from '../../utils/uiFlags.js'
import { queueInvestTab } from '../../utils/investNav.js'
import Portfolio from './Portfolio.jsx'
import InvestHub from './hub/InvestHub.jsx'
import ProfileSheet from './ProfileSheet.jsx'
import s from './investments.module.css'
import { InvestStringsGate } from './i18n/investStrings.js'

function Gate({ onStart }) {
  const { t } = useT()
  return (
    <section className={s.gate} aria-labelledby="invest-gate-title">
      <span className={s.gateIcon} aria-hidden="true"><ChartLine size={24} strokeWidth={2} /></span>
      <h2 id="invest-gate-title" className={s.gateTitle}>{t('invest.gate.title')}</h2>
      <p className={s.gateBody}>{t('invest.gate.body')}</p>
      <ul className={s.gatePoints}>
        {['point1', 'point2', 'point3'].map(k => (
          <li key={k} className={s.gatePoint}><Check size={16} strokeWidth={2.4} />{t(`invest.gate.${k}`)}</li>
        ))}
      </ul>
      <button type="button" className={s.gateCta} onClick={onStart}>{t('invest.gate.cta')}</button>
      <p className={s.gateFree}>{t('invest.gate.free')}</p>
    </section>
  )
}

// `setPage` (el go de usePageStack) solo lo usa Inversiones completo para
// abrir la ficha de un activo; apagado (UI_FLAGS.investFull) no cambia nada.
export default function Investments(props) {
  return <InvestStringsGate><InvestmentsPage {...props} /></InvestStringsGate>
}

function InvestmentsPage({ setPage }) {
  const { t } = useT()
  const app = useApp() || {}
  const settings = app.settings || {}
  const { status, saveProfile } = useInvestAccess()
  const [asking, setAsking] = useState(false)
  const [full, setFull] = useState(investFullHere)
  const on = moduleOn(settings, 'investments') || !!settings.isDemo

  async function save(answers) {
    await saveProfile(answers)
    setAsking(false)
    app.showToast?.(t('invest.profile.done'))
  }

  let body
  if (!on) body = <p className={s.status}>{t('invest.gate.moduleOff')}</p>
  else if (status === 'loading') body = <p className={s.status} role="status">{t('invest.gate.loading')}</p>
  else if (status === 'no-account') {
    body = (
      <div className={s.actions}>
        <p className={s.status}>{t('invest.gate.noAccount')}</p>
        <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={() => { try { window.location.reload() } catch { /* sin ventana */ } }}>{t('invest.gate.signIn')}</button>
      </div>
    )
  }
  else if (status === 'needs-profile') body = <Gate onStart={() => setAsking(true)} />
  else {
    // Demo con la vista simple (?ui=invest-simple): "Registrar operaciones"
    // abre Portafolio › Movimientos acá mismo, no el sitio aparte (C8).
    const openHere = settings.isDemo ? () => { queueInvestTab('portafolio', 'movimientos'); setFull(true) } : undefined
    body = full ? <InvestHub setPage={setPage} demo={!!settings.isDemo} /> : <Portfolio onOpenHere={openHere} />
  }

  return (
    <div className={s.page}>
      <PageHeader title={t('nav.investments')} sub={t('invest.page.sub')} />
      {body}
      {status === 'needs-profile' && <ProfileSheet open={asking} onClose={() => setAsking(false)} onSave={save} />}
    </div>
  )
}

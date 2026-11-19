// src/pages/Investments/index.jsx — Inversiones dentro de moyiq (opción B,
// decisión de Walter del 19-nov-2026). Se entra desde Más, el riel y la tarjeta
// de Panorama. Solo se abre con perfil de inversionista (utils/investProfile.js):
//   granted → Portfolio · needs-profile → puerta + cuestionario
//   no-account → pedir cuenta · loading → aviso breve
// Sin perfil no se pide nada al servidor (useInvestPortfolio queda 'locked').
import { useState } from 'react'
import { Check, ChartLine } from 'lucide-react'
import { PageHeader } from '../../components/ui/index.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { useInvestAccess } from '../../hooks/useInvestAccess.js'
import { moduleOn } from '../../utils/modules.js'
import Portfolio from './Portfolio.jsx'
import ProfileSheet from './ProfileSheet.jsx'
import s from './investments.module.css'

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

export default function Investments() {
  const { t } = useT()
  const app = useApp() || {}
  const settings = app.settings || {}
  const { status, saveProfile } = useInvestAccess()
  const [asking, setAsking] = useState(false)
  const on = moduleOn(settings, 'investments') || !!settings.isDemo

  async function save(answers) {
    await saveProfile(answers)
    setAsking(false)
    app.showToast?.(t('invest.profile.done'))
  }

  let body
  if (!on) body = <p className={s.status}>{t('invest.gate.moduleOff')}</p>
  else if (status === 'loading') body = <p className={s.status} role="status">{t('invest.gate.loading')}</p>
  else if (status === 'no-account') body = <p className={s.status}>{t('invest.gate.noAccount')}</p>
  else if (status === 'needs-profile') body = <Gate onStart={() => setAsking(true)} />
  else body = <Portfolio />

  return (
    <div className={s.page}>
      <PageHeader title={t('nav.investments')} sub={t('invest.page.sub')} />
      {body}
      {status === 'needs-profile' && <ProfileSheet open={asking} onClose={() => setAsking(false)} onSave={save} />}
    </div>
  )
}

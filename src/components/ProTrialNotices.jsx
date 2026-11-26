// src/components/ProTrialNotices.jsx — avisos de la prueba de 14 días de Pro sin
// tarjeta (modelo A, 26-nov-2026). Uno a la vez (core/proTrial.js,
// dueTrialNotice):
//  - Después del onboarding: "Empieza 14 días de Pro gratis, sin tarjeta" con
//    "Seguir con Starter" al mismo peso (mismo estilo de botón).
//  - Días 10 y 13: cuántos días quedan y qué herramientas de Pro usó.
//  - Al terminar: "Volviste a Starter; tus datos siguen aquí".
// App de tienda (native/storePolicy.js): sin oferta, sin recordatorios y sin
// precios ni enlaces de compra; solo el aviso de vuelta a Starter.
// Se carga diferido desde App.jsx (fuera del JS inicial).
import { useEffect, useState } from 'react'
import Sheet from './ui/Sheet.jsx'
import TrialStartButton from './ui/TrialStartButton.jsx'
import { useT } from '../i18n/useT.js'
import config from '../config.js'
import { useProTrial, dueTrialNotice, markTrialNoticeSeen, declineProTrial, trialDaysLeft, TRIAL_FEATURES } from '../core/proTrial.js'
import { canShowWebCheckout, canShowProMarketing } from '../native/storePolicy.js'
import { requestSettingsSub } from '../pages/Settings/settingsIndex.js'
import { ProTrialStringsGate } from './proTrial/strings.js'

const SHOW_DELAY_MS = 1500

export function featureList(ids, t, lang) {
  const names = ids.map(id => t(`proTrial.feature.${id}`))
  try { return new Intl.ListFormat(lang, { style: 'long', type: 'conjunction' }).format(names) } catch { return names.join(', ') }
}

function fmtDate(ms, lang) {
  try { return new Date(ms).toLocaleDateString(lang, { day: 'numeric', month: 'long' }) } catch { return '' }
}

const h2 = { margin: '0 0 8px', fontFamily: 'var(--display)', fontSize: 'var(--t-title)', lineHeight: 'var(--t-title-lh)', fontWeight: 700, color: 'var(--tx)' }
const p = { fontSize: 'var(--t-body)', color: 'var(--tm)', lineHeight: 1.55, margin: '0 0 12px' }
const note = { fontSize: 'var(--t-footnote)', color: 'var(--th)', lineHeight: 1.5, margin: '10px 0 0' }
const two = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }

// Los textos llegan con este chunk (ProTrialStringsGate), no con el diccionario principal.
export default function ProTrialNotices(props) {
  return <ProTrialStringsGate><Notices {...props} /></ProTrialStringsGate>
}

function Notices({ setPage }) {
  const { t, lang } = useT()
  const state = useProTrial()
  const web = canShowWebCheckout() && canShowProMarketing()
  const due = dueTrialNotice(state, { web })
  const [shown, setShown] = useState(null)

  useEffect(() => {
    if (!due) { setShown(null); return undefined }
    const id = setTimeout(() => setShown(due), SHOW_DELAY_MS)
    return () => clearTimeout(id)
  }, [due])

  if (!shown || shown !== due) return null
  const days = config.pricing.trialDays
  const st = state.status || {}

  function close(kind = shown) { markTrialNoticeSeen(kind); setShown(null) }
  function goPlans(kind) {
    close(kind)
    requestSettingsSub('plan')
    setPage?.('settings')
  }

  if (shown === 'offer') {
    return (
      <Sheet open onClose={() => { declineProTrial(); setShown(null) }} ariaLabel={t('proTrial.offer.title', { days })} maxWidth={480}>
        <h2 style={h2}>{t('proTrial.offer.title', { days })}</h2>
        <p style={p}>{t('proTrial.offer.body')}</p>
        <div style={{ fontSize: 'var(--t-subhead)', fontWeight: 600, color: 'var(--tx)', marginBottom: 6 }}>{t('proTrial.offer.includes')}</div>
        <ul style={{ margin: '0 0 16px', paddingLeft: 18, color: 'var(--tm)', fontSize: 'var(--t-subhead)', lineHeight: 1.6 }}>
          {TRIAL_FEATURES.map(id => <li key={id}>{t(`proTrial.feature.${id}`)}</li>)}
        </ul>
        {/* Mismo peso visual para las dos opciones (decisión del 26-nov). */}
        <div style={two}>
          <TrialStartButton className="fos-btn-secondary" source="offer" onStarted={() => setShown(null)} />
          <button type="button" className="fos-btn-secondary" onClick={() => { declineProTrial(); setShown(null) }}>{t('proTrial.offer.starter')}</button>
        </div>
        <p style={note}>{t('proTrial.offer.later')}</p>
      </Sheet>
    )
  }

  const used = state.used || []
  if (shown === 'day10' || shown === 'day13') {
    const left = trialDaysLeft(st.endsAt)
    const title = left === 1 ? t('proTrial.reminder.titleOne') : t('proTrial.reminder.title', { n: left })
    const untried = TRIAL_FEATURES.filter(f => !used.includes(f)).slice(0, 3)
    return (
      <Sheet open onClose={() => close()} ariaLabel={title} maxWidth={480}>
        <h2 style={h2}>{title}</h2>
        <p style={p}>{used.length
          ? t('proTrial.reminder.used', { list: featureList(TRIAL_FEATURES.filter(f => used.includes(f)), t, lang) })
          : t('proTrial.reminder.none', { list: featureList(untried, t, lang) })}</p>
        <p style={p}>{t('proTrial.reminder.after', { date: fmtDate(st.endsAt, lang) })}</p>
        <div style={two}>
          <button type="button" className="fos-btn-secondary" onClick={() => close()}>{t('proTrial.reminder.close')}</button>
          <button type="button" className="fos-btn-primary" onClick={() => goPlans(shown)}>{t('proTrial.reminder.buy')}</button>
        </div>
      </Sheet>
    )
  }

  // 'ended'
  return (
    <Sheet open onClose={() => close('ended')} ariaLabel={t('proTrial.ended.title')} maxWidth={480}>
      <h2 style={h2}>{t('proTrial.ended.title')}</h2>
      <p style={p}>{t('proTrial.ended.body', { days })}</p>
      {used.length > 0 && <p style={p}>{t('proTrial.ended.used', { list: featureList(TRIAL_FEATURES.filter(f => used.includes(f)), t, lang) })}</p>}
      {web ? (
        <div style={two}>
          <button type="button" className="fos-btn-secondary" onClick={() => close('ended')}>{t('proTrial.offer.starter')}</button>
          <button type="button" className="fos-btn-primary" onClick={() => goPlans('ended')}>{t('menu.upgrade.title')}</button>
        </div>
      ) : (
        <button type="button" className="fos-btn-primary" style={{ width: '100%' }} onClick={() => close('ended')}>{t('proTrial.ended.ok')}</button>
      )}
    </Sheet>
  )
}

// src/components/PushAsk.jsx — hoja de pre-permiso de avisos (R09; con
// ejemplos desde el 24-nov-2026).
// Muestra 3 avisos de ejemplo, como tarjetas del centro de notificaciones,
// ANTES de que el sistema muestre su diálogo. Son avisos que moyiq manda de
// verdad, con datos inventados y dicho en pantalla: los locales de tus
// finanzas (se calculan en el dispositivo, core/localAlerts/) y, en la web, el
// de la prueba por vencer (supabase/functions/send-push). Los push del
// servidor no llevan montos ni categorías; los locales sí, porque no salen del
// dispositivo.
// mode="local" (app de tienda, core/localAlerts/Host.jsx): solo avisos
// locales; "Permitir" llama a `onEnable` (permiso del teléfono) y el resultado
// lo guarda Host.jsx, no core/pushAsk.js.
// "Ahora no" cierra sin llamar a Notification.requestPermission(); solo
// "Permitir" llama a enablePush() (core/push.js). Cuándo se ofrece solo lo
// decide core/pushAsk.js (y acá se guarda el resultado: activados o "Ahora
// no" del pedido automático); quién la abre, core/pushPrimer.js.
import { useRef, useState } from 'react'
import Sheet from './ui/Sheet.jsx'
import { useT } from '../i18n/useT.js'
import { useApp } from '../context/AppContext.jsx'
import { enablePush } from '../core/push.js'
import { recordPushResult } from '../core/pushAsk.js'
import { GuideStringsGate } from '../i18n/guide/index.js'
import { ExtrasStringsGate } from '../extras/strings.js'
import { exampleVars } from '../extras/exampleMoney.js'
import { fmtMoney, currencySymbol } from '../utils/index.js'
import s from './pushAsk.module.css'

// [prefijo de título/hora/cuerpo]. `la.ex.*` vive en src/extras/strings.*.js;
// el de la prueba, en src/i18n/guide. Web: presupuesto y fijo (avisos locales,
// con la app abierta) + prueba por vencer (push del servidor).
export const PUSH_EXAMPLES = ['la.ex.budget', 'la.ex.fixedDue', 'pushAsk.ex.trial']
export const LOCAL_EXAMPLES = ['la.ex.fixedDue', 'la.ex.budget', 'la.ex.left']
// Pedido desde Inversiones (source 'invest'): primero, una alerta de precio.
export const INVEST_EXAMPLES = ['la.ex.price', 'la.ex.budget', 'pushAsk.ex.trial']

// Los ejemplos viven en la sección diferida src/i18n/guide (no en el JS inicial).
export default function PushAsk(props) {
  return <GuideStringsGate><ExtrasStringsGate><PushAskSheet {...props} /></ExtrasStringsGate></GuideStringsGate>
}

function PushAskSheet({ open, auto = false, onClose, onResult, mode = 'push', onEnable, source }) {
  const { t } = useT()
  const local = mode === 'local'
  const examples = local ? LOCAL_EXAMPLES : source === 'invest' ? INVEST_EXAMPLES : PUSH_EXAMPLES
  const { showToast, settings } = useApp() || {}
  // Cifras de ejemplo en la moneda de la persona (la de alerta de precio va en USD).
  const sym = currencySymbol(settings?.currency, settings?.language)
  const vars = exampleVars((n) => fmtMoney(n, sym), settings?.currency)
  const [busy, setBusy] = useState(false)
  // Quien la pidió (Ajustes, Inversiones, Primeros pasos) muestra su propio
  // estado; el pedido automático avisa con un toast.
  function done(r) {
    if (local) { onResult?.(r); onClose?.(); return }
    recordPushResult(r, { auto })
    onResult?.(r)
    onClose?.()
    if (!auto) return
    if (r?.ok) showToast?.(t('pushAsk.enabled'))
    else if (r?.error === 'permission_denied') showToast?.(t('settings.push.permissionDenied'), 'error')
    else if (r?.error !== 'dismissed') showToast?.(t('settings.push.genericError'), 'error')
  }
  const laterRef = useRef(null)
  const icon = `${import.meta.env?.BASE_URL || '/app/'}icon-192.png`

  async function allow() {
    if (busy) return
    setBusy(true)
    let r
    try { r = await (local && onEnable ? onEnable : enablePush)() } catch { r = { ok: false, error: 'failed' } }
    setBusy(false)
    done(r)
  }
  function later() {
    if (busy) return
    done({ ok: false, error: 'dismissed' })
  }

  return (
    <Sheet open={open} onClose={later} ariaLabel={t('pushAsk.title')} maxWidth={420} initialFocusRef={laterRef}>
      <h2 className={s.title}>{t('pushAsk.title')}</h2>
      <p className={s.body}>{t(local ? 'la.ask.body' : 'la.ask.webBody')}</p>

      <p className={s.sample} id="push-ask-sample">{t('pushAsk.sample')}</p>
      <ul className={s.stack} aria-labelledby="push-ask-sample">
        {examples.map((id, i) => (
          <li key={id} className={s.note} style={{ '--i': i }}>
            <img className={s.icon} src={icon} alt="" width={38} height={38} />
            <div className={s.noteMain}>
              <div className={s.noteHead}>
                <span className={s.noteTitle}>{t(`${id}.title`, vars)}</span>
                <span className={s.noteTime}>{t(`${id}.time`)}</span>
              </div>
              <p className={s.noteBody}>{t(`${id}.body`, vars)}</p>
            </div>
          </li>
        ))}
      </ul>

      <p className={s.privacy}>{t(local ? 'la.ask.privacy' : 'la.ask.webPrivacy')}</p>
      <div className={s.actions}>
        {/* aria-disabled y no disabled: un botón deshabilitado pierde el foco
            (se va al <body>) mientras se espera el diálogo del sistema. */}
        <button type="button" className="fos-btn-primary" onClick={allow} aria-disabled={busy || undefined} aria-busy={busy || undefined}>
          {t('pushAsk.enable')}
        </button>
        <button type="button" ref={laterRef} className="fos-btn-secondary" onClick={later} aria-disabled={busy || undefined}>
          {t('pushAsk.later')}
        </button>
      </div>
    </Sheet>
  )
}

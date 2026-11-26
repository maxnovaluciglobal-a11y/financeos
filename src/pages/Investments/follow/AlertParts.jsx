// Alertas de precio dentro de Mi lista (F4; desde el 26-nov-2026 ya no son una
// sub-pestaña aparte). Las alertas de la cuenta (public.invest_alerts) las
// revisa en el servidor invest-alerts-check y avisan por push aunque la app
// esté cerrada. Aquí viven las piezas que usa Mi lista:
//  · alertLine: la línea bajo cada activo ("Alerta: baja a US$484,45 · falta 5,0 %").
//  · AlertsBar: el resumen en una línea (en seguimiento · se cumplen ahora ·
//    activos), los avisos en este dispositivo y los errores de carga.
//  · OrphanAlerts: alertas de activos que no están en la lista (nada se pierde).
//  · ImportOld: el traspaso desde un archivo de la versión anterior.
//  · useAlertActions: pausar, reanudar y eliminar con deshacer (desde la hoja).
import { useCallback, useId, useRef, useState } from 'react'
import { Bell, BellRing } from 'lucide-react'
import { alertStatus, alertsSummary, parseLegacyAlerts } from '../../../utils/investAlerts.js'
import { currencyOf } from '../../../utils/investValuation.js'
import { moneyLocale } from '../../../utils/index.js'
import { canPushAlerts } from '../../../utils/investLimits.js'
import { pxOrPlain } from './AlertSheet.jsx'
import { pctOrDash } from './shared.js'
import s from '../portfolio/portfolio.module.css'
import f from './follow.module.css'

// "24 nov": la fecha corta del último aviso, en el idioma de la app.
export function shortDate(ms, locale = moneyLocale()) {
  const n = Number(ms)
  if (!(n > 0)) return '—'
  try { return new Date(n).toLocaleDateString(locale, { day: 'numeric', month: 'short' }) } catch { return '—' }
}

// Condición en minúscula, para seguir a "Alerta:".
export function condShort(t, a, ccy) {
  return a.condition === 'pct_move'
    ? t('fl.row.cond.pct_move', { pct: pctOrDash(a.threshold / 100) })
    : t(`fl.row.cond.${a.condition}`, { lvl: pxOrPlain(a.threshold, ccy) })
}

// Texto de la línea de alertas de un activo: { lead, rest, reached } o null.
export function alertLineText(t, list, quote, now = Date.now()) {
  if (!list?.length) return null
  if (list.length > 1) {
    const n = list.filter(a => a.active && alertStatus(a, quote, now).reached).length
    return { lead: t('fl.row.alertMany', { n: list.length }), rest: n ? t('fl.row.reachedN', { n }) : '', reached: n > 0 }
  }
  const a = list[0]
  const st = alertStatus(a, quote, now)
  const parts = [condShort(t, a, currencyOf(a.symbol, quote?.currency))]
  if (!a.active) parts.push(t('fl.row.paused'))
  else if (st.reached) parts.push(t('fl.row.reached'))
  else if (st.gap != null) parts.push(t('fl.row.gap', { pct: pctOrDash(st.gap) }))
  if (st.lastTriggeredAt) parts.push(t('fl.row.notified', { date: shortDate(st.lastTriggeredAt) }))
  return { lead: `${t('fl.row.alertOne')}:`, rest: parts.join(' · '), reached: a.active && st.reached, paused: !a.active }
}

export function AlertLine({ t, list, quote, now }) {
  const x = alertLineText(t, list, quote, now)
  if (!x) return null
  return (
    <span className={f.alertLine} data-tone={x.reached ? 'up' : undefined} data-paused={x.paused ? 'true' : undefined}>
      <strong>{x.lead}</strong>{x.rest ? ` ${x.rest}` : ''}
    </span>
  )
}

// Campana de una fila: sin alertas, crea; con alertas, edita (la hoja lista las demás).
export function BellBtn({ t, tk, n, onClick }) {
  const Ic = n ? BellRing : Bell
  return (
    <button type="button" className={s.iconBtn} onClick={onClick}
      aria-label={n ? t('fl.row.alertSee', { t: tk, n }) : t('fl.row.alertCreate', { t: tk })}>
      <Ic size={18} strokeWidth={2} aria-hidden="true" />{n > 0 && <span className={f.count} aria-hidden="true">{n}</span>}
    </button>
  )
}

// Avisos en este dispositivo, en una línea (con el botón si están apagados).
export function PushOffer({ t, push }) {
  const { state, busy, error, enable } = push
  // Límites de Starter encendidos (hoy apagados): las alertas se ven en la app y
  // el aviso push es de Pro, con el camino gratis dicho.
  const noLicense = state === 'noLicense' ? (canPushAlerts() ? t('fl.push.noLicense') : `${t('invest.limit.alerts')} ${t('invest.limit.free.alerts')}`) : null
  const text = state === 'on' ? t('fl.push.on') : state === 'demo' ? t('fl.push.demo') : state === 'unsupported' ? t('fl.push.unsupported') : noLicense || t('fl.push.off')
  return (
    <div className={f.compact} role="region" aria-label={t('fl.push.title')}>
      <p className={s.note}><strong className={f.strong}>{t('fl.push.title')}:</strong> {text}</p>
      {state === 'off' && (
        <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={enable} disabled={busy} aria-busy={busy || undefined}>
          <Bell size={16} strokeWidth={2} aria-hidden="true" />{busy ? t('fl.push.busy') : t('fl.push.enable')}
        </button>
      )}
      {error && <p className={s.error} role="alert">{t(error === 'permission_denied' ? 'settings.push.permissionDenied' : 'settings.push.genericError')}</p>}
    </div>
  )
}

// Resumen de alertas en una línea + avisos + errores de carga.
export function AlertsBar({ t, d, push, now = Date.now(), sumId }) {
  const list = d.alerts.list
  const sum = alertsSummary(list, d.quotes, now)
  const missing = d.alerts.phase === 'error' && d.alerts.error === 'table_missing'
  return (
    <div className={f.bar}>
      <h3 id={sumId} className={f.barTitle} tabIndex={-1}>{t('fl.al.title')}</h3>
      {d.alerts.phase === 'loading' && <p className={s.note} role="status">{t('fl.loading')}</p>}
      {d.alerts.phase === 'error' && (
        <div className={s.notice} data-tone="warn" role="alert">
          <span>{missing ? t('fl.al.missing') : d.alerts.error === 'session_required' ? t('fl.list.session') : t('fl.al.err')}</span>
          {!missing && d.alerts.error !== 'session_required' && <div className={s.noticeActions}><button type="button" className={s.btn} onClick={d.reload}>{t('fl.retry')}</button></div>}
        </div>
      )}
      {d.alerts.phase === 'ready' && (list.length
        ? (
          <p className={s.note} aria-label={t('fl.al.sum.label')}>
            {t('fl.sum.line', { active: sum.active, reached: sum.reached, assets: sum.assets })}
            {sum.paused > 0 && ` · ${t('fl.sum.paused', { n: sum.paused })}`}
          </p>
        )
        : <p className={s.note}>{t('fl.sum.none')}</p>)}
      {!missing && <PushOffer t={t} push={push} />}
    </div>
  )
}

// Alertas de activos que no están en Mi lista: siguen a la vista y se editan igual.
export function OrphanAlerts({ t, d, watch, now = Date.now(), onOpen, onBell }) {
  const id = useId()
  const syms = [...new Set(d.alerts.list.map(a => a.symbol))].filter(sym => !watch.includes(sym))
  if (!syms.length) return null
  return (
    <div className={f.bar}>
      <h3 id={`${id}-h`} className={f.barTitle}>{t('fl.orph.title')}</h3>
      <ul className={s.list} aria-labelledby={`${id}-h`}>
        {syms.map(sym => {
          const list = d.alerts.list.filter(a => a.symbol === sym)
          return (
            <li key={sym} className={`${s.item} ${f.listRow}`}>
              <button type="button" className={`${s.rowHead} ${f.rowHead2}`} onClick={() => onOpen(sym)} aria-label={t('fl.row.open', { t: sym })}>
                <span className={s.badge} aria-hidden="true">{sym.slice(0, 4)}</span>
                <span className={s.rowMain}>
                  <span className={s.rowTitle}>{sym}</span>
                  <AlertLine t={t} list={list} quote={d.quotes[sym] || null} now={now} />
                </span>
              </button>
              <span className={f.rowActs}><BellBtn t={t} tk={sym} n={list.length} onClick={() => onBell(sym)} /></span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// Traspaso desde un archivo de la versión anterior (solo con cuenta, fuera del demo).
export function ImportOld({ t, d, onErr }) {
  const fileRef = useRef(null)
  const [imp, setImp] = useState(null)
  async function onFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    let text = ''
    try { text = await file.text() } catch { setImp(t('fl.imp.badJson')); return }
    const p = parseLegacyAlerts(text)
    if (!p.ok) { setImp(t(p.error === 'bad_json' ? 'fl.imp.badJson' : p.error === 'no_alerts_in_backup' ? 'fl.imp.noAlerts' : 'fl.imp.notAlerts')); return }
    if (!p.items.length) { setImp(t('fl.imp.none')); return }
    const r = await d.importAlerts(p.items)
    if (!r.ok) { onErr(r.error); return }
    const skipped = r.data.skipped + p.skipped
    setImp(!r.data.added ? t('fl.imp.none') : skipped ? t('fl.imp.doneSkipped', { n: r.data.added, m: skipped }) : t('fl.imp.done', { n: r.data.added }))
  }
  return (
    <details className={f.details}>
      <summary className={f.summary}>{t('fl.imp.title')}</summary>
      <div className={f.detailsBody}>
        <p className={s.note}>{t('fl.imp.body')}</p>
        <div className={s.noticeActions}>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onFile} />
          <button type="button" className={s.btn} onClick={() => fileRef.current?.click()}>{t('fl.imp.pick')}</button>
        </div>
        {imp && <p className={s.note} role="status">{imp}</p>}
      </div>
    </details>
  )
}

// Pausar, reanudar y eliminar (con deshacer). Los usa la hoja de alerta.
export function useAlertActions({ t, d, onSay, onErr }) {
  const del = useCallback(async (a) => {
    const r = await d.deleteAlert(a)
    if (!r.ok) { onErr(r.error); return }
    onSay(t('fl.al.deleted'), {
      label: t('fl.undo'),
      onAction: async () => {
        // Vuelve tal cual (en pausa y con su último aviso): no suena de nuevo dentro de las 24 h.
        const u = d.restoreAlert ? await d.restoreAlert(a) : await d.saveAlert(null, a)
        if (u.ok) onSay(t('fl.al.restored')); else onErr(u.error)
      },
    })
  }, [d, t, onSay, onErr])
  const toggle = useCallback(async (a) => {
    const r = await d.setAlertActive(a, !a.active)
    if (!r.ok) { onErr(r.error); return }
    onSay(t(a.active ? 'fl.al.pausedToast' : 'fl.al.resumedToast'))
  }, [d, t, onSay, onErr])
  return { del, toggle }
}

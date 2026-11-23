// Alertas (F4): las alertas de precio de la cuenta (public.invest_alerts),
// que revisa en el servidor invest-alerts-check y avisan por push aunque la
// app esté cerrada. Resumen (Invest: En seguimiento · Alcanzadas · Activos),
// la lista con precio de ahora y lo que falta, pausar, editar, eliminar con
// deshacer, el ofrecimiento de activar los avisos y el traspaso desde un
// archivo de la versión anterior de Inversiones.
import { useId, useRef, useState } from 'react'
import { Bell, Pause, Pencil, Play, Trash2 } from 'lucide-react'
import { alertStatus, alertsSummary, parseLegacyAlerts } from '../../../utils/investAlerts.js'
import { fmtPx, fmtStamp } from '../asset/format.js'
import { condLabel } from './AlertSheet.jsx'
import { focusLater, pctOrDash } from './shared.js'
import s from '../portfolio/portfolio.module.css'
import f from './follow.module.css'

export function PushOffer({ t, push }) {
  const { state, busy, error, enable } = push
  if (state === 'on') return <p className={s.note}>{t('fl.push.on')}</p>
  const text = state === 'demo' ? t('fl.push.demo') : state === 'unsupported' ? t('fl.push.unsupported') : state === 'noLicense' ? t('fl.push.noLicense') : t('fl.push.off')
  return (
    <div className={s.notice} role="region" aria-label={t('fl.push.title')}>
      <strong>{t('fl.push.title')}</strong>
      <span>{text}</span>
      {state === 'off' && (
        <div className={s.noticeActions}>
          <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={enable} disabled={busy} aria-busy={busy || undefined}>
            <Bell size={16} strokeWidth={2} aria-hidden="true" />{busy ? t('fl.push.busy') : t('fl.push.enable')}
          </button>
        </div>
      )}
      {error && <span className={s.error} role="alert">{t(error === 'permission_denied' ? 'settings.push.permissionDenied' : 'settings.push.genericError')}</span>}
    </div>
  )
}

export default function AlertsPane({ t, d, demo, push, now = Date.now(), onNew, onEdit, onSay, onErr }) {
  const id = useId()
  const fileRef = useRef(null)
  const [imp, setImp] = useState(null)
  const list = d.alerts.list
  const sum = alertsSummary(list, d.quotes, now)

  async function del(a) {
    const i = list.findIndex(x => x.id === a.id)
    const next = list[i + 1] || list[i - 1] || null
    const r = await d.deleteAlert(a)
    if (!r.ok) { onErr(r.error); return }
    // La fila (y el botón con el foco) desaparece: el foco pasa a la papelera
    // de la fila vecina o, si era la última, al título de la sección.
    focusLater(next ? `${id}-del-${next.id}` : `${id}-h`)
    onSay(t('fl.al.deleted'), {
      label: t('fl.undo'),
      onAction: async () => {
        // Vuelve tal cual (en pausa y con su último aviso): no suena de nuevo dentro de las 24 h.
        const u = d.restoreAlert ? await d.restoreAlert(a) : await d.saveAlert(null, a)
        if (u.ok) onSay(t('fl.al.restored')); else onErr(u.error)
      },
    })
  }
  async function toggle(a) {
    const r = await d.setAlertActive(a, !a.active)
    if (!r.ok) { onErr(r.error); return }
    onSay(t(a.active ? 'fl.al.pausedToast' : 'fl.al.resumedToast'))
  }
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

  const missing = d.alerts.phase === 'error' && d.alerts.error === 'table_missing'
  return (
    <section className={s.section} aria-labelledby={`${id}-h`}>
      <div className={s.sectionHead}>
        <h2 id={`${id}-h`} className={s.sectionTitle} tabIndex={-1}>{t('fl.al.title')}</h2>
        {!missing && d.alerts.phase !== 'error' && <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={() => onNew('')}>{t('fl.al.new')}</button>}
      </div>
      <p className={s.note}>{t('fl.al.intro')}</p>
      <p className={s.note}>{t('fl.al.how')}</p>

      <PushOffer t={t} push={push} />

      {d.alerts.phase === 'loading' && <p className={s.note} role="status">{t('fl.loading')}</p>}
      {d.alerts.phase === 'error' && (
        <div className={s.notice} data-tone="warn" role="alert">
          <span>{missing ? t('fl.al.missing') : d.alerts.error === 'session_required' ? t('fl.list.session') : t('fl.al.err')}</span>
          {!missing && d.alerts.error !== 'session_required' && <div className={s.noticeActions}><button type="button" className={s.btn} onClick={d.reload}>{t('fl.retry')}</button></div>}
        </div>
      )}

      {d.alerts.phase === 'ready' && list.length > 0 && (
        <dl className={s.cells} aria-label={t('fl.al.sum.label')}>
          <div className={s.cell}><dt className={s.cellLabel}>{t('fl.al.sum.active')}</dt><dd className={s.cellValue} style={{ margin: 0 }}>{sum.active}</dd>{sum.paused > 0 && <dd className={s.cellSub} style={{ margin: 0 }}>{t('fl.al.sum.paused')}: {sum.paused}</dd>}</div>
          <div className={s.cell}><dt className={s.cellLabel}>{t('fl.al.sum.reached')}</dt><dd className={s.cellValue} style={{ margin: 0 }}>{sum.reached}</dd><dd className={s.cellSub} style={{ margin: 0 }}>{t('fl.al.sum.reachedSub')}</dd></div>
          <div className={s.cell}><dt className={s.cellLabel}>{t('fl.al.sum.assets')}</dt><dd className={s.cellValue} style={{ margin: 0 }}>{sum.assets}</dd></div>
        </dl>
      )}

      {d.alerts.phase === 'ready' && !list.length && (
        <div className={s.empty}>
          <h3 className={s.emptyTitle}>{t('fl.al.empty.title')}</h3>
          <p className={s.note}>{t('fl.al.empty.body')}</p>
          <div className={s.noticeActions}><button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={() => onNew('')}>{t('fl.al.new')}</button></div>
        </div>
      )}

      {list.length > 0 && (
        <ul className={s.list}>
          {list.map(a => {
            const q = d.quotes[a.symbol] || null
            const st = alertStatus(a, q, now)
            const ccy = q?.currency || 'USD'
            return (
              <li key={a.id} className={`${s.item} ${f.alertRow}`} data-paused={a.active ? undefined : 'true'}>
                <div className={s.rowMain}>
                  <span className={s.rowTitle}>{a.symbol} · {condLabel(t, a, ccy)}</span>
                  <span className={s.rowSub}>
                    {st.price != null ? t('fl.al.now', { px: fmtPx(st.price, ccy) }) : t('fl.al.noPrice')}
                    {a.active && st.reached && <> · <strong className={s.tone} data-tone="up">{t('fl.al.reached')}</strong></>}
                    {a.active && !st.reached && st.gap != null && <> · {t('fl.al.gap', { pct: pctOrDash(st.gap) })}</>}
                    {a.condition === 'pct_move' && st.moved != null && <> · {t('fl.al.moved', { pct: pctOrDash(st.moved, { signed: true }) })}</>}
                  </span>
                  {!a.active && <span className={s.flag}>{t('fl.al.paused')}</span>}
                  {st.lastTriggeredAt && <span className={s.rowSub}>{t('fl.al.notified', { date: fmtStamp(st.lastTriggeredAt) || '—' })}</span>}
                </div>
                <span className={f.rowActs}>
                  <button type="button" className={s.iconBtn} onClick={() => toggle(a)} aria-label={`${a.active ? t('fl.al.pause') : t('fl.al.resume')} · ${a.symbol}`}>
                    {a.active ? <Pause size={18} strokeWidth={2} aria-hidden="true" /> : <Play size={18} strokeWidth={2} aria-hidden="true" />}
                  </button>
                  <button type="button" className={s.iconBtn} onClick={() => onEdit(a)} aria-label={t('fl.al.editT', { t: a.symbol })}><Pencil size={18} strokeWidth={2} aria-hidden="true" /></button>
                  <button type="button" id={`${id}-del-${a.id}`} className={`${s.iconBtn} ${s.btnDanger}`} onClick={() => del(a)} aria-label={t('fl.al.deleteT', { t: a.symbol })}><Trash2 size={18} strokeWidth={2} aria-hidden="true" /></button>
                </span>
              </li>
            )
          })}
        </ul>
      )}
      {list.length > 0 && <p className={s.note}>{t('fl.al.foot')} {t('fl.source')}</p>}

      {!demo && !missing && d.alerts.phase === 'ready' && (
        <div className={s.notice}>
          <strong>{t('fl.imp.title')}</strong>
          <span>{t('fl.imp.body')}</span>
          <div className={s.noticeActions}>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onFile} />
            <button type="button" className={s.btn} onClick={() => fileRef.current?.click()}>{t('fl.imp.pick')}</button>
          </div>
          {imp && <span role="status">{imp}</span>}
        </div>
      )}
    </section>
  )
}

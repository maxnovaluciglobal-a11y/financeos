// Hoja de alerta de precio (F4): crear o editar una alerta, desde Siguiendo
// (Mi lista, Alertas) y desde la ficha del activo. Muestra el precio de ahora,
// lo que falta, niveles sugeridos con tus datos (Invest alSugerencias) y las
// otras alertas del mismo activo. Guarda con onSave(prev, input), que llega
// a core/investAlerts.js (o al estado del demo).
import { useEffect, useId, useRef, useState } from 'react'
import Sheet from '../../../components/ui/Sheet.jsx'
import { ALERT_CONDITIONS, conditionMet, normSymbol, suggestLevels, validateAlert, SYMBOL_RE } from '../../../utils/investAlerts.js'
import { fmtDecimal } from '../../../utils/index.js'
import { fmtPx } from '../asset/format.js'
import { useFollowT } from './dict.js'
import { alertErrorKey, pctOrDash } from './shared.js'
import s from '../portfolio/portfolio.module.css'

const condLabel = (t, a, ccy) => (a.condition === 'pct_move'
  ? t('fl.al.cond.pct_move', { pct: pctOrDash(a.threshold / 100) })
  : t(`fl.al.cond.${a.condition}`, { lvl: fmtPx(a.threshold, ccy) }))
export { condLabel }

export default function AlertSheet({ open, onClose, prev = null, symbol = '', lockSymbol = false, quoteOf, avgCost = null, alerts = [], onSave, onSaved }) {
  const { t } = useFollowT()
  const id = useId()
  const titleRef = useRef(null)
  const [form, setForm] = useState({ symbol: '', condition: 'above', threshold: '' })
  const [fields, setFields] = useState({})
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const [q, setQ] = useState({ sym: null, phase: 'idle', data: null })

  useEffect(() => {
    if (!open) return
    setForm(prev
      ? { symbol: prev.symbol, condition: prev.condition, threshold: String(prev.threshold) }
      : { symbol: normSymbol(symbol), condition: 'above', threshold: '' })
    setFields({}); setMsg(null); setBusy(false)
  }, [open, prev, symbol])

  // Precio del activo escrito (con una pausa corta mientras se escribe).
  const sym = normSymbol(form.symbol)
  useEffect(() => {
    if (!open || !quoteOf) return undefined
    if (!SYMBOL_RE.test(sym)) { setQ({ sym: null, phase: 'idle', data: null }); return undefined }
    let alive = true
    setQ(cur => (cur.sym === sym ? cur : { sym, phase: 'loading', data: null }))
    const id2 = setTimeout(async () => {
      const data = await quoteOf(sym)
      if (alive) setQ({ sym, phase: data ? 'ready' : 'none', data: data || null })
    }, 350)
    return () => { alive = false; clearTimeout(id2) }
  }, [open, sym, quoteOf])

  const quote = q.sym === sym ? q.data : null
  const ccy = quote?.currency || 'USD'
  const price = Number(quote?.price) > 0 ? Number(quote.price) : null
  const pct = form.condition === 'pct_move'
  const sugg = suggestLevels({ condition: form.condition, price, avgCost, low52: quote?.low52, high52: quote?.high52 })
  const v = validateAlert(form)
  const already = v.ok && quote && conditionMet(v.value.condition, v.value.threshold, quote)
  const others = alerts.filter(a => a.symbol === sym && a.id !== prev?.id)

  let hint
  if (!SYMBOL_RE.test(sym)) hint = t('fl.sheet.hint.none')
  else if (q.phase === 'loading' || q.sym !== sym) hint = t('fl.sheet.hint.loading', { t: sym })
  else if (!price) hint = t('fl.sheet.hint.noPrice', { t: sym })
  else if (pct) hint = t('fl.sheet.hint.pct', { t: sym, pct: pctOrDash(quote.changePct, { signed: true }) })
  else hint = t(`fl.sheet.hint.${form.condition}`, { t: sym, px: fmtPx(price, ccy) })

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))
  async function submit(e) {
    e.preventDefault()
    if (!v.ok) { setFields(v.fields); setMsg(null); return }
    setFields({}); setMsg(null); setBusy(true)
    const r = await onSave(prev, v.value)
    setBusy(false)
    if (!r?.ok) {
      if (r?.fields) { setFields(r.fields); return }
      const [k, vars] = alertErrorKey(r?.error)
      setMsg(t(k, vars))
      return
    }
    onSaved?.(r, prev, v.value)
  }
  const title = prev ? t('fl.sheet.edit') : t('fl.sheet.new')
  const err = (k) => (fields[k] ? t(`fl.err.${fields[k]}`) : null)
  const desc = (k, extra) => [extra, fields[k] && `${id}-${k}-err`].filter(Boolean).join(' ') || undefined

  return (
    <Sheet open={open} onClose={onClose} ariaLabel={title} initialFocusRef={titleRef}>
      <form className={s.form} onSubmit={submit} noValidate>
        <h2 ref={titleRef} tabIndex={-1} className={s.formTitle}>{title}</h2>
        <p className={s.hint}>{t('fl.sheet.note')}</p>

        <div className={s.field}>
          <label htmlFor={`${id}-sym`} className={s.fieldLabel}>{t('fl.sheet.asset')}</label>
          <input id={`${id}-sym`} className={s.input} value={form.symbol} onChange={set('symbol')} readOnly={lockSymbol}
            autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={15} inputMode="text"
            aria-invalid={fields.symbol ? 'true' : undefined} aria-describedby={desc('symbol', `${id}-sym-hint`)} />
          <p id={`${id}-sym-hint`} className={s.hint}>{t('fl.sheet.assetHint')}</p>
          {err('symbol') && <p id={`${id}-symbol-err`} className={s.error}>{err('symbol')}</p>}
        </div>

        <fieldset className={s.field} style={{ border: 0, margin: 0, padding: 0 }}>
          <legend className={s.fieldLabel}>{t('fl.sheet.cond')}</legend>
          <div className={s.choices}>
            {ALERT_CONDITIONS.map(c => (
              <label key={c} className={s.check}>
                <input type="radio" name={`${id}-cond`} value={c} checked={form.condition === c} onChange={set('condition')} />
                {t(`fl.sheet.cond.${c}`)}
              </label>
            ))}
          </div>
          {err('condition') && <p className={s.error}>{err('condition')}</p>}
        </fieldset>

        <div className={s.field}>
          <label htmlFor={`${id}-lvl`} className={s.fieldLabel}>{pct ? t('fl.sheet.levelPct') : t('fl.sheet.level', { ccy })}</label>
          <input id={`${id}-lvl`} className={s.input} value={form.threshold} onChange={set('threshold')} inputMode="decimal" autoComplete="off"
            aria-invalid={fields.threshold ? 'true' : undefined} aria-describedby={desc('threshold', `${id}-lvl-hint`)} />
          <p id={`${id}-lvl-hint`} className={s.hint} role="status">{hint}</p>
          {already && <p className={s.hint}>{t('fl.sheet.hint.already')}</p>}
          {err('threshold') && <p id={`${id}-threshold-err`} className={s.error}>{err('threshold')}</p>}
        </div>

        {sugg.length > 0 && (
          <div className={s.field}>
            <span id={`${id}-sugg`} className={s.fieldLabel}>{t('fl.sheet.sugg')}</span>
            <div className={s.actionsRow} role="group" aria-labelledby={`${id}-sugg`}>
              {sugg.map(x => (
                <button key={`${x.kind}-${x.value}`} type="button" className={s.btn} onClick={() => setForm(f => ({ ...f, threshold: String(x.value) }))}>
                  {t(`fl.sugg.${x.kind}`, { v: x.kind === 'pct' ? fmtDecimal(x.value, 0) : fmtPx(x.value, ccy) })}
                </button>
              ))}
            </div>
          </div>
        )}

        {others.length > 0 && (
          <div className={s.field}>
            <span className={s.fieldLabel}>{t('fl.sheet.existing', { t: sym })}</span>
            <ul className={s.preview}>
              {others.map(a => <li key={a.id}><span>{condLabel(t, a, ccy)}</span>{!a.active && <span>{t('fl.al.paused')}</span>}</li>)}
            </ul>
          </div>
        )}

        {msg && <p className={s.error} role="alert">{msg}</p>}
        <div className={s.actionsRow} style={{ justifyContent: 'flex-end' }}>
          <button type="button" className={s.btn} onClick={onClose}>{t('fl.sheet.cancel')}</button>
          <button type="submit" className={`${s.btn} ${s.btnPrimary}`} disabled={busy} aria-busy={busy || undefined}>
            {busy ? t('fl.sheet.saving') : t('fl.sheet.save')}
          </button>
        </div>
      </form>
    </Sheet>
  )
}

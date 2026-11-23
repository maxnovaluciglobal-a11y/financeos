// Hojas de la ficha: agregar o editar la posición, registrar una compra o
// venta y comparar con SPY. Escriben con core/investData.js (RLS por cuenta);
// en el demo no escriben y lo dicen.
import { useEffect, useId, useRef, useState } from 'react'
import Sheet from '../../../components/ui/Sheet.jsx'
import { Btn } from '../../../components/ui/index.jsx'
import Money from '../../../components/Money.jsx'
import { ASSET_TYPES, validateHolding } from '../../../core/investData.js'
import { buildTrade } from '../../../utils/investTrade.js'
import { compareStats, corrBand } from '../../../utils/investAsset.js'
import { fmtDecimal, fmtPct } from '../../../utils/index.js'
import { useAssetT } from './assetDict.js'
import { fmtUnits, localDay } from './format.js'
import s from './asset.module.css'

function Field({ id, label, error, hint, children }) {
  return (
    <div className={s.field}>
      <label htmlFor={id} className={s.label}>{label}</label>
      {children}
      {hint && <p id={`${id}-hint`} className={s.note}>{hint}</p>}
      {error && <p id={`${id}-err`} className={s.err}>{error}</p>}
    </div>
  )
}
const describedBy = (id, { hint, error }) => [hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(' ') || undefined
const fieldMsg = (t, code, vars) => (code ? t(`asset.field.${code}`, vars) : null)

// ── Agregar / editar posición ──
export function PositionSheet({ open, onClose, ticker, ccy, prev, defaultType, price, onSave }) {
  const { t } = useAssetT()
  const id = useId()
  const titleRef = useRef(null)
  const [form, setForm] = useState({})
  const [fields, setFields] = useState({})
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  useEffect(() => {
    if (!open) return
    setForm(prev
      ? { type: prev.type || 'Stock', sh: String(prev.sh), cost: String(prev.cost), stop: prev.stop ? String(prev.stop) : '', fxCost: prev.fxCost ? String(prev.fxCost) : '', note: prev.note || '' }
      : { type: defaultType || 'Stock', sh: '', cost: price > 0 ? String(+Number(price).toFixed(price < 1 ? 6 : 2)) : '', stop: '', fxCost: '', note: '' })
    setFields({}); setMsg(null); setBusy(false)
  }, [open, prev, defaultType, price])
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    const v = validateHolding({ t: ticker, ...form }, { prev })
    if (!v.ok) { setFields(v.fields); setMsg(t('asset.form.errors')); return }
    setFields({}); setMsg(null); setBusy(true)
    const err = await onSave(v.value)
    setBusy(false)
    if (err) setMsg(err)
  }
  const title = prev ? t('asset.pos.editTitle', { t: ticker }) : t('asset.pos.addTitle', { t: ticker })
  const F = (k) => fieldMsg(t, fields[k])
  return (
    <Sheet open={open} onClose={onClose} ariaLabel={title} initialFocusRef={titleRef}>
      <form className={s.sheet} onSubmit={submit} noValidate>
        <h2 ref={titleRef} tabIndex={-1} className={s.sheetTitle}>{title}</h2>
        <Field id={`${id}-type`} label={t('asset.pos.type')} error={F('type')}>
          <select id={`${id}-type`} value={form.type || 'Stock'} onChange={set('type')} disabled={!!prev}>
            {ASSET_TYPES.map(x => <option key={x} value={x}>{t(`asset.pos.type.${x}`)}</option>)}
          </select>
        </Field>
        <Field id={`${id}-sh`} label={t('asset.pos.shares')} error={F('sh')}>
          <input id={`${id}-sh`} type="text" inputMode="decimal" autoComplete="off" value={form.sh ?? ''} onChange={set('sh')}
            aria-invalid={fields.sh ? 'true' : undefined} aria-describedby={describedBy(`${id}-sh`, { error: fields.sh })} />
        </Field>
        <Field id={`${id}-cost`} label={t('asset.pos.cost', { ccy })} error={F('cost')}>
          <input id={`${id}-cost`} type="text" inputMode="decimal" autoComplete="off" value={form.cost ?? ''} onChange={set('cost')}
            aria-invalid={fields.cost ? 'true' : undefined} aria-describedby={describedBy(`${id}-cost`, { error: fields.cost })} />
        </Field>
        <Field id={`${id}-stop`} label={t('asset.pos.stop', { ccy })} error={F('stop')}>
          <input id={`${id}-stop`} type="text" inputMode="decimal" autoComplete="off" value={form.stop ?? ''} onChange={set('stop')}
            aria-invalid={fields.stop ? 'true' : undefined} aria-describedby={describedBy(`${id}-stop`, { error: fields.stop })} />
        </Field>
        {ccy !== 'USD' && (
          <Field id={`${id}-fx`} label={t('asset.pos.fx', { ccy })} error={F('fxCost')}>
            <input id={`${id}-fx`} type="text" inputMode="decimal" autoComplete="off" value={form.fxCost ?? ''} onChange={set('fxCost')}
              aria-invalid={fields.fxCost ? 'true' : undefined} aria-describedby={describedBy(`${id}-fx`, { error: fields.fxCost })} />
          </Field>
        )}
        <Field id={`${id}-note`} label={t('asset.pos.note')} error={F('note')}>
          <textarea id={`${id}-note`} rows={2} maxLength={500} value={form.note ?? ''} onChange={set('note')}
            aria-invalid={fields.note ? 'true' : undefined} aria-describedby={describedBy(`${id}-note`, { error: fields.note })} />
        </Field>
        {msg && <p className={s.err} role="alert">{msg}</p>}
        <div className={s.sheetActions}>
          <Btn variant="ghost" type="button" onClick={onClose}>{t('asset.cancel')}</Btn>
          <Btn variant="primary" type="submit" disabled={busy}>{busy ? t('asset.saving') : t('asset.save')}</Btn>
        </div>
      </form>
    </Sheet>
  )
}

// ── Registrar compra o venta ──
export function TradeSheet({ open, onClose, ticker, ccy, holding, price, rsi, onSave, closeAsk, onCloseAnswer }) {
  const { t } = useAssetT()
  const id = useId()
  const titleRef = useRef(null)
  const [form, setForm] = useState({})
  const [fields, setFields] = useState({})
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  useEffect(() => {
    if (!open) return
    setForm({ type: 'buy', price: price > 0 ? String(+Number(price).toFixed(price < 1 ? 6 : 2)) : '', qty: '', amount: '', date: localDay(), note: '' })
    setFields({}); setMsg(null); setBusy(false)
  }, [open, price])
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    const v = buildTrade({ ...form, rsi }, { ticker, holding, ccy, today: localDay() })
    if (!v.ok) { setFields(v.fields); setMsg(t('asset.form.errors')); return }
    setFields({}); setMsg(null); setBusy(true)
    const err = await onSave(form)
    setBusy(false)
    if (err) setMsg(err)
  }
  const title = t('asset.trade.title', { t: ticker })
  const F = (k) => fieldMsg(t, fields[k], { n: fmtUnits(holding?.sh || 0) })
  return (
    <Sheet open={open} onClose={onClose} ariaLabel={title} initialFocusRef={titleRef}>
      {closeAsk ? (
        <div className={s.sheet}>
          <h2 ref={titleRef} tabIndex={-1} className={s.sheetTitle}>{t('asset.trade.closed', { t: ticker })}</h2>
          <p className={s.body}>{t('asset.trade.closeAsk', { t: ticker })}</p>
          {msg && <p className={s.err} role="alert">{msg}</p>}
          <div className={s.sheetActions}>
            <Btn variant="ghost" type="button" onClick={() => onCloseAnswer(false)}>{t('asset.trade.keep')}</Btn>
            <Btn variant="danger" type="button" onClick={async () => { const err = await onCloseAnswer(true); if (err) setMsg(err) }}>{t('asset.trade.remove')}</Btn>
          </div>
        </div>
      ) : (
        <form className={s.sheet} onSubmit={submit} noValidate>
          <h2 ref={titleRef} tabIndex={-1} className={s.sheetTitle}>{title}</h2>
          <fieldset className={s.fieldset}>
            <legend className={s.label}>{t('asset.trade.type')}</legend>
            <div className={s.chips}>
              {['buy', 'sell'].map(k => (
                <label key={k} className={s.radio}>
                  <input type="radio" name={`${id}-type`} value={k} checked={form.type === k} onChange={set('type')} />
                  <span>{t(`asset.trade.${k}`)}</span>
                </label>
              ))}
            </div>
            {holding?.sh > 0 && <p className={s.note}><Money>{t('asset.trade.have', { n: fmtUnits(holding.sh) })}</Money></p>}
          </fieldset>
          <Field id={`${id}-date`} label={t('asset.trade.date')} error={F('date')}>
            <input id={`${id}-date`} type="date" max={localDay()} value={form.date ?? ''} onChange={set('date')}
              aria-invalid={fields.date ? 'true' : undefined} aria-describedby={describedBy(`${id}-date`, { error: fields.date })} />
          </Field>
          <Field id={`${id}-price`} label={t('asset.trade.price', { ccy })} error={F('price')}>
            <input id={`${id}-price`} type="text" inputMode="decimal" autoComplete="off" value={form.price ?? ''} onChange={set('price')}
              aria-invalid={fields.price ? 'true' : undefined} aria-describedby={describedBy(`${id}-price`, { error: fields.price })} />
          </Field>
          <Field id={`${id}-qty`} label={t('asset.trade.qty')} error={F('qty')}>
            <input id={`${id}-qty`} type="text" inputMode="decimal" autoComplete="off" value={form.qty ?? ''} onChange={set('qty')}
              aria-invalid={fields.qty ? 'true' : undefined} aria-describedby={describedBy(`${id}-qty`, { error: fields.qty })} />
          </Field>
          <Field id={`${id}-amount`} label={t('asset.trade.amount', { ccy })} error={F('amount')} hint={t('asset.trade.amountHint')}>
            <input id={`${id}-amount`} type="text" inputMode="decimal" autoComplete="off" value={form.amount ?? ''} onChange={set('amount')}
              aria-invalid={fields.amount ? 'true' : undefined} aria-describedby={describedBy(`${id}-amount`, { hint: true, error: fields.amount })} />
          </Field>
          <Field id={`${id}-note`} label={t('asset.pos.note')} error={F('note')}>
            <textarea id={`${id}-note`} rows={2} maxLength={500} value={form.note ?? ''} onChange={set('note')} />
          </Field>
          {msg && <p className={s.err} role="alert">{msg}</p>}
          <div className={s.sheetActions}>
            <Btn variant="ghost" type="button" onClick={onClose}>{t('asset.cancel')}</Btn>
            <Btn variant="primary" type="submit" disabled={busy}>{busy ? t('asset.saving') : t('asset.save')}</Btn>
          </div>
        </form>
      )}
    </Sheet>
  )
}

// ── Comparar con SPY (o QQQ si el activo es SPY) ──
export function CompareSheet({ open, onClose, a, b, rowsA, phaseA = 'ready', rowsB, phaseB, n, rangeLabel, demo, onMore }) {
  const { t } = useAssetT()
  const titleRef = useRef(null)
  const title = t('asset.cmp.title', { a, b })
  const st = rowsA && rowsB ? compareStats(rowsA, rowsB, n) : null
  const band = st ? corrBand(st.corr) : null
  const cell = (side, k) => {
    const x = st?.[side]
    if (!x || x[k] == null) return '—'
    if (k === 'ret') return fmtPct(x.ret, { signed: true })
    if (k === 'vol') return fmtPct(x.vol, { decimals: 2 })
    return fmtDecimal(x.sharpe, 2)
  }
  return (
    <Sheet open={open} onClose={onClose} ariaLabel={title} initialFocusRef={titleRef} initialDetent="medium">
      <div className={s.sheet}>
        <h2 ref={titleRef} tabIndex={-1} className={s.sheetTitle}>{title}</h2>
        {demo && <p className={s.sampleTag}>{t('asset.sample')}</p>}
        <p className={s.note}>{t('asset.cmp.range', { range: rangeLabel })}</p>
        {phaseA === 'loading' || phaseA === 'idle' ? <p className={s.note} role="status">{t('asset.cmp.loading', { t: a })}</p>
          : phaseB === 'loading' || phaseB === 'idle' ? <p className={s.note} role="status">{t('asset.cmp.loading', { t: b })}</p>
          : phaseB === 'error' || !rowsA ? <p className={s.note} role="alert">{t('asset.cmp.error', { t: rowsA ? b : a })}</p>
          : (
            <>
              <div className={s.tableWrap}>
                <table className={s.table}>
                  <thead><tr><th scope="col">{t('asset.cmp.metric')}</th><th scope="col">{a}</th><th scope="col">{b}</th></tr></thead>
                  <tbody>
                    <tr><th scope="row">{t('asset.cmp.return')}</th><td className={s.num}>{cell('a', 'ret')}</td><td className={s.num}>{cell('b', 'ret')}</td></tr>
                    <tr><th scope="row">{t('asset.cmp.vol')}</th><td className={s.num}>{cell('a', 'vol')}</td><td className={s.num}>{cell('b', 'vol')}</td></tr>
                    <tr><th scope="row">{t('asset.cmp.sharpe')}</th><td className={s.num}>{cell('a', 'sharpe')}</td><td className={s.num}>{cell('b', 'sharpe')}</td></tr>
                  </tbody>
                </table>
              </div>
              <p className={s.body}>{band ? t('asset.cmp.corr', { r: fmtDecimal(st.corr, 2), band: t(`asset.cmp.band.${band}`) }) : t('asset.cmp.corrNone')}</p>
              <p className={s.note}>{t('asset.cmp.note')}</p>
              {onMore && <Btn variant="ghost" type="button" onClick={onMore}>{t('asset.cmp.more')}</Btn>}
            </>
          )}
        <div className={s.sheetActions}><Btn variant="ghost" type="button" onClick={onClose}>{t('asset.close')}</Btn></div>
      </div>
    </Sheet>
  )
}

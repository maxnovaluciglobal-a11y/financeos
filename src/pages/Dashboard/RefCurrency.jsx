// src/pages/Dashboard/RefCurrency.jsx — moneda de referencia en "Te queda" (R12)
// y acceso a la calculadora de tasa (R13).
//
// - RefSwitch: selector VES | USD de la cifra protagonista.
// - RefRow: el equivalente en la otra moneda + "1 US$ = … · fuente · fecha",
//   con "Editar tasa" y, en VE/AR, la calculadora del país a un toque.
// - RateSheet: hoja para escribir la tasa o consultar la de hoy con los
//   mismos loaders que ya usa la app (tasaVE/tasaAR/tasaFixer). Lo consultado
//   sin red (fallback) no se ofrece: esos números no son de hoy.
// - FreshRate (B1): "Hay una tasa más reciente: X (fuente, fecha). Usar".
// - El botón de la fila abre el conversor rápido GRATIS (B2,
//   components/ConverterSheet.jsx); el panel multimoneda PRO queda en el Menú
//   y como enlace dentro del conversor.
// Ninguna tasa se muestra sin su fecha (o sin decir "sin fecha").
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import Sheet from '../../components/ui/Sheet.jsx'
import Money from '../../components/Money.jsx'
import { useT } from '../../i18n/useT.js'
import { fmtMoney, fmtAmount, moneyLocale, currencySymbol, dateLocale } from '../../utils/index.js'
import { SOURCE_LABEL, REF_CURRENCY, toRef, isStale, rateAgeDays, rateOptions, loadersFor, defaultRateOption, rateLabelParts } from '../../utils/refRate.js'
import { loadTasaVE } from '../../utils/tasaVE.js'
import { loadTasaAR } from '../../utils/tasaAR.js'
import { loadFixerRates } from '../../utils/tasaFixer.js'
import s from './Home.module.css'

const HOSTS = { ve: 've.dolarapi.com', ar: 'dolarapi.com', fixer: 'Fixer' }
const LOADERS = { ve: loadTasaVE, ar: loadTasaAR, fixer: loadFixerRates }

// US$ con los separadores de la moneda principal (es-VE "US$1.234,56").
export function fmtRef(n, lang) {
  return currencySymbol(REF_CURRENCY, lang) + fmtAmount(Math.abs(Number(n) || 0), 2, moneyLocale())
}

// Consulta las tasas de hoy con los loaders existentes (mismos hosts que la
// CSP ya permite). Devuelve las opciones con fecha y las respuestas crudas
// (el conversor usa la de VE para la brecha BCV/paralelo). Sin red, los
// loaders devuelven su respaldo y rateOptions() lo descarta.
export async function fetchRateOptions(settings) {
  const raw = {}
  for (const k of loadersFor(settings)) { try { raw[k] = await LOADERS[k]() } catch { /* sin red */ } }
  return { options: rateOptions(settings, raw), raw }
}

// "Tasa BCV · 28 oct" o "Tasa guardada · sin fecha": la misma frase en el
// Inicio, Ajustes, el conversor y los paneles (rateLabelParts en refRate.js).
export function rateSourceText(r, t) {
  const p = rateLabelParts(r)
  if (!p) return ''
  return `${t(p.sourceKey)} · ${p.at ? fmtDay(p.at) : t('refcur.noDate')}`
}

// B1: aviso en línea con la tasa más reciente; un toque la guarda con su
// fuente y su fecha. Nada se reemplaza sin ese toque.
export function FreshRate({ fresh, sym, onUse, className }) {
  const { t } = useT()
  if (!fresh) return null
  return (
    <div className={`${s.freshRow} ${className || ''}`} role="status">
      <span className={s.freshText}>
        {t('refcur.fresh.text', { rate: fmtMoney(fresh.rate, sym), source: t(SOURCE_LABEL[fresh.source] || SOURCE_LABEL.manual), date: fmtDay(fresh.at) })}
      </span>
      <button type="button" className={s.refLink} onClick={onUse}
        aria-label={t('refcur.fresh.useAria', { rate: fmtMoney(fresh.rate, sym) })}>
        {t('refcur.fresh.use')}
      </button>
    </div>
  )
}

export function fmtDay(at, withTime = false) {
  try {
    return new Date(at).toLocaleString(dateLocale(), withTime
      ? { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }
      : { day: 'numeric', month: 'short' })
  } catch { return '' }
}

export function RefSwitch({ mode, onChange, localCode }) {
  const { t } = useT()
  return (
    <span className={s.refSwitch} role="group" aria-label={t('refcur.switchAria')}>
      {[['local', localCode], ['ref', REF_CURRENCY]].map(([m, code]) => (
        <button key={m} type="button" className={s.refOpt} aria-pressed={mode === m} onClick={() => onChange(m)}>
          <span className={s.refOptFace}>{code}</span>
        </button>
      ))}
    </span>
  )
}

export function RefRow({ refRate, mode, free, sym, country, showAmount, onEdit, tool, onTool, switcher, fresh, onUseFresh }) {
  const { t, lang } = useT()
  const stale = refRate && isStale(refRate.at, country)
  const days = refRate ? rateAgeDays(refRate.at) : null
  return (
    <div className={s.refRow}>
      {refRate ? (
        <>
          {(showAmount || switcher) && (
            <div className={s.refTop}>
              {showAmount && (
                <div className={`num ${s.refEquiv}`}>
                  ≈ <Money>{mode === 'ref'
                    ? `${free < 0 ? '−' : ''}${fmtMoney(Math.abs(free), sym)}`
                    : `${free < 0 ? '−' : ''}${fmtRef(toRef(Math.abs(free), refRate.rate), lang)}`}</Money>
                </div>
              )}
              {switcher}
            </div>
          )}
          <div className={s.refMeta}>
            <span className="num">1 {currencySymbol(REF_CURRENCY, lang)} = {fmtMoney(refRate.rate, sym)}</span>
            <span aria-hidden="true"> · </span>
            <span>{t(rateLabelParts(refRate).sourceKey)}</span>
            <span aria-hidden="true"> · </span>
            <span className={stale ? s.refStale : undefined}>
              {refRate.at ? fmtDay(refRate.at) : t('refcur.noDate')}
              {refRate.at && stale && days >= 2 ? ` (${t('refcur.old', { n: days })})` : ''}
            </span>
          </div>
          <FreshRate fresh={fresh} sym={sym} onUse={onUseFresh} />
        </>
      ) : (
        <div className={s.refMeta}>{t('refcur.addHint')}</div>
      )}
      <div className={s.refActions}>
        <button type="button" className={s.refLink} onClick={onEdit}>
          {t(refRate ? 'refcur.edit' : 'refcur.add')}
        </button>
        {tool && (
          <button type="button" className={s.refTool} onClick={onTool} aria-haspopup="dialog">
            <ArrowLeftRight size={16} strokeWidth={1.7} aria-hidden="true" />
            <span>{t('conv.open')}</span>
          </button>
        )}
      </div>
    </div>
  )
}

export function RateSheet({ open, onClose, settings, sym, current, onSave }) {
  const { t, lang } = useT()
  const inputRef = useRef(null)
  const [value, setValue] = useState('')
  const [picked, setPicked] = useState(null) // opción consultada elegida (fuente + fecha)
  const [state, setState] = useState('idle') // idle | loading | done | failed
  const [options, setOptions] = useState([])
  const loaders = useMemo(() => loadersFor(settings), [settings.country, settings.currency]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return
    setValue(current?.rate ? String(current.rate) : '')
    setPicked(null); setState('idle'); setOptions([])
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchToday() {
    setState('loading')
    const { options: opts } = await fetchRateOptions(settings)
    setOptions(opts)
    // VE: queda elegida la oficial del BCV (con su fecha); el paralelo sigue a un toque.
    const def = defaultRateOption(opts)
    if (def) { setPicked(def); setValue(String(def.rate)) }
    setState(opts.length ? 'done' : 'failed')
  }

  const num = Number(String(value).replace(',', '.'))
  const valid = String(value).trim() !== '' && Number.isFinite(num) && num > 0
  const code = (settings.currency || '').toUpperCase()

  function save() {
    if (!valid) return
    const fromPick = picked && Number(picked.rate) === num
    onSave({ usdRate: num, usdRateAt: fromPick ? picked.at : Date.now(), usdRateSource: fromPick ? picked.source : 'manual' })
  }

  return (
    <Sheet open={open} onClose={onClose} ariaLabel={t('refcur.sheet.title')}>
      <h2 className={s.sheetTitle}>{t('refcur.sheet.title')}</h2>
      <p className={s.sheetSub}>{t('refcur.sheet.sub')}</p>

      <label className={s.rateField}>
        <span className={s.rateLabel}>{t('refcur.sheet.perUsd', { currency: code })}</span>
        <span className={s.rateInputWrap}>
          <span className={`num ${s.ratePrefix}`} aria-hidden="true">1 {currencySymbol(REF_CURRENCY, lang)} =</span>
          <input ref={inputRef} className={`num ${s.rateInput}`} type="text" inputMode="decimal" autoComplete="off"
            value={value} onChange={e => { setValue(e.target.value); }} aria-invalid={value !== '' && !valid}
            aria-describedby="rate-help" />
        </span>
      </label>
      <div id="rate-help" className={value !== '' && !valid ? s.rateError : s.rateHelp} role={value !== '' && !valid ? 'alert' : undefined}>
        {value !== '' && !valid ? t('refcur.sheet.invalid') : t('refcur.sheet.fetchNote', { host: loaders.map(k => HOSTS[k]).join(', ') })}
      </div>

      {state !== 'done' && (
        <button type="button" className="fos-btn-secondary" style={{ width: '100%', marginTop: 12 }}
          onClick={fetchToday} disabled={state === 'loading'} aria-busy={state === 'loading' || undefined}>
          {state === 'loading' ? t('refcur.sheet.fetching') : t('refcur.sheet.fetch')}
        </button>
      )}
      {state === 'failed' && <div className={s.rateError} role="alert" style={{ marginTop: 8 }}>{t('refcur.sheet.fetchFail')}</div>}
      {state === 'done' && (
        <div className={s.rateOptions} role="group" aria-label={t('refcur.sheet.fetch')}>
          {options.map(o => {
            const on = picked?.source === o.source && Number(value) === o.rate
            return (
              <button key={o.source} type="button" className={s.rateOption} aria-pressed={on}
                onClick={() => { setPicked(o); setValue(String(o.rate)) }}>
                <span className={s.rateOptName}>{t(SOURCE_LABEL[o.source])}</span>
                <span className={`num ${s.rateOptVal}`}>{fmtMoney(o.rate, sym)}</span>
                <span className={s.rateOptAt}>{t('refcur.sheet.asOf', { date: fmtDay(o.at, true) })}</span>
              </button>
            )
          })}
        </div>
      )}

      <button type="button" className="fos-btn-primary" style={{ width: '100%', marginTop: 16 }} onClick={save} disabled={!valid}>
        {t('refcur.sheet.save')}
      </button>
    </Sheet>
  )
}

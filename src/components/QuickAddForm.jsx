// src/components/QuickAddForm.jsx
// Cuerpo del registro rápido (monto grande primero, fecha, método, chips de las
// categorías más usadas, toggle Ingreso/Egreso), sin contenedor: QuickAdd.jsx lo
// envuelve en Sheet y el onboarding lo embebe directo en su paso 2.
//   onSaved(type)  se llama después de guardar (QuickAdd cierra la hoja ahí)
//   resetKey       al cambiar, vuelve el formulario a cero
//   amountRef      ref opcional al campo del monto (Sheet lo usa para el foco inicial)
//   autoFocus      enfoca el monto al montarse
//   stickySave     "Guardar" fijo al pie (dentro de Sheet; decisión W3, B4a)
//   allowMoreDetails  muestra "Más detalles" (abre el gasto detallado con lo escrito;
//                  necesita Shell montado, así que el onboarding no lo usa)
import { useState, useMemo, useEffect, useLayoutEffect, useRef } from 'react'
import SignalIcon from './icons/SignalIcon.jsx'
import { Calendar, Check } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { useT } from '../i18n/useT.js'
import { useMoney } from './Money.jsx'
import { parseTransactionText } from '../utils/smsParser.js'
import { hapticTap } from '../utils/haptics.js'
import { orderQuickChips, hasProfileTemplate } from '../utils/quickChips.js'
import config from '../config.js'
import {
  localDateStr, dateLocale, moneyLocale, catName, catLabel, methodLabel,
  getCategoriesExpense, getCategoriesIncome, CATS_EXPENSE, CATS_INCOME,
  currencySymbol, fmtMoney, fmtMoneyFor, localeForCurrency,
} from '../utils/index.js'
import {
  pressKey, keypadToNumber, currencyDecimals, amountToKeypad, formatKeypadDisplay, decimalSeparator,
  KEY_BACKSPACE, KEY_DECIMAL, KEY_THOUSAND,
} from '../utils/keypad.js'
import { FREQS, monthPlan, findPendingMatch, detectRecurring, ruleFromRecord } from '../utils/recurring.js'
import { logClientError } from '../utils/errorLog.js'
import { refEligible, resolveRefRate, toRef, SOURCE_LABEL } from '../utils/refRate.js'
import {
  ruleKey, nextAutoCategory, topRepeats, fromUsd, buildUsdNote, keyToKeypad, isTextEntryTarget,
  buildDetailedPrefill, DETAILED_PREFILL_KEY,
} from '../utils/quickAdd.js'
import { navigateTo } from './quickAddBus.js'
import css from './QuickAddForm.module.css'

const readStorage = (k) => { try { return localStorage.getItem(k) } catch { return null } }

const todayStr = () => localDateStr()
const yesterdayStr = () => { const d = new Date(); d.setDate(d.getDate() - 1); return localDateStr(d) }
// "2026-10-05" -> fecha corta en el idioma de la interfaz (sin pasar por UTC)
const fmtShortDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' })
}
// Fallback de categoría: el gasto usa el plural 'Otros' y el ingreso el
// singular 'Otro' (ver CATS_EXPENSE / CATS_INCOME en utils).
const FALLBACK_CAT = { expense: 'Otros', income: 'Otro' }
const DEFAULT_METHOD = config.paymentMethods[0]

// Teclado numérico propio — evita el teclado del sistema (y su zoom) en el campo
// más usado de la app. Con una moneda sin decimales, la coma pasa a ser "000".
// B4a (W3): 4.ª columna con ⌫ arriba y ✓ (guardar) a la altura del pulgar; el
// ✓ se activa solo con monto y categoría.
function NumericKeypad({ setAmount, decimals, locale, t, canConfirm, onConfirm }) {
  const decimalKey = decimals > 0 ? KEY_DECIMAL : KEY_THOUSAND
  const sep = decimalSeparator(locale || moneyLocale())
  const label = (k) => (k === KEY_BACKSPACE ? t('qa.keypadBackspace') : k === KEY_DECIMAL ? t('qa.keypadDecimal') : k === KEY_THOUSAND ? t('qa.keypadThousand') : k)
  const key = (k, extra = '') => (
    <button key={k} type="button" className={`${css.key} ${extra}`}
      onClick={() => setAmount(a => pressKey(a, k, decimals))} aria-label={label(k)}>
      {k === KEY_DECIMAL ? sep : k}
    </button>
  )
  return (
    <div role="group" aria-label={t('qa.amount')} className={css.keypad}>
      {key('1')}{key('2')}{key('3')}{key(KEY_BACKSPACE)}
      {key('4')}{key('5')}{key('6')}
      <button type="button" className={`${css.key} ${css.keyOk}`} onClick={onConfirm} disabled={!canConfirm} aria-label={t('qa.keypadSave')}>
        <Check size={22} strokeWidth={2.2} aria-hidden="true" />
        <span aria-hidden="true">{t('qa.keypadSave')}</span>
      </button>
      {key('7')}{key('8')}{key('9')}
      {key(decimalKey)}{key('0', css.keyZero)}
    </div>
  )
}

// Hoy · Ayer · [calendario]. El tercer segmento es un <input type="date">
// nativo transparente encima del chip: en móvil abre el selector del sistema
// con un toque, en escritorio showPicker() lo abre al hacer clic.
function DateSegment({ date, setDate, t }) {
  const today = todayStr()
  const yesterday = yesterdayStr()
  const isCustom = date !== today && date !== yesterday
  return (
    <div role="group" aria-label={t('qa.dateLabel')} style={{ display: 'flex', gap: 6 }}>
      <button type="button" className="fos-chip fos-chip--tall" aria-pressed={date === today} onClick={() => setDate(today)}>
        {t('qa.today')}
      </button>
      <button type="button" className="fos-chip fos-chip--tall" aria-pressed={date === yesterday} onClick={() => setDate(yesterday)}>
        {t('qa.yesterday')}
      </button>
      <span className="fos-chip fos-chip--tall" aria-pressed={isCustom} style={{ minWidth: 44, padding: isCustom ? '8px 10px' : '8px 12px' }}>
        <Calendar size={16} strokeWidth={1.7} aria-hidden="true" />
        {isCustom && <span className="num" aria-hidden="true" style={{ fontSize: 13 }}>{fmtShortDate(date)}</span>}
        <input
          type="date"
          value={date}
          onChange={e => { if (e.target.value) setDate(e.target.value) }}
          onClick={e => { try { e.currentTarget.showPicker?.() } catch { /* almacenamiento o API del navegador no disponible: se sigue sin ello */ } }}
          aria-label={isCustom ? `${t('qa.pickDate')}: ${fmtShortDate(date)}` : t('qa.pickDate')}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, padding: 0, border: 'none', cursor: 'pointer', fontSize: 16 }}
        />
      </span>
    </div>
  )
}

export default function QuickAddForm({ defaultType = 'expense', onSaved, resetKey, amountRef: externalAmountRef, autoFocus = false, stickySave = false, allowMoreDetails = false }) {
  const { addExpense, addIncome, delExpense, delIncome, expenses, incomes, settings, updateSettings, showToast, recurring, addWithRule, saveRule } = useApp() || {}
  const { t, lang } = useT()
  // N3 (ola A, 30-oct-2026): "Repetir: … $X" respeta "ocultar montos" (T13).
  const { m: maskMoney } = useMoney()
  const [type, setType] = useState(defaultType)
  const [amount, setAmount] = useState('')
  const [desc, setDesc] = useState('')
  const [cat, setCat] = useState('')
  const [date, setDate] = useState(todayStr)
  const [method, setMethod] = useState(DEFAULT_METHOD)
  const [saving, setSaving] = useState(false)
  const [repeat, setRepeat] = useState(false)       // "Se repite" → crea un fijo
  const [freq, setFreq] = useState('monthly')
  const [pasteOpen, setPasteOpen] = useState(false)  // 1.1 · captura por pegado
  const [pasteText, setPasteText] = useState('')
  const [detected, setDetected] = useState(false)    // feedback "detectado"
  const [pastedDate, setPastedDate] = useState(null) // fecha que trae el SMS (YYYY-MM-DD), si la hay
  const [usdMode, setUsdMode] = useState(false)      // B4b · "Escribir en US$"
  const [suggestedMsg, setSuggestedMsg] = useState('') // anuncio de la categoría sugerida
  // ¿El usuario eligió la categoría a mano en esta apertura? La sugerencia
  // mientras escribe (B4a) nunca la pisa.
  const catManual = useRef(false)
  const ownAmountRef = useRef(null)
  const amountRef = externalAmountRef || ownAmountRef

  // Reglas comercio→categoría aprendidas (1.2). Viven en settings (local, se exportan/sincronizan).
  const merchantRules = (settings && typeof settings.merchantRules === 'object') ? settings.merchantRules : {}
  const lastMethod = config.paymentMethods.includes(settings?.lastPaymentMethod) ? settings.lastPaymentMethod : DEFAULT_METHOD
  const showEmoji = settings?.showCategoryEmoji === true

  const currency = settings?.currency
  const sym = currencySymbol(currency, settings?.language)
  const decimals = currencyDecimals(currency)

  // Tasa de referencia (R12): la del usuario o la última consultada, con su
  // fecha. Sin tasa, no hay equivalente ni "Escribir en US$": nunca se inventa.
  const refOn = refEligible(settings || {})
  const rateInfo = useMemo(() => (refOn ? resolveRefRate(settings || {}, readStorage) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refOn, settings?.usdRate, settings?.usdRateAt, settings?.usdRateSource, settings?.country, settings?.currency])
  const rate = rateInfo?.rate || 0
  const usdOn = usdMode && rate > 0
  const usdSym = currencySymbol('USD', lang)
  const usdDecimals = currencyDecimals('USD')
  const entryDecimals = usdOn ? usdDecimals : decimals
  const rateSource = rateInfo ? t(SOURCE_LABEL[rateInfo.source] || SOURCE_LABEL.manual) : ''
  const rateDate = rateInfo?.at
    ? new Date(rateInfo.at).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' })
    : t('refcur.noDate')

  // Al abrir (o al cambiar resetKey): resetea el formulario. Dentro de una hoja,
  // la accesibilidad de diálogo (Esc, focus-trap, foco inicial en el monto,
  // retorno de foco al cerrar) la maneja Sheet.jsx.
  useEffect(() => {
    setType(defaultType); setAmount(''); setDesc(''); setCat(''); setSaving(false)
    setDate(todayStr()); setMethod(lastMethod); setRepeat(false); setFreq('monthly')
    setPasteOpen(false); setPasteText(''); setDetected(false); setPastedDate(null)
    setUsdMode(false); setSuggestedMsg(''); catManual.current = false
    // lastMethod se lee al abrir; cambiarlo mientras el formulario está abierto no lo resetea
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, defaultType])

  useEffect(() => { if (autoFocus) amountRef.current?.focus() }, [autoFocus, amountRef])

  // Movimientos personales del tipo activo (los marcados como inversión no cuentan)
  const ownOfType = useMemo(() => {
    const src = (type === 'expense' ? expenses : incomes) || []
    return src.filter(r => r && !r.inv)
  }, [type, expenses, incomes])

  // Categorías más usadas del historial + las efectivas de la cuenta (canónicas
  // + las de la plantilla activa). Antes salían de config.categoriesExpense, que
  // no coincide con CATS_EXPENSE y no pasaba por catLabel (B3).
  const effectiveCats = useMemo(() => (type === 'expense' ? getCategoriesExpense(settings) : getCategoriesIncome(settings)), [type, settings])
  const chips = useMemo(() => {
    const counts = {}
    ownOfType.slice(-120).forEach(r => { if (r.category) counts[r.category] = (counts[r.category] || 0) + 1 })
    const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(e => e[0])
    // Plantilla de perfil activa (ej. freelancer): sus categorías primero (M5)
    const templateCats = (type === 'expense' ? settings?.categoriesExpense : settings?.categoriesIncome) || []
    return orderQuickChips({ ranked, effective: effectiveCats, templateCats, canonical: type === 'expense' ? CATS_EXPENSE : CATS_INCOME, templateActive: hasProfileTemplate(settings) })
  }, [type, ownOfType, settings, effectiveCats])
  // Categorías válidas para una sugerencia: las del tipo activo (el mapa de
  // reglas es compartido entre gastos e ingresos).
  const allowedCats = useMemo(() => [...new Set([...chips, ...effectiveCats, ...(type === 'expense' ? CATS_EXPENSE : CATS_INCOME)])], [chips, effectiveCats, type])

  // Fija la primera categoría al abrir / cambiar de tipo
  useEffect(() => { setCat(c => (chips.includes(c) ? c : chips[0] || '')) }, [chips, resetKey])

  // "Repetir" (B4b): los 3 movimientos más frecuentes de los últimos 90 días
  // (si no hay, el último de todos, como antes).
  const repeats = useMemo(() => topRepeats(ownOfType, { today: todayStr() }), [ownOfType])

  function changeType(k) {
    if (k === type) return
    setType(k); catManual.current = false; setSuggestedMsg('')
  }

  function pickCategory(c) {
    catManual.current = true
    setSuggestedMsg('')
    setCat(c)
  }

  // B4a: categoría sugerida mientras se escribe, con lo aprendido al guardar.
  function changeDesc(value) {
    setDesc(value)
    const next = nextAutoCategory({ desc: value, rules: merchantRules, allowed: allowedCats, manual: catManual.current, current: cat })
    if (next) {
      setCat(next)
      setSuggestedMsg(t('qa.suggested', { cat: catName(next, lang) }))
    }
  }

  function applyRepeat(r) {
    if (!r) return
    setUsdMode(false)
    setAmount(amountToKeypad(r.amount, decimals))
    setDesc(r.description || '')
    if (r.category) { setCat(r.category); catManual.current = true }
    setSuggestedMsg('')
    hapticTap()
  }

  // 1.1 · Interpreta el texto pegado (SMS/notificación bancaria) — 100% local (smsParser.js).
  // Rellena monto, descripción, tipo y fecha; y aplica la regla aprendida del comercio si existe (1.2).
  function handlePaste(text) {
    setPasteText(text)
    const r = parseTransactionText(text)
    if (!r || r.confidence !== 'high') { setDetected(false); setPastedDate(null); return }
    // El SMS trae el monto en la moneda principal: se sale de "Escribir en US$".
    setUsdMode(false)
    if (r.amount != null) setAmount(amountToKeypad(r.amount, decimals))
    // Fecha del SMS: solo si no es futura (un dd/mm mal interpretado, o un SMS
    // con formato mm/dd, no debe dejar un gasto en el futuro). Pasa al selector
    // de fecha, donde se ve y se puede corregir.
    const smsDate = r.date && r.date <= todayStr() ? r.date : null
    setPastedDate(smsDate)
    if (smsDate) setDate(smsDate)
    if (r.type) setType(r.type)
    if (r.merchant) {
      setDesc(r.merchant)
      const learned = merchantRules[ruleKey(r.merchant)]
      if (learned) setCat(learned)   // 2ª vez que aparece este comercio, ya tiene categoría
    }
    setDetected(true)
  }

  // Guarda en UNA escritura de settings la regla comercio→categoría (1.2) y el
  // último método usado: dos updateSettings seguidos con el mismo `settings`
  // se pisarían entre sí.
  async function rememberChoices(merchant, category, usedMethod) {
    const k = ruleKey(merchant)
    const patch = {}
    if (k && category && merchantRules[k] !== category) patch.merchantRules = { ...merchantRules, [k]: category }
    if (usedMethod && settings?.lastPaymentMethod !== usedMethod) patch.lastPaymentMethod = usedMethod
    if (Object.keys(patch).length === 0) return
    try { await updateSettings?.({ ...settings, ...patch }) } catch (e) { logClientError({ type: 'swallowed', message: String(e?.message || e), source: 'quickadd.updateSettings' }) }
  }

  const typed = keypadToNumber(amount)
  // Monto que se guarda, siempre en la moneda principal (B4b: US$ → local).
  const amt = usdOn ? fromUsd(typed, rate, decimals) : typed
  const canSave = amt > 0 && !saving
  const canConfirm = canSave && !!cat
  const accent = type === 'expense' ? 'var(--neg)' : 'var(--pos)'
  const entryLocale = usdOn ? localeForCurrency('USD', lang) : moneyLocale()
  const display = formatKeypadDisplay(amount, entryLocale)
  const amountSize = display.length > 11 ? 32 : display.length > 8 ? 38 : 44

  // Equivalente en vivo bajo el monto (B4a): en US$ si se escribe en la moneda
  // principal, o en la moneda principal si se escribe en US$. Pasa por
  // "ocultar montos".
  const equivText = rate > 0 && typed > 0
    ? (usdOn ? maskMoney(fmtMoney(amt, sym)) : maskMoney(fmtMoneyFor(toRef(typed, rate), 'USD', lang)))
    : ''
  const rateChip = rate > 0 ? `1 US$ = ${fmtMoney(rate, sym)} · ${rateSource} · ${rateDate}` : ''

  function toggleUsd() {
    if (!(rate > 0)) return
    // Convierte lo ya escrito para no perderlo al cambiar de moneda.
    if (usdOn) setAmount(typed > 0 ? amountToKeypad(fromUsd(typed, rate, decimals), decimals) : '')
    else setAmount(typed > 0 ? amountToKeypad(toRef(typed, rate), usdDecimals) : '')
    setUsdMode(!usdOn)
  }

  // El campo del monto mide exactamente su texto (espejo invisible): con un
  // ancho fijo en `ch` quedaba un hueco entre el símbolo y la cifra.
  const mirrorRef = useRef(null)
  const [amountWidth, setAmountWidth] = useState(60)
  useLayoutEffect(() => {
    const w = mirrorRef.current?.offsetWidth
    if (w) setAmountWidth(Math.ceil(w) + 4)
  }, [display, amountSize])

  async function save() {
    if (!canSave) return
    setSaving(true)
    const finalDesc = desc.trim() || catName(cat, lang)
    // B4b: lo escrito en US$ queda en la nota ("US$ X → Bs Y (fuente, fecha)");
    // la descripción no se toca y no hay campos nuevos.
    const usdNote = usdOn
      ? buildUsdNote({ usdText: fmtMoneyFor(typed, 'USD', lang), localText: fmtMoney(amt, sym), source: rateSource, date: rateDate })
      : ''
    const base = { description: finalDesc, amount: amt, date: date || todayStr(), category: cat || FALLBACK_CAT[type] }
    // Los ingresos llevan el nombre en `source` (lo que muestra Ingresos); se
    // conserva también `description` como antes.
    const data = type === 'expense'
      ? { ...base, subcategory: '', method, type: 'Necesidad', notes: usdNote, project: '' }
      : { ...base, source: finalDesc, ...(usdNote ? { notes: usdNote } : {}) }
    let savedItem = null
    try {
      if (repeat && addWithRule) {
        // "Se repite": el movimiento y su regla, con este registro como primera ocurrencia.
        await addWithRule(type, data, freq)
      } else {
        // ¿Cubre un fijo previsto de este mes? Se vincula para no contarlo dos veces.
        const plan = monthPlan(recurring || [], data.date.slice(0, 7), { incomes, expenses })
        const match = findPendingMatch(data, plan, type)
        const linked = match ? { ...data, recurringId: match.ruleId, occurrenceDate: match.date } : data
        if (type === 'expense') savedItem = await addExpense?.(linked)
        else savedItem = await addIncome?.(linked)
        // "¿Lo marcamos como fijo?": mismo comercio 2 de los últimos 3 meses.
        const hit = !match && saveRule && detectRecurring(data,
          type === 'expense' ? expenses : incomes, recurring, { kind: type })
        if (hit) {
          setTimeout(() => showToast?.(t('rec.suggest.text', { name: finalDesc }), 'ok', {
            label: t('rec.suggest.action'),
            onAction: async () => {
              await saveRule(ruleFromRecord(data, { kind: type, freq: hit.freq }))
              showToast?.(t('rec.toast.created'), 'ok')
            },
          }), 900)
        }
      }
      // aprende comercio→categoría (usa la descripción como comercio) y el método usado
      rememberChoices(finalDesc, cat, type === 'expense' ? method : null)
      hapticTap()
      // A9 (30-oct-2026): "Deshacer" en el toast de guardado (solo altas simples:
      // un "Se repite" crea además la regla, que se deshace desde Fijos).
      const undoDel = type === 'expense' ? delExpense : delIncome
      showToast?.(type === 'expense' ? t('qa.savedExpense') : t('qa.savedIncome'), 'ok',
        savedItem?.id && undoDel ? { label: t('common.undo'), onAction: () => undoDel(savedItem.id) } : null)
      setSaving(false)
      onSaved?.(type)
    } catch {
      setSaving(false)
    }
  }

  // "Más detalles" (B4a): el gasto detallado de Movimientos (subcategoría,
  // tipo, notas, inversión, proyecto) con lo ya escrito. Contrato:
  // sessionStorage[DETAILED_PREFILL_KEY]; Shell cierra la hoja y navega.
  function openDetailed() {
    const prefill = buildDetailedPrefill({ description: desc, amount: amt, date, category: cat, method })
    try { sessionStorage.setItem(DETAILED_PREFILL_KEY, JSON.stringify(prefill)) } catch { /* almacenamiento no disponible: se abre el formulario vacío */ }
    navigateTo('movements')
  }

  // Teclado físico en escritorio (B4a): dígitos, coma/punto, Backspace y
  // Enter, mientras el foco no esté en un campo de texto. El monto sigue
  // readOnly con inputMode="none": en el celular no aparece el teclado del sistema.
  const keyHandler = useRef(null)
  keyHandler.current = (e) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return
    const k = keyToKeypad(e.key, entryDecimals)
    if (!k) return
    if (isTextEntryTarget(e.target, { forEnter: k === 'save' })) return
    e.preventDefault()
    if (k === 'save') { save(); return }
    setAmount(a => pressKey(a, k, entryDecimals))
  }
  useEffect(() => {
    const onKey = (e) => keyHandler.current?.(e)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const chipLabel = (c) => (showEmoji ? catLabel(c, lang) : catName(c, lang))
  const repeatLabel = (r) => r.description || catName(r.category, lang) || ''

  const saveButton = (
    <button type="button" className="fos-btn-primary" onClick={save} disabled={!canSave} style={{ minHeight: 48 }}>
      {saving ? '…' : t('qa.save')}
    </button>
  )

  return (
    <>
        {/* Toggle tipo — único lugar, junto al monto, con color semántico */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--sur3)', borderRadius: 'var(--r)', padding: 3, marginBottom: 12 }}>
          {[['expense', t('qa.expense')], ['income', t('qa.income')]].map(([k, lb]) => (
            <button key={k} type="button" aria-pressed={type === k} onClick={() => changeType(k)}
              style={{ flex: 1, minHeight: 40, borderRadius: 'var(--rs)', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'var(--sans)',
                background: type === k ? 'var(--sur)' : 'transparent', color: type === k ? (k === 'expense' ? 'var(--neg)' : 'var(--pos)') : 'var(--tm)',
                boxShadow: type === k ? 'var(--sh-1)' : 'none' }}>
              {lb}
            </button>
          ))}
        </div>

        {/* Monto grande — readOnly + inputMode="none": evita el teclado del sistema
            (y su zoom) porque el teclado numérico propio de abajo escribe acá.
            Se muestra con separador de miles del locale de la moneda. */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6, marginBottom: 4, minHeight: 56 }}>
          <span style={{ fontFamily: 'var(--num)', fontSize: 26, fontWeight: 600, color: 'var(--th)' }}>{usdOn ? usdSym : sym}</span>
          <span ref={mirrorRef} aria-hidden="true" className="num"
            style={{ position: 'absolute', visibility: 'hidden', whiteSpace: 'pre', fontSize: amountSize, fontWeight: 700, letterSpacing: '-0.02em' }}>
            {display || '0'}
          </span>
          <input
            ref={amountRef} type="text" inputMode="none" readOnly value={display}
            placeholder="0"
            aria-label={usdOn ? `${t('qa.amount')} (US$)` : t('qa.amount')}
            className="num"
            style={{ width: amountWidth, maxWidth: rate > 0 ? '64%' : '82%', border: 'none', background: 'transparent', textAlign: 'center', caretColor: accent,
              fontSize: amountSize, fontWeight: 700, color: accent, padding: 0, letterSpacing: '-0.02em' }}
          />
          {/* B4b · "Escribir en US$": solo con una tasa de referencia real */}
          {rate > 0 && (
            <button type="button" className={css.usdToggle} aria-pressed={usdOn} onClick={toggleUsd} aria-label={t('qa.usdMode')} title={t('qa.usdMode')}>
              US$
            </button>
          )}
        </div>

        {/* Equivalente en vivo + chip de la tasa usada (fuente y fecha) */}
        {rate > 0 && (
          <div className={css.equiv}>
            {equivText && (
              <span>
                <span className="num" aria-hidden="true">≈ {equivText}</span>
                <span className="sr-only">{t('qa.equivAria', { amount: equivText })}</span>
              </span>
            )}
            <span className={css.rateChip} title={rateChip}>
              <span aria-hidden="true">{rateChip}</span>
              <span className="sr-only">{t('qa.rateUsed', { rate: rateChip })}</span>
            </span>
          </div>
        )}

        {/* Fecha + 1.1 · Pegar SMS/notificación bancaria (se interpreta 100% local) */}
        <div className={css.dateRow}>
          <DateSegment date={date} setDate={setDate} t={t} />
          {!pasteOpen && (
            <button type="button" className={css.pasteBtn} onClick={() => setPasteOpen(true)} aria-label={t('qa.pasteCta')} title={t('qa.pasteCta')}>
              <span aria-hidden>⎘</span> {t('qa.pasteShort')}
            </button>
          )}
        </div>
        {pasteOpen && (
          <div style={{ marginBottom: 12 }}>
            <textarea
              value={pasteText}
              onChange={e => handlePaste(e.target.value)}
              placeholder={t('qa.pastePh')}
              rows={2}
              aria-label={t('qa.pasteCta')}
              style={{ resize: 'none', fontSize: 16, textAlign: 'left', marginBottom: 6 }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span role="status" style={{ fontSize: 12, fontFamily: 'var(--sans)', color: detected ? 'var(--pos)' : 'var(--th)' }}>
                {detected
                  ? `✓ ${pastedDate && pastedDate !== todayStr()
                      ? t('qa.pasteDetectedDate', { date: fmtShortDate(pastedDate) })
                      : t('qa.pasteDetected')}`
                  : t('qa.pasteLocal')}
              </span>
              <button type="button" className="fos-link" style={{ fontSize: 13, flexShrink: 0 }}
                onClick={() => { setPasteOpen(false); setPasteText(''); setDetected(false); setPastedDate(null) }}>
                {t('qa.pasteClose')}
              </button>
            </div>
          </div>
        )}

        <NumericKeypad setAmount={setAmount} decimals={entryDecimals} locale={entryLocale} t={t} canConfirm={canConfirm} onConfirm={save} />

        {/* Descripción + método de pago (solo gastos) */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <input
            type="text" value={desc} onChange={e => changeDesc(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && save()}
            placeholder={t('qa.descPh')}
            aria-label={t('qa.desc')}
            style={{ flex: 1, minWidth: 0, minHeight: 44, textAlign: type === 'expense' ? 'left' : 'center' }}
          />
          {type === 'expense' && (
            <select
              value={method}
              onChange={e => setMethod(e.target.value)}
              aria-label={t('qa.method')}
              style={{ width: 'auto', maxWidth: '40%', minHeight: 44, padding: '8px 10px', color: 'var(--tm)', fontWeight: 500, cursor: 'pointer' }}
            >
              {config.paymentMethods.map(m => <option key={m} value={m}>{methodLabel(m, lang)}</option>)}
            </select>
          )}
        </div>
        <span className="sr-only" aria-live="polite">{suggestedMsg}</span>

        {/* Repetir (B4b): los 3 más frecuentes, de un toque; rellena sin guardar */}
        {repeats.length > 0 && (
          <div role="group" aria-label={t('qa.repeatGroup')} className={css.repeats}>
            {repeats.map(r => {
              const money = maskMoney(fmtMoney(r.amount, sym))
              return (
                <button key={r.key} type="button" className={`fos-chip ${css.repeatChip}`} onClick={() => applyRepeat(r)}
                  aria-label={t('qa.repeat', { desc: repeatLabel(r), amount: money })}>
                  <SignalIcon kind="subs" size={14} />
                  <span aria-hidden="true" className={css.repeatDesc}>{repeatLabel(r)}</span>
                  <span aria-hidden="true" className={`num ${css.repeatAmt}`}>{money}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Chips de categoría */}
        <div role="group" aria-label={t('qa.category')} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 10 }}>
          {(chips.includes(cat) || !cat ? chips : [...chips, cat]).map(c => (
            <button key={c} type="button" className="fos-chip" aria-pressed={cat === c} onClick={() => pickCategory(c)}>
              {chipLabel(c)}
            </button>
          ))}
        </div>

        {/* Se repite → movimiento fijo (con frecuencia). Toda la fila es el objetivo táctil. */}
        <div className={css.repeatRow}>
          <label className={css.repeatLabel}>
            <input type="checkbox" checked={repeat} onChange={e => setRepeat(e.target.checked)} />
            {t('rec.repeat.toggle')}
          </label>
          {repeat && (
            <select value={freq} onChange={e => setFreq(e.target.value)} aria-label={t('rec.repeat.freq')}>
              {FREQS.map(f => <option key={f} value={f}>{t(`rec.freq.${f}`)}</option>)}
            </select>
          )}
        </div>

        {/* Más detalles → gasto detallado con lo ya escrito (secundario) */}
        {allowMoreDetails && type === 'expense' && (
          <div className={css.moreRow}>
            <button type="button" className="fos-link" onClick={openDetailed} style={{ fontSize: 13 }}>
              {t('qa.moreDetails')}
            </button>
          </div>
        )}

        {/* Guardar — Latón con texto Navy en los dos tipos. En la hoja, fijo al pie (W3). */}
        {stickySave ? <div className={css.footer}>{saveButton}</div> : <div style={{ marginTop: 8 }}>{saveButton}</div>}
    </>
  )
}

// src/components/QuickAddForm.jsx
// Cuerpo del registro rápido (monto grande primero, fecha, método, chips de las
// categorías más usadas, toggle Ingreso/Egreso), sin contenedor: QuickAdd.jsx lo
// envuelve en Sheet y el onboarding lo embebe directo en su paso 2.
//   onSaved(type)  se llama después de guardar (QuickAdd cierra la hoja ahí)
//   resetKey       al cambiar, vuelve el formulario a cero
//   amountRef      ref opcional al campo del monto (Sheet lo usa para el foco inicial)
//   autoFocus      enfoca el monto al montarse
import { useState, useMemo, useEffect, useLayoutEffect, useRef } from 'react'
import SignalIcon from './icons/SignalIcon.jsx'
import { Calendar } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { useT } from '../i18n/useT.js'
import { parseTransactionText } from '../utils/smsParser.js'
import { hapticTap } from '../utils/haptics.js'
import { orderQuickChips, hasProfileTemplate } from '../utils/quickChips.js'
import config from '../config.js'
import {
  localDateStr, dateLocale, moneyLocale, catName, catLabel, methodLabel,
  getCategoriesExpense, getCategoriesIncome, CATS_EXPENSE, CATS_INCOME,
  currencySymbol, fmtMoney,
} from '../utils/index.js'
import {
  pressKey, keypadToNumber, currencyDecimals, amountToKeypad, formatKeypadDisplay, decimalSeparator,
  KEY_BACKSPACE, KEY_DECIMAL, KEY_THOUSAND,
} from '../utils/keypad.js'

// Normaliza un comercio para usarlo como llave de regla (minúsculas, sin acentos ni espacios extra)
const ruleKey = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

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
function NumericKeypad({ setAmount, decimals, t }) {
  const decimalKey = decimals > 0 ? KEY_DECIMAL : KEY_THOUSAND
  const sep = decimalSeparator(moneyLocale())
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', decimalKey, '0', KEY_BACKSPACE]
  return (
    <div
      role="group" aria-label={t('qa.amount')}
      style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}
    >
      {keys.map(k => (
        <button
          key={k}
          type="button"
          onClick={() => setAmount(a => pressKey(a, k, decimals))}
          aria-label={k === KEY_BACKSPACE ? t('qa.keypadBackspace') : k === KEY_DECIMAL ? t('qa.keypadDecimal') : k === KEY_THOUSAND ? t('qa.keypadThousand') : k}
          style={{
            minHeight: 48, borderRadius: 'var(--r)', border: 'none', cursor: 'pointer',
            background: 'var(--sur2)', color: 'var(--tx)', fontFamily: 'var(--mono)',
            fontSize: 18, fontWeight: 600,
          }}
        >
          {k === KEY_DECIMAL ? sep : k}
        </button>
      ))}
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
          onClick={e => { try { e.currentTarget.showPicker?.() } catch {} }}
          aria-label={isCustom ? `${t('qa.pickDate')}: ${fmtShortDate(date)}` : t('qa.pickDate')}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, padding: 0, border: 'none', cursor: 'pointer', fontSize: 16 }}
        />
      </span>
    </div>
  )
}

export default function QuickAddForm({ defaultType = 'expense', onSaved, resetKey, amountRef: externalAmountRef, autoFocus = false }) {
  const { addExpense, addIncome, expenses, incomes, settings, updateSettings, showToast } = useApp() || {}
  const { t, lang } = useT()
  const [type, setType] = useState(defaultType)
  const [amount, setAmount] = useState('')
  const [desc, setDesc] = useState('')
  const [cat, setCat] = useState('')
  const [date, setDate] = useState(todayStr)
  const [method, setMethod] = useState(DEFAULT_METHOD)
  const [saving, setSaving] = useState(false)
  const [pasteOpen, setPasteOpen] = useState(false)  // 1.1 · captura por pegado
  const [pasteText, setPasteText] = useState('')
  const [detected, setDetected] = useState(false)    // feedback "detectado"
  const [pastedDate, setPastedDate] = useState(null) // fecha que trae el SMS (YYYY-MM-DD), si la hay
  const ownAmountRef = useRef(null)
  const amountRef = externalAmountRef || ownAmountRef

  // Reglas comercio→categoría aprendidas (1.2). Viven en settings (local, se exportan/sincronizan).
  const merchantRules = (settings && typeof settings.merchantRules === 'object') ? settings.merchantRules : {}
  const lastMethod = config.paymentMethods.includes(settings?.lastPaymentMethod) ? settings.lastPaymentMethod : DEFAULT_METHOD
  const showEmoji = settings?.showCategoryEmoji === true

  const currency = settings?.currency
  const sym = currencySymbol(currency, settings?.language)
  const decimals = currencyDecimals(currency)

  // Al abrir (o al cambiar resetKey): resetea el formulario. Dentro de una hoja,
  // la accesibilidad de diálogo (Esc, focus-trap, foco inicial en el monto,
  // retorno de foco al cerrar) la maneja Sheet.jsx.
  useEffect(() => {
    setType(defaultType); setAmount(''); setDesc(''); setCat(''); setSaving(false)
    setDate(todayStr()); setMethod(lastMethod)
    setPasteOpen(false); setPasteText(''); setDetected(false); setPastedDate(null)
    // lastMethod se lee al abrir; cambiarlo mientras el formulario está abierto no lo resetea
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, defaultType])

  useEffect(() => { if (autoFocus) amountRef.current?.focus() }, [autoFocus])

  // Movimientos personales del tipo activo (los marcados como inversión no cuentan)
  const ownOfType = useMemo(() => {
    const src = (type === 'expense' ? expenses : incomes) || []
    return src.filter(r => r && !r.inv)
  }, [type, expenses, incomes])

  // Categorías más usadas del historial + las efectivas de la cuenta (canónicas
  // + las de la plantilla activa). Antes salían de config.categoriesExpense, que
  // no coincide con CATS_EXPENSE y no pasaba por catLabel (B3).
  const chips = useMemo(() => {
    const counts = {}
    ownOfType.slice(-120).forEach(r => { if (r.category) counts[r.category] = (counts[r.category] || 0) + 1 })
    const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(e => e[0])
    const effective = type === 'expense' ? getCategoriesExpense(settings) : getCategoriesIncome(settings)
    // Plantilla de perfil activa (ej. freelancer): sus categorías primero (M5)
    const templateCats = (type === 'expense' ? settings?.categoriesExpense : settings?.categoriesIncome) || []
    return orderQuickChips({ ranked, effective, templateCats, canonical: type === 'expense' ? CATS_EXPENSE : CATS_INCOME, templateActive: hasProfileTemplate(settings) })
  }, [type, ownOfType, settings])

  // Fija la primera categoría al abrir / cambiar de tipo
  useEffect(() => { setCat(c => (chips.includes(c) ? c : chips[0] || '')) }, [chips, resetKey])

  // "Repetir": el último movimiento del mismo tipo (por fecha, y por creación a igual fecha)
  const last = useMemo(() => {
    let best = null
    for (const r of ownOfType) {
      if (!(Number(r.amount) > 0)) continue
      if (!best || (r.date || '') > (best.date || '') ||
        ((r.date || '') === (best.date || '') && (r.createdAt || '') > (best.createdAt || ''))) best = r
    }
    return best
  }, [ownOfType])
  const lastDesc = last ? (last.description || last.source || catName(last.category, lang) || '') : ''

  function repeatLast() {
    if (!last) return
    setAmount(amountToKeypad(last.amount, decimals))
    setDesc(last.description || last.source || '')
    if (last.category) setCat(last.category)
    hapticTap()
  }

  // 1.1 · Interpreta el texto pegado (SMS/notificación bancaria) — 100% local (smsParser.js).
  // Rellena monto, descripción, tipo y fecha; y aplica la regla aprendida del comercio si existe (1.2).
  function handlePaste(text) {
    setPasteText(text)
    const r = parseTransactionText(text)
    if (!r || r.confidence !== 'high') { setDetected(false); setPastedDate(null); return }
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
    try { await updateSettings?.({ ...settings, ...patch }) } catch {}
  }

  const amt = keypadToNumber(amount)
  const canSave = amt > 0 && !saving
  const accent = type === 'expense' ? 'var(--neg)' : 'var(--pos)'
  const display = formatKeypadDisplay(amount, moneyLocale())
  const amountSize = display.length > 11 ? 32 : display.length > 8 ? 38 : 44

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
    const base = { description: finalDesc, amount: amt, date: date || todayStr(), category: cat || FALLBACK_CAT[type] }
    try {
      if (type === 'expense') await addExpense?.({ ...base, subcategory: '', method, type: 'Necesidad', notes: '', project: '' })
      else await addIncome?.({ ...base })
      // aprende comercio→categoría (usa la descripción como comercio) y el método usado
      rememberChoices(finalDesc, cat, type === 'expense' ? method : null)
      hapticTap()
      showToast?.(type === 'expense' ? t('qa.savedExpense') : t('qa.savedIncome'), 'ok')
      setSaving(false)
      onSaved?.(type)
    } catch {
      setSaving(false)
    }
  }

  const chipLabel = (c) => (showEmoji ? catLabel(c, lang) : catName(c, lang))

  return (
    <>
        {/* Toggle tipo — único lugar, junto al monto, con color semántico */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--sur3)', borderRadius: 'var(--r)', padding: 3, marginBottom: 16 }}>
          {[['expense', t('qa.expense')], ['income', t('qa.income')]].map(([k, lb]) => (
            <button key={k} type="button" aria-pressed={type === k} onClick={() => setType(k)}
              style={{ flex: 1, minHeight: 40, borderRadius: 'var(--rs)', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'var(--sans)',
                background: type === k ? 'var(--sur)' : 'transparent', color: type === k ? (k === 'expense' ? 'var(--neg)' : 'var(--pos)') : 'var(--tm)',
                boxShadow: type === k ? 'var(--sh-1)' : 'none' }}>
              {lb}
            </button>
          ))}
        </div>

        {/* 1.1 · Pegar SMS/notificación bancaria — se interpreta 100% local, nada sale del equipo */}
        {!pasteOpen ? (
          <button type="button" onClick={() => setPasteOpen(true)}
            style={{ width: '100%', minHeight: 44, marginBottom: 14, padding: '8px 12px', borderRadius: 'var(--r)', cursor: 'pointer',
              border: '1px dashed var(--brd2)', background: 'var(--sur2)', color: 'var(--tm)',
              fontSize: 13, fontFamily: 'var(--sans)', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
            <span aria-hidden>⎘</span> {t('qa.pasteCta')}
          </button>
        ) : (
          <div style={{ marginBottom: 14 }}>
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

        {/* Monto grande — readOnly + inputMode="none": evita el teclado del sistema
            (y su zoom) porque el teclado numérico propio de abajo escribe acá.
            Se muestra con separador de miles del locale de la moneda. */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6, marginBottom: 12, minHeight: 56 }}>
          <span style={{ fontFamily: 'var(--display)', fontSize: 26, fontWeight: 700, color: 'var(--th)' }}>{sym}</span>
          <span ref={mirrorRef} aria-hidden="true" className="num"
            style={{ position: 'absolute', visibility: 'hidden', whiteSpace: 'pre', fontSize: amountSize, fontWeight: 700, letterSpacing: '-0.02em' }}>
            {display || '0'}
          </span>
          <input
            ref={amountRef} type="text" inputMode="none" readOnly value={display}
            placeholder="0"
            aria-label={t('qa.amount')}
            className="num"
            style={{ width: amountWidth, maxWidth: '82%', border: 'none', background: 'transparent', textAlign: 'center', caretColor: accent,
              fontSize: amountSize, fontWeight: 700, color: accent, padding: 0, letterSpacing: '-0.02em' }}
          />
        </div>

        {/* Fecha */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
          <DateSegment date={date} setDate={setDate} t={t} />
        </div>

        <NumericKeypad setAmount={setAmount} decimals={decimals} t={t} />

        {/* Descripción + método de pago (solo gastos) */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <input
            type="text" value={desc} onChange={e => setDesc(e.target.value)}
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

        {/* Repetir el último movimiento del mismo tipo */}
        {last && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
            <button type="button" className="fos-link" onClick={repeatLast}
              style={{ fontSize: 13, maxWidth: '100%', overflow: 'hidden' }}>
              <SignalIcon kind="subs" size={14} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t('qa.repeat', { desc: lastDesc, amount: fmtMoney(last.amount, sym) })}
              </span>
            </button>
          </div>
        )}

        {/* Chips de categoría */}
        <div role="group" aria-label={t('qa.category')} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 18 }}>
          {(chips.includes(cat) || !cat ? chips : [...chips, cat]).map(c => (
            <button key={c} type="button" className="fos-chip" aria-pressed={cat === c} onClick={() => setCat(c)}>
              {chipLabel(c)}
            </button>
          ))}
        </div>

        {/* Guardar — Latón con texto Navy en los dos tipos */}
        <button type="button" className="fos-btn-primary" onClick={save} disabled={!canSave} style={{ minHeight: 48 }}>
          {saving ? '…' : t('qa.save')}
        </button>
    </>
  )
}
